"""AI problem generation + student tutor via Cerebras."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import schemas
from ai_service import chat_completion, generate_python_problem
from auth import get_admin_user, get_current_user

router = APIRouter()


@router.post("/generate-problem")
async def generate_problem(
    payload: schemas.AIGenerateRequest,
    _admin=Depends(get_admin_user),
):
    try:
        result = await generate_python_problem(
            topic=payload.topic,
            difficulty=payload.difficulty,
            extra=payload.description,
        )
        return result
    except Exception as exc:
        raise HTTPException(502, f"AI generation failed: {exc}")


class TutorRequest(BaseModel):
    question: str
    problem_title: str = ""
    problem_description: str = ""
    code: str = ""


@router.post("/tutor")
async def tutor(payload: TutorRequest, _user=Depends(get_current_user)):
    """A Python tutor that gives hints/explanations — never the full solution."""
    system = (
        "You are a friendly, concise Python programming tutor on a learning platform. "
        "Guide the student to figure it out themselves: give concepts, targeted "
        "hints, and at most a few illustrative lines of code — NEVER a complete "
        "working solution. If they share buggy code, point at the likely problem "
        "and explain WHY, but let them write the fix. Be encouraging and brief. "
        "Use plain text (short paragraphs / bullet points), no large code dumps."
    )

    parts = []
    if payload.problem_title or payload.problem_description:
        parts.append(f"Problem: {payload.problem_title}\n{payload.problem_description}".strip())
    if payload.code.strip():
        parts.append(f"Student's current code:\n```python\n{payload.code.strip()}\n```")
    parts.append(f"Student's question: {payload.question.strip()}")
    user = "\n\n".join(parts)

    try:
        answer = await chat_completion(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=700,
            temperature=0.5,
        )
        return {"answer": answer.strip()}
    except Exception as exc:
        raise HTTPException(502, f"AI tutor unavailable: {exc}")
