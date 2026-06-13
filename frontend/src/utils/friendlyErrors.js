// Translate cryptic Python error messages into plain-English tips for beginners.
// Returns a short hint string, or null if we don't have a friendlier phrasing.

const RULES = [
  [/expected an indented block/i,
    "Python uses indentation for blocks. After a line ending in ':' (def / if / for / while), indent the next line (4 spaces)."],
  [/unexpected indent/i,
    "This line is indented more than it should be — line it up with the surrounding code."],
  [/unindent does not match any outer indentation level/i,
    "The indentation here doesn't line up with an earlier block — check your spaces are consistent."],
  [/inconsistent use of tabs and spaces|TabError/i,
    "Don't mix tabs and spaces for indentation — pick one (spaces are recommended) and use it everywhere."],
  [/expected ['"]?:['"]?/i,
    "Python blocks (if / elif / else / for / while / def / class) need a ':' at the end of the header line."],
  [/['"]?\(['"]? was never closed|unexpected EOF while parsing/i,
    "A '(' bracket is never closed — check that every '(' has a matching ')'."],
  [/['"]?\[['"]? was never closed/i,
    "A '[' bracket is never closed — check that every '[' has a matching ']'."],
  [/['"]?\{['"]? was never closed/i,
    "A '{' brace is never closed — check that every '{' has a matching '}'."],
  [/unterminated string literal|EOL while scanning string literal/i,
    "A string is missing its closing quote (\" or ')."],
  [/unterminated triple-quoted string literal/i,
    "A triple-quoted string (\"\"\"…\"\"\") is missing its closing \"\"\"."],
  [/invalid syntax/i,
    "Check this line for a typo — a missing ':', an unmatched bracket, '=' where you meant '==', or a stray symbol."],
  [/cannot assign to literal|cannot assign to/i,
    "The left side of '=' must be a variable name, not a value or expression. Did you mean '==' to compare?"],
  [/name ['"]?(\w+)['"]? is not defined/i,
    "You're using a name before defining it (or misspelled it). Define the variable/function first, or check the spelling."],
  [/EOFError/i,
    "input() got no input. Provide input below, or you may have more input() calls than lines of input."],
  [/list index out of range/i,
    "You're accessing a list position that doesn't exist — valid indices are 0 to len(list) - 1."],
  [/string index out of range/i,
    "You're accessing a character position past the end of the string."],
  [/KeyError/i,
    "That key isn't in the dictionary — check the key name, or use dict.get(key) to avoid the error."],
  [/division by zero|float division by zero|integer division or modulo by zero/i,
    "You're dividing by zero — guard against a zero denominator before dividing."],
  [/invalid literal for int\(\)/i,
    "int() got text that isn't a whole number (e.g. int('abc') or int('1.5')). Check what you're converting."],
  [/could not convert string to float/i,
    "float() got text that isn't a number. Check the value you're converting."],
  [/unsupported operand type|can only concatenate|must be str, not|can't multiply sequence/i,
    "You're combining incompatible types — e.g. adding a string and a number. Convert with int(), float(), or str() first."],
  [/['"]?(\w+)['"]? object is not subscriptable/i,
    "You used [ ] on something that doesn't support indexing (like an int). Only sequences/dicts can be indexed."],
  [/['"]?(\w+)['"]? object is not callable/i,
    "You put ( ) after something that isn't a function — maybe you reused a name for both a variable and a function."],
  [/['"]?(\w+)['"]? object is not iterable/i,
    "You tried to loop over something that can't be iterated (like an int). Loop over a list, string, range, etc."],
  [/['"]?(\w+)['"]? object has no attribute ['"]?(\w+)['"]?/i,
    "That object has no such method/attribute — check the spelling, or the type of the object."],
  [/takes \d+ positional argument(s)? but \d+ (was|were) given|missing \d+ required positional argument/i,
    "You called a function with the wrong number of arguments — check the function's definition."],
  [/No module named ['"]?(\w+)['"]?|ModuleNotFoundError/i,
    "That module isn't available — check the spelling, or it may not be installed on the server."],
  [/maximum recursion depth exceeded|RecursionError/i,
    "Your function calls itself with no stopping point — add a base case to end the recursion."],
  [/local variable ['"]?(\w+)['"]? referenced before assignment/i,
    "You read a variable before giving it a value on that code path — assign it first."],
  [/IndentationError/i,
    "Indentation problem — Python is strict about consistent spacing inside blocks."],
]

export function friendlyHint(message) {
  if (!message) return null
  for (const [re, tip] of RULES) {
    if (re.test(message)) return tip
  }
  return null
}

// Build an enriched marker message: the raw Python error text + a 💡 beginner tip.
export function enrichMessage(message) {
  const tip = friendlyHint(message)
  return tip ? `${message}\n💡 ${tip}` : message
}
