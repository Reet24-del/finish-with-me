Include %occStatus
Class Finish.Adapter.GitHubService Extends Ens.BusinessService
{
Parameter ADAPTER = "Finish.Adapter.GitHubInbound";
Method OnProcessInput(pInput As %RegisteredObject, Output pOutput As %RegisteredObject, pHint As %String = "") As %Status
{
    Set pInput = pInput.Payload
    Set repo = pInput.repository, number = pInput.number
    Lock +^FinishGitHub(repo,number):1
    If '$Test Return $$$OK
    Try {
        If $Get(^FinishGitHub(repo,number,"updatedAt")) = pInput.updatedAt {
            Lock -^FinishGitHub(repo,number)
            Return $$$OK
        }
        Set request = ##class(Finish.Message.WorkItem).%New()
        Set request.Action = "investigate"
        Set request.TaskId = "github:"_repo_":"_number
        Set request.Kind = "coding"
        Set request.Profile = "project"
        Set request.Title = $Extract(pInput.title,1,120)
        Set payload = {"action":"investigate","kind":"coding","profile":"project"}
        Do payload.%Set("taskId",request.TaskId)
        Do payload.%Set("title",request.Title)
        Do payload.%Set("description","Imported from a stuck GitHub issue. Repository files were not fetched.")
        Do payload.%Set("blocker",$Extract(pInput.body,1,12000))
        Do payload.%Set("tried","")
        Do payload.%Set("source","GitHub issue "_pInput.url_". Only the issue text is available; repository files have not been fetched.")
        Do payload.%Set("material","")
        Do payload.%Set("criteria","Resolve this issue with source-grounded evidence. If files or authorization are missing, request human review.")
        Do payload.%Set("subject","GitHub issue")
        Set request.Payload = payload
        Set request.TraceSummary = "GitHub issue "_repo_"#"_number
        Set sc = ..SendRequestSync("Finish.DecisionProcess",request,.response,120,"Stuck GitHub issue")
        If $$$ISERR(sc) { Lock -^FinishGitHub(repo,number) Return sc }
        If '$IsObject(response) { Lock -^FinishGitHub(repo,number) Return $$$ERROR($$$GeneralError,"The decision process returned no response.") }
        Set decision = response.AsObject()
        If $IsObject(decision.gate) && $IsObject(decision.gate.route) {
            Do decision.%Set("route",decision.gate.route)
            If decision.workflowTaskId '= "" {
                Do decision.route.%Set("workflowRequestId",decision.workflowTaskId)
                Do decision.route.%Set("workflowRole",decision.role)
            }
        }
        Do decision.%Set("traceSessionId",decision.sessionId)
        Do pInput.%Set("agentResult",decision)
        Set ^FinishGitHub(repo,number,"snapshot") = pInput.%ToJSON()
        Set ^FinishGitHub(repo,number,"updatedAt") = pInput.updatedAt
        Lock -^FinishGitHub(repo,number)
        Return $$$OK
    } Catch ex { Lock -^FinishGitHub(repo,number) Return ex.AsStatus() }
}
}
