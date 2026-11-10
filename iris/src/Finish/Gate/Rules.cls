Include Ensemble

/// Embedded Python entry point for iris/gate/engine.py.
Class Finish.Gate.Rules Extends %RegisteredObject
{

ClassMethod Run(payload As %String(MAXLEN = 220000)) As %DynamicObject [ Language = python ]
{
    import json
    import os

    import iris

    path = os.environ.get("FINISH_GATE_FILE") or "/durable/finish/gate_engine.py"
    import importlib.util
    spec = importlib.util.spec_from_file_location("finish_gate_engine", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("The IRIS completion gate is not installed at " + path + ". Run scripts/setup-iris.sh.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    decided = module.decide(json.loads(payload))
    return iris.cls("%DynamicObject")._FromJSON(json.dumps(decided))
}

ClassMethod SmokeTest() As %Status
{
    Set payload = {}
    Do payload.%Set("action","investigate")
    Do payload.%Set("taskId","smoke")
    Do payload.%Set("kind","coding")
    Do payload.%Set("profile","project")
    Do payload.%Set("title","Smoke")
    Do payload.%Set("description","")
    Do payload.%Set("blocker","The slice is wrong.")
    Do payload.%Set("tried","")
    Do payload.%Set("source","def page(items, start, limit): return items[start:limit]")
    Do payload.%Set("material","")
    Do payload.%Set("criteria","Return limit items.")
    Do payload.%Set("subject","Python")
    Set tools = []
    Do tools.%Push("InspectTask")
    Do tools.%Push("PrepareProject")
    Do payload.%Set("toolsUsed",tools)
    Set proposal = {}
    Do proposal.%Set("tool","PrepareProject")
    Do proposal.%Set("summary","Fix the slice.")
    Do proposal.%Set("nextAction","Run the pagination check.")
    Do proposal.%Set("artifact","def page(items, start, limit): return items[start:start+limit]")
    Do proposal.%Set("verification","Check page([0,1,2,3], 2, 2) == [2, 3].")
    Do payload.%Set("proposal",proposal)
    Try {
        Set result = ..Run(payload.%ToJSON())
    } Catch ex {
        Return ex.AsStatus()
    }
    If '$IsObject(result) || (result.%Get("outcome") '= "needs-evidence") {
        Set raw = ""
        If $IsObject(result) Set raw = result.%ToJSON()
        Return $$$ERROR($$$GeneralError,"Gate smoke test expected needs-evidence and got "_raw)
    }
    Write "FINISH_GATE_OK",!
    Return $$$OK
}

}
