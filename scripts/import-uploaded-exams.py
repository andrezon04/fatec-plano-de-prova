#!/usr/bin/env python3
"""Transforma os PDFs enviados em enunciados e alternativas HTML com figuras locais."""
from pathlib import Path
import argparse,fitz,re,json,html,hashlib,unicodedata
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
MANIFEST=json.loads((ROOT/'scripts/uploaded-exams-manifest.json').read_text())
AREA={'Biologia':'bio','Inglês':'ing','Multidisciplinar':'multi','Matemática':'mat','Física':'fis','Química':'qui','Português':'port','História':'his','Geografia':'geo','Raciocínio Lógico':'log'}

def norm(t):
 t=unicodedata.normalize('NFKC',t).replace('\u00ad','').replace('\u0000','')
 return re.sub(r'[ \t]+',' ',t).strip()

def lines_of(page,rect=None):
 result=[];seen=set()
 clip=fitz.Rect(rect.x0,0,rect.x1,page.rect.height) if rect else None
 for b in page.get_text('dict',clip=clip,flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES)['blocks']:
  if b['type']!=0:continue
  for l in b['lines']:
   spans=[];ss=set()
   for s in l['spans']:
    key=(s['text'],*(round(v,0) for v in s['bbox']))
    if key not in ss:spans.append(s);ss.add(key)
   text=norm(''.join(s['text'] for s in spans))
   if not text:continue
   r=fitz.Rect(l['bbox'])
   if rect and not (rect.y0<=(r.y0+r.y1)/2<rect.y1):continue
   if re.search(r'VESTIBULAR|STIBULAR|SEM/20|SEM \| 20',text.upper()) and r.y0>page.rect.height*.9:continue
   if text==str(page.number+1) and r.y0>page.rect.height*.9:continue
   key=(text,round(r.x0),round(r.y0))
   if key in seen or r.x0<0 or r.x0>page.rect.width:continue
   seen.add(key);result.append(dict(text=text,rect=r,spans=spans))
 return sorted(result,key=lambda l:(round(l['rect'].y0/2)*2,l['rect'].x0))

def headers_of(page,lines,count):
 out=[];words=page.get_text('words')
 for w in words:
  m=re.fullmatch(r'Questão(?:\s*(\d{1,2}))?',w[4])
  if not m:continue
  n=int(m[1]) if m[1] else None;r=fitz.Rect(w[:4])
  if n is None:
   near=[x for x in words if re.fullmatch(r'\d{1,2}',x[4]) and abs(x[1]-r.y0)<5 and 0<=x[0]-r.x1<40]
   if near:
    nw=min(near,key=lambda x:x[0]);n=int(nw[4]);r=r|fitz.Rect(nw[:4])
  if n and n<=count and not any(x['number']==n for x in out):
   rules=[d['rect'] for d in page.get_drawings() if d['rect'].height<3 and d['rect'].width>65 and abs(d['rect'].y0-(r.y0+r.y1)/2)<8 and r.x0+30<=d['rect'].x0<r.x1+30]
   right=max((x.x1 for x in rules),default=page.rect.width-20)
   out.append(dict(number=n,rect=r,right=right))
 return sorted(out,key=lambda h:(h['rect'].y0,h['rect'].x0))

def bottom_of(page,lines):
 return page.rect.height-19

def segment_lines(page,rect):return [l for l in lines_of(page,rect) if l['rect'].height>0]

def cue_range(text):
 m=re.search(r'quest[õo]es\s*(?:de|n[úu]meros?)?\s*0?(\d+)\s*(?:a|à|até|e)\s*0?(\d+)',text,re.I)
 return (int(m[1]),int(m[2])) if m else None

def support_cues(lines):
 found=[]
 for i,l in enumerate(lines):
  if re.search(r'(?i)\b(leia|considere|observe|utilize|use)\b',l['text']):
   joined=' '.join(x['text'] for x in lines[i:i+5]);r=cue_range(joined)
   if r:found.append((l['rect'].y0,r))
 return found

