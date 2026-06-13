# CodeForge — Python Programming Learning Platform

A full-stack platform for learning and practising the **Python** programming language:
lessons, coding challenges, practice & proctored test modes, an in-browser code
editor with a live interactive console, an automatic judge, a step-by-step **Code
Visualizer**, classrooms/assignments, analytics, and an AI tutor.

> This is the Python edition of the original C platform. The execution layer,
> curriculum, AI prompts and editor were all converted from C to Python.

## Stack

- **Backend** — FastAPI (Python), SQLAlchemy, JWT auth. Student code runs on the
  same CPython interpreter that hosts the API (`python -u`), sandboxed with
  resource limits (POSIX) and wall-clock timeouts.
- **Frontend** — React + Vite + Tailwind, Monaco editor (`language: "python"`).
- **AI** — Cerebras chat completions (optional; used for problem generation and
  the tutor).

## How the Python-specific pieces work

| Feature | Implementation |
|---|---|
| Run / Judge | `code_runner.py` — validates syntax with `compile()`, runs with `python -u`, compares stdout. |
| Interactive console | `interactive_runner.py` — runs the script in a PTY (POSIX / pywinpty) or a live pipe fallback, so prompts appear before `input()`. |
| Code Visualizer | `python_tracer.py` — `sys.settrace` records line/locals/stack per step. |
| Code Check | `/submissions/memcheck` runs **pyflakes** (undefined names, unused vars/imports) plus a normal run. |
| Lessons & challenges | `seed_lessons.py`, `seed_challenges.py` — a 14-lesson Python curriculum and predict/fix-bug challenges. |

## Running locally

### Backend
```bash
cd backend
pip install -r requirements.txt      # includes pyflakes + (on Windows) pywinpty
cp .env.example .env                 # set DATABASE_URL, SECRET_KEY, CEREBRAS keys
python seed.py                       # create default users + sample data
uvicorn main:app --reload --port 8000
```

`DATABASE_URL` can point at MySQL/TiDB (`mysql+pymysql://…`), Postgres, or
`sqlite:///./app.db` for local development.

### Frontend
```bash
cd frontend
npm install
npm run dev                          # set VITE_API_URL if the API isn't same-origin
```

### Default logins (after `python seed.py`)

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `Admin@123` |
| Student | `student1` | `Student@123` |

## Deployment

The backend ships a `Dockerfile` (plain `python:3.12-slim` — no compiler toolchain
needed). Render-style `$PORT` is honoured.
