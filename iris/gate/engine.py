"""Deterministic completion gate for Finish With Me.

The IRIS business operation Finish.Gate.Operation executes this module with
Embedded Python. The same file runs under CPython for unit tests. It never
calls a model and never treats a proposal as completion by itself.
"""

from __future__ import annotations

import hashlib
import json
import math
import re

CONTEXT_FIELDS = (
    "title",
    "description",
    "blocker",
    "tried",
    "source",
    "material",
    "criteria",
    "subject",
)

TOTAL_CHECKS = (
    {"name": "Numeric strings add to 30", "input": ["10", "20"], "expected": 30},
    {"name": "An empty list returns zero", "input": [], "expected": 0},
    {"name": "Numbers and decimals work", "input": [10, "2.5", -1], "expected": 11.5},
    {"name": "Nonnumeric prices are rejected", "input": ["oops"], "throws": True},
    {"name": "Blank prices are rejected", "input": [" "], "throws": True},
    {"name": "Null prices are rejected", "input": [None], "throws": True},
    {"name": "Infinity is rejected", "input": ["Infinity"], "throws": True},
    {"name": "Non-array input is rejected", "input": None, "throws": True},
)

FORBIDDEN_TOKENS = {
    "eval",
    "Function",
    "require",
    "process",
    "fetch",
    "while",
    "for",
    "import",
    "XMLHttpRequest",
    "globalThis",
    "window",
    "document",
    "await",
    "class",
}


def decide(data: dict) -> dict:
    if not isinstance(data, dict):
        return pack("reject", "The work item was not an object.")
    action = data.get("action") or "investigate"
    if action in ("approve", "reject"):
        return decide_human(data)
    if action == "investigate":
        return decide_proposal(data)
    if action == "check":
        return decide_checks(data)
    if action == "verify":
        return decide_verify(data)
    if action == "assess":
        return decide_assess(data)
    return pack("reject", "The production does not recognize this decision action.")


def decide_human(data: dict) -> dict:
    human = data.get("humanAction") or data.get("action")
    if human not in ("approve", "reject"):
        return pack("reject", "Workflow approval must be approve or reject.")
    prior_action = data.get("priorAction") or ""
    if prior_action not in ("check", "verify", "assess"):
        return pack("reject", "Workflow approval is missing the evidence step it confirms.")
    replay = dict(data)
    replay["action"] = prior_action
    replay["humanAction"] = ""
    replay["approvalToken"] = ""
    current = decide(replay)
    if human == "reject":
        rejected = pack(
            "reject",
            "The reviewer rejected completion in the IRIS Workflow Engine. "
            + (current.get("reason") or "The work item stays open."),
        )
        rejected["checks"] = current.get("checks") or []
        return rejected
    if current.get("outcome") != "pending-approval":
        blocked = pack(
            current.get("outcome") or "needs-evidence",
            "Approval is closed because the IRIS gate no longer accepts this evidence. "
            + (current.get("reason") or ""),
        )
        blocked["checks"] = current.get("checks") or []
        return blocked
    expected = current.get("approvalToken") or ""
    presented = data.get("approvalToken") or ""
    if not expected or presented != expected:
        return pack("reject", "The approval token does not match the evidence the IRIS gate just checked.")
    completed = pack("complete", "Workflow approval matches a passing IRIS gate. Completion is granted.")
    completed["evidence"] = current.get("evidence") or {}
    completed["approvalToken"] = expected
    completed["checks"] = current.get("checks") or []
    completed["contextHash"] = current.get("contextHash") or ""
    return completed


def decide_proposal(data: dict) -> dict:
    profile = data.get("profile") or ""
    proposal = object_field(data, "proposal")
    if proposal is None:
        return pack("reject", "The agent did not return a proposal for the gate to judge.")
    if isinstance(proposal.get("error"), str) and proposal.get("error").strip():
        return pack("reject", proposal["error"].strip()[:500])
    tools = data.get("toolsUsed") if isinstance(data.get("toolsUsed"), list) else []
    if tools and "InspectTask" not in tools:
        return pack("reject", "The agent did not call InspectTask before proposing work.")
    if profile == "receipt-total":
        return propose_receipt(data, proposal, tools)
    if profile == "project":
        return propose_project(data, proposal, tools)
    if profile == "subject":
        return propose_lesson(data, proposal, tools)
    if profile == "integration":
        return propose_integration(data, proposal, tools)
    return pack("reject", "This work item profile has no IRIS completion gate.")