def option_markers(page,rect):
 out={}
 for c in 'ABCDE':
  matches=[]
  for l in segment_lines(page,rect):
   # A opção precisa iniciar uma linha ou aparecer após separação visível.
   if re.search(r'\(\s*'+c+r'\s*\)',l['text']):
    for box in page.search_for('('+c+')',clip=rect):
     if abs(box.y0-l['rect'].y0)<6:matches.append(box)
  if matches:out[c]=max(matches,key=lambda r:(r.y0,r.x0))
 return out

def option_rects(rect,markers):
 out={}
 for c,r in markers.items():
  same=[b for k,b in markers.items() if k!=c and abs(b.x0-r.x0)<17 and b.y0>r.y0+3]
  right=[b for b in markers.values() if b.x0>r.x0+17]
  out[c]=fitz.Rect(r.x0-1,r.y0-2,min([b.x0-6 for b in right] or [rect.x1]),min([b.y0-2 for b in same] or [rect.y1]))
 return out

def line_html(line):
 spans=line['spans'];base=max((s['size'] for s in spans),default=10);baseline=max((s['origin'][1] for s in spans if s['size']>base*.85),default=0)
 result=''
 for s in spans:
  txt=html.escape(unicodedata.normalize('NFKC',s['text']));font=s['font'].lower()
  if s['size']<base*.8 and s['origin'][1]<baseline-1:txt='<sup>'+txt+'</sup>'
  elif s['size']<base*.8 and s['origin'][1]>baseline+1:txt='<sub>'+txt+'</sub>'
  if 'italic' in font or 'oblique' in font:txt='<em>'+txt+'</em>'
  if 'bold' in font or 'black' in font:txt='<strong>'+txt+'</strong>'
  result+=txt
 return result.strip()

def text_html(lines):
 parts=[];last=None
 for l in lines:
  val=line_html(l)
  if not val:continue
  gap=(l['rect'].y0-last['rect'].y1) if last else 99
  new=last is None or gap>5 or bool(re.match(r'^(?:[IVX]{1,5}[.\-–]|[•●]|\d+[.)])\s',l['text']))
  if new:parts.append(val)
  else:parts[-1]+=' '+val
  last=l
 return ''.join('<p>'+x+'</p>' for x in parts)

