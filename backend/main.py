import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import monitoring
from database import Base, engine
from routers import (
    admin, ai_router, analytics, auth, classroom, learn, notes, problems, reports,
    students, submissions,
)

monitoring.install_log_capture()

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# ── Create all tables ──────────────────────────────────────────────────────
try:
    Base.metadata.create_all(bind=engine)
except Exception as _db_exc:
    import logging
    logging.warning(f"DB create_all failed (configure DATABASE_URL in .env): {_db_exc}")


def _lightweight_migrate():
    """Add new columns to existing tables (no Alembic) + backfill invite codes."""
    import logging
    import secrets
    from sqlalchemy import text
    stmts = [
        "ALTER TABLE classes ADD COLUMN invite_code VARCHAR(12)",
        "ALTER TABLE submissions ADD COLUMN feedback TEXT",
        "ALTER TABLE problems ADD COLUMN starter_code TEXT",
        "ALTER TABLE users ADD COLUMN phone VARCHAR(20)",
        "ALTER TABLE test_sessions ADD COLUMN tab_switches INT DEFAULT 0",
        "ALTER TABLE test_sessions ADD COLUMN runs INT DEFAULT 0",
        "ALTER TABLE problems ADD COLUMN window_switch_detect BOOLEAN DEFAULT FALSE",
        "ALTER TABLE problems ADD COLUMN block_paste BOOLEAN DEFAULT FALSE",
        "ALTER TABLE submissions ADD COLUMN feedback_sent_at DATETIME",
        "ALTER TABLE submissions ADD COLUMN feedback_viewed_at DATETIME",
    ]
    with engine.begin() as conn:
        for s in stmts:
            try:
                conn.execute(text(s))
            except Exception:
                pass  # column already exists
        try:
            rows = conn.execute(text("SELECT id FROM classes WHERE invite_code IS NULL OR invite_code=''")).fetchall()
            for (cid,) in rows:
                conn.execute(text("UPDATE classes SET invite_code=:c WHERE id=:i"),
                             {"c": secrets.token_hex(3).upper(), "i": cid})
        except Exception as e:
            logging.warning(f"invite-code backfill skipped: {e}")
        try:
            # Treat any pre-existing feedback as already "sent" (unread) so it
            # stays visible to students after the send/read-receipt feature lands.
            conn.execute(text(
                "UPDATE submissions SET feedback_sent_at = submitted_at "
                "WHERE feedback IS NOT NULL AND feedback != '' AND feedback_sent_at IS NULL"
            ))
        except Exception as e:
            logging.warning(f"feedback-sent backfill skipped: {e}")


try:
    _lightweight_migrate()
except Exception as _mig_exc:
    import logging
    logging.warning(f"lightweight migrate skipped: {_mig_exc}")


def _seed_learn_content():
    """Populate beginner challenges + interactive lessons on first run (idempotent)."""
    import logging
    import seed_challenges
    import seed_lessons
    from database import SessionLocal
    db = SessionLocal()
    try:
        n = seed_challenges.seed_if_empty(db)
        if n:
            logging.info(f"Seeded {n} learn challenges")
        m = seed_lessons.seed_if_empty(db)
        if m:
            logging.info(f"Seeded {m} lessons")
    except Exception as e:
        logging.warning(f"learn-content seed skipped: {e}")
    finally:
        db.close()


try:
    _seed_learn_content()
except Exception as _seed_exc:
    import logging
    logging.warning(f"challenge seed skipped: {_seed_exc}")

# ── Ensure upload directory exists ────────────────────────────────────────
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(os.path.join(UPLOAD_DIR, "notes"), exist_ok=True)

# ── App ────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Python Programming Learning Platform",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    redirect_slashes=False,
)

# ── CORS ───────────────────────────────────────────────────────────────────
# FRONTEND_URL may hold one or more comma-separated origins. Trailing slashes are
# stripped (the browser's Origin header never has one — a mismatch silently blocks
# every request). If unset, fall back to allowing any origin WITHOUT credentials
# (auth uses a Bearer header, not cookies) so previews/dev still work.
_origins = [o.strip().rstrip("/") for o in (os.getenv("FRONTEND_URL") or "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["*"],
    allow_credentials=bool(_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Access log → live feed (powers the System health console) ────────────────
import time as _time

# Don't record these in the feed: the System page's own poll (would self-spam)
# and CORS preflight noise.
_FEED_SKIP = {"/api/admin/health"}


@app.middleware("http")
async def _access_log(request, call_next):
    if request.method == "OPTIONS" or request.url.path in _FEED_SKIP:
        return await call_next(request)
    start = _time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        monitoring.record_http(request.method, request.url.path, 500,
                               (_time.perf_counter() - start) * 1000)
        raise
    monitoring.record_http(request.method, request.url.path, response.status_code,
                           (_time.perf_counter() - start) * 1000)
    return response

# ── Static uploads ─────────────────────────────────────────────────────────
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ── Routers ────────────────────────────────────────────────────────────────
app.include_router(auth.router,        prefix="/api/auth",        tags=["Auth"])
app.include_router(admin.router,       prefix="/api/admin",       tags=["Admin"])
app.include_router(notes.router,       prefix="/api/notes",       tags=["Notes"])
app.include_router(problems.router,    prefix="/api/problems",    tags=["Problems"])
app.include_router(submissions.router, prefix="/api/submissions", tags=["Submissions"])
app.include_router(reports.router,     prefix="/api/reports",     tags=["Reports"])
app.include_router(students.router,    prefix="/api/students",    tags=["Students"])
app.include_router(ai_router.router,   prefix="/api/ai",          tags=["AI"])
app.include_router(classroom.router,   prefix="/api/classroom",   tags=["Classroom"])
app.include_router(analytics.router,   prefix="/api/analytics",   tags=["Analytics"])
app.include_router(learn.router,       prefix="/api/learn",       tags=["Learn"])


@app.get("/api/health")
async def health():
    return {"status": "healthy", "version": "2.0.0"}
