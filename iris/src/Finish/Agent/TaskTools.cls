Class Finish.Agent.TaskTools Extends %AI.Tools
{
/// Inspect one task and return its concrete completion boundary to the agent.
Method InspectTask(kind As %String, title As %String, blocker As %String, tried As %String, source As %String) As %DynamicObject
{
    Set result = {}
    Do result.%Set("kind",kind)
    Do result.%Set("title",title)
    Do result.%Set("blocker",blocker)
    Do result.%Set("previous_attempt",tried)
    If kind = "coding" {
        Do result.%Set("completion_contract","Propose a minimal edit to the supplied total(prices) function. It must add numeric strings, return zero for empty arrays, and reject blanks, nonnumeric values, nulls, infinity, and non-array input. The application will run independent checks; do not claim they passed.")
        Do result.%Set("source",source)
    } Else {
        Do result.%Set("completion_contract","Give one small next exercise step, not a full solution. The learner must solve a fresh problem independently before the task is marked complete.")
    }
    Return result
}
}