def propose_receipt(data, proposal, tools) -> dict:
    if tools and "PrepareCandidate" not in tools:
        return pack("reject", "The receipt-total agent did not call PrepareCandidate.")
    code = proposal.get("code") if isinstance(proposal.get("code"), str) else ""
    problem = receipt_shape(code)
    if problem:
        return pack("reject", problem)
    summary = clip(proposal.get("summary"), 4000) or "Prepared a repair for independent checks."
    if not summary:
        return pack("reject", "The receipt candidate is missing a summary.")
    return pack(
        "needs-evidence",
        "The agent stored a receipt-total candidate. The IRIS gate has not run the eight independent checks yet.",
        contextHash=hash_context(data),
    )


def propose_project(data, proposal, tools) -> dict:
    if tools and "PrepareProject" not in tools:
        return pack("reject", "The project agent did not call PrepareProject.")
    if proposal.get("tool") not in (None, "", "PrepareProject"):
        return pack("reject", "The project proposal used the wrong tool.")
    problem = bounded_text(proposal, ("summary", 6000), ("nextAction", 3000), ("artifact", 32000), ("verification", 8000))
    if problem:
        return pack("reject", problem)
    artifact = proposal["artifact"].strip()
    if artifact.startswith("diff ") or "<<<<<<<" in artifact or "\n@@" in artifact:
        return pack("reject", "The project artifact must be a complete file replacement, not a diff.")
    return pack(
        "needs-evidence",
        "The agent proposed one bounded change. Completion waits for verification evidence and workflow approval.",
        contextHash=hash_context(data),
    )


def propose_lesson(data, proposal, tools) -> dict:
    if tools and "PrepareLesson" not in tools:
        return pack("reject", "The study agent did not call PrepareLesson.")
    problem = bounded_text(
        proposal,
        ("explanation", 12000),
        ("guidedQuestion", 4000),
        ("guidedRubric", 6000),
        ("transferQuestion", 4000),
        ("transferRubric", 6000),
        ("sourceQuote", 2000),
    )
    if problem:
        return pack("reject", problem)
    material = data.get("material") if isinstance(data.get("material"), str) else ""
    if proposal["sourceQuote"].strip() not in material:
        return pack("reject", "The lesson did not cite an exact passage from the supplied material.")
    if proposal["guidedQuestion"].strip() == proposal["transferQuestion"].strip():
        return pack("reject", "The independent question must differ from the guided question.")
    return pack(
        "needs-evidence",
        "The lesson is grounded in the supplied material. The learner still has to answer the guided question and a different transfer question.",
        contextHash=hash_context(data),
    )


def propose_integration(data, proposal, tools) -> dict:
    source = data.get("source") if isinstance(data.get("source"), str) else ""
    if not failure_signature(source):
        return pack(
            "escalate",
            "This interoperability item has no transform or message-failure signature. It is escalated to Finish.Supervisor instead of being treated as a routine repair.",
            contextHash=hash_context(data),
        )
    if tools and "PrepareRepair" not in tools:
        return pack("reject", "The integration agent did not call PrepareRepair.")
    if proposal.get("tool") not in (None, "", "PrepareRepair"):
        return pack("reject", "The integration proposal used the wrong tool.")
    problem = bounded_text(proposal, ("summary", 6000), ("nextAction", 3000), ("artifact", 32000), ("verification", 8000))
    if problem:
        return pack("reject", problem)
    field = failed_field(source)
    if field and field not in proposal["artifact"]:
        return pack("reject", f"The repair must address the failed field {field} from the stuck message.")
    verification = proposal["verification"].lower()
    if not any(word in verification for word in ("replay", "resend", "reprocess")):
        return pack("reject", "The repair must tell the operator how to replay or resend the failed message.")
    if re.search(r"\b(already resent|message completed|production is fixed)\b", proposal["artifact"], re.I):
        return pack("reject", "The repair cannot claim the failed message was already resent or completed.")
    return pack(
        "needs-evidence",
        "The agent proposed a bounded transform repair. Completion waits for a recorded replay of the failed message and workflow approval.",
        contextHash=hash_context(data),
    )


def decide_checks(data: dict) -> dict:
    if (data.get("profile") or "") != "receipt-total":
        return pack("reject", "Independent receipt checks only apply to the receipt-total example.")
    proposal = object_field(data, "proposal") or {}
    code = data.get("candidate") if isinstance(data.get("candidate"), str) else proposal.get("code")
    if not isinstance(code, str):
        code = ""
    problem = receipt_shape(code)
    if problem:
        return pack("reject", problem)
    source = data.get("source") if isinstance(data.get("source"), str) else ""
    source_hash = proposal.get("sourceHash") if isinstance(proposal.get("sourceHash"), str) else data.get("sourceHash")
    if isinstance(source_hash, str) and source_hash and source_hash != sha256(source):
        return pack("reject", "The source changed after the candidate was prepared. Investigate it again.")
    checks = check_total(code)
    passed = all(item["passed"] for item in checks)
    attempts = number_field(data.get("attemptCount"))
    if passed:
        evidence = {
            "type": "iris-gate-checks",
            "hash": sha256(code),
            "count": len(checks),
            "contextHash": hash_context(data),
        }
        token = approval_token(data.get("taskId") or "", "receipt-total", evidence)
        ready = pack(
            "pending-approval",
            "All eight receipt checks passed inside the IRIS gate. A Workflow Engine reviewer must approve before completion.",
            checks=checks,
            evidence=evidence,
            approvalToken=token,
            contextHash=evidence["contextHash"],
        )
        return ready
    if attempts >= 2:
        return pack(
            "escalate",
            "The receipt candidate failed the IRIS gate three times. The work item is escalated to Finish.Supervisor.",
            checks=checks,
            contextHash=hash_context(data),
        )
    return pack(
        "needs-evidence",
        "The IRIS gate rejected the candidate. The failing checks stay open; nothing was approved.",
        checks=checks,
        contextHash=hash_context(data),
    )


