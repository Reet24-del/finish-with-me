# Finish With Me

**A small-step completion coach for the work you keep getting stuck on.** It helps with one concrete piece of a coding project or study session, does useful work alongside you, and only closes the task when there is evidence of a result.

This is an entry for the [InterSystems Programming Contest: AI Agents in Interoperability Workflows](https://openexchange.intersystems.com/contest/49). The app uses an InterSystems IRIS Interoperability production to route a task to an IRIS AI Hub agent. A dedicated AI Hub tool inspects the task and its completion contract. For coding, the agent proposes a bounded repair; a separate, sandboxed checker runs the agreed cases, and the user approves the result before it replaces the saved function. Study sessions guide the learner through a step and require an independent transfer question before completion.

## Why it exists

When someone gets stuck, a reminder to “focus” does not remove the blocker. Finish With Me turns a vague stalled project or study session into one inspectable move, preserves a short return point when the user has to stop, and records completion only after checks pass or a fresh exercise is solved. It does not use streaks, shame, or self-reported time as a proxy for finishing.

## What works

- Start a coding or study task and describe the exact point where you got stuck.
- Ask the live AI Hub agent for one bounded coding repair, or use the local guided flow.
- Edit the proposed code yourself. The checker interprets a small JavaScript subset and never evaluates submitted code with `eval` or imports it.
- Run eight independent cases. A changed candidate clears old evidence; passing checks still need your approval before the code is saved.
- Work a sample linear-equation exercise, then solve a new equation independently to finish.
- Save a concise next action as a return point and see it when you come back.
- Persist workspace data locally; no account or cloud service is required.

The included workspace starts with sample tasks: a string-concatenation bug in a receipt total and a linear-equation study exercise. You can replace these with your own work.

## Run the local mode

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Open [http://localhost:4318](http://localhost:4318). Local mode includes the rule-based coding repair and guided study flow. To use live AI Hub, follow the Docker setup below.

## Run with InterSystems IRIS AI Hub

The contest organizers confirmed that build `2027.1.0AI.109.0` may be used as the newest available build, and that the judges will use the corresponding build for an entry. Download the **AI Hub Community ARM64 image** for Apple Silicon from the [InterSystems Early Access Program portal](https://evaluation.intersystems.com/Eval/early-access/AIHub). Do not publish the downloaded image or an image derived from it.

1. Install and start Docker Desktop. Copy `.env.example` to `.env`, set a private IRIS password, and add your own `OPENAI_API_KEY`. Do not commit `.env`.
2. Load the downloaded archive and inspect the loaded tag:

   ```sh
   docker image load -i /path/to/iris_arm64-community-2027.1.0AI.109.0-docker.tar.gz
   docker images
   ```

3. Retag the exact loaded repository and tag shown by `docker images`:

   ```sh
   docker image tag <loaded-repository>:<loaded-tag> iris-community:2027.1.0AI.109.0
   ```

4. Start the app and IRIS:

   ```sh
   docker compose up --build -d
   ```

5. Import the ObjectScript classes into the `USER` namespace and start the production:

   ```sh
   docker compose exec iris iris session IRIS -U USER
   ```

   In the IRIS terminal:

   ```objectscript
   Do $System.OBJ.LoadDir("/iris/src","ck",,1)
   Do ##class(Ens.Director).StartProduction("Finish.Production")
   ```

6. In the Management Portal (`http://localhost:52773/csp/sys/UtilHome.csp`), create a web application under **System Administration → Security → Applications → Web Applications**:
   - Name: `/csp/user/finish`
   - Namespace: `USER`
   - Dispatch class: `Finish.Api`
   - Enable password authentication.

7. Open [http://localhost:4318](http://localhost:4318). The header changes to **IRIS CONNECTED** when the app can reach the IRIS API. This confirms connectivity; a successful agent investigation must still be verified. A live coding investigation will be routed through the `Finish.Production` production to `Finish.AgentOperation`.

The app expects an OpenAI key in `OPENAI_API_KEY` inside the IRIS container. The key is read from the local `.env` by Docker Compose and is never sent to the browser or stored with task data. Judges should use their own provider key.

## Workflow

```text
Browser → local app API → IRIS REST dispatcher
                         → Interoperability production
                         → AI Hub agent + InspectTask tool
                         ← bounded repair proposal
Browser → sandboxed contract checks → human approval → saved result
```

The agent cannot mark a task complete. For code, the local checker compares the candidate against eight fixed cases in a restricted AST interpreter. For study, a deterministic checker validates the learner's answer to a new equation. Editing the source or candidate clears previous evidence.

## Project layout

- `src/` — React interface.
- `server/` — local HTTP API, durable task store, IRIS client, and bounded code checker.
- `iris/src/Finish/` — IRIS REST dispatcher, AI Hub agent/tool, interoperability messages, and production.
- `docker-compose.yml` — local IRIS and application services.

## Configuration and privacy

Task data is stored in `.data/workspace.json` in local mode or the `app-data` Docker volume in Compose mode. The IRIS provider key remains in the IRIS container environment. The example contains no clinical or personal data; use synthetic tasks in demos.

## Contest and overlap note

Finish With Me focuses on **doing and independently checking the next piece of work in-session**, including a safe coding repair and a demonstrated study transfer. Existing planners and context-resume tools already cover reminders, task breakdown, focus sessions, and recovering project context; this project does not claim those parts are novel by themselves. The differentiator is an auditable completion gate that runs after useful work is done. This is a focused entry, not a claim that no other product has any similar feature.

## Demo walkthrough

1. Open the seeded **Fix receipt total** project task and see the failing `reduce` implementation.
2. State the blocker and what you tried; ask the live AI Hub agent for a repair.
3. Review and, if useful, change the proposed function. Run the independent contract checks and see any failure.
4. Approve only after all checks pass. The app saves the checked candidate and records when it was closed.
5. Open **Understand linear equations**, work through the scaffolded step, and solve the separate transfer equation. The task closes only after the answer is checked.
6. Save a return point on any active task and return to it from the workspace.

## License

MIT. See [LICENSE](LICENSE).

## Implementation scope and verification

The current completion profiles are `receipt-total` (a JavaScript `total(prices)` function) and `linear-equations`. New tasks use one of these profiles. General repository repair, file upload, arbitrary study subjects, and automatic project-wide completion are not implemented. The live agent path is implemented for the code profile; study uses the local guided exercise.

Run `npm test` for completion gating, stale-write rejection, independent study transfer, restricted execution, and durable HTTP workflow checks. Run `npm run build` for the frontend production bundle. After starting the IRIS container, `sh scripts/setup-iris.sh` imports classes and starts the production; configure the authenticated REST web application as described above.

Live IRIS compilation, provider calls, and the complete Docker installation still require verification with the EAP image. Local passing tests do not establish contest readiness.
