"""Student-specific routes: dashboard analytics."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
from auth import get_current_user
from database import get_db

router = APIRouter()


@router.get("/dashboard")
def student_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    uid = current_user.id

    subs = (
        db.query(models.Submission)
        .filter(models.Submission.user_id == uid)
        .order_by(models.Submission.submitted_at.desc())
        .all()
    )

    total = len(subs)
    accepted = sum(1 for s in subs if s.status == "Accepted")
    avg_score = round(sum(s.score for s in subs) / total, 1) if total else 0

    # Assigned notes count
    notes_total = (
        db.query(models.Note)
        .filter(
            models.Note.is_deleted == False,
            models.Note.is_for_all == True,
        )
        .count()
    )
    assigned_notes = (
        db.query(models.NoteAssignment)
        .filter(models.NoteAssignment.user_id == uid)
        .count()
    )

    # Upcoming tests
    import datetime
    now = datetime.datetime.utcnow()
    upcoming = (
        db.query(models.Problem)
        .filter(
            models.Problem.mode == "test",
            models.Problem.is_active == True,
            (models.Problem.start_time == None) | (models.Problem.start_time >= now),
        )
        .limit(5)
        .all()
    )

    recent_subs = subs[:5]

    return {
        "stats": {
            "total_submissions": total,
            "accepted": accepted,
            "avg_score": avg_score,
            "notes_available": notes_total + assigned_notes,
        },
        "recent_submissions": [
            {
                "id": s.id,
                "problem_title": s.problem.title if s.problem else "—",
                "mode": s.problem.mode.value if s.problem else "—",
                "status": s.status,
                "score": s.score,
                "submitted_at": s.submitted_at.isoformat(),
            }
            for s in recent_subs
        ],
        "upcoming_tests": [
            {
                "id": p.id,
                "title": p.title,
                "start_time": p.start_time.isoformat() if p.start_time else None,
                "duration": p.duration,
            }
            for p in upcoming
        ],
    }
