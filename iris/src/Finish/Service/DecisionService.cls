Include Ensemble

/// Receives one work item and starts the decision session.
Class Finish.Service.DecisionService Extends Ens.BusinessService
{

Method OnProcessInput(pInput As Finish.Message.WorkItem, Output pOutput As Finish.Message.Decision) As %Status
{
    Set label = pInput.TraceSummary
    If label = "" Set label = "Work item "_pInput.TaskId_" "_pInput.Action
    Set sc = ..SendRequestSync("Finish.DecisionProcess", pInput, .pOutput, 120, label)
    If $$$ISERR(sc) Return sc
    If '$IsObject(pOutput) Return $$$ERROR($$$GeneralError,"The decision process returned no response.")
    If pOutput.SessionId = "" Set pOutput.SessionId = ..%SessionId
    $$$TRACE("Session "_pOutput.SessionId_" outcome "_pOutput.Outcome)
    Return $$$OK
}

}
