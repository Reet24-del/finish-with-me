Class Finish.Message.Decision Extends Ens.Response
{

Property Action As %String(MAXLEN = 40);

Property TaskId As %String(MAXLEN = 80);

Property Outcome As %String(MAXLEN = 40);

Property Reason As %String(MAXLEN = 2000);

Property Provider As %String(MAXLEN = 80);

Property Model As %String(MAXLEN = 120);

Property PromptVersion As %String(MAXLEN = 40);

Property Prompt As %String(MAXLEN = 8000);

Property AgentReply As %String(MAXLEN = 16000);

Property ToolTrace As %String(MAXLEN = 8000);

Property InputTokens As %Integer;

Property OutputTokens As %Integer;

Property LatencyMs As %Integer;

Property SessionId As %String(MAXLEN = 40);

Property WorkflowTaskId As %String(MAXLEN = 40);

Property Role As %String(MAXLEN = 80);

Property ApprovalToken As %String(MAXLEN = 80);

Property DistributionToken As %String(MAXLEN = 80);

Property ProposalJson As %String(MAXLEN = 80000);

Property ToolsUsed As %String(MAXLEN = 1000);

Property UsageJson As %String(MAXLEN = 8000);

Property GateJson As %String(MAXLEN = 200000);

Property TraceSummary As %String(MAXLEN = 500);

Method AsObject() As %DynamicObject
{
    Set obj = {}
    Do obj.%Set("provider", ..Provider)
    Do obj.%Set("action", ..Action)
    Do obj.%Set("taskId", ..TaskId)
    Do obj.%Set("outcome", ..Outcome)
    Do obj.%Set("reason", ..Reason)
    Do obj.%Set("model", ..Model)
    Do obj.%Set("promptVersion", ..PromptVersion)
    Do obj.%Set("prompt", ..Prompt)
    Do obj.%Set("agentReply", ..AgentReply)
    Do obj.%Set("toolTrace", ..ToolTrace)
    Do obj.%Set("inputTokens", +..InputTokens)
    Do obj.%Set("outputTokens", +..OutputTokens)
    Do obj.%Set("latencyMs", +..LatencyMs)
    Do obj.%Set("sessionId", ..SessionId)
    Do obj.%Set("workflowTaskId", ..WorkflowTaskId)
    Do obj.%Set("role", ..Role)
    Do obj.%Set("approvalToken", ..ApprovalToken)
    Do obj.%Set("distributionToken", ..DistributionToken)
    Do obj.%Set("traceSummary", ..TraceSummary)
    Do ..PutJson(obj, "decision", ..ProposalJson)
    Do ..PutJson(obj, "gate", ..GateJson)
    Do ..PutJson(obj, "toolsUsed", ..ToolsUsed)
    Do ..PutJson(obj, "usage", ..UsageJson)
    If 'obj.%IsDefined("toolsUsed") Do obj.%Set("toolsUsed", [])
    Return obj
}

ClassMethod PutJson(obj As %DynamicObject, name As %String, raw As %String(MAXLEN = 220000))
{
    If raw = "" Quit
    Try {
        Do obj.%Set(name, ##class(%DynamicAbstractObject).%FromJSON(raw))
    } Catch {
        Do obj.%Set(name, raw)
    }
}

}
