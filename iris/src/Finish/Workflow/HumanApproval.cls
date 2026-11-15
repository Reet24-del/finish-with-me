Include Ensemble

/// Workflow operation whose config name is the EnsLib.Workflow role.
Class Finish.Workflow.HumanApproval Extends EnsLib.Workflow.Operation
{

/// EnsLib.Workflow.Operation maps TaskRequest to its deferred TaskHandler, which never replies
/// until the task is completed. Route it to OnMessage, which calls Open, so the process gets the task id right away.
XData MessageMap
{
<MapItems>
  <MapItem MessageType="EnsLib.Workflow.TaskRequest">
    <Method>OnMessage</Method>
  </MapItem>
</MapItems>
}

Method OnMessage(pRequest As %Library.Persistent, Output pResponse As %Library.Persistent) As %Status
{
    Set pResponse = ##class(Finish.Message.WorkflowReply).%New()
    Set pResponse.Role = ..%ConfigName
    If pRequest.%IsA("Finish.Message.WorkflowCommand") {
        Set pResponse.TraceSummary = pRequest.TraceSummary
        If pRequest.Command = "cancel" Return ..Cancel(pRequest, .pResponse)
        Return ..Complete(pRequest, .pResponse)
    }
    If pRequest.%IsA("EnsLib.Workflow.TaskRequest") {
        Return ..Open(pRequest, .pResponse)
    }
    Return $$$ERROR($$$GeneralError,"The workflow operation expected a task request or a completion command.")
}

Method Open(pRequest As EnsLib.Workflow.TaskRequest, Output pResponse As Finish.Message.WorkflowReply) As %Status
{
    Set nonce = $Translate($System.Util.CreateGUID(),"-","")
    Set pRequest.%Message = "nonce:"_nonce_$Char(10)_pRequest.%Message
    Set pRequest.%Subject = $Extract(pRequest.%Subject,1,200)_" ["_$Extract(nonce,1,12)_"]"
    If pRequest.%UserName = "" Set pRequest.%UserName = "_SYSTEM"
    If pRequest.%Actions = "" Set pRequest.%Actions = "Approve,Reject"
    Set sc = pRequest.%Save()
    If $$$ISERR(sc) Return sc
    Set sc = ##class(EnsLib.Workflow.Engine).%DistributeTask(..%ConfigName, pRequest, nonce)
    If $$$ISERR(sc) Return sc
    Set sqlError = ""
    Set id = ..FindTask(nonce, .sqlError)
    If id = "" Return $$$ERROR($$$GeneralError,"Workflow Engine did not index a task for "_..%ConfigName_". "_sqlError)
    Set pResponse.WorkflowTaskId = id
    Set pResponse.Role = ..%ConfigName
    Set pResponse.State = "open"
    Set pResponse.Action = pRequest.%Actions
    Set pResponse.Subject = pRequest.%Subject
    Set pResponse.DistributionToken = nonce
    Set pResponse.Detail = $Extract(pRequest.%Message,1,1500)
    Set pResponse.TraceSummary = "Opened "_id_" for "_..%ConfigName
    $$$TRACE(pResponse.TraceSummary)
    Return $$$OK
}

Method Complete(pRequest As Finish.Message.WorkflowCommand, Output pResponse As Finish.Message.WorkflowReply) As %Status
{
    If pRequest.WorkflowTaskId = "" Return $$$ERROR($$$GeneralError,"Workflow completion requires a task id.")
    Set task = ##class(EnsLib.Workflow.TaskResponse).%OpenId(pRequest.WorkflowTaskId,,.sc)
    If $$$ISERR(sc) || '$IsObject(task) Return $$$ERROR($$$GeneralError,"Workflow task "_pRequest.WorkflowTaskId_" was not found.")
    // EnsLib.Workflow.TaskResponse has no %Command; it lives on the original TaskRequest.
    Set command = ""
    Try {
        Set command = task.%TaskStatus.Request.%Command
    } Catch {
        Set command = ""
    }
    Set sc = ..CheckMatch(command, task.%Message, pRequest.Action, pRequest.Token, pRequest.TaskId)
    If $$$ISERR(sc) Return sc
    Try {
        Do ##class(EnsLib.Workflow.Engine).AssignTask(task,"_SYSTEM",.assigned)
    } Catch {
    }
    Set action = pRequest.Action
    If action = "" Set action = "Approve"
    Set sc = ##class(EnsLib.Workflow.Engine).CompleteTask(task, action)
    // Open replies at once, so the task's response token is a nonce and CompleteTask cannot
    // send a deferred response. CompleteTask has already marked the task complete; save it.
    Set saved = task.%Save()
    If $$$ISERR(saved) Return saved
    If $$$ISERR(sc) && '..TaskIsComplete(task.%Id()) Return sc
    Set pResponse.WorkflowTaskId = task.%Id()
    Set pResponse.Role = ..%ConfigName
    Set pResponse.State = "complete"
    Set pResponse.Action = action
    Set pResponse.Subject = task.%Subject
    Set pResponse.TraceSummary = "Completed "_task.%Id()_" as "_action
    $$$TRACE(pResponse.TraceSummary)
    Return $$$OK
}

Method Cancel(pRequest As Finish.Message.WorkflowCommand, Output pResponse As Finish.Message.WorkflowReply) As %Status
{
    Set pResponse.WorkflowTaskId = pRequest.WorkflowTaskId
    Set pResponse.Role = ..%ConfigName
    Set pResponse.State = "cancelled"
    If pRequest.WorkflowTaskId = "" Return $$$OK
    Set task = ##class(EnsLib.Workflow.TaskResponse).%OpenId(pRequest.WorkflowTaskId,,.sc)
    If '$IsObject(task) Return $$$OK
    If pRequest.DistributionToken '= "" {
        Try {
            Set sc = ##class(EnsLib.Workflow.Engine).%CancelRequest(pRequest.DistributionToken)
            If $$$ISOK(sc) {
                $$$TRACE("Cancelled workflow distribution "_pRequest.DistributionToken)
                Return $$$OK
            }
        } Catch {
        }
    }
    Set sc = ##class(EnsLib.Workflow.Engine).CompleteTask(task,"Cancelled")
    If $$$ISERR(sc) && '..TaskIsComplete(pRequest.WorkflowTaskId) Return sc
    $$$TRACE("Closed previous workflow task "_pRequest.WorkflowTaskId)
    Return $$$OK
}

