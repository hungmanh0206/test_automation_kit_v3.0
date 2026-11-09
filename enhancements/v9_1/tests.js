'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {stableEnv,focusTargets}=require('./run_infra');
const root=path.resolve(__dirname,'../..');
const manifest=require('../../.agent/extensions/kit-a/manifest.json');
test('Windows Path normalized to uppercase PATH without losing content',()=>{
 const env=stableEnv({Path:'C:\\Windows\\System32',FOO:'bar'});
 assert.equal(env.PATH,'C:\\Windows\\System32');
 assert.equal(Object.hasOwn(env,'Path'),false);
 assert.equal(env.FOO,'bar');
});
test('explicit uppercase PATH wins mixed-case source',()=>{
 const env=stableEnv({PATH:'C:\\A',Path:'C:\\B'});
 assert.equal(env.PATH,'C:\\A');assert.equal(Object.keys(env).filter(k=>k.toLowerCase()==='path').length,1);
});
test('runner does not alter policy/task scoped environment values',()=>{
 const env=stableEnv({Path:'X',CI:'true',TASK_KEY:'T-1',PROJECT_OUTPUT_DIR:'output'});
 assert.equal(env.CI,'true');assert.equal(env.TASK_KEY,'T-1');assert.equal(env.PROJECT_OUTPUT_DIR,'output');
});
test('runner has explicit focus targets for each failure family',()=>{
 for(const name of ['all','env','skills','routing','start','windows','windows-selftest'])assert.ok(focusTargets[name]);
});
test('exactly 5 optional adapters live outside canonical .agent/skills',()=>{
 assert.equal(manifest.extensions.length,5);
 for(const e of manifest.extensions){
  assert.ok(e.adapter_path.startsWith('.agent/extensions/kit-a/adapters/'));
  assert.ok(fs.existsSync(path.join(root,e.adapter_path)));
  assert.equal(fs.existsSync(path.join(root,'.agent/skills',e.phase,e.skill,'SKILL.md')),false);
 }
});
test('old canonical skill and Claude shim trees have 28 SKILL.md each',()=>{
 let n=0;const walk=(p)=>{for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())walk(f);else if(e.name==='SKILL.md')n++;}};
 walk(path.join(root,'.agent/skills'));assert.equal(n,28);
 n=0;walk(path.join(root,'.claude/skills'));assert.equal(n,28);
});
test('router resolves only opt-in adapter paths and does not execute',()=>{
 const {route}=require('../../scripts/qa/extension_router');
 const r=route('FULL RBT',{requirements_available:true});
 assert.equal(r.execution_authorized,false);
 assert.equal(r.matches[0].adapter_path,manifest.extensions[0].adapter_path);
});
