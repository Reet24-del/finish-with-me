Include Ensemble

/// The only production step that calls the AI Hub agent. Prompt and reply are message fields.
Class Finish.Agent.CompletionOperation Extends Ens.BusinessOperation
{

Parameter INVOCATION = "Queue";

Method OnMessage(pRequest As Finish.Message.AgentCall, Output pResponse As Finish.Message.AgentResult) As %Status
{
    Try {
        Set payload = pRequest.Payload
        If '$IsObject(payload) Set payload = {}
        Set agent = ##class(Finish.Agent.CompletionAgent).%New()
        Set agent.TaskContext = payload
        $$$ThrowOnError(agent.%Init())
        Set target = pRequest.TargetTool
        If target = "" Set target = "PrepareCandidate"
        Set prompt = pRequest.Prompt
        If prompt = "" Set prompt = "Call InspectTask first. Then call "_target_". Never claim execution or completion. Prompt version finish-decision-1."
        Set pResponse = ##class(Finish.Message.AgentResult).%New()
        Set pResponse.TaskId = pRequest.TaskId
        Set pResponse.Provider = "InterSystems IRIS AI Hub"
        Set pResponse.Model = agent.Model
        Set pResponse.PromptVersion = "finish-decision-1"
        Set pResponse.Prompt = prompt
        Set started = $ZH
        Set session = agent.CreateSession({"max_iterations":4})
        Set chat = agent.Chat(session, prompt)
        Set pResponse.LatencyMs = $NORMALIZE(($ZH-started)*1000,0)
        Set reply = ""
        If $IsObject(chat) {
            Try { Set reply = chat.%ToJSON() } Catch { Set reply = "" }
        } Else {
            Set reply = chat
        }
        Set pResponse.Reply = $Extract(reply,1,12000)
        Set decision = agent.InspectionTools.Proposal
        If '$IsObject(decision) Return $$$ERROR($$$GeneralError,"The agent did not prepare a candidate.")
        Set tools = []
        If agent.InspectionTools.InspectionCount > 0 Do tools.%Push("InspectTask")
        Set toolName = decision.%Get("tool")
        If toolName = "" Set toolName = target
        Do tools.%Push(toolName)
        Set pResponse.ToolsUsed = tools.%ToJSON()
        Set pResponse.ProposalJson = decision.%ToJSON()
        Set pResponse.ToolTrace = $Extract(agent.InspectionTools.TraceLog,1,8000)
        Try {
            Set stats = session.GetStats()
            If $IsObject(stats) {
                Try { Set pResponse.UsageJson = stats.%ToJSON() } Catch { Set pResponse.UsageJson = "" }
                Set pResponse.InputTokens = +stats.%Get("total_prompt_tokens")
                Set pResponse.OutputTokens = +stats.%Get("total_completion_tokens")
                If +stats.%Get("total_llm_duration_ms") > 0 Set pResponse.LatencyMs = +stats.%Get("total_llm_duration_ms")
            }
        } Catch {
        }
        Set pResponse.TraceSummary = "model "_pResponse.Model_" in "_pResponse.InputTokens_" out "_pResponse.OutputTokens_" ms "_pResponse.LatencyMs_" tools "_pResponse.ToolsUsed
        $$$TRACE(pResponse.TraceSummary)
        Return $$$OK
    } Catch ex {
        Return ex.AsStatus()
    }
}

}
