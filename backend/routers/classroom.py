"""Classes, assignments, and analytics — shared by admins and students."""
import datetime
import json
import os
import random
import secrets
import tempfile
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session

import code_runner
import models
from auth import get_admin_user, get_current_user
from database import get_db

router = APIRouter()


# ──────────────────────────── helpers ──────────────────────────────────────

def _iso(dt):
    if not dt:
        return None
    return dt.isoformat() + ("" if dt.tzinfo else "Z")


def _solved_problem_ids(db: Session, user_id: int) -> set:
    rows = (
        db.query(models.Submission.problem_id)
        .filter(models.Submission.user_id == user_id, models.Submission.status == "Accepted")
        .distinct()
        .all()
    )
    return {r[0] for r in rows}


def _class_dict(c: models.Class) -> dict:
    member_ids = [m.user_id for m in c.members]
    return {
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "invite_code": c.invite_code,
        "member_ids": member_ids,
        "member_count": len(member_ids),
        "assignment_count": len(c.assignments),
        "created_at": _iso(c.created_at),
    }


def _gen_code(db) -> str:
    for _ in range(10):
        code = secrets.token_hex(3).upper()  # 6 hex chars, e.g. 'A1B2C3'
        if not db.query(models.Class).filter(models.Class.invite_code == code).first():
            return code
    return secrets.token_hex(4).upper()


def _assignment_admin_dict(db: Session, a: models.Assignment) -> dict:
    problem_ids = [ap.problem_id for ap in a.problems]
    member_ids = [m.user_id for m in a.klass.members] if a.klass else []
    total = len(problem_ids) * len(member_ids)
    done = 0
    if problem_ids and member_ids:
        rows = (
            db.query(models.Submission.user_id, models.Submission.problem_id)
            .filter(
                models.Submission.status == "Accepted",
                models.Submission.user_id.in_(member_ids),
                models.Submission.problem_id.in_(problem_ids),
            )
            .distinct()
            .all()
        )
        done = len({(u, p) for u, p in rows})
    return {
        "id": a.id,
        "title": a.title,
        "instructions": a.instructions,
        "class_id": a.class_id,
        "class_name": a.klass.name if a.klass else None,
        "due_date": _iso(a.due_date),
        "problem_ids": problem_ids,
        "problem_count": len(problem_ids),
        "member_count": len(member_ids),
        "completion_pct": round(done / total * 100, 1) if total else 0.0,
        "created_at": _iso(a.created_at),
    }


# ──────────────────────────── request bodies ───────────────────────────────

class ClassCreate(BaseModel):
    name: str
    description: Optional[str] = None
    member_ids: List[int] = []


class MembersUpdate(BaseModel):
    member_ids: List[int] = []


class AssignmentCreate(BaseModel):
    title: str
    instructions: Optional[str] = None
    class_id: int
    due_date: Optional[datetime.datetime] = None
    problem_ids: List[int] = []


class JoinRequest(BaseModel):
    code: str


