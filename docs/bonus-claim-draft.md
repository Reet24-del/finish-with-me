# Bonus-thread comment — ready to paste, not posted

Paste this on the [technology bonus results](https://community.intersystems.com/post/technology-bonus-results-intersystems-programming-contest-ai-agents-interoperability-workflows) post. It asks the organizers to review 11 more points that are now on main: Workflow Engine (2), Custom Adapter (2), Embedded Python (3), and Community idea DPI-I-689 (4). It has not been posted.

The IPM manifest on main is now `finish-with-me-iris` 0.3.0 with the contest `SystemRequirements` line, but the package is still not on the public registry, which is why IPM is not claimed in the comment below.

```text
Hi! Could you please review these additional bonuses for Finish With Me?

The decision production is now on main:
https://github.com/Reet24-del/finish-with-me

The mapping of each bonus to code is in the README:
https://github.com/Reet24-del/finish-with-me#contest-bonuses

Workflow Engine (2): Finish.Reviewer, Finish.Supervisor, and Finish.HumanReview are EnsLib.Workflow operations. A queued task is not completion; complete requires reviewer approval plus a second gate check.
https://github.com/Reet24-del/finish-with-me/tree/main/iris/src/Finish/Workflow

Custom Adapter (2): Finish.Adapter.GitHubInbound polls open GitHub issues, skips pull requests, and deduplicates by update time. Finish.GitHubIssues then sends a Finish.Message.WorkItem to Finish.DecisionProcess.
https://github.com/Reet24-del/finish-with-me/blob/main/iris/src/Finish/Adapter/GitHubInbound.cls

Embedded Python (3): The completion gate is iris/gate/engine.py, called from Finish.Gate.Rules. Finish.Check.Receipt remains the AST checker.
https://github.com/Reet24-del/finish-with-me/blob/main/iris/gate/engine.py

Community Opportunity idea DPI-I-689 (4): Every agent run is interoperability messages in one Visual Trace session: AgentStart, tool calls, AgentResult or AgentError (model, prompt version, tokens, latency, route), DecisionStart, GateResult, and WorkflowOpened. The README has reproduction steps and a comparison with Langfuse.
https://ideas.intersystems.com/ideas/DPI-I-689
https://github.com/Reet24-del/finish-with-me#see-a-decision-in-visual-trace

Already credited: Docker (2), Online Demo (2), and Video (3). The downloadable MP4 is at
https://github.com/Reet24-del/finish-with-me/releases/download/media-v1/Finish-With-Me-Demo.mp4
It predates this combined production.

Not claimed here: IPM registry publication (a module.xml is in the repo but the package is not yet on the public registry), Developer Community articles, or the questionnaire. Those will follow.

Thank you for reviewing.
```
