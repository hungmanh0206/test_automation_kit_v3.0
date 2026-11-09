#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {route}=require('../v5/router');
const manifest=require('./manifest.json');
const root=path.resolve(__dirname,'../..');
function plan(request,context={},options={}){
 if(!['standard','deep'].includes(options.depth||'standard'))throw Error('depth must be standard or deep');
 const result=route(request,context);const chosen=[];
 for(const match of result.matches){const pack=manifest.packs.find(p=>p.extension===match.extension);if(!pack)throw Error('unmapped extension '+match.extension);
  const p=path.join(root,pack.path),real=fs.realpathSync(p);if(!real.startsWith(path.join(root,'enhancements/v10/packs')+path.sep))throw Error('pack path outside allowed directory');
  const content=fs.readFileSync(real,'utf8');const load=match.status==='READY_FOR_REVIEW';
  chosen.push({pack:pack.id,owner:pack.owner,extension:match.extension,status:match.status,missing_prerequisites:match.missing_prerequisites,source_sha256:crypto.createHash('sha256').update(content).digest('hex'),path:pack.path,load_recommended:load,sections:load?(options.depth==='deep'?['Activation','Inputs and evidence','Task-specific method','Positive exemplar','Counterexample','Mandatory output contract','Handoff and stop conditions']:['Activation','Inputs and evidence','Task-specific method','Mandatory output contract','Handoff and stop conditions']):[],gates:match.required_gates});
 }
 return {request,depth:options.depth||'standard',execution_authorized:false,verdict:'NOT_EXECUTED',policy_authority:'RULE_GLOBAL.md',routing_mode:result.routing_mode,needs_clarification:result.needs_clarification,load_all:false,chosen,unmatched:result.unmatched,warning:'Plan is advisory; examples are not evidence. No model inference or token savings measured.'};
}
module.exports={plan};
if(require.main===module){const argv=process.argv.slice(2);let ctx={},depth='standard';for(let i=0;i<argv.length;){if(argv[i]==='--context'){ctx=JSON.parse(fs.readFileSync(argv[i+1],'utf8'));argv.splice(i,2);}else if(argv[i]==='--depth'){depth=argv[i+1];argv.splice(i,2);}else i++;}if(!argv.length){console.error('Usage: node enhancements/v10/plan.js "request" [--context file.json] [--depth deep]');process.exit(2);}console.log(JSON.stringify(plan(argv.join(' '),ctx,{depth}),null,2));}
