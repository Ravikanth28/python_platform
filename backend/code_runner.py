"""
Python Code Runner – executes Python code in a temporary sandbox.
Works on both Windows and Linux. No compilation step: the student's source is
run with the same Python interpreter that hosts the backend (``sys.executable``)
in unbuffered mode (``-u``) so output streams live over a pipe.
"""
import os
import re
import signal
import subprocess
import sys
import tempfile
import threading
import time
import logging
from typing import Dict, List

logger = logging.getLogger(__name__)

try:
    import resource  # POSIX only (Linux/Render); absent on Windows
except ImportError:
    resource = None

# Interpreter used to run student code. Same one that runs the backend so the
# stdlib is guaranteed present.
PYTHON = sys.executable or "python3"

# Hard ceilings for any student program. Keeps a single submission from OOM-ing
# or fork-bombing a small instance (e.g. Render free tier = 512 MB / shared CPU).
# NOTE: RLIMIT_AS caps *virtual* address space — CPython needs a healthy amount
# just to start, so this is far higher than the C runner's 256 MB.
_MEM_BYTES = 768 * 1024 * 1024   # 768 MB address space
_CPU_SECS = 6                    # CPU seconds (idle waiting for input doesn't count)
_FSIZE_BYTES = 16 * 1024 * 1024  # max file write
_NPROC = 64                      # max processes/threads
_MAX_OUTPUT = 64 * 1024          # bytes of captured stdout we keep

_SCRIPT_NAME = "solution.py"


def _limit_preexec():
    """Return a preexec_fn applying rlimits, or None on Windows."""
    if resource is None:
        return None

    def _apply():
        for res, val in (
            (resource.RLIMIT_AS, _MEM_BYTES),
            (resource.RLIMIT_CPU, _CPU_SECS),
            (resource.RLIMIT_FSIZE, _FSIZE_BYTES),
            (getattr(resource, "RLIMIT_NPROC", None), _NPROC),
        ):
            if res is None:
                continue
            try:
                resource.setrlimit(res, (val, val))
            except Exception:
                pass

    return _apply


def _normalize(output: str) -> str:
    """Strip trailing whitespace from each line and trim the whole block."""
    return "\n".join(line.rstrip() for line in output.strip().splitlines())


def _script_path(tmpdir: str) -> str:
    return os.path.join(tmpdir, _SCRIPT_NAME)


def _cmd(script: str) -> List[str]:
    """Command line to run a student script unbuffered."""
    return [PYTHON, "-u", script]


def _friendly_syntax_error(exc: SyntaxError) -> str:
    """Render a Python SyntaxError the way the interpreter would, minus the path."""
    line = exc.lineno or 0
    msg = exc.msg or "invalid syntax"
    text = (exc.text or "").rstrip("\n")
    caret = ""
    if text:
        stripped = text.strip()
        caret = "\n    " + stripped
        if exc.offset:
            indent = len(text) - len(text.lstrip())
            caret += "\n    " + " " * max(0, (exc.offset - 1) - indent) + "^"
    kind = type(exc).__name__  # SyntaxError / IndentationError / TabError
    return f"{kind}: {msg} (line {line}){caret}"


def compile_code(src: str, tmpdir: str, force_unbuffered: bool = False) -> tuple[str, str]:
    """
    "Compile" Python source. Python is interpreted, so this only writes the file
    and validates its syntax with ``compile()`` (which parses but does not run).

    Returns (script_path, error_message). script_path is "" on a syntax error.

    force_unbuffered is accepted for API compatibility with the old C runner; we
    always run with ``-u`` so it has no effect here.
    """
    script = _script_path(tmpdir)
    with open(script, "w", encoding="utf-8") as f:
        f.write(src)

    try:
        compile(src, _SCRIPT_NAME, "exec")
    except SyntaxError as e:
        logger.info(f"Syntax error in submission: {e}")
        return "", _friendly_syntax_error(e)
    except Exception as e:  # noqa: BLE001 — anything else odd about the source
        return "", f"{type(e).__name__}: {e}"

    return script, ""  # no warnings phase for Python


def run_once(exe: str, input_data: str, time_limit: float = 5.0) -> Dict:
    """Run the script with given input. Returns {status, output, time_ms, mem_kb}.

    ``exe`` is the path to the student's .py file (kept named for API parity)."""
    if os.name == "posix":
        return _run_posix(exe, input_data, time_limit)
    return _run_simple(exe, input_data, time_limit)


