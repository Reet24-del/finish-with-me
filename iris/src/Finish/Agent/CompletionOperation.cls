Include %occStatus

Class Finish.Agent.CompletionOperation Extends Ens.BusinessOperation
{
Method OnMessage(pRequest As Finish.Message.InvestigateRequest, Output pResponse As Finish.Message.InvestigateResponse) As %Status
{
    Try {
        Set payload = pRequest.Payload
        Set agent = ##class(Finish.Agent.CompletionAgent).%New()
        Set agent.TaskContext = payload
        $$$ThrowOnError(agent.%Init())
        Set session = agent.CreateSession({"max_iterations":4})
        Set prompt = "InspectTask reads this stored task. Then call PrepareCandidate with the replacement JavaScript function source in its code argument. The caller checks the result. Task JSON: "_payload.%ToJSON()
        Set response = agent.Chat(session,prompt)
        Set decision = agent.InspectionTools.Proposal
        If '$IsObject(decision) Throw ##class(%Exception.General).%New("The agent did not prepare a candidate.")
        Set stats = session.GetStats()
        Set toolsUsed = []
        If agent.InspectionTools.InspectionCount > 0 Do toolsUsed.%Push("InspectTask")
        If $IsObject(decision) Do toolsUsed.%Push("PrepareCandidate")
        Set result = {}
        Do result.%Set("provider","InterSystems IRIS AI Hub")
        Do result.%Set("decision",decision)
        Do result.%Set("toolsUsed",toolsUsed)
        Do result.%Set("usage",stats)
        Set pResponse = ##class(Finish.Message.InvestigateResponse).%New()
        Set pResponse.Result = result
        Return $$$OK
    } Catch ex {
        Return ex.AsStatus()
    }
}
}
