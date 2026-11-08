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
        Set session = agent.CreateSession()
        Set prompt = "Inspect this task and choose a next move. Return strict JSON only. Task JSON: "_payload.%ToJSON()
        Set response = agent.Chat(session,prompt)
        Set content = response.Content
        Set first = $Find(content,"{")-1
        Set last = $Length(content)-$Find($Reverse(content),"}")+2
        If (first<1) || (last<first) Throw ##class(%Exception.General).%New("The model did not return a JSON decision.")
        Set decision = {}.%FromJSON($Extract(content,first,last))
        Set stats = session.GetStats()
        Set toolsUsed = []
        If agent.InspectionTools.InspectionCount > 0 Do toolsUsed.%Push("InspectTask")
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
