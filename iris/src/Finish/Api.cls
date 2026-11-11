Include %occStatus

Class Finish.Api Extends %CSP.REST
{
Parameter CHARSET = "utf-8";

XData UrlMap
{
<Routes>
  <Route Url="/check" Method="POST" Call="Check" />
  <Route Url="/imports" Method="GET" Call="Imports" />
  <Route Url="/health" Method="GET" Call="Health" />
  <Route Url="/investigate" Method="POST" Call="Investigate" />
</Routes>
}

ClassMethod Health() As %Status
{
    Set %response.ContentType = "application/json; charset=utf-8"
    Write ("{""ok"":true,""provider"":""InterSystems IRIS AI Hub""}")
    Return $$$OK
}

ClassMethod Investigate() As %Status
{
    Try {
        Set stage = "decode-request"
        Set input = {}.%FromJSON(%request.Content.Read(240000))
        Set request = ##class(Finish.Message.InvestigateRequest).%New()
        Set request.Payload = input
        Set stage = "create-service"
        Set sc = ##class(Ens.Director).CreateBusinessService("Finish.ApiService",.service)
        If $$$ISERR(sc) {
            Set %response.Status = 500
            Set error = {}
            Do error.%Set("error",$System.Status.GetErrorText(sc))
            Set %response.ContentType = "application/json; charset=utf-8"
            Write (error.%ToJSON())
            Return $$$OK
        }
        Set stage = "run-agent"
        Set sc = service.SendRequestSync("Finish.AgentOperation",request,.response,90,"Finish With Me task investigation")
        If $$$ISERR(sc) {
            Set %response.Status = 500
            Set error = {}
            Do error.%Set("error",$System.Status.GetErrorText(sc))
            Set %response.ContentType = "application/json; charset=utf-8"
            Write (error.%ToJSON())
            Return $$$OK
        }
        Set %response.ContentType = "application/json; charset=utf-8"
        Write (response.Result.%ToJSON())
        Return $$$OK
    } Catch ex {
        Set %response.Status = 500
        Set %response.ContentType = "application/json; charset=utf-8"
        Set error = {}
        Do error.%Set("error",ex.DisplayString())
        Do error.%Set("stage",$Get(stage))
        Do error.%Set("location",ex.Location)
        Write (error.%ToJSON())
        Return $$$OK
    }
}
ClassMethod Check() As %Status
{
    Set %response.ContentType = "application/json; charset=utf-8"
    Try {
        Set input = {}.%FromJSON(%request.Content.Read(200000))
        Set request = ##class(Finish.Message.CheckRequest).%New()
        Set request.AstJSON = input.astJSON
        Set sc = ##class(Ens.Director).CreateBusinessService("Finish.ApiService",.service)
        $$$ThrowOnError(sc)
        $$$ThrowOnError(service.SendRequestSync("Finish.CheckOperation",request,.response,15,"Embedded Python independent checks"))
        Write response.Result.%ToJSON()
    } Catch ex {
        Set %response.Status = 400
        Set result = {}
        Do result.%Set("error",ex.DisplayString())
        Write result.%ToJSON()
    }
    Return $$$OK
}
ClassMethod Imports() As %Status
{
    Set %response.ContentType = "application/json; charset=utf-8"
    Set result = [], repo = ""
    For {
        Set repo = $Order(^FinishGitHub(repo)) Quit:repo=""
        Set number = ""
        For {
            Set number = $Order(^FinishGitHub(repo,number)) Quit:number=""
            If $Data(^FinishGitHub(repo,number,"snapshot")) Do result.%Push({}.%FromJSON(^FinishGitHub(repo,number,"snapshot")))
            Quit:result.%Size()>=50
        }
        Quit:result.%Size()>=50
    }
    Write result.%ToJSON()
    Return $$$OK
}

}
