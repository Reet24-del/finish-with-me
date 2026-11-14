# A completion coach needs a routing decision, not just a generated answer

*Draft for Developer Community. Not yet published.*

Finish With Me started with a familiar problem: I get stuck on a project or a study question, then avoid coming back. A reminder does not remove that blocker. The application helps with one bounded piece of work and keeps it open until there is evidence of a result.

The native version uses an IRIS Interoperability production and an AI Hub agent. The production has three outcomes: prepare work, give a hint, or send the blocker to a person. These are different actions, not three variations of the same chat response.

This draft describes the decision production now on main. It does not claim that the combined production was run against a live IRIS instance. Earlier JSON notes under `docs/` describe runs from before the pieces were joined.

## Where the agent changes the workflow

A `Finish.Message.WorkItem` enters `Finish.Production` in one of two ways. The Node app, or a manual client, posts it to `POST /csp/user/finish/decide`. Or `Finish.GitHubIssues` polls open issues through the custom adapter `Finish.Adapter.GitHubInbound` and sends the issue straight into `Finish.DecisionProcess`. The REST path goes through `Finish.DecisionService` first; the GitHub service calls the process directly. Neither path calls `Finish.AgentOperation` from REST.

`Finish.DecisionProcess` asks `Finish.MemoryOperation` for similar finished blockers, then calls `Finish.AgentOperation` (`Finish.Agent.CompletionOperation`), which runs `Finish.Agent.CompletionAgent`. The lookup uses `VECTOR_COSINE` on a lexical hash. It has not been executed on a live IRIS instance. The agent has to call `InspectTask` first. That tool returns the task plus a completion contract for its profile. Then, except for study assessment, it calls `ChooseRoute` with one of three routes:

- `repair`: prepare one source-grounded file replacement, a stuck-message repair, or a lesson with private grading rubrics, using `PrepareProject`, `PrepareRepair`, `PrepareLesson`, or `PrepareCandidate` for the receipt example;
- `hint`: give one nudge and leave the task open;
- `human`: escalate to a person.

The operation checks that a route exists. A repair without prepared work fails. A hint stops after `ChooseRoute`. A human outcome is not presented as queued until sending the Workflow request succeeds. Neither a hint nor an escalation can create passing evidence or finish a task.

Every route then goes through the Embedded Python gate, `Finish.Gate.Rules`, which calls `iris/gate/engine.py`. A hint leaves the task at `needs-evidence`. A human route escalates and opens `Finish.HumanReview`. If a repair gate answers `pending-approval`, the process opens `Finish.Reviewer`. Repeated failure, or a stuck message with no failure signature, opens `Finish.Supervisor`. All three roles are `EnsLib.Workflow` operations (`Finish.Workflow.HumanApproval`).

A queued workflow task is not completion. Approve and send-back call the production again. The gate re-checks the same evidence, and only then is the workflow task completed. The Node app marks an IRIS-owned task complete only when the production outcome is `complete`.

## What went wrong in the integration

These notes are from earlier runs, before the decision process, the gate, and the workflow roles were joined. They are not a run of this combined production.

A tool signature had an optional string `hint`. On an earlier call the model supplied `null`, and AI Hub correctly rejected the arguments as inconsistent with the schema. The prompt now requires a string for every route and tells the model to pass `hint=Not applicable` when no hint is needed. This was a client-contract problem; I am not claiming an AI Hub product bug for it.

Another failure was less technical: a generated study question introduced a physical setting absent from the source material. That made the lesson less useful even though its JSON was valid. The hosted-provider instructions were tightened to keep the medium and mechanisms within the material. The app also requires an exact source quotation and keeps the independent-question rubric out of the browser. These checks reduce some mistakes, but they do not make AI grading infallible.

## Models, tokens and cost

These figures are from earlier runs, before this combined decision process was merged. They are not a measurement of the current production on an IRIS instance.

An earlier saved native verification used `qwen/qwen3.8-27b`. A later routing run, still from before the pieces were joined, used Groq's `openai/gpt-oss-120b` through AI Hub's OpenAI-compatible provider. The earlier receipt result passed eight checks; that routing run tested a larger routing contract. These are different tasks and configurations, so they are not a controlled model-quality comparison.

That earlier repair routing run recorded 4,607 prompt tokens, 916 completion tokens, three tool calls and about 5.8 seconds of wall time. The earlier note records the other routes separately. Token and duration statistics come from the native AI Hub session on that earlier run. The project selected Groq's free tier, but it has not recorded a billing reconciliation or a dollar-cost benchmark. Token counts should not be presented as a measured invoice amount.

## Debugging with Visual Trace

`Finish.Trace.Recorder` writes each step to `Finish.TraceOperation` in the same session: `DecisionStart`, `AgentStart`, each tool call, `AgentResult` or `AgentError` (model, prompt version, tokens, latency, and route), `GateResult`, and `WorkflowOpened`. `Finish.Message.AgentCall` carries the prompt, prompt version, target tool, and payload. `Finish.Message.AgentResult` carries the model, the reply, the route, the tool trace, the proposal, input and output tokens, and latency. Errors have their own event rather than disappearing into the browser.

A proposal session is service → process → agent → gate, and a workflow operation when the gate asks for a person. The later approve or send-back is its own session: service → process → gate recheck → workflow completion.

This addresses [DPI-I-689](https://ideas.intersystems.com/ideas/DPI-I-689): use Interoperability to trace an LLM pipeline. It is a deliberately smaller solution than Langfuse: Visual Trace links model work to the production and human queue, while Langfuse provides broader LLM observability features. This project does not claim to replace those features.

## Independent checks and the limits of completion

The receipt example's checker runs as Embedded Python. `Finish.Check.Receipt` interprets a bounded JavaScript AST and never evaluates or imports submitted code. It remains available at `POST /csp/user/finish/check` for a candidate that is not yet owned by a decision. When an IRIS-owned receipt candidate is checked, the completion gate in `iris/gate/engine.py` runs the eight built-in cases. Earlier notes under `docs/` record a valid candidate, the original concatenating version, and unsupported host-process calls. Those notes predate this combined production.

General project proposals still need checks in the user's actual project environment. The server does not claim it ran that repository. Study feedback is explicitly AI-assessed, and completion still needs a reviewer to approve after the gate accepts the same evidence.

The free hosted option is also distinct: it calls Groq directly and identifies itself as `Groq (hosted)`. It is not a hosted native IRIS agent. The local Docker setup is how to see native routing, the Workflow Engine, Embedded Python, and Visual Trace.

I did not use IRIS Agentic Dev in this implementation; Codex assisted development. The project should be judged from its code, not from a run this draft does not claim.

[Source and installation](https://github.com/Reet24-del/finish-with-me) · [Downloadable original demo](https://github.com/Reet24-del/finish-with-me/releases/download/media-v1/Finish-With-Me-Demo.mp4)
