#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const STAGES=['requirements','ambiguity','risk','testcase','review','automation','execution','evidence','verdict','report'];
const REQUIRED={requirements:['requirement_ids','source'],ambiguity:['resolved','notes'],risk:['risk_ids','assessment'],testcase:['cases'],review:['approved','reviewer'],automation:['artifact_path','framework'],execution:['run_id','status'],evidence:['items'],verdict:['result','oracle'],report:['report_path','summary']};
const isNonempty=v=>typeof v==='string'?v.trim().length>0:Array.isArray(v)?v.length>0:v!==undefined&&v!==null;
function validate(stage,data){if(!STAGES.includes(stage))throw Error('Unknown stage: '+stage);if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Stage data must be object');const missing=REQUIRED[stage].filter(k=>!isNonempty(data[k]));if(missing.length)throw Error('Missing '+stage+': '+missing.join(','));
 if(stage==='requirements'&&(!Array.isArray(data.requirement_ids)||!data.requirement_ids.every(isNonempty)))throw Error('Invalid requirement_ids');
 if(stage==='ambiguity'&&data.resolved!==true)throw Error('Ambiguity unresolved');
 if(stage==='risk'&&(!Array.isArray(data.risk_ids)||!data.risk_ids.every(isNonempty)))throw Error('Invalid risk_ids');
 if(stage==='testcase'&&(!Array.isArray(data.cases)||data.cases.some(c=>!c||!isNonempty(c.id)||!isNonempty(c.requirement_id)||!isNonempty(c.expected_result))))throw Error('Testcase contract violation');
 if(stage==='review'&&data.approved!==true)throw Error('Testcase review not approved');
 if(stage==='execution'&&!['PASS','FAIL','BLOCKED','INCONCLUSIVE'].includes(data.status))throw Error('Invalid execution status');
 if(stage==='evidence'&&(!Array.isArray(data.items)||data.items.some(e=>!e||!isNonempty(e.path)||!(/^[a-f0-9]{64}$/i.test(e.sha256||'')))))throw Error('Evidence manifest invalid');
 if(stage==='verdict'&&(!['PASS','FAIL','BLOCKED','INCONCLUSIVE'].includes(data.result)||!isNonempty(data.oracle)))throw Error('Invalid verdict');
 return true;}
function initial(){return {schema_version:1,policy_authority:'RULE_GLOBAL.md',stages:{},history:[],state:'IN_PROGRESS'};}
function advance(doc,stage,data){if(!doc||doc.schema_version!==1||!doc.stages||!Array.isArray(doc.history))throw Error('Invalid workflow document');const expected=STAGES[doc.history.length];if(stage!==expected)throw Error('Invalid transition: expected '+(expected||'DONE'));
 validate(stage,data);
 if(stage==='testcase'){const ids=new Set(doc.stages.requirements.requirement_ids);if(data.cases.some(c=>!ids.has(c.requirement_id)))throw Error('Orphan testcase');}
 if(stage==='verdict'){const exec=doc.stages.execution.status;if(data.result==='PASS'&&exec!=='PASS')throw Error('Cannot PASS without PASS execution');if(data.result==='PASS'&&(!doc.stages.evidence.items.length||!isNonempty(data.oracle)))throw Error('Cannot PASS without evidence and oracle');if(exec==='FAIL'&&data.result==='PASS')throw Error('False PASS');}
 const next=structuredClone(doc);next.stages[stage]=data;next.history.push({stage,at_sequence:next.history.length+1,digest:crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')});if(stage==='report')next.state='COMPLETE';return next;}
function runCli(args){if(args[0]==='init'){fs.writeFileSync(args[1],JSON.stringify(initial(),null,2)+'\n');return;}
 if(args[0]==='advance'){const file=args[1],stage=args[2],input=args[3];const doc=JSON.parse(fs.readFileSync(file,'utf8'));const data=JSON.parse(fs.readFileSync(input,'utf8'));const next=advance(doc,stage,data);fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');return;}
 throw Error('Usage: node workflow.js init workflow.json | advance workflow.json stage data.json');}
module.exports={STAGES,REQUIRED,validate,initial,advance};if(require.main===module){try{runCli(process.argv.slice(2));console.log('OK');}catch(e){console.error(e.message);process.exitCode=1;}}
