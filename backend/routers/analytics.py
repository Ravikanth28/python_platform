"""Deep analytics — per-problem & per-student insights for admins and students."""
import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from auth import get_admin_user, get_current_user
from database import get_db

router = APIRouter()


def _split_topics(topics: str):
    if not topics:
        return ["Uncategorized"]
    parts = [t.strip() for chunk in topics.split(",") for t in chunk.split("/")]
    return [p for p in parts if p] or ["Uncategorized"]


def _range_cfg(rng):
    """(window, step, label_fmt) for a fixed range, or None for 'all'."""
    H = datetime.timedelta
    return {
        "1h":  (H(hours=1),  H(minutes=5), "%H:%M"),
        "24h": (H(hours=24), H(hours=1),   "%H:00"),
        "7d":  (H(days=7),   H(days=1),    "%b %d"),
        "14d": (H(days=14),  H(days=1),    "%b %d"),
    }.get(rng)


def _build_progress(rows, rng):
    """rows = list of (submitted_at, status). Buckets sized to the chosen range."""
    now = datetime.datetime.utcnow()
    cfg = _range_cfg(rng)
    if cfg is None:  # 'all'
        ts_list = [ts for ts, _ in rows if ts]
        if not ts_list:
            return []
        span = now - min(ts_list)
        step = datetime.timedelta(days=7) if span > datetime.timedelta(days=90) else datetime.timedelta(days=1)
        window = span + step
        fmt = "%b %d"
    else:
        window, step, fmt = cfg
    start = now - window
    n = int(window / step) + 1
    buckets = [
        {"date": (start + step * i).strftime(fmt), "submissions": 0, "accepted": 0}
        for i in range(n)
    ]
    for ts, status in rows:
        if not ts or ts < start:
            continue
        idx = int((ts - start) / step)
        if 0 <= idx < n:
            buckets[idx]["submissions"] += 1
            if status == "Accepted":
                buckets[idx]["accepted"] += 1
    return buckets


def _progress_rows(db, user_id, rng):
    q = db.query(models.Submission.submitted_at, models.Submission.status)
    if user_id:
        q = q.filter(models.Submission.user_id == user_id)
    cfg = _range_cfg(rng)
    if cfg is not None:
        q = q.filter(models.Submission.submitted_at >= datetime.datetime.utcnow() - cfg[0])
    return q.all()


# ──────────────────────────── Admin ────────────────────────────────────────

