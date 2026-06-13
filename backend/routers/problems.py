"""Problems (practice + test) CRUD."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_admin_user, get_current_user
from database import get_db

router = APIRouter()


class ActiveUpdate(BaseModel):
    is_active: bool


def _problem_dict(p: models.Problem) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "description": p.description,
        "topics": p.topics,
        "starter_code": p.starter_code,
        "mode": p.mode.value if hasattr(p.mode, "value") else p.mode,
        "difficulty": p.difficulty,
        "start_time": p.start_time.isoformat() if p.start_time else None,
        "end_time": p.end_time.isoformat() if p.end_time else None,
        "duration": p.duration,
        "is_active": p.is_active,
        "is_for_all": p.is_for_all,
        "created_at": p.created_at.isoformat(),
        "tab_switch_detect": p.tab_switch_detect,
        "copy_paste_disable": p.copy_paste_disable,
        "f12_disable": p.f12_disable,
        "fullscreen_required": p.fullscreen_required,
        "window_switch_detect": p.window_switch_detect,
        "block_paste": p.block_paste,
        "test_cases_count": len(p.test_cases),
    }


# ──────────────────────── Create ──────────────────────────────────────────

@router.post("", status_code=201)
def create_problem(
    payload: schemas.ProblemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_admin_user),
):
    problem = models.Problem(
        title=payload.title,
        description=payload.description,
        topics=payload.topics,
        starter_code=payload.starter_code,
        mode=payload.mode,
        difficulty=payload.difficulty,
        start_time=payload.start_time,
        end_time=payload.end_time,
        duration=payload.duration,
        is_for_all=payload.is_for_all,
        created_by=current_user.id,
        tab_switch_detect=payload.tab_switch_detect,
        copy_paste_disable=payload.copy_paste_disable,
        f12_disable=payload.f12_disable,
        fullscreen_required=payload.fullscreen_required,
        window_switch_detect=payload.window_switch_detect,
        block_paste=payload.block_paste,
    )
    db.add(problem)
    db.flush()

    for i, tc in enumerate(payload.test_cases):
        db.add(
            models.TestCase(
                problem_id=problem.id,
                input_data=tc.input_data,
                expected_output=tc.expected_output,
                is_hidden=tc.is_hidden,
                order_index=i,
            )
        )

    if not payload.is_for_all and payload.assigned_user_ids:
        for uid in payload.assigned_user_ids:
            db.add(models.ProblemAssignment(problem_id=problem.id, user_id=uid))

    db.commit()
    db.refresh(problem)
    return _problem_dict(problem)


# ──────────────────────── List ────────────────────────────────────────────

@router.get("")
def list_problems(
    mode: Optional[str] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Problem)
    # students never see inactive; admins can opt-in to manage them
    if not (include_inactive and current_user.role == "admin"):
        query = query.filter(models.Problem.is_active == True)
    if mode:
        query = query.filter(models.Problem.mode == mode)

    if current_user.role != "admin":
        assigned = [
            a.problem_id
            for a in db.query(models.ProblemAssignment)
            .filter(models.ProblemAssignment.user_id == current_user.id)
            .all()
        ]
        query = query.filter(
            (models.Problem.is_for_all == True) | (models.Problem.id.in_(assigned))
        )

    problems = query.order_by(models.Problem.created_at.desc()).all()
    return [_problem_dict(p) for p in problems]


# ──────────────────────── Get single ──────────────────────────────────────

@router.get("/{problem_id}")
def get_problem(
    problem_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not p:
        raise HTTPException(404, "Problem not found")
    data = _problem_dict(p)

    # Include test cases (hide expected output for hidden ones if student)
    tcs = []
    for tc in p.test_cases:
        entry = {
            "id": tc.id,
            "input_data": tc.input_data,
            "is_hidden": tc.is_hidden,
            "order_index": tc.order_index,
        }
        if current_user.role == "admin" or not tc.is_hidden:
            entry["expected_output"] = tc.expected_output
        tcs.append(entry)
    data["test_cases"] = tcs
    return data


# ──────────────────────── Update ──────────────────────────────────────────

@router.put("/{problem_id}")
def update_problem(
    problem_id: int,
    payload: schemas.ProblemCreate,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    p = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not p:
        raise HTTPException(404, "Problem not found")

    for field in (
        "title", "description", "topics", "starter_code", "mode", "difficulty",
        "start_time", "end_time", "duration", "is_for_all",
        "tab_switch_detect", "copy_paste_disable", "f12_disable", "fullscreen_required",
        "window_switch_detect", "block_paste",
    ):
        setattr(p, field, getattr(payload, field))

    # Replace test cases
    db.query(models.TestCase).filter(models.TestCase.problem_id == problem_id).delete()
    for i, tc in enumerate(payload.test_cases):
        db.add(
            models.TestCase(
                problem_id=p.id,
                input_data=tc.input_data,
                expected_output=tc.expected_output,
                is_hidden=tc.is_hidden,
                order_index=i,
            )
        )

    db.commit()
    db.refresh(p)
    return _problem_dict(p)


# ──────────────────────── Duplicate ───────────────────────────────────────

@router.post("/{problem_id}/duplicate", status_code=201)
def duplicate_problem(
    problem_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_admin_user),
):
    p = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not p:
        raise HTTPException(404, "Problem not found")
    clone = models.Problem(
        title=f"{p.title} (copy)", description=p.description, topics=p.topics,
        starter_code=p.starter_code,
        mode=p.mode, difficulty=p.difficulty, start_time=p.start_time, end_time=p.end_time,
        duration=p.duration, is_for_all=p.is_for_all, created_by=current_user.id,
        is_active=True,
        tab_switch_detect=p.tab_switch_detect, copy_paste_disable=p.copy_paste_disable,
        f12_disable=p.f12_disable, fullscreen_required=p.fullscreen_required,
        window_switch_detect=p.window_switch_detect, block_paste=p.block_paste,
    )
    db.add(clone)
    db.flush()
    for tc in p.test_cases:
        db.add(models.TestCase(
            problem_id=clone.id, input_data=tc.input_data, expected_output=tc.expected_output,
            is_hidden=tc.is_hidden, order_index=tc.order_index,
        ))
    db.commit()
    db.refresh(clone)
    return _problem_dict(clone)


# ──────────────────────── Activate / Deactivate ───────────────────────────

@router.patch("/{problem_id}/active")
def set_active(
    problem_id: int,
    payload: ActiveUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    p = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not p:
        raise HTTPException(404, "Problem not found")
    p.is_active = payload.is_active
    db.commit()
    db.refresh(p)
    return _problem_dict(p)


# ──────────────────────── Delete (soft — deactivate) ──────────────────────

@router.delete("/{problem_id}")
def delete_problem(
    problem_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    p = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not p:
        raise HTTPException(404, "Problem not found")
    p.is_active = False
    db.commit()
    return {"detail": "Deactivated"}


# ──────────────────────── Hard delete (permanent) ─────────────────────────

@router.delete("/{problem_id}/permanent")
def delete_problem_permanent(
    problem_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    """Permanently remove a problem and everything tied to it.

    Submissions reference problems with no ON DELETE cascade, so we clear
    dependent rows in dependency order before removing the problem itself.
    """
    p = db.query(models.Problem).filter(models.Problem.id == problem_id).first()
    if not p:
        raise HTTPException(404, "Problem not found")

    sub_ids = [s.id for s in db.query(models.Submission.id)
               .filter(models.Submission.problem_id == problem_id).all()]
    if sub_ids:
        db.query(models.SubmissionResult).filter(
            models.SubmissionResult.submission_id.in_(sub_ids)
        ).delete(synchronize_session=False)
        db.query(models.Submission).filter(
            models.Submission.problem_id == problem_id
        ).delete(synchronize_session=False)

    db.query(models.AssignmentProblem).filter(
        models.AssignmentProblem.problem_id == problem_id
    ).delete(synchronize_session=False)
    db.query(models.ProblemAssignment).filter(
        models.ProblemAssignment.problem_id == problem_id
    ).delete(synchronize_session=False)
    db.query(models.TestSession).filter(
        models.TestSession.problem_id == problem_id
    ).delete(synchronize_session=False)
    db.query(models.TestCase).filter(
        models.TestCase.problem_id == problem_id
    ).delete(synchronize_session=False)

    db.delete(p)
    db.commit()
    return {"detail": "Deleted"}
