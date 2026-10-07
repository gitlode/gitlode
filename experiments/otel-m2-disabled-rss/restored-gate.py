"""One bounded restored-input gate; failure never regenerates or retries."""
import pathlib, json, subprocess, os, time, hashlib, datetime
from runtime_validation import validate_runtime

source=pathlib.Path(__file__).resolve().parents[2]
root=source.parents[1]
old=pathlib.Path('/home/t-wakabayashi/gitlode-performance/m2-rss-experiment-20261006T1106/archive')
evidence=root/'evidence'
env=os.environ.copy(); env.pop('NODE_OPTIONS',None)
env['PATH']=str(root/'node/node-v22.23.1-linux-x64/bin')+':/usr/bin:/bin'
env['GIT_OPTIONAL_LOCKS']='0'
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()
def inventory(path):
    return [{'path':str(p.relative_to(path)),'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(path.rglob('*')) if p.is_file() and not p.is_symlink()]
def record(name,value):
    (evidence/(name+'.json')).write_text(json.dumps(value,indent=2))
def live_group(pgid):
    result=[]
    for p in pathlib.Path('/proc').glob('[0-9]*/stat'):
        try:
            data=p.read_text(); fields=data[data.rfind(')')+2:].split()
            if int(fields[2])==pgid and fields[0]!='Z': result.append({'pid':int(p.parent.name),'state':fields[0]})
        except FileNotFoundError: pass
    return result
try:
    assert not (evidence/'gate-started.json').exists(), 'no gate retry'
    record('gate-started',{'utc':datetime.datetime.now(datetime.timezone.utc).isoformat()})
    ids=json.loads((old/'evidence/variant-identities.json').read_text())
    runtime_records=[]
    for item in ids['identities']:
        runtime_records.append(validate_runtime(root/'runtimes'/item['variant'], item, old/'fixed-variant-runtimes.tar.gz', source/'node_modules', '/home/t-wakabayashi/gitlode-performance/m2-rss-experiment-20261006T1106/checkout/source/node_modules'))
    record('runtime-layout-verification',runtime_records)
    dependencies=inventory(source/'node_modules')
    assert dependencies==json.loads((old/'evidence/dependency-before.json').read_text()), 'dependency bytes'
    record('dependency-before',dependencies)
    assert sha(root/'node/node-v22.23.1-linux-x64/bin/node')==ids['nodeSha256']
    assert sha(pathlib.Path('/usr/bin/git'))==ids['gitSha256']
    record('runtime-verification',{'versions':{k:subprocess.check_output(v,text=True,env=env).strip() for k,v in {'node':['node','--version'],'npm':['npm','--version'],'git':['git','--version']}.items()},'identities':ids,'runtimeHashesMatched':True,'dependencyHashesMatched':True})
    cfg={'command':str(root/'node/node-v22.23.1-linux-x64/bin/node'),'args':['-e',"require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});setInterval(()=>{},1000)"],'cwd':str(root),'env':{},'seconds':2,'log':str(evidence/'external-preflight.log')}
    record('external-preflight-command',cfg)
    start=time.time()
    result=subprocess.run(['node',str(source/'experiments/otel-m2-disabled-rss/launch.cjs'),str(evidence/'external-preflight-command.json')],env=env,timeout=20)
    external=json.loads((evidence/'external-preflight.log.result.json').read_text())
    live=live_group(external['pid'])
    record('external-preflight-inspection',{'exit':result.returncode,'elapsed':time.time()-start,'liveOwnedGroupMembers':live,'record':external})
    assert result.returncode==124 and external['signal']=='SIGKILL' and not live
    subprocess.run(['python3',str(source/'experiments/otel-m2-disabled-rss/control.py'),'preflight'],check=True,env=env,timeout=50)
    repository=root/'fixture/repository'
    assert not repository.exists()
    subprocess.run(['tar','-xzf',str(old/'prepared-fixture-at-return.tar.gz'),'-C',str(root/'fixture')],check=True,timeout=60)
    restored=inventory(repository)
    saved=json.loads((old/'evidence/fixture-return-inventory.json').read_text())
    record('archive-restored-inventory',{'restored':restored,'saved':saved,'equal':restored==saved,'fixtureTarSha256':sha(old/'prepared-fixture-at-return.tar.gz')})
    assert restored==saved, 'archive/restored inventory mismatch'
    locks=[str(p.relative_to(repository)) for p in repository.rglob('*') if p.name=='gc.pid' or p.name.endswith('.lock')]
    writers=[]
    for p in pathlib.Path('/proc').glob('[0-9]*'):
        if int(p.name)==os.getpid(): continue
        try:
            cwd=os.readlink(p/'cwd'); cmd=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
            if cwd.startswith(str(repository)) or str(repository) in cmd: writers.append({'pid':int(p.name),'cwd':cwd,'command':cmd})
        except (FileNotFoundError,PermissionError,ProcessLookupError): pass
    record('fixture-lock-ownership',{'locks':locks,'knownPathOwners':writers,'scope':'readable process cwd and cmdline; not universal race proof'})
    assert not locks and not writers, 'lock or ambiguous known owner'
    fsck=subprocess.run(['git','-C',str(repository),'fsck','--full'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=120)
    (evidence/'fsck.stdout.log').write_text(fsck.stdout); (evidence/'fsck.stderr.log').write_text(fsck.stderr)
    messages=(fsck.stdout+fsck.stderr).splitlines()
    dangling=[line for line in messages if line.startswith('dangling ')]
    other=[line for line in messages if not line.startswith('dangling ')]
    record('fsck-inspection',{'exit':fsck.returncode,'danglingMessages':dangling,'otherMessages':other})
    assert fsck.returncode==0 and not other, 'integrity check failure/unexpected messages'
    import runpy
    # Import the unchanged snapshot helper without executing its operator modes.
    code=(source/'experiments/otel-m2-disabled-rss/control.py').read_text().split('mode=sys.argv[1]')[0]
    scope={'__file__':str(source/'experiments/otel-m2-disabled-rss/control.py')}
    exec(compile(code,'control.py','exec'),scope)
    observations=[]
    for ordinal in range(1,4):
        if ordinal>1: time.sleep(5)
        observations.append(scope['fixture_snapshot']('gate-'+str(ordinal)))
    assert observations[0]==observations[1]==observations[2], 'three-inventory drift'
    assert observations[0]['head']=='bde84f1caca0e50284005bf96c126728dac4f9d4'
    previous=json.loads((old/'evidence/fixture-workload-start.json').read_text())
    assert observations[0]['localConfig']==previous['localConfig']
    (evidence/'fixture-before.json').write_text(json.dumps(observations[0],indent=2))
    identity=sha(evidence/'fixture-before.json')
    record('restored-gate-result',{'passed':True,'snapshotSha256':identity,'mapping':'saved post-generation return representation; not formal runtime fixture','sourceTarSha256':sha(old/'prepared-fixture-at-return.tar.gz'),'observations':3,'intervalSeconds':5})
    print('Restored fixture gate passed '+identity,flush=True)
except BaseException as error:
    record('restored-gate-result',{'passed':False,'error':repr(error),'stop':'no regeneration or gate retry; zero CLI workloads'})
    raise
