#!/usr/bin/env python3
"""Aplica correções verificadas nos PDFs e resoluções de estudo, preservando IDs/gabaritos."""
from pathlib import Path
from html import escape,unescape
import argparse,json,re,fitz,subprocess
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]

def read_module(path):
 # Base imutável da versão importada, para correções reproduzíveis e idempotentes.
 s=subprocess.check_output(['git','show','85c3646a227762f1707ae625c4404572ca7d2ae2:dist/uploaded-exams.js'],cwd=ROOT,text=True)
 return json.loads(s.split('export const EXAM_EDITIONS = ')[1].split(';\nexport')[0]),json.loads(s.split('export const EXAM_QUESTIONS = ')[1].rsplit(';',1)[0])
def plain_html(text):
 return ''.join('<p>'+escape(p.replace('\n',' ').strip())+'</p>' for p in re.split(r'\n\s*\n',text) if p.strip())
def text_of(markup):return unescape(re.sub(r'<[^>]+>','',markup))
def tidy_html(markup):
 def unwrap_long(m):
  text=text_of(m[2]).strip()
  return m[2] if len(text)>24 or len(text.split())>3 else m[0]
 markup=re.sub(r'<(sup|sub)>(.*?)</\1>',unwrap_long,markup,flags=re.S|re.I)
 markup=re.sub(r'<(script|iframe|object|embed)\b[^>]*>.*?</\1>','',markup,flags=re.S|re.I)
 return markup.replace('\\"','"')

