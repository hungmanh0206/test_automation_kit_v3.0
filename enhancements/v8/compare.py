#!/usr/bin/env python3
"""Reproducible structural comparison. This is NOT an AI output-quality benchmark."""
import argparse,zipfile,hashlib,json,pathlib,collections,sys
p=argparse.ArgumentParser();p.add_argument('--a',required=True);p.add_argument('--b',required=True);p.add_argument('--enhanced',required=True);p.add_argument('--output',default='v8_structural_results.json');args=p.parse_args()
def files(path):
 with zipfile.ZipFile(path) as z:
  names=[n for n in z.namelist() if not n.endswith('/')];prefix=names[0].split('/')[0]+'/' if names and '/' in names[0] else ''
  return {n[len(prefix):] if prefix and n.startswith(prefix) else n:hashlib.sha256(z.read(n)).hexdigest() for n in names}
a,b,e=map(files,[args.a,args.b,args.enhanced]); altered=[n for n in b if e.get(n)!=b[n]]
def count(d,term):return sum(1 for n in d if term in n)
def summary(d):return dict(files=len(d),skills=count(d,'SKILL.md'),tests=count(d,'tests/'),qa_scripts=count(d,'scripts/qa/'),ci_files=sum(1 for n in d if n.startswith('.github/workflows/') or n=='.gitlab-ci.yml'))
r=dict(A=summary(a),B=summary(b),Enhanced=summary(e),core_B_files=len(b),core_changed=altered,added_files=sorted(set(e)-set(b)),core_integrity_pass=not altered,limitations=['File counts are not quality scores','No AI task executions performed','No token, latency or false-PASS measurements'])
pathlib.Path(args.output).write_text(json.dumps(r,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in r.items() if k not in ('added_files','core_changed')},indent=2));sys.exit(0 if not altered else 1)
