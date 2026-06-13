"""Curated beginner challenges, seeded on first startup when the table is empty."""
import models

# ── Predict-the-output: short, self-contained snippets (no stdin) ───────────
_PREDICT = [
    {
        "title": "Integer division",
        "topic": "basics", "difficulty": "easy",
        "snippet": "a = 7\nb = 2\nprint(a // b)\nprint(a % b)",
        "expected_output": "3\n1",
        "explanation": "// is floor (integer) division: 7 // 2 = 3, and 7 % 2 = 1 (the remainder). Plain / would give 3.5.",
    },
    {
        "title": "ord and chr",
        "topic": "basics", "difficulty": "easy",
        "snippet": "c = 'A'\nprint(chr(ord(c) + 1))\nprint(ord(c))",
        "expected_output": "B\n65",
        "explanation": "ord('A') is its Unicode code point, 65. ord(c) + 1 is 66, and chr(66) is 'B'.",
    },
    {
        "title": "Increment with +=",
        "topic": "basics", "difficulty": "easy",
        "snippet": "i = 5\ni += 1\nprint(i)\ni += 1\nprint(i)",
        "expected_output": "6\n7",
        "explanation": "Python has no ++ operator; use i += 1. i goes 5 → 6 (printed), then 6 → 7 (printed).",
    },
    {
        "title": "True division vs floor",
        "topic": "basics", "difficulty": "medium",
        "snippet": "print(5 / 2)\nprint(5 // 2)",
        "expected_output": "2.5\n2",
        "explanation": "/ always gives a float in Python: 5 / 2 = 2.5. // floors the result: 5 // 2 = 2.",
    },
    {
        "title": "for-loop with range",
        "topic": "loops", "difficulty": "easy",
        "snippet": 'for i in range(3):\n    print(i, end=" ")',
        "expected_output": "0 1 2",
        "explanation": "range(3) yields 0, 1, 2 (it stops before 3). end=\" \" keeps them on one line.",
    },
    {
        "title": "while with break",
        "topic": "loops", "difficulty": "medium",
        "snippet": "n = 0\nwhile True:\n    if n == 4:\n        break\n    n += 2\nprint(n)",
        "expected_output": "4",
        "explanation": "n goes 0 → 2 → 4; when it equals 4 the break stops the loop, so 4 is printed.",
    },
    {
        "title": "List indexing",
        "topic": "lists", "difficulty": "easy",
        "snippet": "a = [10, 20, 30, 40]\nprint(a[0] + a[3])",
        "expected_output": "50",
        "explanation": "Lists are 0-indexed: a[0] is 10 and a[3] is 40, so the sum is 50.",
    },
    {
        "title": "len and slicing",
        "topic": "strings", "difficulty": "medium",
        "snippet": 's = "hello"\nprint(len(s))\nprint(s[1:4])',
        "expected_output": "5\nell",
        "explanation": "len(s) counts the characters (5). s[1:4] slices from index 1 up to (not including) 4, giving 'ell'.",
    },
    {
        "title": "List aliasing",
        "topic": "lists", "difficulty": "medium",
        "snippet": "a = [1, 2, 3]\nb = a\nb[0] = 99\nprint(a[0])",
        "expected_output": "99",
        "explanation": "b = a does NOT copy the list — both names point to the SAME list, so changing b[0] also changes a[0]. Use a.copy() for an independent copy.",
    },
    {
        "title": "Conditional ladder",
        "topic": "conditionals", "difficulty": "easy",
        "snippet": 'm = 75\nif m >= 90:\n    print("A")\nelif m >= 60:\n    print("B")\nelse:\n    print("C")',
        "expected_output": "B",
        "explanation": "75 is not >= 90, but it is >= 60, so the elif branch runs and prints B.",
    },
]

# ── Fix-the-bug: buggy starter + the input it's run with + correct output ───
_FIXBUG = [
    {
        "title": "Sum of two numbers",
        "topic": "basics", "difficulty": "easy",
        "snippet": "a = input()\nb = input()\nprint(a + b)   # bug here",
        "test_input": "4\n6",
        "expected_output": "10",
        "explanation": "input() returns text, so a + b joins the strings '4' + '6' = '46'. Convert first: a = int(input()) and b = int(input()), then a + b is 10.",
    },
    {
        "title": "Print 1 to 5",
        "topic": "loops", "difficulty": "easy",
        "snippet": 'for i in range(1, 5):   # bug here\n    print(i, end=" ")',
        "test_input": "",
        "expected_output": "1 2 3 4 5",
        "explanation": "range(1, 5) stops at 4. Use range(1, 6) so 5 is included.",
    },
    {
        "title": "Fix the indentation",
        "topic": "basics", "difficulty": "easy",
        "snippet": "x = 9\n    print(x)   # bug: this line is indented for no reason",
        "test_input": "",
        "expected_output": "9",
        "explanation": "Python uses indentation to group code. print(x) is indented for no reason, causing an IndentationError. Remove the leading spaces so it lines up with x = 9.",
    },
    {
        "title": "Largest of two",
        "topic": "conditionals", "difficulty": "easy",
        "snippet": "a = 3\nb = 8\nmaximum = a\nif b > maximum:\n    maximum = a        # bug here\nprint(maximum)",
        "test_input": "",
        "expected_output": "8",
        "explanation": "When b is the larger value you must store b, not a. Change 'maximum = a' to 'maximum = b' so maximum ends up as 8.",
    },
    {
        "title": "Sum of a list",
        "topic": "lists", "difficulty": "medium",
        "snippet": "nums = [2, 4, 6, 8, 10]\ntotal = 0\nfor i in range(6):   # bug here\n    total += nums[i]\nprint(total // 5)",
        "test_input": "",
        "expected_output": "6",
        "explanation": "range(6) makes i reach 5, but nums[5] is out of range (valid indices are 0..4) — an IndexError. Use range(5), or better 'for x in nums'. The average is 30 // 5 = 6.",
    },
    {
        "title": "Reverse a string",
        "topic": "strings", "difficulty": "medium",
        "snippet": 's = "abc"\nfor i in range(len(s)):\n    print(s[i], end="")   # bug here: prints forwards\nprint()',
        "test_input": "",
        "expected_output": "cba",
        "explanation": "This prints the string forwards. To reverse it, index from the end: print(s[len(s) - 1 - i], end=\"\"). (Or simply print(s[::-1]).)",
    },
]


def seed_if_empty(db):
    """Insert the curated set once (idempotent — only when no challenges exist)."""
    if db.query(models.Challenge).first():
        return 0
    n = 0
    for item in _PREDICT:
        db.add(models.Challenge(kind="predict", is_active=True, **item))
        n += 1
    for item in _FIXBUG:
        db.add(models.Challenge(kind="fixbug", is_active=True, **item))
        n += 1
    db.commit()
    return n
