'use strict';const assert=require('node:assert/strict');const test=require('node:test');const {STAGES,initial,advance}=require('./workflow');const {plan}=require('./context_planner');
const inputs={requirements:{requirement_ids:['REQ-1'],source:'requirements.md'},ambiguity:{resolved:true,notes:'resolved'},risk:{risk_ids:['R-1'],assessment:'high'},testcase:{cases:[{id:'TC-1',requirement_id:'REQ-1',expected_result:'OK'}]},review:{approved:true,reviewer:'QA'},automation:{artifact_path:'tests/a.spec.js',framework:'playwright'},execution:{run_id:'run-1',status:'PASS'},evidence:{items:[{path:'proof.png',sha256:'a'.repeat(64)}]},verdict:{result:'PASS',oracle:'independent specification'},report:{report_path:'report.json',summary:'PASS'}};
function upto(stage){let d=initial();for(const s of STAGES){if(s===stage)break;d=advance(d,s,inputs[s]);}return d;}
test('all stages complete',()=>{let d=upto('report');d=advance(d,'report',inputs.report);assert.equal(d.state,'COMPLETE');assert.equal(d.history.length,10);});
test('out-of-order transition blocked',()=>assert.throws(()=>advance(initial(),'risk',inputs.risk)));
test('missing required input blocked',()=>assert.throws(()=>advance(initial(),'requirements',{source:'x'})));
test('unresolved ambiguity blocked',()=>assert.throws(()=>advance(upto('ambiguity'),'ambiguity',{resolved:false,notes:'x'})));
test('orphan testcase blocked',()=>assert.throws(()=>advance(upto('testcase'),'testcase',{cases:[{id:'T',requirement_id:'OTHER',expected_result:'x'}]})));
test('missing expected result blocked',()=>assert.throws(()=>advance(upto('testcase'),'testcase',{cases:[{id:'T',requirement_id:'REQ-1'}]})));
test('review rejection blocked',()=>assert.throws(()=>advance(upto('review'),'review',{approved:false,reviewer:'QA'})));
test('missing evidence manifest hash blocked',()=>assert.throws(()=>advance(upto('evidence'),'evidence',{items:[{path:'x',sha256:'bad'}]})));
test('false PASS blocked',()=>{let d=upto('execution');d=advance(d,'execution',{run_id:'run',status:'FAIL'});d=advance(d,'evidence',inputs.evidence);assert.throws(()=>advance(d,'verdict',inputs.verdict));});
test('PASS without evidence blocked',()=>{let d=upto('evidence');assert.throws(()=>advance(d,'evidence',{items:[]}));});
test('planner is advisory and scoped',()=>{const p=plan('testcase',['rbt']);assert.equal(p.execution_authorized,false);assert.deepEqual(p.on_demand_skills,['tc_design_guide']);});
test('planner rejects unknown stage',()=>assert.throws(()=>plan('imaginary')));
test('completed workflow cannot advance',()=>{let d=upto('report');d=advance(d,'report',inputs.report);assert.throws(()=>advance(d,'report',inputs.report));});
