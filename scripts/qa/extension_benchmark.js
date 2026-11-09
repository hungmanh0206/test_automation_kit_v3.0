#!/usr/bin/env node
'use strict';
// Deterministic smoke benchmark, NOT an LLM quality benchmark.
const {route}=require('./extension_router');
const cases=[
 ['FULL RBT','rbt_workflow_extension'],['kiểm tra traceability','coverage_audit_extension'],
 ['manual execution','manual_execution_extension'],['Appium migration','framework_portability_extension'],
 ['locator healing','locator_portability_extension'],['database migration',null],['financial forecasting',null]
];
let correct=0;const results=[];
for(const [input,expected] of cases){const r=route(input);const got=r.matches.map(x=>x.extension);const ok=expected?got.includes(expected):got.length===0;correct+=Number(ok);results.push({input,expected,got,ok});}
const output={benchmark:'deterministic routing smoke test',date:'not recorded',passed:correct,total:cases.length,accuracy:correct/cases.length,limitations:['Hand-authored small fixture set','Not semantic routing benchmark','No live browser or LLM execution'],results};
console.log(JSON.stringify(output,null,2));if(correct!==cases.length)process.exitCode=1;
