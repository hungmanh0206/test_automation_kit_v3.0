#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {verify}=require('./evidence_gate');const {assess}=require('../v5/quality_check');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qig-v6-'));let count=0;
const check=(name,fn,expected)=>{const r=fn();assert.equal(r.pass,expected,`${name}: ${JSON.stringify(r)}`);count++;};
try{
 fs.writeFileSync(path.join(dir,'trace.txt'),'actual evidence');const hash=crypto.createHash('sha256').update('actual evidence').digest('hex');
 const good={skill:'tc_design_guide',requirement_ids:['REQ1'],testcases:[{id:'TC1',requirement_id:'REQ1',steps:['open'],expected:'visible'}],verdict:'PASS',execution_verified:true,evidence:[{path:'trace.txt',sha256:hash}]};
 check('valid evidence',()=>verify(good,dir),true);
 check('missing evidence',()=>verify({...good,evidence:[]},dir),false);
 check('forged digest',()=>verify({...good,evidence:[{path:'trace.txt',sha256:'0'.repeat(64)}]},dir),false);
 check('nonexistent file',()=>verify({...good,evidence:[{path:'missing.txt',sha256:hash}]},dir),false);
 check('path traversal',()=>verify({...good,evidence:[{path:'../secret.txt',sha256:hash}]},dir),false);
 check('string evidence not accepted',()=>verify({...good,evidence:['trace.txt']},dir),false);
 check('execution not verified',()=>verify({...good,execution_verified:false},dir),false);
 check('orphan requirement',()=>verify({...good,testcases:[{...good.testcases[0],requirement_id:'OTHER'}]},dir),false);
 check('missing expected result',()=>verify({...good,testcases:[{...good.testcases[0],expected:''}]},dir),false);
 check('invalid verdict',()=>verify({...good,verdict:'SUCCESS'},dir),false);
 check('inconclusive valid',()=>verify({...good,verdict:'INCONCLUSIVE',evidence:[],execution_verified:false},dir),true);
 check('no testcase',()=>verify({...good,testcases:[]},dir),false);
 const outside=path.join(os.tmpdir(),'qig-v6-outside-'+process.pid);fs.writeFileSync(outside,'external');
 try{fs.symlinkSync(outside,path.join(dir,'linked.txt'));check('symlink escape',()=>verify({...good,evidence:[{path:'linked.txt',sha256:hash}]},dir),false);}finally{fs.unlinkSync(outside);}
 console.log(JSON.stringify({result:'PASS',cases:count,limitations:'No actual browser run or semantic oracle validation'},null,2));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
