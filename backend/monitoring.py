"""Lightweight observability: a ring buffer of recent events (logs + HTTP) + service checks."""
import collections
import itertools
import logging
import os
import shutil
import subprocess
import time

# One unified feed for both application logs and HTTP requests so the System page
# can show a single live stream (newest-first) the way a backend terminal does.
_RING = collections.deque(maxlen=500)
_SEQ = itertools.count(1)

# Library loggers that are too chatty to keep at INFO — only their WARNING+ get in.
_NOISY = ("sqlalchemy", "uvicorn", "asyncio", "watchfiles", "multipart",
          "httpcore", "httpx", "python_multipart", "PIL")


def _now():
    return time.strftime("%H:%M:%S", time.localtime())


class _RingHandler(logging.Handler):
    def emit(self, record):
        try:
            if record.levelno < logging.WARNING and record.name.split(".")[0] in _NOISY:
                return  # drop chatty INFO/DEBUG from third-party libs
            _RING.append({
                "seq": next(_SEQ),
                "kind": "log",
                "time": _now(),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage()[:600],
            })
        except Exception:
            pass


def install_log_capture(level=logging.INFO):
    """Attach the ring handler to the root logger (captures INFO+ from the app)."""
    root = logging.getLogger()
    if root.level > logging.INFO:
        root.setLevel(logging.INFO)
    if not any(isinstance(h, _RingHandler) for h in root.handlers):
        h = _RingHandler()
        h.setLevel(level)
        root.addHandler(h)


def record_http(method, path, status, ms):
    """Record one finished HTTP request into the live feed."""
    try:
        _RING.append({
            "seq": next(_SEQ),
            "kind": "http",
            "time": _now(),
            "method": method,
            "path": path[:200],
            "status": int(status),
            "ms": round(float(ms), 1),
        })
    except Exception:
        pass


def recent_events(limit=250):
    """Newest-first slice of the unified feed (logs + HTTP)."""
    return list(_RING)[-limit:][::-1]


# Back-compat alias (older callers used recent_logs()).
recent_logs = recent_events


def _which_version(cmd):
    path = shutil.which(cmd)
    if not path:
        return None, None
    try:
        out = subprocess.run([cmd, "--version"], capture_output=True, text=True, timeout=5)
        lines = (out.stdout or out.stderr or "").splitlines()
        return path, (lines[0].strip() if lines else path)
    except Exception:
        return path, path


