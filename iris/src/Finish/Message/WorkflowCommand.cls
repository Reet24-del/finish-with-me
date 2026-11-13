Class Finish.Message.WorkflowCommand Extends Ens.Request
{

Property Command As %String(MAXLEN = 20);

Property WorkflowTaskId As %String(MAXLEN = 40);

Property DistributionToken As %String(MAXLEN = 80);

Property Action As %String(MAXLEN = 40);

Property Token As %String(MAXLEN = 80);

Property TaskId As %String(MAXLEN = 80);

Property TraceSummary As %String(MAXLEN = 500);

}
