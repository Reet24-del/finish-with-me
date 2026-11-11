# A completion coach needs a routing decision, not just a generated answer

*Draft for Developer Community. Not yet published.*

Finish With Me started with a familiar problem: I get stuck on a project or a study question, then avoid coming back. A reminder does not remove that blocker. The application helps with one bounded piece of work and keeps it open until there is evidence of a result.

The native version uses an IRIS Interoperability production and an AI Hub agent. The production now has three outcomes: prepare work, give a hint, or send the blocker to a person. These are different actions, not three variations of the same chat response.

## Where the agent changes the workflow

The REST service sends an `InvestigateRequest` to `Finish.AgentOperation`. The agent first calls `InspectTask`, then `ChooseRoute`:

- `repair`: prepare one source-grounded file replacement or a lesson with private grading rubrics;
- `hint`: give one nudge and leave the task open;
- `human`: create a native Workflow Engine request for a reviewer.

The operation checks that a route exists. A repair without prepared work fails. A human outcome is not presented as queued until sending the Workflow request succeeds. Neither a hint nor an escalation can create passing evidence or finish a task.

A synthetic live run on 11 November produced all three routes. The repair corrected a Python pagination slice. The hint gave a next step about osmosis without generating a full lesson. The human case lacked repository access and needed an authorized maintainer. The native Workflow query showed an incomplete task in `Finish.HumanReview`, rather than an application-only flag pretending to be a human workflow.

Implementation: [operation](https://github.com/Reet24-del/finish-with-me/blob/main/iris/src/Finish/Agent/CompletionOperation.cls), [tools](https://github.com/Reet24-del/finish-with-me/blob/main/iris/src/Finish/Agent/TaskTools.cls), [recorded synthetic run](https://github.com/Reet24-del/finish-with-me/blob/main/docs/routing-verification.json).

## What went wrong in the integration

A tool signature had an optional string `hint`. In a live call the model supplied `null`, and AI Hub correctly rejected the arguments as inconsistent with the schema. The fix was to make the field required and explicitly request a string for every route. This was a client-contract problem; I am not claiming an AI Hub product bug for it.

Another failure was less technical: a generated study question introduced a physical setting absent from the source material. That made the lesson less useful even though its JSON was valid. The hosted-provider instructions were tightened to keep the medium and mechanisms within the material. The app also requires an exact source quotation and keeps the independent-question rubric out of the browser. These checks reduce some mistakes, but they do not make AI grading infallible.

## Models, tokens and cost

An earlier saved native verification used `qwen/qwen3.8-27b`. The current routing run uses Groq's `openai/gpt-oss-120b` through AI Hub's OpenAI-compatible provider. The earlier receipt result passed eight checks; the newer run tests a larger routing contract. These are different tasks and configurations, so they are not a controlled model-quality comparison.

The repair routing run recorded 4,607 prompt tokens, 916 completion tokens, three tool calls and about 5.8 seconds of wall time. The evidence file records the other routes separately. Token and duration statistics come from the native AI Hub session. The project selected Groq's free tier, but it has not recorded a billing reconciliation or a dollar-cost benchmark. Token counts should not be presented as a measured invoice amount.

## Debugging with Visual Trace

The outer agent request and response are interoperability messages. The tools also send child `TraceEvent` messages to `Finish.TraceOperation`. The recorded repair, hint and human sessions contain five, four and four trace events respectively. They include agent start/result, the actual tool arguments/results, model, prompt version, token statistics and duration. Errors have their own event rather than disappearing into the browser.

This addresses [DPI-I-689](https://ideas.intersystems.com/ideas/DPI-I-689): use Interoperability to trace an LLM pipeline. It is a deliberately smaller solution than Langfuse: Visual Trace links model work to the production and human queue, while Langfuse provides broader LLM observability features. This project does not claim to replace those features.

## Independent checks and the limits of completion

The receipt example's checker now runs as an Embedded Python production operation in native mode. It interprets a bounded JavaScript AST; it never evaluates or imports submitted code. The valid candidate passed 8/8 cases, the original concatenating version passed 1/8, and unsupported host-process/network calls passed 0/8. Unsupported syntax cannot count as valid input rejection.

General project proposals still need checks in the user's actual project environment. The server does not claim it ran that repository. Study feedback is explicitly AI-assessed, and completion still needs a separate user approval.

The free hosted option is also distinct: it calls Groq directly and identifies itself as `Groq (hosted)`. It is not evidence of a hosted native IRIS agent. Native routing, Workflow, Embedded Python and Visual Trace are demonstrated by the local IRIS setup.

I did not use IRIS Agentic Dev in this implementation; Codex assisted development. The project should be judged from its code and reproducible evidence, not a tool-use claim it cannot substantiate.

[Source and installation](https://github.com/Reet24-del/finish-with-me) · [Downloadable original demo](https://github.com/Reet24-del/finish-with-me/releases/download/media-v1/Finish-With-Me-Demo.mp4)