Method FindTask(nonce As %String, Output error As %String) As %String
{
    Set error = ""
    Set like = "%"_nonce_"%"
    Set stmt = ##class(%SQL.Statement).%New()
    Set queries = $ListBuild("SELECT TOP 1 ID FROM EnsLib_Workflow.TaskResponse WHERE %Message LIKE ? ORDER BY ID DESC","SELECT TOP 1 ID FROM EnsLib_Workflow.TaskResponse WHERE %Subject LIKE ? ORDER BY ID DESC")
    For index=1:1:$ListLength(queries) {
        Set sc = stmt.%Prepare($List(queries,index))
        If $$$ISERR(sc) {
            Set error = error_" "_$System.Status.GetErrorText(sc)
            Continue
        }
        Set rs = stmt.%Execute(like)
        If rs.%Next() Return rs.%Get("ID")
        If rs.%SQLCODE < 0 Set error = error_" "_rs.%Message
    }
    Return ""
}

/// Value of a "name:" line in a workflow message, or "" when the line is absent.
ClassMethod Marker(message As %String(MAXLEN = ""), name As %String) As %String
{
    Set prefix = name_":"
    For i=1:1:$Length(message,$Char(10)) {
        Set line = $ZStrip($Piece(message,$Char(10),i),"<>W",$Char(13))
        If $Extract(line,1,$Length(prefix)) = prefix Return $Extract(line,$Length(prefix)+1,*)
    }
    Return ""
}

