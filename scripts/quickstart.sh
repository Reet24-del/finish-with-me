#!/usr/bin/env sh
# One-command local start on the public IRIS preview image (no AI Hub, no API key).
# The deterministic agent is labeled "fallback (no AI Hub)"; the vector search, gate,
# and Workflow Engine are the same as on the AI Hub build.
set -eu
cd "$(dirname "$0")/.."
command -v docker >/dev/null 2>&1 || { echo 'Install and start Docker first.' >&2; exit 1; }
export IRIS_IMAGE="${IRIS_IMAGE:-containers.intersystems.com/intersystems/iris-community:latest-preview}"
export IRIS_PASSWORD="${IRIS_PASSWORD:-SYS}"
echo "Using IRIS image $IRIS_IMAGE"
docker compose up -d iris
printf 'Waiting for IRIS'
i=0
until docker compose exec -T iris iris qlist IRIS 2>/dev/null | grep -q '\^running'; do
  i=$((i+1)); [ "$i" -gt 60 ] && { echo; echo 'IRIS did not start in 5 minutes.' >&2; exit 1; }
  printf '.'; sleep 5
done
echo
sh scripts/setup-iris.sh
if [ "${SKIP_APP:-}" != "1" ]; then docker compose up --build -d app; fi
echo "Management Portal: http://localhost:52773/csp/sys/UtilHome.csp (user _SYSTEM, password from IRIS_PASSWORD)"
[ "${SKIP_APP:-}" = "1" ] || echo "App: http://localhost:4318"
