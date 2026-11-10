Class Finish.Message.AgentCall Extends Ens.Request
{

Property TaskId As %String(MAXLEN = 80);

Property Kind As %String(MAXLEN = 40);

Property Profile As %String(MAXLEN = 40);

Property TargetTool As %String(MAXLEN = 40);

Property PromptVersion As %String(MAXLEN = 40);

Property Prompt As %String(MAXLEN = 8000);

Property Model As %String(MAXLEN = 120);

Property TraceSummary As %String(MAXLEN = 500);

Property Payload As %DynamicObject;

}
