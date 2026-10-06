import pathlib, json, hashlib, subprocess, datetime, os

root=pathlib.Path('/home/t-wakabayashi/gitlode-performance/m2-rss-experiment-20261006T1106')
source=root/'checkout/source'
identities=[]
for variant,folder in [('V0','V0-probe-correction1'),('V1','V1'),('V2','V2')]:
    path=root/'evidence'/folder/'runtime-identity.json'
    identity=json.loads(path.read_text())
    identity['identityFileSha256']=hashlib.sha256(path.read_bytes()).hexdigest()
    identities.append(identity)
node=root/'node/node-v22.23.1-linux-x64/bin/node'
npm=root/'node/node-v22.23.1-linux-x64/bin/npm'
env=os.environ.copy();env['PATH']=str(node.parent)+':/usr/bin:/bin'
versions={'node':subprocess.check_output([str(node),'--version'],text=True).strip(),'npm':subprocess.check_output([str(npm),'--version'],text=True,env=env).strip(),'git':subprocess.check_output(['git','--version'],text=True).strip()}
assert versions=={'node':'v22.23.1','npm':'10.9.8','git':'git version 2.53.0'}
record={'identities':identities,'versions':versions,'nodeSha256':hashlib.sha256(node.read_bytes()).hexdigest(),'gitSha256':hashlib.sha256(pathlib.Path('/usr/bin/git').read_bytes()).hexdigest(),'kernel':subprocess.check_output(['uname','-a'],text=True).strip(),'fixtureManifestSha256':hashlib.sha256((root/'manifest.json').read_bytes()).hexdigest(),'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'environmentNodeOptions':os.environ.get('NODE_OPTIONS'),'releaseMode':'npm run build:release; no subsequent build:dev','observer':'unchanged sampleChildRss at fixed base, default 20 ms'}
(root/'evidence/variant-identities.json').write_text(json.dumps(record,indent=2))
lines=['# Fixed variant identities','', '| Variant | Source OID | Build product OID | Runtime inventory SHA-256 |','| --- | --- | --- | --- |']
for item in identities:
    lines.append(f"| {item['variant']} | `{item['oid']}` | `{item['buildProductOid']}` | `{item['identityFileSha256']}` |")
lines.extend(['','Runtime inventories and raw evidence:','`/home/t-wakabayashi/gitlode-performance/m2-rss-experiment-20261006T1106/evidence/`.','Three independent dist directories under sibling `runtimes/V0`, `V1`, `V2` use','one unchanged restored dependency closure. No build occurs during CLI runs.','The V0 probe correction changes preparation scripts only; its product build','is exactly the previously saved b487272 source.','', 'V2 uses an API-only disabled session object in place of the original class;','empty SDK-adapter finalization calls are omitted, while nonrecording root/context,','idempotent finalization and application-result behavior are verified. This is','an additional lifecycle/layout confounder of the import contrast. API no-op','spans have invalid IDs; SDK AlwaysOff spans have valid non-sampled IDs.','Neither path records spans or metrics.','', 'Setup corrections retain original logs: V0 span-ID probe correction, one','shell quoting error before correction, and an uncompleted WSL push followed','by the successful normal Windows Git push. No CLI run was repeated.',''])
(source/'experiments/otel-m2-disabled-rss/identities.md').write_text('\n'.join(lines))
print(json.dumps(versions))
