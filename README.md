# Finish With Me

**A small-step completion coach for the work you keep getting stuck on.** It helps with one concrete piece of a coding project or study session, does useful work alongside you, and only closes the task when there is evidence of a result.

This is an entry for the [InterSystems Programming Contest: AI Agents in Interoperability Workflows](https://openexchange.intersystems.com/contest/49). The app uses an InterSystems IRIS Interoperability production to route a task to an IRIS AI Hub agent. Native AI Hub tools inspect the task and capture a proposed repair without executing it. For coding, the agent proposes a bounded repair; a separate, sandboxed checker runs the agreed cases, and the user approves the result before it replaces the saved function. Study sessions guide the learner through a step and require an independent transfer question before completion.

[Watch the demo video](https://www.youtube.com/watch?v=aBBQBlfhaA8) — actual interface, live IRIS repair, independent checks, and study interaction.

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
