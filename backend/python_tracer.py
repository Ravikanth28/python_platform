"""
Step-by-step execution tracer for Python, via ``sys.settrace``.

The student's code is run in a separate Python process under a small harness
that records, at every line, the current line number, the call stack, and all
in-scope local variables. Program stdout is captured separately so the trace
never pollutes it. The emitted trace matches the shape the Code Visualizer
expects: steps = [{line, func, locals, stack}].

Running in a subprocess (rather than in-process) keeps a buggy or long-running
student program from touching the backend, and a hard step cap + wall-clock
timeout bound infinite loops.
"""
import json
import os
import subprocess
import sys

PYTHON = sys.executable or "python3"
MAX_STEPS = 500

# Harness executed in the child interpreter. argv: <src_file> <stdin_file>.
# It traces only frames whose filename is the sentinel "<user>", so the harness
# itself and library code are never recorded.
_HARNESS = r'''
import sys, json, io, traceback

SRC_FILE = sys.argv[1]
IN_FILE  = sys.argv[2]
MAX      = 500
USER     = "<user>"

with open(SRC_FILE, encoding="utf-8") as f:
    src = f.read()

steps = []

class _Stop(Exception):
    pass

def _ser(v):
    try:
        r = repr(v)
    except Exception:
        return "<unrepr>"
    return r if len(r) <= 200 else r[:200] + "..."

def _locals(frame):
    out = {}
    for k, v in list(frame.f_locals.items()):
        if k.startswith("__") and k.endswith("__"):
            continue
        out[k] = _ser(v)
    return out

def tracer(frame, event, arg):
    if frame.f_code.co_filename != USER:
        return tracer
    # Return the tracer on 'call' so we keep getting 'line' events for that
    # frame, but only RECORD 'line' events (the module-entry 'call' reports a
    # bogus line 0, and per-line steps are what the visualizer wants).
    if event == "line":
        if len(steps) >= MAX:
            raise _Stop()
        stack = []
        f = frame
        while f is not None:
            if f.f_code.co_filename == USER:
                stack.append({"func": f.f_code.co_name, "line": f.f_lineno})
            f = f.f_back
        stack.reverse()
        steps.append({
            "line": frame.f_lineno,
            "func": frame.f_code.co_name,
            "locals": _locals(frame),
            "stack": stack,
        })
    return tracer

try:
    code_obj = compile(src, USER, "exec")
except SyntaxError as e:
    print("TRACE_JSON:" + json.dumps({
        "steps": [], "output": "",
        "error": "%s: %s (line %s)" % (type(e).__name__, e.msg, e.lineno),
        "status": "Compilation Error",
    }))
    sys.exit(0)

try:
    sys.stdin = open(IN_FILE, encoding="utf-8")
except Exception:
    pass

prog_out = io.StringIO()
real_stdout = sys.stdout
err = None
g = {"__name__": "__main__"}
sys.stdout = prog_out
sys.settrace(tracer)
try:
    exec(code_obj, g)
except _Stop:
    err = None
except SystemExit:
    pass
except Exception as e:
    err = "".join(traceback.format_exception_only(type(e), e)).strip()
finally:
    sys.settrace(None)
    sys.stdout = real_stdout

print("TRACE_JSON:" + json.dumps({
    "steps": steps, "output": prog_out.getvalue()[:65536], "error": err,
}))
'''


def trace(code, stdin, tmpdir):
    """Returns dict like the old C tracer: {status, steps, output, error}."""
    src = os.path.join(tmpdir, "viz_src.py")
    inp = os.path.join(tmpdir, "viz_in.txt")
    harness = os.path.join(tmpdir, "viz_harness.py")
    with open(src, "w", encoding="utf-8") as f:
        f.write(code)
    with open(inp, "w", encoding="utf-8") as f:
        f.write(stdin or "")
    with open(harness, "w", encoding="utf-8") as f:
        f.write(_HARNESS)

    try:
        run = subprocess.run(
            [PYTHON, "-u", harness, src, inp],
            capture_output=True, text=True, timeout=12,
        )
    except subprocess.TimeoutExpired:
        return {"status": "Timeout",
                "error": "Tracing timed out (program ran too long or looped).",
                "steps": [], "output": ""}

    steps, prog_out, trace_err, status = [], "", None, "ok"
    for line in (run.stdout or "").splitlines():
        if line.startswith("TRACE_JSON:"):
            try:
                data = json.loads(line[len("TRACE_JSON:"):])
                steps = data.get("steps", []) or []
                prog_out = data.get("output", "") or ""
                trace_err = data.get("error")
                status = data.get("status", "ok")
            except Exception:
                pass

    if status == "Compilation Error":
        return {"status": "Compilation Error", "error": trace_err or "Syntax error.",
                "steps": [], "output": ""}

    if not steps and not prog_out:
        msg = trace_err or (run.stderr[:300] if run.stderr else "Could not trace this program.")
        return {"status": "Error", "error": msg, "steps": [], "output": ""}

    return {"status": "ok", "steps": steps[:MAX_STEPS], "output": prog_out[:65536], "error": trace_err}
