'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {route}=require('../../scripts/qa/extension_router');
const fixtures=[
 ['FULL RBT cho chức năng đăng nhập','rbt_workflow_extension'],
 ['Tạo RTM và kiểm tra coverage','coverage_audit_extension'],
 ['Chạy test thủ công trên browser','manual_execution_extension'],
 ['Thiết kế framework Appium','framework_portability_extension'],
 ['Sửa locator bị hỏng','locator_portability_extension'],
 ['Tối ưu database query',null],
 ['Báo cáo tài chính',null],
];
for(const [request,expected] of fixtures){test('route: '+request,()=>{
 const r=route(request); assert.equal(r.execution_authorized,false);assert.equal(r.verdict,'NOT_EXECUTED');
 assert.equal(r.matches.some(x=>x.extension===expected),expected!==null);
 if(expected===null)assert.equal(r.unmatched,true);
 else assert.ok(r.matches.find(x=>x.extension===expected).missing_prerequisites.length>0);
});}
test('prerequisites do not authorize execution',()=>{
 const r=route('FULL RBT',{requirements_available:true});
 assert.equal(r.matches[0].status,'READY_FOR_REVIEW');assert.equal(r.execution_authorized,false);
});
test('empty request rejected',()=>assert.throws(()=>route(' ')));
