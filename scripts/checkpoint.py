"""Completion-only transition after caller has passed verification; package full source."""
import sys,json,hashlib,zipfile
from pathlib import Path
import yaml
root=Path(__file__).resolve().parents[1];step=sys.argv[1];state=root/'.system-builder/work-status.yaml'
s=yaml.safe_load(state.read_text());s['phase']='implementation';s['selected_step']=None;s['in_progress']=None
if step not in s['completed_steps']: s['completed_steps'].append(step)
n=int(step[-3:])+1;s['next']={'recommended':f'DEV-{n:03}' if n<=6 else 'acceptance_review','reason':'verified previous step'}
s['verification']={'step':step,'result':'passed','evidence':f'docs/verification/{step}.md'}
files=[p for p in root.rglob('*') if p.is_file() and not any(x in p.relative_to(root).parts for x in ['node_modules','dist','.git','test-results','playwright-report']) and p!=state]
h=hashlib.sha256()
for p in sorted(files):h.update(str(p.relative_to(root)).encode());h.update(p.read_bytes())
s['verification']['source_sha256']=h.hexdigest();state.write_text(yaml.safe_dump(s,sort_keys=False))
out=root.parent/'deliverables';out.mkdir(exist_ok=True);dest=out/f'federated-architecture-analysis-{step.lower()}.zip'
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as z:
 for p in files+[state]:z.write(p,p.relative_to(root))
with zipfile.ZipFile(dest) as z:assert z.testzip() is None;assert 'package-lock.json'in z.namelist();assert '.system-builder/work-status.yaml'in z.namelist()
print(dest)
