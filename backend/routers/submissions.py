"""Code submission + judging."""
import asyncio
import shutil
import tempfile
import threading
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
import schemas
from auth import ALGORITHM, SECRET_KEY, get_admin_user, get_current_user
from code_runner import _normalize, compile_code, judge_submission, run_once, memcheck
from database import get_db
from interactive_runner import make_session

router = APIRouter()


class RunRequest(BaseModel):
    code: str
    custom_input: str = ""


class SampleCase(BaseModel):
    id: Optional[int] = None
    input_data: str = ""
    expected_output: str = ""


class RunSamplesRequest(BaseModel):
    code: str
    cases: List[SampleCase] = []




class VisualizeRequest(BaseModel):
    code: str
    custom_input: str = ""


@router.post("/memcheck")
def memory_check(payload: VisualizeRequest, _user: models.User = Depends(get_current_user)):
    """Static "Code Check": run pyflakes (undefined names, unused vars/imports, …) and run the program once."""
    return memcheck(payload.code, payload.custom_input)


class TestPingIn(BaseModel):
    tab_switches: int = 0
    runs: int = 0


@router.post("/test-ping/{problem_id}")
def test_ping(problem_id: int, payload: TestPingIn = TestPingIn(),
              db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Heartbeat while a student is in a test — feeds the admin's live proctoring view
    with violations (tab switches) and run count."""
    import datetime as _dt
    now = _dt.datetime.utcnow()
    tabs, runs = max(0, payload.tab_switches), max(0, payload.runs)
    sess = db.query(models.TestSession).filter(
        models.TestSession.problem_id == problem_id, models.TestSession.user_id == user.id).first()
    if sess:
        sess.last_seen = now
        sess.tab_switches = max(sess.tab_switches or 0, tabs)
        sess.runs = max(sess.runs or 0, runs)
    else:
        db.add(models.TestSession(problem_id=problem_id, user_id=user.id, started_at=now,
                                  last_seen=now, tab_switches=tabs, runs=runs))
    db.commit()
    return {"ok": True}


def _poststate_locals(steps):
    """
    Both tracers capture a variable's value at LINE ENTRY (before the line runs),
    so e.g. an input() line shows the old value and the real value only lands
    on the next step. Beginners expect "this line ran → here's the result", so we
    display each step with the NEXT step's locals — but only when that next step is
    in the SAME function frame (same func + call depth), otherwise a function call
    would wrongly show the callee's variables on the caller's line.
    """
    if not steps:
        return steps
    n = len(steps)

    def depth(s):
        return len(s.get("stack") or [])

    out = []
    for i, s in enumerate(steps):
        nxt = steps[i + 1] if i + 1 < n else None
        if nxt is not None and nxt.get("func") == s.get("func") and depth(nxt) == depth(s):
            out.append({**s, "locals": nxt.get("locals", s.get("locals"))})
        else:
            out.append(s)
    return out


@router.post("/visualize")
def visualize(payload: VisualizeRequest, _user: models.User = Depends(get_current_user)):
    """
    Step-by-step execution trace (line + variable values per step) via
    sys.settrace, for the Code Visualizer.
    """
    from python_tracer import trace as _py_trace

    with tempfile.TemporaryDirectory() as tmp:
        res = _py_trace(payload.code, payload.custom_input, tmp)
        if isinstance(res, dict) and res.get("steps"):
            res["steps"] = _poststate_locals(res["steps"])[:500]
        return res


@router.post("/run")
def run_code(
    payload: RunRequest,
    _user: models.User = Depends(get_current_user),
):
    """Compile and run code against custom input (no submission stored, no grading)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        exe, compile_msg = compile_code(payload.code, tmpdir)
        if not exe:
            return {"status": "Compilation Error", "output": compile_msg, "time_ms": 0}
        result = run_once(exe, payload.custom_input)
        return {
            "status": result["status"],
            "output": result["output"],
            "time_ms": result["time_ms"],
            "mem_kb": result.get("mem_kb"),
            "warnings": compile_msg,
        }


@router.post("/run-samples")
def run_samples(
    payload: RunSamplesRequest,
    _user: models.User = Depends(get_current_user),
):
    """
    Compile once and run the code against the visible sample cases.
    Returns per-case actual output + pass/fail for an Expected-vs-Yours
    comparison. NOTHING is stored and NO score is recorded — this is a
    student self-check tool, not a submission.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        exe, compile_msg = compile_code(payload.code, tmpdir)
        if not exe:
            return {"status": "Compilation Error", "error": compile_msg, "results": []}

        results = []
        for idx, case in enumerate(payload.cases):
            run = run_once(exe, case.input_data)
            expected = _normalize(case.expected_output)
            actual = run["output"]
            ok = run["status"] == "ok"
            results.append(
                {
                    "id": case.id,
                    "index": idx,
                    "input": case.input_data,
                    "expected": expected,
                    "actual": actual,
                    "run_status": run["status"],          # ok / Runtime Error / Time Limit Exceeded
                    "passed": (actual == expected) if ok else False,
                    "time_ms": run["time_ms"],
                    "mem_kb": run.get("mem_kb"),
                }
            )

        return {"status": "ok", "error": "", "results": results, "warnings": compile_msg}


@router.websocket("/run-interactive")
async def run_interactive(ws: WebSocket):
    """
    Live, terminal-style interactive run over a pseudo-terminal.

    Protocol (JSON messages):
      client -> {"type":"start","code":"..."}   begin compile + run
      client -> {"type":"stdin","data":"5\\n"}   feed a line to the program
      client -> {"type":"stop"}                  kill the program
      server -> {"type":"started"}               compiled, process spawned
      server -> {"type":"stdout","data":"..."}   streamed program output
      server -> {"type":"compile_error","data"}  syntax error / could not start
      server -> {"type":"exit","code":0}          process finished
      server -> {"type":"error","data":"..."}     runner failure

    Auth: pass a valid JWT as the ?token= query parameter (a WebSocket
    cannot send the Authorization header the axios client uses).
    """
    token = ws.query_params.get("token", "")
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        await ws.close(code=4401)
        return

    await ws.accept()
    loop = asyncio.get_running_loop()
    tmpdir = tempfile.mkdtemp(prefix="cf_run_")
    session = None
    queue: asyncio.Queue = asyncio.Queue()
    stop_flag = threading.Event()

    try:
        init = await ws.receive_json()
        if init.get("type") != "start":
            await ws.send_json({"type": "error", "data": "expected a start message"})
            return

        code = init.get("code", "")
        exe, compile_error = compile_code(code, tmpdir, force_unbuffered=True)
        if not exe:
            await ws.send_json({"type": "compile_error", "data": compile_error})
            await ws.send_json({"type": "exit", "code": None})
            return

        try:
            session, mode, note = make_session(exe)
        except Exception as e:  # noqa: BLE001
            await ws.send_json({"type": "error", "data": f"Could not start program: {e}"})
            return

        await ws.send_json({"type": "started", "mode": mode})
        if note:
            await ws.send_json({"type": "info", "data": note})

        produced = {"n": 0}
        MAX_STREAM = 256 * 1024  # cap live output so a runaway print can't flood the socket

        def reader():
            while not stop_flag.is_set():
                chunk = session.read()
                if chunk == "":
                    break
                produced["n"] += len(chunk)
                loop.call_soon_threadsafe(queue.put_nowait, ("out", chunk))
                if produced["n"] > MAX_STREAM:
                    loop.call_soon_threadsafe(queue.put_nowait, ("out", "\n[output limit reached — stopped]\n"))
                    try:
                        session.close()
                    except Exception:
                        pass
                    break
            rc = session.wait_returncode()
            loop.call_soon_threadsafe(queue.put_nowait, ("exit", rc))

        threading.Thread(target=reader, daemon=True).start()

        async def pump_out():
            while True:
                kind, data = await queue.get()
                if kind == "out":
                    await ws.send_json({"type": "stdout", "data": data})
                else:
                    await ws.send_json({"type": "exit", "code": data})
                    return

        async def pump_in():
            while True:
                msg = await ws.receive_json()
                kind = msg.get("type")
                if kind == "stdin":
                    session.write(msg.get("data", ""))
                elif kind == "stop":
                    session.close()
                    return

        out_task = asyncio.create_task(pump_out())
        in_task = asyncio.create_task(pump_in())
        _, pending = await asyncio.wait({out_task, in_task}, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()

    except WebSocketDisconnect:
        pass
    except Exception as e:  # noqa: BLE001
        try:
            await ws.send_json({"type": "error", "data": str(e)})
        except Exception:
            pass
    finally:
        stop_flag.set()
        if session:
            session.close()
        shutil.rmtree(tmpdir, ignore_errors=True)
        try:
            await ws.close()
        except Exception:
            pass


@router.post("", status_code=201)
def submit_code(
    payload: schemas.SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    problem = db.query(models.Problem).filter(models.Problem.id == payload.problem_id).first()
    if not problem:
        raise HTTPException(404, "Problem not found")

    test_cases = [
        {
            "id": tc.id,
            "input_data": tc.input_data,
            "expected_output": tc.expected_output,
            "is_hidden": tc.is_hidden,
        }
        for tc in problem.test_cases
    ]

    verdict = judge_submission(payload.code, test_cases)

    sub = models.Submission(
        problem_id=payload.problem_id,
        user_id=current_user.id,
        code=payload.code,
        language=payload.language,
        status=verdict["status"],
        score=verdict["score"],
        time_taken=payload.time_taken,
        execution_time=verdict.get("execution_time"),
        tab_switches=payload.tab_switches or 0,
        test_cases_passed=verdict["passed"],
        test_cases_total=verdict["total"],
    )
    db.add(sub)
    db.flush()

    for r in verdict.get("results", []):
        db.add(
            models.SubmissionResult(
                submission_id=sub.id,
                test_case_id=r.get("test_case_id"),
                status=r["status"],
                actual_output=r.get("actual_output", ""),
                execution_time=r.get("execution_time"),
            )
        )

    db.commit()
    db.refresh(sub)

    return {
        "id": sub.id,
        "status": sub.status,
        "score": sub.score,
        "passed": verdict["passed"],
        "total": verdict["total"],
        "execution_time": sub.execution_time,
        "error": verdict.get("error", ""),
        "results": [
            {
                "test_case_id": r.get("test_case_id"),
                "status": r["status"],
                "actual_output": r.get("actual_output"),
                "execution_time": r.get("execution_time"),
                "is_hidden": r.get("is_hidden", False),
            }
            for r in verdict.get("results", [])
        ],
    }


@router.get("")
def list_submissions(
    problem_id: int = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Submission)
    if current_user.role != "admin":
        query = query.filter(models.Submission.user_id == current_user.id)
    if problem_id:
        query = query.filter(models.Submission.problem_id == problem_id)
    return [
        {
            "id": s.id,
            "problem_id": s.problem_id,
            "problem_title": s.problem.title if s.problem else None,
            "status": s.status,
            "score": s.score,
            "time_taken": s.time_taken,
            "test_cases_passed": s.test_cases_passed,
            "test_cases_total": s.test_cases_total,
            "submitted_at": s.submitted_at.isoformat() + ("" if s.submitted_at.tzinfo else "Z"),
        }
        for s in query.order_by(models.Submission.submitted_at.desc()).all()
    ]


@router.get("/{sub_id}")
def get_submission(
    sub_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    s = db.query(models.Submission).filter(models.Submission.id == sub_id).first()
    if not s:
        raise HTTPException(404, "Submission not found")
    if current_user.role != "admin" and s.user_id != current_user.id:
        raise HTTPException(403, "Forbidden")

    results = [
        {
            "test_case_id": r.test_case_id,
            "status": r.status,
            "actual_output": r.actual_output,
            "execution_time": r.execution_time,
        }
        for r in s.results
    ]

    return {
        "id": s.id,
        "problem_id": s.problem_id,
        "problem_title": s.problem.title if s.problem else None,
        "mode": s.problem.mode.value if s.problem else None,
        "user_id": s.user_id,
        "username": s.user.username if s.user else None,
        "code": s.code,
        "status": s.status,
        "score": s.score,
        "time_taken": s.time_taken,
        "execution_time": s.execution_time,
        "tab_switches": s.tab_switches,
        "test_cases_passed": s.test_cases_passed,
        "test_cases_total": s.test_cases_total,
        "feedback": s.feedback,
        "submitted_at": s.submitted_at.isoformat() + ("" if s.submitted_at.tzinfo else "Z"),
        "results": results,
    }


class FeedbackRequest(BaseModel):
    feedback: str = ""


@router.post("/{sub_id}/feedback")
def save_feedback(sub_id: int, payload: FeedbackRequest, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    s = db.query(models.Submission).filter(models.Submission.id == sub_id).first()
    if not s:
        raise HTTPException(404, "Submission not found")
    s.feedback = payload.feedback
    db.commit()
    return {"ok": True, "feedback": s.feedback}


@router.post("/{sub_id}/feedback/suggest")
async def suggest_feedback(sub_id: int, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    s = db.query(models.Submission).filter(models.Submission.id == sub_id).first()
    if not s:
        raise HTTPException(404, "Submission not found")
    from ai_service import chat_completion
    prob = s.problem
    system = (
        "You are an experienced, encouraging Python programming instructor. Write brief (2–4 sentences) "
        "constructive feedback on a student's submission: note what they did well and what to improve. "
        "Be specific but do NOT give the full solution."
    )
    user = (
        f"Problem: {prob.title if prob else ''}\n{(prob.description or '') if prob else ''}\n\n"
        f"Verdict: {s.status} ({s.test_cases_passed}/{s.test_cases_total} test cases passed, score {s.score}%).\n\n"
        f"Student's code:\n```c\n{(s.code or '')[:4000]}\n```\n\nWrite short feedback addressed to the student."
    )
    try:
        text = await chat_completion(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=300, temperature=0.5,
        )
        return {"suggestion": text.strip()}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"AI suggestion unavailable: {e}")
