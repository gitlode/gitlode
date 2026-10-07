"""Diagnostic-only original ordinals 3-6; no retries or edits to old evidence."""
import pathlib, json, sys, datetime, time, os, subprocess

source=pathlib.Path(__file__).resolve().parents[2]
root=source.parents[1]
old=root.parent/'m2-rss-corrected-20261007T1406'
sealed=old/'archive'
original=root.parent/'m2-rss-experiment-20261006T1106/archive'
# Reuse the exact inventory, sampler/supervisor invocation and bounded cleanup helpers.
exec(compile((source/'experiments/otel-m2-disabled-rss/control.py').read_text().split('mode=sys.argv[1]')[0], 'control.py', 'exec'))
window=json.loads((root/'window.json').read_text())
hard_stop=datetime.datetime.fromisoformat(window['hardStop']).timestamp()
window_start=datetime.datetime.fromisoformat(window['start']).timestamp()
assert window['humanConfirmed'] is True and window_start <= time.time() < hard_stop
env['GITLODE_RSS_BASELINE']=str(sealed/'runs/1')
assert (root/'fixture/repository').resolve()==(old/'fixture/repository').resolve()
evidence=root/'evidence'
def record(name, data):
    with (evidence/(name+'.json')).open('x') as stream: json.dump(data,stream,indent=2)
def identities():
    from runtime_validation import validate_runtime
    ids=json.loads((original/'evidence/variant-identities.json').read_text())
    values=[validate_runtime(root/'runtimes'/item['variant'],item,original/'fixed-variant-runtimes.tar.gz',source/'node_modules','/home/t-wakabayashi/gitlode-performance/m2-rss-experiment-20261006T1106/checkout/source/node_modules') for item in ids['identities']]
    assert inventory(source/'node_modules')==json.loads((original/'evidence/dependency-before.json').read_text())
    assert sha(nodebin/'node')==ids['nodeSha256'] and sha(pathlib.Path('/usr/bin/git'))==ids['gitSha256']
    return {'runtimes':values,'dependencyBytesMatched':True,'nodeAndGitMatched':True,'identities':ids}
def locks_and_owners():
    repository=(root/'fixture/repository').resolve()
    locks=[str(p.relative_to(repository)) for p in repository.rglob('*') if p.name=='gc.pid' or p.name.endswith('.lock')]
    owners=[]
    for p in pathlib.Path('/proc').glob('[0-9]*'):
        if int(p.name)==os.getpid(): continue
        try:
            cwd=os.readlink(p/'cwd'); cmd=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
            if cwd.startswith(str(repository)) or str(repository) in cmd: owners.append({'pid':int(p.name),'cwd':cwd,'command':cmd})
        except (FileNotFoundError,PermissionError,ProcessLookupError): pass
    result={'locks':locks,'knownPathOwners':owners,'scope':'readable cwd/cmdline; no universal race guarantee'}
    assert not locks and not owners, result
    return result
mode=sys.argv[1]
before=json.loads((sealed/'evidence/fixture-before.json').read_text())
if mode=='gate':
    record('continuation-gate-started',{'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'window':window})
    try:
        assert json.loads((evidence/'offline-final/verification.json').read_text())['passed'] is True
        manifest=sealed/'sealed-manifest.json'
        assert sha(manifest)=='7a738d42dcdb048a49be41d728506fae141dbfc9572c2853459464b89076559f'
        for item in json.loads(manifest.read_text())['files']: assert sha(sealed/item['path'])==item['sha256']
        record('runtime-before',identities())
        record('fixture-lock-ownership',locks_and_owners())
        fsck=subprocess.run(['git','-C',str((root/'fixture/repository').resolve()),'fsck','--full'],env=env,capture_output=True,text=True,timeout=120)
        record('fsck',{'exit':fsck.returncode,'stdout':fsck.stdout,'stderr':fsck.stderr})
        assert fsck.returncode==0 and all(line.startswith('dangling ') for line in (fsck.stdout+fsck.stderr).splitlines())
        observations=[]
        for ordinal in range(1,4):
            if ordinal>1: time.sleep(5)
            observations.append(fixture_snapshot('continuation-gate-'+str(ordinal)))
        assert all(item==before for item in observations), 'fixture changed from original sealed identity'
        record('fixture-before',before)
        assert sha(evidence/'fixture-before.json')=='5fe46369dacd20839c083f9b70c351e69febf367a571bc824f18875e796ddc7c'
        cfg={'command':str(nodebin/'node'),'args':['-e',"require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});setInterval(()=>{},1000)"],'cwd':str(root),'env':{},'seconds':2,'log':str(evidence/'external-preflight.log')}
        record('external-preflight-command',cfg)
        result=subprocess.run([str(nodebin/'node'),str(source/'experiments/otel-m2-disabled-rss/launch.cjs'),str(evidence/'external-preflight-command.json')],env=env,timeout=20)
        external=json.loads((evidence/'external-preflight.log.result.json').read_text())
        live=[]
        for p in pathlib.Path('/proc').glob('[0-9]*/stat'):
            try:
                data=p.read_text(); fields=data[data.rfind(')')+2:].split()
                if int(fields[2])==external['pid'] and fields[0]!='Z': live.append(int(p.parent.name))
            except FileNotFoundError: pass
        record('external-preflight-inspection',{'exit':result.returncode,'liveOwnedGroupMembers':live,'result':external})
        assert result.returncode==124 and external['signal']=='SIGKILL' and not live
        supervised('supervision-preflight',['preflight'],30)
        record('continuation-gate-result',{'passed':True,'snapshotSha256':sha(evidence/'fixture-before.json'),'originalOrdinals':[3,4,5,6],'window':window})
    except BaseException as error:
        record('continuation-gate-result',{'passed':False,'error':repr(error)})
        raise
elif mode=='runs':
    assert json.loads((evidence/'continuation-gate-result.json').read_text())['passed'] is True
    assert json.loads((evidence/'continuation-gate-command.json').read_text())['exit']==0
    remote=json.loads((evidence/'controller-remote-equality.json').read_text())
    assert remote['local']==remote['remote']==subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip()
    assert not subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=source,text=True).strip()
    record('continuation-entered',{'originalOrdinals':[3,4,5,6],'order':['V2','V2','V1','V0'],'budgetSeconds':1800,'oldInvocations':2,'window':window})
    (root/'runs').mkdir()
    assert fixture_snapshot('workload-start')==before
    started=time.time(); results=[]
    try:
        for ordinal,variant in [(3,'V2'),(4,'V2'),(5,'V1'),(6,'V0')]:
            remaining=1800-(time.time()-started)
            assert remaining>620 and time.time()+640<hard_stop
            record('pre-run-'+str(ordinal),{'identities':identities(),'ownership':locks_and_owners()})
            assert fixture_snapshot('before-'+str(ordinal))==before
            record('run-'+str(ordinal)+'-invocation',{'ordinal':ordinal,'variant':variant,'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()})
            print('Run',ordinal,variant,'start',flush=True)
            result=supervised('run-'+str(ordinal),['run',str(ordinal),variant],min(610,remaining))
            results.append(result)
            assert fixture_snapshot('after-'+str(ordinal))==before
            print('Run',ordinal,variant,'completed',json.loads((root/'runs'/str(ordinal)/'inspection.json').read_text())['peakBytes'],flush=True)
    finally:
        record('runs-return',{'results':results,'newInvocations':len(list((root/'runs').iterdir())),'oldInvocations':2,'elapsedSeconds':time.time()-started})
        assert fixture_snapshot('after')==before
        record('runtime-after',identities())
else: raise ValueError(mode)
