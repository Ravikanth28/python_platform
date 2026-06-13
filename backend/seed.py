"""
Seed script – creates default admin + student accounts and sample data.
Run from: the backend/ directory
  py seed.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from database import Base, engine, SessionLocal
from models import (
    User, Problem, TestCase, Note,
    Class, ClassMember, Assignment, AssignmentProblem,
)
from auth import get_password_hash
import datetime

Base.metadata.create_all(bind=engine)
db = SessionLocal()

def upsert_user(username, email, full_name, password, role, color):
    u = db.query(User).filter(User.username == username).first()
    if u:
        print(f"  [skip] user '{username}' already exists")
        return u
    u = User(
        username=username,
        email=email,
        full_name=full_name,
        password_hash=get_password_hash(password),
        role=role,
        avatar_color=color,
        is_active=True,
    )
    db.add(u)
    db.flush()
    print(f"  [+] created {role}: {username} / {password}")
    return u

print("\n── Seeding users ──────────────────────────────────────────────────")
admin   = upsert_user("admin",    "admin@codeforge.dev",    "Platform Admin",  "Admin@123",   "admin",   "#6366f1")
student1= upsert_user("student1", "student1@codeforge.dev", "Alice Johnson",   "Student@123", "student", "#10b981")
student2= upsert_user("student2", "student2@codeforge.dev", "Bob Smith",       "Student@123", "student", "#06b6d4")
student3= upsert_user("student3", "student3@codeforge.dev", "Carol Williams",  "Student@123", "student", "#8b5cf6")

db.commit()

print("\n── Seeding notes ──────────────────────────────────────────────────")
if db.query(Note).count() == 0:
    notes_data = [
        ("Introduction to Python Programming",
         "Covers variables, data types, and input/output using print() and input().",
         "youtube", None, "https://www.youtube.com/watch?v=_uQrJ0TkZlc"),
        ("Lists & Dictionaries in Python",
         "Working with Python's core data structures: lists, dicts and sets.",
         "link", None, "https://docs.python.org/3/tutorial/datastructures.html"),
        ("Strings and String Methods",
         "String methods: len, upper, lower, strip, split, join, replace.",
         "link", None, "https://docs.python.org/3/library/stdtypes.html#string-methods"),
    ]
    for title, desc, utype, file_url, link in notes_data:
        n = Note(
            title=title, description=desc,
            upload_type=utype, file_url=file_url,
            yt_link=link if utype == "youtube" else None,
            external_link=link if utype == "link" else None,
            is_for_all=True, created_by=admin.id,
        )
        db.add(n)
        print(f"  [+] note: {title}")
    db.commit()
else:
    print("  [skip] notes already seeded")

print("\n── Seeding practice problems ───────────────────────────────────────")
if db.query(Problem).filter(Problem.mode == "practice").count() == 0:
    problems = [
        {
            "title": "Hello World",
            "description": "Write a Python program that prints exactly:\nHello, World!\n\nNo extra spaces or newlines.",
            "topics": "basics, output",
            "difficulty": "easy",
            "test_cases": [
                {"input": "", "output": "Hello, World!", "hidden": False},
            ],
        },
        {
            "title": "Sum of Two Numbers",
            "description": "Read two integers A and B from standard input (on separate lines). Print their sum.\n\nConstraints: -10^6 ≤ A, B ≤ 10^6",
            "topics": "arithmetic, input/output",
            "difficulty": "easy",
            "test_cases": [
                {"input": "3\n5",  "output": "8",   "hidden": False},
                {"input": "10\n20","output": "30",  "hidden": False},
                {"input": "-5\n3", "output": "-2",  "hidden": True},
                {"input": "1000000\n1000000","output":"2000000","hidden": True},
            ],
        },
        {
            "title": "Factorial",
            "description": "Read a non-negative integer N. Print N! (factorial of N).\n\nConstraints: 0 ≤ N ≤ 12\n\nExample:\nInput: 5\nOutput: 120",
            "topics": "loops, math",
            "difficulty": "easy",
            "test_cases": [
                {"input": "5",  "output": "120",        "hidden": False},
                {"input": "0",  "output": "1",          "hidden": False},
                {"input": "1",  "output": "1",          "hidden": True},
                {"input": "10", "output": "3628800",    "hidden": True},
                {"input": "12", "output": "479001600",  "hidden": True},
            ],
        },
        {
            "title": "Reverse a String",
            "description": "Read a single word (no spaces) and print it reversed.\n\nExample:\nInput: hello\nOutput: olleh",
            "topics": "strings, lists",
            "difficulty": "medium",
            "test_cases": [
                {"input": "hello",  "output": "olleh",  "hidden": False},
                {"input": "abcdef", "output": "fedcba", "hidden": False},
                {"input": "a",      "output": "a",      "hidden": True},
                {"input": "racecar","output": "racecar","hidden": True},
            ],
        },
    ]

    for p_data in problems:
        p = Problem(
            title=p_data["title"],
            description=p_data["description"],
            topics=p_data["topics"],
            mode="practice",
            difficulty=p_data["difficulty"],
            is_for_all=True,
            created_by=admin.id,
        )
        db.add(p)
        db.flush()
        for i, tc in enumerate(p_data["test_cases"]):
            db.add(TestCase(
                problem_id=p.id,
                input_data=tc["input"],
                expected_output=tc["output"],
                is_hidden=tc["hidden"],
                order_index=i,
            ))
        print(f"  [+] practice: {p_data['title']}")
    db.commit()
else:
    print("  [skip] practice problems already seeded")

print("\n── Seeding test problems ───────────────────────────────────────────")
if db.query(Problem).filter(Problem.mode == "test").count() == 0:
    now  = datetime.datetime.utcnow()
    start = now
    end   = now + datetime.timedelta(hours=2)
    test_p = Problem(
        title="Python Fundamentals Assessment",
        description="This is a timed proctored test covering Python programming fundamentals.\n\nRead an integer N and print whether it is Even or Odd.\n\nExample:\nInput: 4\nOutput: Even\n\nInput: 7\nOutput: Odd",
        topics="conditionals, basics",
        mode="test",
        difficulty="easy",
        duration=30,
        start_time=start,
        end_time=end,
        is_for_all=True,
        created_by=admin.id,
        tab_switch_detect=True,
        copy_paste_disable=True,
        f12_disable=True,
        fullscreen_required=False,
    )
    db.add(test_p)
    db.flush()
    for i, tc in enumerate([
        {"input": "4", "output": "Even", "hidden": False},
        {"input": "7", "output": "Odd",  "hidden": False},
        {"input": "0", "output": "Even", "hidden": True},
        {"input": "99","output": "Odd",  "hidden": True},
    ]):
        db.add(TestCase(
            problem_id=test_p.id,
            input_data=tc["input"],
            expected_output=tc["output"],
            is_hidden=tc["hidden"],
            order_index=i,
        ))
    db.commit()
    print("  [+] test: Python Fundamentals Assessment")
else:
    print("  [skip] test problems already seeded")

print("\n── Seeding classroom ──────────────────────────────────────────────")
if db.query(Class).count() == 0:
    klass = Class(name="Python Programming 101", description="Intro cohort — Fall", created_by=admin.id)
    db.add(klass)
    db.flush()
    for s in (student1, student2, student3):
        db.add(ClassMember(class_id=klass.id, user_id=s.id))

    practice = db.query(Problem).filter(Problem.mode == "practice").order_by(Problem.id).all()
    now = datetime.datetime.utcnow()
    if practice:
        a1 = Assignment(
            title="Week 1 — Basics",
            instructions="Warm up with output and arithmetic problems.",
            class_id=klass.id,
            due_date=now + datetime.timedelta(days=7),
            created_by=admin.id,
        )
        db.add(a1)
        db.flush()
        for p in practice[:2]:
            db.add(AssignmentProblem(assignment_id=a1.id, problem_id=p.id))

        a2 = Assignment(
            title="Week 2 — Loops & Strings",
            instructions="Practice factorial and string reversal.",
            class_id=klass.id,
            due_date=now + datetime.timedelta(days=14),
            created_by=admin.id,
        )
        db.add(a2)
        db.flush()
        for p in practice[2:4]:
            db.add(AssignmentProblem(assignment_id=a2.id, problem_id=p.id))
    db.commit()
    print("  [+] class 'Python Programming 101' with 3 students + 2 assignments")
else:
    print("  [skip] classroom already seeded")

db.close()
print("\n✓ Seed complete!\n")
print("┌─────────────────────────────────────────────────────────────┐")
print("│  LOGIN CREDENTIALS                                          │")
print("├──────────────┬────────────────┬────────────────────────────┤")
print("│  Role        │  Username      │  Password                  │")
print("├──────────────┼────────────────┼────────────────────────────┤")
print("│  Admin       │  admin         │  Admin@123                 │")
print("│  Student     │  student1      │  Student@123               │")
print("│  Student     │  student2      │  Student@123               │")
print("│  Student     │  student3      │  Student@123               │")
print("└──────────────┴────────────────┴────────────────────────────┘")
