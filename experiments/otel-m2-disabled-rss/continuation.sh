#!/usr/bin/env bash
set -euo pipefail
source_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
root=$(cd -- "$source_dir/../.." && pwd)
case "${1:-}" in
  gate)
    python3 "$source_dir/experiments/otel-m2-disabled-rss/continuation.py" gate
    python3 - "$root" <<'PY'
import pathlib,json,hashlib,sys
root=pathlib.Path(sys.argv[1]); evidence=root/'evidence'
gate=evidence/'continuation-gate-result.json'
value=json.loads(gate.read_text())
assert value['passed'] is True
assert value['snapshotSha256']==hashlib.sha256((evidence/'fixture-before.json').read_bytes()).hexdigest()
with (evidence/'continuation-gate-command.json').open('x') as stream:
    json.dump({'exit':0,'gateSha256':hashlib.sha256(gate.read_bytes()).hexdigest()},stream,indent=2)
PY
    ;;
  runs)
    python3 - "$root" <<'PY'
import pathlib,json,hashlib,sys
evidence=pathlib.Path(sys.argv[1])/'evidence'
gate=evidence/'continuation-gate-result.json'
assert json.loads(gate.read_text())['passed'] is True
operator=json.loads((evidence/'continuation-gate-command.json').read_text())
assert operator['exit']==0 and operator['gateSha256']==hashlib.sha256(gate.read_bytes()).hexdigest()
PY
    exec python3 "$source_dir/experiments/otel-m2-disabled-rss/continuation.py" runs
    ;;
  *) exit 64 ;;
esac
