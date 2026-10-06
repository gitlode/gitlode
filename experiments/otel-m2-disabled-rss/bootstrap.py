import pathlib, json, hashlib, subprocess, os, datetime, tarfile

root = pathlib.Path('/home/t-wakabayashi/gitlode-performance/m2-rss-experiment-20261006T1106')
archive = pathlib.Path('/home/t-wakabayashi/gitlode-performance/m2-freeze-8fffcc0-20261002/archive')
evidence = root / 'evidence'
def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''): h.update(block)
    return h.hexdigest()
manifest = json.loads((archive / 'sealed-manifest.json').read_text())
checks = []
for item in manifest['files']:
    path = archive / item['path']
    actual = sha(path)
    assert actual == item['sha256'], item['path']
    checks.append({'path': item['path'], 'sha256': actual})
(evidence / 'f-input-verification.json').write_text(json.dumps(checks, indent=2))
node_dir = root / 'node'
node_dir.mkdir()
subprocess.run(['tar', '-xJf', str(archive / 'inputs/node-v22.23.1-linux-x64.tar.xz'), '-C', str(node_dir)], check=True)
node = node_dir / 'node-v22.23.1-linux-x64/bin/node'
cfg = {'command': str(node), 'args': ['-e', "require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});setInterval(()=>{},1000)"], 'cwd': str(root), 'env': {}, 'seconds': 2, 'log': str(evidence / 'preflight.log')}
(evidence / 'preflight.command.json').write_text(json.dumps(cfg, indent=2))
env = os.environ.copy(); env.pop('NODE_OPTIONS', None)
start = datetime.datetime.now(datetime.timezone.utc)
result = subprocess.run([str(node), str(root / 'launch.cjs'), str(evidence / 'preflight.command.json')], env=env, timeout=20)
elapsed = (datetime.datetime.now(datetime.timezone.utc)-start).total_seconds()
record = json.loads((evidence / 'preflight.log.result.json').read_text())
pid = record['pid']; members = []
for path in pathlib.Path('/proc').glob('[0-9]*/stat'):
    try:
        stat = path.read_text(); fields = stat[stat.rfind(')')+2:].split()
        if int(fields[2]) == pid: members.append({'pid': int(path.parent.name), 'state': fields[0], 'start': fields[19]})
    except FileNotFoundError: pass
live = [m for m in members if m['state'] != 'Z']
preflight = {'exit': result.returncode, 'elapsedSeconds': elapsed, 'record': record, 'members': members, 'live': live, 'quietWindowJst': ['2026-10-06T11:06:00+09:00', '2026-10-06T14:06:00+09:00'], 'operatorHardStopJst': '2026-10-06T14:06:00+09:00', 'executionMs': 300000, 'processingMs': 300000, 'workloadBudgetMs': 1800000}
(evidence / 'preflight-inspection.json').write_text(json.dumps(preflight, indent=2))
assert result.returncode == 124 and record['signal'] == 'SIGKILL' and not live and elapsed < 10
print('Preflight passed', elapsed, flush=True)
source_parent = root / 'checkout'; source_parent.mkdir()
subprocess.run(['tar', '-xzf', str(archive / 'inputs/fixed-harness-and-build.tar.gz'), '-C', str(source_parent)], check=True)
source = source_parent / 'source'
assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source, text=True).strip() == '8fffcc0d8e11bb061d70bf870f262092d559c5f2'
assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=source, text=True).strip()
subprocess.run(['git', 'checkout', '-b', 'experiment/otel-m2-disabled-rss', '8fffcc0d8e11bb061d70bf870f262092d559c5f2'], cwd=source, check=True)
subprocess.run(['git', 'remote', 'set-url', 'origin', 'https://github.com/gitlode/gitlode.git'], cwd=source, check=True)
subprocess.run(['git', 'config', 'user.name', 'Tomokazu Wakabayashi'], cwd=source, check=True)
subprocess.run(['git', 'config', 'user.email', '187154953+tomo-waka@users.noreply.github.com'], cwd=source, check=True)
print('Isolated checkout ready', source, flush=True)
