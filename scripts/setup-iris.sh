#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
command -v docker >/dev/null 2>&1 || { echo 'Install and start Docker Desktop first.' >&2; exit 1; }
docker compose cp iris/src/. iris:/tmp/finish-src
setup_output=$(mktemp)
trap 'rm -f "$setup_output"' EXIT
if ! docker compose exec -T iris iris session IRIS -U USER > "$setup_output" <<'IRIS'
Set sc = $System.OBJ.LoadDir("/tmp/finish-src","ck",,1)
If $System.Status.IsError(sc) { Write $System.Status.GetErrorText(sc),! } Else { Write "FINISH_CLASSES_OK",! }
Halt
IRIS
then cat "$setup_output"; exit 1; fi
cat "$setup_output"
grep -q '^FINISH_CLASSES_OK' "$setup_output" || exit 1
if ! docker compose exec -T iris iris session IRIS -U USER > "$setup_output" <<'IRIS'
Set sc = ##class(Finish.Install).Configure()
If $System.Status.IsError(sc) { Do $System.Status.DisplayError(sc) } Else { Write "FINISH_REST_OK",! }
Halt
IRIS
then cat "$setup_output"; exit 1; fi
cat "$setup_output"
grep -q '^FINISH_REST_OK' "$setup_output" || exit 1
if ! docker compose exec -T iris iris session IRIS -U USER > "$setup_output" <<'IRIS'
Set sc = ##class(Finish.Install).ConfigureWorkflow()
If $System.Status.IsError(sc) { Do $System.Status.DisplayError(sc) } Else { Write "FINISH_WORKFLOW_OK",! }
Do ##class(Ens.Director).StopProduction()
Set sc = ##class(Ens.Director).StartProduction("Finish.Production")
If $System.Status.IsError(sc) { Do $System.Status.DisplayError(sc) } Else { Write "FINISH_PRODUCTION_OK",! }
Halt
IRIS
then cat "$setup_output"; exit 1; fi
cat "$setup_output"
grep -q '^FINISH_WORKFLOW_OK' "$setup_output" || exit 1
grep -q '^FINISH_PRODUCTION_OK' "$setup_output" || exit 1
