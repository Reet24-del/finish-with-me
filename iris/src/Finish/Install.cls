Include %occStatus

Class Finish.Install Extends %RegisteredObject
{
/// Run only after approval of the local account and REST application setup.
ClassMethod Configure() As %Status
{
    New $Namespace
    Set $Namespace = "%SYS"
    Set password = $System.Util.GetEnviron("IRIS_PASSWORD")
    If password = "" Return $$$ERROR($$$GeneralError,"Set IRIS_PASSWORD before setup.")
    Set user("Password") = password
    Set sc = ##class(Security.Users).Modify("_SYSTEM",.user)
    If $$$ISERR(sc) Return sc
    Set properties("NameSpace") = "USER"
    Set properties("DispatchClass") = "Finish.Api"
    Set properties("AutheEnabled") = 32
    Set properties("Enabled") = 1
    If ##class(Security.Applications).Exists("/csp/user/finish") {
        Set sc = ##class(Security.Applications).Modify("/csp/user/finish",.properties)
    } Else {
        Set sc = ##class(Security.Applications).Create("/csp/user/finish",.properties)
    }
    If $$$ISERR(sc) Return sc
    Set $Namespace = "USER"
    Set sc = ..ConfigureWorkflow()
    If $$$ISERR(sc) Return sc
    Return ..SeedPrecedents()
}

ClassMethod ConfigureWorkflow() As %Status
{
    Set sc = ..EnsureRole("Finish.Reviewer","Approves a bounded Finish With Me completion.")
    If $$$ISERR(sc) Return sc
    Set sc = ..EnsureRole("Finish.Supervisor","Reviews escalated Finish With Me decisions.")
    If $$$ISERR(sc) Return sc
    Set sc = ..EnsureRole("Finish.HumanReview","Reviews a blocker the agent could not repair.")
    If $$$ISERR(sc) Return sc
    Set sc = ..EnsureWorkflowUser("_SYSTEM")
    If $$$ISERR(sc) Return sc
    Set sc = ..EnsureMembership("Finish.Reviewer","_SYSTEM","Reviewer")
    If $$$ISERR(sc) Return sc
    Set sc = ..EnsureMembership("Finish.Supervisor","_SYSTEM","Supervisor")
    If $$$ISERR(sc) Return sc
    Set sc = ..EnsureMembership("Finish.HumanReview","_SYSTEM","Reviewer")
    If $$$ISERR(sc) Return sc
    Write "FINISH_WORKFLOW_OK",!
    Return sc
}

ClassMethod EnsureRole(name As %String, description As %String) As %Status
{
    Set role = ##class(EnsLib.Workflow.RoleDefinition).%OpenId(name)
    If $IsObject(role) Return $$$OK
    Set role = ##class(EnsLib.Workflow.RoleDefinition).%New()
    Set role.Name = name
    Set role.Description = description
    Set role.Capacity = 100
    Return role.%Save()
}

ClassMethod EnsureWorkflowUser(name As %String) As %Status
{
    If $IsObject(##class(EnsLib.Workflow.UserDefinition).%OpenId(name)) Return $$$OK
    Return ##class(EnsLib.Workflow.UserDefinition).CreateUser(name)
}

ClassMethod EnsureMembership(role As %String, user As %String, title As %String) As %Status
{
    Set existing = ""
    &sql(SELECT TOP 1 UserName INTO :existing FROM EnsLib_Workflow.RoleMembership WHERE RoleName = :role AND UserName = :user)
    If SQLCODE = 0 Return $$$OK
    Set sc = ##class(EnsLib.Workflow.RoleDefinition).AddUserToRole(role, user, 1, title)
    If $$$ISOK(sc) Return sc
    Set text = $ZCONVERT($System.Status.GetErrorText(sc),"L")
    If (text [ "already") || (text [ "duplicate") Return $$$OK
    Return sc
}

/// Insert the example resolutions once. A task id that is already stored is left as it is.
ClassMethod SeedPrecedents() As %Status
{
    Set sc = ..SeedOne("seed-receipt-total","receipt-total","Adding prices joins the values instead of summing them. The receipt total becomes 01020 instead of 30.","Replace string concatenation in total(prices) with numeric addition. Reject blank and nonnumeric prices, return zero for an empty list, and wait for the eight gate checks before approval.")
    If $$$ISERR(sc) Return sc
    Set sc = ..SeedOne("seed-linear-equations","linear-equations","I can follow an example, but I get stuck when solving on my own.","Practice one guided step, subtract the constant, then give a different equation the learner solves without a worked answer. Completion waits for that independent answer.")
    If $$$ISERR(sc) Return sc
    Set sc = ..SeedOne("seed-integration-required-field","integration","Message 1042 is stuck in error status after Finish.RecordToTarget. Field RequiredField is empty.","Populate RequiredField before Finish.RecordToTarget. Replay message 1042 only after the field is present, and record the replay result before approval.")
    If $$$ISERR(sc) Return sc
    Set sc = ..SeedOne("seed-integration-empty-target","integration","A transform left the message in error status because a required target field was empty.","Map the empty required field from a source value or a documented default, then resend that one message and keep the task open until the resend is recorded.")
    If $$$ISERR(sc) Return sc
    Set sc = ..SeedOne("seed-project-pagination","project","The page helper returns items from start to limit, so the second page is short. Success means return limit items starting at start.","Replace the slice with items[start:start+limit]. The user runs page([0,1,2,3], 2, 2) and records that the result is [2, 3] before approval.")
    If $$$ISERR(sc) Return sc
    Set sc = ..SeedOne("seed-subject-photosynthesis","subject","I can copy the definition of photosynthesis from my notes, but I cannot explain what the leaf does with light and carbon dioxide in a new example.","Use a source-cited explanation and a guided question, then a different transfer question answerable only from the notes. Keep the private rubric off the page and approve only after the transfer answer passes.")
    If $$$ISERR(sc) Return sc
    Return $$$OK
}

ClassMethod SeedOne(taskId As %String(MAXLEN = 80), profile As %String(MAXLEN = 40), blocker As %String(MAXLEN = 12000), resolution As %String(MAXLEN = 4000)) As %Status
{
    Set req = ##class(Finish.Message.PrecedentRequest).%New()
    Set req.Mode = "store"
    Set req.TaskId = taskId
    Set req.Profile = profile
    Set req.Blocker = blocker
    Set req.Resolution = resolution
    Set req.TraceSummary = "Seed "_taskId
    Set sc = ##class(Finish.Memory.Operation).Store(req, .ignored)
    Return sc
}
}
