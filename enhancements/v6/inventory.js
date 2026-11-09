#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),folder=path.join(root,'scripts/qa');
const files=fs.readdirSync(folder).filter(n=>n.endsWith('.js')).sort();
const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const npmScripts=Object.entries(packageJson.scripts||{});
const entries=files.map(f=>({file:'scripts/qa/'+f,referenced_by_npm:npmScripts.filter(([,cmd])=>cmd.includes(f)).map(([name])=>name),has_main_guard:/require\.main\s*===\s*module/.test(fs.readFileSync(path.join(folder,f),'utf8'))}));
const result={total_js_files:files.length,npm_referenced:entries.filter(e=>e.referenced_by_npm.length).length,not_directly_npm_referenced:entries.filter(e=>!e.referenced_by_npm.length).length,entries,disclaimer:'Static inventory only; absence of direct npm reference does not imply dead code; no gate effectiveness verified'};
if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));else console.log(JSON.stringify({total_js_files:result.total_js_files,npm_referenced:result.npm_referenced,not_directly_npm_referenced:result.not_directly_npm_referenced,disclaimer:result.disclaimer},null,2));