def storage_checks(db):
    """
    Storage usage for the two places that can fill up on a small deploy:
      • TiDB database  — summed table size vs the plan limit (default 5 GiB free tier)
      • Render disk     — container filesystem usage (where uploads/temp live)
    Each returns percent used; warn=True once it crosses the threshold (90%).
    """
    from sqlalchemy import text  # local import keeps monitoring import-light
    WARN_AT = float(os.getenv("STORAGE_WARN_PERCENT", "80"))
    checks = []

    # ── TiDB database storage ───────────────────────────────────────────────
    # TiDB (esp. Serverless) often reports data_length/index_length as 0 in
    # information_schema (it's stats-derived). When that happens we fall back to
    # a live row count and estimate bytes from it.
    try:
        rows = db.execute(text(
            "SELECT table_name, COALESCE(data_length + index_length, 0), COALESCE(table_rows, 0) "
            "FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'"
        )).fetchall()
        byte_sum = float(sum(r[1] for r in rows))
        total_rows = int(sum(r[2] for r in rows))

        # TiDB Serverless usually leaves data_length/table_rows at ~0 (stats-derived),
        # so when they look empty we count live rows — always accurate.
        if total_rows == 0 and byte_sum < 64 * 1024:
            total_rows = 0
            for r in rows:
                try:
                    total_rows += int(db.execute(text(f"SELECT COUNT(*) FROM `{r[0]}`")).scalar() or 0)
                except Exception:
                    pass

        est_bytes = total_rows * 1024.0            # ~1 KB/row estimate when sizes are unavailable
        total_bytes = max(byte_sum, est_bytes)
        note = None if byte_sum >= est_bytes and byte_sum > 0 else f"estimated from ~{total_rows:,} rows (TiDB doesn't expose exact size)"

        used_mb = total_bytes / (1024 * 1024)
        limit_mb = float(os.getenv("DB_STORAGE_LIMIT_MB", "5120"))  # TiDB Serverless free ≈ 5 GiB
        pct = round(used_mb / limit_mb * 100, 1) if limit_mb else 0.0
        checks.append({
            "name": "Database storage (TiDB)", "kind": "db",
            "used_mb": round(used_mb, 1), "limit_mb": round(limit_mb, 1),
            "rows": total_rows, "percent": pct, "warn": pct >= WARN_AT, "note": note,
        })
    except Exception as e:  # noqa: BLE001
        checks.append({"name": "Database storage (TiDB)", "kind": "db",
                       "percent": 0.0, "warn": False, "error": str(e)[:140]})

    # ── Render container disk (informational — it's a SHARED host filesystem) ──
    # The container disk is mostly OS + base image + other tenants, which isn't ours
    # to manage, so this never raises a warning. We split the "used" portion into
    # what the OS/base image takes vs. the files WE actually store.
    try:
        du = shutil.disk_usage("/")
        upload_dir = os.getenv("UPLOAD_DIR", "./uploads")
        uploads = 0
        if os.path.isdir(upload_dir):
            for root, _dirs, files in os.walk(upload_dir):
                for fn in files:
                    try:
                        uploads += os.path.getsize(os.path.join(root, fn))
                    except Exception:
                        pass
        system = max(0, du.used - uploads)
        mb = lambda b: round(b / (1024 * 1024), 1)  # noqa: E731
        checks.append({
            "name": "Disk (Render)", "kind": "disk",
            "used_mb": mb(du.used), "limit_mb": mb(du.total),
            "percent": round(du.used / du.total * 100, 1) if du.total else 0.0,
            "warn": False,
            "breakdown": [
                {"label": "System, OS & base image", "mb": mb(system), "seg": "system"},
                {"label": "Your uploaded files", "mb": mb(uploads), "seg": "uploads"},
                {"label": "Free", "mb": mb(du.free), "seg": "free"},
            ],
            "note": "Render's container disk is shared with the OS & base image — only 'Your uploaded files' is yours (and it resets on redeploy).",
        })
    except Exception as e:  # noqa: BLE001
        checks.append({"name": "Disk (Render)", "kind": "disk",
                       "percent": 0.0, "warn": False, "error": str(e)[:140]})

    return checks


def run_checks(db_ok, db_detail):
    """Return a list of service checks. `critical` flips overall status to 'issues'."""
    checks = [{"name": "Database", "ok": db_ok, "critical": True, "detail": db_detail}]

    import sys as _sys
    py_ver = f"Python {_sys.version.split()[0]}"
    checks.append({
        "name": "Python interpreter", "ok": True, "critical": True,
        "detail": py_ver,
    })

    try:
        import importlib.util as _ilu
        _has_pyflakes = _ilu.find_spec("pyflakes") is not None
    except Exception:
        _has_pyflakes = False
    checks.append({
        "name": "Code Check (pyflakes)", "ok": _has_pyflakes, "critical": False,
        "detail": "available" if _has_pyflakes else "not installed — Code Check is disabled",
    })

    keys = sum(1 for i in range(1, 21) if os.getenv(f"CEREBRAS_API_KEY_{i}", "").strip())
    checks.append({
        "name": "AI tutor (Cerebras)", "ok": keys > 0, "critical": False,
        "detail": f"{keys} API key(s) configured" if keys else "no API keys — AI tutor disabled",
    })

    upload_dir = os.getenv("UPLOAD_DIR", "./uploads")
    try:
        os.makedirs(upload_dir, exist_ok=True)
        probe = os.path.join(upload_dir, ".write_test")
        with open(probe, "w") as f:
            f.write("ok")
        os.remove(probe)
        checks.append({"name": "Uploads storage", "ok": True, "critical": True, "detail": "writable"})
    except Exception as e:
        checks.append({"name": "Uploads storage", "ok": False, "critical": True, "detail": f"not writable: {e}"})

    return checks
