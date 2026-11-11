Include %occStatus
Class Finish.Trace.Operation Extends Ens.BusinessOperation
{
Method OnMessage(pRequest As Finish.Message.TraceEvent, Output pResponse As Ens.Response) As %Status
{
    Set pResponse = ##class(Ens.Response).%New()
    Return $$$OK
}
}
