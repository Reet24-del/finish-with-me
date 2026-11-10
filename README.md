# Finish With Me

An IRIS Interoperability production routes a stuck work item to an AI Hub agent; the agent proposes a bounded action; a deterministic IRIS gate and a Workflow Engine human approval decide completion.

This is an entry for the [InterSystems Programming Contest: AI Agents in Interoperability Workflows](https://openexchange.intersystems.com/contest/49). The work item enters `Finish.Production` as an interoperability message. `Finish.DecisionProcess` calls the AI Hub agent, then an Embedded Python gate routes the result to needs-evidence, reject, escalate, or pending-approval. A passing gate opens an `EnsLib.Workflow` task. The Node application stores the task and renders that decision. When IRIS is connected, approve and send-back call the production; they do not decide completion themselves. The original receipt-total and linear-equation examples still run locally when IRIS is not connected.

[Watch the demo video](https://www.youtube.com/watch?v=aBBQBlfhaA8) — actual interface, live IRIS repair, independent checks, and study interaction.

[Open the hosted website](https://finish-with-me.onrender.com/) — multipage demo with isolated visitor workspaces. The hosted instance uses demo mode until a remote IRIS endpoint is configured.

[Deploy a free demo on Render](https://render.com/deploy?repo=https://github.com/Reet24-del/finish-with-me) · [Hosting details](docs/hosting.md)

## Why it exists

When someone gets stuck, a reminder to “focus” does not remove the blocker. Finish With Me turns a vague stalled project or study session into one inspectable move, preserves a short return point when the user has to stop, and records completion only after checks pass or a fresh exercise is solved. It does not use streaks, shame, or self-reported time as a proxy for finishing.

## Pages

`/` is the landing page, `/features` explains the workflows, `/workspace` lists your tasks, `/workspace/<task-id>` opens a task directly, `/new` creates work, and `/guide` explains what to bring. Browser Back/Forward and refresh work on individual pages.

## What works

- **Your projects:** add source files (any text-based language), logs, your stack and success criteria. The native IRIS AI Hub agent inspects that context and proposes one complete file replacement plus verification instructions. Review/export it, apply it in your own environment, record actual check results, then explicitly approve the piece of work.
- **Your studies:** add notes or an excerpt and your subject/level. AI Hub creates a source-cited explanation, a guided question, a distinct transfer question and private grading rubrics. Answer in your own words, get rubric-based AI feedback, retry, then approve after an accepted independent answer. The explanation is hidden during transfer.
- **Return and review:** save a concrete return point, export the proposed artifact or study transcript, and revisit completed tasks from the workspace.
- **Interactive frontend:** switch between project/study previews, select workflow steps and explore features. Motion respects reduced-motion preferences. Preview content is labeled as an example.
- **Deterministic examples:** the original receipt-total checker and linear-equation practice remain available as seeded examples without AI.

Project verification is **user-reported**, not server-executed. Study assessment is **AI feedback**, not a guaranteed or independently verified grade. The UI and saved evidence identify these distinctions. Editing context invalidates previous evidence and approval.

## Run the local mode

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Open [http://localhost:4318](http://localhost:4318). Without IRIS, local mode supports the built-in examples and task/context storage. Working on your own material requires the live IRIS connection. To use live AI Hub, follow the Docker setup below.

## Run with InterSystems IRIS AI Hub

The contest organizers confirmed that build `2027.1.0AI.109.0` may be used as the newest available build, and that the judges will use the corresponding build for an entry. Download the **AI Hub Community ARM64 image** for Apple Silicon from the [InterSystems Early Access Program portal](https://evaluation.intersystems.com/Eval/early-access/AIHub). Do not publish the downloaded image or an image derived from it.

1. Install and start Docker Desktop. Copy `.env.example` to `.env`, set a private IRIS password, and add your own `GROQ_API_KEY`. Do not commit `.env`.
2. Load the downloaded archive and inspect the loaded tag:

   ```sh
   docker image load -i /path/to/iris_arm64-community-2027.1.0AI.109.0-docker.tar.gz
   docker images
   ```

3. Retag the exact loaded repository and tag shown by `docker images`:

   ```sh
   docker image tag <loaded-repository>:<loaded-tag> iris-community:2027.1.0AI.109.0
   ```

4. Start IRIS, then import and configure the project:

   ```sh
   docker compose up -d iris
   sh scripts/setup-iris.sh
   ```

   Wait for IRIS startup before running the setup script. The script copies the classes into the container, compiles them, sets the local `_SYSTEM` password from `IRIS_PASSWORD`, creates `/csp/user/finish` in `USER` with password authentication, and starts `Finish.Production`. These changes apply to this dedicated local Docker instance. The named IRIS data volume preserves the database. All published ports bind to `127.0.0.1`.

5. Start the frontend and its local backend:

   ```sh
   docker compose up --build -d app
   ```

6. Open [http://localhost:4318](http://localhost:4318). The header shows **IRIS CONNECTED** once the authenticated REST health endpoint responds. Investigations, checks, recorded verification, study assessment, and approve/send-back then go through `Finish.DecisionService` → `Finish.DecisionProcess`. This health label confirms connectivity, not the quality of any proposed repair.

The app defaults to Groq: set `AIHUB_PROVIDER=groq`, `GROQ_API_KEY`, and `AIHUB_MODEL=openai/gpt-oss-120b` in `.env`. AI Hub uses its OpenAI-compatible provider with `base_url=https://api.groq.com/openai/v1`; tool execution remains inside IRIS. For OpenAI instead, set `AIHUB_PROVIDER=openai`, `OPENAI_API_KEY`, and `AIHUB_MODEL=gpt-4.1-mini`. The selected key is read from the local `.env` by Docker Compose and is never sent to the browser or stored with task data. Judges should use their own provider key.

## Architecture

```text
Browser
  → Node API                         stores the task and renders the decision
    → POST /csp/user/finish/decide   Finish.Message.WorkItem
      → Finish.DecisionService
        → Finish.DecisionProcess
            → Finish.AgentOperation  AI Hub call, only for investigate / assess
            → Finish.GateOperation   Embedded Python gate (iris/gate/engine.py)
            → Finish.Reviewer        Workflow Engine approval
              or Finish.Supervisor   escalation
        ← Finish.Message.Decision
```

| Outcome | Meaning |
| --- | --- |
| needs-evidence | The proposal is stored, or the checks failed. The work item stays open. |
| pending-approval | The gate passed. `Finish.Reviewer` has an Approve/Reject workflow task. |
| escalate | Repeated failure, or a stuck message with no failure signature. `Finish.Supervisor` gets the task. |
| reject | The proposal or the evidence is not acceptable, or the reviewer sent it back. |
| complete | The reviewer approved and the gate still accepts the same evidence. |

Visual Trace shows one session per production call. A proposal session is service → process → agent → gate, and a workflow operation when the gate asks for a person. The later approve or send-back session is service → process → gate recheck → workflow completion. Message descriptions name each step.

`Finish.Message.AgentCall` carries the prompt, prompt version `finish-decision-1`, target tool, and task payload. `Finish.Message.AgentResult` carries the model, reply, tool trace, proposal, input tokens, output tokens, and latency. `Finish.Message.GateResult` carries the outcome, reason, and, for the receipt example, the eight check rows. That is the LLM trace for this production: the model call is an interoperability message, not a side log.

To inspect a run, sign in to the Management Portal as `_SYSTEM` with the password from `.env`, switch to the `USER` namespace, and open Interoperability → View → Messages for `Finish.Production`. Open the session and choose Visual Trace. The same user's workflow inbox is Interoperability → Manage → Workflow → Workflow Inbox. `scripts/setup-iris.sh` adds `_SYSTEM` to `Finish.Reviewer` and `Finish.Supervisor`.

The agent has no completion or code-execution tool. General project proposals never modify repository files automatically. The user runs relevant checks and supplies verification results; the IRIS gate accepts or rejects that evidence and, when it passes, waits for the workflow task. General study assessment is a separate AI Hub request that receives the stored question, private rubric, source and learner answer. Only the active question is sent to the browser; private rubrics are stripped from every task response. Generated questions may still be imperfect—review them against the source and use **Rework with this context** when needed.

For the original examples without IRIS, the restricted JavaScript AST interpreter checks eight receipt-total cases, and deterministic arithmetic validates the equation exercise. With IRIS connected, the receipt-total investigate still uses the agent, and the eight checks run inside the Embedded Python gate. The seeded **Example: Stuck transform** is an interoperability failure: the agent proposes a repair with `PrepareRepair`, and the gate requires a recorded replay before workflow approval. Three failed verifications escalate to `Finish.Supervisor`.

## Project layout

- `src/` — React interface.
- `server/` — local HTTP API, durable task store, IRIS client, and bounded code checker.
- `iris/src/Finish/` — REST dispatcher, decision service and process, AI Hub operation, Embedded Python gate, workflow operations, and production.
- `iris/gate/engine.py` — deterministic gate loaded by `Finish.Gate.Rules` at `/durable/finish/gate_engine.py`.
- `docker-compose.yml` — local IRIS and application services.

## Configuration and privacy

Task data is stored in `.data/workspace.json` in local mode or the `app-data` Docker volume in Compose mode. The IRIS provider key remains in the IRIS container environment. Uploaded text and notes are stored with your task and sent through IRIS to the selected LLM provider when you request work or feedback. Only include material you are allowed to share with that provider. Credentials stay server-side; text-file selection rejects common private-key and .env filenames.

## Contest bonuses

These are the published contest bonuses this repository actually implements:

- **Embedded Python (3).** `Finish.Gate.Rules` is a `[ Language = python ]` method. Every gate decision, including the receipt-total checks, runs `iris/gate/engine.py` inside the IRIS process.
- **Workflow Engine (2).** `Finish.Reviewer` and `Finish.Supervisor` are `EnsLib.Workflow` operations. A passing gate creates a workflow task. Approve and send-back complete that task through `EnsLib.Workflow.Engine`. The Management Portal inbox shows the same tasks.
- **Docker container usage (2).** `docker compose up` runs the AI Hub image and the Node app. `scripts/setup-iris.sh` loads the classes, installs the gate file, configures the REST application and workflow roles, smoke-tests the gate, and starts `Finish.Production`.
- **Online demo (2).** [finish-with-me.onrender.com](https://finish-with-me.onrender.com/) serves the interface. That hosted instance stays in local demo mode until a remote IRIS endpoint is configured, so the production decision path is demonstrated with the Docker stack above.
- **Video (3).** The [YouTube walkthrough](https://www.youtube.com/watch?v=aBBQBlfhaA8) shows the earlier receipt-total and algebra examples. It does not show the Visual Trace of this decision process.
- **Community idea DPI-I-689 (4).** [Use InterSystems Interoperability as a traceability tool for GenAI LLM pipelines](https://ideas.intersystems.com/ideas/DPI-I-689) (Community Opportunity). Each AI Hub call is a persisted request/response in the same session as the gate: prompt version, prompt, model, tool trace, proposal, token counts, and latency. This entry does not use Vector Search.

Not claimed here: Production Extension (PEX), a custom adapter, a ZPM package, the contest questionnaire, a reported AI Hub or Embedded Python bug, or a Developer Community article.

## Contest and overlap note

Finish With Me focuses on **turning a blocker into a concrete artifact or practice step with explicit evidence and review**. Only its fixed examples use deterministic independent checking; general workflows label user-reported verification and AI assessment. Existing planners and context-resume tools already cover reminders, task breakdown, focus sessions, and recovering project context; this project does not claim those parts are novel by themselves. The differentiator is an auditable completion gate that runs after useful work is done. This is a focused entry, not a claim that no other product has any similar feature.

## Demo walkthrough

1. Choose **Bring your own project**, name the blocker and paste a relevant source file or use **Add text files**. Add the stack and measurable success criteria.
2. Ask AI Hub to work on it. Review/export the proposed replacement and the verification plan.
3. Apply the change in your own project. Run the relevant checks, record actual results, confirm them and approve this bounded piece of work.
4. Create a study task, add your subject and notes, and build a study session. Inspect the source quote, explanation and guided question.
5. Answer the guided question, then the distinct independent question. An insufficient answer keeps the task open; feedback helps you retry. Review the final feedback before approving.
6. Save a return point and use **Completed** to revisit/export prior work.

The linked YouTube video demonstrates the earlier receipt-total and algebra examples. The current version also supports user-supplied project and study context as described above.

## License

MIT. See [LICENSE](LICENSE).

## Implementation scope and verification

New tasks use `project` and `subject` profiles. The seeded `integration` profile is a failed transform. Source/notes are provided as pasted text or text-file selections (combined context up to 32,000 characters). Binary PDFs, repository cloning, autonomous file changes, execution of arbitrary project code and whole-project completion are not implemented. The `receipt-total` and `linear-equations` profiles remain as fixed examples and still complete locally without IRIS. With IRIS connected, receipt-total checks and every approve/send-back for an IRIS-owned task are decided by the production.

The broader workflows were verified with a Python pagination task (four checks executed outside the application) and a biology session that rejected an instruction-only response and an incorrect transfer answer. Both completed through the API with explicit approval; see [docs/general-verification.json](docs/general-verification.json). These are synthetic scenario checks, not a guarantee of model accuracy across all subjects or projects.

Run `npm test` for completion gating, stale-write rejection, independent study transfer, restricted execution, and durable HTTP workflow checks. Run `npm run build` for the frontend production bundle. After starting the IRIS container, `sh scripts/setup-iris.sh` imports classes, configures the authenticated REST application, and starts the production.

Full Docker verification on build `2027.1.0AI.109.0` succeeded using Groq `openai/gpt-oss-120b`: the app called the authenticated IRIS REST endpoint, the production ran `InspectTask` and `PrepareCandidate`, and the candidate passed all eight independent checks before approval. The completed task survived an app-container restart; the frontend and JS bundle both returned HTTP 200. See [docs/docker-verification.json](docs/docker-verification.json). Earlier verification used Qwen, but subsequent runs exposed tool-call reliability issues; the default is now GPT-OSS with a four-iteration tool budget. The earlier synthetic result is in [docs/live-verification.json](docs/live-verification.json). This is one verified scenario, not a guarantee that every model response will pass. Use **Revise using failed checks** when a candidate fails.

Groq compatibility is implemented using the AI Hub provider `base_url` setting and Groq’s documented OpenAI-compatible endpoint. Run `node scripts/verify-live.mjs` to repeat the synthetic live scenario with your own key; it permits up to three checked proposals and records the actual outcome. For a host-run app, set `IRIS_BASE_URL=http://127.0.0.1:52773/csp/user/finish/` in `.env`.

To verify the full running Docker stack, run `node scripts/verify-docker.mjs`. It creates a labeled synthetic task in the workspace and records the actual result. After this decision-path change, that script still drives the Node API; investigate, the receipt checks, and approval are forwarded to the production when the task is IRIS-owned.

The deterministic gate is also covered by `python3 -m unittest test_engine.py` in `iris/gate`, and `npm test` checks that the Node client does not mark a task complete unless the production outcome is `complete`. Those tests do not start IRIS. `scripts/setup-iris.sh` compiles the classes, runs `Finish.Gate.Rules.SmokeTest()` inside the container, and starts the production; that step needs the local AI Hub image.
