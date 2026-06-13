"""
Learn hub — interactive lessons + quick beginner skill-builders.

  • GET  /learn/lessons          list lessons (curriculum)
  • GET  /learn/lessons/{id}     full lesson (concept / example / check blocks)
  • GET  /learn/challenges       list predict-output / fix-the-bug challenges
  • POST /learn/challenges/{id}/check   grade an attempt
  • admin CRUD under /learn/admin/{lessons,challenges}
"""
import datetime
import json
import os
import random
import tempfile
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session

import code_runner
import models
from auth import get_admin_user, get_current_user
from database import get_db

router = APIRouter()


# ─────────────────────────── lessons ───────────────────────────────────────

class LessonIn(BaseModel):
    title: str
    topic: Optional[str] = "basics"
    order_index: int = 0
    blocks: List[Any] = []          # [{type:'concept'|'example'|'check', ...}]
    is_active: bool = True


def _lesson_summary(l: models.Lesson) -> dict:
    try:
        blocks = json.loads(l.content or "[]")
    except Exception:
        blocks = []
    return {
        "id": l.id, "title": l.title, "topic": l.topic, "order_index": l.order_index,
        "is_active": l.is_active, "blocks_count": len(blocks),
    }


def _lesson_full(l: models.Lesson) -> dict:
    try:
        blocks = json.loads(l.content or "[]")
    except Exception:
        blocks = []
    return {**_lesson_summary(l), "blocks": blocks}


@router.get("/lessons")
def list_lessons(db: Session = Depends(get_db), _user: models.User = Depends(get_current_user)):
    items = (db.query(models.Lesson).filter(models.Lesson.is_active == True)
             .order_by(models.Lesson.order_index.asc(), models.Lesson.id.asc()).all())
    return [_lesson_summary(l) for l in items]


@router.get("/lessons/{lid}")
def get_lesson(lid: int, db: Session = Depends(get_db), _user: models.User = Depends(get_current_user)):
    l = db.query(models.Lesson).filter(models.Lesson.id == lid).first()
    if not l or not l.is_active:
        raise HTTPException(404, "Lesson not found")
    return _lesson_full(l)


