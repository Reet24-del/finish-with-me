Include %occStatus

Class Finish.Api Extends %CSP.REST
{

Parameter CHARSET = "utf-8";

XData UrlMap
{
<Routes>
  <Route Url="/check" Method="POST" Call="Check" />
  <Route Url="/imports" Method="GET" Call="Imports" />
  <Route Url="/health" Method="GET" Call="Health" />
  <Route Url="/investigate" Method="POST" Call="Decide" />
  <Route Url="/decide" Method="POST" Call="Decide" />
</Routes>
}

ClassMethod Health() As %Status
{
    Set %response.ContentType = "application/json; charset=utf-8"
    Set body = {}
    Do body.%Set("ok",1,"boolean")
    Do body.%Set("provider","InterSystems IRIS AI Hub")
    Do body.%Set("production","Finish.Production")
    Do body.%Set("decision","Finish.DecisionProcess")
    Do body.%Set("gate","embedded-python")
    Set workflow = []
    Do workflow.%Push("Finish.Reviewer")
    Do workflow.%Push("Finish.Supervisor")
    Do body.%Set("workflow",workflow)
    Write body.%ToJSON()
    Return $$$OK
}

ClassMethod Decide() As %Status
{
    Try {
        Set stage = "decode-request"
        Set input = {}.%FromJSON(%request.Content.Read(240000))
        Set request = ##class(Finish.Message.WorkItem).%New()
        Set request.Action = input.%Get("action")
        If request.Action = "" Set request.Action = "investigate"
        Set request.TaskId = input.%Get("taskId")
        Set request.Kind = input.%Get("kind")
        Set request.Profile = input.%Get("profile")
        Set request.Title = $Extract(input.%Get("title"),1,200)
        Set request.AttemptCount = +input.%Get("attemptCount")
        Set request.HumanAction = input.%Get("humanAction")
        If request.HumanAction = "" Set request.HumanAction = $Select(request.Action="approve":"approve",request.Action="reject":"reject",1:"")
        Set request.ApprovalToken = input.%Get("approvalToken")
        Set request.WorkflowTaskId = input.%Get("workflowTaskId")
        Set request.WorkflowRole = input.%Get("workflowRole")
        Set request.DistributionToken = input.%Get("distributionToken")
        If $IsObject(input.%Get("proposal")) Set request.ProposalJson = input.proposal.%ToJSON()
        If $IsObject(input.%Get("toolsUsed")) Set request.ToolsUsedJson = input.toolsUsed.%ToJSON()
        Set request.Payload = input
        Set request.TraceSummary = "Work item "_request.TaskId_" "_request.Action_" "_request.Profile_" "_$Extract(request.Title,1,80)
        Set stage = "create-service"
        Set sc = ##class(Ens.Director).CreateBusinessService("Finish.DecisionService",.service)
        If $$$ISERR(sc) Return ..Fail(500, $System.Status.GetErrorText(sc), stage)
        Set stage = "run-decision"
        Set sc = service.ProcessInput(request,.response)
        If $$$ISERR(sc) Return ..Fail(500, $System.Status.GetErrorText(sc), stage)
        If '$IsObject(response) Return ..Fail(500, "The decision process returned no response.", stage)
        Set %response.ContentType = "application/json; charset=utf-8"
        Write response.AsObject().%ToJSON()
        Return $$$OK
    } Catch ex {
        Return ..Fail(500, ex.DisplayString(), $Get(stage), ex.Location)
    }
}
ClassMethod Check() As %Status
{
    Set %response.ContentType = "application/json; charset=utf-8"
    Try {
        Set input = {}.%FromJSON(%request.Content.Read(200000))
        Set request = ##class(Finish.Message.CheckRequest).%New()
        Set request.AstJSON = input.astJSON
        Set sc = ##class(Ens.Director).CreateBusinessService("Finish.DecisionService",.service)
        $$$ThrowOnError(sc)
        $$$ThrowOnError(service.SendRequestSync("Finish.CheckOperation",request,.response,15,"Embedded Python AST checks"))
        Write response.Result.%ToJSON()
    } Catch ex {
        Set %response.Status = 400
        Set result = {}
        Do result.%Set("error",ex.DisplayString())
        Write result.%ToJSON()
    }
    Return $$$OK
}

ClassMethod Imports() As %Status
{
    Set %response.ContentType = "application/json; charset=utf-8"
    Set result = [], repo = ""
    For {
        Set repo = $Order(^FinishGitHub(repo)) Quit:repo=""
        Set number = ""
        For {
            Set number = $Order(^FinishGitHub(repo,number)) Quit:number=""
            If $Data(^FinishGitHub(repo,number,"snapshot")) Do result.%Push({}.%FromJSON(^FinishGitHub(repo,number,"snapshot")))
            Quit:result.%Size()>=50
        }
        Quit:result.%Size()>=50
    }
    Write result.%ToJSON()
    Return $$$OK
}

ClassMethod Fail(status As %Integer, message As %String(MAXLEN = 8000), stage As %String = "", location As %String = "") As %Status
{
    Set %response.Status = status
    Set %response.ContentType = "application/json; charset=utf-8"
    Set error = {}
    Do error.%Set("error", message)
    If stage '= "" Do error.%Set("stage", stage)
    If location '= "" Do error.%Set("location", location)
    Write error.%ToJSON()
    Return $$$OK
}

}
