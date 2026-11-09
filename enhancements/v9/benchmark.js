#!/usr/bin/env node
'use strict';
// Deterministic contract benchmark; NOT a model-quality or E2E benchmark.
const fs=require('node:fs'),path=require('node:path');
const {assess}=require('../v5/quality_check.js');
const {validate}=require('../v7/workflow.js');
const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures.json'),'utf8'));
const results=[];
for(const c of fixtures){
 let accepted=false,reason='';
 try{
  if(c.kind==='artifact'){const out=assess(c.payload);accepted=out.pass;reason=out.failures.join('; ')}
  else if(c.kind==='workflow'){validate(c.stage,c.payload);accepted=true;}
  else throw Error('unknown kind');
 }catch(e){reason=e.message;}
 results.push({id:c.id,kind:c.kind,expected_accept:c.expected_accept,actual_accept:accepted,correct:c.expected_accept===accepted,reason});
}
const tp=results.filter(x=>!x.expected_accept&&!x.actual_accept).length;
const fn=results.filter(x=>!x.expected_accept&&x.actual_accept).length;
const tn=results.filter(x=>x.expected_accept&&!x.actual_accept).length;
const pp=results.filter(x=>x.expected_accept&&x.actual_accept).length;
const report={scope:'Deterministic validator contracts only; not model skill quality, not real test evidence',cases:results.length,correct:results.filter(x=>x.correct).length,negative_rejected:tp,negative_accepted:fn,positive_rejected:tn,positive_accepted:pp,results};
const out=process.argv[2];if(out)fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({cases:report.cases,correct:report.correct,negative_rejected:tp,negative_accepted:fn,positive_rejected:tn,positive_accepted:pp},null,2));
if(report.correct!==report.cases)process.exitCode=1;