@router.post("/join")
def join_class(payload: JoinRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Student self-enrolls into a class via its invite code."""
    code = (payload.code or "").strip().upper()
    if not code:
        raise HTTPException(400, "Enter an invite code")
    c = db.query(models.Class).filter(models.Class.invite_code == code).first()
    if not c:
        raise HTTPException(404, "Invalid invite code")
    existing = db.query(models.ClassMember).filter_by(class_id=c.id, user_id=user.id).first()
    if existing:
        return {"joined": False, "class_name": c.name, "message": "You're already in this class"}
    db.add(models.ClassMember(class_id=c.id, user_id=user.id))
    db.commit()
    return {"joined": True, "class_name": c.name}


@router.post("/classes/{class_id}/regenerate-code")
def regenerate_code(class_id: int, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    c = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not c:
        raise HTTPException(404, "Class not found")
    c.invite_code = _gen_code(db)
    db.commit()
    db.refresh(c)
    return _class_dict(c)


# ──────────────────────────── pickers (admin) ──────────────────────────────

@router.get("/students")
def list_students(db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    users = (
        db.query(models.User)
        .filter(models.User.role == models.UserRole.student)
        .order_by(models.User.full_name)
        .all()
    )
    return [
        {
            "id": u.id,
            "full_name": u.full_name or u.username,
            "username": u.username,
            "email": u.email,
            "avatar_color": u.avatar_color,
        }
        for u in users
    ]


@router.get("/problems")
def list_all_problems(db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    rows = db.query(models.Problem).order_by(models.Problem.created_at.desc()).all()
    return [
        {"id": p.id, "title": p.title, "mode": p.mode.value, "difficulty": p.difficulty}
        for p in rows
    ]


# ──────────────────────────── classes (admin) ──────────────────────────────

@router.post("/classes", status_code=201)
def create_class(payload: ClassCreate, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    c = models.Class(name=payload.name, description=payload.description, created_by=admin.id, invite_code=_gen_code(db))
    db.add(c)
    db.flush()
    for uid in set(payload.member_ids):
        db.add(models.ClassMember(class_id=c.id, user_id=uid))
    db.commit()
    db.refresh(c)
    return _class_dict(c)


@router.get("/classes")
def list_classes(db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    rows = db.query(models.Class).order_by(models.Class.created_at.desc()).all()
    return [_class_dict(c) for c in rows]


@router.put("/classes/{class_id}/members")
def set_members(class_id: int, payload: MembersUpdate, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    c = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not c:
        raise HTTPException(404, "Class not found")
    db.query(models.ClassMember).filter(models.ClassMember.class_id == class_id).delete()
    for uid in set(payload.member_ids):
        db.add(models.ClassMember(class_id=class_id, user_id=uid))
    db.commit()
    db.refresh(c)
    return _class_dict(c)


@router.delete("/classes/{class_id}", status_code=204)
def delete_class(class_id: int, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    c = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not c:
        raise HTTPException(404, "Class not found")
    db.delete(c)
    db.commit()


@router.post("/seed-demo")
def seed_demo(db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    """One-click: create a sample class (all students) + 2 assignments. No-op if classes exist."""
    if db.query(models.Class).count() > 0:
        return {"created": False, "message": "Classes already exist"}
    students = db.query(models.User).filter(models.User.role == models.UserRole.student).all()
    klass = models.Class(name="Python Programming 101", description="Intro cohort", created_by=admin.id, invite_code=_gen_code(db))
    db.add(klass)
    db.flush()
    for s in students:
        db.add(models.ClassMember(class_id=klass.id, user_id=s.id))

    practice = (
        db.query(models.Problem)
        .filter(models.Problem.mode == models.ProblemMode.practice)
        .order_by(models.Problem.id)
        .all()
    )
    now = datetime.datetime.utcnow()
    made = 0
    if practice:
        a1 = models.Assignment(
            title="Week 1 — Basics", instructions="Warm up with output and arithmetic.",
            class_id=klass.id, due_date=now + datetime.timedelta(days=7), created_by=admin.id,
        )
        db.add(a1)
        db.flush()
        for p in practice[:2]:
            db.add(models.AssignmentProblem(assignment_id=a1.id, problem_id=p.id))
        made += 1
        if len(practice) > 2:
            a2 = models.Assignment(
                title="Week 2 — Loops & Strings", instructions="Factorial and string reversal.",
                class_id=klass.id, due_date=now + datetime.timedelta(days=14), created_by=admin.id,
            )
            db.add(a2)
            db.flush()
            for p in practice[2:4]:
                db.add(models.AssignmentProblem(assignment_id=a2.id, problem_id=p.id))
            made += 1
    db.commit()
    return {"created": True, "assignments": made, "students": len(students)}


# ──────────────────────────── assignments (admin) ──────────────────────────

@router.post("/assignments", status_code=201)
def create_assignment(payload: AssignmentCreate, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    if not db.query(models.Class).filter(models.Class.id == payload.class_id).first():
        raise HTTPException(404, "Class not found")
    a = models.Assignment(
        title=payload.title,
        instructions=payload.instructions,
        class_id=payload.class_id,
        due_date=payload.due_date,
        created_by=admin.id,
    )
    db.add(a)
    db.flush()
    for pid in payload.problem_ids:
        db.add(models.AssignmentProblem(assignment_id=a.id, problem_id=pid))
    db.commit()
    db.refresh(a)
    return _assignment_admin_dict(db, a)


@router.get("/assignments")
def list_assignments(db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    rows = db.query(models.Assignment).order_by(models.Assignment.created_at.desc()).all()
    return [_assignment_admin_dict(db, a) for a in rows]


@router.delete("/assignments/{assignment_id}", status_code=204)
def delete_assignment(assignment_id: int, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    a = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(404, "Assignment not found")
    db.delete(a)
    db.commit()


@router.get("/assignments/{assignment_id}/progress")
def assignment_progress(assignment_id: int, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    """Per-student completion for one assignment — who has solved which problems."""
    a = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(404, "Assignment not found")

    problem_ids, problems = [], []
    for ap in a.problems:
        p = ap.problem
        if p:
            problem_ids.append(p.id)
            problems.append({"id": p.id, "title": p.title, "difficulty": p.difficulty})
    member_ids = [m.user_id for m in a.klass.members] if a.klass else []

    solved_map, last_map = {}, {}
    if problem_ids and member_ids:
        rows = (
            db.query(
                models.Submission.user_id, models.Submission.problem_id,
                models.Submission.submitted_at, models.Submission.status,
            )
            .filter(models.Submission.user_id.in_(member_ids), models.Submission.problem_id.in_(problem_ids))
            .all()
        )
        for uid, pid, ts, status in rows:
            if ts and (uid not in last_map or ts > last_map[uid]):
                last_map[uid] = ts
            if status == "Accepted":
                solved_map.setdefault(uid, set()).add(pid)

    members = db.query(models.User).filter(models.User.id.in_(member_ids)).all() if member_ids else []
    students = []
    for u in members:
        solved = solved_map.get(u.id, set())
        students.append({
            "id": u.id,
            "name": u.full_name or u.username,
            "email": u.email,
            "avatar_color": u.avatar_color,
            "solved": [pid for pid in problem_ids if pid in solved],
            "solved_count": len(solved),
            "total": len(problem_ids),
            "last_activity": _iso(last_map.get(u.id)),
        })
    students.sort(key=lambda s: (s["solved_count"], s["name"].lower()))  # least-done first

    return {
        "assignment": {
            "id": a.id, "title": a.title,
            "class_name": a.klass.name if a.klass else None,
            "problems": problems, "member_count": len(member_ids),
        },
        "students": students,
    }


# ─────────────────── AI-generated & scheduled assignments ──────────────────

_ASSIGN_TOPICS = ["basics", "conditionals", "loops", "functions", "lists", "strings", "dictionaries"]


def _ameta_get(db, key, default=None):
    db.execute(text("CREATE TABLE IF NOT EXISTS app_meta (k VARCHAR(64) PRIMARY KEY, v VARCHAR(255))"))
    row = db.execute(text("SELECT v FROM app_meta WHERE k=:k"), {"k": key}).fetchone()
    return row[0] if row else default


def _ameta_set(db, key, value):
    db.execute(text("CREATE TABLE IF NOT EXISTS app_meta (k VARCHAR(64) PRIMARY KEY, v VARCHAR(255))"))
    db.execute(text("DELETE FROM app_meta WHERE k=:k"), {"k": key})
    db.execute(text("INSERT INTO app_meta (k, v) VALUES (:k, :v)"), {"k": key, "v": str(value)})


async def _ai_make_assignment(db, class_id, creator_id):
    """AI drafts a coding problem; we VERIFY it by compiling its reference solution
    and running every test input to compute the real expected outputs, then create
    the problem + an assignment in the class. Returns the Assignment or None."""
    from ai_service import chat_completion

    klass = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not klass:
        return None

    topic = random.choice(_ASSIGN_TOPICS)
    system = "You are a Python programming problem setter. Output ONLY one valid JSON object — no prose, no code fences."
    user = (
        f'Create ONE beginner Python coding problem on the topic "{topic}" as a JSON object. '
        'Give code/inputs as ARRAYS OF LINES (one string per line):\n'
        '{\n'
        '  "title": "...",\n'
        '  "difficulty": "easy",\n'
        '  "description": "<markdown problem statement: what to read from stdin, what to print, with one worked example>",\n'
        '  "solution_lines": ["n = int(input())","print(n * n)"],\n'
        '  "tests": [ {"input_lines": ["5"]}, {"input_lines": ["10"]}, {"input_lines": ["1"]} ]\n'
        '}\n'
        'The reference solution must read from stdin and print the answer. Provide 3-5 varied tests. '
        'Each array entry is one ordinary line of Python source written normally (e.g. print(x)). '
        'Output ONLY the JSON object.'
    )
    raw = await chat_completion(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=2500, temperature=0.6,
    )
    txt = (raw or "").strip()
    s, e = txt.find("{"), txt.rfind("}")
    if s == -1 or e == -1:
        return None
    try:
        obj = json.loads(txt[s:e + 1])
    except Exception:
        return None

    lines = obj.get("solution_lines")
    solution = ("\n".join(map(str, lines)) + "\n") if isinstance(lines, list) else obj.get("solution")
    desc = obj.get("description")
    if not solution or not desc:
        return None

    # Verify: compile the reference solution, then run each test input for real output.
    verified = []
    with tempfile.TemporaryDirectory() as tmp:
        exe, _ = code_runner.compile_code(solution, tmp)
        if not exe:
            return None
        for t in (obj.get("tests") or [])[:6]:
            il = t.get("input_lines")
            inp = ("\n".join(map(str, il)) + "\n") if isinstance(il, list) else (t.get("input", "") or "")
            run = code_runner.run_once(exe, inp, 5.0)
            if run["status"] == "ok":
                verified.append((inp, run["output"]))
    if not verified:
        return None

    now = datetime.datetime.utcnow()
    problem = models.Problem(
        title=obj.get("title", "Practice problem")[:200], description=desc, topics=topic,
        mode=models.ProblemMode.practice, difficulty=obj.get("difficulty", "easy"),
        is_for_all=False, created_by=creator_id, is_active=True,
    )
    db.add(problem)
    db.flush()
    for i, (inp, out) in enumerate(verified):
        db.add(models.TestCase(problem_id=problem.id, input_data=inp, expected_output=out,
                               is_hidden=(i >= 2), order_index=i))
    # scope to the class's members so it shows for them
    for m in klass.members:
        db.add(models.ProblemAssignment(problem_id=problem.id, user_id=m.user_id))

    assignment = models.Assignment(
        title=obj.get("title", "Practice problem")[:200],
        instructions="Auto-generated practice problem. Solve it before the due date.",
        class_id=class_id, due_date=now + datetime.timedelta(days=7), created_by=creator_id,
    )
    db.add(assignment)
    db.flush()
    db.add(models.AssignmentProblem(assignment_id=assignment.id, problem_id=problem.id))
    db.commit()
    db.refresh(assignment)
    return assignment


class GenAssignmentIn(BaseModel):
    class_id: int


@router.post("/assignments/generate")
async def generate_assignment(payload: GenAssignmentIn, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    """One click → AI creates & verifies a coding problem and posts it as an assignment."""
    try:
        a = await _ai_make_assignment(db, payload.class_id, admin.id)
    except Exception as ex:  # noqa: BLE001
        raise HTTPException(502, f"Generation failed: {ex}")
    if not a:
        raise HTTPException(502, "AI didn't produce a valid problem — please try again.")
    return _assignment_admin_dict(db, a)


class AssignScheduleIn(BaseModel):
    frequency: str                       # off | daily | weekly
    class_id: Optional[int] = None
    hour: int = 9                        # IST hour 0-23
    dow: int = 0                         # 0=Mon..6=Sun (weekly only)


@router.get("/assignments/schedule")
def get_assignment_schedule(db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    cid = _ameta_get(db, "assignment_class_id")
    return {"frequency": _ameta_get(db, "assignment_schedule", "off"),
            "class_id": int(cid) if cid else None,
            "hour": int(_ameta_get(db, "assignment_hour", "9") or 9),
            "dow": int(_ameta_get(db, "assignment_dow", "0") or 0),
            "last_run": _ameta_get(db, "assignment_last_auto"),
            "last_result": _ameta_get(db, "assignment_last_result")}


@router.post("/assignments/schedule")
def set_assignment_schedule(payload: AssignScheduleIn, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    if payload.frequency not in ("off", "daily", "weekly"):
        raise HTTPException(400, "frequency must be off, daily or weekly")
    if payload.frequency != "off" and not payload.class_id:
        raise HTTPException(400, "Choose a class for the schedule")
    _ameta_set(db, "assignment_schedule", payload.frequency)
    _ameta_set(db, "assignment_hour", max(0, min(23, payload.hour)))
    _ameta_set(db, "assignment_dow", max(0, min(6, payload.dow)))
    if payload.class_id:
        _ameta_set(db, "assignment_class_id", payload.class_id)
    db.commit()
    return {"frequency": payload.frequency, "class_id": payload.class_id,
            "hour": payload.hour, "dow": payload.dow}


@router.post("/cron/auto-assignment")
async def cron_auto_assignment(key: str = "", db: Session = Depends(get_db)):
    """External scheduler hook (ideally hourly). Generates an assignment if the schedule
    is due (at the chosen IST time). CRON_KEY-protected."""
    from routers.learn import schedule_due
    expected = os.getenv("CRON_KEY", "")
    if not expected or key != expected:
        raise HTTPException(403, "Invalid cron key")
    freq = _ameta_get(db, "assignment_schedule", "off")
    cid = _ameta_get(db, "assignment_class_id")
    if freq == "off" or not cid:
        return {"detail": "schedule off"}
    hour = int(_ameta_get(db, "assignment_hour", "9") or 9)
    dow = int(_ameta_get(db, "assignment_dow", "0") or 0)
    if not schedule_due(freq, hour, dow, _ameta_get(db, "assignment_last_auto")):
        return {"detail": "not due", "frequency": freq}

    now = datetime.datetime.utcnow()
    klass = db.query(models.Class).filter(models.Class.id == int(cid)).first()
    creator = klass.created_by if klass else None
    if not creator:
        admin = db.query(models.User).filter(models.User.role == models.UserRole.admin).first()
        creator = admin.id if admin else None
    try:
        a = await _ai_make_assignment(db, int(cid), creator)
    except Exception as ex:  # noqa: BLE001 — graceful, retry next run
        _ameta_set(db, "assignment_last_result", f"failed — {str(ex)[:80]}")
        db.commit()
        return {"detail": "generation failed (will retry next run)", "error": str(ex)[:200]}
    if a:                             # only advance last_run on success
        _ameta_set(db, "assignment_last_auto", now.isoformat())
        _ameta_set(db, "assignment_last_result", f"added \"{a.title}\"")
    else:
        _ameta_set(db, "assignment_last_result", "no problem produced — will retry")
    db.commit()
    return {"detail": "generated" if a else "no problem produced (will retry)",
            "assignment_id": a.id if a else None}


# ──────────────────────────── student view ─────────────────────────────────

@router.get("/my-assignments")
def my_assignments(db: Session = Depends(get_db), user=Depends(get_current_user)):
    class_ids = [
        m.class_id for m in db.query(models.ClassMember).filter(models.ClassMember.user_id == user.id).all()
    ]
    if not class_ids:
        return []
    solved = _solved_problem_ids(db, user.id)
    out = []
    rows = (
        db.query(models.Assignment)
        .filter(models.Assignment.class_id.in_(class_ids))
        .order_by(models.Assignment.due_date.is_(None), models.Assignment.due_date.asc())
        .all()
    )
    for a in rows:
        problems = []
        for ap in a.problems:
            p = ap.problem
            if not p:
                continue
            problems.append({
                "id": p.id,
                "title": p.title,
                "difficulty": p.difficulty,
                "mode": p.mode.value,
                "solved": p.id in solved,
            })
        solved_count = sum(1 for pr in problems if pr["solved"])
        out.append({
            "id": a.id,
            "title": a.title,
            "instructions": a.instructions,
            "class_name": a.klass.name if a.klass else None,
            "due_date": _iso(a.due_date),
            "problems": problems,
            "total": len(problems),
            "solved": solved_count,
        })
    return out


# ──────────────────────────── analytics ────────────────────────────────────

@router.get("/analytics/admin")
def analytics_admin(db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    total_students = db.query(models.User).filter(models.User.role == models.UserRole.student).count()
    total_subs = db.query(models.Submission).count()
    accepted = db.query(models.Submission).filter(models.Submission.status == "Accepted").count()

    per_problem = []
    for p in db.query(models.Problem).all():
        attempts = db.query(models.Submission).filter(models.Submission.problem_id == p.id).count()
        acc = db.query(models.Submission).filter(
            models.Submission.problem_id == p.id, models.Submission.status == "Accepted"
        ).count()
        avg = db.query(func.avg(models.Submission.score)).filter(
            models.Submission.problem_id == p.id
        ).scalar() or 0
        per_problem.append({
            "id": p.id,
            "title": p.title,
            "mode": p.mode.value,
            "attempts": attempts,
            "accepted": acc,
            "acceptance": round(acc / attempts * 100, 1) if attempts else 0.0,
            "avg_score": round(float(avg), 1),
        })
    per_problem.sort(key=lambda x: x["attempts"], reverse=True)

    return {
        "stats": {
            "students": total_students,
            "submissions": total_subs,
            "accepted": accepted,
            "acceptance": round(accepted / total_subs * 100, 1) if total_subs else 0.0,
            "problems": db.query(models.Problem).count(),
            "classes": db.query(models.Class).count(),
        },
        "per_problem": per_problem[:50],
    }


@router.get("/analytics/student")
def analytics_student(db: Session = Depends(get_db), user=Depends(get_current_user)):
    subs = db.query(models.Submission).filter(models.Submission.user_id == user.id)
    total = subs.count()
    accepted = subs.filter(models.Submission.status == "Accepted").count()
    avg = db.query(func.avg(models.Submission.score)).filter(
        models.Submission.user_id == user.id
    ).scalar() or 0
    solved = _solved_problem_ids(db, user.id)
    attempted = {r[0] for r in subs.with_entities(models.Submission.problem_id).distinct().all()}

    status_rows = (
        db.query(models.Submission.status, func.count(models.Submission.id))
        .filter(models.Submission.user_id == user.id)
        .group_by(models.Submission.status)
        .all()
    )
    by_status = [{"name": s, "value": c} for s, c in status_rows]

    diff = {}
    if attempted:
        for p in db.query(models.Problem).filter(models.Problem.id.in_(attempted)).all():
            d = (p.difficulty or "medium").capitalize()
            diff.setdefault(d, {"difficulty": d, "attempted": 0, "solved": 0})
            diff[d]["attempted"] += 1
            if p.id in solved:
                diff[d]["solved"] += 1

    return {
        "stats": {
            "submissions": total,
            "accepted": accepted,
            "avg_score": round(float(avg), 1),
            "attempted": len(attempted),
            "solved": len(solved),
        },
        "by_status": by_status,
        "by_difficulty": list(diff.values()),
    }
