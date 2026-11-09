#!/usr/bin/env node
'use strict';
// Advisory deterministic routing. Never executes tools, changes artifacts, or overrides gates.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root,'.agent/extensions/kit-a/manifest.json'),'utf8'));
const ROUTES = [
 {id:'rbt_workflow_extension', owner:'tc_design_guide', phase:'phase1', pattern:/\b(rbt|risk.based testing|checklist|test design)\b|kiểm thử dựa trên rủi ro|thiết kế testcase/i, prerequisites:['requirements_available'], gates:['ambiguity','risk','testcase_review']},
 {id:'coverage_audit_extension', owner:'tc_reviewer', phase:'phase1', pattern:/\b(rtm|traceability|coverage|orphan tests?)\b|truy vết|độ bao phủ/i, prerequisites:['requirements_available','testcases_available'], gates:['traceability']},
 {id:'manual_execution_extension', owner:'qa_automation_engineer', phase:'phase2', pattern:/\b(manual execution|manual test|browser execution)\b|chạy test thủ công|kiểm thử thủ công/i, prerequisites:['approved_testcases','browser_available'], gates:['execution_evidence','oracle']},
 {id:'framework_portability_extension', owner:'qa_automation_engineer', phase:'shared', pattern:/\b(selenium|appium|framework architect|framework migration)\b|kiến trúc framework/i, prerequisites:['target_framework_specified'], gates:['architecture_review']},
 {id:'locator_portability_extension', owner:'locator_healing_agent', phase:'phase2', pattern:/\b(locator|xpath|css selector|element healing)\b|sửa locator|định vị phần tử/i, prerequisites:['dom_evidence_available'], gates:['locator_validation']}
];
function route(request, context={}) {
 if(typeof request!=='string'||!request.trim()) throw new Error('request must be non-empty string');
 const matches=ROUTES.filter(r=>r.pattern.test(request)).map(r=>{
  const missing=r.prerequisites.filter(p=>context[p]!==true);
  const entry=manifest.extensions.find(e=>e.skill===r.id);
  return {extension:r.id,owner:r.owner,phase:r.phase,status:missing.length?'BLOCKED_PREREQUISITES':'READY_FOR_REVIEW',missing_prerequisites:missing,required_gates:r.gates,adapter_path:entry.adapter_path};
 });
 return {policy_authority:'RULE_GLOBAL.md',execution_authorized:false,verdict:'NOT_EXECUTED',matches,unmatched:matches.length===0,warning:'Advisory routing only. Validate canonical rules, artifacts, phase ownership and gates before execution.'};
}
module.exports={route,ROUTES};
if(require.main===module){
 const args=process.argv.slice(2);
 if(args.includes('--help')) {console.log('Usage: node scripts/qa/extension_router.js "request" [--context path/to/context.json]');process.exit(0);}
 const ix=args.indexOf('--context');
 let context={};
 if(ix>=0){if(!args[ix+1])throw new Error('missing context path');context=JSON.parse(fs.readFileSync(path.resolve(args[ix+1]),'utf8'));args.splice(ix,2);}
 console.log(JSON.stringify(route(args.join(' '),context),null,2));
}
