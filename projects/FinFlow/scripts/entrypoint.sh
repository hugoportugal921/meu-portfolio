#!/bin/sh
set -eu
exec dotnet "/app/FinFlow.${FINFLOW_SERVICE}.Api.dll" "$@"
