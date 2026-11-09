#!/usr/bin/env node
const {spawnSync}=require('child_process'),path=require('path');
const root=path.resolve(__dirname,'../..');
const cases=[['Baseline integrity','scripts/qa/v4_baseline_integrity.js'],['Extension integrity','scripts/qa/extension_integrity_check.js'],['Extension routing benchmark','scripts/qa/extension_benchmark.js']];
let failed=0;for(const [label,file] of cases){const p=spawnSync(process.execPath,[path.join(root,file)],{cwd:root,encoding:'utf8'});console.log(`\n[${p.status===0?'PASS':'FAIL'}] ${label}`);if(p.stdout)console.log(p.stdout.slice(-4000));if(p.stderr)console.error(p.stderr.slice(-1500));if(p.status!==0)failed++}process.exitCode=failed?1:0;
