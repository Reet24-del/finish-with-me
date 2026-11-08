Include %occStatus

Class Finish.Api Extends %CSP.REST
{
Parameter CHARSET = "utf-8";

XData UrlMap
{
<Routes>
  <Route Url="/health" Method="GET" Call="Health" />
  <Route Url="/investigate" Method="POST" Call="Investigate" />
</Routes>
}

ClassMethod Health() As %Status
{
    Set %response.ContentType = "application/json; charset=utf-8"
    Do %response.Write("{""ok"":true,""provider"":""InterSystems IRIS AI Hub""}")
    Quit $$$OK
}

ClassMethod Investigate() As %Status
{
    Try {
        Set input = {}.%FromJSON(%request.Content.Read(64000))
        Set request = ##class(Finish.Message.InvestigateRequest).%New()
        Set request.Payload = input
        Set sc = ##class(Ens.Director).CreateBusinessService("Finish.ApiService",.service)
        If $$$ISERR(sc) {
            Set %response.Status = 500
            Set error = {}
            Do error.%Set("error",$System.Status.GetErrorText(sc))
            Set %response.ContentType = "application/json; charset=utf-8"
            Do %response.Write(error.%ToJSON())
            Quit $$$OK
        }
        Set sc = service.SendRequestSync("Finish.AgentOperation",request,.response,90,"Finish With Me task investigation")
        If $$$ISERR(sc) {
            Set %response.Status = 500
            Set error = {}
            Do error.%Set("error",$System.Status.GetErrorText(sc))
            Set %response.ContentType = "application/json; charset=utf-8"
            Do %response.Write(error.%ToJSON())
            Quit $$$OK
        }
        Set %response.ContentType = "application/json; charset=utf-8"
        Do %response.Write(response.Result.%ToJSON())
        Quit $$$OK
    } Catch ex {
        Set %response.Status = 500
        Set %response.ContentType = "application/json; charset=utf-8"
        Set error = {}
        Do error.%Set("error",ex.DisplayString())
        Do %response.Write(error.%ToJSON())
        Quit $$$OK
    }
}
}