def decide_verify(data: dict) -> dict:
    profile = data.get("profile") or ""
    if profile not in ("project", "integration"):
        return pack("reject", "Recorded verification is only for project and integration work.")
    proposal = object_field(data, "proposal") or {}
    incoming = object_field(data, "evidenceInput") or {}
    artifact = incoming.get("artifact") if isinstance(incoming.get("artifact"), str) else ""
    notes = incoming.get("evidence") if isinstance(incoming.get("evidence"), str) else ""
    if not artifact.strip() or len(artifact) > 32000:
        return pack("reject", "The verified artifact is missing or too large.")
    if incoming.get("confirmed") is not True:
        return pack("reject", "Confirm that the checks were run outside this app before the gate can accept them.")
    if not isinstance(incoming.get("passed"), bool):
        return pack("reject", "The verification result must say whether the checks passed.")
    context = hash_context(data)
    claimed = proposal.get("contextHash") if isinstance(proposal.get("contextHash"), str) else ""
    if claimed and claimed != context:
        return pack("reject", "The project context changed after the proposal. Investigate it again.")
    if len(notes.strip()) < 30 or len(notes) > 16000:
        return pack("reject", "Add the command or check, the outcome, and the relevant output (at least 30 characters).")
    attempts = number_field(data.get("attemptCount"))
    if incoming.get("passed") is not True:
        if attempts >= 2:
            return pack(
                "escalate",
                "Verification failed three times. The work item is escalated to Finish.Supervisor instead of being closed.",
                contextHash=context,
            )
        return pack(
            "needs-evidence",
            "Recorded checks still fail. The IRIS gate keeps the work item open.",
            contextHash=context,
        )
    if profile == "integration":
        source = data.get("source") if isinstance(data.get("source"), str) else ""
        if not failure_signature(source):
            return pack("escalate", "Replay evidence arrived without a failed-message signature. Finish.Supervisor must review it.")
        field = failed_field(source)
        if field and field not in artifact:
            return pack("reject", f"The replayed repair no longer mentions the failed field {field}.")
        if not re.search(r"replay|resend|reprocess", notes, re.I):
            return pack("reject", "Integration evidence must record the replay, resend, or reprocess result.")
    evidence = {
        "type": "iris-gate-verification",
        "contextHash": context,
        "artifactHash": sha256(artifact),
        "notes": notes.strip(),
        "profile": profile,
    }
    token = approval_token(str(data.get("taskId") or ""), profile, evidence)
    return pack(
        "pending-approval",
        "The IRIS gate accepted the recorded evidence. Completion still requires Workflow Engine approval.",
        evidence=evidence,
        approvalToken=token,
        contextHash=context,
    )


def decide_assess(data: dict) -> dict:
    proposal = object_field(data, "proposal") or {}
    tools = data.get("toolsUsed") if isinstance(data.get("toolsUsed"), list) else []
    if tools and "AssessAnswer" not in tools:
        return pack("reject", "The assessor did not call AssessAnswer.")
    if not isinstance(proposal.get("passed"), bool):
        return pack("reject", "The assessor did not return a boolean pass/fail result.")
    feedback = proposal.get("feedback") if isinstance(proposal.get("feedback"), str) else ""
    if not feedback.strip() or len(feedback) > 6000:
        return pack("reject", "The assessment feedback is missing or too large.")
    phase = data.get("phase") if data.get("phase") in ("guided", "transfer") else ""
    if not phase:
        return pack("reject", "The study assessment is missing its phase.")
    material = data.get("material") if isinstance(data.get("material"), str) else ""
    if not material.strip():
        return pack("reject", "Study assessment requires the original material.")
    context = hash_context(data)
    if proposal.get("passed") is not True:
        return pack(
            "needs-evidence",
            "The IRIS gate kept the study open because the assessed answer was not accepted.",
            contextHash=context,
        )
    if phase == "guided":
        return pack(
            "needs-evidence",
            "The guided answer was accepted. The independent transfer question is still required before approval.",
            advance="transfer",
            contextHash=context,
        )
    answer = data.get("answer") if isinstance(data.get("answer"), str) else ""
    question = data.get("question") if isinstance(data.get("question"), str) else ""
    if not answer.strip() or not question.strip():
        return pack("reject", "The transfer assessment is missing the question or the answer.")
    evidence = {
        "type": "iris-gate-transfer",
        "contextHash": context,
        "question": question.strip()[:4000],
        "answer": answer.strip()[:8000],
        "feedback": feedback.strip(),
    }
    token = approval_token(str(data.get("taskId") or ""), "subject", evidence)
    return pack(
        "pending-approval",
        "The independent answer was accepted. A Workflow Engine reviewer must approve before the study is complete.",
        evidence=evidence,
        approvalToken=token,
        contextHash=context,
    )


