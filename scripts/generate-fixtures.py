"""Generate deterministic synthetic FAA MMP 1.1 fixtures using supplied Kit schemas."""
from pathlib import Path
import zipfile,io,hashlib,yaml,json
root=Path(__file__).resolve().parents[1]
with zipfile.ZipFile(root/'references/mmp-specification-kit-1.2.0.zip') as kit:
 with zipfile.ZipFile(io.BytesIO(kit.read('examples/architecture-example.mmp.zip'))) as z:files={n:z.read(n)for n in z.namelist()}
 def kitfile(name):return kit.read(name)
 # Published schemas are used byte for byte.
 for n in list(files):
  if n.startswith('schemas/'):files[n]=kitfile(n)
model=yaml.safe_load(files['canonical/metamodel.yaml'])
model['metamodel'].update(id='faa_example',name='FAA reference model',version='1.0.0',namespace='https://example.org/faa')
caps=[{'id':i,'version':v}for i,v in [('mmp-typed-endpoints','1.0.0'),('mmp-typed-pairs','1.0.0'),('mmp-junction-structure','0.1.0'),('mmp-required-default-presence','0.1.0')]]
model['metamodel']['extensions']={'mmp_required_capabilities':caps}
model['elements']=[{'id':i,'name':n}for i,n in [('application','System'),('unit','UO'),('business_process','Process'),('application_service','Applikationstjänst')]]
model['junctions']=[{'id':'gate','name':'Structural gate'}]
model['relationships']=[]
for i,n,a,b in [('belongs_to','Tillhör','application','unit'),('realization','Realiserar','application','application_service'),('serving','Stödjer','application_service','business_process'),('supports','Stödjer direkt','application','business_process')]:
 model['relationships'].append({'id':i,'name':n,'directed':True,'source':{'types':[a],'typed_refs':[{'kind':'element','id':a}]},'target':{'types':[b],'typed_refs':[{'kind':'element','id':b}]},'allowed_typed_pairs':[{'source':{'kind':'element','id':a},'target':{'kind':'element','id':b}}]})
files['canonical/metamodel.yaml']=yaml.safe_dump(model,sort_keys=False,allow_unicode=True).encode()
files['canonical/constraints.yaml']=b'schema_version: 1\nconstraints: []\n'
files['documentation/junction-structure.json']=json.dumps({'profile':'mmp-junction-structure@0.1.0','junction_operators':{'gate':'and'}}).encode()
files['documentation/required-default-presence.json']=json.dumps({'profile':'mmp-required-default-presence@0.1.0','default_satisfies_required':False,'null_counts_as_present':False}).encode()
manifest=yaml.safe_load(files['manifest.yaml']);manifest['required_capabilities']=caps;manifest['metamodel']={k:model['metamodel'][k]for k in ['id','name','version','namespace']}
manifest['files']=[{'path':n,'role':'schema'if n.startswith('schemas/')else'canonical'if n.startswith('canonical/')else'documentation','media_type':'application/json'if n.endswith('.json')else'application/yaml','sha256':hashlib.sha256(b).hexdigest()}for n,b in sorted(files.items())if n!='manifest.yaml']
files['manifest.yaml']=yaml.safe_dump(manifest,sort_keys=False).encode()
out=root/'examples/faa-reference.mmp.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED)as z:
 for n,b in sorted(files.items()):
  i=zipfile.ZipInfo(n,date_time=(2026,10,28,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;z.writestr(i,b)
print(out)
# A reusable published analysis type embeds MMP and mappings, never source snapshots.
import base64
ns='https://example.org/faa#'
c={
 'schemaVersion':1,'id':'faa-reference','version':1,'name':'System, UO och processer – exempel','published':True,
 'sources':[{'id':'excel','name':'Systemregister','format':'xlsx','keyPolicy':'source-local'},{'id':'xml','name':'Arkitekturmodell','format':'archimate','keyPolicy':'source-local'}],
 'views':[{'id':'A','name':'System per UO','description':'Utforska systemregistrets tillhörighet.','requiredSourceIds':['excel']},{'id':'B','name':'System som stödjer process','description':'Följ dokumenterade relationer från en process.','requiredSourceIds':['xml']},{'id':'C','name':'UO och process','description':'Kombinera tillhörighet och processstöd med bekräftad identitet.','requiredSourceIds':['excel','xml']}],
 'excel':{'sheet':'Register','headerRow':1,'key':'ID','name':'System','uo':'UO','entityType':ns+'application','uoType':ns+'unit','relationshipType':ns+'belongs_to'},
 'xml':{'elementTypes':{'ApplicationComponent':ns+'application','ApplicationService':ns+'application_service','BusinessProcess':ns+'business_process'},'relationshipTypes':{'Serving':ns+'serving','Realization':ns+'realization'},'processTypes':[ns+'business_process'],'applicationTypes':[ns+'application'],'paths':[[{'type':ns+'serving','direction':'in'},{'type':ns+'realization','direction':'in'}]]},
 'metamodel':{'id':'faa_example','version':'1.0.0','namespace':'https://example.org/faa','sha256':hashlib.sha256(out.read_bytes()).hexdigest()},'identities':[]}
package={'format':'faa-analysis-type','formatVersion':1,'analysisType':c,'metamodelPackage':base64.b64encode(out.read_bytes()).decode()}
(root/'examples/analysis-type.json').write_text(json.dumps(package,ensure_ascii=False,indent=2)+'\n')
# Separate, opt-in entry points for learning each source flow independently.
import copy
for identifier,filename,label,view_ids,remove in [
 ('faa-register-example','analysis-type-portfolio.json','System per UO – Excel',['A'],'xml'),
 ('faa-process-example','analysis-type-process.json','Processstöd – XML',['B'],'excel')]:
 variant=copy.deepcopy(package)
 cfg=variant['analysisType'];cfg['id']=identifier;cfg['name']=label
 cfg['views']=[v for v in cfg['views']if v['id']in view_ids];cfg.pop(remove,None)
 (root/'examples'/filename).write_text(json.dumps(variant,ensure_ascii=False,indent=2)+'\n')
