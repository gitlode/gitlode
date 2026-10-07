"""Disposable setup checks; never invokes a product CLI."""
import pathlib, tempfile, tarfile, io, json, subprocess, shutil, hashlib
from runtime_validation import validate_runtime

scripts=pathlib.Path(__file__).resolve().parent
results=[]
with tempfile.TemporaryDirectory() as temp:
    base=pathlib.Path(temp)
    deps=base/'dependencies'; deps.mkdir()
    runtime=base/'runtime'; (runtime/'dist').mkdir(parents=True)
    (runtime/'dist/index.js').write_bytes(b'dist')
    (runtime/'package.json').write_bytes(b'{"type":"module"}\n')
    (runtime/'node_modules').symlink_to(deps)
    item={'variant':'V0','inventory':[{'path':'dist/index.js','bytes':4,'sha256':hashlib.sha256(b'dist').hexdigest()}]}
    archive=base/'sealed.tar.gz'
    with tarfile.open(archive,'w:gz') as tar:
        tar.add(runtime/'package.json',arcname='runtimes/V0/package.json')
        link=tarfile.TarInfo('runtimes/V0/node_modules'); link.type=tarfile.SYMTYPE; link.linkname='/original/dependencies'; tar.addfile(link)
    def check(label,passed):
        try: validate_runtime(runtime,item,archive,deps,'/original/dependencies'); actual=True
        except (AssertionError,FileNotFoundError): actual=False
        assert actual==passed,label
        results.append({'test':label,'passed':True,'runtimeAccepted':actual})
    check('legitimate dist and separately sealed metadata',True)
    (runtime/'dist/index.js').write_bytes(b'edit'); check('changed dist',False)
    (runtime/'dist/index.js').unlink(); check('missing dist',False)
    (runtime/'dist/index.js').write_bytes(b'dist')
    (runtime/'unexpected').write_bytes(b'x'); check('unexpected file',False); (runtime/'unexpected').unlink()
    (runtime/'package.json').write_bytes(b'changed'); check('changed metadata',False)
    (runtime/'package.json').write_bytes(b'{"type":"module"}\n')
    (runtime/'extra').symlink_to(deps); check('unexpected link',False); (runtime/'extra').unlink()
    (runtime/'empty').mkdir(); check('unexpected directory',False); (runtime/'empty').rmdir()
    (runtime/'node_modules').unlink(); (runtime/'node_modules').symlink_to(base); check('changed dependency target',False)
    fake=base/'operator-root'; target=fake/'checkout/source/experiments/otel-m2-disabled-rss'; target.mkdir(parents=True)
    evidence=fake/'evidence'; evidence.mkdir()
    shutil.copy2(scripts/'operator.sh',target/'operator.sh')
    (target/'control.py').write_text("from pathlib import Path\nPath(__file__).with_name('WORKLOAD-DISPATCHED').touch()\n")
    def shell(label,mode,expected):
        run=subprocess.run(['bash',str(target/'operator.sh'),mode],capture_output=True,text=True)
        assert (run.returncode==0)==expected,label
        assert not (target/'WORKLOAD-DISPATCHED').exists(),label
        results.append({'test':label,'passed':True,'exit':run.returncode,'stdout':run.stdout,'stderr':run.stderr,'noWorkloadDispatch':True})
    (target/'restored-gate.py').write_text("raise RuntimeError('synthetic controller failure')\n")
    shell('actual wrapper propagates controller failure','gate',False)
    shell('missing gate blocks workload','runs',False)
    (target/'restored-gate.py').write_text("from pathlib import Path\nimport json\nr=Path(__file__).resolve().parents[4]\n(r/'evidence/restored-gate-result.json').write_text(json.dumps({'passed':False}))\n")
    shell('exit zero with failed persisted gate fails','gate',False)
    (evidence/'gate-command-success.json').write_text(json.dumps({'exit':0,'gateSha256':'stale'}))
    shell('stale command marker blocks workload','runs',False)
    (evidence/'restored-gate-result.json').write_text(json.dumps({'passed':True,'snapshotSha256':'stale'}))
    shell('successful stale gate blocks workload','runs',False)
print(json.dumps({'passed':True,'checks':results},indent=2))
