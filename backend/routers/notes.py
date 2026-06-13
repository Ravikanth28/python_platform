"""Notes CRUD – file upload, YouTube link, and external link support."""
import os
import uuid
from typing import List, Optional

import aiofiles
from fastapi import (
    APIRouter, Depends, File, Form, HTTPException, UploadFile,
)
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_admin_user, get_current_user
from database import get_db

router = APIRouter()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
ALLOWED_TYPES = {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
MAX_SIZE = 50 * 1024 * 1024  # 50 MB


def _note_to_dict(note: models.Note, db: Session) -> dict:
    interactions = (
        db.query(models.NoteInteraction)
        .filter(models.NoteInteraction.note_id == note.id)
        .all()
    )
    view_count = sum(i.view_count for i in interactions)
    download_count = sum(1 for i in interactions if i.downloaded)
    return {
        "id": note.id,
        "title": note.title,
        "description": note.description,
        "upload_type": note.upload_type,
        "file_url": note.file_url,
        "yt_link": note.yt_link,
        "external_link": note.external_link,
        "file_size": note.file_size,
        "is_for_all": note.is_for_all,
        "created_at": note.created_at.isoformat(),
        "view_count": view_count,
        "download_count": download_count,
        "creator": note.creator.username if note.creator else None,
    }


# ──────────────────────── Admin: create note ──────────────────────────────

@router.post("", status_code=201)
async def create_note(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    upload_type: str = Form(...),
    yt_link: Optional[str] = Form(None),
    external_link: Optional[str] = Form(None),
    is_for_all: bool = Form(True),
    assigned_user_ids: Optional[str] = Form(None),   # comma-separated IDs
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_admin_user),
):
    file_url: Optional[str] = None
    file_size: Optional[int] = None

    if upload_type in ("pdf", "docx") and file:
        content = await file.read()
        if len(content) > MAX_SIZE:
            raise HTTPException(400, "File too large (max 50 MB)")
        ext = ".pdf" if upload_type == "pdf" else ".docx"
        filename = f"{uuid.uuid4().hex}{ext}"
        dest = os.path.join(UPLOAD_DIR, "notes", filename)
        async with aiofiles.open(dest, "wb") as f:
            await f.write(content)
        file_url = f"/uploads/notes/{filename}"
        file_size = len(content)

    note = models.Note(
        title=title,
        description=description,
        upload_type=upload_type,
        file_url=file_url,
        yt_link=yt_link,
        external_link=external_link,
        file_size=file_size,
        is_for_all=is_for_all,
        created_by=current_user.id,
    )
    db.add(note)
    db.flush()

    if not is_for_all and assigned_user_ids:
        ids = [int(x.strip()) for x in assigned_user_ids.split(",") if x.strip().isdigit()]
        for uid in ids:
            db.add(models.NoteAssignment(note_id=note.id, user_id=uid))

    db.commit()
    db.refresh(note)
    return _note_to_dict(note, db)


# ──────────────────────── List notes ──────────────────────────────────────

@router.get("")
def list_notes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == "admin":
        notes = db.query(models.Note).filter(models.Note.is_deleted == False).all()
    else:
        # Notes assigned to all OR specifically to this student
        assigned_ids = [
            a.note_id
            for a in db.query(models.NoteAssignment)
            .filter(models.NoteAssignment.user_id == current_user.id)
            .all()
        ]
        notes = (
            db.query(models.Note)
            .filter(
                models.Note.is_deleted == False,
                (models.Note.is_for_all == True) | (models.Note.id.in_(assigned_ids)),
            )
            .all()
        )
    return [_note_to_dict(n, db) for n in notes]


# ──────────────────────── Get single note ─────────────────────────────────

@router.get("/{note_id}")
def get_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    note = db.query(models.Note).filter(models.Note.id == note_id, models.Note.is_deleted == False).first()
    if not note:
        raise HTTPException(404, "Note not found")
    return _note_to_dict(note, db)


# ──────────────────────── Track view ──────────────────────────────────────

@router.post("/{note_id}/view")
def track_view(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    interaction = (
        db.query(models.NoteInteraction)
        .filter(
            models.NoteInteraction.note_id == note_id,
            models.NoteInteraction.user_id == current_user.id,
        )
        .first()
    )
    if interaction:
        interaction.view_count += 1
    else:
        import datetime
        interaction = models.NoteInteraction(
            note_id=note_id,
            user_id=current_user.id,
            viewed=True,
            view_count=1,
            viewed_at=datetime.datetime.utcnow(),
        )
        db.add(interaction)
    db.commit()
    return {"detail": "ok"}


# ──────────────────────── Track download ──────────────────────────────────

@router.post("/{note_id}/download")
def track_download(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    import datetime
    interaction = (
        db.query(models.NoteInteraction)
        .filter(
            models.NoteInteraction.note_id == note_id,
            models.NoteInteraction.user_id == current_user.id,
        )
        .first()
    )
    if interaction:
        interaction.downloaded = True
        interaction.downloaded_at = datetime.datetime.utcnow()
    else:
        interaction = models.NoteInteraction(
            note_id=note_id,
            user_id=current_user.id,
            downloaded=True,
            downloaded_at=datetime.datetime.utcnow(),
        )
        db.add(interaction)
    db.commit()
    return {"detail": "ok"}


# ──────────────────────── Delete single ───────────────────────────────────

@router.delete("/{note_id}")
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not note:
        raise HTTPException(404, "Note not found")
    note.is_deleted = True
    db.commit()
    return {"detail": "Deleted"}


# ──────────────────────── Bulk delete ─────────────────────────────────────

@router.post("/bulk-delete")
def bulk_delete(
    payload: dict,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    ids: List[int] = payload.get("ids", [])
    db.query(models.Note).filter(models.Note.id.in_(ids)).update(
        {"is_deleted": True}, synchronize_session=False
    )
    db.commit()
    return {"detail": f"Deleted {len(ids)} notes"}
