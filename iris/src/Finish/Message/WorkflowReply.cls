Class Finish.Message.WorkflowReply Extends Ens.Response
{

Property WorkflowTaskId As %String(MAXLEN = 40);

Property Role As %String(MAXLEN = 80);

Property State As %String(MAXLEN = 20);

Property Action As %String(MAXLEN = 40);

Property Subject As %String(MAXLEN = 255);

Property DistributionToken As %String(MAXLEN = 80);

Property Detail As %String(MAXLEN = 2000);

Property TraceSummary As %String(MAXLEN = 500);

}
