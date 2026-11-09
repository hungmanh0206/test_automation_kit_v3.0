#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const kinds=new Set(['rbt','coverage','manual','framework','locator']);
const has=(x)=>typeof x==='string'&&x.trim().length>0;
const arr=(x)=>Array.isArray(x);
function evaluate(kind,a){
 if(!kinds.has(kind))throw Error('unsupported pack');
 const problems=[],checks=[];const check=(ok,msg)=>{checks.push({ok:!!ok,check:msg});if(!ok)problems.push(msg);};
 check(a!==null&&typeof a==='object'&&!Array.isArray(a),'artifact must be JSON object');if(problems.length)return {kind,pass:false,problems,checks,limitations:['No semantic correctness claim']};
 if(kind==='rbt'){
 check(arr(a.requirements)&&a.requirements.length>0,'requirements list required');check(arr(a.testcases)&&a.testcases.length>0,'testcases required');check(arr(a.ambiguities),'ambiguities list required');check(arr(a.coverage_gaps),'coverage_gaps list required');check(has(a.review_status),'review_status required');
 const req=new Set((a.requirements||[]).map(r=>typeof r==='string'?r:r?.id));
 for(const [i,t] of (a.testcases||[]).entries()){check(has(t?.id),`testcases[${i}].id`);check(arr(t?.requirement_ids)&&t.requirement_ids.length>0&&t.requirement_ids.every(r=>req.has(r)),`testcases[${i}] linked existing requirements`);check(arr(t?.steps)&&t.steps.length>0,`testcases[${i}].steps`);check(has(t?.expected),`testcases[${i}].expected`);check(has(t?.risk),`testcases[${i}].risk`);check(has(t?.technique),`testcases[${i}].technique`);}
 }else if(kind==='coverage'){
 check(arr(a.requirements)&&a.requirements.length>0,'requirements required');check(arr(a.testcases),'testcases required');check(arr(a.links),'links required');check(arr(a.uncovered_requirement_ids),'uncovered ids required');check(arr(a.orphan_testcase_ids),'orphan ids required');check(['structural','runtime'].includes(a.coverage_kind),'coverage_kind must be structural or runtime');
 const req=new Set((a.requirements||[]).map(r=>typeof r==='string'?r:r?.id)),tc=new Set((a.testcases||[]).map(r=>typeof r==='string'?r:r?.id));const valid=(a.links||[]).filter(l=>req.has(l?.requirement_id)&&tc.has(l?.testcase_id));check(valid.length===(a.links||[]).length,'links refer to existing requirement and testcase');const covered=new Set(valid.map(l=>l.requirement_id));const orphans=[...tc].filter(t=>!valid.some(l=>l.testcase_id===t));const missing=[...req].filter(r=>!covered.has(r));check(JSON.stringify([...missing].sort())===JSON.stringify([...(a.uncovered_requirement_ids||[])].sort()),'uncovered ids exact');check(JSON.stringify([...orphans].sort())===JSON.stringify([...(a.orphan_testcase_ids||[])].sort()),'orphan IDs exact');check(a.coverage_numerator===covered.size&&a.coverage_denominator===req.size,'coverage arithmetic matches links');check(a.coverage_kind!=='runtime'||(arr(a.evidence_refs)&&a.evidence_refs.length>0),'runtime coverage requires evidence references');
 }else if(kind==='manual'){
 check(has(a.run_id),'run_id');check(has(a.case_id),'case_id');check(has(a.approved_case_version),'approved case version');check(has(a.environment),'environment');check(has(a.oracle_ref),'independent oracle ref');check(['PASS','FAIL','INCONCLUSIVE'].includes(a.verdict),'valid verdict');check(arr(a.steps)&&a.steps.length>0,'steps');check(arr(a.blockers),'blockers list');
 if(a.verdict==='PASS'){check(a.blockers?.length===0,'PASS cannot have blockers');check(has(a.evidence_manifest),'PASS requires evidence manifest');check(a.steps?.every(s=>has(s.expected)&&has(s.actual)&&s.verified===true&&arr(s.evidence_refs)&&s.evidence_refs.length>0),'PASS requires verified steps, actual, expected and evidence');}
 }else if(kind==='framework'){
 check(has(a.source_framework)&&has(a.target_framework),'source and target frameworks');check(arr(a.capability_matrix)&&a.capability_matrix.length>0,'capability_matrix');check(arr(a.migration_steps)&&a.migration_steps.length>0,'migration_steps');check(arr(a.missing_dependencies),'missing_dependencies list');check(arr(a.rollback)&&a.rollback.length>0,'rollback plan');check(['PROPOSED','PARTIAL','VERIFIED'].includes(a.validation_status),'validation_status');if(a.validation_status==='VERIFIED')check(a.capability_matrix?.every(x=>x.status==='VERIFIED'&&arr(x.evidence)&&x.evidence.length>0),'VERIFIED requires evidence per capability');
 }else if(kind==='locator'){
 check(has(a.original_locator),'original locator');check(has(a.proposed_locator),'proposed locator');check(has(a.dom_evidence_ref),'DOM evidence reference');check(Number.isInteger(a.match_count)&&a.match_count>=0,'valid match_count');check(has(a.confidence_rationale),'confidence rationale');check(arr(a.post_action_assertions),'post-action assertions list');check(['PROPOSED','BLOCKED','VERIFIED'].includes(a.validation_status),'validation_status');if(a.validation_status==='VERIFIED'){check(a.match_count===1,'VERIFIED must have unique selector');check(a.post_action_assertions?.length>0&&a.post_action_assertions.every(x=>x.verified===true&&has(x.oracle_ref)&&arr(x.evidence_refs)&&x.evidence_refs.length>0),'VERIFIED post-action assertions require oracle and evidence');}
 }
 return {kind,pass:problems.length===0,checks,problems,limitations:['Structural validator: does not call AI, prove evidence origin or validate semantic oracle. No production score calculated.']};
}
module.exports={evaluate};
if(require.main===module){const [kind,file]=process.argv.slice(2);if(!file){console.error('Usage: node enhancements/v10/evaluate.js <rbt|coverage|manual|framework|locator> artifact.json');process.exit(2);}const result=evaluate(kind,JSON.parse(fs.readFileSync(file,'utf8')));console.log(JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;}
