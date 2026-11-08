Class Finish.Agent.TaskTools Extends %AI.Tool
{
Property TaskContext As %DynamicObject;
Property InspectionCount As %Integer [ InitialExpression = 0 ];

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
}