/// The token must equal the task's %Command or its "token:" line; Approve always needs a token.
/// When the task has a "task:" line, the work item id must equal it.
ClassMethod CheckMatch(command As %String, message As %String(MAXLEN = ""), action As %String, token As %String, taskId As %String) As %Status
{
    Set tokenMarker = ..Marker(message,"token")
    Set taskMarker = ..Marker(message,"task")
    If (token = "") && ((action = "") || (action = "Approve")) Return $$$ERROR($$$GeneralError,"Workflow approval requires the approval token.")
    If token '= "" {
        Set matched = ((command '= "") && (command = token)) || ((tokenMarker '= "") && (tokenMarker = token))
        If 'matched Return $$$ERROR($$$GeneralError,"This workflow task does not match the approval token.")
    }
    If (taskMarker '= "") && (taskId '= taskMarker) Return $$$ERROR($$$GeneralError,"This workflow task belongs to a different work item.")
    Return $$$OK
}

/// Opens a real Finish.Reviewer task through the running production, then sends a wrong token,
/// a wrong work item id, and the correct pair. Prints FINISH_WORKFLOW_CHECKS_OK when only the correct pair completes.
ClassMethod SmokeChecks() As %Status
{
    Set sc = ##class(Ens.Director).CreateBusinessService("Finish.DecisionService",.service)
    If $$$ISERR(sc) Return sc
    Set token = $ZConvert($Translate($System.Util.CreateGUID(),"-",""),"L")
    Set taskId = "smoke-workflow-"_$Extract(token,1,8)
    Set request = ##class(EnsLib.Workflow.TaskRequest).%New()
    Set request.%Actions = "Approve,Reject"
    Set request.%UserName = "_SYSTEM"
    Set request.%Subject = "Workflow check smoke"
    Set request.%Command = token
    Set request.%Message = "token:"_token_$Char(10)_"task:"_taskId_$Char(10)_"profile:integration"
    Set sc = service.SendRequestSync("Finish.Reviewer",request,.opened,30,"Workflow check smoke: open")
    If $$$ISERR(sc) Return sc
    If '$IsObject(opened) || (opened.WorkflowTaskId = "") Return $$$ERROR($$$GeneralError,"Smoke task did not open.")
    Set cases = $ListBuild($ListBuild("wrong token","wrong-"_token,taskId,0),$ListBuild("wrong task id",token,"other-task",0),$ListBuild("missing token","",taskId,0),$ListBuild("correct token and task id",token,taskId,1))
    For i=1:1:$ListLength(cases) {
        Set case = $List(cases,i)
        Set cmd = ##class(Finish.Message.WorkflowCommand).%New()
        Set cmd.Command = "complete"
        Set cmd.WorkflowTaskId = opened.WorkflowTaskId
        Set cmd.DistributionToken = opened.DistributionToken
        Set cmd.Action = "Approve"
        Set cmd.Token = $List(case,2)
        Set cmd.TaskId = $List(case,3)
        Set cmd.TraceSummary = "Workflow check smoke: "_$List(case,1)
        Kill reply
        Set sent = service.SendRequestSync("Finish.Reviewer",cmd,.reply,30,"Workflow check smoke: "_$List(case,1))
        Set completed = $$$ISOK(sent) && $IsObject($Get(reply)) && (reply.State = "complete")
        Write $List(case,1),": ",$Select(completed:"completed",1:"rejected ("_$System.Status.GetOneErrorText(sent)_")"),!
        If completed '= $List(case,4) Return $$$ERROR($$$GeneralError,"Workflow check smoke failed for "_$List(case,1)_".")
    }
    Write "FINISH_WORKFLOW_CHECKS_OK",!
    Return $$$OK
}

Method TaskIsComplete(taskId As %String) As %Boolean
{
    Set done = 0
    Set stmt = ##class(%SQL.Statement).%New()
    Set sc = stmt.%Prepare("SELECT TaskStatus_IsComplete AS Done FROM EnsLib_Workflow.TaskResponse WHERE ID = ?")
    If $$$ISERR(sc) Return 0
    Set rs = stmt.%Execute(taskId)
    If rs.%Next() Set done = +rs.%Get("Done")
    Return done
}

}
