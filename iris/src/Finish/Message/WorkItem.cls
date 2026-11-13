Class Finish.Message.WorkItem Extends Ens.Request
{

Property Action As %String(MAXLEN = 40);

Property TaskId As %String(MAXLEN = 80);

Property Kind As %String(MAXLEN = 40);

Property Profile As %String(MAXLEN = 40);

Property Title As %String(MAXLEN = 200);

Property AttemptCount As %Integer;

Property HumanAction As %String(MAXLEN = 20);

Property ApprovalToken As %String(MAXLEN = 80);

Property WorkflowTaskId As %String(MAXLEN = 40);

Property WorkflowRole As %String(MAXLEN = 80);

Property DistributionToken As %String(MAXLEN = 80);

Property ProposalJson As %String(MAXLEN = 80000);

Property ToolsUsedJson As %String(MAXLEN = 1000);

Property TraceSummary As %String(MAXLEN = 500);

Property Payload As %DynamicObject;

}
