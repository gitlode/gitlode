#!/usr/bin/env bash
set -euo pipefail
source_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
root=$(cd -- "$source_dir/../.." && pwd)
case "${1:-}" in
  gate) python3 "$source_dir/experiments/otel-m2-disabled-rss/restored-gate.py" ;;
  runs)
    python3 - "$root" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
gate = json.loads((root/'evidence/restored-gate-result.json').read_text())
operator = json.loads((root/'evidence/gate-command-success.json').read_text())
assert gate['passed'] is True and operator['exit'] == 0
assert operator['gateSha256'] == hashlib.sha256((root/'evidence/restored-gate-result.json').read_bytes()).hexdigest()
assert gate['snapshotSha256'] == hashlib.sha256((root/'evidence/fixture-before.json').read_bytes()).hexdigest()
PY
    exec python3 "$source_dir/experiments/otel-m2-disabled-rss/control.py" runs ;;
  *) exit 64 ;;
esac
python3 - "$root" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
path = root/'evidence/restored-gate-result.json'
assert json.loads(path.read_text())['passed'] is True
success = root/'evidence/gate-command-success.json'
with success.open('x') as stream:
    json.dump({'exit': 0, 'gateSha256': hashlib.sha256(path.read_bytes()).hexdigest()}, stream, indent=2)
PY
