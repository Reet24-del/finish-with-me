Include %occStatus

Class Finish.Agent.CompletionAgent Extends %AI.Agent
{
Property TaskContext As %DynamicObject;
Property InspectionTools As Finish.Agent.TaskTools;

Parameter MODEL = "gpt-4.1-mini";
Parameter TOOLSETS = "";

XData INSTRUCTIONS [ MimeType = text/markdown ]
{
You are the Finish With Me completion coach. Call InspectTask first, with no arguments, to read the stored task. Then call PrepareCandidate with summary, nextAction and code to store your proposed repair. Both tool calls are required. Help a stuck person make one small, concrete move toward their own stated goal. Never shame, inflate progress, or claim work is complete. For coding tasks the code argument must be a plain JavaScript source string containing export function total(prices), with no Markdown or JSON wrapper; the app will independently check it. For study tasks explain only the next step and ask the learner to answer; do not reveal the answer. Use PrepareCandidate to deliver the repair rather than putting JSON in your final message. End with a short confirmation that independent checks are still required.
}

Method %OnInit() As %Status
{
    Set providerName = $ZCONVERT($System.Util.GetEnviron("AIHUB_PROVIDER"),"L")
    If providerName = "" Set providerName = "groq"
    If (providerName '= "groq") && (providerName '= "openai") Quit $$$ERROR($$$GeneralError,"AIHUB_PROVIDER must be groq or openai.")
    Set keyName = $SELECT(providerName="groq":"GROQ_API_KEY",1:"OPENAI_API_KEY")
    Set key = $System.Util.GetEnviron(keyName)
    If key = "" Quit $$$ERROR($$$GeneralError,"Configure the selected provider API key in the IRIS container environment.")
    Set settings = {}
    Do settings.%Set("api_key",key)
    If providerName = "groq" Do settings.%Set("base_url","https://api.groq.com/openai/v1")
    Set ..Provider = ##class(%AI.Provider).Create("openai",settings)
    Set ..InspectionTools = ##class(Finish.Agent.TaskTools).%New()
    Set ..InspectionTools.TaskContext = ..TaskContext
    Do ..ToolManager.AddTool(..InspectionTools)
    Set model = $System.Util.GetEnviron("AIHUB_MODEL")
    If model = "" Set model = $SELECT(providerName="groq":"openai/gpt-oss-120b",1:"gpt-4.1-mini")
    Set ..Model = model
    Set ..Temperature = 0
    Return $$$OK
}
}
