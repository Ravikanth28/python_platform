"""
Detailed interactive-lesson curriculum.

Every lesson follows the SAME structure:
  2+ concept steps (200+ words each) → a runnable example → 2-3 quick checks
  → a references block (appended automatically).
"""
import json

from sqlalchemy import text

import models

# Bump whenever the curriculum content changes so it re-seeds on next start.
_CURRICULUM_VERSION = 5

_LESSONS = [
    # ───────────────────────── 1. What is Python ───────────────────────────
    {
        "title": "What is Python?",
        "topic": "basics", "order_index": 1,
        "blocks": [
            {"type": "concept", "body": "## What is Python?\n\n**Python** is a general-purpose programming language created by **Guido van Rossum** and first released in **1991**. It was designed around one big idea: **code should be easy to read and write**. More than thirty years later it is one of the most popular languages in the world — and a fantastic first language to learn.\n\nWhy is Python everywhere?\n\n- **Data science & AI** — libraries like NumPy, pandas, PyTorch and TensorFlow make Python the default language for machine learning and analytics.\n- **Web development** — frameworks like Django and FastAPI power huge websites and APIs (this very platform's backend is written in Python!).\n- **Automation & scripting** — Python is the go-to for automating boring tasks, testing, and gluing systems together.\n- **Education** — its clean, English-like syntax lets beginners focus on *problem solving* instead of fighting the language.\n\nThe real reason Python makes you productive is that it is **high-level**: it handles memory, types and many low-level details for you, so a few lines of Python can do what takes far more code in other languages. You spend your energy on *what* you want the program to do, not on bookkeeping. That readability is also why Python code is easy to share, review and maintain in teams."},
            {"type": "concept", "body": "## Interpreted, not compiled\n\nPython is an **interpreted** language, and understanding that helps everything else make sense.\n\nWhen you write Python, you create **source code** — ordinary readable text in a `.py` file. A program called the **interpreter** (the one you'll use is **CPython**) reads your code and runs it directly, line by line. You don't have a separate \"compile\" step that produces a standalone executable the way languages like C do. You just run the file and it works.\n\n(Behind the scenes Python first translates your code into compact **bytecode**, which the interpreter then executes — but this happens automatically and you never think about it.)\n\nThere are a few ground rules you'll rely on from day one:\n\n- Python is **case-sensitive**: `age`, `Age` and `AGE` are three different names.\n- Statements **do not** end with a semicolon — one statement per line is the norm.\n- **Indentation matters!** Python uses spaces at the start of a line to group code into blocks (where other languages use `{ }`). Consistent indentation isn't just style — it's part of the syntax.\n- A program simply runs from the **top of the file downward**; there's no special `main` function required for a script to start.\n\nKeep these in mind and Python will feel friendly and predictable."},
            {"type": "example", "title": "Your very first Python program — Run it", "stdin": "",
             "code": "print(\"Hello, Python! I am learning to code.\")\n"},
            {"type": "check", "mode": "mcq",
             "question": "What kind of language is Python?",
             "options": ["Compiled to a standalone .exe before running", "Interpreted — run directly by the Python interpreter", "Only used for building spreadsheets", "A type of database"],
             "answer": "Interpreted — run directly by the Python interpreter",
             "explanation": "The Python interpreter (CPython) reads and runs your source code directly, so there's no separate compile-to-executable step."},
            {"type": "check", "mode": "mcq",
             "question": "How does Python know which lines belong together in a block?",
             "options": ["By curly braces { }", "By indentation (leading spaces)", "By semicolons", "By line numbers"],
             "answer": "By indentation (leading spaces)",
             "explanation": "Python uses indentation as real syntax to group code into blocks — unlike many languages that use { }."},
            {"type": "check", "mode": "mcq",
             "question": "Are `total` and `Total` the same variable name in Python?",
             "options": ["Yes, Python ignores capitalization", "No — Python is case-sensitive, so they're different"],
             "answer": "No — Python is case-sensitive, so they're different",
             "explanation": "Python treats uppercase and lowercase letters as distinct, so `total` and `Total` are two separate names."},
        ],
    },
    # ───────────────────────── 2. How a program runs ───────────────────────
    {
        "title": "How a Python Program Runs",
        "topic": "basics", "order_index": 2,
        "blocks": [
            {"type": "concept", "body": "## The anatomy of a Python program\n\nPython programs are refreshingly simple. There's no boilerplate to memorise — you just write statements. Read this one carefully:\n\n```python\n# 1. a comment — notes for humans, ignored by Python\nname = \"Sam\"          # 2. create a variable\nprint(\"Hello!\")       # 3. a statement: call the print function\nprint(name)           # 4. print the variable's value\n```\n\nLet's break down each piece:\n\n- **`# ...`** is a **comment**. Everything after a `#` on a line is ignored by Python — use comments to explain *why* your code does something.\n- **`name = \"Sam\"`** is an **assignment statement**: it creates a variable called `name` and stores the text `\"Sam\"` in it. Notice you don't declare a type first.\n- **`print(...)`** is a **function call**. `print` is built in and writes its argument to the screen, followed by a newline.\n- Each line is a single **statement**, and statements run **top to bottom**. There are no semicolons and no `main` function — the file just runs from the first line.\n\nThat's the whole skeleton. The simplicity is deliberate: Python wants you reading and writing real logic immediately."},
            {"type": "concept", "body": "## From your code to a running program\n\nWhen you press **Run**, here's what actually happens:\n\n1. **Reading & parsing** — the interpreter reads your `.py` file and checks that the syntax is valid (correct indentation, matched brackets, etc.). If something is wrong it stops with a **SyntaxError** before running anything.\n2. **Compiling to bytecode** — your code is translated into compact **bytecode**, a low-level set of instructions the Python virtual machine understands. (You may have seen `.pyc` files or a `__pycache__` folder — that's cached bytecode.)\n3. **Executing** — the **Python Virtual Machine** runs the bytecode instruction by instruction, line by line.\n\nThe key contrast with a **compiled** language (like C) is that there's no separate build step you run by hand and no standalone executable produced — you just run the source. This makes the write-run-fix loop very fast, which is great for learning and experimenting.\n\nYou can run Python two ways: as a **script** (a whole `.py` file, like here) or interactively in the **REPL** (type `python` in a terminal and enter one line at a time to see instant results). Both use the same interpreter.\n\nA practical habit for later: when you hit an error, **read the traceback from the bottom up** — the last line names the error type and message, and the lines above show exactly where it happened. Python's error messages are unusually friendly; learning to read them is half of debugging."},
            {"type": "example", "title": "Run it — try editing the messages", "stdin": "",
             "code": "print(\"Line one\")\nprint(\"Line two\")\n"},
            {"type": "check", "mode": "mcq",
             "question": "What does `# this is a note` do in Python?",
             "options": ["Prints the note", "It's a comment — ignored by Python, for humans to read", "Starts a new block", "Imports a module"],
             "answer": "It's a comment — ignored by Python, for humans to read",
             "explanation": "Anything after a # on a line is a comment and has no effect on the program."},
            {"type": "check", "mode": "mcq",
             "question": "What actually runs your Python code?",
             "options": ["A compiler that makes an .exe", "The Python interpreter (which runs bytecode on the Python VM)", "The web browser", "The operating system directly"],
             "answer": "The Python interpreter (which runs bytecode on the Python VM)",
             "explanation": "Python compiles your code to bytecode automatically, then the interpreter's virtual machine executes it."},
            {"type": "check", "mode": "output",
             "question": "What does the example program above print? (write both lines)",
             "answer": "Line one\nLine two",
             "explanation": "Each print() runs in order and automatically adds a newline, so you get 'Line one' then 'Line two'."},
        ],
    },
    # ───────────────────────── 3. Variables & types ────────────────────────
    {
        "title": "Variables & Data Types",
        "topic": "basics", "order_index": 3,
        "blocks": [
            {"type": "concept", "body": "## Storing values in variables\n\nA **variable** is a name that refers to a value. In Python you create one simply by **assigning** to it with `=` — there's no need to declare a type first:\n\n```python\nage = 20          # an int (whole number)\nname = \"Sam\"      # a str (text)\nprice = 4.99      # a float (decimal number)\nis_active = True  # a bool (True or False)\n```\n\nThis is called **dynamic typing**: Python figures out the type from the value, and the same name can later refer to a different type if you reassign it. You can reassign as often as you like — `score = score + 5` reads the current value, adds 5, and stores the result back.\n\n**Naming rules** you must follow:\n\n- Use letters, digits and the underscore `_` — but a name **cannot start with a digit** (`2x` is invalid, `x2` is fine).\n- Names are **case-sensitive**: `total` and `Total` differ.\n- You **cannot** use reserved **keywords** like `if`, `for`, `def`, `return`, `class` as names.\n- The Python convention is **snake_case**: lowercase words joined by underscores, e.g. `student_count`.\n\nChoose **meaningful** names — `student_count` tells the reader far more than `c`. Good names are one of the cheapest ways to make code readable."},
            {"type": "concept", "body": "## The core data types\n\nEvery value in Python has a **type**. You can ask for it with the built-in `type()` function. The types you'll use constantly are:\n\n| Type | Holds | Example |\n|------|-------|---------|\n| `int` | whole numbers | `42`, `-7` |\n| `float` | decimal numbers | `3.14`, `2.0` |\n| `str` | text (in quotes) | `\"hello\"`, `'A'` |\n| `bool` | truth values | `True`, `False` |\n\nUnlike lower-level languages, Python integers have **no fixed size limit** — you can compute enormous numbers without worrying about overflow. Floats are decimal numbers and, like in every language, are subject to tiny rounding errors (`0.1 + 0.2` is not exactly `0.3`), so avoid comparing them with `==` for equality.\n\nYou can **convert** between types with `int()`, `float()`, `str()` and `bool()`:\n\n```python\nint(\"42\")     # 42   (string → int)\nstr(42)       # \"42\"  (int → string)\nfloat(\"3.5\")  # 3.5\n```\n\nThis matters a lot for input: text typed by a user always arrives as a `str`, so you convert it to a number before doing maths. Trying to convert nonsense (like `int(\"abc\")`) raises a **ValueError** — Python tells you exactly what went wrong. Being aware of what type each value has prevents a whole category of confusing bugs, like accidentally joining two strings when you meant to add two numbers."},
            {"type": "example", "title": "Declare, reassign, check the type — Run it", "stdin": "",
             "code": "score = 50\nprint(\"Start:\", score)\nscore = score + 25      # reassign using the old value\nprint(\"After:\", score)\nprint(\"Type:\", type(score).__name__)\n"},
            {"type": "check", "mode": "mcq",
             "question": "Which is a VALID variable name in Python?",
             "options": ["2nd_place", "my-score", "for", "user_age"],
             "answer": "user_age",
             "explanation": "`user_age` uses letters and an underscore. `2nd_place` starts with a digit, `my-score` has a hyphen, and `for` is a keyword."},
            {"type": "check", "mode": "output",
             "question": "What does the example above print on the second line?",
             "answer": "After: 75",
             "explanation": "score starts at 50, then `score = score + 25` makes it 75. print() separates the two arguments with a space."},
            {"type": "check", "mode": "mcq",
             "question": "Do you have to declare a variable's type before using it in Python?",
             "options": ["Yes, always", "No — Python infers the type from the value (dynamic typing)", "Only for numbers", "Only inside functions"],
             "answer": "No — Python infers the type from the value (dynamic typing)",
             "explanation": "Python is dynamically typed: you just assign a value and Python tracks the type for you."},
        ],
    },
    # ───────────────────────── 4. Numbers & Math ───────────────────────────
    {
        "title": "Numbers & Math",
        "topic": "basics", "order_index": 4,
        "blocks": [
            {"type": "concept", "body": "## Arithmetic operators\n\nPython does maths with the operators you'd expect, plus a couple of handy extras:\n\n| Operator | Meaning | Example | Result |\n|----------|---------|---------|--------|\n| `+` `-` `*` | add, subtract, multiply | `3 * 4` | `12` |\n| `/` | **true** division (always a float) | `7 / 2` | `3.5` |\n| `//` | **floor** division (rounds down) | `7 // 2` | `3` |\n| `%` | modulo (remainder) | `17 % 5` | `2` |\n| `**` | power (exponent) | `2 ** 10` | `1024` |\n\nThe two division operators are the classic beginner gotcha. **`/` always gives a `float`**, even when it divides evenly (`4 / 2` is `2.0`, not `2`). **`//` floors** the result toward negative infinity and keeps it as an int when both operands are ints (`7 // 2` is `3`).\n\n**Modulo `%`** gives the remainder and is incredibly useful: `n % 2 == 0` tests whether `n` is **even**, and `n % 10` extracts the last digit of a number.\n\n```python\nprint(17 // 5)   # 3\nprint(17 % 5)    # 2\nprint(2 ** 10)   # 1024\n```"},
            {"type": "concept", "body": "## Conversions, precedence, and f-strings\n\nPython follows normal **operator precedence** — `**` first, then `*` `/` `//` `%`, then `+` `-` — just like maths. When in doubt, add **parentheses** to make the order explicit: `(a + b) * c`.\n\nWhen you mix an `int` and a `float`, the result is a `float`:\n\n```python\nprint(3 + 2.0)   # 5.0\n```\n\nTo turn text into a number (e.g. from `input()`), convert it: `int(\"42\")` or `float(\"3.5\")`. To go the other way, `str(42)`. Converting something that isn't a valid number — like `int(\"3.5\")` or `int(\"abc\")` — raises a **ValueError**.\n\nThe cleanest way to build output from numbers is an **f-string**: put an `f` before the quotes and drop variables inside `{ }`:\n\n```python\nprice = 4.5\nqty = 3\nprint(f\"Total: {price * qty}\")        # Total: 13.5\nprint(f\"Rounded: {price * qty:.2f}\")   # Rounded: 13.50\n```\n\nThe `:.2f` inside the braces formats the number to two decimal places. f-strings are readable, fast, and the recommended way to combine text and values in modern Python — you'll use them constantly."},
            {"type": "example", "title": "Division, modulo & power — Run it", "stdin": "",
             "code": "a = 7\nb = 2\nprint(\"true  :\", a / b)\nprint(\"floor :\", a // b)\nprint(\"mod   :\", a % b)\nprint(\"power :\", a ** b)\n"},
            {"type": "check", "mode": "output",
             "question": "What does `7 // 2` evaluate to?",
             "answer": "3",
             "explanation": "// is floor division: it divides and rounds down, so 7 // 2 = 3 (not 3.5)."},
            {"type": "check", "mode": "mcq",
             "question": "What is the result of `7 / 2` in Python?",
             "options": ["3", "3.5", "4", "3.0"],
             "answer": "3.5",
             "explanation": "The / operator always performs true division and returns a float, so 7 / 2 = 3.5."},
            {"type": "check", "mode": "mcq",
             "question": "Which operator raises a number to a power (e.g. 2 to the 10th)?",
             "options": ["^", "**", "//", "%"],
             "answer": "**",
             "explanation": "`**` is exponentiation: 2 ** 10 is 1024. (`^` is the bitwise XOR operator in Python, not power.)"},
        ],
    },
    # ───────────────────────── 5. Input & Output ───────────────────────────
    {
        "title": "Input & Output",
        "topic": "basics", "order_index": 5,
        "blocks": [
            {"type": "concept", "body": "## Output with print\n\n`print` is the function you'll use most to show results. You can pass it several values separated by commas, and it prints them with a **space between each** and a **newline at the end**:\n\n```python\nname = \"Sam\"\nage = 20\nprint(\"Hello\", name)       # Hello Sam\nprint(name, \"is\", age)     # Sam is 20\n```\n\nTwo optional settings give you control:\n\n- **`sep`** — the separator placed *between* arguments (default is a space): `print(1, 2, 3, sep=\"-\")` prints `1-2-3`.\n- **`end`** — what's printed *after* everything (default is `\"\\n\"`, a newline): `print(\"no newline\", end=\"\")` keeps the cursor on the same line.\n\nFor combining text and values, the cleanest tool is the **f-string** — an `f` before the quotes lets you embed variables directly inside `{ }`:\n\n```python\nprint(f\"{name} is {age} years old\")   # Sam is 20 years old\n```\n\nf-strings are easier to read than gluing strings together with `+`, and they let you format values (like `{value:.2f}` for two decimals). Reach for them whenever you build output from variables."},
            {"type": "concept", "body": "## Input with input() — and converting it\n\n`input()` reads one line that the user types and **returns it as a string** — always. This is the single most important thing to remember about input:\n\n```python\nname = input(\"What is your name? \")   # the prompt is optional\nprint(\"Hi\", name)\n```\n\nBecause `input()` gives you **text**, you must **convert** it before doing maths, or you'll get surprising results. Adding two strings *joins* them:\n\n```python\na = input()        # user types 4  → a is the string \"4\"\nb = input()        # user types 6  → b is the string \"6\"\nprint(a + b)       # prints \"46\", NOT 10!\n```\n\nTo do arithmetic, wrap the input in `int()` (or `float()`):\n\n```python\na = int(input())\nb = int(input())\nprint(a + b)       # 10\n```\n\nA few practical notes: each `input()` reads exactly **one line**. To read several numbers from a single line like `4 6`, read the line and `split()` it: `a, b = input().split()` then convert each. And if you call `input()` when there's no more input left, Python raises an **EOFError** — a sign you asked for more input than was provided."},
            {"type": "example", "title": "Read two numbers and add them — Run it", "stdin": "4\n6",
             "code": "a = int(input())\nb = int(input())\nprint(f\"{a} + {b} = {a + b}\")\n"},
            {"type": "check", "mode": "mcq",
             "question": "What type does input() always return?",
             "options": ["int", "float", "str (a string)", "bool"],
             "answer": "str (a string)",
             "explanation": "input() always returns text. Convert it with int() or float() before doing arithmetic."},
            {"type": "check", "mode": "output",
             "question": "With input lines `4` then `6`, what does the example above print?",
             "answer": "4 + 6 = 10",
             "explanation": "int() converts each line to a number, so a=4 and b=6, and the f-string shows the sum 10."},
            {"type": "check", "mode": "mcq",
             "question": "What does `print(\"4\" + \"6\")` output?",
             "options": ["10", "46", "4 6", "An error"],
             "answer": "46",
             "explanation": "Both values are strings, so + concatenates them into \"46\". You'd need int() to add them numerically."},
        ],
    },
    # ───────────────────────── 6. Strings ──────────────────────────────────
    {
        "title": "Strings",
        "topic": "strings", "order_index": 6,
        "blocks": [
            {"type": "concept", "body": "## Working with text\n\nA **string** (`str`) is a sequence of characters written in single or double quotes — `'hi'` and `\"hi\"` are equivalent. You can join strings with `+` (concatenation) and repeat them with `*`:\n\n```python\nfirst = \"Sam\"\nprint(\"Hello, \" + first)   # Hello, Sam\nprint(\"ab\" * 3)            # ababab\n```\n\nStrings are **sequences**, so you can access individual characters by **index**, starting at **0**. Python also supports **negative indices** that count from the end, where `-1` is the last character:\n\n```python\ns = \"hello\"\nprint(s[0])    # 'h'  (first)\nprint(s[-1])   # 'o'  (last)\nprint(len(s))  # 5    (number of characters)\n```\n\n**Slicing** grabs a substring with `s[start:stop]`, where `stop` is *not* included:\n\n```python\nprint(s[1:4])    # 'ell'\nprint(s[:2])     # 'he'   (from the start)\nprint(s[::-1])   # 'olleh' (reversed!)\n```\n\nOne crucial property: strings are **immutable** — you cannot change a character in place (`s[0] = 'H'` is an error). Instead you build a *new* string. To test whether one string contains another, use the `in` operator: `\"ell\" in \"hello\"` is `True`."},
            {"type": "concept", "body": "## String methods\n\nStrings come with many built-in **methods** — functions you call with a dot. They always return a *new* string (the original is unchanged, because strings are immutable):\n\n- **`.upper()` / `.lower()`** — change case: `\"Hi\".upper()` → `\"HI\"`.\n- **`.strip()`** — remove leading/trailing whitespace: `\"  hi  \".strip()` → `\"hi\"`.\n- **`.replace(old, new)`** — swap text: `\"cat\".replace(\"c\", \"b\")` → `\"bat\"`.\n- **`.split(sep)`** — break a string into a **list** of pieces: `\"a,b,c\".split(\",\")` → `[\"a\", \"b\", \"c\"]`.\n- **`.join(list)`** — the opposite: glue a list of strings together: `\"-\".join([\"a\", \"b\"])` → `\"a-b\"`.\n- **`.find(sub)`** — the index where `sub` first appears, or `-1` if not found.\n\n```python\nname = \"  Sam Smith  \"\nprint(name.strip().upper())     # SAM SMITH\nprint(\"a,b,c\".split(\",\"))       # ['a', 'b', 'c']\n```\n\nTo compare two strings, just use `==` — unlike some languages, Python compares the *contents*, so `\"abc\" == \"abc\"` is `True`. And to count characters, `len(s)` gives the length. Between indexing, slicing, `in`, and these methods, you can handle almost any text-processing task cleanly. As you learn more, explore the full list with `dir(str)` — there's a method for nearly everything."},
            {"type": "example", "title": "Length & last character — Run it", "stdin": "",
             "code": "s = \"hello\"\nprint(\"length =\", len(s))\nprint(\"last   =\", s[-1])\nprint(\"upper  =\", s.upper())\n"},
            {"type": "check", "mode": "output",
             "question": "What is `len(\"hello\")`?",
             "answer": "5",
             "explanation": "len() counts the characters: h-e-l-l-o = 5."},
            {"type": "check", "mode": "mcq",
             "question": "How do you get the LAST character of a string s?",
             "options": ["s[last]", "s[-1]", "s[len(s)]", "s.end()"],
             "answer": "s[-1]",
             "explanation": "Negative indices count from the end, so s[-1] is the last character. (s[len(s)] is out of range.)"},
            {"type": "check", "mode": "mcq",
             "question": "How do you check whether \"ell\" appears inside \"hello\"?",
             "options": ['"ell" in "hello"', '"hello".has("ell")', '"ell" == "hello"', '"hello".contains("ell")'],
             "answer": '"ell" in "hello"',
             "explanation": "The `in` operator tests membership and returns True/False — here it's True."},
        ],
    },
    # ───────────────────────── 7. Operators ────────────────────────────────
    {
        "title": "Operators & Expressions",
        "topic": "basics", "order_index": 7,
        "blocks": [
            {"type": "concept", "body": "## Comparison and logical operators\n\nBeyond arithmetic, the operators that drive **decisions** are comparison and logical ones.\n\n**Comparison operators** compare two values and produce a **bool** (`True` or `False`): `==` (equal), `!=` (not equal), `<`, `>`, `<=`, `>=`. You'll use these constantly inside `if` statements and loops.\n\n> ⚠️ **The classic trap:** `=` *assigns* a value, while `==` *compares*. Writing `if x = 5:` is a syntax error in Python (which actually protects you — in some languages it silently assigns). Always use `==` to compare.\n\nPython even allows **chained comparisons** that read like maths:\n\n```python\nage = 16\nprint(13 <= age <= 19)   # True — is age between 13 and 19?\n```\n\n**Logical operators** combine conditions: **`and`** (both must be true), **`or`** (at least one true), and **`not`** (flips true/false). Python spells them as words, not symbols:\n\n```python\nif age >= 13 and age <= 19:\n    print(\"teenager\")\nif day == \"Sat\" or day == \"Sun\":\n    print(\"weekend\")\n```\n\nThey **short-circuit**: in `a and b`, if `a` is false, `b` isn't even evaluated — occasionally important when `b` could cause an error."},
            {"type": "concept", "body": "## Truthiness, augmented assignment & precedence\n\nPython has a useful concept called **truthiness**: any value can be tested in a condition, not just `True`/`False`. These count as **falsy**: `False`, `0`, `0.0`, `\"\"` (empty string), `[]` (empty list), `{}` (empty dict), and `None`. **Everything else is truthy.** This lets you write clean checks:\n\n```python\nname = input()\nif name:                 # truthy = non-empty string\n    print(\"Hi\", name)\nelse:\n    print(\"No name given\")\n```\n\n**Augmented assignment** operators are shorthand for updating a variable using its own value: `x += 3` means `x = x + 3`. The whole family exists: `-=`, `*=`, `/=`, `//=`, `%=`, `**=`. They keep code short and intent clear. Note Python has **no `++` operator** — use `x += 1` to increment.\n\nFinally, **precedence** decides the order operations happen: arithmetic binds tighter than comparisons, which bind tighter than `and`/`or`. When an expression mixes different operators, don't rely on memorising the full table — reach for **parentheses** to make the order obvious:\n\n```python\nif (score > 50) and (lives > 0):\n    print(\"keep playing\")\n```\n\nClear, obviously-correct code is always worth more than saving a couple of characters."},
            {"type": "example", "title": "Modulo, comparison & augmented assignment — Run it", "stdin": "",
             "code": "print(\"17 % 5 =\", 17 % 5)\nprint(\"3 == 3 :\", 3 == 3)\nprint(\"2 > 5  :\", 2 > 5)\ni = 5\ni += 1\nprint(\"after += 1:\", i)\n"},
            {"type": "check", "mode": "output",
             "question": "What is `17 % 5`?",
             "answer": "2",
             "explanation": "17 divided by 5 is 3 remainder 2, so 17 % 5 = 2."},
            {"type": "check", "mode": "mcq",
             "question": "Which condition correctly checks if x equals 10?",
             "options": ["if x = 10:", "if x == 10:", "if x =< 10:", "if x === 10:"],
             "answer": "if x == 10:",
             "explanation": "== compares; a single = assigns (and is actually a syntax error inside an if)."},
            {"type": "check", "mode": "mcq",
             "question": "How does Python write the logical AND operator?",
             "options": ["&&", "and", "AND", "&"],
             "answer": "and",
             "explanation": "Python uses the words and / or / not for logical operators (& is bitwise AND, which is different)."},
        ],
    },
    # ───────────────────────── 8. Conditions ───────────────────────────────
    {
        "title": "Conditions: if / elif / else",
        "topic": "conditionals", "order_index": 8,
        "blocks": [
            {"type": "concept", "body": "## Making decisions with if / elif / else\n\nPrograms become useful when they choose different actions based on data. The `if` statement runs an **indented block** only when a condition is true:\n\n```python\nif marks >= 90:\n    print(\"Grade A\")\nelif marks >= 60:\n    print(\"Grade B\")\nelse:\n    print(\"Grade C\")\n```\n\nNotice three things that are pure Python style:\n\n- The header line ends with a **colon `:`**.\n- The body is **indented** (4 spaces is the convention). The indentation is what marks the block — there are no braces.\n- **`elif`** (\"else if\") chains additional conditions, and **`else`** is the optional catch-all.\n\nPython checks the conditions **top to bottom** and runs the **first** block whose condition is true, then skips the rest. So with `marks = 72`, the first test (`>= 90`) fails, the `elif` (`>= 60`) succeeds and prints `Grade B`, and the `else` is skipped.\n\nConditions are usually comparisons, and you can combine them with `and` / `or`:\n\n```python\nif age >= 13 and age <= 19:\n    print(\"teenager\")\n```\n\nGetting indentation consistent is essential — mixing tabs and spaces, or indenting wrongly, causes an **IndentationError**."},
            {"type": "concept", "body": "## Truthiness, nesting, and clean conditionals\n\nA condition doesn't have to be a comparison — Python tests the **truthiness** of any value. Remember: `0`, `\"\"` (empty string), `[]` (empty list), and `None` are **falsy**; almost everything else is **truthy**. This enables natural checks:\n\n```python\nitems = []\nif items:                 # only true if the list is non-empty\n    print(\"has items\")\nelse:\n    print(\"empty\")\n```\n\nYou can **nest** an `if` inside another to handle layered decisions:\n\n```python\nif logged_in:\n    if is_admin:\n        print(\"admin panel\")\n    else:\n        print(\"user dashboard\")\n```\n\nBut conditions that go three or four levels deep become hard to read. When that happens, combine tests with `and`/`or`, or **return early** from a function, so the logic stays flat and obvious.\n\nFor a quick either/or **value**, Python has a compact **conditional expression**:\n\n```python\nbigger = a if a > b else b   # if a>b use a, else b\n```\n\nRead it as \"value-if-true if condition else value-if-false\". It's perfect for short assignments, but don't nest several of them — at that point a regular `if/else` is clearer. Picking the right structure keeps your decision logic easy to read and extend."},
            {"type": "example", "title": "Grade with an if/elif/else ladder — Run it", "stdin": "",
             "code": "marks = 72\nif marks >= 90:\n    print(\"Grade A\")\nelif marks >= 60:\n    print(\"Grade B\")\nelse:\n    print(\"Grade C\")\n"},
            {"type": "check", "mode": "output",
             "question": "With marks = 72, what does the program print?",
             "answer": "Grade B",
             "explanation": "72 isn't >= 90 but it is >= 60, so the elif branch runs."},
            {"type": "check", "mode": "mcq",
             "question": "What MUST end the line before an indented if-block body?",
             "options": ["A semicolon ;", "A colon :", "An open brace {", "Nothing"],
             "answer": "A colon :",
             "explanation": "if / elif / else / for / while / def / class headers all end with a colon, and their body is indented."},
            {"type": "check", "mode": "mcq",
             "question": "Which of these values is 'falsy' in Python?",
             "options": ["1", "\"hello\"", "[] (empty list)", "[0]"],
             "answer": "[] (empty list)",
             "explanation": "Empty containers, 0, \"\" and None are falsy. A non-empty list like [0] is truthy."},
        ],
    },
    # ───────────────────────── 9. Loops ────────────────────────────────────
    {
        "title": "Loops: for / while",
        "topic": "loops", "order_index": 9,
        "blocks": [
            {"type": "concept", "body": "## Repeating work with loops\n\nLoops let you run the same code many times without copying it. Python has two.\n\nThe **`for`** loop iterates over the items of a **sequence** — a list, a string, or a range of numbers. This is different from C-style counting loops: you loop *over things* directly.\n\n```python\nfor letter in \"abc\":\n    print(letter)          # a, then b, then c\n\nfor item in [10, 20, 30]:\n    print(item)\n```\n\nTo loop a specific number of times, use **`range()`**:\n\n```python\nfor i in range(5):         # 0, 1, 2, 3, 4  (stops BEFORE 5)\n    print(i)\nfor i in range(1, 6):      # 1, 2, 3, 4, 5  (start, stop)\n    print(i)\nfor i in range(0, 10, 2):  # 0, 2, 4, 6, 8  (start, stop, step)\n    print(i)\n```\n\nThe single most important detail: **`range(n)` stops *before* `n`** — `range(5)` gives `0,1,2,3,4`. Getting this boundary right (or wrong) is the famous **off-by-one** error.\n\nThe **`while`** loop repeats as long as a condition stays true, checking *before* each pass — so it may run zero times:\n\n```python\nwhile lives > 0:\n    play()\n```\n\nUse `for` for a known number of items and `while` for condition-driven repetition."},
            {"type": "concept", "body": "## break, continue, nesting — and the pitfalls\n\nTwo keywords give you finer control inside loops. **`break`** exits the loop immediately. **`continue`** skips the rest of the *current* iteration and jumps to the next one. Use them sparingly — they're great for stopping a search early, but overuse makes loops hard to follow.\n\n```python\nfor n in range(1, 100):\n    if n % 7 == 0:\n        print(\"first multiple of 7:\", n)\n        break          # stop as soon as we find it\n```\n\n**Nested loops** are loops inside loops, essential for grids, tables and patterns. The inner loop runs fully for *each* pass of the outer loop:\n\n```python\nfor row in range(3):\n    for col in range(3):\n        print(\"*\", end=\"\")\n    print()            # newline after each row\n```\n\nTwo classic bugs to watch for. The **off-by-one error**: `range(1, n)` stops at `n-1`, while `range(1, n+1)` includes `n` — think carefully about whether the last value should be included. The **infinite loop**: in a `while`, if the condition can never become false (you forgot to change the variable it tests), the loop runs forever and the program hangs. When a program seems stuck, an infinite loop is the first thing to suspect.\n\nHandy extras: **`enumerate(seq)`** gives you index *and* value while looping, and a `for` loop can have an `else` that runs if the loop finished without `break`."},
            {"type": "example", "title": "Sum 1..N — Run it (input is 5)", "stdin": "5",
             "code": "n = int(input())\ntotal = 0\nfor i in range(1, n + 1):\n    total += i\nprint(f\"Sum 1..{n} = {total}\")\n"},
            {"type": "check", "mode": "output",
             "question": "What does `for i in range(1, 6): print(i, end=\" \")` print?",
             "answer": "1 2 3 4 5",
             "explanation": "range(1, 6) yields 1,2,3,4,5 — it starts at 1 and stops BEFORE 6."},
            {"type": "check", "mode": "output",
             "question": "With input 5, what does the Sum example print?",
             "answer": "Sum 1..5 = 15",
             "explanation": "1+2+3+4+5 = 15."},
            {"type": "check", "mode": "mcq",
             "question": "What does `range(5)` produce?",
             "options": ["1, 2, 3, 4, 5", "0, 1, 2, 3, 4", "0, 1, 2, 3, 4, 5", "5"],
             "answer": "0, 1, 2, 3, 4",
             "explanation": "range(n) starts at 0 and stops BEFORE n, so range(5) is 0,1,2,3,4 (five values)."},
        ],
    },
    # ───────────────────────── 10. Functions ───────────────────────────────
    {
        "title": "Functions",
        "topic": "functions", "order_index": 10,
        "blocks": [
            {"type": "concept", "body": "## Reusable blocks of code\n\nA **function** is a named block of code that does one job. Instead of repeating logic, you write it once with **`def`** and **call** it whenever needed:\n\n```python\ndef add(a, b):       # 'a' and 'b' are parameters (inputs)\n    return a + b     # hand a value back to the caller\n\ntotal = add(3, 4)    # call it; total becomes 7\nprint(total)\n```\n\nThe pieces:\n\n- **`def name(parameters):`** defines the function — note the colon and the indented body.\n- **Parameters** are local variables that receive the **arguments** you pass in the call.\n- **`return`** sends a value back and ends the function. A function with no `return` automatically returns **`None`**.\n\nFunctions can have **default parameter values**, which makes arguments optional:\n\n```python\ndef greet(name, greeting=\"Hello\"):\n    return f\"{greeting}, {name}!\"\n\nprint(greet(\"Sam\"))                 # Hello, Sam!\nprint(greet(\"Sam\", \"Hi\"))           # Hi, Sam!\n```\n\nWhy bother with functions? They make programs **organised** (each does one clear thing), **reusable** (write once, call many times), **easier to test**, and **easier to read** (a call like `area(width, height)` documents itself). A good rule of thumb: if a block of code does something you can name, it probably deserves to be its own function."},
            {"type": "concept", "body": "## Scope, return values & recursion\n\n**Scope** is *where* a variable exists. A variable created inside a function is **local** — it only exists during that call and can't be seen outside. This is a feature: functions don't accidentally clobber each other's variables.\n\n```python\ndef f():\n    x = 10        # local to f\n    return x\n\nf()\n# print(x)        # NameError — x doesn't exist out here\n```\n\nA function can **return multiple values** at once (really a tuple), which you can unpack:\n\n```python\ndef min_max(nums):\n    return min(nums), max(nums)\n\nlow, high = min_max([3, 1, 4, 1, 5])   # low=1, high=5\n```\n\n**Recursion** is a function that calls *itself* to solve a smaller version of a problem. Every recursive function needs a **base case** that stops the recursion, or it calls forever and Python raises a **RecursionError**:\n\n```python\ndef fact(n):\n    if n <= 1:          # base case\n        return 1\n    return n * fact(n - 1)   # recursive step\n```\n\nRecursion is elegant for problems like factorials and tree traversal, though many recursive solutions can also be written as loops. A small habit that pays off: write a short **docstring** (a string on the first line of the body) describing what your function does — it documents your intent for the next reader, including future you."},
            {"type": "example", "title": "A function + recursion — Run it", "stdin": "",
             "code": "def add(a, b):\n    return a + b\n\ndef fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)\n\nprint(\"add(3, 4) =\", add(3, 4))\nprint(\"5! =\", fact(5))\n"},
            {"type": "check", "mode": "output",
             "question": "What does the example print for 5! (factorial of 5)?",
             "answer": "add(3, 4) = 7\n5! = 120",
             "explanation": "add(3,4) is 7, and 5! = 5x4x3x2x1 = 120, computed by multiplying n by fact(n-1) down to the base case."},
            {"type": "check", "mode": "mcq",
             "question": "What does a function return if it has no `return` statement?",
             "options": ["0", "An empty string", "None", "It causes an error"],
             "answer": "None",
             "explanation": "A function without a return (or a bare 'return') gives back the special value None."},
            {"type": "check", "mode": "mcq",
             "question": "What MUST every recursive function have?",
             "options": ["A loop", "A base case that stops the recursion", "A global variable", "A default argument"],
             "answer": "A base case that stops the recursion",
             "explanation": "Without a base case the function calls itself forever and Python raises a RecursionError."},
        ],
    },
    # ───────────────────────── 11. Lists ───────────────────────────────────
    {
        "title": "Lists",
        "topic": "lists", "order_index": 11,
        "blocks": [
            {"type": "concept", "body": "## Many values under one name\n\nA **list** stores an ordered collection of values — of any types — under one name, written with square brackets. You access elements by **index**, starting at **0**, and negative indices count from the end:\n\n```python\nnums = [10, 20, 30, 40, 50]\nprint(nums[0])    # 10  (first)\nprint(nums[-1])   # 50  (last)\nprint(len(nums))  # 5   (how many)\n```\n\nFor a list of length `N`, valid indices are `0` to `N - 1`. Going past the end (`nums[5]` here) raises an **IndexError** — but unlike lower-level languages, Python *catches* this for you and tells you, rather than silently corrupting memory.\n\nLists are **mutable** — you can change them in place:\n\n```python\nnums[0] = 99           # change an element\nnums.append(60)        # add to the end\nnums.insert(0, 5)      # insert at a position\nnums.pop()             # remove & return the last\nnums.remove(30)        # remove the first 30\n```\n\nYou can **slice** a list just like a string (`nums[1:3]`), check membership with `in` (`20 in nums`), and loop over it directly:\n\n```python\nfor n in nums:\n    print(n)\n```\n\nLists are the workhorse of Python — most real programs are full of them."},
            {"type": "concept", "body": "## Comprehensions, aliasing & nesting\n\nA very Pythonic way to build a list is a **list comprehension** — a compact loop inside the brackets:\n\n```python\nsquares = [n * n for n in range(1, 6)]   # [1, 4, 9, 16, 25]\nevens = [n for n in range(10) if n % 2 == 0]   # [0, 2, 4, 6, 8]\n```\n\nRead it as \"the expression, for each item, optionally filtered\". Comprehensions are concise and fast.\n\nNow a subtle trap that surprises every beginner: **assignment doesn't copy a list**. Two names can point to the *same* list:\n\n```python\na = [1, 2, 3]\nb = a           # b and a are the SAME list\nb[0] = 99\nprint(a[0])     # 99  — changing b changed a!\n```\n\nTo get an independent copy, use `a.copy()` (or `a[:]`). This **aliasing** behaviour is important whenever you pass lists to functions — the function can modify the original list, because it receives a reference to the same object, not a copy.\n\nLists can also be **nested** to make grids and tables:\n\n```python\ngrid = [[1, 2, 3], [4, 5, 6]]\nprint(grid[1][2])   # 6  (row 1, column 2)\n```\n\nUseful built-ins work on whole lists at once: `sum(nums)`, `max(nums)`, `min(nums)`, `sorted(nums)`, and `len(nums)`. Reach for these before writing a manual loop."},
            {"type": "example", "title": "Sum & max of a list — Run it", "stdin": "",
             "code": "a = [12, 7, 25, 3, 18]\ntotal = 0\nbiggest = a[0]\nfor x in a:\n    total += x\n    if x > biggest:\n        biggest = x\nprint(f\"Sum = {total}, Max = {biggest}\")\n"},
            {"type": "check", "mode": "mcq",
             "question": "For a list `a` with 5 elements, what is the LAST valid index?",
             "options": ["5", "4", "-5", "0"], "answer": "4",
             "explanation": "5 elements use indices 0,1,2,3,4. a[5] is out of range (IndexError). a[-1] also works for the last."},
            {"type": "check", "mode": "output",
             "question": "What does the Sum & Max example print?",
             "answer": "Sum = 65, Max = 25",
             "explanation": "12+7+25+3+18 = 65, and the largest element is 25. (You could also write sum(a) and max(a).)"},
            {"type": "check", "mode": "mcq",
             "question": "After `a = [1,2,3]; b = a; b[0] = 99`, what is `a[0]`?",
             "options": ["1", "99", "0", "It errors"],
             "answer": "99",
             "explanation": "b = a makes both names refer to the SAME list, so changing b also changes a. Use a.copy() for an independent copy."},
        ],
    },
    # ───────────────────────── 12. Dictionaries ────────────────────────────
    {
        "title": "Dictionaries & Sets",
        "topic": "dictionaries", "order_index": 12,
        "blocks": [
            {"type": "concept", "body": "## Key–value pairs with dictionaries\n\nA **dictionary** (`dict`) stores data as **key → value** pairs, written with curly braces. Instead of looking things up by position (like a list), you look them up by a meaningful **key**:\n\n```python\nprices = {\"apple\": 3, \"banana\": 2, \"cherry\": 5}\nprint(prices[\"apple\"])   # 3  — look up by key\n```\n\nDictionaries are perfect for modelling real things: a phone book (name → number), a word count (word → how many times), or a record (field → value). Keys are usually strings or numbers and must be **unique**; values can be anything.\n\nYou add, update and remove entries easily:\n\n```python\nprices[\"date\"] = 8        # add a new pair\nprices[\"apple\"] = 4       # update an existing value\ndel prices[\"banana\"]      # remove a pair\nprint(len(prices))        # how many pairs\n```\n\nLooking up a key that doesn't exist raises a **KeyError**. To look up safely with a fallback, use **`.get(key, default)`**:\n\n```python\nprint(prices.get(\"mango\", 0))   # 0 — no error if missing\n```\n\nCheck whether a key exists with `in`: `\"apple\" in prices` is `True`. Dictionaries are one of Python's most powerful and most-used types — they're behind objects, JSON, configuration, and countless data tasks."},
            {"type": "concept", "body": "## Looping dictionaries, and sets\n\nYou'll often **loop** over a dictionary. By default a `for` loop gives you the **keys**, but the methods make your intent clear:\n\n```python\nfor key in prices:               # keys\n    print(key, prices[key])\n\nfor key, value in prices.items():  # key AND value together\n    print(key, \"costs\", value)\n\nprint(list(prices.keys()))    # all keys\nprint(list(prices.values()))  # all values\n```\n\nA classic use is **counting**. Combined with `.get`, tallying things is a few lines:\n\n```python\nwords = [\"a\", \"b\", \"a\", \"c\", \"a\"]\ncounts = {}\nfor w in words:\n    counts[w] = counts.get(w, 0) + 1\nprint(counts)   # {'a': 3, 'b': 1, 'c': 1}\n```\n\nClosely related is the **set** — an unordered collection of **unique** values, written with curly braces but no key–value pairs:\n\n```python\nseen = {1, 2, 2, 3, 3, 3}\nprint(seen)        # {1, 2, 3}  — duplicates removed\nprint(2 in seen)   # True\n```\n\nSets are ideal when you only care *whether* something is present and want duplicates gone automatically — membership tests (`in`) are very fast. Use a **dict** when you need to map keys to values, and a **set** when you just need a collection of unique items."},
            {"type": "example", "title": "A small price book — Run it", "stdin": "",
             "code": "prices = {\"apple\": 3, \"banana\": 2}\nprices[\"cherry\"] = 5\nprint(prices[\"apple\"])\nprint(len(prices))\nprint(\"banana\" in prices)\n"},
            {"type": "check", "mode": "mcq",
             "question": "How do you look up the value for key \"apple\" in a dict called prices?",
             "options": ["prices(\"apple\")", "prices[\"apple\"]", "prices.apple()", "prices->apple"],
             "answer": "prices[\"apple\"]",
             "explanation": "You index a dictionary with the key in square brackets: prices[\"apple\"]."},
            {"type": "check", "mode": "output",
             "question": "What does the price-book example print? (three lines)",
             "answer": "3\n3\nTrue",
             "explanation": "prices[\"apple\"] is 3; after adding cherry the dict has 3 pairs; and \"banana\" is one of the keys, so 'banana' in prices is True."},
            {"type": "check", "mode": "mcq",
             "question": "Which method looks up a key WITHOUT raising a KeyError if it's missing?",
             "options": ["prices.find(key)", "prices.get(key, default)", "prices[key]", "prices.key(name)"],
             "answer": "prices.get(key, default)",
             "explanation": ".get() returns the value if the key exists, or the default (None if unspecified) instead of raising KeyError."},
        ],
    },
    # ───────────────────────── 13. Tuples & comprehensions ─────────────────
    {
        "title": "Tuples & Unpacking",
        "topic": "lists", "order_index": 13,
        "blocks": [
            {"type": "concept", "body": "## Tuples: fixed collections\n\nA **tuple** is like a list, but **immutable** — once created, you can't change its contents. You write one with parentheses (or just commas):\n\n```python\npoint = (3, 4)\nprint(point[0])    # 3\nprint(len(point))  # 2\n# point[0] = 9     # TypeError — tuples can't be changed\n```\n\nWhy have an unchangeable list? Tuples signal \"these values belong together and shouldn't change\" — like an (x, y) coordinate, an RGB colour, or a database row. They're also slightly faster and can be used as dictionary keys (lists can't).\n\nThe real magic is **unpacking** — splitting a tuple (or any sequence) into separate variables in one line:\n\n```python\nx, y = point        # x = 3, y = 4\na, b = 1, 2         # assign two at once\na, b = b, a         # swap! a=2, b=1 — no temp variable needed\n```\n\nThis is why functions can return \"multiple values\": they really return a tuple, which you unpack:\n\n```python\ndef divmod2(a, b):\n    return a // b, a % b\n\nquotient, remainder = divmod2(17, 5)   # 3, 2\n```\n\nUnpacking makes Python code clean and readable, and you'll see it everywhere — especially in loops."},
            {"type": "concept", "body": "## enumerate, zip & comprehensions\n\nTwo built-in helpers make looping elegant.\n\n**`enumerate(seq)`** gives you both the **index and the value** while looping — no manual counter needed:\n\n```python\nfor i, name in enumerate([\"Sam\", \"Ada\", \"Lin\"]):\n    print(i, name)      # 0 Sam / 1 Ada / 2 Lin\n```\n\n**`zip(a, b)`** walks two sequences **in parallel**, pairing their elements:\n\n```python\nnames = [\"Sam\", \"Ada\"]\nscores = [90, 85]\nfor name, score in zip(names, scores):\n    print(name, score)   # Sam 90 / Ada 85\n```\n\nFinally, **comprehensions** aren't just for lists. You can build dictionaries and sets the same compact way:\n\n```python\nsquares = {n: n * n for n in range(1, 4)}   # {1: 1, 2: 4, 3: 9}  (dict)\nunique = {c for c in \"banana\"}              # {'b', 'a', 'n'}     (set)\n```\n\nThese tools — unpacking, `enumerate`, `zip`, and comprehensions — are what make Python code so concise compared to other languages. A loop that would take several lines elsewhere often becomes a single clear expression. As you get comfortable, prefer them over manual index bookkeeping; they're easier to read and less error-prone."},
            {"type": "example", "title": "Swap & a comprehension — Run it", "stdin": "",
             "code": "a, b = 1, 2\na, b = b, a          # swap with no temp variable\nprint(a, b)\nsquares = [n * n for n in range(1, 4)]\nprint(squares)\n"},
            {"type": "check", "mode": "output",
             "question": "What does the swap-and-comprehension example print? (two lines)",
             "answer": "2 1\n[1, 4, 9]",
             "explanation": "a, b = b, a swaps the values to a=2, b=1. The comprehension squares 1,2,3 into [1, 4, 9]."},
            {"type": "check", "mode": "mcq",
             "question": "What makes a tuple different from a list?",
             "options": ["A tuple can only hold numbers", "A tuple is immutable — you can't change it after creation", "A tuple has no length", "There is no difference"],
             "answer": "A tuple is immutable — you can't change it after creation",
             "explanation": "Tuples are fixed: once created, their contents can't be modified, unlike mutable lists."},
            {"type": "check", "mode": "mcq",
             "question": "What does `enumerate(seq)` give you in a for-loop?",
             "options": ["Only the values", "Both the index and the value of each item", "The length", "A reversed copy"],
             "answer": "Both the index and the value of each item",
             "explanation": "enumerate yields (index, value) pairs, so `for i, x in enumerate(seq)` gives the position and the element together."},
        ],
    },
    # ───────────────────────── 14. Classes ─────────────────────────────────
    {
        "title": "Classes & Objects",
        "topic": "classes", "order_index": 14,
        "blocks": [
            {"type": "concept", "body": "## Bundling data and behaviour with classes\n\nLists and dicts hold data, but real-world things — a student, a bank account, a point — bundle together **data** *and* the **actions** you perform on that data. A **class** lets you define your own type that does exactly that.\n\n```python\nclass Student:\n    def __init__(self, name, age):   # the constructor\n        self.name = name             # attributes (data)\n        self.age = age\n\n    def greet(self):                 # a method (behaviour)\n        return f\"Hi, I'm {self.name}\"\n```\n\nThe pieces:\n\n- **`class Student:`** defines a new type (blueprint). By convention class names use `CapWords`.\n- **`__init__`** is the special **constructor** method — it runs automatically when you create an object, and sets up its initial **attributes**.\n- **`self`** refers to *the particular object* being worked on. Every method takes `self` as its first parameter, and you store/read data on it with `self.attribute`.\n\nYou create an **object** (an *instance*) by calling the class like a function, then use the dot operator to reach its attributes and methods:\n\n```python\ns = Student(\"Sam\", 20)   # __init__ runs with name=\"Sam\", age=20\nprint(s.name)            # Sam\nprint(s.greet())         # Hi, I'm Sam\n```\n\nEach object keeps its own data, so two `Student` objects have independent names and ages."},
            {"type": "concept", "body": "## Why classes — and a note on objects everywhere\n\nWhy bundle data and behaviour together? Because it keeps related things in one place and lets the rest of your program speak in **meaningful terms**. Instead of juggling loose `name`, `age` and `gpa` variables, you have a single `Student` object you can pass around, store in a list, or return from a function as one unit:\n\n```python\nclassroom = [Student(\"Sam\", 20), Student(\"Ada\", 19)]\nfor s in classroom:\n    print(s.greet())\n```\n\nMethods can update an object's own data using `self`:\n\n```python\nclass Counter:\n    def __init__(self):\n        self.count = 0\n    def increment(self):\n        self.count += 1\n\nc = Counter()\nc.increment()\nc.increment()\nprint(c.count)   # 2\n```\n\nHere's a secret that ties the whole course together: in Python, **everything is already an object** — every `int`, `str`, `list` and `dict` you've used is an instance of a class, and the methods you've called (like `\"hi\".upper()` or `nums.append(x)`) are exactly the kind of methods you just learned to write. Defining your own classes is called **object-oriented programming**, and it's the foundation for organising larger programs. You now have the core idea; from here you can explore inheritance (building new classes on top of existing ones) and the rich object model Python is built on."},
            {"type": "example", "title": "A student class — Run it", "stdin": "",
             "code": "class Student:\n    def __init__(self, name, age):\n        self.name = name\n        self.age = age\n\n    def greet(self):\n        return f\"Hi, I'm {self.name}\"\n\ns = Student(\"Sam\", 20)\nprint(s.greet())\nprint(s.age)\n"},
            {"type": "check", "mode": "mcq",
             "question": "What does the __init__ method do?",
             "options": ["Deletes the object", "Runs automatically when an object is created, to set up its attributes", "Prints the object", "Is required only for printing"],
             "answer": "Runs automatically when an object is created, to set up its attributes",
             "explanation": "__init__ is the constructor: Python calls it when you create an instance, and it initialises the object's attributes."},
            {"type": "check", "mode": "output",
             "question": "What does the student-class example print? (two lines)",
             "answer": "Hi, I'm Sam\n20",
             "explanation": "The object is created with name=\"Sam\", age=20; greet() returns the message and s.age is 20."},
            {"type": "check", "mode": "mcq",
             "question": "What does `self` refer to inside a method?",
             "options": ["The class itself", "The particular object the method was called on", "A global variable", "The return value"],
             "answer": "The particular object the method was called on",
             "explanation": "self is the current instance, so self.name reads/writes the data belonging to that specific object."},
        ],
    },
]