@router.get("/admin")
def admin_analytics(db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    total_students = db.query(models.User).filter(models.User.role == models.UserRole.student).count()
    total_subs = db.query(models.Submission).count()
    accepted = db.query(models.Submission).filter(models.Submission.status == "Accepted").count()
    avg_time = db.query(func.avg(models.Submission.time_taken)).filter(
        models.Submission.time_taken.isnot(None)
    ).scalar()

    # per-problem deep stats
    per_problem = []
    for p in db.query(models.Problem).all():
        subs = db.query(models.Submission).filter(models.Submission.problem_id == p.id)
        attempts = subs.count()
        students = subs.with_entities(models.Submission.user_id).distinct().count()
        acc = subs.filter(models.Submission.status == "Accepted").count()
        avg_score = db.query(func.avg(models.Submission.score)).filter(
            models.Submission.problem_id == p.id
        ).scalar() or 0
        avg_t = db.query(func.avg(models.Submission.time_taken)).filter(
            models.Submission.problem_id == p.id, models.Submission.time_taken.isnot(None)
        ).scalar()
        per_problem.append({
            "id": p.id,
            "title": p.title,
            "mode": p.mode.value,
            "attempts": attempts,
            "students": students,
            "accepted": acc,
            "acceptance": round(acc / attempts * 100, 1) if attempts else 0.0,
            "avg_score": round(float(avg_score), 1),
            "avg_attempts": round(attempts / students, 1) if students else 0.0,
            "avg_time_sec": round(float(avg_t), 0) if avg_t else 0,
        })
    per_problem.sort(key=lambda x: x["attempts"], reverse=True)

    # hardest test cases (distinct students who failed each)
    fail_rows = (
        db.query(models.SubmissionResult.test_case_id, models.Submission.user_id)
        .join(models.Submission, models.SubmissionResult.submission_id == models.Submission.id)
        .filter(models.SubmissionResult.status == "Failed")
        .all()
    )
    fails = {}
    for tc_id, uid in fail_rows:
        if tc_id is None:
            continue
        fails.setdefault(tc_id, set()).add(uid)
    hardest = []
    if fails:
        tcs = {tc.id: tc for tc in db.query(models.TestCase).filter(models.TestCase.id.in_(list(fails.keys()))).all()}
        for tc_id, users in fails.items():
            tc = tcs.get(tc_id)
            if not tc:
                continue
            prob = db.query(models.Problem).filter(models.Problem.id == tc.problem_id).first()
            hardest.append({
                "problem": prob.title if prob else "—",
                "case": f"Case #{(tc.order_index or 0) + 1}{' (hidden)' if tc.is_hidden else ''}",
                "students_failed": len(users),
            })
        hardest.sort(key=lambda x: x["students_failed"], reverse=True)
    hardest = hardest[:8]

    # who's stuck: students attempting but rarely solving
    stuck = []
    students = db.query(models.User).filter(models.User.role == models.UserRole.student).all()
    for s in students:
        ss = db.query(models.Submission).filter(models.Submission.user_id == s.id)
        attempts = ss.count()
        if attempts == 0:
            continue
        acc = ss.filter(models.Submission.status == "Accepted").count()
        solved = ss.filter(models.Submission.status == "Accepted").with_entities(
            models.Submission.problem_id
        ).distinct().count()
        acceptance = round(acc / attempts * 100, 1) if attempts else 0.0
        if attempts >= 3 and acceptance < 40:
            stuck.append({
                "id": s.id,
                "name": s.full_name or s.username,
                "email": s.email,
                "avatar_color": s.avatar_color,
                "attempts": attempts,
                "solved": solved,
                "acceptance": acceptance,
            })
    stuck.sort(key=lambda x: x["acceptance"])

    progress_rows = db.query(models.Submission.submitted_at, models.Submission.status).filter(
        models.Submission.submitted_at >= datetime.datetime.utcnow() - datetime.timedelta(days=14)
    ).all()

    return {
        "stats": {
            "students": total_students,
            "submissions": total_subs,
            "accepted": accepted,
            "acceptance": round(accepted / total_subs * 100, 1) if total_subs else 0.0,
            "avg_time_sec": round(float(avg_time), 0) if avg_time else 0,
        },
        "per_problem": per_problem[:50],
        "hardest_tests": hardest,
        "stuck_students": stuck[:10],
        "progress": _build_progress(progress_rows, "14d"),
    }


@router.get("/admin/progress")
def admin_progress(range: str = Query("14d"), db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    return {"progress": _build_progress(_progress_rows(db, None, range), range)}


# ──────────────────────────── Student ──────────────────────────────────────

@router.get("/student/progress")
def student_progress(range: str = Query("14d"), db: Session = Depends(get_db), user=Depends(get_current_user)):
    return {"progress": _build_progress(_progress_rows(db, user.id, range), range)}


def _student_payload(db, user_id):
    subs = db.query(models.Submission).filter(models.Submission.user_id == user_id)
    total = subs.count()
    accepted = subs.filter(models.Submission.status == "Accepted").count()
    avg_score = db.query(func.avg(models.Submission.score)).filter(
        models.Submission.user_id == user_id
    ).scalar() or 0

    solved_ids = {
        r[0] for r in subs.filter(models.Submission.status == "Accepted")
        .with_entities(models.Submission.problem_id).distinct().all()
    }
    attempted_ids = {r[0] for r in subs.with_entities(models.Submission.problem_id).distinct().all()}

    topics = {}
    if attempted_ids:
        for p in db.query(models.Problem).filter(models.Problem.id.in_(attempted_ids)).all():
            for t in _split_topics(p.topics):
                topics.setdefault(t, {"topic": t, "attempted": 0, "solved": 0})
                topics[t]["attempted"] += 1
                if p.id in solved_ids:
                    topics[t]["solved"] += 1
    by_topic = []
    for t in topics.values():
        t["acceptance"] = round(t["solved"] / t["attempted"] * 100, 1) if t["attempted"] else 0.0
        by_topic.append(t)
    by_topic.sort(key=lambda x: x["acceptance"])
    weak_topics = [t for t in by_topic if t["acceptance"] < 60][:5]

    status_rows = (
        db.query(models.Submission.status, func.count(models.Submission.id))
        .filter(models.Submission.user_id == user_id)
        .group_by(models.Submission.status)
        .all()
    )
    by_status = [{"name": s, "value": c} for s, c in status_rows]

    diff = {}
    if attempted_ids:
        for p in db.query(models.Problem).filter(models.Problem.id.in_(attempted_ids)).all():
            d = (p.difficulty or "medium").capitalize()
            diff.setdefault(d, {"difficulty": d, "attempted": 0, "solved": 0})
            diff[d]["attempted"] += 1
            if p.id in solved_ids:
                diff[d]["solved"] += 1

    progress_rows = subs.filter(
        models.Submission.submitted_at >= datetime.datetime.utcnow() - datetime.timedelta(days=14)
    ).with_entities(models.Submission.submitted_at, models.Submission.status).all()

    return {
        "stats": {
            "submissions": total,
            "accepted": accepted,
            "avg_score": round(float(avg_score), 1),
            "attempted": len(attempted_ids),
            "solved": len(solved_ids),
        },
        "by_topic": by_topic,
        "weak_topics": weak_topics,
        "by_status": by_status,
        "by_difficulty": list(diff.values()),
        "progress": _build_progress(progress_rows, "14d"),
    }


@router.get("/student")
def student_analytics(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return _student_payload(db, user.id)


@router.get("/admin/students")
def admin_students(db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    out = []
    for s in db.query(models.User).filter(models.User.role == models.UserRole.student).order_by(models.User.full_name).all():
        ss = db.query(models.Submission).filter(models.Submission.user_id == s.id)
        attempts = ss.count()
        acc = ss.filter(models.Submission.status == "Accepted").count()
        solved = ss.filter(models.Submission.status == "Accepted").with_entities(
            models.Submission.problem_id
        ).distinct().count()
        attempted = ss.with_entities(models.Submission.problem_id).distinct().count()
        out.append({
            "id": s.id,
            "name": s.full_name or s.username,
            "email": s.email,
            "avatar_color": s.avatar_color,
            "submissions": attempts,
            "accepted": acc,
            "acceptance": round(acc / attempts * 100, 1) if attempts else 0.0,
            "solved": solved,
            "attempted": attempted,
        })
    # lagging students (with activity) surface first
    out.sort(key=lambda x: (x["submissions"] == 0, x["acceptance"]))
    return out


@router.get("/admin/student/{user_id}")
def admin_student_detail(user_id: int, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Student not found")
    payload = _student_payload(db, user_id)
    payload["student"] = {
        "id": u.id, "name": u.full_name or u.username,
        "email": u.email, "avatar_color": u.avatar_color,
    }
    return payload
