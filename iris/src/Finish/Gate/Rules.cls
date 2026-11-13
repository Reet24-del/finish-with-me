Include Ensemble

/// Embedded Python entry point for iris/gate/engine.py.
/// IPM Activate copies that directory to the manager directory finish-with-me/gate/.
/// scripts/setup-iris.sh copies engine.py to /durable/finish/gate_engine.py.
Class Finish.Gate.Rules Extends %RegisteredObject
{

ClassMethod Run(payload As %String(MAXLEN = 220000)) As %DynamicObject [ Language = python ]
{
    import json
    import os

    import iris

    path = os.environ.get("FINISH_GATE_FILE")
    if not path:
        durable = "/durable/finish/gate_engine.py"
        packaged = ""
        try:
            manager = iris.cls("%Library.File").ManagerDirectory()
            packaged = os.path.join(str(manager), "finish-with-me", "gate", "engine.py")
        except Exception:
            packaged = ""
        if os.path.isfile(durable):
            path = durable
        elif packaged and os.path.isfile(packaged):
            path = packaged
        else:
            path = durable
    import importlib.util
    if not os.path.isfile(path):
        raise RuntimeError(
            "The IRIS completion gate is not installed at " + path
            + ". An IPM install copies iris/gate/engine.py to <mgr>/finish-with-me/gate/engine.py."
            + " scripts/setup-iris.sh copies it to /durable/finish/gate_engine.py."
            + " Set FINISH_GATE_FILE to use another file."
        )
    spec = importlib.util.spec_from_file_location("finish_gate_engine", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("The IRIS completion gate could not be loaded from " + path + ".")
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
