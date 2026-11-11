# Contest questionnaire — project-backed draft

Not submitted. The participant should review any subjective ratings, personal details and declarations before submission.

Official form: https://forms.cloud.microsoft/r/upQDKbj78D

Project: Finish With Me
Repository: https://github.com/Reet24-del/finish-with-me
Open Exchange: https://openexchange.intersystems.com/package/Finish-With-Me

What we built: A completion coach for project and study blockers. In native IRIS mode an AI Hub agent selects repair, hint or human review inside an Interoperability production. Escalations create native Workflow tasks. A custom GitHub inbound adapter reads stuck issues, and a bounded Embedded Python checker validates the receipt example.

What worked: Native typed tools, session usage statistics and request/response messages let us connect model work to a production. Child trace messages made tool behavior visible alongside Workflow escalation.

Integration challenges: An optional string tool argument was returned as null by the model and failed schema validation. Requiring an explicit string fixed the client contract. Generated study questions sometimes introduced mechanisms outside the notes, requiring stronger source grounding and user-visible limits on AI grading.

Models: Earlier recorded Qwen 27B receipt verification; current native routing on Groq GPT-OSS 120B. These are not a controlled quality comparison. Tokens and durations are recorded; dollar costs have not been independently reconciled.

Suggested product improvements: Clearer examples of routing into Workflow, nullable/optional tool argument handling, and a documented way to expose tool-level execution as Visual Trace child messages.

IRIS Agentic Dev: Not used. Codex assisted development.

No reproducible vendor bug is being claimed from these client integration issues.
