Include %occStatus
Class Finish.Check.Operation Extends Ens.BusinessOperation
{
Method OnMessage(pRequest As Finish.Message.CheckRequest, Output pResponse As Finish.Message.InvestigateResponse) As %Status
{
    Try {
        Set pResponse = ##class(Finish.Message.InvestigateResponse).%New()
        Set pResponse.Result = {}.%FromJSON(##class(Finish.Check.Receipt).Run(pRequest.AstJSON))
        Return $$$OK
    } Catch ex { Return ex.AsStatus() }
}
}
