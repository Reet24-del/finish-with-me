Class Finish.Production Extends Ens.Production
{
XData ProductionDefinition
{
<Production Name="Finish.Production" LogGeneralTraceEvents="true">
  <Description>Finish With Me: bounded work completion through an AI Hub agent.</Description>
  <Item Name="Finish.ApiService" Category="service" ClassName="Finish.Agent.CompletionProxy">
    <Setting Target="Host" Name="Enabled">true</Setting>
  </Item>
  <Item Name="Finish.AgentOperation" Category="operation" ClassName="Finish.Agent.CompletionOperation">
    <Setting Target="Host" Name="Enabled">true</Setting>
  </Item>
  <Item Name="Finish.TraceOperation" Category="trace" ClassName="Finish.Trace.Operation"><Setting Target="Host" Name="Enabled">true</Setting></Item>
  <Item Name="Finish.HumanReview" Category="workflow" ClassName="EnsLib.Workflow.Operation"><Setting Target="Host" Name="Enabled">true</Setting></Item>
  <Item Name="Finish.GitHubIssues" Category="inbound" ClassName="Finish.Adapter.GitHubService">
    <Setting Target="Host" Name="Enabled">true</Setting>
    <Setting Target="Adapter" Name="CallInterval">120</Setting>
    <Setting Target="Adapter" Name="Repository">Reet24-del/finish-with-me</Setting>
    <Setting Target="Adapter" Name="Label">stuck</Setting>
  </Item>
  <Item Name="Finish.CheckOperation" Category="check" ClassName="Finish.Check.Operation"><Setting Target="Host" Name="Enabled">true</Setting></Item>
</Production>
}
}
