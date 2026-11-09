import hashlib,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2]
expected=json.loads((pathlib.Path(__file__).parent/'baseline_sha256.json').read_text())
bad=[name for name,h in expected.items() if not (root/name).is_file() or hashlib.sha256((root/name).read_bytes()).hexdigest()!=h]
print(f'Core SHA-256: {len(expected)-len(bad)}/{len(expected)} unchanged')
if bad: print('Altered:',*bad[:30],sep='\n');sys.exit(1)
