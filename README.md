# Finish With Me

**A small-step completion coach for the work you keep getting stuck on.** It helps with one concrete piece of a coding project or study session, does useful work alongside you, and only closes the task when there is evidence of a result.

This is an entry for the [InterSystems Programming Contest: AI Agents in Interoperability Workflows](https://openexchange.intersystems.com/contest/49). The app uses an InterSystems IRIS Interoperability production to route a task to an IRIS AI Hub agent. Native AI Hub tools inspect the task and choose repair, hint or human review. Human escalations enter the native Workflow Engine; preparation tools never execute or approve the work. For coding, the agent proposes a bounded repair; a separate, sandboxed checker runs the agreed cases, and the user approves the result before it replaces the saved function. Study sessions guide the learner through a step and require an independent transfer question before completion.

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

6. Open [http://localhost:4318](http://localhost:4318). The header shows **IRIS CONNECTED** once the authenticated REST health endpoint responds. Project investigations, study preparation and answer assessments route through `Finish.Production` to `Finish.AgentOperation` and then Groq. This health label confirms connectivity, not the quality of any proposed repair.

The app defaults to Groq: set `AIHUB_PROVIDER=groq`, `GROQ_API_KEY`, and `AIHUB_MODEL=openai/gpt-oss-120b` in `.env`. AI Hub uses its OpenAI-compatible provider with `base_url=https://api.groq.com/openai/v1`; tool execution remains inside IRIS. For OpenAI instead, set `AIHUB_PROVIDER=openai`, `OPENAI_API_KEY`, and `AIHUB_MODEL=gpt-4.1-mini`. The selected key is read from the local `.env` by Docker Compose and is never sent to the browser or stored with task data. Judges should use their own provider key.

## Workflow

```text
Your files / notes → app API → authenticated IRIS REST
                              → Interoperability production
                              → native AI Hub agent → InspectTask
                                 ├ PrepareProject → replacement + user-run checks
                                 ├ PrepareLesson → explanation + private rubrics
                                 └ AssessAnswer → AI feedback + accepted/retry
Evidence → explicit user approval → saved completion record
```

The agent has no completion or code-execution tool. General project proposals never modify repository files automatically. The user runs relevant checks and supplies verification results. General study assessment is a separate AI Hub request that receives the stored question, private rubric, source and learner answer. Only the active question is sent to the browser; private rubrics are stripped from every task response. Generated questions may still be imperfect—review them against the source and use **Rework with this context** when needed.

For the original examples, the restricted JavaScript AST interpreter checks eight receipt-total cases, and deterministic arithmetic validates the equation exercise.

## Project layout

- `src/` — React interface.
- `server/` — local HTTP API, durable task store, IRIS client, and bounded code checker.
- `iris/src/Finish/` — IRIS REST dispatcher, AI Hub agent/tool, interoperability messages, and production.
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

New tasks use `project` and `subject` profiles. Source/notes are provided as pasted text or text-file selections (combined context up to 32,000 characters). Binary PDFs, repository cloning, autonomous file changes, execution of arbitrary project code and whole-project completion are not implemented. The `receipt-total` and `linear-equations` profiles remain as fixed examples. General project work, lesson generation and answer assessment all use native IRIS AI Hub tools.

The broader workflows were verified with a Python pagination task (four checks executed outside the application) and a biology session that rejected an instruction-only response and an incorrect transfer answer. Both completed through the API with explicit approval; see [docs/general-verification.json](docs/general-verification.json). These are synthetic scenario checks, not a guarantee of model accuracy across all subjects or projects.

Run `npm test` for completion gating, stale-write rejection, independent study transfer, restricted execution, and durable HTTP workflow checks. Run `npm run build` for the frontend production bundle. After starting the IRIS container, `sh scripts/setup-iris.sh` imports classes, configures the authenticated REST application, and starts the production.

Full Docker verification on build `2027.1.0AI.109.0` succeeded using Groq `openai/gpt-oss-120b`: the app called the authenticated IRIS REST endpoint, the production ran `InspectTask` and `PrepareCandidate`, and the candidate passed all eight independent checks before approval. The completed task survived an app-container restart; the frontend and JS bundle both returned HTTP 200. See [docs/docker-verification.json](docs/docker-verification.json). Earlier verification used Qwen, but subsequent runs exposed tool-call reliability issues; the default is now GPT-OSS with a four-iteration tool budget. The earlier synthetic result is in [docs/live-verification.json](docs/live-verification.json). This is one verified scenario, not a guarantee that every model response will pass. Use **Revise using failed checks** when a candidate fails.

Groq compatibility is implemented using the AI Hub provider `base_url` setting and Groq’s documented OpenAI-compatible endpoint. Run `node scripts/verify-live.mjs` to repeat the synthetic live scenario with your own key; it permits up to three checked proposals and records the actual outcome. For a host-run app, set `IRIS_BASE_URL=http://127.0.0.1:52773/csp/user/finish/` in `.env`.

To verify the full running Docker stack, run `node scripts/verify-docker.mjs`. It creates a labeled synthetic task in the workspace and records the actual result.


## Native interoperability workflow (0.3)

`Finish.AgentOperation` now requires the native agent to call `InspectTask` and
`ChooseRoute`. Repair prepares work; hint returns one nudge without grading or
completion; human sends an `EnsLib.Workflow.TaskRequest` to `Finish.HumanReview`.
A human task being queued is not human approval. The task stays open and needs
fresh evidence before completion.

Each agent run emits native child messages to `Finish.TraceOperation`: start,
actual inspection/routing/preparation tool data, result or error. The result
includes the model, prompt version, duration and AI Hub token statistics. The
[synthetic routing report](docs/routing-verification.json) records the three live
routes and actual native Workflow inbox evidence.

The receipt checker uses `Finish.CheckOperation` → `Finish.Check.Receipt` in
Embedded Python in native mode. It interprets only the bounded JavaScript AST;
submitted code is never evaluated, imported or run as host code. The original
JavaScript checker remains for disconnected examples and hosted Groq mode.
Run `node scripts/verify-native-checker.mjs` with a private local `.env` to compare
valid, buggy and unsupported candidates against the native checker.

`Finish.GitHubIssues` is a custom inbound adapter/service. In Production Settings,
set **Repository**, **Label** (default `stuck`) and **CallInterval**. It polls at
most ten open issues per pass, excludes pull requests and deduplicates by issue
number/update timestamp. It does not fetch repository files or modify GitHub.
The private native workspace has **Import stuck GitHub issues** to bring its
recorded issues into the app. Shared hosted visitor workspaces cannot import
this private native feed. The supplied [fixture](test/fixtures/github-issues.json)
is synthetic and creates no GitHub issue; ingestion, PR exclusion and duplicate
suppression were verified through the actual adapter.

### Reproduce DPI-I-689 in Visual Trace

1. Run the native Docker setup and `sh scripts/setup-iris.sh` with your own key.
2. Create a project with enough source to repair; ask for a hint on a separate
   study task; create a third task that needs an authorized maintainer without
   access to repository files. The native agent selects the route in each case.
3. Open Management Portal → Interoperability → View → Messages, locate the
   investigation and open **Visual Trace**. Match its session ID to the returned
   `traceSessionId`; expand the child events sent to `Finish.TraceOperation`.
4. Inspect `AgentResult` for model, prompt version, token statistics and duration;
   follow `ChooseRoute` and preparation events. The recorded repair/hint/human
   runs used sessions 77, 89 and 99 on the test instance. IDs will differ on yours.
5. For human routing, inspect `Finish.HumanReview` in the native Workflow Portal.
   The existing local reviewer is added to that workflow role by setup; no
   security password/role permissions are added for this inbox configuration.

[Community idea DPI-I-689](https://ideas.intersystems.com/ideas/DPI-I-689) asks for
Interoperability-based LLM pipeline traceability. Here, Visual Trace links agent
and tool events to the actual production and human-review messages. Compared
with Langfuse this is a focused local workflow trace, not a replacement for its
full LLM observability, evaluation or hosted analytics features. Native traces
are not produced by the separately labeled hosted Groq path.

### IPM package

`module.xml` packages the native classes as `finish-with-me-iris` version 0.3.0.
With IPM installed, load the checked-out source in an AI Hub-enabled,
Interoperability-enabled namespace:

```objectscript
zpm "load /path/to/finish-with-me -v"
```

Local IPM 0.10.10 load, validation, compilation and activation passed. This
installs classes only; follow the native setup instructions to configure your
private provider settings, authenticated REST app and reviewer inbox. Public
IPM registry publication is pending; `zpm "install finish-with-me-iris"` is not
claimed to work from the public registry yet. No vendor image, private key or
task data is packaged.

## Contest bonuses

These are evidence-backed requests for organizer review, not awarded points.
Rules: [official bonus announcement](https://community.intersystems.com/post/technology-bonuses-intersystems-programming-contest-ai-agents-interoperability-workflows).

| Bonus | Published points | Evidence and status |
| --- | ---: | --- |
| Docker | 2 | [Compose](docker-compose.yml), [native Docker verification](docs/docker-verification.json). Native IRIS runs in Docker. |
| Downloadable video | 3 | [MP4, no registration](https://github.com/Reet24-del/finish-with-me/releases/download/media-v1/Finish-With-Me-Demo.mp4). Original 9 November video; predates the new routes. |
| Workflow Engine | 2 | [Native escalation](iris/src/Finish/Agent/CompletionOperation.cls), [live routing and native inbox evidence](docs/routing-verification.json). Incomplete task created; no automatic approval. |
| Custom adapter | 2 | [GitHub inbound adapter](iris/src/Finish/Adapter/GitHubInbound.cls), [service](iris/src/Finish/Adapter/GitHubService.cls), [app verification](docs/interop-app-verification.json). Live empty-feed poll and synthetic ingestion/PR exclusion/deduplication verified. |
| Embedded Python | 3 | [Bounded checker](iris/src/Finish/Check/Receipt.cls), [production operation](iris/src/Finish/Check/Operation.cls), [verification](docs/embedded-python-verification.json). |
| Community idea DPI-I-689 | 4 | [Idea](https://ideas.intersystems.com/ideas/DPI-I-689), [native trace recorder](iris/src/Finish/Trace/Recorder.cls), [reproduction instructions above](#reproduce-dpi-i-689-in-visual-trace). Open Exchange dedicated idea-field update still pending. |
| IPM / ZPM | 2 | [Manifest](module.xml); local installation verified. Registry publication pending; not claimed complete. |
| Questionnaire | 1 | [Project-backed draft](docs/questionnaire-draft.md); not submitted. |
| First and second DC articles | 2 + 1 | [Build article draft](docs/articles/01-building-finish-with-me.md), [reproduction article draft](docs/articles/02-reproducing-native-workflow.md); not published. |
| Online demo | 2 | [Public site](https://finish-with-me.onrender.com/). Separately hosted mode; no claim of a public native IRIS workflow. Awaiting organizer eligibility review. |

The [bonus comment](docs/bonus-claim-draft.md) is prepared but has not been posted.
No vendor-bug, PEX, Vector Search or guaranteed prize claim is made.
