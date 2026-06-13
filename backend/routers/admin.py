"""Admin-only dashboard and user management."""
import datetime
import io
import json
import os
import zipfile
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session

import models
import monitoring
import schemas
from auth import get_admin_user
from database import get_db

router = APIRouter()


def _json_safe(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.isoformat()
    return v


def _dump_all_tables(db: Session) -> dict:
    """Every row of every table, FK-safe order, values JSON-serialisable."""
    out = {}
    for tbl in models.Base.metadata.sorted_tables:
        rows = db.execute(tbl.select()).mappings().all()
        out[tbl.name] = [{k: _json_safe(v) for k, v in row.items()} for row in rows]
    return out


@router.get("/backup")
def backup(format: str = "json", db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    """Full export of the whole database (nothing omitted) as JSON or Excel."""
    data = _dump_all_tables(db)
    stamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    if format == "xlsx":
        from openpyxl import Workbook
        wb = Workbook()
        wb.remove(wb.active)
        for name, rows in data.items():
            ws = wb.create_sheet(name[:31] or "sheet")
            if rows:
                cols = list({k for r in rows for k in r.keys()})
                ws.append(cols)
                for r in rows:
                    ws.append([r.get(c) for c in cols])
            else:
                ws.append(["(no rows)"])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return Response(
            buf.read(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=codeforge_backup_{stamp}.xlsx"},
        )

    payload = json.dumps(
        {"exported_at": datetime.datetime.utcnow().isoformat(),
         "tables": list(data.keys()),
         "data": data},
        indent=2, default=str,
    )
    return Response(
        payload, media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=codeforge_backup_{stamp}.json"},
    )


@router.get("/backup/files")
def backup_files(_admin=Depends(get_admin_user)):
    """Download every uploaded file on the Render disk (notes PDFs/DOCX) as a ZIP.
    These live on the ephemeral container disk, so this is your only way to save them."""
    upload_dir = os.getenv("UPLOAD_DIR", "./uploads")
    stamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    buf = io.BytesIO()
    count = 0
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        if os.path.isdir(upload_dir):
            for root, _dirs, files in os.walk(upload_dir):
                for fn in files:
                    fp = os.path.join(root, fn)
                    try:
                        z.write(fp, os.path.relpath(fp, upload_dir))
                        count += 1
                    except Exception:
                        pass
        if count == 0:
            z.writestr("README.txt", "No uploaded files on disk.")
    buf.seek(0)
    return Response(
        buf.read(), media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=codeforge_files_{stamp}.zip"},
    )


class PurgeRequest(BaseModel):
    confirm: str                      # must equal "DELETE"
    scope: str = "submissions"        # "submissions" | "all_records"


@router.post("/purge")
def purge_records(payload: PurgeRequest, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    """
    Free up space by deleting rows while KEEPING the table structure.
      • submissions  → clears submission history + results (the bulky, fast-growing data)
      • all_records  → clears everything EXCEPT user accounts (so logins still work)
    Destructive: requires confirm == "DELETE". Download a backup first.
    """
    if payload.confirm != "DELETE":
        raise HTTPException(400, "Type DELETE to confirm.")

    by_name = {t.name: t for t in models.Base.metadata.sorted_tables}

    if payload.scope == "all_records":
        # never wipe users (would lock everyone, including you, out)
        targets = [t for t in reversed(models.Base.metadata.sorted_tables) if t.name != "users"]
    else:
        # children first for FK safety
        targets = [by_name[n] for n in ("submission_results", "submissions") if n in by_name]

    deleted = {}
    for tbl in targets:
        res = db.execute(tbl.delete())
        deleted[tbl.name] = res.rowcount
    db.commit()
    return {"detail": "Records cleared", "scope": payload.scope, "deleted": deleted}


@router.get("/health")
def system_health(request: Request, db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    """Status of each backend service/dependency + recent warning/error logs."""
    try:
        db.execute(text("SELECT 1"))
        db_ok, db_detail = True, "connected"
    except Exception as e:  # noqa: BLE001
        db_ok, db_detail = False, f"error: {str(e)[:140]}"

    checks = monitoring.run_checks(db_ok, db_detail)
    checks.append({
        "name": "API server", "ok": True, "critical": True,
        "detail": f"{len(request.app.routes)} routes mounted",
    })

    storage = monitoring.storage_checks(db)

    issues = [c["name"] for c in checks if c["critical"] and not c["ok"]]
    warnings = [c["name"] for c in checks if not c["critical"] and not c["ok"]]
    storage_warn = [s["name"] for s in storage if s.get("warn")]
    status = "down" if issues else ("degraded" if (warnings or storage_warn) else "healthy")

    return {"status": status, "checks": checks, "storage": storage, "logs": monitoring.recent_events()}


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    total_students = db.query(models.User).filter(models.User.role == "student").count()
    total_admins = db.query(models.User).filter(models.User.role == "admin").count()
    total_notes = db.query(models.Note).filter(models.Note.is_deleted == False).count()
    total_practice = (
        db.query(models.Problem)
        .filter(models.Problem.mode == "practice", models.Problem.is_active == True)
        .count()
    )
    total_tests = (
        db.query(models.Problem)
        .filter(models.Problem.mode == "test", models.Problem.is_active == True)
        .count()
    )
    total_submissions = db.query(models.Submission).count()

    # Accepted / Wrong / Other breakdown
    accepted = (
        db.query(models.Submission)
        .filter(models.Submission.status == "Accepted")
        .count()
    )

    # Recent 5 submissions
    recent = (
        db.query(models.Submission)
        .order_by(models.Submission.submitted_at.desc())
        .limit(5)
        .all()
    )
    recent_data = []
    for s in recent:
        recent_data.append(
            {
                "id": s.id,
                "student": s.user.username if s.user else "—",
                "problem": s.problem.title if s.problem else "—",
                "status": s.status,
                "submitted_at": s.submitted_at.isoformat(),
            }
        )

    # Students list for quick reference
    students = (
        db.query(models.User)
        .filter(models.User.role == "student")
        .order_by(models.User.created_at.desc())
        .all()
    )

    # storage usage (for the Dashboard warning badge)
    try:
        storage = monitoring.storage_checks(db)
    except Exception:
        storage = []

    return {
        "stats": {
            "total_students": total_students,
            "total_admins": total_admins,
            "total_notes": total_notes,
            "total_practice": total_practice,
            "total_tests": total_tests,
            "total_submissions": total_submissions,
            "accepted_submissions": accepted,
        },
        "storage": storage,
        "recent_submissions": recent_data,
        "students": [
            {
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "email": u.email,
                "avatar_color": u.avatar_color,
                "created_at": u.created_at.isoformat(),
            }
            for u in students
        ],
    }


@router.get("/test-live")
def test_live(db: Session = Depends(get_db), _admin=Depends(get_admin_user)):
    """Live proctoring per test: each student's status, time left, violations, runs, passed."""
    now = datetime.datetime.utcnow()
    active_since = now - datetime.timedelta(seconds=90)   # heartbeat within 90s = "attending"
    _STATUS_ORDER = {"attending": 0, "not_started": 1, "done": 2}

    students = db.query(models.User).filter(models.User.role == models.UserRole.student).all()
    student_ids = {s.id for s in students}
    info = {s.id: {"id": s.id, "name": s.full_name or s.username, "avatar_color": s.avatar_color}
            for s in students}

    tests = (db.query(models.Problem)
             .filter(models.Problem.mode == models.ProblemMode.test, models.Problem.is_active == True)
             .order_by(models.Problem.created_at.desc()).all())

    out = []
    for t in tests:
        assigned = sorted(set(student_ids) if t.is_for_all
                          else ({a.user_id for a in t.assignments} & student_ids))
        if not assigned:
            continue

        # sessions (heartbeats) for this test
        sessions = {s.user_id: s for s in db.query(models.TestSession)
                    .filter(models.TestSession.problem_id == t.id,
                            models.TestSession.user_id.in_(assigned)).all()}
        # submissions → best passed / latest / tab switches
        sub = {}
        for s in (db.query(models.Submission)
                  .filter(models.Submission.problem_id == t.id,
                          models.Submission.user_id.in_(assigned)).all()):
            cur = sub.setdefault(s.user_id, {"passed": 0, "total": 0, "tabs": 0, "last": None})
            cur["passed"] = max(cur["passed"], s.test_cases_passed or 0)
            cur["total"] = max(cur["total"], s.test_cases_total or 0)
            cur["tabs"] = max(cur["tabs"], s.tab_switches or 0)
            if s.submitted_at and (cur["last"] is None or s.submitted_at > cur["last"]):
                cur["last"] = s.submitted_at

        rows, counts = [], {"attending": 0, "done": 0, "not_started": 0}
        for uid in assigned:
            sess = sessions.get(uid)
            done = uid in sub
            attending = (not done) and sess is not None and sess.last_seen and sess.last_seen >= active_since
            status = "done" if done else ("attending" if attending else "not_started")
            counts[status] += 1

            time_left = None
            if t.duration and sess and sess.started_at and not done:
                left = (sess.started_at + datetime.timedelta(minutes=t.duration) - now).total_seconds()
                time_left = max(0, int(left))

            violations = max((sess.tab_switches if sess else 0) or 0,
                             (sub.get(uid, {}).get("tabs", 0)))
            runs = (sess.runs if sess else 0) or 0
            last = sub.get(uid, {}).get("last") or (sess.last_seen if sess else None)

            rows.append({
                **info.get(uid, {"id": uid, "name": f"#{uid}", "avatar_color": None}),
                "status": status,
                "time_left": time_left,
                "violations": violations,
                "runs": runs,
                "passed": sub.get(uid, {}).get("passed", 0),
                "total_cases": sub.get(uid, {}).get("total", 0),
                "last_active": last.isoformat() if last else None,
            })

        rows.sort(key=lambda r: (_STATUS_ORDER.get(r["status"], 9), r["name"].lower()))
        out.append({
            "id": t.id, "title": t.title, "difficulty": t.difficulty, "duration": t.duration,
            "total": len(assigned), "done": counts["done"],
            "attending": counts["attending"], "not_done": counts["not_started"],
            "students": rows,
        })

    out.sort(key=lambda x: (-x["attending"], -x["done"]))
    return {"tests": out, "as_of": now.isoformat()}


@router.get("/students", response_model=List[schemas.UserResponse])
def list_students(
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    return (
        db.query(models.User)
        .filter(models.User.role == "student")
        .order_by(models.User.created_at.desc())
        .all()
    )


@router.post("/students/{user_id}/reset-password")
def admin_reset_password(
    user_id: int,
    payload: schemas.AdminPasswordReset,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    """Admin sets a new password for a student who forgot theirs."""
    from auth import get_password_hash
    if len(payload.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    return {"detail": f"Password reset for {user.username}"}


@router.delete("/students/{user_id}")
def delete_student(
    user_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(404, "User not found")
    db.delete(user)
    db.commit()
    return {"detail": "Deleted"}
