Class Finish.Message.AgentResult Extends Ens.Response
{

Property TaskId As %String(MAXLEN = 80);

Property Provider As %String(MAXLEN = 80);

Property Model As %String(MAXLEN = 120);

Property PromptVersion As %String(MAXLEN = 40);

Property Prompt As %String(MAXLEN = 8000);

Property Reply As %String(MAXLEN = 16000);

Property ToolTrace As %String(MAXLEN = 8000);

Property ToolsUsed As %String(MAXLEN = 1000);

Property ProposalJson As %String(MAXLEN = 80000);

Property UsageJson As %String(MAXLEN = 8000);

Property InputTokens As %Integer;

Property OutputTokens As %Integer;

Property LatencyMs As %Integer;

Property TraceSummary As %String(MAXLEN = 500);

}
