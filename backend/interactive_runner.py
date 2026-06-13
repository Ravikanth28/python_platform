"""
Interactive program runner.

Runs a student's Python script live so prompts appear before ``input()`` reads,
just like running it in a real terminal.

Best experience = a real pseudo-terminal (PTY):
  • POSIX (Linux/Render) -> stdlib `pty`
  • Windows              -> ConPTY via `pywinpty`  (pip install pywinpty)

If pywinpty can't be imported on Windows we DON'T hard-fail — we fall back to a
plain pipe. The script is launched with ``python -u`` (unbuffered), so even over
a plain pipe every ``print`` streams immediately and prompts show live; the only
difference is there's no terminal echo (the frontend echoes typed input itself
when it sees the 'pipe' mode in the 'started' message).
"""
import os
import subprocess
import sys

IS_WIN = os.name == "nt"

# Same interpreter that runs the backend.
PYTHON = sys.executable or "python3"


def _cmd(script):
    """Command line to run a student script unbuffered."""
    return [PYTHON, "-u", script]


class _PosixPty:
    def __init__(self, script):
        import pty
        from code_runner import _limit_preexec

        limit = _limit_preexec()

        def _pre():
            os.setsid()
            if limit:
                limit()

        self.master, slave = pty.openpty()
        self.proc = subprocess.Popen(
            _cmd(script), stdin=slave, stdout=slave, stderr=slave,
            preexec_fn=_pre, close_fds=True,
        )
        os.close(slave)

    def read(self):
        try:
            data = os.read(self.master, 4096)
        except OSError:
            return ""
        return data.decode("utf-8", "replace")

    def write(self, text):
        try:
            os.write(self.master, text.encode("utf-8"))
        except OSError:
            pass

    def wait_returncode(self):
        try:
            return self.proc.wait(timeout=5)
        except Exception:
            return self.proc.poll()

    def close(self):
        try:
            import signal
            os.killpg(os.getpgid(self.proc.pid), signal.SIGKILL)
        except Exception:
            try:
                self.proc.kill()
            except Exception:
                pass
        try:
            os.close(self.master)
        except Exception:
            pass


class _WinPty:
    def __init__(self, script):
        from winpty import PtyProcess  # type: ignore

        self.p = PtyProcess.spawn(_cmd(script))

    def read(self):
        try:
            return self.p.read()
        except EOFError:
            return ""

    def write(self, text):
        try:
            self.p.write(text)
        except Exception:
            pass

    def wait_returncode(self):
        try:
            return self.p.exitstatus
        except Exception:
            return None

    def close(self):
        try:
            if self.p.isalive():
                self.p.terminate(force=True)
        except Exception:
            pass


class _PipeFallback:
    """
    No-PTY fallback (Windows without a working pywinpty).

    The script runs under ``python -u`` so each print streams immediately over a
    plain pipe — giving live, line-by-line behaviour. There's no terminal echo
    here, so the frontend echoes typed input itself (it switches on the 'pipe'
    mode reported in the 'started' message).
    """

    def __init__(self, script):
        self.proc = subprocess.Popen(
            _cmd(script), stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, bufsize=0,
        )
        self._fd = self.proc.stdout.fileno()

    def read(self):
        try:
            data = os.read(self._fd, 4096)  # returns as soon as ≥1 byte is available
        except OSError:
            return ""
        if not data:
            return ""
        return data.decode("utf-8", "replace")

    def write(self, text):
        try:
            self.proc.stdin.write(text.encode("utf-8"))
            self.proc.stdin.flush()
        except Exception:
            pass

    def wait_returncode(self):
        try:
            return self.proc.wait(timeout=5)
        except Exception:
            return self.proc.poll()

    def close(self):
        try:
            self.proc.kill()
        except Exception:
            pass


def _winpty_import_error() -> str:
    """Return why `import winpty` fails in THIS interpreter, or '' if it works."""
    try:
        import winpty  # noqa: F401
        return ""
    except Exception as e:  # ImportError, DLL load error, etc.
        return f"{type(e).__name__}: {e}"


def make_session(script):
    """
    Returns (session, mode, note).
      script: path to the student's .py file.
      mode: 'pty'  -> true terminal-style line-by-line
            'pipe' -> degraded fallback (still usable)
      note: a message to surface in the console (only set for 'pipe').
    """
    if IS_WIN:
        if _winpty_import_error():
            # pywinpty unavailable/broken — the pipe fallback still streams live
            # because the program runs unbuffered. No scary banner needed.
            return _PipeFallback(script), "pipe", ""
        return _WinPty(script), "pty", ""
    return _PosixPty(script), "pty", ""
