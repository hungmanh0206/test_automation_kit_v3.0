'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {plan}=require('./plan'),{evaluate}=require('./evaluate'),manifest=require('./manifest.json');
const root=path.resolve(__dirname,'../..');
const ctx={requirements_available:true,testcases_available:true,approved_testcases:true,browser_available:true,target_framework_specified:true,dom_evidence_available:true};
test('five optional prompt packs exist and never alter canonical paths',()=>{assert.equal(manifest.packs.length,5);for(const p of manifest.packs){assert.match(p.path,/^enhancements\/v10\/packs\//);const s=fs.readFileSync(path.join(root,p.path),'utf8');for(const section of ['Activation','Task-specific method','Positive exemplar','Counterexample','Mandatory output contract','Handoff and stop conditions'])assert.ok(s.includes(section));assert.ok(s.includes('RULE_GLOBAL.md'));}});
const routing=[['FULL RBT','rbt'],['traceability coverage','coverage'],['manual execution','manual'],['appium framework architect','framework'],['locator xpath','locator']];
for(const [q,id] of routing)test(`context routing ${id}`,()=>{const out=plan(q,ctx);assert.equal(out.execution_authorized,false);assert.ok(out.chosen.some(x=>x.pack===id&&x.load_recommended));assert.ok(!out.load_all);});
test('preconditions BLOCK loading instead of bypassing gate',()=>{const o=plan('FULL RBT',{});assert.equal(o.chosen[0].load_recommended,false);assert.ok(o.chosen[0].missing_prerequisites.length);});
test('deep loads examples only when opted in',()=>{const standard=plan('FULL RBT',ctx),deep=plan('FULL RBT',ctx,{depth:'deep'});assert.ok(!standard.chosen[0].sections.includes('Counterexample'));assert.ok(deep.chosen[0].sections.includes('Counterexample'));});
test('unknown request never auto-loads every pack',()=>{const out=plan('the weather forecast',ctx);assert.equal(out.chosen.length,0);assert.equal(out.unmatched,true);});
const rbt={requirements:['REQ-1'],testcases:[{id:'TC-1',requirement_ids:['REQ-1'],steps:['click'],expected:'requires approval',risk:'HIGH',technique:'BVA'}],ambiguities:[],coverage_gaps:[],review_status:'PENDING'};
const coverage={requirements:['R1','R2'],testcases:['T1','T2'],links:[{requirement_id:'R1',testcase_id:'T1'}],uncovered_requirement_ids:['R2'],orphan_testcase_ids:['T2'],coverage_numerator:1,coverage_denominator:2,coverage_kind:'structural',evidence_refs:[]};
const manual={run_id:'R1',case_id:'T1',approved_case_version:'v1',environment:'staging',oracle_ref:'REQ-1',verdict:'PASS',steps:[{expected:'denied',actual:'denied',verified:true,evidence_refs:['e1']}],evidence_manifest:'sha256.json',blockers:[]};
const framework={source_framework:'Playwright',target_framework:'Appium',capability_matrix:[{feature:'login',status:'PROPOSED',evidence:[]}],migration_steps:['plan'],missing_dependencies:['appium'],rollback:['revert adapter'],validation_status:'PROPOSED'};
const locator={original_locator:'.old',proposed_locator:'[data-testid="submit"]',dom_evidence_ref:'dom.json',match_count:1,confidence_rationale:'stable ID',post_action_assertions:[{verified:true,oracle_ref:'REQ-1',evidence_refs:['e1']}],validation_status:'VERIFIED'};
for(const [kind,valid,breakIt] of [
 ['rbt',rbt,x=>x.testcases[0].requirement_ids=['R-MISSING']],
 ['coverage',coverage,x=>x.coverage_numerator=2],
 ['manual',manual,x=>x.steps[0].evidence_refs=[]],
 ['framework',framework,x=>x.validation_status='VERIFIED'],
 ['locator',locator,x=>x.match_count=2]]){
 test(`${kind} positive contract accepted`,()=>assert.equal(evaluate(kind,valid).pass,true));
 test(`${kind} mutation negative rejected`,()=>{const invalid=structuredClone(valid);breakIt(invalid);assert.equal(evaluate(kind,invalid).pass,false);});
}
test('all packs remain separate from canonical Kit B skill trees',()=>{for(const p of manifest.packs)assert.ok(!p.path.startsWith('.agent/skills/'));});
test('every referenced source guide from Kit A exists',()=>{const m=JSON.parse(fs.readFileSync(path.join(root,'.agent/extensions/kit-a/manifest.json')));for(const e of m.extensions)assert.ok(fs.existsSync(path.join(root,'.agent/extensions/kit-a/source-references',e.source,'SOURCE_GUIDE.md')));});
test('evaluator does not accept empty artifacts as PASS',()=>{for(const p of manifest.packs)assert.equal(evaluate(p.id,{}).pass,false);});
