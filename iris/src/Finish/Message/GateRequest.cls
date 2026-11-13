Class Finish.Message.GateRequest Extends Ens.Request
{

Property TaskId As %String(MAXLEN = 80);

Property Action As %String(MAXLEN = 40);

Property TraceSummary As %String(MAXLEN = 500);

Property PayloadJson As %String(MAXLEN = 220000);

}
