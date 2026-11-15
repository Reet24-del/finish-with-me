Include %occStatus

/// Deterministic stand-in for Finish.Agent.CompletionAgent on IRIS images without AI Hub (%AI.Agent).
/// It is NOT a language model. It reads the work item and the vector precedents, then returns
/// the same route/proposal shapes that the AI Hub agent's tools produce, so the gate and the
/// Workflow Engine still decide completion. Every result is labeled "fallback (no AI Hub)".
Class Finish.Agent.FallbackAgent Extends %RegisteredObject
{

Parameter PROVIDER = "fallback (no AI Hub)";

Parameter MODEL = "finish-fallback-1 (deterministic, not an LLM)";

/// True when the AI Hub classes and the compiled CompletionAgent are both present.
ClassMethod AIHubAvailable() As %Boolean
{
    Return ##class(%Dictionary.CompiledClass).%ExistsId("%AI.Agent") && ##class(%Dictionary.CompiledClass).%ExistsId("Finish.Agent.CompletionAgent")
}

/// Returns {"route":{...},"proposal":{...}|"","tools":[...],"reply":"..."}.
ClassMethod Propose(payload As %DynamicObject, target As %String) As %DynamicObject
{
    If '$IsObject(payload) Set payload = {}
    Set result = {}
    Set tools = ["InspectTask","ChooseRoute"]
    Set top = ..TopPrecedent(payload)
    If (payload.%Get("profile") = "integration") && (target = "PrepareRepair") {
        Set source = payload.%Get("source")
        Set field = ..FailedField(source)
        Set messageId = ..MessageId(source_" "_payload.%Get("blocker"))
        If field = "" {
            Do result.%Set("route",{"action":"human","reason":"fallback (no AI Hub): the stuck message does not name a failed field, so a person must decide the repair.","hint":"Not applicable"})
        } Else {
            Do result.%Set("route",{"action":"repair","reason":("fallback (no AI Hub): the trace names the empty field "_field_" in a failed transform."),"hint":"Not applicable"})
            Set artifact = "Populate "_field_" before the transform runs: map it from the source value, or set a documented default when the source is empty."
            If top '= "" Set artifact = artifact_" Closest finished blocker ("_top.%Get("taskId")_", cosine "_$FNumber(top.%Get("score"),"",3)_"): "_top.%Get("resolution")
            Set replay = "Replay "_$Select(messageId'="":"message "_messageId,1:"the failed message")_" after "_field_" is populated, then record the replay result before approval."
            Set proposal = {}
            Do proposal.%Set("tool","PrepareRepair")
            Do proposal.%Set("summary","fallback (no AI Hub): deterministic repair for empty field "_field_", built from the trace and the closest vector precedent. Not written by an LLM.")
            Do proposal.%Set("nextAction","Apply the mapping for "_field_" and replay the message.")
            Do proposal.%Set("artifact",artifact)
            Do proposal.%Set("verification",replay)
            Do proposal.%Set("provider",..#PROVIDER)
            Do result.%Set("proposal",proposal)
            Do tools.%Push("PrepareRepair")
        }
    } Else {
        Set reason = "fallback (no AI Hub): this IRIS image has no AI Hub, and the deterministic fallback only prepares stuck-message repairs. A person must review this "_payload.%Get("profile")_" item."
        Do result.%Set("route",{"action":"human","reason":(reason),"hint":"Not applicable"})
    }
    Do result.%Set("tools",tools)
    Set route = result.%Get("route")
    Do result.%Set("reply","fallback (no AI Hub) chose "_route.%Get("action")_". "_route.%Get("reason"))
    Return result
}

ClassMethod TopPrecedent(payload As %DynamicObject) As %DynamicObject
{
    Set list = payload.%Get("precedents")
    If '$IsObject(list) Return ""
    If list.%Size() = 0 Return ""
    Return list.%Get(0)
}

ClassMethod FailedField(source As %String(MAXLEN = "")) As %String
{
    Set matcher = ##class(%Regex.Matcher).%New("Field\s+([A-Za-z_][A-Za-z0-9_]*)\s+is empty", source)
    If matcher.Locate() Return matcher.Group(1)
    If source [ "RequiredField" Return "RequiredField"
    Return ""
}

ClassMethod MessageId(text As %String(MAXLEN = "")) As %String
{
    Set matcher = ##class(%Regex.Matcher).%New("(?i)message(?:\s+id)?:?\s+(\d+)", text)
    If matcher.Locate() Return matcher.Group(1)
    Return ""
}

}
