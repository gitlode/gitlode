import pathlib, subprocess, os, sys, json, hashlib, re, shutil, datetime

source = pathlib.Path(__file__).resolve().parents[2]
root = source.parents[1]
variant = sys.argv[1]
assert variant in ['V0', 'V1', 'V2']
nodebin = root / 'node/node-v22.23.1-linux-x64/bin'
env = os.environ.copy(); env.pop('NODE_OPTIONS', None)
temp = root / 'tmp'; temp.mkdir(exist_ok=True)
env.update(PATH=str(nodebin)+':/usr/bin:/bin', TMPDIR=str(temp), TMP=str(temp), TEMP=str(temp), npm_config_cache=str(root/'npm-cache'))
probe_only = '--resume-probe' in sys.argv
evidence = root / 'evidence' / (variant + ('-probe-correction1' if probe_only else '')); evidence.mkdir()
def run(name, args):
    with (evidence / (name+'.log')).open('wb') as stream:
        result = subprocess.run(args, cwd=source, env=env, stdout=stream, stderr=subprocess.STDOUT, timeout=900)
    (evidence / (name+'.result.json')).write_text(json.dumps({'args': args, 'exit': result.returncode, 'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat()}, indent=2))
    assert result.returncode == 0, name
if not probe_only:
    run('format-write', [str(nodebin/'npm'), 'run', 'format:write'])
    run('format-check', [str(nodebin/'npm'), 'run', 'format:check'])
    run('architecture', [str(nodebin/'npm'), 'run', 'architecture:check'])
    run('build', [str(nodebin/'npm'), 'run', 'build:release'])
else:
    assert variant == 'V0'
    assert not subprocess.check_output(['git','diff','b487272','HEAD','--','packages'], cwd=source, text=True).strip()
run('disabled-probe', [str(nodebin/'node'), str(source/'node_modules/tsx/dist/cli.mjs'), str(source/'experiments/otel-m2-disabled-rss/probe.mts'), variant])
dist = source / 'packages/gitlode/dist'
def graph(entry):
    visited = set(); external = set(); edges = []
    def walk(path):
        path = path.resolve()
        if path in visited: return
        visited.add(path)
        text = path.read_text()
        # Static ESM imports/reexports only; dynamic imports are reported separately.
        imports = re.findall(r'(?:\bimport\s+(?:[^;\n]*?\s+from\s+)?|\bexport\s+[^;\n]*?\s+from\s+)[\"\x27]([^\"\x27]+)[\"\x27]', text)
        for spec in imports:
            edges.append([path.name, spec])
            if spec.startswith('.'): walk(path.parent/spec)
            else: external.add(spec)
    walk(dist/entry)
    return {'entry': entry, 'files': sorted(p.name for p in visited), 'external': sorted(external), 'edges': edges, 'sdkEager': sorted(s for s in external if s.startswith('@opentelemetry/') and s != '@opentelemetry/api')}
graphs = [graph('index.js'), graph('worker-entry.js')]
(evidence/'graphs.json').write_text(json.dumps(graphs, indent=2))
assert all(bool(g['sdkEager']) == (variant != 'V2') for g in graphs), graphs
assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=source, text=True).strip(), 'format altered source; preserve correction before further execution'
runtime = root/'runtimes'/variant
runtime.mkdir(parents=True)
shutil.copytree(dist, runtime/'dist', symlinks=True)
os.symlink(str(source/'node_modules'), runtime/'node_modules')
(runtime/'package.json').write_text('{"type":"module"}\n')
inventory = []
for p in sorted((runtime/'dist').rglob('*')):
    if p.is_file(): inventory.append({'path': str(p.relative_to(runtime)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'bytes': p.stat().st_size})
oid = subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip()
(evidence/'runtime-identity.json').write_text(json.dumps({'variant':variant,'oid':oid,'buildProductOid':'b487272' if probe_only else oid,'inventory':inventory,'runtime':str(runtime),'graphs':graphs},indent=2))
print(variant, oid, 'build/probe/graphs passed', flush=True)
