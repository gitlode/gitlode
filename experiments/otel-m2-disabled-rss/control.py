import pathlib, json, os, subprocess, datetime, time, hashlib, sys

source = pathlib.Path(__file__).resolve().parents[2]
root = source.parents[1]
nodebin = root/'node/node-v22.23.1-linux-x64/bin'
env = os.environ.copy(); env.pop('NODE_OPTIONS', None)
env.update(PATH=str(nodebin)+':/usr/bin:/bin',TMPDIR=str(root/'tmp'),TMP=str(root/'tmp'),TEMP=str(root/'tmp'),npm_config_cache=str(root/'npm-cache'))
hard_stop = datetime.datetime.fromisoformat('2026-10-06T14:06:00+09:00').timestamp()
def command(args):
    return [str(nodebin/'node'), str(source/'node_modules/tsx/dist/cli.mjs'), str(source/'experiments/otel-m2-disabled-rss/supervise.mts'), *args]
def supervised(label, args, limit):
    assert time.time()+limit+30 < hard_stop, 'insufficient operator window'
    path=root/'evidence'/(label+'.log')
    assert not path.exists(), 'no retry'
    started=time.time()
    with path.open('wb') as log:
        child=subprocess.Popen(command(args),cwd=source,env=env,stdout=log,stderr=subprocess.STDOUT)
        interrupted=False
        try: code=child.wait(timeout=limit)
        except subprocess.TimeoutExpired:
            interrupted=True; child.terminate()
            try: code=child.wait(timeout=15)
            except subprocess.TimeoutExpired:
                child.kill(); code=child.wait(timeout=5)
                (root/'evidence'/(label+'-cleanup-uncertain.json')).write_text(json.dumps({'pid':child.pid,'reason':'supervisor did not complete cleanup after operator SIGTERM'},indent=2))
        record={'args':command(args),'pid':child.pid,'exit':code,'operatorInterrupted':interrupted,'elapsedSeconds':time.time()-started,'startedUtc':datetime.datetime.fromtimestamp(started,datetime.timezone.utc).isoformat()}
        (root/'evidence'/(label+'.result.json')).write_text(json.dumps(record,indent=2))
    assert not interrupted and code==0, label
    return record
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def inventory(path):
    return [{'path':str(p.relative_to(path)), 'sha256':sha(p), 'bytes':p.stat().st_size} for p in sorted(path.rglob('*')) if p.is_file() and not p.is_symlink()]
def fixture_snapshot(label):
    repository=root/'fixture/repository'
    def git(args):return subprocess.check_output(['git','-C',str(repository),*args],text=True,env=env).strip()
    record={'inventory':inventory(repository),'head':git(['rev-parse','HEAD']),'count':git(['rev-list','--all','--count']),'objectLayout':git(['count-objects','-v']),'localConfig':git(['config','--local','--list']),'filesystem':subprocess.check_output(['findmnt','-T',str(repository),'-o','TARGET,SOURCE,FSTYPE,OPTIONS'],text=True).strip()}
    (root/'evidence'/('fixture-'+label+'.json')).write_text(json.dumps(record,indent=2))
    assert record['count']=='4430' and 'ext4' in record['filesystem']
    return record
mode=sys.argv[1]
if mode=='preflight':
    supervised('supervision-preflight', ['preflight'], 30)
elif mode=='prepare':
    supervised('fixture-prepare', ['prepare'], 1800)
    fixture_snapshot('before')
    (root/'evidence/dependency-before.json').write_text(json.dumps(inventory(source/'node_modules'),indent=2))
elif mode=='runs':
    assert not (root/'evidence/runs-started.json').exists(), 'no retry'
    assert (root/'evidence/supervision-preflight.result.json').exists()
    (root/'runs').mkdir()
    order=['V0','V1','V2','V2','V1','V0']; started=time.time()
    (root/'evidence/runs-started.json').write_text(json.dumps({'started':started,'order':order,'budgetSeconds':1800},indent=2))
    before=json.loads((root/'evidence/fixture-before.json').read_text())
    assert fixture_snapshot('workload-start')==before
    results=[]
    try:
        for ordinal,variant in enumerate(order,1):
            remaining=1800-(time.time()-started)
            assert remaining>620, 'insufficient remaining workload budget'
            print('Run',ordinal,variant,'start',datetime.datetime.now(datetime.timezone.utc).isoformat(),flush=True)
            result=supervised('run-'+str(ordinal), ['run',str(ordinal),variant], min(610,remaining))
            results.append(result)
            assert fixture_snapshot('after-'+str(ordinal))==before, 'fixture changed'
            inspection=json.loads((root/'runs'/str(ordinal)/'inspection.json').read_text())
            print('Run',ordinal,variant,'completed',inspection['elapsedMs'],inspection['peakBytes'],flush=True)
    finally:
        (root/'evidence/runs-return.json').write_text(json.dumps({'results':results,'elapsedSeconds':time.time()-started,'executed':len(list((root/'runs').glob('*')))},indent=2))
        fixture_snapshot('after')
        dependency_after=inventory(source/'node_modules')
        (root/'evidence/dependency-after.json').write_text(json.dumps(dependency_after,indent=2))
        assert dependency_after==json.loads((root/'evidence/dependency-before.json').read_text()),'dependency bytes changed'
else: raise ValueError(mode)
