Class Finish.Message.PrecedentRequest Extends Ens.Request
{

Property Mode As %String(MAXLEN = 20);

Property TaskId As %String(MAXLEN = 80);

Property Profile As %String(MAXLEN = 40);

Property Blocker As %String(MAXLEN = 12000);

Property Resolution As %String(MAXLEN = 4000);

Property TraceSummary As %String(MAXLEN = 500);

}
