# Publish finish-with-me-iris

`finish-with-me-iris` 0.3.0 is not on the public IPM registry. Publishing needs the owner's Open Exchange account and a running InterSystems IRIS with the IPM client. This repository change did not load or publish the module.

The contest check is:

```objectscript
zpm "install finish-with-me-iris"
```

Judges run that on the 154 AI Hub build. The module refuses earlier IRIS versions because `module.xml` contains:

```xml
<SystemRequirements Version=">=2026.3" Interoperability="enabled"/>
```

## What an install contains

`zpm "load"` and `zpm "install"` both read `module.xml`.

- `Finish.PKG` is loaded from `iris/src` and compiled. That is the REST dispatcher, decision production, AI Hub operation, workflow classes, trace recorder, GitHub adapter, and the Embedded Python class `Finish.Check.Receipt`.
- During Activate, IPM copies the directory `iris/gate/` to `<manager-directory>/finish-with-me/gate/`. That copy includes `engine.py` and `test_engine.py`. `Finish.Gate.Rules` uses this `engine.py` when `/durable/finish/gate_engine.py` is absent. `FINISH_GATE_FILE` overrides both.
- IPM does not run `test_engine.py`. The `<UnitTest>` element runs ObjectScript `%UnitTest` classes, and this file is a CPython unittest. Run it from a checkout:

```sh
cd iris/gate
python3 -m unittest test_engine.py
```

## What IPM does not install

`scripts/setup-iris.sh` is still required for the local Docker workflow. It is not replaced by the module.

- It copies `iris/gate/engine.py` to `/durable/finish/gate_engine.py`. When that file exists, `Finish.Gate.Rules` uses it instead of the IPM copy. The script does not copy `test_engine.py`.
- It loads and compiles the classes, sets the local `_SYSTEM` password from `IRIS_PASSWORD`, creates the authenticated `/csp/user/finish` application, adds `_SYSTEM` to the three workflow roles, runs `Finish.Gate.Rules.SmokeTest()`, and starts `Finish.Production`.

A registry or GitHub install leaves those steps undone. The production is compiled and not started, and no provider key is stored in the module.

## Install without the registry

These commands do not publish the package. Use them only after this `module.xml` is on the public default branch, in an Interoperability-enabled namespace on IRIS 2026.3 or later:

```objectscript
zpm "load /path/to/finish-with-me -v"
zpm "install https://github.com/Reet24-del/finish-with-me"
```

The GitHub URL installs the default branch. It is not the contest command. The contest command looks up the name `finish-with-me-iris` on the configured registry.

## Account and public publish

The public application registry is [pm.community.intersystems.com](https://pm.community.intersystems.com/). [Open Exchange is the only place that publishes to it](https://docs.openexchange.intersystems.com/apps/ipm/). A direct `zpm "publish"` from IRIS does not publish to that registry.

1. Merge this manifest to the default branch of the public repository, [https://github.com/Reet24-del/finish-with-me](https://github.com/Reet24-del/finish-with-me). The registry reads `module.xml` from the revision Open Exchange publishes.
2. Sign in to [Open Exchange](https://openexchange.intersystems.com/) with the account that owns Finish With Me. The existing listing was sent for approval as application version 1.0.0. The IPM version is the `<Version>` in `module.xml`, which is 0.3.0. Publish a revision that contains this file, not an older commit that lacks `SystemRequirements`.
3. On that application, check **Publish in Package Manager** and send the update for approval. Approval is the public publish step. The listing is not published by this repository change.
4. On a running AI Hub IRIS, before asking for approval, load the merged tree and read the log:

```objectscript
zpm "load /path/to/finish-with-me -v"
```

Reload, Validate, Compile, and Activate must succeed. The Activate log should show the copy into `finish-with-me/gate/`. Confirm these files exist under the IRIS manager directory (`##class(%Library.File).ManagerDirectory()`):

- `finish-with-me/gate/engine.py`
- `finish-with-me/gate/test_engine.py`

`##class(Finish.Gate.Rules).SmokeTest()` is the in-repository smoke method. Run it on that IRIS if you want a gate check. It was not run for this change.

The optional test registry in [Testing Packages for ZPM](https://community.intersystems.com/post/testing-packages-zpm) accepts a direct publish and is not the contest registry. The article's URL has changed before. Use the URL shown in that article when you try it. The command it last documented is:

```objectscript
zpm "repo -n registry -r -url https://test.pm.community.intersystems.com/registry/ -user test -pass PassWord42"
zpm "publish finish-with-me-iris -v"
```

That test user is public and is only for the test registry. Point the client back at the community registry before a contest install:

```objectscript
zpm "repo -n registry -r -url https://pm.community.intersystems.com"
```

## What to verify on build 154

Use the AI Hub Community image for `2026.3.0AI.154.0`, in a namespace with Interoperability enabled. IPM 0.9 and later does not enable the community registry by default. Either of these makes `zpm "install finish-with-me-iris"` resolve the public name:

```objectscript
zpm "enable -community"
zpm "repo -n registry -url https://pm.community.intersystems.com"
```

After Open Exchange has published the module:

1. `zpm "find finish-with-me-iris"` lists 0.3.0 from `https://pm.community.intersystems.com`.
2. On a clean namespace, `zpm "install finish-with-me-iris -v"` finishes Activate with SUCCESS, and `zpm "list"` shows `finish-with-me-iris` 0.3.0.
3. The same install on IRIS older than 2026.3 is refused by `SystemRequirements` before the classes load.
4. The same install in a namespace without Interoperability is refused.
5. `<manager-directory>/finish-with-me/gate/engine.py` and `test_engine.py` exist. `Finish.Production` is compiled and is not started by the module.
6. The package page [https://pm.community.intersystems.com/packages/finish-with-me-iris](https://pm.community.intersystems.com/packages/finish-with-me-iris) shows 0.3.0. That page does not exist until the publish is approved.