def _run_simple(exe, input_data, time_limit):
    """Windows / fallback path (no peak-memory measurement)."""
    start = time.monotonic()
    try:
        proc = subprocess.run(
            _cmd(exe), input=input_data, capture_output=True, text=True,
            timeout=time_limit, preexec_fn=_limit_preexec(),
        )
        elapsed = (time.monotonic() - start) * 1000
        if proc.returncode != 0:
            return {"status": "Runtime Error", "output": proc.stderr[:500], "time_ms": elapsed, "mem_kb": None}
        return {"status": "ok", "output": _normalize(proc.stdout)[:_MAX_OUTPUT], "time_ms": elapsed, "mem_kb": None}
    except subprocess.TimeoutExpired:
        return {"status": "Time Limit Exceeded", "output": "", "time_ms": time_limit * 1000, "mem_kb": None}


def _run_posix(exe, input_data, time_limit):
    """POSIX path: measures peak RSS via os.wait4 (ru_maxrss, KB on Linux)."""
    proc = subprocess.Popen(
        _cmd(exe), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        preexec_fn=_limit_preexec(), start_new_session=True,
    )
    out_chunks, err_chunks = [], []

    def reader(stream, sink):
        try:
            for chunk in iter(lambda: stream.read(65536), b""):
                sink.append(chunk)
        except Exception:
            pass

    t_out = threading.Thread(target=reader, args=(proc.stdout, out_chunks), daemon=True)
    t_err = threading.Thread(target=reader, args=(proc.stderr, err_chunks), daemon=True)
    t_out.start()
    t_err.start()

    timed_out = {"v": False}

    def killer():
        timed_out["v"] = True
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

    timer = threading.Timer(time_limit, killer)
    timer.start()
    try:
        if input_data:
            proc.stdin.write(input_data.encode())
        proc.stdin.close()
    except Exception:
        pass

    start = time.monotonic()
    try:
        _, status, ru = os.wait4(proc.pid, 0)
    except ChildProcessError:
        status, ru = 0, None
    elapsed = (time.monotonic() - start) * 1000
    timer.cancel()
    t_out.join(timeout=1)
    t_err.join(timeout=1)

    out = b"".join(out_chunks).decode("utf-8", "replace")
    err = b"".join(err_chunks).decode("utf-8", "replace")
    mem_kb = int(ru.ru_maxrss) if ru else None  # Linux reports KB

    if timed_out["v"]:
        return {"status": "Time Limit Exceeded", "output": "", "time_ms": time_limit * 1000, "mem_kb": mem_kb}
    if not (os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0):
        logger.info(f"Runtime error for {exe}: {err[:200]}")
        return {"status": "Runtime Error", "output": err[:500], "time_ms": elapsed, "mem_kb": mem_kb}
    return {"status": "ok", "output": _normalize(out)[:_MAX_OUTPUT], "time_ms": elapsed, "mem_kb": mem_kb}


