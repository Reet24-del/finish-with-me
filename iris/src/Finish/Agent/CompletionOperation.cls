Include %occStatus

Class Finish.Agent.CompletionOperation Extends Ens.BusinessOperation
{
Method OnMessage(pRequest As Finish.Message.InvestigateRequest, Output pResponse As Finish.Message.InvestigateResponse) As %Status
{
    Try {
        Set payload = pRequest.Payload
        Set agent = ##class(Finish.Agent.CompletionAgent).%New()
        $$$ThrowOnError(agent.%Init())
        Set session = agent.CreateSession()
        Set prompt = "Inspect this task and choose a next move. Return strict JSON only. Task JSON: "_payload.%ToJSON()
        Set response = agent.Run(session,prompt,8)
        Set content = response.Content
        Set decision = {}.%FromJSON(content)
        Set stats = session.GetStats()
        Set toolsUsed = []
        If stats.%Get("total_tool_calls") > 0 Do toolsUsed.%Push("InspectTask")
        Set result = {}
        Do result.%Set("provider","InterSystems IRIS AI Hub")
        Do result.%Set("decision",decision)
        Do result.%Set("toolsUsed",toolsUsed)
        Do result.%Set("usage",{})
        Set pResponse = ##class(Finish.Message.InvestigateResponse).%New()
        Set pResponse.Result = result
        Quit $$$OK
    } Catch ex {
        Quit ex.AsStatus()
    }
}
}
