import json
import unittest

from engine import check_total, context_hash, decide

FIXED_TOTAL = """export function total(prices) {
  if (!Array.isArray(prices)) throw new TypeError('Expected an array');
  return prices.reduce((sum, price) => {
    if ((typeof price !== 'number' && typeof price !== 'string') || String(price).trim() === '') {
      throw new TypeError('Invalid price');
    }
    const amount = Number(price);
    if (!Number.isFinite(amount)) throw new TypeError('Invalid price');
    return sum + amount;
  }, 0);
}"""

LIVE_CANDIDATE = """export function total(prices) {
  if (!Array.isArray(prices)) throw new TypeError("prices must be an array");
  return prices.reduce((sum, price) => {
    if (price === null || price === undefined || typeof price === "boolean" || typeof price === "object") throw new Error("Invalid price");
    const s = String(price).trim();
    if (s === "") throw new Error("Invalid price");
    const n = Number(price);
    if (!Number.isFinite(n)) throw new Error("Invalid price");
    return sum + n;
  }, 0);
}"""

PROJECT = {
    "action": "investigate",
    "taskId": "task-1",
    "kind": "coding",
    "profile": "project",
    "title": "Fix pagination",
    "description": "Second page",
    "blocker": "The slice ends early.",
    "tried": "I read the function.",
    "source": "def page(items, start, limit):\n    return items[start:limit]",
    "material": "",
    "criteria": "Return limit items from start.",
    "subject": "Python",
    "toolsUsed": ["InspectTask", "PrepareProject"],
    "proposal": {
        "tool": "PrepareProject",
        "summary": "Fix the slice endpoint.",
        "nextAction": "Apply the file and run the pagination check.",
        "artifact": "def page(items, start, limit):\n    return items[start:start + limit]",
        "verification": "Check page([0,1,2,3], 2, 2) == [2, 3].",
    },
}


