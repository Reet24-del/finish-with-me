#!/usr/bin/env sh
# Runs "Example: Stuck transform" against a running, configured IRIS (after scripts/setup-iris.sh)
# through the authenticated REST endpoint, then prints the real Ens.MessageHeader rows of the run.
# Needs docker compose, curl and python3. Uses IRIS_PASSWORD (default SYS) for _SYSTEM.
set -eu
cd "$(dirname "$0")/.."
BASE="${IRIS_BASE_URL:-http://127.0.0.1:52773/csp/user/finish/}"
AUTH="${IRIS_USERNAME:-_SYSTEM}:${IRIS_PASSWORD:-SYS}"
TASK="${1:-stuck-transform-$(date +%H%M%S)}"
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT

sql() { printf '%s\n' "$1" | docker compose exec -T iris iris sql IRIS -U USER 2>/dev/null | grep '^|' | grep -v '^| --' || true; }
post() { curl -s -u "$AUTH" -H 'Content-Type: application/json' --data @"$1" "${BASE}decide" > "$2"; }
field() { python3 -c "import json,sys;d=json.load(open(sys.argv[1]));v=d;exec('for k in sys.argv[2].split(\".\"):\n v=v.get(k,\"\") if isinstance(v,dict) else \"\"');print(v)" "$1" "$2"; }
step() { printf '\n\033[1;36m== %s\033[0m\n' "$1"; }

step "Precedents before the run"
sql "SELECT COUNT(*) AS PrecedentCount FROM Finish_Memory.Precedent"

python3 - "$TASK" > "$work/investigate.json" <<'PY'
import json, sys
print(json.dumps({"action":"investigate","taskId":sys.argv[1],"kind":"coding","profile":"integration",
 "title":"Example: Stuck transform",
 "description":"A record message failed in the interoperability transform because RequiredField was empty.",
 "blocker":"Message 1042 is stuck in error status after Finish.RecordToTarget.",
 "tried":"I opened the message trace and saw the transform error.","subject":"IRIS interoperability",
 "criteria":"Replay the message after RequiredField is populated. Do not mark it complete until the replay result is recorded.",
 "source":"ERROR #5001: Transform Finish.RecordToTarget failed\nSource message id: 1042\nClass: Finish.Record\nField RequiredField is empty\nTarget class Finish.Target was not created\nLast action: DTL Set target.RequiredField = source.RequiredField\n",
 "attemptCount":0}))
PY
step "1. Investigate $TASK"
post "$work/investigate.json" "$work/r1.json"
S1=$(field "$work/r1.json" sessionId)
echo "outcome:  $(field "$work/r1.json" outcome)"
echo "provider: $(field "$work/r1.json" provider)"
echo "model:    $(field "$work/r1.json" model)"
echo "session:  $S1"

step "Vector Search: similar finished blockers (session $S1)"
sql "SELECT r.TopScore, r.TraceSummary FROM Ens.MessageHeader h JOIN Finish_Message.PrecedentResult r ON r.ID = h.MessageBodyId WHERE h.SessionId = $S1 AND h.MessageBodyClassName = 'Finish.Message.PrecedentResult'"

step "Fallback agent proposal"
python3 -c "
import json,sys,textwrap
d=json.load(open(sys.argv[1]))['decision']
for k in ('summary','artifact','verification'):
    print(textwrap.fill(k+': '+d.get(k,''),width=100,subsequent_indent='    '))
" "$work/r1.json"

python3 - "$work/investigate.json" "$work/r1.json" > "$work/verify.json" <<'PY'
import json, sys
b=json.load(open(sys.argv[1])); d=json.load(open(sys.argv[2]))['decision']
b.update(action="verify", proposal=d, evidenceInput={"artifact":d["artifact"],
 "evidence":"Replayed message 1042 after populating RequiredField; the replay completed and Finish.Target was created.",
 "confirmed":True,"passed":True})
print(json.dumps(b))
PY
step "2. Record replay evidence"
post "$work/verify.json" "$work/r2.json"
S2=$(field "$work/r2.json" sessionId)
echo "outcome:       $(field "$work/r2.json" outcome)"
echo "workflow task: $(field "$work/r2.json" workflowTaskId) ($(field "$work/r2.json" role))"
echo "session:       $S2"

python3 - "$work/verify.json" "$work/r2.json" > "$work/approve.json" <<'PY'
import json, sys
b=json.load(open(sys.argv[1])); r=json.load(open(sys.argv[2]))
b.update(action="approve", humanAction="approve", priorAction="verify", approvalToken=r["approvalToken"],
 workflowTaskId=str(r["workflowTaskId"]), workflowRole=r["role"], distributionToken=r["distributionToken"])
print(json.dumps(b))
PY
step "3. Reviewer approves workflow task"
post "$work/approve.json" "$work/r3.json"
S3=$(field "$work/r3.json" sessionId)
echo "outcome: $(field "$work/r3.json" outcome)"
echo "reason:  $(field "$work/r3.json" reason)"
echo "session: $S3"

step "Precedents after the run"
sql "SELECT COUNT(*) AS PrecedentCount FROM Finish_Memory.Precedent"

step "Ens.MessageHeader for sessions $S1, $S2, $S3 (trace events omitted)"
sql "SELECT SessionId, SourceConfigName, TargetConfigName, MessageBodyClassName, Description FROM Ens.MessageHeader WHERE SessionId IN ($S1,$S2,$S3) AND MessageBodyClassName NOT IN ('Finish.Message.TraceEvent','Ens.Response') ORDER BY ID"
