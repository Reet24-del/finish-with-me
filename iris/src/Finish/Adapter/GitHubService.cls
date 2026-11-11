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
        Set request = ##class(Finish.Message.InvestigateRequest).%New()
        Set payload = {"kind":"coding","profile":"project"}
        Do payload.%Set("taskId","github:"_repo_":"_number)
        Do payload.%Set("title",$Extract(pInput.title,1,120))
        Do payload.%Set("blocker",$Extract(pInput.body,1,12000))
        Do payload.%Set("source","GitHub issue "_pInput.url_". Only the issue text is available; repository files have not been fetched.")
        Do payload.%Set("criteria","Resolve this issue with source-grounded evidence. If files or authorization are missing, request human review.")
        Set request.Payload = payload
        Set sc = ..SendRequestSync("Finish.AgentOperation",request,.response,90,"Stuck GitHub issue")
        If $$$ISERR(sc) { Lock -^FinishGitHub(repo,number) Return sc }
        Do pInput.%Set("agentResult",response.Result)
        Set ^FinishGitHub(repo,number,"snapshot") = pInput.%ToJSON()
        Set ^FinishGitHub(repo,number,"updatedAt") = pInput.updatedAt
        Lock -^FinishGitHub(repo,number)
        Return $$$OK
    } Catch ex { Lock -^FinishGitHub(repo,number) Return ex.AsStatus() }
}
}