class GateTests(unittest.TestCase):
    def test_receipt_candidates_pass_the_eight_checks(self):
        for source in (FIXED_TOTAL, LIVE_CANDIDATE, FIXED_TOTAL.replace("Invalid price", "Price is invalid").replace("Expected an array", "Input must be a list")):
            checks = check_total(source)
            self.assertEqual([item["name"] for item in checks if not item["passed"]], [])

    def test_unsupported_javascript_cannot_count_as_validation(self):
        checks = check_total("export function total(prices) { return process.exit(); }")
        self.assertTrue(all(item["passed"] is False for item in checks))

    def test_project_proposal_needs_evidence_and_approval_is_stable(self):
        proposed = decide(PROJECT)
        self.assertEqual(proposed["outcome"], "needs-evidence")
        evidence = dict(PROJECT)
        evidence["action"] = "verify"
        evidence["attemptCount"] = 0
        evidence["proposal"] = {**PROJECT["proposal"], "contextHash": context_hash(PROJECT)}
        evidence["evidenceInput"] = {
            "artifact": PROJECT["proposal"]["artifact"],
            "evidence": "pytest pagination: 8 passed; inspected the second page.",
            "confirmed": True,
            "passed": True,
        }
        accepted = decide(evidence)
        self.assertEqual(accepted["outcome"], "pending-approval")
        self.assertEqual(accepted["approvalToken"], decide(evidence)["approvalToken"])
        approved = decide({**evidence, "action": "approve", "priorAction": "verify", "humanAction": "approve", "approvalToken": accepted["approvalToken"]})
        self.assertEqual(approved["outcome"], "complete")
        rejected = decide({**evidence, "action": "reject", "priorAction": "verify", "humanAction": "reject", "approvalToken": accepted["approvalToken"]})
        self.assertEqual(rejected["outcome"], "reject")
        stale = decide({**evidence, "action": "approve", "priorAction": "verify", "humanAction": "approve", "approvalToken": "not-the-token"})
        self.assertEqual(stale["outcome"], "reject")

    def test_failed_verification_stays_open_and_the_third_failure_escalates(self):
        payload = dict(PROJECT)
        payload["action"] = "verify"
        payload["proposal"] = {**PROJECT["proposal"], "contextHash": context_hash(PROJECT)}
        payload["evidenceInput"] = {
            "artifact": PROJECT["proposal"]["artifact"],
            "evidence": "pytest: test_second_page still fails with an empty result.",
            "confirmed": True,
            "passed": False,
        }
        self.assertEqual(decide({**payload, "attemptCount": 0})["outcome"], "needs-evidence")
        self.assertEqual(decide({**payload, "attemptCount": 1})["outcome"], "needs-evidence")
        self.assertEqual(decide({**payload, "attemptCount": 2})["outcome"], "escalate")

    def test_short_or_unconfirmed_evidence_is_rejected(self):
        payload = dict(PROJECT)
        payload["action"] = "verify"
        payload["proposal"] = {**PROJECT["proposal"], "contextHash": context_hash(PROJECT)}
        payload["evidenceInput"] = {"artifact": PROJECT["proposal"]["artifact"], "evidence": "looks fine", "confirmed": True, "passed": True}
        self.assertEqual(decide(payload)["outcome"], "reject")
        payload["evidenceInput"] = {"artifact": PROJECT["proposal"]["artifact"], "evidence": "pytest pagination: 8 passed; inspected the second page.", "confirmed": False, "passed": True}
        self.assertEqual(decide(payload)["outcome"], "reject")

    def test_receipt_check_routes_pass_and_fail(self):
        base = {"action": "check", "profile": "receipt-total", "kind": "coding", "taskId": "r1", "title": "t", "description": "", "blocker": "strings", "tried": "", "source": "export function total(prices){return prices;}", "material": "", "criteria": "", "subject": "", "attemptCount": 0, "candidate": FIXED_TOTAL, "proposal": {"code": FIXED_TOTAL, "sourceHash": __import__("hashlib").sha256(b"export function total(prices){return prices;}").hexdigest()}}
        # source hash must match the actual source, so drop the mismatched hash
        base["proposal"] = {"code": FIXED_TOTAL}
        passed = decide(base)
        self.assertEqual(passed["outcome"], "pending-approval")
        self.assertEqual(len(passed["checks"]), 8)
        failed = decide({**base, "candidate": "export function total(prices) { return prices.reduce((sum, price) => sum + price, 0); }"})
        self.assertEqual(failed["outcome"], "needs-evidence")
        self.assertEqual(decide({**base, "attemptCount": 2, "candidate": "export function total(prices) { return 0; }"})["outcome"], "escalate")

    def test_lesson_and_assessment_gate(self):
        lesson = {
            "action": "investigate",
            "profile": "subject",
            "kind": "study",
            "taskId": "s1",
            "title": "Photosynthesis",
            "description": "",
            "blocker": "I cannot explain the conversion.",
            "tried": "",
            "source": "",
            "material": "Plants convert light energy into chemical energy.",
            "criteria": "",
            "subject": "Biology",
            "toolsUsed": ["InspectTask", "PrepareLesson"],
            "proposal": {
                "tool": "PrepareLesson",
                "explanation": "Plants store energy from light.",
                "guidedQuestion": "What conversion occurs?",
                "guidedRubric": "Light to chemical energy",
                "transferQuestion": "What happens to stored energy without light?",
                "transferRubric": "No further light-driven conversion",
                "sourceQuote": "Plants convert light energy into chemical energy.",
            },
        }
        self.assertEqual(decide(lesson)["outcome"], "needs-evidence")
        copied = json.loads(json.dumps(lesson))
        copied["proposal"]["sourceQuote"] = "A sentence that is not in the notes."
        self.assertEqual(decide(copied)["outcome"], "reject")
        copied["proposal"]["sourceQuote"] = lesson["proposal"]["sourceQuote"]
        copied["proposal"]["transferQuestion"] = copied["proposal"]["guidedQuestion"]
        self.assertEqual(decide(copied)["outcome"], "reject")
        assess = {
            "action": "assess",
            "profile": "subject",
            "kind": "study-review",
            "taskId": "s1",
            "phase": "guided",
            "title": lesson["title"],
            "description": "",
            "blocker": lesson["blocker"],
            "tried": "",
            "source": "",
            "material": lesson["material"],
            "criteria": "",
            "subject": "Biology",
            "question": "What conversion occurs?",
            "answer": "Light becomes chemical energy.",
            "toolsUsed": ["InspectTask", "AssessAnswer"],
            "proposal": {"tool": "AssessAnswer", "passed": False, "feedback": "Name the conversion."},
        }
        self.assertEqual(decide(assess)["outcome"], "needs-evidence")
        self.assertEqual(decide({**assess, "proposal": {"tool": "AssessAnswer", "passed": True, "feedback": "Correct conversion."}})["advance"], "transfer")
        transfer = {**assess, "phase": "transfer", "question": "What happens without light?", "answer": "It stops storing new light energy.", "proposal": {"tool": "AssessAnswer", "passed": True, "feedback": "Correct application."}}
        self.assertEqual(decide(transfer)["outcome"], "pending-approval")

    def test_integration_failure_routes_repair_replay_and_escalation(self):
        source = "ERROR #5001: Transform Finish.RecordToTarget failed\nField RequiredField is empty\n"
        item = {
            "action": "investigate",
            "profile": "integration",
            "kind": "coding",
            "taskId": "m1",
            "title": "Stuck transform",
            "description": "Message 1042",
            "blocker": "The message is stuck after the transform.",
            "tried": "I opened the trace.",
            "source": source,
            "material": "",
            "criteria": "Replay after RequiredField is set.",
            "subject": "IRIS",
            "toolsUsed": ["InspectTask", "PrepareRepair"],
            "proposal": {
                "tool": "PrepareRepair",
                "summary": "Default RequiredField when the source field is empty.",
                "nextAction": "Apply the mapping, then replay message 1042.",
                "artifact": "Set target.RequiredField = source.RequiredField\nIf source.RequiredField = \"\" Set target.RequiredField = \"UNKNOWN\"",
                "verification": "Replay message 1042 and confirm Finish.Target is created.",
            },
        }
        self.assertEqual(decide(item)["outcome"], "needs-evidence")
        plain = dict(item)
        plain["source"] = "The service is a little slow today."
        self.assertEqual(decide(plain)["outcome"], "escalate")
        verify = dict(item)
        verify["action"] = "verify"
        verify["evidenceInput"] = {"artifact": item["proposal"]["artifact"], "evidence": "Replayed message 1042. Finish.Target was created with RequiredField UNKNOWN.", "confirmed": True, "passed": True}
        self.assertEqual(decide(verify)["outcome"], "pending-approval")
        verify["evidenceInput"] = {**verify["evidenceInput"], "evidence": "I looked at the screen and it seemed better than before."}
        self.assertEqual(decide(verify)["outcome"], "reject")

    def test_agent_routes_hint_and_human_before_a_repair(self):
        hinted = decide({**PROJECT, "route": {"action": "hint", "reason": "Learner asked for a nudge", "hint": "Check the slice end."}})
        self.assertEqual(hinted["outcome"], "needs-evidence")
        self.assertEqual(hinted["route"]["action"], "hint")
        human = decide({**PROJECT, "route": {"action": "human", "reason": "Repository files were not fetched."}})
        self.assertEqual(human["outcome"], "escalate")
        self.assertEqual(human["workflowRole"], "Finish.HumanReview")
        repaired = decide({**PROJECT, "route": {"action": "repair", "reason": "The slice is local."}})
        self.assertEqual(repaired["outcome"], "needs-evidence")

    def test_context_hash_matches_node_json_stringify(self):
        payload = {"title": "Fix \"quotes\"", "description": "line\nbreak", "blocker": "stuck", "tried": "", "source": "a/b", "material": "café", "criteria": "ok", "subject": "Py"}
        raw = json.dumps([payload[key] for key in ("title", "description", "blocker", "tried", "source", "material", "criteria", "subject")], separators=(",", ":"), ensure_ascii=False)
        self.assertEqual(context_hash(payload), __import__("hashlib").sha256(raw.encode()).hexdigest())


if __name__ == "__main__":
    unittest.main()
