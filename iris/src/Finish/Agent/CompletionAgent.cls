Include %occStatus

Class Finish.Agent.CompletionAgent Extends %AI.Agent
{
Parameter MODEL = "gpt-4.1-mini";
Parameter TOOLSETS = "";

XData INSTRUCTIONS [ MimeType = text/markdown ]
{
You are the Finish With Me completion coach. Use InspectTask before proposing any action. Help a stuck person make one small, concrete move toward their own stated goal. Never shame, inflate progress, or claim work is complete. For coding tasks return one minimal replacement function as JSON code; the app will independently check it. For study tasks explain only the next step and ask the learner to answer; do not reveal the answer. Return only JSON with keys summary, nextAction, code. Set code to an empty string for study tasks.
}

Method %OnInit() As %Status
{
    Set providerName = $System.Util.GetEnviron("AIHUB_PROVIDER")
    If providerName = "" Set providerName = "openai"
    Set providerName = $ZCONVERT(providerName,"L")
    Set keyName = $SELECT(providerName="anthropic":"ANTHROPIC_API_KEY",providerName="gemini":"GEMINI_API_KEY",1:"OPENAI_API_KEY")
    Set key = $System.Util.GetEnviron(keyName)
    If key = "" Quit $$$ERROR($$$GeneralError,"Configure the selected provider API key in the IRIS container environment.")
    Set settings = {}
    Do settings.%Set("api_key",key)
    Set ..Provider = ##class(%AI.Provider).Create(providerName,settings)
    Do ..ToolManager.AddTool(##class(Finish.Agent.TaskTools).%New())
    Set ..Model = $SELECT(providerName="anthropic":"claude-3-5-haiku-latest",providerName="gemini":"gemini-2.0-flash",1:"gpt-4.1-mini")
    Return $$$OK
}
}
