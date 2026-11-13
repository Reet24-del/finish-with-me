Include Ensemble

/// Workflow operation whose config name is the EnsLib.Workflow role.
Class Finish.Workflow.HumanApproval Extends EnsLib.Workflow.Operation
{

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
    Set body = task.%Message_$Char(10)_task.%Subject_$Char(10)_task.%Command
    If (pRequest.Token '= "") && (task.%Command '= pRequest.Token) && '(body '[ ("token:"_pRequest.Token)) Return $$$ERROR($$$GeneralError,"This workflow task does not match the approval token.")
    If (pRequest.TaskId '= "") && (body '[ "task:") && '(body '[ ("task:"_pRequest.TaskId)) Return $$$ERROR($$$GeneralError,"This workflow task belongs to a different work item.")
    Try {
        Do ##class(EnsLib.Workflow.Engine).AssignTask(task,"_SYSTEM",.assigned)
    } Catch {
    }
    Set action = pRequest.Action
    If action = "" Set action = "Approve"
    Set sc = ##class(EnsLib.Workflow.Engine).CompleteTask(task, action)
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