def judge_submission(code: str, test_cases: List[Dict], time_limit: float = 5.0) -> Dict:
    """
    Full judge: validate syntax once, run all test cases, return verdict.

    Each item in `test_cases` must have: id, input_data, expected_output, is_hidden.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        exe, compile_error = compile_code(code, tmpdir)
        if not exe:
            return {
                "status": "Compilation Error",
                "error": compile_error,
                "results": [],
                "passed": 0,
                "total": len(test_cases),
                "score": 0.0,
                "execution_time": 0.0,
            }

        results = []
        passed = 0
        max_time = 0.0

        for tc in test_cases:
            run = run_once(exe, tc.get("input_data", ""), time_limit)
            expected = _normalize(tc.get("expected_output", ""))
            actual = run["output"]
            tc_status = run["status"]

            if tc_status == "ok":
                tc_status = "Passed" if actual == expected else "Failed"
                if tc_status == "Passed":
                    passed += 1

            max_time = max(max_time, run["time_ms"])
            results.append(
                {
                    "test_case_id": tc.get("id"),
                    "status": tc_status,
                    "actual_output": actual,
                    "execution_time": run["time_ms"],
                    "is_hidden": tc.get("is_hidden", False),
                }
            )

        total = len(test_cases)
        score = round((passed / total) * 100, 2) if total else 0.0

        # Determine overall status
        statuses = {r["status"] for r in results}
        if passed == total:
            overall = "Accepted"
        elif "Time Limit Exceeded" in statuses:
            overall = "Time Limit Exceeded"
        elif "Runtime Error" in statuses:
            overall = "Runtime Error"
        else:
            overall = "Wrong Answer"

        return {
            "status": overall,
            "error": "",
            "results": results,
            "passed": passed,
            "total": total,
            "score": score,
            "execution_time": max_time,
        }


# ──────────────────────── Code check (static analysis) ─────────────────────
# Python has no manual memory management, so the C platform's AddressSanitizer
# "memory check" is replaced by a beginner-friendly static analysis pass using
# pyflakes (undefined names, unused imports/variables, unreachable code, …)
# plus a normal run. The endpoint/shape are kept for API compatibility.

# Map common pyflakes message fragments to friendly explanations.
_FLAKE_HELP = [
    (re.compile(r"undefined name '([^']+)'"),
     lambda m: f"You used '{m.group(1)}' before defining it (or misspelled it). Define it first."),
    (re.compile(r"local variable '([^']+)' .*assigned to but never used"),
     lambda m: f"You created '{m.group(1)}' but never used it — dead code, or a typo where you use it."),
    (re.compile(r"'([^']+)' imported but unused"),
     lambda m: f"You imported '{m.group(1)}' but never used it. Remove the import or use it."),
    (re.compile(r"imported but unused"),
     lambda m: "This import is never used. Remove it or use it."),
    (re.compile(r"redefinition of unused '([^']+)'"),
     lambda m: f"'{m.group(1)}' is defined twice; the first definition is never used."),
    (re.compile(r"f-string is missing placeholders"),
     lambda m: "This f-string has no {…} placeholders — did you forget the braces?"),
    (re.compile(r"local variable '([^']+)' referenced before assignment"),
     lambda m: f"You read '{m.group(1)}' before giving it a value on that path."),
    (re.compile(r"unable to detect undefined names"),
     lambda m: "A 'from module import *' hides which names exist — import only what you need."),
]


def _help_for(msg: str) -> str:
    for pat, fn in _FLAKE_HELP:
        m = pat.search(msg)
        if m:
            return fn(m)
    return msg


def _parse_pyflakes(text: str, script_name: str) -> List[Dict]:
    """Turn pyflakes stdout into a small list of findings (with line numbers)."""
    findings = []
    for raw in (text or "").splitlines():
        # Format: "<path>:<line>:<col> message"  (col is optional on older versions)
        m = re.match(r"^.*?:(\d+)(?::\d+)?:\s*(.+)$", raw.strip())
        if not m:
            continue
        line = int(m.group(1))
        msg = m.group(2).strip()
        findings.append({
            "type": "lint",
            "line": line,
            "title": msg,
            "help": _help_for(msg),
        })
    # de-dupe by (line, title)
    seen, out = set(), []
    for f in findings:
        key = (f["line"], f["title"])
        if key not in seen:
            seen.add(key)
            out.append(f)
    return out


def memcheck(code: str, input_data: str = "", time_limit: float = 8.0) -> Dict:
    """
    Static "Code Check" for Python: validate syntax, run pyflakes for common
    mistakes (undefined names, unused imports/variables, etc.), and run the
    program once. Returns {status, clean, output, report, findings}.

    (Named ``memcheck`` for API compatibility with the original C platform.)
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        script = _script_path(tmpdir)
        with open(script, "w", encoding="utf-8") as f:
            f.write(code)

        # 1) Syntax gate (compile only — does not execute).
        try:
            compile(code, _SCRIPT_NAME, "exec")
        except SyntaxError as e:
            return {"status": "Compilation Error", "clean": False, "output": "", "findings": [],
                    "report": _friendly_syntax_error(e)}

        # 2) Static analysis with pyflakes.
        findings: List[Dict] = []
        report = ""
        note = None
        try:
            pf = subprocess.run([PYTHON, "-m", "pyflakes", script],
                                capture_output=True, text=True, timeout=20)
            combined = (pf.stdout or "") + (pf.stderr or "")
            if "No module named pyflakes" in combined:
                note = "Install pyflakes on the server for static code checks."
            else:
                report = combined
                findings = _parse_pyflakes(pf.stdout, _SCRIPT_NAME)
        except FileNotFoundError:
            note = "Python interpreter not found on the server."
        except subprocess.TimeoutExpired:
            note = "Static analysis timed out."

        # 3) Run once so the student also sees the program output.
        run = run_once(script, input_data or "", time_limit)
        out = run.get("output", "")
        if run.get("status") == "Runtime Error":
            # Surface the traceback as a finding too.
            tb = out.strip().splitlines()
            last = tb[-1] if tb else "Runtime error"
            findings.append({"type": "runtime", "line": None, "title": last,
                             "help": "Your program crashed at runtime. Read the traceback above for the exact line."})
            out = ""

        clean = not findings
        result = {
            "status": "ok",
            "clean": clean,
            "output": _normalize(out)[:_MAX_OUTPUT],
            "report": report[:8000],
            "findings": findings,
        }
        if note:
            result["note"] = note
        return result