@router.get("/my-progress")
def my_lesson_progress(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Lesson ids the current student has completed (drives the progress UI)."""
    rows = db.query(models.LessonCompletion.lesson_id).filter(
        models.LessonCompletion.user_id == user.id).all()
    return {"completed": [r[0] for r in rows]}


@router.post("/lessons/{lid}/complete")
def complete_lesson(lid: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    l = db.query(models.Lesson).filter(models.Lesson.id == lid).first()
    if not l:
        raise HTTPException(404, "Lesson not found")
    exists = db.query(models.LessonCompletion).filter(
        models.LessonCompletion.lesson_id == lid,
        models.LessonCompletion.user_id == user.id).first()
    if not exists:
        db.add(models.LessonCompletion(lesson_id=lid, user_id=user.id))
        db.commit()
    return {"detail": "ok"}


@router.get("/admin/lessons")
def admin_list_lessons(db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    items = (db.query(models.Lesson)
             .order_by(models.Lesson.order_index.asc(), models.Lesson.id.asc()).all())
    total_students = db.query(models.User).filter(models.User.role == "student").count()
    counts = dict(
        db.query(models.LessonCompletion.lesson_id, func.count(models.LessonCompletion.id))
        .group_by(models.LessonCompletion.lesson_id).all()
    )
    return [{**_lesson_full(l), "completed": int(counts.get(l.id, 0)), "total_students": total_students}
            for l in items]


@router.get("/admin/lessons/{lid}/progress")
def admin_lesson_progress(lid: int, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    """Per-student completion for one lesson — who's done it and who hasn't."""
    l = db.query(models.Lesson).filter(models.Lesson.id == lid).first()
    if not l:
        raise HTTPException(404, "Lesson not found")
    done = {uid: ts for uid, ts in db.query(
        models.LessonCompletion.user_id, models.LessonCompletion.completed_at
    ).filter(models.LessonCompletion.lesson_id == lid).all()}
    students = (db.query(models.User).filter(models.User.role == "student")
                .order_by(models.User.full_name).all())
    rows = [{
        "id": s.id, "name": s.full_name or s.username, "email": s.email,
        "avatar_color": s.avatar_color,
        "done": s.id in done,
        "completed_at": done[s.id].isoformat() if s.id in done and done[s.id] else None,
    } for s in students]
    return {"lesson": {"id": l.id, "title": l.title}, "completed": sum(1 for r in rows if r["done"]),
            "total": len(rows), "students": rows}


class GenerateLessonIn(BaseModel):
    title: str
    topic: Optional[str] = "basics"


@router.post("/admin/lessons/generate")
async def admin_generate_lesson(payload: GenerateLessonIn, _admin=Depends(get_admin_user)):
    """Use AI to draft a detailed lesson (blocks) for a topic. Admin reviews & saves."""
    import re as _re
    from ai_service import chat_completion

    system = ("You are an expert Python programming curriculum author. "
              "Output ONLY a valid JSON array — no prose, no markdown code fences.")
    user = f"""Write a DETAILED, in-depth interactive lesson titled "{payload.title}" (topic: {payload.topic}) for the Python language, taking a complete beginner all the way to an advanced understanding.

Return a JSON array of "blocks". Allowed block shapes:
- {{"type":"concept","body":"<rich Markdown, 350-700 words: use ## headings, **bold**, `inline code`, ```python fenced code blocks```, bullet lists and tables. Cover definition, syntax, how it works under the hood, worked examples, common mistakes, best practices.>"}}
- {{"type":"example","title":"<short>","code":"<a COMPLETE runnable Python program>","stdin":"<optional input or empty>"}}
- {{"type":"check","mode":"mcq","question":"<q>","options":["a","b","c","d"],"answer":"<exact correct option text>","explanation":"<why>"}}
- {{"type":"check","mode":"output","question":"<q>","answer":"<exact expected stdout>","explanation":"<why>"}}
- {{"type":"reference","items":[{{"title":"<name>","url":"https://..."}}]}}

Rules:
- Produce 5-8 blocks total, ordered for learning (concepts first, an example, a check, end with one reference block of 2-3 real links e.g. docs.python.org, realpython.com, w3schools.com/python).
- Make the concept blocks genuinely long and detailed — this is the main content.
- All Python code and stdout must use proper JSON string escaping (\\n for newlines, \\" for quotes).
Output ONLY the JSON array, starting with [ and ending with ]."""

    raw = await chat_completion(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=6000, temperature=0.5,
    )
    txt = (raw or "").strip()
    txt = _re.sub(r"^```(?:json)?", "", txt).strip()
    txt = _re.sub(r"```$", "", txt).strip()
    s, e = txt.find("["), txt.rfind("]")
    if s == -1 or e == -1 or e <= s:
        raise HTTPException(502, "AI did not return JSON — try again.")
    try:
        blocks = json.loads(txt[s:e + 1])
    except Exception as ex:  # noqa: BLE001
        raise HTTPException(502, f"Could not parse AI output: {ex}")
    if not isinstance(blocks, list) or not blocks:
        raise HTTPException(502, "AI output was not a list of blocks.")
    return {"blocks": blocks}


@router.post("/admin/lessons", status_code=201)
def admin_create_lesson(payload: LessonIn, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    l = models.Lesson(title=payload.title, topic=payload.topic, order_index=payload.order_index,
                      content=json.dumps(payload.blocks), is_active=payload.is_active)
    db.add(l)
    db.commit()
    db.refresh(l)
    return _lesson_full(l)


@router.put("/admin/lessons/{lid}")
def admin_update_lesson(lid: int, payload: LessonIn, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    l = db.query(models.Lesson).filter(models.Lesson.id == lid).first()
    if not l:
        raise HTTPException(404, "Lesson not found")
    l.title = payload.title
    l.topic = payload.topic
    l.order_index = payload.order_index
    l.content = json.dumps(payload.blocks)
    l.is_active = payload.is_active
    db.commit()
    db.refresh(l)
    return _lesson_full(l)


@router.delete("/admin/lessons/{lid}")
def admin_delete_lesson(lid: int, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    l = db.query(models.Lesson).filter(models.Lesson.id == lid).first()
    if not l:
        raise HTTPException(404, "Lesson not found")
    db.delete(l)
    db.commit()
    return {"detail": "Deleted"}


# ─────────────────────────── challenges ────────────────────────────────────

class ChallengeIn(BaseModel):
    kind: str                      # predict | fixbug
    title: str
    topic: Optional[str] = "basics"
    difficulty: str = "easy"
    snippet: str
    test_input: Optional[str] = ""
    expected_output: Optional[str] = ""
    explanation: Optional[str] = ""
    is_active: bool = True


class AttemptIn(BaseModel):
    answer: Optional[str] = None   # predict: typed output
    code: Optional[str] = None     # fixbug: edited code


def _challenge_public(c: models.Challenge) -> dict:
    """Student-facing view — never leaks the expected output / explanation."""
    return {
        "id": c.id, "kind": c.kind, "title": c.title, "topic": c.topic,
        "difficulty": c.difficulty, "snippet": c.snippet,
        "test_input": c.test_input or "",
    }


def _challenge_full(c: models.Challenge) -> dict:
    return {**_challenge_public(c),
            "expected_output": c.expected_output or "",
            "explanation": c.explanation or "", "is_active": c.is_active,
            "created_at": c.created_at.isoformat()}


@router.get("/challenges")
def list_challenges(kind: Optional[str] = None, db: Session = Depends(get_db),
                    _user: models.User = Depends(get_current_user)):
    q = db.query(models.Challenge).filter(models.Challenge.is_active == True)
    if kind:
        q = q.filter(models.Challenge.kind == kind)
    items = q.order_by(models.Challenge.id.asc()).all()
    return [_challenge_public(c) for c in items]


@router.post("/challenges/{cid}/check")
def check_challenge(cid: int, attempt: AttemptIn, db: Session = Depends(get_db),
                    _user: models.User = Depends(get_current_user)):
    c = db.query(models.Challenge).filter(models.Challenge.id == cid).first()
    if not c:
        raise HTTPException(404, "Challenge not found")

    expected = code_runner._normalize(c.expected_output or "")

    if c.kind == "predict":
        guess = code_runner._normalize(attempt.answer or "")
        correct = guess == expected
        return {"correct": correct, "expected_output": c.expected_output or "",
                "explanation": c.explanation or ""}

    # fixbug: compile + run the student's edited code against test_input
    code = attempt.code or ""
    with tempfile.TemporaryDirectory() as tmp:
        exe, cerr = code_runner.compile_code(code, tmp)
        if not exe:
            return {"correct": False, "status": "Compilation Error",
                    "output": "", "error": cerr, "expected_output": c.expected_output or "",
                    "explanation": ""}
        run = code_runner.run_once(exe, c.test_input or "", time_limit=5.0)
    actual = run["output"] if run["status"] == "ok" else ""
    correct = run["status"] == "ok" and actual == expected
    return {
        "correct": correct,
        "status": run["status"],
        "output": run["output"],
        "error": "" if run["status"] == "ok" else run["output"],
        "expected_output": c.expected_output or "",
        "explanation": c.explanation or "" if correct else "",
    }


# ─────────────────────────── admin CRUD ────────────────────────────────────

@router.get("/admin/challenges")
def admin_list_challenges(db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    items = db.query(models.Challenge).order_by(models.Challenge.id.desc()).all()
    return [_challenge_full(c) for c in items]


@router.post("/admin/challenges", status_code=201)
def admin_create_challenge(payload: ChallengeIn, db: Session = Depends(get_db),
                           _admin=Depends(get_admin_user)):
    if payload.kind not in ("predict", "fixbug"):
        raise HTTPException(400, "kind must be 'predict' or 'fixbug'")
    c = models.Challenge(**payload.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return _challenge_full(c)


@router.put("/admin/challenges/{cid}")
def admin_update_challenge(cid: int, payload: ChallengeIn, db: Session = Depends(get_db),
                           _admin=Depends(get_admin_user)):
    c = db.query(models.Challenge).filter(models.Challenge.id == cid).first()
    if not c:
        raise HTTPException(404, "Challenge not found")
    for k, v in payload.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return _challenge_full(c)


@router.delete("/admin/challenges/{cid}")
def admin_delete_challenge(cid: int, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    c = db.query(models.Challenge).filter(models.Challenge.id == cid).first()
    if not c:
        raise HTTPException(404, "Challenge not found")
    db.delete(c)
    db.commit()
    return {"detail": "Deleted"}


# ─────────────────── AI-generated & scheduled challenges ────────────────────

_CHALLENGE_TOPICS = ["basics", "conditionals", "loops", "functions", "lists", "strings", "dictionaries"]


def _meta_get(db, key, default=None):
    db.execute(text("CREATE TABLE IF NOT EXISTS app_meta (k VARCHAR(64) PRIMARY KEY, v VARCHAR(255))"))
    row = db.execute(text("SELECT v FROM app_meta WHERE k=:k"), {"k": key}).fetchone()
    return row[0] if row else default


def _meta_set(db, key, value):
    db.execute(text("CREATE TABLE IF NOT EXISTS app_meta (k VARCHAR(64) PRIMARY KEY, v VARCHAR(255))"))
    db.execute(text("DELETE FROM app_meta WHERE k=:k"), {"k": key})
    db.execute(text("INSERT INTO app_meta (k, v) VALUES (:k, :v)"), {"k": key, "v": str(value)})


_IST = datetime.timedelta(hours=5, minutes=30)   # India Standard Time = UTC + 5:30


def schedule_due(freq, hour, dow, last_iso):
    """Should an auto-schedule fire right now? Time is interpreted in IST.
    `freq`: daily|weekly · `hour`: 0-23 (IST) · `dow`: 0=Mon..6=Sun (weekly)."""
    if freq not in ("daily", "weekly"):
        return False
    now_ist = datetime.datetime.utcnow() + _IST
    if now_ist.hour < hour:
        return False                         # before today's scheduled time
    last_ist = None
    if last_iso:
        try:
            last_ist = datetime.datetime.fromisoformat(last_iso) + _IST
        except Exception:
            last_ist = None
    if freq == "daily":
        return not (last_ist and last_ist.date() == now_ist.date())
    # weekly
    if now_ist.weekday() != dow:
        return False
    return not (last_ist and (now_ist.date() - last_ist.date()).days < 6)


async def _ai_make_challenges(db) -> List[dict]:
    """Ask AI for one predict + one fix-the-bug exercise, VERIFY each by compiling
    & running it (so expected outputs are always correct), then save them."""
    from ai_service import chat_completion

    topic = random.choice(_CHALLENGE_TOPICS)
    system = "You are a Python exercise author. Output ONLY one valid JSON object — no prose, no code fences."
    # Ask for code as an ARRAY OF LINES — this avoids newline-escaping bugs entirely.
    user = (
        f'Create TWO short beginner Python exercises on the topic "{topic}" as a JSON object. '
        'Give every Python program as an ARRAY of source lines (one string per line, no trailing newlines):\n'
        '{\n'
        '  "predict": {"title":"...","difficulty":"easy","snippet_lines":["x = 7","print(x // 2)","print(x % 2)"],"explanation":"<why that output>"},\n'
        '  "fixbug":  {"title":"...","difficulty":"easy","buggy_lines":[...one clear bug...],"fixed_lines":[...corrected program...],"test_input":"<stdin or empty>","explanation":"<the bug and the fix>"}\n'
        '}\n'
        'The predict program must take NO input and print a few lines. Keep both programs tiny and beginner-level. '
        'Each array entry is one ordinary line of Python source code written normally (e.g. print(i)). '
        'Output ONLY the JSON object.'
    )
    raw = await chat_completion(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=2000, temperature=0.6,
    )
    txt = (raw or "").strip()
    s, e = txt.find("{"), txt.rfind("}")
    if s == -1 or e == -1:
        return []
    try:
        obj = json.loads(txt[s:e + 1])
    except Exception:
        return []

    def _code(d, key):
        """Accept either <key>_lines (array, preferred) or <key> (string)."""
        lines = d.get(key + "_lines")
        if isinstance(lines, list):
            return "\n".join(str(x) for x in lines) + "\n"
        v = d.get(key)
        return v if isinstance(v, str) else None

    created = []

    # Predict: run the snippet to get the REAL output (don't trust the AI's).
    p = obj.get("predict") or {}
    p_snippet = _code(p, "snippet")
    if p_snippet:
        with tempfile.TemporaryDirectory() as tmp:
            exe, _ = code_runner.compile_code(p_snippet, tmp)
            if exe:
                run = code_runner.run_once(exe, "", 5.0)
                if run["status"] == "ok" and run["output"].strip():
                    c = models.Challenge(
                        kind="predict", title=p.get("title", "Predict the output")[:200],
                        topic=topic, difficulty=p.get("difficulty", "easy"),
                        snippet=p_snippet, test_input="",
                        expected_output=run["output"], explanation=p.get("explanation", ""),
                        is_active=True)
                    db.add(c); db.flush(); created.append(_challenge_full(c))

    # Fix-the-bug: run the FIXED program to get the correct expected output.
    f = obj.get("fixbug") or {}
    f_buggy, f_fixed = _code(f, "buggy"), _code(f, "fixed")
    if f_buggy and f_fixed:
        with tempfile.TemporaryDirectory() as tmp:
            exe, _ = code_runner.compile_code(f_fixed, tmp)
            if exe:
                run = code_runner.run_once(exe, f.get("test_input", "") or "", 5.0)
                if run["status"] == "ok":
                    c = models.Challenge(
                        kind="fixbug", title=f.get("title", "Fix the bug")[:200],
                        topic=topic, difficulty=f.get("difficulty", "easy"),
                        snippet=f_buggy, test_input=f.get("test_input", "") or "",
                        expected_output=run["output"], explanation=f.get("explanation", ""),
                        is_active=True)
                    db.add(c); db.flush(); created.append(_challenge_full(c))

    db.commit()
    return created


@router.post("/admin/challenges/generate")
async def admin_generate_challenges(db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    """One click → AI creates & verifies 1 Predict + 1 Fix-the-Bug challenge."""
    try:
        created = await _ai_make_challenges(db)
    except Exception as ex:  # noqa: BLE001
        raise HTTPException(502, f"Generation failed: {ex}")
    if not created:
        raise HTTPException(502, "AI didn't produce valid challenges — please try again.")
    return {"created": created, "count": len(created)}


class ScheduleIn(BaseModel):
    frequency: str        # off | daily | weekly
    hour: int = 9         # IST hour 0-23 (time of day to generate)
    dow: int = 0          # 0=Mon..6=Sun (weekly only)


@router.get("/admin/challenges/schedule")
def get_challenge_schedule(db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    return {"frequency": _meta_get(db, "challenge_schedule", "off"),
            "hour": int(_meta_get(db, "challenge_hour", "9") or 9),
            "dow": int(_meta_get(db, "challenge_dow", "0") or 0),
            "last_run": _meta_get(db, "challenge_last_auto"),
            "last_result": _meta_get(db, "challenge_last_result")}


@router.post("/admin/challenges/schedule")
def set_challenge_schedule(payload: ScheduleIn, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    if payload.frequency not in ("off", "daily", "weekly"):
        raise HTTPException(400, "frequency must be off, daily or weekly")
    _meta_set(db, "challenge_schedule", payload.frequency)
    _meta_set(db, "challenge_hour", max(0, min(23, payload.hour)))
    _meta_set(db, "challenge_dow", max(0, min(6, payload.dow)))
    db.commit()
    return {"frequency": payload.frequency, "hour": payload.hour, "dow": payload.dow}


@router.post("/cron/auto-challenges")
async def cron_auto_challenges(key: str = "", db: Session = Depends(get_db)):
    """Called by an external scheduler (GitHub Actions/cron-job.org), ideally hourly.
    Generates a challenge set IF the schedule is due (at the chosen IST time)."""
    expected = os.getenv("CRON_KEY", "")
    if not expected or key != expected:
        raise HTTPException(403, "Invalid cron key")

    freq = _meta_get(db, "challenge_schedule", "off")
    hour = int(_meta_get(db, "challenge_hour", "9") or 9)
    dow = int(_meta_get(db, "challenge_dow", "0") or 0)
    if not schedule_due(freq, hour, dow, _meta_get(db, "challenge_last_auto")):
        return {"detail": "not due", "frequency": freq}

    now = datetime.datetime.utcnow()
    try:
        created = await _ai_make_challenges(db)
    except Exception as ex:  # noqa: BLE001 — don't 500 the cron; report and retry next run
        _meta_set(db, "challenge_last_result", f"failed — {str(ex)[:80]}")
        db.commit()
        return {"detail": "generation failed (will retry next run)", "error": str(ex)[:200]}
    if created:                       # only advance last_run on success, so failures retry
        _meta_set(db, "challenge_last_auto", now.isoformat())
        _meta_set(db, "challenge_last_result", f"added {len(created)} challenge(s)")
    else:
        _meta_set(db, "challenge_last_result", "no challenges produced — will retry")
    db.commit()
    return {"detail": "generated" if created else "no challenges produced (will retry)",
            "count": len(created or [])}