# ── Per-topic references (further reading) ──────────────────────────────────
_PYDOCS = "https://docs.python.org/3/tutorial/index.html"
_REFS = {
    "basics": [
        {"title": "Python.org — The Python Tutorial", "url": _PYDOCS},
        {"title": "Real Python — Python Basics", "url": "https://realpython.com/python-basics/"},
        {"title": "W3Schools — Python Tutorial", "url": "https://www.w3schools.com/python/"},
    ],
    "conditionals": [
        {"title": "W3Schools — Python If...Else", "url": "https://www.w3schools.com/python/python_conditions.asp"},
        {"title": "Real Python — Conditional Statements", "url": "https://realpython.com/python-conditional-statements/"},
        {"title": "Python.org — if Statements", "url": "https://docs.python.org/3/tutorial/controlflow.html#if-statements"},
    ],
    "loops": [
        {"title": "W3Schools — Python For Loops", "url": "https://www.w3schools.com/python/python_for_loops.asp"},
        {"title": "Real Python — Python for Loops", "url": "https://realpython.com/python-for-loop/"},
        {"title": "Python.org — for Statements & range()", "url": "https://docs.python.org/3/tutorial/controlflow.html#for-statements"},
    ],
    "functions": [
        {"title": "W3Schools — Python Functions", "url": "https://www.w3schools.com/python/python_functions.asp"},
        {"title": "Real Python — Defining Functions", "url": "https://realpython.com/defining-your-own-python-function/"},
        {"title": "Python.org — Defining Functions", "url": "https://docs.python.org/3/tutorial/controlflow.html#defining-functions"},
    ],
    "lists": [
        {"title": "W3Schools — Python Lists", "url": "https://www.w3schools.com/python/python_lists.asp"},
        {"title": "Real Python — Lists and Tuples", "url": "https://realpython.com/python-lists-tuples/"},
        {"title": "Python.org — Data Structures (lists)", "url": "https://docs.python.org/3/tutorial/datastructures.html"},
    ],
    "strings": [
        {"title": "W3Schools — Python Strings", "url": "https://www.w3schools.com/python/python_strings.asp"},
        {"title": "Real Python — Strings in Python", "url": "https://realpython.com/python-strings/"},
        {"title": "Python.org — Text Sequence Type (str)", "url": "https://docs.python.org/3/library/stdtypes.html#text-sequence-type-str"},
    ],
    "dictionaries": [
        {"title": "W3Schools — Python Dictionaries", "url": "https://www.w3schools.com/python/python_dictionaries.asp"},
        {"title": "Real Python — Dictionaries in Python", "url": "https://realpython.com/python-dicts/"},
        {"title": "Python.org — Dictionaries", "url": "https://docs.python.org/3/tutorial/datastructures.html#dictionaries"},
    ],
    "classes": [
        {"title": "W3Schools — Python Classes/Objects", "url": "https://www.w3schools.com/python/python_classes.asp"},
        {"title": "Real Python — Object-Oriented Programming", "url": "https://realpython.com/python3-object-oriented-programming/"},
        {"title": "Python.org — Classes", "url": "https://docs.python.org/3/tutorial/classes.html"},
    ],
}


