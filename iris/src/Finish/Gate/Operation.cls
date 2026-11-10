Include Ensemble

/// Runs the deterministic completion gate with Embedded Python.
Class Finish.Gate.Operation Extends Ens.BusinessOperation
{

Parameter INVOCATION = "Queue";

Method OnMessage(pRequest As Finish.Message.GateRequest, Output pResponse As Finish.Message.GateResult) As %Status
{
    Set pResponse = ##class(Finish.Message.GateResult).%New()
    Set pResponse.TraceSummary = pRequest.TraceSummary
    Try {
        Set result = ##class(Finish.Gate.Rules).Run(pRequest.PayloadJson)
    } Catch ex {
        Return ex.AsStatus()
    }
    If '$IsObject(result) Return $$$ERROR($$$GeneralError,"The Embedded Python gate returned no result.")
    Set pResponse.ResultJson = result.%ToJSON()
    Set pResponse.Outcome = result.%Get("outcome")
    Set pResponse.Reason = result.%Get("reason")
    Set pResponse.ApprovalToken = result.%Get("approvalToken")
    Set pResponse.TraceSummary = pResponse.Outcome_": "_$Extract(pResponse.Reason,1,400)
    $$$TRACE(pResponse.TraceSummary)
    If pResponse.Outcome = "" Return $$$ERROR($$$GeneralError,"The Embedded Python gate omitted an outcome.")
    Return $$$OK
}

}
