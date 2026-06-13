from __future__ import annotations

import datetime
from typing import List, Optional

from pydantic import BaseModel


# ──────────────────────────── Auth ─────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: str
    full_name: Optional[str] = None
    password: str
    role: str = "student"


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str]
    phone: Optional[str] = None
    role: str
    is_active: bool
    avatar_color: str
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class AdminPasswordReset(BaseModel):
    new_password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# ──────────────────────────── Notes ────────────────────────────────────────

class NoteCreate(BaseModel):
    title: str
    description: Optional[str] = None
    upload_type: str                       # pdf | docx | youtube | link
    yt_link: Optional[str] = None
    external_link: Optional[str] = None
    is_for_all: bool = True
    assigned_user_ids: Optional[List[int]] = []


class NoteResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    upload_type: str
    file_url: Optional[str]
    yt_link: Optional[str]
    external_link: Optional[str]
    file_size: Optional[int]
    is_for_all: bool
    created_at: datetime.datetime
    view_count: int = 0
    download_count: int = 0

    model_config = {"from_attributes": True}


# ──────────────────────────── Problems ─────────────────────────────────────

class TestCaseCreate(BaseModel):
    input_data: str
    expected_output: str
    is_hidden: bool = False
    order_index: int = 0


class TestCaseResponse(BaseModel):
    id: int
    input_data: str
    expected_output: str
    is_hidden: bool
    order_index: int

    model_config = {"from_attributes": True}


class ProblemCreate(BaseModel):
    title: str
    description: str
    topics: Optional[str] = None
    starter_code: Optional[str] = None
    mode: str                              # practice | test
    difficulty: str = "medium"
    start_time: Optional[datetime.datetime] = None
    end_time: Optional[datetime.datetime] = None
    duration: Optional[int] = None
    is_for_all: bool = True
    assigned_user_ids: Optional[List[int]] = []
    test_cases: Optional[List[TestCaseCreate]] = []
    # Proctoring
    tab_switch_detect: bool = False
    copy_paste_disable: bool = False
    f12_disable: bool = False
    fullscreen_required: bool = False
    window_switch_detect: bool = False
    block_paste: bool = False


class ProblemResponse(BaseModel):
    id: int
    title: str
    description: str
    topics: Optional[str]
    starter_code: Optional[str] = None
    mode: str
    difficulty: str
    start_time: Optional[datetime.datetime]
    end_time: Optional[datetime.datetime]
    duration: Optional[int]
    is_active: bool
    is_for_all: bool
    created_at: datetime.datetime
    tab_switch_detect: bool
    copy_paste_disable: bool
    f12_disable: bool
    fullscreen_required: bool
    window_switch_detect: bool = False
    block_paste: bool = False
    test_cases_count: int = 0

    model_config = {"from_attributes": True}


# ──────────────────────────── Submissions ──────────────────────────────────

class SubmissionCreate(BaseModel):
    problem_id: int
    code: str
    language: str = "c"
    time_taken: Optional[int] = None
    tab_switches: Optional[int] = 0


class SubmissionResultResponse(BaseModel):
    test_case_id: Optional[int]
    status: str
    actual_output: Optional[str]
    execution_time: Optional[float]
    is_hidden: bool = False

    model_config = {"from_attributes": True}


class SubmissionResponse(BaseModel):
    id: int
    problem_id: int
    user_id: int
    status: str
    score: float
    time_taken: Optional[int]
    execution_time: Optional[float]
    submitted_at: datetime.datetime
    tab_switches: int
    test_cases_passed: int
    test_cases_total: int
    results: List[SubmissionResultResponse] = []

    model_config = {"from_attributes": True}


# ──────────────────────────── Reports ──────────────────────────────────────

class ReportRow(BaseModel):
    submission_id: int
    student_name: str
    student_email: str
    problem_title: str
    mode: str
    status: str
    score: float
    time_taken: Optional[int]
    tab_switches: int
    test_cases_passed: int
    test_cases_total: int
    submitted_at: datetime.datetime

    model_config = {"from_attributes": True}


# ──────────────────────────── AI ───────────────────────────────────────────

class AIGenerateRequest(BaseModel):
    topic: str
    difficulty: str = "medium"
    description: Optional[str] = None