def _build_blocks(item):
    """Lesson blocks + a references block appended at the end."""
    blocks = list(item["blocks"])
    refs = _REFS.get(item["topic"]) or _REFS["basics"]
    blocks.append({"type": "reference", "items": refs})
    return blocks


def _lessons_version(db):
    db.execute(text("CREATE TABLE IF NOT EXISTS app_meta (k VARCHAR(64) PRIMARY KEY, v VARCHAR(255))"))
    row = db.execute(text("SELECT v FROM app_meta WHERE k='lessons_version'")).fetchone()
    try:
        return int(row[0]) if row else 0
    except Exception:
        return 0


def _set_lessons_version(db, ver):
    db.execute(text("DELETE FROM app_meta WHERE k='lessons_version'"))
    db.execute(text("INSERT INTO app_meta (k, v) VALUES ('lessons_version', :v)"), {"v": str(ver)})


# Every title this seeder produces — so re-seeding refreshes our own lessons by
# title while leaving admin-authored (custom-titled) lessons alone.
_SEED_TITLES = {item["title"] for item in _LESSONS}


def seed_if_empty(db):
    """Install/upgrade the built-in curriculum. Re-seeds when _CURRICULUM_VERSION
    changes, refreshing only seed-owned lessons (admin's custom lessons are kept)."""
    if _lessons_version(db) >= _CURRICULUM_VERSION:
        return 0

    for l in db.query(models.Lesson).filter(models.Lesson.title.in_(_SEED_TITLES)).all():
        db.delete(l)
    db.flush()

    for item in _LESSONS:
        db.add(models.Lesson(
            title=item["title"], topic=item["topic"], order_index=item["order_index"],
            content=json.dumps(_build_blocks(item)), is_active=True,
        ))
    _set_lessons_version(db, _CURRICULUM_VERSION)
    db.commit()
    return len(_LESSONS)
