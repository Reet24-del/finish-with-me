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
    Return ..ConfigureWorkflow()
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
}
