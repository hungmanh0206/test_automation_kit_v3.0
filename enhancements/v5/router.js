#!/usr/bin/env node
'use strict';
// Advisory multilingual intent ranking. No model inference, tool execution or gate bypass.
const fs=require('node:fs');
const path=require('node:path');
const DEFINITIONS=[
 {id:'rbt_workflow_extension',owner:'tc_design_guide',phase:'phase1',positive:['rbt','risk based testing','risk-based testing','test design','thiết kế testcase','thiet ke testcase','kiểm thử dựa trên rủi ro','kiem thu dua tren rui ro','risk matrix','ma trận rủi ro','checklist kiểm thử'],negative:['load test','performance test'],requires:['requirements_available'],gates:['ambiguity','risk','testcase_review']},
 {id:'coverage_audit_extension',owner:'tc_reviewer',phase:'phase1',positive:['traceability','coverage','rtm','orphan test','orphan tests','requirement mapping','truy vết','truy vet','độ bao phủ','do bao phu','ma trận truy vết'],negative:['code coverage instrumentation'],requires:['requirements_available','testcases_available'],gates:['traceability']},
 {id:'manual_execution_extension',owner:'qa_automation_engineer',phase:'phase2',positive:['manual execution','manual test','browser execution','chạy test thủ công','chay test thu cong','kiểm thử thủ công','kiem thu thu cong','thực thi testcase bằng tay'],negative:['manual review of code'],requires:['approved_testcases','browser_available'],gates:['execution_evidence','oracle']},
 {id:'framework_portability_extension',owner:'qa_automation_engineer',phase:'shared',positive:['selenium','appium','framework architect','framework migration','kiến trúc framework','kien truc framework','migrate playwright','chuyển framework'],negative:['database migration'],requires:['target_framework_specified'],gates:['architecture_review']},
 {id:'locator_portability_extension',owner:'locator_healing_agent',phase:'phase2',positive:['locator','xpath','css selector','element healing','sửa locator','sua locator','định vị phần tử','dinh vi phan tu','selector bị hỏng'],negative:['gps locator','location services'],requires:['dom_evidence_available'],gates:['locator_validation']}
];
function normalize(x){return x.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function phrase(text,term){let t=normalize(term);return (' '+text+' ').includes(' '+t+' ');}
function route(request,context={}){
 if(typeof request!=='string'||!request.trim())throw Error('non-empty request required');
 if(context===null||typeof context!=='object'||Array.isArray(context))throw Error('context must be object');
 const normalized=normalize(request);const matches=[];
 for(const d of DEFINITIONS){const hits=d.positive.filter(p=>phrase(normalized,p));const negatives=d.negative.filter(p=>phrase(normalized,p));if(!hits.length||negatives.length)continue;
 const missing=d.requires.filter(k=>context[k]!==true);matches.push({extension:d.id,owner:d.owner,phase:d.phase,score:Math.min(1,0.6+0.15*(hits.length-1)),matched_terms:hits,missing_prerequisites:missing,required_gates:d.gates,status:missing.length?'BLOCKED_PREREQUISITES':'READY_FOR_REVIEW'});}
 matches.sort((a,b)=>b.score-a.score||a.extension.localeCompare(b.extension));
 return {policy_authority:'RULE_GLOBAL.md',execution_authorized:false,verdict:'NOT_EXECUTED',routing_mode:'deterministic_multilingual_advisory',needs_clarification:matches.length===0||matches.length>1,matches,unmatched:matches.length===0,warning:'This is lexical intent matching, NOT LLM semantic inference. Canonical rules and gates remain authoritative.'};
}
module.exports={route,DEFINITIONS,normalize};
if(require.main===module){const args=process.argv.slice(2);let context={};const i=args.indexOf('--context');if(i>=0){if(!args[i+1])throw Error('context path required');context=JSON.parse(fs.readFileSync(path.resolve(args[i+1]),'utf8'));args.splice(i,2);}if(!args.length){console.error('Usage: node enhancements/v5/router.js "request" [--context context.json]');process.exit(2);}console.log(JSON.stringify(route(args.join(' '),context),null,2));}
