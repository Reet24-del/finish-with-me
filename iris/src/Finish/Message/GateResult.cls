Class Finish.Message.GateResult Extends Ens.Response
{

Property Outcome As %String(MAXLEN = 40);

Property Reason As %String(MAXLEN = 2000);

Property ApprovalToken As %String(MAXLEN = 80);

Property ResultJson As %String(MAXLEN = 200000);

Property TraceSummary As %String(MAXLEN = 500);

}
