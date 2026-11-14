Include Ensemble

/// Looks up and stores similar finished blockers with IRIS VECTOR_COSINE.
/// The vector is the lexical hash from Finish.Memory.Embed.
Class Finish.Memory.Operation Extends Ens.BusinessOperation
{

Parameter INVOCATION = "Queue";

Method OnMessage(pRequest As Finish.Message.PrecedentRequest, Output pResponse As Finish.Message.PrecedentResult) As %Status
{
    Set pResponse = ##class(Finish.Message.PrecedentResult).%New()
    Set pResponse.TraceSummary = pRequest.TraceSummary
    Try {
        If pRequest.Mode = "store" {
            Set sc = ..Store(pRequest, .pResponse)
        } ElseIf pRequest.Mode = "lookup" {
            Set sc = ..Lookup(pRequest, .pResponse)
        } Else {
            Return $$$ERROR($$$GeneralError,"Precedent mode must be lookup or store.")
        }
    } Catch ex {
        Return ex.AsStatus()
    }
    If $$$ISERR(sc) Return sc
    $$$TRACE(pResponse.TraceSummary)
    Return $$$OK
}

ClassMethod Lookup(pRequest As Finish.Message.PrecedentRequest, Output pResponse As Finish.Message.PrecedentResult) As %Status
{
    If '$IsObject(pResponse) Set pResponse = ##class(Finish.Message.PrecedentResult).%New()
    Set matches = []
    Set pResponse.TopScore = 0
    Set pResponse.MatchesJson = "[]"
    Set blocker = pRequest.Blocker
    If blocker = "" Set blocker = pRequest.TaskId
    Set sc = ..VectorFor(blocker, .vector)
    If $$$ISERR(sc) Return sc
    Set profile = pRequest.Profile
    Set stmt = ##class(%SQL.Statement).%New()
    Set stmt.%SelectMode = 1 ; ODBC, so TO_VECTOR accepts a comma-separated string
    Set sc = stmt.%Prepare("SELECT TOP 3 TaskId,Resolution,VECTOR_COSINE(Vec,TO_VECTOR(?,DOUBLE,256)) AS Score FROM Finish_Memory.Precedent WHERE Profile=? ORDER BY Score DESC")
    If $$$ISERR(sc) Return sc
    Set rs = stmt.%Execute(vector, profile)
    If rs.%SQLCODE < 0 Return $$$ERROR($$$GeneralError,"Precedent lookup SQLCODE "_rs.%SQLCODE_": "_rs.%Message)
    While rs.%Next() {
        Set row = {}
        Do row.%Set("taskId", rs.%Get("TaskId"))
        Do row.%Set("resolution", rs.%Get("Resolution"))
        Do row.%Set("score", +rs.%Get("Score"), "number")
        Do matches.%Push(row)
        If matches.%Size() = 1 Set pResponse.TopScore = +rs.%Get("Score")
    }
    Set pResponse.MatchesJson = matches.%ToJSON()
    Set pResponse.TraceSummary = "lookup "_profile_" matches "_matches.%Size()_" top "_pResponse.TopScore
    Return $$$OK
}

ClassMethod Store(pRequest As Finish.Message.PrecedentRequest, Output pResponse As Finish.Message.PrecedentResult) As %Status
{
    If '$IsObject(pResponse) Set pResponse = ##class(Finish.Message.PrecedentResult).%New()
    If pRequest.TaskId = "" Return $$$ERROR($$$GeneralError,"A precedent needs a task id.")
    If pRequest.Profile = "" Return $$$ERROR($$$GeneralError,"A precedent needs a profile.")
    Set taskId = pRequest.TaskId
    Set profile = pRequest.Profile
    Set blocker = $Extract(pRequest.Blocker,1,12000)
    Set resolution = $Extract(pRequest.Resolution,1,4000)
    Set stmt = ##class(%SQL.Statement).%New()
    Set stmt.%SelectMode = 1
    Set sc = stmt.%Prepare("SELECT TOP 1 ID FROM Finish_Memory.Precedent WHERE TaskId = ?")
    If $$$ISERR(sc) Return sc
    Set found = stmt.%Execute(taskId)
    If found.%SQLCODE < 0 Return $$$ERROR($$$GeneralError,"Precedent task lookup SQLCODE "_found.%SQLCODE_": "_found.%Message)
    If found.%Next() {
        Set pResponse.MatchesJson = "[]"
        Set pResponse.TopScore = 0
        Set pResponse.TraceSummary = "Precedent already stored for "_taskId
        Return $$$OK
    }
    Set text = blocker
    If text = "" Set text = resolution
    Set sc = ..VectorFor(text, .vector)
    If $$$ISERR(sc) Return sc
    Set insert = ##class(%SQL.Statement).%New()
    Set insert.%SelectMode = 1 ; ODBC, so TO_VECTOR accepts a comma-separated string
    Set sc = insert.%Prepare("INSERT INTO Finish_Memory.Precedent (TaskId, Profile, Blocker, Resolution, Vec, CreatedAt) VALUES (?, ?, ?, ?, TO_VECTOR(?,DOUBLE,256), CURRENT_TIMESTAMP)")
    If $$$ISERR(sc) Return sc
    Set rs = insert.%Execute(taskId, profile, blocker, resolution, vector)
    If rs.%SQLCODE < 0 Return $$$ERROR($$$GeneralError,"Precedent store SQLCODE "_rs.%SQLCODE_": "_rs.%Message)
    Set pResponse.MatchesJson = "[]"
    Set pResponse.TopScore = 0
    Set pResponse.TraceSummary = "Stored precedent "_taskId_" for "_profile
    Return $$$OK
}

/// Run after Finish.Install.SeedPrecedents. Prints the stuck-transform lookup. Not a live-IRIS claim by itself.
ClassMethod Smoke() As %Status
{
    Try {
        Set req = ##class(Finish.Message.PrecedentRequest).%New()
        Set req.Mode = "lookup"
        Set req.TaskId = "smoke-lookup"
        Set req.Profile = "integration"
        Set req.Blocker = "Message 1042 is stuck in error status after Finish.RecordToTarget."
        Set req.TraceSummary = "Memory smoke lookup"
        Set sc = ..Lookup(req, .resp)
        If $$$ISERR(sc) Return sc
        If '$IsObject(resp) Return $$$ERROR($$$GeneralError,"Precedent lookup returned no message.")
        If (resp.MatchesJson = "") || (resp.MatchesJson = "[]") {
            Return $$$ERROR($$$GeneralError,"Precedent lookup returned no similar finished blockers.")
        }
        If resp.MatchesJson '[ "seed-integration-required-field" {
            Return $$$ERROR($$$GeneralError,"Precedent lookup did not return the stuck-transform seed. "_$Extract(resp.MatchesJson,1,500))
        }
        Write "FINISH_MEMORY_OK",!
        Write "top="_resp.TopScore,!
        Write resp.MatchesJson,!
        Return $$$OK
    } Catch ex {
        Return ex.AsStatus()
    }
}

ClassMethod VectorFor(text As %String(MAXLEN = 32000), Output vector As %String(MAXLEN = 8000)) As %Status
{
    Set vector = ##class(Finish.Memory.Embed).Vector(text)
    If $Length(vector,",") '= 256 Return $$$ERROR($$$GeneralError,"The lexical vector must contain 256 values.")
    Return $$$OK
}

}
