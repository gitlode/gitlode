const cp=require('node:child_process'),fs=require('node:fs');
if(process.env.NODE_OPTIONS)throw Error('Outer launcher must have no preload');
const cfg=JSON.parse(fs.readFileSync(process.argv[2]));
const fd=fs.openSync(cfg.log,'w'),start=new Date().toISOString();
const child=cp.spawn(cfg.command,cfg.args,{cwd:cfg.cwd,env:{...process.env,...cfg.env},stdio:['ignore',fd,fd],windowsHide:true,detached:process.platform!=='win32'});
let timedOut=false,error=null,cleanup=null;
const timer=setTimeout(()=>{timedOut=true; if(process.platform==='win32')cleanup=cp.spawnSync('taskkill',['/pid',String(child.pid),'/t','/f'],{encoding:'utf8',timeout:30000,windowsHide:true});else {try{process.kill(-child.pid,'SIGKILL');cleanup={status:0};}catch(e){cleanup={error:String(e)};}}},cfg.seconds*1000);
child.on('error',e=>error=String(e));
child.on('close',(code,signal)=>{clearTimeout(timer);fs.closeSync(fd);fs.writeFileSync(cfg.log+'.result.json',JSON.stringify({cfg,start,end:new Date().toISOString(),pid:child.pid,code,signal,timedOut,error,cleanup},null,2));process.exitCode=timedOut?124:code??125;});
