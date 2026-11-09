#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {route}=require('./router');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'routing_cases.json'),'utf8'));
let exact=0,tp=0,fp=0,fn=0;const failures=[];
for(const c of data.cases){const got=route(c.input).matches.map(x=>x.extension).sort();const want=[...c.expected].sort();if(JSON.stringify(got)===JSON.stringify(want))exact++;else failures.push({input:c.input,expected:want,actual:got});for(const id of got){if(want.includes(id))tp++;else fp++;}for(const id of want)if(!got.includes(id))fn++;}
const report={suite:'curated lexical regression, NOT semantic AI benchmark',total:data.cases.length,exact,exact_accuracy:exact/data.cases.length,precision:tp/(tp+fp||1),recall:tp/(tp+fn||1),failures,limitations:['Cases are hand-curated and may overlap router vocabulary','No external model called','No token/latency measurement','Not a held-out production evaluation']};
const outfile=process.argv[2];if(outfile)fs.writeFileSync(path.resolve(outfile),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
