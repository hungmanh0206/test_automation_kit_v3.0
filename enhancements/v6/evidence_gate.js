#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {assess}=require('../v5/quality_check');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function verify(artifact,root){
 const structural=assess(artifact);const issues=[...structural.failures];
 if(artifact?.verdict!=='PASS')return {pass:issues.length===0,issues,scope:'non-PASS: structural checks only'};
 if(!Array.isArray(artifact.evidence))return {pass:false,issues:[...issues,'evidence must be an array']};
 for(const [i,item] of artifact.evidence.entries()){
  if(!item||typeof item!=='object'||Array.isArray(item)){issues.push(`evidence[${i}] must be an object with path and sha256`);continue;}
  if(typeof item.path!=='string'||!item.path||path.isAbsolute(item.path)||item.path.split(/[\\/]/).includes('..')){issues.push(`evidence[${i}] unsafe path`);continue;}
  if(!/^[a-f0-9]{64}$/i.test(item.sha256||'')){issues.push(`evidence[${i}] invalid sha256`);continue;}
  const absoluteRoot=fs.realpathSync(root), target=path.resolve(absoluteRoot,item.path);
  try{
   const actual=fs.realpathSync(target);
   if(!actual.startsWith(absoluteRoot+path.sep)){issues.push(`evidence[${i}] escapes evidence root`);continue;}
   if(!fs.statSync(actual).isFile()){issues.push(`evidence[${i}] not a file`);continue;}
   if(sha(fs.readFileSync(actual))!==item.sha256.toLowerCase())issues.push(`evidence[${i}] hash mismatch`);
  }catch{issues.push(`evidence[${i}] file missing or inaccessible`);}
 }
 if(artifact.evidence.length===0)issues.push('PASS requires evidence');
 return {pass:issues.length===0,issues,scope:'hash and filesystem verification only; does NOT prove execution, truth of verdict or provenance'};
}
module.exports={verify};
if(require.main===module){try{const [file,root]=process.argv.slice(2);if(!file||!root)throw Error('Usage: node evidence_gate.js artifact.json evidence-root');const result=verify(JSON.parse(fs.readFileSync(file,'utf8')),root);console.log(JSON.stringify(result,null,2));process.exitCode=result.pass?0:1;}catch(e){console.error(e.message);process.exitCode=2;}}
