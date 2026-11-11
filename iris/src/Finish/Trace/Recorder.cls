Include %occStatus
Class Finish.Trace.Recorder Extends %RegisteredObject
{
ClassMethod Record(host As %RegisteredObject, name As %String, data As %DynamicObject) As %Status
{
    If '$IsObject(host) Return $$$OK
    Set request = ##class(Finish.Message.TraceEvent).%New()
    Set payload = {"promptVersion":"finish-routing-v1"}
    Do payload.%Set("event",name)
    Do payload.%Set("at",$ZDATETIME($ZTIMESTAMP,3,1,3))
    Do payload.%Set("data",data)
    Set request.Payload = payload
    Return host.SendRequestSync("Finish.TraceOperation",request,.response,10,name)
}
}
