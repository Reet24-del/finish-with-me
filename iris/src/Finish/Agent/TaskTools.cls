Class Finish.Agent.TaskTools Extends %AI.Tool
{
Property TaskContext As %DynamicObject;
Property InspectionCount As %Integer [ InitialExpression = 0 ];
Property Proposal As %DynamicObject;

/// Inspect one task and return its concrete completion boundary to the agent.
Method InspectTask() As %DynamicObject
{
    Set ..InspectionCount = ..InspectionCount+1
    Set kind = ..TaskContext.%Get("kind")
    Set title = ..TaskContext.%Get("title")
    Set blocker = ..TaskContext.%Get("blocker")
    Set tried = ..TaskContext.%Get("tried")
    Set source = ..TaskContext.%Get("source")
    Set result = {}
    Do result.%Set("kind",kind)
    Do result.%Set("title",title)
    Do result.%Set("blocker",blocker)
    Do result.%Set("previous_attempt",tried)
    If ..TaskContext.%IsDefined("attempts") Do result.%Set("previous_checks",..TaskContext.attempts)
    If kind = "coding" {
        Do result.%Set("completion_contract","Propose a minimal edit to the supplied total(prices) function. It must add numeric strings, return zero for empty arrays, and reject blanks, nonnumeric values, nulls, infinity, and non-array input. The application will run independent checks; do not claim they passed. Use a single export function total(prices). Supported helpers are Array.isArray, Number, Number.isFinite, String, string.trim, array.reduce, Error and TypeError. Reject whitespace-only strings, booleans, objects, null, undefined and nonfinite numbers. Use typeof guards, trim and Number.isFinite. No imports, loops, external calls or other APIs.")
        Do result.%Set("source",source)
    } Else {
        Do result.%Set("completion_contract","Give one small next exercise step, not a full solution. The learner must solve a fresh problem independently before the task is marked complete.")
    }
    Return result
}
/// Prepare a repair candidate after inspecting the stored task. This never executes or approves code.
Method PrepareCandidate(code As %String, summary As %String = "Prepared a repair for independent checks.", nextAction As %String = "Review the candidate and run the agreed checks.") As %DynamicObject
{
    If ..InspectionCount < 1 Return {"error":"Call InspectTask first."}
    If ($Length(code)>12000) || (code="") Return {"error":"Return a nonempty candidate of at most 12000 characters."}
    If $Find(code,"function total") = 0 Return {"error":"code must contain the JavaScript total function source, not a JSON object or Markdown."}
    Set ..Proposal = {}
    Do ..Proposal.%Set("summary",summary)
    Do ..Proposal.%Set("nextAction",nextAction)
    Do ..Proposal.%Set("code",code)
    Return {"prepared":true,"message":"Candidate saved for independent checks. It has not been executed or approved."}
}

}
