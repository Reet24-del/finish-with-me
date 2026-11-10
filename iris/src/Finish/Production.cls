Class Finish.Production Extends Ens.Production
{

XData ProductionDefinition
{
<Production Name="Finish.Production" LogGeneralTraceEvents="true">
  <Description>A stuck work item is routed to an AI Hub agent, then a deterministic gate and the Workflow Engine decide completion.</Description>
  <Item Name="Finish.DecisionService" Category="service" ClassName="Finish.Service.DecisionService" PoolSize="0" Enabled="true" Foreground="false">
    <Setting Target="Host" Name="LogTraceEvents">true</Setting>
  </Item>
  <Item Name="Finish.DecisionProcess" Category="process" ClassName="Finish.Process.DecisionProcess" PoolSize="1" Enabled="true" Foreground="false">
    <Setting Target="Host" Name="LogTraceEvents">true</Setting>
  </Item>
  <Item Name="Finish.AgentOperation" Category="operation" ClassName="Finish.Agent.CompletionOperation" PoolSize="1" Enabled="true" Foreground="false">
    <Setting Target="Host" Name="LogTraceEvents">true</Setting>
  </Item>
  <Item Name="Finish.GateOperation" Category="gate" ClassName="Finish.Gate.Operation" PoolSize="1" Enabled="true" Foreground="false">
    <Setting Target="Host" Name="LogTraceEvents">true</Setting>
  </Item>
  <Item Name="Finish.Reviewer" Category="workflow" ClassName="Finish.Workflow.HumanApproval" PoolSize="1" Enabled="true" Foreground="false">
    <Setting Target="Host" Name="AutoCreateRole">1</Setting>
    <Setting Target="Host" Name="LogTraceEvents">true</Setting>
  </Item>
  <Item Name="Finish.Supervisor" Category="workflow" ClassName="Finish.Workflow.HumanApproval" PoolSize="1" Enabled="true" Foreground="false">
    <Setting Target="Host" Name="AutoCreateRole">1</Setting>
    <Setting Target="Host" Name="LogTraceEvents">true</Setting>
  </Item>
</Production>
}

}
