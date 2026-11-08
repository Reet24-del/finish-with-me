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
</Production>
}
}
