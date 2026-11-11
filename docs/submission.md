# Submission preparation

Status: full Docker app + authenticated IRIS REST + production + Groq GPT-OSS verified. Both InspectTask and PrepareCandidate were called; the candidate passed all 8 independent checks before approval. Completion persisted after an app-container restart, and frontend/JS requests returned HTTP 200. Public repository published at https://github.com/Reet24-del/finish-with-me. Open Exchange version 1.0.0 sent for approval at https://openexchange.intersystems.com/portal/products/Finish-With-Me/edit after explicit user acceptance of the contest terms. The portal shows Pending approval, with Submit to Contest checked. Organizer approval and public contest listing remain pending.

## Name
Finish With Me

## Short description
A task recovery assistant that helps a stuck learner or developer work through one concrete piece, then requires evidence before marking it complete.

## Problem
Getting stuck can make returning to an unfinished project or study session harder. A reminder leaves the blocker unresolved. This prototype preserves the blocker and prior attempts, helps make a bounded repair or practice step, and records a checkable result.

## Current implementation
`Finish.DecisionProcess` receives a work item from the REST service or from `Finish.GitHubIssues`. It calls `Finish.Agent.CompletionAgent` (`InspectTask`, then `ChooseRoute` of repair, hint, or human). The Embedded Python gate then routes repair work to needs-evidence, reject, escalate, or pending-approval. `Finish.Reviewer` approves a passing gate, `Finish.Supervisor` takes repeated failures, and `Finish.HumanReview` takes an agent human route. `Finish.Trace.Recorder` writes each of those steps into the same Visual Trace session. The Node app renders the decision and, for an IRIS-owned task, calls IRIS to approve or send it back. Hosted Groq and the local receipt and algebra examples do not use this production. The AST checker `Finish.Check.Receipt` remains available at `POST /check`. This combined path has not been executed against a running IRIS instance; earlier JSON notes under `docs/` describe runs from before the pieces were joined.

## Required before submitting
- Load the AI Hub Community image and run the ObjectScript import/production startup.
- Configure the authenticated Finish.Api web application.
- Run a real agent investigation with a private provider key and confirm InspectTask was used.
- Demonstrate a failing candidate, passing candidate, and approval; demonstrate independent study transfer.
- Publish the source repository under the intended Reet24-del account.
- Add the public repository URL and an accurate demo walkthrough to Open Exchange and select contest 49.
- Review the completed application form before submitting it.

## Demo outline
Show the saved blocker → agent investigation → proposed candidate → independent checks → approval → durable result. Then show guided equation work → incorrect transfer answer keeps the task open → correct transfer answer permits completion.

## Evidence to record after the live run
Actual AI Hub build, provider/model, run date, production trace/session, tool calls, outcome, and any limitations observed. Never publish keys or private task content.

## Uploaded demo video

https://www.youtube.com/watch?v=aBBQBlfhaA8

Added to the GitHub README. Updating the dedicated Open Exchange YouTube field remains pending.

## Version 0.2.0 improvements

Added user-supplied project files/context and source-grounded study sessions through native IRIS AI Hub tools. General projects use explicit user-reported verification; failing results keep work open and inform revisions. Study uses private rubrics, source quotations and separately labeled AI assessment. Interactive landing previews and feature tabs make the workflows explorable. Original deterministic examples remain available. Live Python and biology checks are recorded in general-verification.json. The existing demo video shows the earlier fixed examples; Open Exchange release metadata/video have not been updated to a new release through the portal.
