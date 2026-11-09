#!/usr/bin/env node
'use strict';
/**
 * Windows compatibility runner for B infra Playwright specs. No source/core changes.
 * Restores uppercase PATH in the environment passed to the child Node process.
 * Intentionally does NOT patch assertions, skip specs or add retries.
 * Run only for exploratory infra regression; B's task/profile execute flow remains authoritative.
 */
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
function stableEnv(source=process.env){
 const env={};let pathValue;
 for(const [key,value] of Object.entries(source)){
   if(key.toLowerCase()==='path'){
     if(pathValue===undefined || key==='PATH')pathValue=value;
   }else env[key]=value;
 }
 if(pathValue!==undefined)env.PATH=pathValue;
 return env;
}
const focusTargets={
 all:'tests/fe/infra',
 windows:'tests/fe/infra/gate-env.spec.ts',
 'windows-selftest':'tests/fe/infra/gate-selftest.spec.ts',
 env:'tests/fe/infra/env-signals.spec.ts',
 skills:'tests/fe/infra/skills-shim.spec.ts',
 routing:'tests/fe/infra/skills-route.spec.ts',
 start:'tests/fe/infra/start-command.spec.ts'
};
function run(){
 const arg=process.argv.slice(2);
 if(arg.includes('--help')){
   console.log('Usage: node enhancements/v9_1/run_infra.js [--focus all|windows|windows-selftest|env|skills|routing|start] [--workers 1|2|3|4]');
   return 0;
 }
 const focusAt=arg.indexOf('--focus');
 const workersAt=arg.indexOf('--workers');
 const focus=focusAt===-1?'all':arg[focusAt+1];
 const workers=workersAt===-1?'2':arg[workersAt+1];
 if(!Object.hasOwn(focusTargets,focus)|| !/^[1-4]$/.test(workers||'')){
   console.error('Invalid --focus or --workers argument; --help for usage');return 2;
 }
 let cli;
 for(const candidate of ['node_modules/playwright/cli.js','node_modules/@playwright/test/cli.js']){
  const p=path.join(root,candidate);if(fs.existsSync(p)){cli=p;break;}
 }
 if(!cli){console.error('Playwright dependency not installed. Run npm.cmd ci first.');return 2;}
 const env=stableEnv();
 const args=[cli,'test',focusTargets[focus],'--project=chromium-desktop','--reporter=line',`--workers=${workers}`];
 console.log(`[V9.1] Exploratory infra regression: ${focus}, workers=${workers}, no retry/skip injected.`);
 console.log(`[V9.1] PATH normalized: ${Object.hasOwn(env,'PATH')}; task verdict NOT authorized (PROJECT_OUTPUT_DIR may be missing).`);
 const child=spawnSync(process.execPath,args,{cwd:root,env,stdio:'inherit',windowsHide:false});
 if(child.error){console.error(child.error.message);return 2;}
 return typeof child.status==='number'?child.status:2;
}
if(require.main===module)process.exitCode=run();
module.exports={stableEnv,focusTargets};
