"""
Cerebras AI service with multi-key round-robin + fallback.

Keys are read from env: CEREBRAS_API_KEY_1 … CEREBRAS_API_KEY_N (up to 20).
On 429 or transient error the next key is tried automatically.
"""
import asyncio
import json
import os
import random
import re
from typing import List, Optional

import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

_API_URL = "https://api.cerebras.ai/v1/chat/completions"
_MODEL = os.getenv("CEREBRAS_MODEL", "llama-3.3-70b")


def _load_keys() -> List[str]:
    keys: List[str] = []
    for i in range(1, 21):
        k = os.getenv(f"CEREBRAS_API_KEY_{i}", "").strip()
        if k:
            keys.append(k)
    return keys


async def chat_completion(
    messages: list,
    max_tokens: int = 2048,
    temperature: float = 0.7,
) -> str:
    """Call Cerebras chat completion API, cycling through available keys."""
    keys = _load_keys()
    if not keys:
        raise RuntimeError("No Cerebras API keys found in environment.")

    # Shuffle so multiple workers don't always hammer the same key
    shuffled = keys.copy()
    random.shuffle(shuffled)

    last_error: str = "Unknown error"

    async with httpx.AsyncClient(timeout=40.0) as client:
        for api_key in shuffled:
            try:
                resp = await client.post(
                    _API_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": _MODEL,
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                    },
                )
                if resp.status_code == 200:
                    return resp.json()["choices"][0]["message"]["content"]
                elif resp.status_code == 429:
                    last_error = "Rate limit exceeded"
                    await asyncio.sleep(0.3)
                    continue
                else:
                    last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
                    continue
            except (httpx.TimeoutException, httpx.ConnectError) as exc:
                last_error = str(exc)
                continue

    raise RuntimeError(f"All Cerebras API keys failed. Last error: {last_error}")


async def generate_python_problem(
    topic: str,
    difficulty: str = "medium",
    extra: Optional[str] = None,
) -> dict:
    """Ask the AI to create a complete Python programming problem with test cases."""

    system = (
        "You are an expert Python programming problem author for a competitive coding platform. "
        "Always return valid JSON only – no markdown fences, no commentary."
    )

    prompt = f"""Create a Python programming problem. The solution must read input from stdin (e.g. with input()) and print the answer to stdout.
Topic: {topic}
Difficulty: {difficulty}
{('Additional context: ' + extra) if extra else ''}

Return a single JSON object with these exact keys:
{{
  "title": "...",
  "description": "Full problem statement (plain text, may include newlines)",
  "input_format": "...",
  "output_format": "...",
  "constraints": "...",
  "topics": "{topic}",
  "difficulty": "{difficulty}",
  "test_cases": [
    {{"input_data": "...", "expected_output": "...", "is_hidden": false}},
    {{"input_data": "...", "expected_output": "...", "is_hidden": false}},
    {{"input_data": "...", "expected_output": "...", "is_hidden": false}},
    {{"input_data": "...", "expected_output": "...", "is_hidden": true}},
    {{"input_data": "...", "expected_output": "...", "is_hidden": true}},
    {{"input_data": "...", "expected_output": "...", "is_hidden": true}}
  ]
}}"""

    content = await chat_completion(
        [{"role": "system", "content": system}, {"role": "user", "content": prompt}]
    )

    # Robust JSON extraction
    match = re.search(r"\{.*\}", content, re.DOTALL)
    if match:
        return json.loads(match.group())
    raise ValueError("AI response did not contain valid JSON")
