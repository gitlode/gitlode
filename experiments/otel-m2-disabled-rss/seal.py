import pathlib, json, hashlib, subprocess, shutil, datetime, os

source=pathlib.Path(__file__).resolve().parents[2]
root=source.parents[1]
evidence=root/'evidence'
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''): h.update(block)
    return h.hexdigest()
def inventory(path):
    return [{'path':str(p.relative_to(path)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(path.rglob('*')) if p.is_file() and not p.is_symlink()]
before=json.loads((evidence/'fixture-before.json').read_text())
at_gate=json.loads((evidence/'fixture-workload-start.json').read_text())
after=inventory(root/'fixture/repository')
(evidence/'fixture-return-inventory.json').write_text(json.dumps(after,indent=2))
dependency=inventory(source/'node_modules')
(evidence/'dependency-after.json').write_text(json.dumps(dependency,indent=2))
assert dependency==json.loads((evidence/'dependency-before.json').read_text())
f_archive=pathlib.Path('/home/t-wakabayashi/gitlode-performance/m2-freeze-8fffcc0-20261002/archive')
f_manifest=json.loads((f_archive/'sealed-manifest.json').read_text())
for item in f_manifest['files']: assert sha(f_archive/item['path'])==item['sha256'],item['path']
(evidence/'f-input-after-verification.json').write_text(json.dumps({'filesVerified':len(f_manifest['files']),'manifestSha256':sha(f_archive/'sealed-manifest.json'),'unchanged':True},indent=2))
groups=[]
for path in evidence.glob('*/supervision-*.json'):
    terminal=json.loads(path.read_text())
    groups.append({'pid':terminal['workerPid'],'artifact':str(path),'cleanupConfirmed':terminal['cleanupConfirmed'],'cleanupErrors':terminal['cleanupErrors']})
    assert terminal['cleanupConfirmed'] and not terminal['cleanupErrors']
preflight=json.loads((evidence/'preflight-inspection.json').read_text())
pids={g['pid'] for g in groups}|{preflight['record']['pid'],294653}
live=[]; observations=[]
for path in pathlib.Path('/proc').glob('[0-9]*/stat'):
    try:
        stat=path.read_text(); fields=stat[stat.rfind(')')+2:].split()
        if int(fields[2]) in pids:
            item={'pid':int(path.parent.name),'pgid':int(fields[2]),'state':fields[0],'start':fields[19]}
            observations.append(item)
            if item['state']!='Z':live.append(item)
    except FileNotFoundError:pass
assert not live,live
assert not list((root/'runs').glob('*')), 'zero diagnostic CLI runs expected'
oid=subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip()
remote=subprocess.check_output(['git','ls-remote','origin','refs/heads/experiment/otel-m2-disabled-rss'],cwd=source,text=True).split()[0]
assert oid==remote
summary={'classification':'preparation-stop','reason':'fixture inventory/object layout drift before first diagnostic CLI spawn','executedCliRuns':0,'rows':[{'run':n,'variant':v,'outcome':'not-executed'} for n,v in enumerate(['V0','V1','V2','V2','V1','V0'],1)],'fixtureHeadBefore':before['head'],'fixtureHeadAtGate':at_gate['head'],'fixtureCountBefore':before['count'],'fixtureCountAtGate':at_gate['count'],'objectLayoutBefore':before['objectLayout'],'objectLayoutAtGate':at_gate['objectLayout'],'gcPidPresentBefore':any(i['path']=='.git/gc.pid' for i in before['inventory']),'gcPidPresentAtGate':any(i['path']=='.git/gc.pid' for i in at_gate['inventory']),'experimentOid':oid,'remoteEquality':True,'groups':groups,'processObservations':observations,'liveOwnedGroupMembers':live,'boundaryContrasts':'unavailable; no CLI ran','outputEquivalence':'unverified; no CLI outputs','fImmutableInputsUnchanged':True,'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(evidence/'preparation-stop.json').write_text(json.dumps(summary,indent=2))
archive=root/'archive'; archive.mkdir()
shutil.copytree(evidence,archive/'evidence')
shutil.copytree(source/'experiments/otel-m2-disabled-rss',archive/'scripts')
shutil.copy2(root/'manifest.json',archive/'fixture-manifest.json')
subprocess.run(['tar','-czf',str(archive/'prepared-source-and-dependencies.tar.gz'),'-C',str(root/'checkout'),'source'],check=True,timeout=300)
subprocess.run(['tar','-czf',str(archive/'fixed-variant-runtimes.tar.gz'),'-C',str(root),'runtimes'],check=True,timeout=300)
subprocess.run(['tar','-czf',str(archive/'prepared-fixture-at-return.tar.gz'),'-C',str(root/'fixture'),'repository'],check=True,timeout=300)
shutil.copy2(f_archive/'inputs/node-v22.23.1-linux-x64.tar.xz',archive/'node-v22.23.1-linux-x64.tar.xz')
(archive/'RESTORE.md').write_text('''# Disabled RSS experiment preparation-stop evidence

No diagnostic CLI ran. All six rows are unexecuted; no RSS attribution or output
equivalence is established. Source is diagnostic only, never a production fix.
See evidence/preparation-stop.json and scripts/identities.md for exact provenance.
The initial fixture inventory captured .git/gc.pid. Before the first CLI launch,
objects/pack and commit-graph changed. Do not treat it as an immutable workload input.
The unchanged recipe was used; no manual repack or maintenance policy change ran.

prepared-source-and-dependencies.tar.gz restores checkout/source, including fixed
dependencies and experiment Git history. fixed-variant-runtimes.tar.gz restores
three distinct dist directories. Their node_modules links point to the original
absolute checkout path; an independent restoration must relink them to its restored
checkout/source/node_modules. No standalone portable-runtime claim is made.
Node distribution is unchanged from F. Prepared fixture at return is evidence,
not an authorized formal fixture or permission to restart this experiment.

Verify every archive file with sealed-manifest.json before use. Never run commands
inside sealed archives. Linux and D:/gitlode_test are two OS copies on the same host.
Trunk alone assigns any later setup repair, diagnostic experiment or formal work.
''')
manifest={'kind':'m2-disabled-rss-preparation-stop','experimentOid':oid,'executedCliRuns':0,'files':inventory(archive)}
(archive/'sealed-manifest.json').write_text(json.dumps(manifest,indent=2))
mirror=pathlib.Path('/mnt/d/gitlode_test/m2-rss-experiment-20261006T1106')
assert not mirror.exists()
shutil.copytree(archive,mirror)
for item in manifest['files']:
    assert sha(archive/item['path'])==item['sha256'] and sha(mirror/item['path'])==item['sha256'],item['path']
manifest_hash=sha(archive/'sealed-manifest.json')
assert manifest_hash==sha(mirror/'sealed-manifest.json')
verification={'archive':str(archive),'mirror':str(mirror),'manifestSha256':manifest_hash,'filesVerified':len(manifest['files']),'experimentOid':oid,'remoteOid':remote,'remoteEquality':True}
(root/'copy-verification.json').write_text(json.dumps(verification,indent=2))
print(json.dumps(verification,indent=2),flush=True)
