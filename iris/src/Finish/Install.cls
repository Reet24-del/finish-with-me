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
    Return sc
}
/// Configure a workflow inbox for an existing local reviewer; no security permissions change.
ClassMethod ConfigureWorkflow(reviewer As %String = "_SYSTEM") As %Status
{
    If '##class(EnsLib.Workflow.RoleDefinition).%ExistsId("Finish.HumanReview") {
        Set sc = ##class(EnsLib.Workflow.RoleDefinition).CreateRole("Finish.HumanReview")
        If $$$ISERR(sc) Return sc
    }
    If '##class(EnsLib.Workflow.UserDefinition).%ExistsId(reviewer) {
        Set sc = ##class(EnsLib.Workflow.UserDefinition).CreateUser(reviewer,"Finish With Me reviewer")
        If $$$ISERR(sc) Return sc
    }
    Return ##class(EnsLib.Workflow.RoleDefinition).AddUserToRole("Finish.HumanReview",reviewer)
}

}
