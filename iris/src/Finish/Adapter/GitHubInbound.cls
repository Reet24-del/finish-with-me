Include %occStatus
Class Finish.Adapter.GitHubInbound Extends Ens.InboundAdapter
{
Parameter SETTINGS = "Repository:Basic,Label:Basic,FixtureFile:Additional";
Property Repository As %String [ InitialExpression = "Reet24-del/finish-with-me" ];
Property Label As %String [ InitialExpression = "stuck" ];
/// Only for reproducible local fixtures; leave empty when polling GitHub.
Property FixtureFile As %String;
Method OnTask() As %Status
{
    Try {
        Set raw = ..Fetch(..Repository,..Label,..FixtureFile)
        Set items = [].%FromJSON(raw)
        For i=0:1:items.%Size()-1 {
            Set issue = items.%Get(i)
            If issue.%IsDefined("pull_request") Continue
            Set input = {}
            Do input.%Set("repository",..Repository)
            Do input.%Set("number",issue.number)
            Do input.%Set("title",issue.title)
            Do input.%Set("body",issue.%Get("body",""))
            Do input.%Set("url",issue.%Get("html_url"))
            Do input.%Set("updatedAt",issue.%Get("updated_at"))
            Set envelope = ##class(Finish.Message.TraceEvent).%New()
            Set envelope.Payload = input
            Set sc = ..BusinessHost.ProcessInput(envelope)
            If $$$ISERR(sc) Return sc
        }
        Return $$$OK
    } Catch ex { Return ex.AsStatus() }
}
ClassMethod Fetch(repository As %String, label As %String, fixture As %String = "") As %String [ Language = python ]
{
    import json, re, urllib.request, urllib.parse, os
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Use owner/repository, not a URL")
    if fixture:
        if not fixture.startswith("/tmp/finish-fixtures/") or ".." in fixture:
            raise ValueError("Fixtures must be under /tmp/finish-fixtures/")
        with open(fixture, encoding="utf-8") as handle:
            data = handle.read(240000)
        return json.dumps(json.loads(data)[:10])
    url = "https://api.github.com/repos/" + repository + "/issues?state=open&per_page=10&labels=" + urllib.parse.quote(label, safe="")
    headers = {"Accept":"application/vnd.github+json", "User-Agent":"Finish-With-Me/0.3", "X-GitHub-Api-Version":"2022-11-28"}
    token = os.environ.get("GITHUB_ISSUES_TOKEN", "")
    if token:
        headers["Authorization"] = "Bearer " + token
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=10) as response:
        return response.read(240000).decode("utf-8")
}
}
