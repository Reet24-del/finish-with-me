# Reproduce the IRIS decision path in Finish With Me

*Second Developer Community article draft. Not yet published.*

A useful demo should let a reviewer distinguish a working agent decision from a static screen. This article is a reproduction guide for the decision production now on [main](https://github.com/Reet24-del/finish-with-me). It describes the current path — a `Finish.Message.WorkItem` entering `Finish.DecisionProcess` — and how to inspect the agent route, the Embedded Python gate, the Workflow Engine task, and the Visual Trace session.

This draft does not claim that the combined production was run against a live IRIS instance. Follow the steps below on your own Docker stack to produce that evidence.

## Start the native version

You need Docker, the AI Hub Community image (build `2027.1.0AI.109.0`) from the [Early Access Program portal](https://evaluation.intersystems.com/Eval/early-access/AIHub), and your own Groq or OpenAI key. Vendor images and provider keys are not included in the project release.

Copy `.env.example` to `.env`, set your private provider key and a local `IRIS_PASSWORD`, then:

```sh
docker compose up -d iris
sh scripts/setup-iris.sh
docker compose up --build -d app
```

Wait for IRIS to start before running the setup script. `scripts/setup-iris.sh` loads and compiles the classes, installs the gate file, creates the authenticated `/csp/user/finish` REST application, adds `_SYSTEM` to `Finish.Reviewer`, `Finish.Supervisor`, and `Finish.HumanReview`, runs `Finish.Gate.Rules.SmokeTest()`, and starts `Finish.Production`.

Open [http://localhost:4318](http://localhost:4318). The header shows **IRIS CONNECTED** once the health endpoint responds. That label confirms connectivity, not the quality of any proposal.

A request to `POST /csp/user/finish/decide` must authenticate. For programmatic examples, read the credentials from your local environment rather than putting them in a URL, screenshot, or shell history.

The InterSystems Package Manager manifest is `finish-with-me-iris` 0.3.0. It is not a substitute for the Docker setup above. What the module installs, and how to publish it, is in [docs/ipm.md](https://github.com/Reet24-del/finish-with-me/blob/main/docs/ipm.md). The package is not on the public registry.

## The path a work item takes

A work item enters `Finish.Production` as `Finish.Message.WorkItem` in one of two ways:

- the Node app (or a manual client) posts to `/csp/user/finish/decide`;
- `Finish.GitHubIssues` polls open issues and sends the issue straight into `Finish.DecisionProcess`.

`Finish.DecisionProcess` then calls `Finish.AgentOperation` (`Finish.Agent.CompletionOperation`), which runs `Finish.Agent.CompletionAgent`. The agent has to call `InspectTask` first. That tool returns the task plus a completion contract for its profile. Then, except for study assessment, it calls `ChooseRoute` with one of three routes:

- `repair`: prepare one source-grounded file replacement, a stuck-message repair, or a lesson with private grading rubrics, using `PrepareProject`, `PrepareRepair`, `PrepareLesson`, or `PrepareCandidate` for the receipt example;
- `hint`: give one nudge and leave the task open;
- `human`: escalate to a person.

A hint route stops there; the gate leaves the task at `needs-evidence`. A human route opens a `Finish.HumanReview` workflow task. A repair route continues into the Embedded Python gate (`Finish.Gate.Rules`, `iris/gate/engine.py`). If the gate answers `pending-approval` or `escalate`, the process opens a Workflow Engine task for the right role: `Finish.Reviewer` after a passing gate, `Finish.Supervisor` after repeated failure or a stuck message with no failure signature, or `Finish.HumanReview` when the agent chose the human route.

A queued workflow task is not completion. Approve and send-back call the production again. The gate re-checks the same evidence, and only then is the workflow task completed. The Node app marks an IRIS-owned task complete only when the production outcome is `complete`.

## Repair: enough context for a bounded change

Use the seeded **Example: Stuck transform**, or a project task whose source contains a clear, bounded bug (for example a pagination slice) and a precise success criterion. The agent should inspect the task, choose `repair`, and call the matching prepare tool.

Inspect the proposed replacement, then run its checks in your own environment. A proposal is not a passing test result. General project verification is user-reported, and the task cannot close until the current artifact has evidence and a reviewer approves it.

The original receipt-total example has a narrower independent check path. The completion gate runs eight deterministic cases against the agent's JavaScript candidate with a restricted Python interpreter, so model code is never `eval`'d. `Finish.Check.Receipt` remains available at `POST /csp/user/finish/check` for a candidate that is not yet owned by a decision. `python3 -m unittest test_engine.py` in `iris/gate` covers the gate rules, including repair, hint, and human routes, without starting IRIS.

## Hint: respect a learner's request for less help

Provide study material about osmosis, or similar notes, and ask for only a nudge. The agent should choose `hint`, not prepare a full lesson. The application displays the hint and keeps the task in `needs-evidence`. No grading or completion evidence is created.

For a full study session instead, supply notes and a concrete learning goal. The lesson includes an exact quotation, a guided exercise, and a separate transfer exercise. Private rubrics are removed from task API responses. An accepted independent answer is AI feedback, not a guaranteed grade.

## Human: missing access should lead somewhere real

Describe a blocker that needs an authorized maintainer, with repository or log access unavailable. The agent should choose `human`. The production sends an `EnsLib.Workflow.TaskRequest` to `Finish.HumanReview`.

Open the Management Portal as `_SYSTEM` (the password from `.env`), switch to the `USER` namespace, and open Interoperability → Manage → Workflow → Workflow Inbox. A queued task does not mean a person reviewed it, and the application does not automatically mark the underlying work complete.

For a terminal check, use `%ResultSet` with `EnsLib.Workflow.Engine:ListTasksForRole` and pass `Finish.HumanReview`. The work item id and the Workflow task id are different identifiers.

## Inspect the same run in Visual Trace

Open Interoperability → View → Messages for `Finish.Production`, locate the decision, and open its Visual Trace. Use the session ID returned by `/decide` to find the exact run.

`Finish.Trace.Recorder` writes `DecisionStart`, `AgentStart`, each tool call, `AgentResult` or `AgentError`, `GateResult`, and `WorkflowOpened` to `Finish.TraceOperation` in the same session. `Finish.Message.AgentCall` carries the prompt, prompt version, target tool, and payload. `Finish.Message.AgentResult` carries the model, the reply, the route, the tool trace, the proposal, input and output tokens, and latency. A proposal session is therefore service → process → agent → gate, and a workflow operation when the gate asks for a person. The later approve or send-back is its own session: service → process → gate recheck → workflow completion.

Source content is visible to authenticated operators, so use the bundled examples when sharing screenshots.

This is the project's take on [DPI-I-689](https://ideas.intersystems.com/ideas/DPI-I-689): use Interoperability as a traceability tool for a GenAI pipeline. It is a smaller solution than Langfuse: Visual Trace links the model call to the production and the human queue. The project does not claim to replace broader LLM observability features.

## Import stuck GitHub issues

`Finish.GitHubIssues` uses the custom inbound adapter `Finish.Adapter.GitHubInbound` to poll the configured repository for open issues labeled `stuck`. It skips pull requests and deduplicates by repository, issue number, and update timestamp. Only the issue text is fetched; repository files are not cloned. Missing source access remains missing, and can lead to a human route. The service then sends a `Finish.Message.WorkItem` to `Finish.DecisionProcess`.

A bundled fixture under `test/fixtures/github-issues.json` is there to prove ingestion, pull-request exclusion, and duplicate suppression through the adapter. It does not create public GitHub issues.

## After you have run it

Record the AI Hub build, provider and model, run date, Visual Trace session, tool calls, gate outcome, and workflow task id. Never publish keys or private task content. Older JSON notes under `docs/` describe runs from before this combined production was merged; they are not evidence of this path on a live IRIS instance.

[Implementation](https://github.com/Reet24-del/finish-with-me) · [IPM notes](https://github.com/Reet24-del/finish-with-me/blob/main/docs/ipm.md)
