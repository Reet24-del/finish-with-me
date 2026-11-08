#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
command -v docker >/dev/null 2>&1 || { echo 'Install and start Docker Desktop first.' >&2; exit 1; }
docker compose exec -T iris iris session IRIS -U USER <<'IRIS'
Set sc = $System.OBJ.LoadDir("/iris/src","ck",,1)
If $System.Status.IsError(sc) { Write $System.Status.GetErrorText(sc),! Halt 1 }
Set sc = ##class(Ens.Director).StartProduction("Finish.Production")
If $System.Status.IsError(sc) { Write $System.Status.GetErrorText(sc),! Halt 1 }
Write "Finish.Production started. Configure /csp/user/finish with dispatch class Finish.Api as described in README.",!
Halt
IRIS
