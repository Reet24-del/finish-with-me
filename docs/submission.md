# Submission preparation

Status: full Docker app + authenticated IRIS REST + production + Groq GPT-OSS verified. Both InspectTask and PrepareCandidate were called; the candidate passed all 8 independent checks before approval. Completion persisted after an app-container restart, and frontend/JS requests returned HTTP 200. Public repository published at https://github.com/Reet24-del/finish-with-me. Open Exchange draft saved at https://openexchange.intersystems.com/portal/products/Finish-With-Me/edit; final contest submission is pending acceptance of contest terms.

## Name
Finish With Me

## Short description
A task recovery assistant that helps a stuck learner or developer work through one concrete piece, then requires evidence before marking it complete.

## Problem
Getting stuck can make returning to an unfinished project or study session harder. A reminder leaves the blocker unresolved. This prototype preserves the blocker and prior attempts, helps make a bounded repair or practice step, and records a checkable result.

## Current implementation
An IRIS interoperability production routes a coding investigation to a native AI Hub agent with an InspectTask tool. The returned candidate is independently checked in a restricted JavaScript interpreter. Passing checks require user approval before saving. A separate local linear-equation flow requires a fresh transfer answer. The current profiles are receipt totals and linear equations; arbitrary repositories and subjects are outside this version.

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
