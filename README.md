# Finish With Me

An IRIS Interoperability production routes a stuck work item to an AI Hub agent; the agent proposes a bounded action; a deterministic IRIS gate and a Workflow Engine human approval decide completion.

This is an entry for the [InterSystems Programming Contest: AI Agents in Interoperability Workflows](https://openexchange.intersystems.com/contest/49). A work item enters `Finish.Production` as `Finish.Message.WorkItem`. `Finish.DecisionProcess` calls `Finish.Agent.CompletionAgent`, which chooses repair, hint, or human review. A repair is then judged by an Embedded Python gate. Passing evidence opens `Finish.Reviewer`; a repeated failure opens `Finish.Supervisor`; a human route opens `Finish.HumanReview`. The Node app stores the task and renders that decision. Approve and send-back call the production when the task is IRIS-owned. Hint and human review do not complete the task. Receipt-total and linear-equation examples still run locally without IRIS. Hosted Groq is a separate path and does not run this production.

[Download the demo MP4](https://github.com/Reet24-del/finish-with-me/releases/download/media-v1/Finish-With-Me-Demo.mp4) · [Watch the demo video](https://www.youtube.com/watch?v=aBBQBlfhaA8) — actual interface, live IRIS repair, independent checks, and study interaction.

[Open the hosted website](https://finish-with-me.onrender.com/) — multipage demo with isolated visitor workspaces. The website labels its active provider and storage mode. Optional free Groq hosting is separate from the native IRIS workflow; durable cloud storage requires a configured external database.

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
Browser or Finish.GitHubIssues
  → WorkItem
    → Finish.DecisionService or Finish.GitHubIssues
      → Finish.DecisionProcess
          → Finish.AgentOperation     CompletionAgent: InspectTask, ChooseRoute, then one prepare tool
          → Finish.TraceOperation     one message per decision step and tool call
          → Finish.GateOperation      Embedded Python gate (iris/gate/engine.py)
          → Finish.Reviewer           approval after the gate passes
            Finish.Supervisor         repeated failure or a message with no failure signature
            Finish.HumanReview        the agent chose human
      ← Decision
Finish.CheckOperation               AST receipt checks for a candidate that is not yet owned by a decision
```

| Outcome | Meaning |
| --- | --- |
| needs-evidence | The proposal is stored, or the checks failed. The work item stays open. |
| pending-approval | The gate passed. `Finish.Reviewer` has an Approve/Reject workflow task. |
| escalate | Repeated failure, a stuck message with no failure signature (`Finish.Supervisor`), or the agent chose human review (`Finish.HumanReview`). |
| reject | The proposal or the evidence is not acceptable, or the reviewer sent it back. |
| complete | The reviewer approved and the gate still accepts the same evidence. |

Visual Trace shows one session per production call. A proposal session is service → process → agent → gate, and a workflow operation when the gate asks for a person. The later approve or send-back session is service → process → gate recheck → workflow completion. Message descriptions name each step.

`Finish.Message.AgentCall` carries the prompt, prompt version `finish-decision-1`, target tool, and task payload. `Finish.Message.AgentResult` carries the model, reply, route, tool trace, proposal, input tokens, output tokens, and latency. `Finish.Trace.Recorder` also sends `AgentStart`, each tool call, `AgentResult` or `AgentError`, `DecisionStart`, `GateResult`, and `WorkflowOpened` to `Finish.TraceOperation` in the same session. `Finish.Message.GateResult` carries the outcome, reason, and, for the receipt example, the eight check rows.

To inspect a run, sign in to the Management Portal as `_SYSTEM` with the password from `.env`, switch to the `USER` namespace, and open Interoperability → View → Messages for `Finish.Production`. Open the session and choose Visual Trace. The same user's workflow inbox is Interoperability → Manage → Workflow → Workflow Inbox. `scripts/setup-iris.sh` adds `_SYSTEM` to `Finish.Reviewer`, `Finish.Supervisor`, and `Finish.HumanReview`.

`Finish.GitHubIssues` polls at most ten open issues with the configured label, skips pull requests, and sends each new or updated issue into `Finish.DecisionProcess` as a project work item. It does not fetch repository files or change GitHub. The private local workspace can import the recorded snapshots. Hosted visitor workspaces cannot. Set **Repository**, **Label** (default `stuck`), and **CallInterval** on the business service.

The agent has no completion or code-execution tool. General project proposals never modify repository files automatically. The user runs relevant checks and supplies verification results; the IRIS gate accepts or rejects that evidence and, when it passes, waits for the workflow task. General study assessment is a separate AI Hub request that receives the stored question, private rubric, source and learner answer. Only the active question is sent to the browser; private rubrics are stripped from every task response. Generated questions may still be imperfect—review them against the source and use **Rework with this context** when needed.

For the original examples without IRIS, the restricted JavaScript AST interpreter checks eight receipt-total cases, and deterministic arithmetic validates the equation exercise. With IRIS connected, the receipt-total investigate still uses the agent, and the eight checks run inside the Embedded Python gate. The seeded **Example: Stuck transform** is an interoperability failure: the agent proposes a repair with `PrepareRepair`, and the gate requires a recorded replay before workflow approval. Three failed verifications escalate to `Finish.Supervisor`.

## Project layout

- `src/` — React interface.
- `server/` — local HTTP API, durable task store, IRIS client, and bounded code checker.
- `iris/src/Finish/` — REST dispatcher, decision service and process, AI Hub operation, Embedded Python gate, workflow operations, and production.
- `iris/gate/engine.py` — deterministic gate. `scripts/setup-iris.sh` copies it to `/durable/finish/gate_engine.py`. An IPM install copies `iris/gate/` to `<mgr>/finish-with-me/gate/`. `Finish.Gate.Rules` uses the durable file when it is present, otherwise the IPM copy.
- `docker-compose.yml` — local IRIS and application services.

## Configuration and privacy

Task data is stored in `.data/workspace.json` in local mode or the `app-data` Docker volume in Compose mode. The IRIS provider key remains in the IRIS container environment. Uploaded text and notes are stored with your task and sent through IRIS to the selected LLM provider when you request work or feedback. Only include material you are allowed to share with that provider. Credentials stay server-side; text-file selection rejects common private-key and .env filenames.

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

To verify the full running Docker stack, run `node scripts/verify-docker.mjs`. It creates a labeled synthetic task in the workspace and records the actual result. When the task is IRIS-owned, investigate, the receipt decision, and approval go through `Finish.DecisionProcess`.

`python3 -m unittest test_engine.py` in `iris/gate` covers the deterministic gate, including repair, hint, and human routes. `npm test` covers local completion, hosted Groq tool shape, workspace recovery, and the rule that the Node client does not mark a task complete unless the production outcome is `complete`. Those tests do not start IRIS. `scripts/setup-iris.sh` compiles the classes, configures the REST app and the three workflow roles, runs `Finish.Gate.Rules.SmokeTest()` inside the container, and starts the production. That step needs the local AI Hub image and was not run for this combined revision.

## Combined production

`Finish.Agent.CompletionAgent` calls `InspectTask`, then `ChooseRoute` (`repair`, `hint`, or `human`). Repair may call `PrepareProject`, `PrepareRepair`, `PrepareLesson`, or `PrepareCandidate`. Study assessment skips routing and calls `AssessAnswer`. Hint keeps the task open. Human review opens `Finish.HumanReview` and is not completion. The gate then routes repair evidence to `Finish.Reviewer` or, after repeated failure, `Finish.Supervisor`.

`Finish.Trace.Recorder` writes those steps into the same Visual Trace session. Token counts and duration are the agent session statistics, not a separate log of every provider HTTP call. Hosted Groq does not produce these native traces.

`Finish.Check.Receipt` remains the Embedded Python AST checker behind `POST /check`. The decision gate in `iris/gate/engine.py` runs the receipt cases when an IRIS-owned candidate is checked. Disconnected examples and hosted Groq still use the JavaScript interpreter.

`Finish.GitHubIssues` feeds each stuck issue to `Finish.DecisionProcess`. The adapter still excludes pull requests and skips an issue whose update timestamp was already seen. The supplied [fixture](test/fixtures/github-issues.json) is synthetic. Earlier adapter checks are in [docs/interop-app-verification.json](docs/interop-app-verification.json); they predate sending the issue through the decision process, so they are not a live test of this combined path.

Earlier live notes for routing, the AST checker, and the original Docker repair are in [docs/routing-verification.json](docs/routing-verification.json), [docs/embedded-python-verification.json](docs/embedded-python-verification.json), and [docs/docker-verification.json](docs/docker-verification.json). They describe runs from before this decision process, trace recorder, and GitHub service were wired together. This combined revision was not executed against a running IRIS instance.

### See a decision in Visual Trace

1. Run the Docker setup and `sh scripts/setup-iris.sh` with your own provider key.
2. Ask IRIS to work a project, a hint-sized study question, and a task that lacks the files a repair would need.
3. Open Management Portal → Interoperability → View → Messages, find the session, and open Visual Trace.
4. Read `AgentCall` / `AgentResult` for the prompt, model, route, tokens, and latency, then the child messages on `Finish.TraceOperation`, then `GateResult`.
5. For a human route, open the `Finish.HumanReview` task in the Workflow Inbox. For a passing gate, open `Finish.Reviewer`.

[Community idea DPI-I-689](https://ideas.intersystems.com/ideas/DPI-I-689) asks for interoperability traceability of LLM calls. This production keeps the agent call, gate, and workflow task in one session. It is not a Langfuse replacement, and it does not use Vector Search.

### IPM package

`module.xml` defines `finish-with-me-iris` version 0.3.0. It requires IRIS `>=2026.3` in an Interoperability-enabled namespace, loads `Finish.PKG` from `iris/src`, and on Activate copies `iris/gate/engine.py` and `iris/gate/test_engine.py` to `<mgr>/finish-with-me/gate/`. It does not set a provider key, create the REST application, add workflow users, or start `Finish.Production`. `scripts/setup-iris.sh` still does that for the local Docker instance, and it still copies `engine.py` to `/durable/finish/gate_engine.py`. It does not copy `test_engine.py`; run that file from the repository with `python3 -m unittest test_engine.py`.

After this manifest is on the public default branch, a checkout can be loaded with `zpm "load /path/to/finish-with-me -v"`, and IPM can load the public repository with `zpm "install https://github.com/Reet24-del/finish-with-me"`. Neither command was run for this revision. The contest install command is the registry name:

```objectscript
zpm "install finish-with-me-iris"
```

That command installs from the public IPM registry. This package is not published there. The owner steps and the checks to run on AI Hub build 154 are in [docs/ipm.md](docs/ipm.md). An earlier local IPM load covered the pre-combination classes only. This revision was not loaded on IRIS.

## Contest bonuses

These match what is in the repository. Points are not claimed as awarded. Rules: [official bonus announcement](https://community.intersystems.com/post/technology-bonuses-intersystems-programming-contest-ai-agents-interoperability-workflows).

| Bonus | Published points | What is implemented |
| --- | ---: | --- |
| Docker | 2 | [Compose](docker-compose.yml) runs IRIS and the app. The earlier [Docker note](docs/docker-verification.json) is from before this combined production. |
| Video | 3 | [MP4](https://github.com/Reet24-del/finish-with-me/releases/download/media-v1/Finish-With-Me-Demo.mp4) and the [YouTube walkthrough](https://www.youtube.com/watch?v=aBBQBlfhaA8). Both predate the decision process. |
| Workflow Engine | 2 | `Finish.Reviewer`, `Finish.Supervisor`, and `Finish.HumanReview` are workflow operations. A queued task is not completion. |
| Custom adapter | 2 | [GitHub inbound adapter](iris/src/Finish/Adapter/GitHubInbound.cls) and [service](iris/src/Finish/Adapter/GitHubService.cls). The service now submits `Finish.Message.WorkItem` to the decision process. |
| Embedded Python | 3 | The completion gate (`Finish.Gate.Rules` plus `iris/gate/engine.py`) and the AST checker (`Finish.Check.Receipt`). |
| Community idea DPI-I-689 | 4 | Agent prompt, model, route, tokens, latency, gate outcome, and workflow task are interoperability messages in one session. |
| IPM / ZPM | 2 | [Manifest](module.xml) is `finish-with-me-iris` 0.3.0, requires IRIS `>=2026.3` with Interoperability, and packages `iris/src` plus `iris/gate`. Contest command: `zpm "install finish-with-me-iris"`. Not on the public registry. Publish steps: [docs/ipm.md](docs/ipm.md). This revision was not loaded on IRIS. |
| Online demo | 2 | [Public site](https://finish-with-me.onrender.com/) is hosted Groq or local examples, not this IRIS production. |

The questionnaire and the two Developer Community articles are drafts in `docs/` and are not submitted or published, so they are not listed as implemented bonuses. No PEX, Vector Search, or vendor-bug claim is made. The [bonus comment draft](docs/bonus-claim-draft.md) has not been posted.