class Extractor:
 def __init__(self,input_dir,cache,outdir):self.input_dir=input_dir;self.cache=cache;self.outdir=outdir;self.assets=outdir/'assets/exams';self.assets.mkdir(parents=True,exist_ok=True);self.nassets=0;self.audit=[];self.pagecache={};self.cropcache={}
 def crop(self,page,rect,name):
  rect=rect&page.rect
  ck=(page.parent.name,page.number,tuple(round(v,1) for v in rect),name)
  if ck in self.cropcache:return self.cropcache[ck]
  if rect.width<2 or rect.height<2:return None
  pix=page.get_pixmap(matrix=fitz.Matrix(2.3,2.3),clip=rect,alpha=False)
  path=self.assets/(name+'.webp');Image.frombytes('RGB',[pix.width,pix.height],pix.samples).save(path,'WEBP',quality=92,method=2)
  self.nassets+=1
  result=dict(type='image',src='/assets/exams/'+path.name,alt='Figura ou expressão do enunciado original',width=pix.width,height=pix.height);self.cropcache[ck]=result;return result
 def visuals(self,page,rect):
  key=(page.parent.name,page.number)
  if key not in self.pagecache:
   raw=[]
   for img in page.get_image_info():
    r=fitz.Rect(img['bbox'])
    if r.y0>page.rect.height*.93:continue
    if r.width>15 and r.height>12 and r.get_area()>400:
     inside=segment_lines(page,r)
     # Fundos cinza rasterizados não são figuras: o texto continua nativo.
     prose=sum(len(l['text']) for l in inside)>180 and sum(l['rect'].width>r.width*.5 for l in inside)>=3
     if not prose:raw.append((r,'raster'))
   try:
    for t in page.find_tables().tables:
     if t.row_count>=2 and t.col_count>=2:raw.append((fitz.Rect(t.bbox),'table'))
   except Exception:pass
   try:
    for r in page.cluster_drawings(x_tolerance=5,y_tolerance=5):
     if r.y0>page.rect.height*.93:continue
     if r.width>28 and r.height>25 and r.width<page.rect.width*.95:
      covered=[l for l in segment_lines(page,r) if l['rect'].width>r.width*.65]
      if len(covered)<3:raw.append((r,'vector'))
   except Exception:pass
   self.pagecache[key]=raw
  rs=[]
  for r,kind in self.pagecache[key]:
   if (r&rect).get_area()<r.get_area()*.85:continue
   rs.append((r+((-12,-23,12,12) if kind=='raster' else (-5,-7,7,7)))&rect)
  merged=[]
  for r in rs:
   r=r&rect
   if r.get_area()<400:continue
   for i,m in enumerate(merged):
    if (r+(-6,-6,6,6)).intersects(m):merged[i]=m|r;break
   else:merged.append(r)
  changed=True
  while changed:
   changed=False
   for i in range(len(merged)):
    for j in range(i+1,len(merged)):
     if (merged[i]+(-5,-5,5,5)).intersects(merged[j]):merged[i]=merged[i]|merged[j];merged.pop(j);changed=True;break
    if changed:break
  return sorted(merged,key=lambda r:r.y0)
 def content(self,page,rect,name,option=False,visual_rect=None):
  if rect.height<2:return [],''
  if option:
   nearby=[d['rect'] for d in page.get_drawings() if 3<d['rect'].width<150 and d['rect'].height<2 and rect.x0<d['rect'].x0<rect.x1 and rect.y0-7<d['rect'].y0<rect.y0+20]
   if nearby:rect=fitz.Rect(rect.x0,rect.y0-9,rect.x1,rect.y1)
  lines=segment_lines(page,rect);plain='\n'.join(l['text'] for l in lines)
  # Alternativas com frações, diagramas ou distribuição em linhas são preservadas visualmente.
  horizontal=[]
  for d in page.get_drawings():
   r=d['rect']
   if 3<r.width<150 and r.height<2 and rect.contains(r):horizontal.append(r)
  complex_option=option and (bool(self.visuals(page,rect)) or (horizontal and len(lines)>1) or '\ufffd' in plain)
  if complex_option:
   tight=fitz.Rect(rect)
   # Não inclui o marcador (A)..(E) no recorte da alternativa.
   tight.x0+=18
   bounds=[l['rect'] for l in lines]+self.visuals(page,rect)
   if bounds:
    tight.y0=max(rect.y0,min(r.y0 for r in bounds)-2)
    tight.y1=min(rect.y1,max(r.y1 for r in bounds)+3)
    tight.x1=min(rect.x1,max(r.x1 for r in bounds)+4)
   return [self.crop(page,tight,name)],re.sub(r'^\([A-E]\)\s*','',plain).strip()
  visual=self.visuals(page,visual_rect or rect);content=[]
  if visual_rect:
   visual=[r for r in visual if r.y0<rect.y1-2]
  if not option:
   for bar in horizontal:
    above=[l for l in lines if len(l['text'])<65 and bar.y0-18<l['rect'].y0<bar.y0 and l['rect'].x0<bar.x1 and l['rect'].x1>bar.x0]
    below=[l for l in lines if len(l['text'])<65 and bar.y0<l['rect'].y1<bar.y0+20 and l['rect'].x0<bar.x1 and l['rect'].x1>bar.x0]
    if above and below:
     fr=fitz.Rect(bar.x0-5,bar.y0-16,bar.x1+5,bar.y0+16)
     for l in above+below:fr=fr|l['rect']
     if not any(fr.intersects(v) for v in visual):visual.append(fr&rect)
   visual.sort(key=lambda r:r.y0)
  # A ordem visual do texto e das figuras é mantida.
  events=[]
  used=[]
  for i,r in enumerate(visual):
   labels=[l for l in lines if (l['rect']&r).get_area()>l['rect'].get_area()*.6]
   if labels:r=r|fitz.Rect(min(l['rect'].x0 for l in labels),min(l['rect'].y0 for l in labels),max(l['rect'].x1 for l in labels),max(l['rect'].y1 for l in labels))
   image=self.crop(page,r&(visual_rect or rect),f'{name}-fig-{i+1}')
   if image:events.append((r.y0,'image',image));used.append(r)
  native=[l for l in lines if len(l['text'])>75 or not any((l['rect']&r).get_area()>l['rect'].get_area()*.55 for r in used)]
  batch=[]
  for l in native:
   before=[e for e in events if e[0]<l['rect'].y0]
   if before:
    if batch:content.append(dict(type='html',html=text_html(batch)));batch=[]
    content.extend(e[2] for e in before);events=[e for e in events if e not in before]
   batch.append(l)
  if batch:content.append(dict(type='html',html=text_html(batch)))
  content.extend(e[2] for e in events)
  return content,plain
 def edition(self,e):
  path=self.input_dir/e['filename'];doc=fitz.open(path);print('READ',e['id'],flush=True);keys=json.loads((self.cache/(e['id']+'-key.json')).read_text());keymap={int(n):(a,AREA[s]) for n,a,s in keys};questions={};contexts=[];previous=None;preambles=[];page_info={}
  for pi in range(1,len(doc)-1):
   page=doc[pi];lines=lines_of(page);headers=headers_of(page,lines,e['count']);bottom=bottom_of(page,lines)
   if not headers:continue
   # Cabeçalhos em colunas: identifica a faixa da coluna pela sequência das questões.
   rightcols=[h['rect'].x0 for h in headers if h['rect'].x0>page.rect.width*.45]
   if rightcols:
    split=min(rightcols)-10
    for hh in headers:
     if hh['rect'].x0<page.rect.width*.4 and any(rh['number']>=hh['number'] and rh['rect'].x0>page.rect.width*.45 for rh in headers):
      endprobe=min([rh['rect'].y0-3 for rh in headers if rh['rect'].y0>hh['rect'].y0+8] or [bottom])
      probe=segment_lines(page,fitz.Rect(hh['rect'].x0,hh['rect'].y1+2,page.rect.width-20,endprobe))
      crosses=any(l['rect'].x0<split-40 and l['rect'].x1>split+45 for l in probe)
      if not crosses:hh['right']=min(hh['right'],split)
   essayheads=[l for l in lines if 'PROPOSTA DE REDAÇÃO' in l['text']]
   if essayheads:bottom=min(bottom,min(l['rect'].y0 for l in essayheads)-5)
   page_info[pi]=dict(headers=headers,bottom=bottom)
   top=max(18,min(l['rect'].y0 for l in lines if l['rect'].y0<bottom))
   pre=fitz.Rect(20,top,page.rect.width-20,headers[0]['rect'].y0-3)
   if pre.height>10:
    pl=segment_lines(page,pre);preambles.append(dict(page=pi+1,text=' '.join(x['text'] for x in pl)[:350]))
    # Continuação de uma questão na página seguinte.
    if previous and not previous['hasAllOptions'] and any(re.match(r'^\([A-E]\)',l['text']) for l in pl):
     previous['continuation']=(pi,pre)
     for cy,crange in support_cues(pl):
      contexts.append(dict(page=pi,rect=fitz.Rect(pre.x0,cy-2,pre.x1,pre.y1),range=crange,implicit=False));break
    else:
     joined=' '.join(x['text'] for x in pl);rng=cue_range(joined)
     # Apoios independentes nas duas colunas têm faixas próprias.
     cues=[l for l in pl if cue_range(l['text'])]
     twocol=len(cues)>1 and max(l['rect'].x0 for l in cues)-min(l['rect'].x0 for l in cues)>150
     if twocol:
      for l in cues:
       isright=l['rect'].x0>page.rect.width*.4
       colleft=min(rightcols)-10 if isright else 20
       colright=page.rect.width-20 if isright else min(rightcols)-10
       first=min(hh['rect'].y0 for hh in headers if (hh['rect'].x0>page.rect.width*.4)==isright)
       contexts.append(dict(page=pi,rect=fitz.Rect(colleft,top,colright,first-3),range=cue_range(l['text']),implicit=False))
     else:contexts.append(dict(page=pi,rect=pre,range=rng or (headers[0]['number'],headers[-1]['number']),implicit=rng is None))
     if rng and headers[0]['rect'].x0>page.rect.width*.3:
      end=min([hh['rect'].y0-5 for hh in headers if hh['number']>rng[1] and hh['rect'].x0<headers[0]['rect'].x0-30] or [bottom])
      contexts.append(dict(page=pi,rect=fitz.Rect(20,headers[0]['rect'].y0-3,headers[0]['rect'].x0-10,end),range=rng,implicit=False))
   for hi,h in enumerate(headers):
    left=max(20,h['rect'].x0-10);right=min(page.rect.width-20,h['right']+2)
    later=[hh['rect'].y0-4 for hh in headers if hh['rect'].y0>h['rect'].y0+8 and min(right,hh['right'])-max(left,hh['rect'].x0)>40]
    end=min(later or [bottom])
    rect=fitz.Rect(left,h['rect'].y1+2,right,end)
    ll=segment_lines(page,rect);cues=support_cues(ll)
    for y,rng in cues:
     if y>rect.y0+10:
      contexts.append(dict(page=pi,rect=fitz.Rect(rect.x0,y-2,rect.x1,end),range=rng,implicit=False))
      following=[hh for hh in headers if rng[0]<=hh['number']<=rng[1] and hh['rect'].x0>page.rect.width*.4]
      if following and rect.x1>page.rect.width*.75:
       first=min(following,key=lambda z:z['number']);cx=first['rect'].x0-10
       ce=min([hh['rect'].y0-4 for hh in headers if hh['number']>rng[1] and hh['rect'].x0<cx-40] or [bottom])
       if ce>end:contexts.append(dict(page=pi,rect=fitz.Rect(rect.x0,end,cx,ce),range=rng,implicit=False))
      rect.y1=y-3;break
    markers=option_markers(page,rect);ors=option_rects(rect,markers);q=dict(number=h['number'],page=pi,rect=rect,markers=markers,optionRects=ors,hasAllOptions=len(markers)==5)
    questions[h['number']]=q;previous=q
  print('HEADERS',e['id'],len(questions),flush=True)
  assert set(questions)==set(range(1,e['count']+1)),(e['id'],'headers',sorted(questions))
  out=[]
  for n,q in sorted(questions.items()):
   pieces=[(q['page'],q['rect'])]
   nxt=questions.get(n+1)
   if not q['hasAllOptions'] and nxt:
    if nxt['page']==q['page'] and nxt['rect'].x0>q['rect'].x0+100:
     nr=nxt['rect'];nh=next(h for h in page_info[nxt['page']]['headers'] if h['number']==n+1)
     cr=fitz.Rect(nr.x0,20,nr.x1,nh['rect'].y0-4)
     if cr.height>5:pieces.append((nxt['page'],cr))
    elif nxt['page']>q['page']:
     nh=next(h for h in page_info[nxt['page']]['headers'] if h['number']==n+1)
     cr=fitz.Rect(nxt['rect'].x0,20,nxt['rect'].x1,nh['rect'].y0-4)
     if cr.height>5:pieces.append((nxt['page'],cr))
   main=[];plainparts=[];options=['']*5;optionsContent=[[] for _ in range(5)];seenlabels=set();current=None
   for piece_i,(page_i,rect) in enumerate(pieces):
    page=doc[page_i]
    rect=fitz.Rect(rect)
    # Não mistura apoio da próxima questão com a última alternativa de uma continuação.
    continuation_cues=support_cues(segment_lines(page,rect)) if piece_i else []
    if continuation_cues:rect.y1=min(y-3 for y,_ in continuation_cues)
    markers=option_markers(page,rect);ors=option_rects(rect,markers)
    first_y=min((r.y0-2 for r in markers.values()),default=rect.y1)
    stem=fitz.Rect(rect.x0,rect.y0,rect.x1,first_y)
    cc,txt=self.content(page,stem,f'{e["id"]}-q{n}-stem{piece_i}',visual_rect=rect)
    if current is None:main.extend(cc);plainparts.append(txt)
    else:optionsContent[current].extend(cc);options[current]+=' '+txt
    # Quando as alternativas ficam à direita, o enunciado/figura continua na coluna esquerda.
    if markers and min(r.x0 for r in markers.values())>rect.x0+100:
     lr=fitz.Rect(rect.x0,first_y,min(r.x0 for r in markers.values())-8,rect.y1)
     lc,lt=self.content(page,lr,f'{e["id"]}-q{n}-left{piece_i}')
     main.extend(lc);plainparts.append(lt)
    for c in sorted(markers):
     ci='ABCDE'.index(c);seenlabels.add(c)
     oc,ot=self.content(page,ors[c],f'{e["id"]}-q{n}-opt{c}-{piece_i}',option=True)
     ot=re.sub(r'^\('+c+r'\)\s*','',ot).strip()
     # O marcador já é apresentado pelo componente de alternativas.
     for block in oc:
      if block and block['type']=='html':block['html']=re.sub(r'\('+c+r'\)\s*','',block['html'],count=1)
     options[ci]+=(' '+ot if options[ci] else ot);optionsContent[ci].extend(x for x in oc if x);current=ci
   supports=[];contexttext=[]
   for i,c in enumerate(contexts):
    if c['range'][0]<=n<=c['range'][1]:
     cc,txt=self.content(doc[c['page']],c['rect'],f'{e["id"]}-ctx{i+1}');supports.extend(cc);contexttext.append(txt)
   for i in range(5):
    options[i]=norm(options[i]) or ('Expressão ou figura da alternativa '+'ABCDE'[i] if optionsContent[i] else '')
   if len(seenlabels)!=5 or any(not x for x in options):self.audit.append(dict(edition=e['id'],number=n,problem='options',found=sorted(seenlabels)))
   answer,area=keymap[n];plain=norm('\n'.join(plainparts))
   if e['id']=='2026-2' and n==8:
    fractions=[(1,2),(1,3),(1,6),(5,6),(5,12)]
    options=[str(a)+'/'+str(b) for a,b in fractions]
    optionsContent=[[dict(type='html',html=f'<p><math aria-label="{a} sobre {b}"><mfrac><mn>{a}</mn><mn>{b}</mn></mfrac></math></p>')] for a,b in fractions]
   if e['id']=='2023-2' and n==5:
    main.append(dict(type='html',html='<p><strong>Considere: 1 bar = 100 000 Pa.</strong></p>'))
    options=['5,0 × 10⁶','5,0 × 10⁵','5,0 × 10⁴','1,0 × 10⁵','1,0 × 10⁶'];optionsContent=[[dict(type='html',html='<p>'+o+'</p>')] for o in options]
   if e['id']=='2023-1' and n==30:
    figure=self.crop(doc[q['page']],fitz.Rect(365,59,557,259),'2023-1-q30-cartum')
    caption='We rarely back up our data. We prefer not to keep a permanent record of everything that goes wrong around here.'
    main=[dict(type='html',html='<p>Leia o cartum.</p>'),figure,dict(type='html',html='<p>“'+caption+'”</p><p>'+html.escape(plain.replace('Leia o cartum.','').strip())+'</p>')]
    options[4]='confia que seus dados não serão perdidos.';optionsContent[4]=[dict(type='html',html='<p>'+options[4]+'</p>')]
   if e['id']=='2024-2' and n==36:
    figure=self.crop(doc[q['page']],fitz.Rect(36,217.75,559.28,480.5),'2024-2-q36-cartaz')
    main=[figure,dict(type='html',html='<p>O texto apresentado pertence ao gênero</p>')]
   if not any(b['type']=='html' for b in supports+main):main.append(dict(type='html',html='<p>'+html.escape(plain)+'</p>'))
   out.append(dict(id=f'fatec-{e["id"]}-{n}',source='exam',edition=e['id'],number=n,page=q['page']+1,area=area,topic=f'FATEC {e["id"][:4]}/{e["id"][-1]} · questão {n}',text=plain,contextText=norm('\n'.join(contexttext)),content=supports+main,options=options,optionContent=optionsContent,correct='ABCDE'.index(answer) if answer in 'ABCDE' else None,cancelled=answer=='ANULADA',explanation='Questão anulada no gabarito oficial retificado; não entra no percentual de acertos.' if answer=='ANULADA' else 'Alternativa '+answer+' conforme o gabarito oficial'+(' retificado.' if e['rectified'] else '.')+' Esta questão tem conferência de gabarito, sem resolução comentada.'))
  (self.cache/(e['id']+'-partial.json')).write_text(json.dumps(out,ensure_ascii=False,indent=2))
  (self.cache/(e['id']+'-preambles.json')).write_text(json.dumps(preambles,ensure_ascii=False,indent=2))
  # A coletânea pode começar na última página de questões e continuar na seguinte.
  essay=[];started=False
  for pi in range(20,len(doc)-1):
   page=doc[pi];ll=lines_of(page);heads=[l for l in ll if 'PROPOSTA DE REDAÇÃO' in l['text']]
   if not started and not heads:continue
   if not started:
    started=True
    # Em páginas exclusivas da proposta, a coletânea às vezes precede o título.
    hasq=bool(headers_of(page,ll,e['count']))
    top=min(l['rect'].y0 for l in heads)-2 if hasq else 20
   else:top=20
   ec,_=self.content(page,fitz.Rect(20,top,page.rect.width-20,bottom_of(page,ll)),f'{e["id"]}-essay-{pi+1}')
   essay.extend(ec)
  return dict(id=e['id'],label=f'FATEC {e["id"][:4]} · {e["id"][-1]}º semestre',count=e['count'],keyUrl=e['keyUrl'],rectified=e['rectified'],uploadedFilename=e['filename'],sha256=hashlib.sha256(path.read_bytes()).hexdigest(),essay=dict(title='Proposta de redação · FATEC '+e['id'],content=essay)),out
 def restore_column_supports(self,questions):
  # Algumas páginas iniciam com questões na coluna direita e apoio na esquerda.
  # O topo desse apoio não antecede verticalmente o primeiro cabeçalho da página.
  for e in MANIFEST:
   doc=fitz.open(self.input_dir/e['filename'])
   for pi,page in enumerate(doc):
    lines=lines_of(page);headers=headers_of(page,lines,e['count'])
    for y,rng in support_cues(lines):
     missing=[q for q in questions if q['edition']==e['id'] and rng[0]<=q['number']<=rng[1] and not q['contextText']]
     if not missing:continue
     right=[h for h in headers if h['rect'].x0>page.rect.width*.45]
     if not right:continue
     split=min(h['rect'].x0 for h in right)-12
     end=min([h['rect'].y0-4 for h in headers if h['rect'].x0<split-40 and h['rect'].y0>y+10] or [bottom_of(page,lines)])
     rect=fitz.Rect(20,y-3,split,end)
     cc,txt=self.content(page,rect,f'{e["id"]}-column-context-p{pi+1}')
     for q in missing:q['content']=cc+q['content'];q['contextText']=txt
 def run(self):
  editions=[];questions=[]
  for e in MANIFEST:
   ed,qs=self.edition(e);editions.append(ed);questions.extend(qs);print(e['id'],len(qs),'empty text',sum(not q['text'] for q in qs),'empty alternatives',sum(not x for q in qs for x in q['options']),flush=True)
  self.restore_column_supports(questions)
  (self.outdir/'uploaded-exams.js').write_text('export const EXAM_EDITIONS = '+json.dumps(editions,ensure_ascii=False,indent=2)+';\nexport const EXAM_QUESTIONS = '+json.dumps(questions,ensure_ascii=False,indent=2)+';\n')
  (self.cache/'import-audit.json').write_text(json.dumps(self.audit,ensure_ascii=False,indent=2));(self.cache/'extracted-questions.json').write_text(json.dumps(questions,ensure_ascii=False,indent=2))
  print('TOTAL',len(questions),'assets',self.nassets,'audit',len(self.audit))
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--input-dir',type=Path,required=True);ap.add_argument('--cache-dir',type=Path,required=True);ap.add_argument('--output-dir',type=Path,default=ROOT/'public');args=ap.parse_args();Extractor(args.input_dir,args.cache_dir,args.output_dir).run()