def pack(outcome: str, reason: str, **extra) -> dict:
    return {
        "outcome": outcome,
        "reason": reason.strip(),
        "checks": extra.get("checks") or [],
        "approvalToken": extra.get("approvalToken") or "",
        "evidence": extra.get("evidence") or {},
        "advance": extra.get("advance") or "",
        "contextHash": extra.get("contextHash") or "",
    }


def object_field(data: dict, key: str):
    value = data.get(key)
    return value if isinstance(value, dict) else None


def number_field(value) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return 0
    if isinstance(value, float) and not value.is_integer():
        return 0
    return max(0, int(value))


def clip(value, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    text = value.strip()
    if not text or len(text) > limit:
        return ""
    return text


def bounded_text(proposal: dict, *fields: tuple[str, int]) -> str:
    for name, limit in fields:
        if not clip(proposal.get(name), limit):
            return f"The proposal field {name} is missing, blank, or longer than {limit} characters."
    return ""


def hash_context(data: dict) -> str:
    parts = []
    for key in CONTEXT_FIELDS:
        value = data.get(key)
        parts.append(value if isinstance(value, str) else "")
    raw = json.dumps(parts, separators=(",", ":"), ensure_ascii=False)
    return sha256(raw)


def context_hash(data: dict) -> str:
    return hash_context(data)


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def approval_token(task_id: str, profile: str, evidence: dict) -> str:
    raw = json.dumps(
        [task_id, profile, evidence.get("type"), evidence.get("hash"), evidence.get("artifactHash"), evidence.get("contextHash"), evidence.get("question"), evidence.get("answer")],
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return sha256(raw)[:32]


def failure_signature(source: str) -> bool:
    return bool(re.search(r"ERROR|failed|Transform", source or "", re.I))


def failed_field(source: str) -> str:
    match = re.search(r"Field\s+([A-Za-z_][A-Za-z0-9_]*)\s+is empty", source or "")
    if match:
        return match.group(1)
    if "RequiredField" in (source or ""):
        return "RequiredField"
    return ""


def receipt_shape(code: str) -> str:
    if not isinstance(code, str) or not code.strip() or len(code) > 12000:
        return "The receipt candidate must be nonempty JavaScript of at most 12,000 characters."
    try:
        tokens = tokenize(code)
    except GateParseError as exc:
        return str(exc)
    if "function" not in tokens or "total" not in tokens:
        return "The candidate must contain function total."
    for token in tokens:
        if token in FORBIDDEN_TOKENS:
            return f"The receipt contract does not allow {token}."
    return ""


class Undefined:
    def __repr__(self) -> str:
        return "undefined"


UNDEFINED = Undefined()


class UserThrown(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.user_thrown = True


class GateParseError(Exception):
    pass


class InterpreterError(Exception):
    pass


class ReturnSignal(Exception):
    def __init__(self, value):
        self.value = value


class Native:
    def __init__(self, fn, name: str):
        self.fn = fn
        self.name = name


class FunctionValue:
    def __init__(self, params, body, scope):
        self.params = params
        self.body = body
        self.scope = scope


class Scope:
    def __init__(self, parent=None):
        self.parent = parent
        self.values = {}

    def get(self, key):
        if key in self.values:
            return self.values[key]
        if self.parent:
            return self.parent.get(key)
        raise InterpreterError(f"Unknown identifier: {key}")

    def set(self, key, value):
        self.values[key] = value


def check_total(source: str) -> list[dict]:
    return [_run_case(source, case) for case in TOTAL_CHECKS]


def _run_case(source: str, case: dict) -> dict:
    expected = "An input validation error" if case.get("throws") else _show(case.get("expected"))
    try:
        value = evaluate_total(source, case.get("input"))
        passed = (not case.get("throws")) and _is_num(value) and value == case.get("expected")
        return {"name": case["name"], "passed": passed, "actual": _show(value), "expected": expected}
    except UserThrown as exc:
        return {"name": case["name"], "passed": bool(case.get("throws")), "actual": str(exc), "expected": expected}
    except Exception as exc:
        return {"name": case["name"], "passed": False, "actual": str(exc), "expected": expected}


def evaluate_total(source: str, argument):
    parser = Parser(tokenize(source))
    program = parser.parse_program()
    if program[1] != "total" or program[2] != ["prices"]:
        raise InterpreterError("Use one function: export function total(prices) { … }.")
    root = Scope()
    number_fn = Native(_js_number, "Number")
    string_fn = Native(_js_string, "String")
    root.set("Number", number_fn)
    root.set("String", string_fn)
    root.set("Array", Native(lambda: None, "Array"))
    root.set("Error", Native(lambda message="": UserThrown(_js_string(message)), "Error"))
    root.set("TypeError", Native(lambda message="": UserThrown(_js_string(message)), "TypeError"))
    root.set("undefined", UNDEFINED)
    root.set("NaN", float("nan"))
    budget = {"left": 5000}
    return _call(FunctionValue(program[2], program[3], root), [argument], root, budget)


def _show(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is UNDEFINED:
        return "undefined"
    if value is None:
        return "null"
    if _is_num(value):
        if isinstance(value, float) and math.isnan(value):
            return "NaN"
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value)
    return str(value)


def tokenize(source: str) -> list[str]:
    pattern = re.compile(
        r"\s+|//[^\n]*|/\*.*?\*/|=>|===|!==|==|!=|<=|>=|&&|\|\||\?\?|\?\."
        r"|[{}()\[\],.;:+\-*/!<>?:=]"
        r"|[A-Za-z_$][\w$]*"
        r"|'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\""
        r"|\d+\.\d+|\d+",
        re.S,
    )
    tokens = []
    index = 0
    while index < len(source):
        match = pattern.match(source, index)
        if not match:
            raise GateParseError(f"Unsupported character in candidate near {source[index:index+12]!r}.")
        token = match.group(0)
        index = match.end()
        if token.startswith("?.") or token == "?.":
            raise GateParseError("Optional chaining is outside the receipt-total subset.")
        if token[0].isspace() or token.startswith("//") or token.startswith("/*"):
            continue
        tokens.append(token)
    return tokens


class Parser:
    def __init__(self, tokens: list[str]):
        self.tokens = tokens
        self.i = 0

    @property
    def tok(self):
        return self.tokens[self.i] if self.i < len(self.tokens) else None

    def consume(self):
        token = self.tok
        self.i += 1
        return token

    def expect(self, value: str):
        if self.tok != value:
            raise GateParseError(f"Expected {value} and found {self.tok}.")
        return self.consume()

    def parse_program(self):
        if self.tok == "export":
            self.consume()
        if self.tok != "function":
            raise GateParseError("The candidate must be export function total(prices).")
        self.consume()
        name = self._ident()
        self.expect("(")
        params = []
        if self.tok != ")":
            params.append(self._ident())
            while self.tok == ",":
                self.consume()
                params.append(self._ident())
        self.expect(")")
        body = self.parse_block()
        if self.tok is not None:
            raise GateParseError("Only one total function is allowed.")
        return ("function", name, params, body)

    def parse_block(self):
        self.expect("{")
        statements = []
        while self.tok not in ("}", None):
            statements.append(self.parse_stmt())
        self.expect("}")
        return ("block", statements)

    def parse_stmt(self):
        if self.tok == "{":
            return self.parse_block()
        if self.tok == "if":
            self.consume()
            self.expect("(")
            test = self.parse_expr()
            self.expect(")")
            consequent = self.parse_stmt()
            alternate = None
            if self.tok == "else":
                self.consume()
                alternate = self.parse_stmt()
            return ("if", test, consequent, alternate)
        if self.tok == "return":
            self.consume()
            value = None if self.tok in (";", "}") else self.parse_expr()
            self._semi()
            return ("return", value)
        if self.tok == "throw":
            self.consume()
            value = self.parse_expr()
            self._semi()
            return ("throw", value)
        if self.tok in ("const", "let", "var"):
            self.consume()
            name = self._ident()
            self.expect("=")
            value = self.parse_expr()
            self._semi()
            return ("const", name, value)
        value = self.parse_expr()
        self._semi()
        return ("expr", value)

    def _semi(self):
        if self.tok == ";":
            self.consume()

    def _ident(self) -> str:
        token = self.tok
        if not token or not re.match(r"[A-Za-z_$][\w$]*$", token) or token in _KEYWORDS:
            raise GateParseError(f"Expected a name and found {token}.")
        self.consume()
        return token

    def parse_expr(self):
        return self._ternary()

    def _ternary(self):
        value = self._nullish()
        if self.tok == "?":
            self.consume()
            yes = self.parse_expr()
            self.expect(":")
            no = self.parse_expr()
            return ("ternary", value, yes, no)
        return value

    def _nullish(self):
        value = self._or()
        while self.tok == "??":
            op = self.consume()
            value = ("binary", op, value, self._or())
        return value

    def _or(self):
        value = self._and()
        while self.tok == "||":
            op = self.consume()
            value = ("binary", op, value, self._and())
        return value

    def _and(self):
        value = self._equality()
        while self.tok == "&&":
            op = self.consume()
            value = ("binary", op, value, self._equality())
        return value

    def _equality(self):
        value = self._compare()
        while self.tok in ("===", "!==", "==", "!="):
            op = self.consume()
            value = ("binary", op, value, self._compare())
        return value

    def _compare(self):
        value = self._add()
        while self.tok in ("<", ">", "<=", ">="):
            op = self.consume()
            value = ("binary", op, value, self._add())
        return value

    def _add(self):
        value = self._mul()
        while self.tok in ("+", "-"):
            op = self.consume()
            value = ("binary", op, value, self._mul())
        return value

    def _mul(self):
        value = self._unary()
        while self.tok in ("*", "/"):
            op = self.consume()
            value = ("binary", op, value, self._unary())
        return value

    def _unary(self):
        if self.tok == "new":
            self.consume()
            callee = self._member_base()
            args = self._args() if self.tok == "(" else []
            return ("new", callee, args)
        if self.tok in ("!", "+", "-"):
            op = self.consume()
            return ("unary", op, self._unary())
        if self.tok == "typeof":
            self.consume()
            return ("typeof", self._unary())
        return self._postfix()

    def _postfix(self):
        value = self._primary()
        while self.tok in (".", "(", "["):
            if self.tok == ".":
                self.consume()
                value = ("member", value, self._ident())
            elif self.tok == "[":
                self.consume()
                key = self.parse_expr()
                self.expect("]")
                value = ("index", value, key)
            else:
                value = ("call", value, self._args())
        return value

    def _member_base(self):
        value = self._primary()
        while self.tok == ".":
            self.consume()
            value = ("member", value, self._ident())
        return value

    def _primary(self):
        token = self.tok
        if token is None:
            raise GateParseError("The candidate ended inside an expression.")
        if token == "(" and self._arrow_ahead():
            params = self._params()
            self.expect("=>")
            body = self.parse_block() if self.tok == "{" else ("return", self.parse_expr())
            return ("arrow", params, body)
        if re.match(r"[A-Za-z_$][\w$]*$", token) and self.i + 1 < len(self.tokens) and self.tokens[self.i + 1] == "=>":
            name = self._ident()
            self.expect("=>")
            body = self.parse_block() if self.tok == "{" else ("return", self.parse_expr())
            return ("arrow", [name], body)
        if token == "(":
            self.consume()
            value = self.parse_expr()
            self.expect(")")
            return value
        if token == "[":
            self.consume()
            items = []
            while self.tok != "]":
                items.append(self.parse_expr())
                if self.tok == ",":
                    self.consume()
                elif self.tok != "]":
                    raise GateParseError("Expected ] in an array.")
            self.expect("]")
            return ("array", items)
        if token in ("true", "false", "null", "undefined"):
            self.consume()
            return ("literal", {"true": True, "false": False, "null": None, "undefined": UNDEFINED}[token])
        if token[:1] in ("'", '"'):
            self.consume()
            return ("literal", _decode_string(token))
        if re.match(r"\d", token):
            self.consume()
            return ("literal", float(token) if "." in token else int(token))
        if re.match(r"[A-Za-z_$][\w$]*$", token):
            self.consume()
            return ("name", token)
        raise GateParseError(f"Unsupported syntax near {token}.")

    def _params(self) -> list[str]:
        self.expect("(")
        params = []
        if self.tok != ")":
            params.append(self._ident())
            while self.tok == ",":
                self.consume()
                params.append(self._ident())
        self.expect(")")
        return params

    def _args(self) -> list:
        self.expect("(")
        args = []
        if self.tok != ")":
            args.append(self.parse_expr())
            while self.tok == ",":
                self.consume()
                args.append(self.parse_expr())
        self.expect(")")
        return args

    def _arrow_ahead(self) -> bool:
        depth = 0
        j = self.i
        while j < len(self.tokens):
            token = self.tokens[j]
            if token == "(":
                depth += 1
            elif token == ")":
                depth -= 1
                if depth == 0:
                    return j + 1 < len(self.tokens) and self.tokens[j + 1] == "=>"
            elif token in ("{", "=>") and depth <= 1:
                return False
            j += 1
        return False


_KEYWORDS = {
    "export", "function", "return", "throw", "if", "else", "const", "let", "var",
    "new", "typeof", "true", "false", "null", "undefined", "for", "while", "import",
}


def _decode_string(token: str) -> str:
    body = bytes(token[1:-1], "utf-8").decode("unicode_escape")
    return body


def _is_num(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _js_number(value):
    if isinstance(value, bool) or value is UNDEFINED:
        if value is UNDEFINED:
            return float("nan")
        return 1 if value else 0
    if value is None:
        return 0
    if _is_num(value):
        return value
    if isinstance(value, str):
        text = value.strip()
        if text == "":
            return 0
        if re.fullmatch(r"[+-]?(?:\d+\.\d+|\d+|\.\d+)(?:[eE][+-]?\d+)?", text):
            number = float(text)
            return int(number) if number.is_integer() and "e" not in text.lower() and "." not in text else number
        if text == "Infinity":
            return float("inf")
        if text == "-Infinity":
            return float("-inf")
        return float("nan")
    return float("nan")


def _js_string(value) -> str:
    if value is None:
        return "null"
    if value is UNDEFINED:
        return "undefined"
    if isinstance(value, bool):
        return "true" if value else "false"
    if _is_num(value):
        if isinstance(value, float) and math.isnan(value):
            return "NaN"
        if isinstance(value, float) and math.isinf(value):
            return "Infinity" if value > 0 else "-Infinity"
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value)
    if isinstance(value, list):
        return ",".join(_js_string(item) for item in value)
    if isinstance(value, UserThrown):
        return str(value)
    return str(value)


def _truthy(value) -> bool:
    if value is None or value is UNDEFINED or value is False:
        return False
    if value is True:
        return True
    if _is_num(value):
        if isinstance(value, float) and (math.isnan(value) or value == 0):
            return False
        return value != 0
    if isinstance(value, str):
        return value != ""
    return True


def _strict_equal(left, right) -> bool:
    if isinstance(left, bool) or isinstance(right, bool):
        return isinstance(left, bool) and isinstance(right, bool) and left == right
    if left is UNDEFINED or right is UNDEFINED:
        return left is UNDEFINED and right is UNDEFINED
    if left is None or right is None:
        return left is None and right is None
    if _is_num(left) and _is_num(right):
        if isinstance(left, float) and math.isnan(left):
            return False
        if isinstance(right, float) and math.isnan(right):
            return False
        return left == right
    if isinstance(left, str) or isinstance(right, str):
        return isinstance(left, str) and isinstance(right, str) and left == right
    return left is right


def _call(fn, args, root: Scope, budget: dict):
    if isinstance(fn, Native):
        return fn.fn(*args)
    if not isinstance(fn, FunctionValue):
        raise InterpreterError("Only supported functions may be called.")
    scope = Scope(fn.scope)
    for index, name in enumerate(fn.params):
        scope.set(name, args[index] if index < len(args) else UNDEFINED)
    try:
        _exec(fn.body, scope, root, budget)
    except ReturnSignal as signal:
        return signal.value
    return UNDEFINED


def _exec(node, scope: Scope, root: Scope, budget: dict):
    kind = node[0]
    if kind == "block":
        local = Scope(scope)
        for statement in node[1]:
            _exec(statement, local, root, budget)
        return
    if kind == "return":
        raise ReturnSignal(_eval(node[1], scope, root, budget) if node[1] is not None else UNDEFINED)
    if kind == "throw":
        value = _eval(node[1], scope, root, budget)
        if isinstance(value, UserThrown):
            raise value
        raise UserThrown(_js_string(value))
    if kind == "if":
        if _truthy(_eval(node[1], scope, root, budget)):
            _exec(node[2], scope, root, budget)
        elif node[3] is not None:
            _exec(node[3], scope, root, budget)
        return
    if kind == "const":
        scope.set(node[1], _eval(node[2], scope, root, budget))
        return
    if kind == "expr":
        _eval(node[1], scope, root, budget)
        return
    raise InterpreterError(f"Unsupported statement {kind}.")


def _eval(node, scope: Scope, root: Scope, budget: dict):
    if node is None:
        return UNDEFINED
    budget["left"] -= 1
    if budget["left"] < 0:
        raise InterpreterError("Execution limit reached.")
    kind = node[0]
    if kind == "literal":
        return node[1]
    if kind == "name":
        return scope.get(node[1])
    if kind == "array":
        return [_eval(item, scope, root, budget) for item in node[1]]
    if kind == "unary":
        value = _eval(node[2], scope, root, budget)
        if node[1] == "!":
            return not _truthy(value)
        if node[1] == "+":
            return _js_number(value)
        if node[1] == "-":
            number = _js_number(value)
            return -number
        raise InterpreterError("Unsupported unary operator.")
    if kind == "typeof":
        return _typeof(_eval(node[1], scope, root, budget))
    if kind == "ternary":
        chosen = node[2] if _truthy(_eval(node[1], scope, root, budget)) else node[3]
        return _eval(chosen, scope, root, budget)
    if kind == "binary":
        return _binary(node[1], node[2], node[3], scope, root, budget)
    if kind == "arrow":
        return FunctionValue(node[1], node[2], scope)
    if kind == "member":
        return _member(_eval(node[1], scope, root, budget), node[2], root)
    if kind == "index":
        return _index(_eval(node[1], scope, root, budget), _eval(node[2], scope, root, budget))
    if kind == "call":
        callee = _eval(node[1], scope, root, budget)
        args = [_eval(arg, scope, root, budget) for arg in node[2]]
        return _invoke(callee, args, root, budget)
    if kind == "new":
        callee = _eval(node[1], scope, root, budget)
        args = [_eval(arg, scope, root, budget) for arg in node[2]]
        if isinstance(callee, Native) and callee.name in ("Error", "TypeError"):
            return callee.fn(*args)
        raise InterpreterError("Only Error and TypeError may be constructed.")
    raise InterpreterError(f"Unsupported expression {kind}.")


def _typeof(value) -> str:
    if value is UNDEFINED:
        return "undefined"
    if value is None:
        return "object"
    if isinstance(value, bool):
        return "boolean"
    if _is_num(value):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, (FunctionValue, Native)):
        return "function"
    return "object"


def _binary(op, left_node, right_node, scope, root, budget):
    left = _eval(left_node, scope, root, budget)
    if op == "&&":
        return left if not _truthy(left) else _eval(right_node, scope, root, budget)
    if op == "||":
        return left if _truthy(left) else _eval(right_node, scope, root, budget)
    if op == "??":
        return _eval(right_node, scope, root, budget) if left is None or left is UNDEFINED else left
    right = _eval(right_node, scope, root, budget)
    if op == "+":
        if isinstance(left, str) or isinstance(right, str):
            return _js_string(left) + _js_string(right)
        return _js_number(left) + _js_number(right)
    if op in ("-", "*", "/"):
        numbers = {"-": lambda a, b: a - b, "*": lambda a, b: a * b, "/": lambda a, b: a / b}
        return numbers[op](_js_number(left), _js_number(right))
    if op == "===":
        return _strict_equal(left, right)
    if op == "!==":
        return not _strict_equal(left, right)
    if op == "==":
        return _js_number(left) == _js_number(right) if not (isinstance(left, str) and isinstance(right, str)) else left == right
    if op == "!=":
        return not _binary("==", ("literal", left), ("literal", right), scope, root, budget)
    if op in ("<", ">", "<=", ">="):
        if isinstance(left, str) and isinstance(right, str):
            pair = (left, right)
        else:
            pair = (_js_number(left), _js_number(right))
        return { "<": pair[0] < pair[1], ">": pair[0] > pair[1], "<=": pair[0] <= pair[1], ">=": pair[0] >= pair[1] }[op]
    raise InterpreterError(f"Unsupported operator {op}.")


def _index(obj, key):
    if isinstance(obj, list) and _is_num(key):
        index = int(key)
        if 0 <= index < len(obj):
            return obj[index]
        return UNDEFINED
    if isinstance(obj, str) and _is_num(key):
        index = int(key)
        if 0 <= index < len(obj):
            return obj[index]
        return UNDEFINED
    raise InterpreterError("Unsupported index.")


def _number_is_finite(value) -> bool:
    return _is_num(value) and not (isinstance(value, float) and (math.isnan(value) or math.isinf(value)))


def _member(obj, name: str, root: Scope):
    if isinstance(obj, Native) and obj.name == "Number" and name == "isFinite":
        return Native(_number_is_finite, "isFinite")
    if isinstance(obj, Native) and obj.name == "Array" and name == "isArray":
        return Native(lambda value: isinstance(value, list), "isArray")
    if isinstance(obj, list) and name == "reduce":
        return ("reduce", obj)
    if isinstance(obj, str) and name == "trim":
        return Native(lambda text=obj: text.strip(), "trim")
    if isinstance(obj, (list, str)) and name == "length":
        return len(obj)
    raise InterpreterError(f"Unsupported member: {name}")


def _invoke(callee, args, root, budget):
    if isinstance(callee, tuple) and callee and callee[0] == "reduce":
        if not args:
            raise InterpreterError("reduce requires a callback.")
        initial = args[1] if len(args) > 1 else UNDEFINED
        array = callee[1]
        if len(array) > 100:
            raise InterpreterError("Input limit reached.")
        if initial is UNDEFINED:
            raise InterpreterError("reduce requires an initial value.")
        accumulator = initial
        for index, item in enumerate(array):
            accumulator = _call(args[0], [accumulator, item, index], root, budget)
        return accumulator
    if isinstance(callee, Native):
        return callee.fn(*args)
    return _call(callee, args, root, budget)
