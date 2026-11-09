#!/usr/bin/env node
'use strict';
// Optional Kit A adapters must NOT change the B canonical skill inventory.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.agent/extensions/kit-a/manifest.json'), 'utf8'));
let failures = 0;
function fail(m) { console.error('FAIL:',m); failures++; }
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
const original = path.join(root,'.agent/skills');
const shimRoot = path.join(root,'.claude/skills');
const extensions = new Set(manifest.extensions.map(x=>x.skill));
if (extensions.size!==5 || manifest.extensions.length!==5) fail('expected exactly five unique optional adapters');
for (const entry of manifest.extensions) {
 const rel=entry.adapter_path;
 const expected=`.agent/extensions/kit-a/adapters/${entry.phase}/${entry.skill}/SKILL.md`;
 if (rel!==expected) {fail(`adapter path outside dedicated namespace: ${entry.skill}`);continue;}
 const file=path.join(root,rel),source=path.join(root,'.agent/extensions/kit-a/source-references',entry.source,'SOURCE_GUIDE.md');
 if (!fs.existsSync(file) || !fs.existsSync(source)) {fail('missing adapter or source '+entry.skill);continue;}
 const a=fs.readFileSync(file,'utf8');
 if (!a.includes('RULE_GLOBAL.md') || !a.includes('canonical') || !a.includes('does not grant permission to skip gates')) fail('missing precedence '+entry.skill);
 if (!a.includes('SOURCE_GUIDE.md')) fail('missing source reference '+entry.skill);
 if (digest(fs.readFileSync(source))!==entry.source_sha256) fail('source reference modified '+entry.skill);
 const bad=[path.join(original,entry.phase,entry.skill,'SKILL.md'),path.join(shimRoot,entry.skill,'SKILL.md'),path.join(shimRoot,entry.phase,entry.skill,'SKILL.md')];
 for(const p of bad) if(fs.existsSync(p)) fail('extension leaked into canonical skill tree: '+path.relative(root,p));
 console.log('OK:',entry.skill);
}
const index=fs.readFileSync(path.join(original,'INDEX.md'),'utf8');
for(const s of extensions) if(index.includes('`'+s+'`')) fail('canonical index mentions opt-in extension: '+s);
// Ensure every original skill and shim still remain in their B-only canonical trees.
const originalSkillNames=[];
for(const group of fs.readdirSync(original,{withFileTypes:true}).filter(x=>x.isDirectory())) {
 for(const s of fs.readdirSync(path.join(original,group.name),{withFileTypes:true}).filter(x=>x.isDirectory())) {
  if(fs.existsSync(path.join(original,group.name,s.name,'SKILL.md')))originalSkillNames.push(s.name);
 }
}
const shims=fs.readdirSync(shimRoot,{withFileTypes:true}).filter(x=>x.isDirectory()&&fs.existsSync(path.join(shimRoot,x.name,'SKILL.md'))).map(x=>x.name);
if(originalSkillNames.length!==28||shims.length!==28) fail(`canonical skill/shim count changed: ${originalSkillNames.length}/${shims.length} (expected 28/28)`);
for(const s of originalSkillNames) if(!shims.includes(s)) fail('missing canonical shim: '+s);
if(failures){console.error('FAIL: extension compatibility',failures);process.exit(1);}
console.log(`PASS: ${manifest.extensions.length} isolated optional adapters, B canonical skills/shims ${originalSkillNames.length}/${shims.length}; structural checks only.`);
