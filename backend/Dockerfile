# Backend image for the Python learning platform. Student code runs on the same
# CPython interpreter that ships in the base image — no compiler toolchain needed
# (Run / Judge / interactive console / Code Visualizer are all pure Python).
FROM python:3.12-slim

WORKDIR /app

# Install Python deps first (better layer caching)
COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

# App code
COPY . .

ENV PYTHONUNBUFFERED=1

# Render injects $PORT; default to 8000 for local docker runs
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