def run(pdf_dir,allow_partial=False):
 editions,questions=read_module(ROOT/'public/uploaded-exams.js');byid={q['id']:q for q in questions};solutions={};fixed=set();issues=[];sanitized=0;docs={};cropcache={};crop_count=0
 manifest={e['id']:e for e in json.loads((ROOT/'scripts/uploaded-exams-manifest.json').read_text())}
 def blocks(items,q,where):
  nonlocal crop_count,sanitized
  result=[]
  for index,item in enumerate(items):
   b=dict(item)
   if b['type']=='crop':
    page=int(b.get('page',q['page']));rect=fitz.Rect(b['rect']);cachekey=(q['edition'],page,tuple(rect))
    if cachekey in cropcache:b={**cropcache[cachekey],'alt':b.get('alt',cropcache[cachekey]['alt'])}
    else:
     if q['edition'] not in docs:docs[q['edition']]=fitz.open(pdf_dir/manifest[q['edition']]['filename'])
     doc=docs[q['edition']]
     assert 1<=page<=len(doc);assert rect.width>0 and rect.height>0
     pix=doc[page-1].get_pixmap(matrix=fitz.Matrix(2.8,2.8),clip=rect,alpha=False)
     name=f'{q["edition"]}-q{q["number"]}-review-{where}-{index}.webp';path=ROOT/'public/assets/exams'/name
     Image.frombytes('RGB',[pix.width,pix.height],pix.samples).save(path,'WEBP',quality=95,method=2)
     # width/height describe pixels; display dimensions retain source proportions.
     b={'type':'image','src':'/assets/exams/'+name,'alt':b.get('alt','Figura original da questão'),'width':pix.width,'height':pix.height,'displayWidth':b.get('displayWidth',round(rect.width*1.25))}
     cropcache[cachekey]=dict(b);crop_count+=1
   elif b['type']=='html':
    old=b['html'];b['html']=tidy_html(old)
    if b['html']!=old:sanitized+=1
   assert b['type'] in ['html','image'],b
   result.append(b)
  return result
 for file in sorted((ROOT/'research').glob('*-review.json')):
  review=json.loads(file.read_text());solutions.update(review['solutions'])
  for issue in review.get('issues',[]):
   q=byid[issue['id']];fix=issue.get('fix',{});issues.append({k:v for k,v in issue.items() if k!='fix'})
   if not fix:continue
   fixed.add(q['id'])
   for k in ['text','contextText','topic']:
    if k in fix:q[k]=fix[k]
   if 'content' in fix:q['content']=blocks(fix['content'],q,'body')
   elif 'contextHTML' in fix or 'stemHTML' in fix:
    # These overrides intentionally replace incorrectly interleaved text blocks.
    support=fix.get('contextHTML',plain_html(q.get('contextText','')))
    stem=fix.get('stemHTML',plain_html(q['text']))
    q['content']=[{'type':'html','html':support+stem}]
   if 'options' in fix:
    assert len(fix['options'])==5
    q['options']=fix['options'];q['optionContent']=[[{'type':'html','html':plain_html(o)}] for o in q['options']]
   if 'optionContent' in fix:q['optionContent']=[blocks(v,q,f'option-{i}') for i,v in enumerate(fix['optionContent'])]
   if 'optionHTML' in fix:q['optionContent']=[[{'type':'html','html':markup}] for markup in fix['optionHTML']]
   if 'optionImageCrops' in fix:
    q['optionContent']=[blocks([{'type':'crop',**spec}],q,f'option-{i}') for i,spec in enumerate(fix['optionImageCrops'])]
 for q in questions:
  q['content']=blocks(q['content'],q,'body')
  q['optionContent']=[blocks(v,q,f'option-{i}') for i,v in enumerate(q['optionContent'])]
  # Texto comum das alternativas deve ser HTML; recortes antigos traziam rodapés.
  visual_options={'fatec-2026-2-46','fatec-2025-2-41','fatec-2024-1-42','fatec-2023-2-51','fatec-2023-1-4'}
  if q['id'] not in visual_options:
   for i,bs in enumerate(q['optionContent']):
    if any(b['type']=='image' for b in bs):
     q['optionContent'][i]=[{'type':'html','html':plain_html(q['options'][i])}];fixed.add(q['id'])
  if q['id'] in solutions:
   entry=solutions[q['id']]
   assert len(entry['explanation'].strip())>60,q['id']
   q['explanation']=entry['explanation']
  # Repare um campo visual vazio com o texto verificado da alternativa.
  for i,bs in enumerate(q['optionContent']):
   meaningful=any(b['type']=='image' or text_of(b.get('html','')).strip() for b in bs)
   if not meaningful:
    assert not q['options'][i].startswith('Expressão ou figura'),('alternativa sem conteúdo',q['id'],i)
    q['optionContent'][i]=[{'type':'html','html':plain_html(q['options'][i])}]
 for e in editions:
  e['essay']['content']=blocks(e['essay']['content'],{'edition':e['id'],'number':'essay','page':23},'essay')
 missing=[q['id'] for q in questions if q['id'] not in solutions]
 if not allow_partial:assert not missing,('resoluções faltantes',missing)
 assert len(questions)==400
 (ROOT/'public/uploaded-exams.js').write_text('export const EXAM_EDITIONS = '+json.dumps(editions,ensure_ascii=False,indent=2)+';\nexport const EXAM_QUESTIONS = '+json.dumps(questions,ensure_ascii=False,indent=2)+';\n')
 (ROOT/'public/solutions.js').write_text('export const SOLUTIONS = '+json.dumps(solutions,ensure_ascii=False,indent=2)+';\n')
 audit={'questions':400,'solutions':len(solutions),'correctedQuestions':len(fixed),'correctedIds':sorted(fixed),'newFigureCrops':crop_count,'htmlBlocksNormalized':sanitized,'missingSolutions':missing,'issues':issues}
 (ROOT/'research/content-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2))
 print(json.dumps({k:v for k,v in audit.items() if k not in ['correctedIds','issues','missingSolutions']},ensure_ascii=False))
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--pdf-dir',type=Path,required=True);ap.add_argument('--allow-partial',action='store_true');args=ap.parse_args();run(args.pdf_dir,args.allow_partial)
