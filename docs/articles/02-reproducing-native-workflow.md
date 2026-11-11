# Reproduce three agent routes and inspect the human queue in Finish With Me

*Second Developer Community article draft. Not yet published.*

A useful demo should let a reviewer distinguish a working agent decision from a static screen. Finish With Me includes synthetic inputs and saved evidence for repair, hint and human-review outcomes.

## Start the native version

Use the AI Hub Community image from the InterSystems EAP portal and load it locally. The tested image is `2027.1.0AI.109.0`; the contest announcement's comments allow the newer build. The repository explains how to tag it. Vendor images and provider keys are not included in the project release.

Copy `.env.example` to `.env`, set your own private provider key and local IRIS password, then run the documented Docker and setup steps. `scripts/setup-iris.sh` compiles the classes, configures the authenticated REST application and creates a Workflow role for the local reviewer before starting `Finish.Production`.

A request to `/csp/user/finish/investigate` must authenticate. For programmatic examples, read the credentials from your local environment rather than putting them in a URL, screenshot or shell history.

## Repair: enough context for a bounded change

Provide a project task whose source contains `return items[start:size]` and whose success criterion is “return size items starting at start.” The agent should inspect the task, choose `repair` and call `PrepareProject`.

Inspect the proposed complete replacement, then run its checks in your own environment. A proposal is not a passing test result. General project verification is user-reported, and the task cannot close until the current artifact has evidence and the user approves it.

The original receipt-total example has a narrower independent check path. In native mode its JavaScript AST is sent to `Finish.CheckOperation`, where Embedded Python interprets only the supported subset and runs the eight built-in cases. `node scripts/verify-native-checker.mjs` checks good, buggy and unsupported candidates against the native endpoint.

## Hint: respect a learner's request for less help

Provide study material about osmosis and ask for only a nudge. The agent should choose `hint`, not prepare a full lesson. The application displays the hint and keeps the task in the understanding stage. No grading or completion evidence is created.

For a full study session instead, supply notes and a concrete learning goal. The lesson includes an exact quotation, a guided exercise and a separate transfer exercise. Private rubrics are removed from task API responses. An accepted independent answer is AI feedback, not a guaranteed grade.

## Human: missing access should lead somewhere real

Describe a blocker requiring an authorized maintainer and unavailable repository/log access. The agent should choose `human`. The production sends an `EnsLib.Workflow.TaskRequest` to `Finish.HumanReview`.

Open the native Workflow Portal as the configured reviewer and inspect that role's inbox. The synthetic verification created an incomplete task. A queued task does not mean a person reviewed it, and the application does not automatically mark the underlying project complete.

For a terminal check, use `%ResultSet` with `EnsLib.Workflow.Engine:ListTasksForRole` and pass `Finish.HumanReview`. The evidence file records the request body ID separately from the Workflow task ID; they are different identifiers.

## Inspect the same run in Visual Trace

Open Interoperability → View → Messages in the Management Portal, locate the investigation and open its Visual Trace. Use the session ID returned by the endpoint to find the exact run. Follow child messages to `Finish.TraceOperation` and the human-review branch where applicable.

`AgentStart` records the supplied task; `InspectTask` and preparation/routing events record actual tool data; `AgentResult` records the model, prompt version, usage and duration. Source content is visible to authenticated operators, so use the bundled synthetic examples when sharing screenshots.

## Import stuck GitHub issues

`Finish.GitHubIssues` uses a custom inbound adapter to poll the configured repository for open issues labeled `stuck`. It excludes pull requests and deduplicates by repository, issue number and update timestamp. Only the issue text is fetched; missing source access remains missing, and can lead to a human route.

The live read-only poll returned an empty list during testing. A separate bundled synthetic fixture proved ingestion, pull-request exclusion and duplicate suppression through the actual adapter. It did not create public GitHub issues. In the private native workspace, use **Import stuck GitHub issues** to bring the recorded issue into the application's task list.

[Implementation and evidence](https://github.com/Reet24-del/finish-with-me) · [Native validation](https://github.com/Reet24-del/finish-with-me/blob/main/docs/routing-verification.json)
