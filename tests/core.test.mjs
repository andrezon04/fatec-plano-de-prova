import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {EXAM_EDITIONS,EXAM_QUESTIONS} from '../public/uploaded-exams.js';
import assert from 'node:assert/strict';
import {QUESTIONS,AUTHOR_QUESTIONS,AREAS,BY_ID,isPlayableId} from '../public/questions.js';
import {planFor,remaining,phaseAt,selectQuestions,miniQuestions,scoreSession,emptyState,complete,questionPool,migrateSeen,markSeen,migrateContent,migrateStrategy} from '../public/core.js';
const sample=(overrides={})=>({id:'test',mode:'training',qids:['mat-1','port-1'],answers:{'mat-1':1},sheet:{},flags:{'port-1':true},deadline:120000,durationMs:120000,pausedAt:null,...overrides});
test('banco de 580 questões mantém as 60 iniciais e a integridade das alternativas',()=>{
 assert.equal(AUTHOR_QUESTIONS.length,60);assert.equal(QUESTIONS.length,580);assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,580);
 for(const a of AREAS)assert.equal(AUTHOR_QUESTIONS.filter(q=>q.area===a.id).length,a.count);
 for(const q of QUESTIONS){assert.equal(q.options.length,5);assert.ok(q.cancelled||Number.isInteger(q.correct)&&q.correct>=0&&q.correct<5);assert.ok(q.text&&q.explanation&&q.topic);}
});
test('seleção respeita área, não repete e limita ao banco disponível',()=>{const qs=selectQuestions({area:'bio',source:'author',count:10});assert.equal(qs.length,5);assert.ok(qs.every(id=>BY_ID[id].area==='bio'));assert.equal(new Set(qs).size,5);});
test('ensaio rápido tem 12 questões, cobre as dez áreas e não repete',()=>{const qs=miniQuestions();assert.equal(qs.length,12);assert.equal(new Set(qs).size,12);assert.equal(new Set(qs.map(id=>BY_ID[id].area)).size,10);});
test('ensaio completo usa 60 questões com a distribuição atual',()=>{assert.equal(selectQuestions({full:true}).length,60);});
test('ordens de estratégia totalizam 300 min e têm redação no lugar escolhido',()=>{for(const order of ['essay','questions']){const p=planFor(order);assert.equal(p.reduce((n,x)=>n+x.minutes,0),300);assert.equal(p[order==='essay'?1:2].id,'essay');}assert.equal(planFor('questions',30).reduce((n,x)=>n+x.minutes,0),30);});
test('relógio usa prazo absoluto e sobrevive a serialização',()=>{const s=JSON.parse(JSON.stringify(sample()));assert.equal(remaining(s,30000),90000);assert.equal(remaining(s,180000),0);});
test('pausa fixa o restante e retomada preserva o tempo',()=>{const s=sample({pausedAt:30000});assert.equal(remaining(s,100000),90000);s.deadline+=100000-s.pausedAt;s.pausedAt=null;assert.equal(remaining(s,100000),90000);});
test('etapa acompanha a passagem real do tempo',()=>{const s=sample({mode:'simulation',durationMs:18000000,deadline:18000000,plan:planFor('questions')});assert.equal(phaseAt(s,0).id,'plan');assert.equal(phaseAt(s,600000).id,'first');assert.equal(phaseAt(s,6600000).id,'essay');assert.equal(phaseAt(s,18000000).remaining,0);});
test('treino corrige respostas e conta branco e marcação',()=>{const score=scoreSession(sample());assert.equal(score.correct,1);assert.equal(score.blank,1);assert.equal(score.percent,50);assert.equal(score.rows[1].flag,true);});
test('simulação corrige somente o gabarito e mede diferenças de transcrição',()=>{const score=scoreSession(sample({mode:'simulation',answers:{'mat-1':1,'port-1':1},sheet:{'mat-1':0}}));assert.equal(score.correct,0);assert.equal(score.blank,1);assert.equal(score.mismatches,2);});
test('encerrar registra histórico, esvazia sessão e mantém só erros pendentes',()=>{const state=emptyState();state.mistakes['mat-1']={id:'mat-1'};state.active=sample();const h=complete(state,60000);assert.equal(h.elapsedMs,60000);assert.equal(state.active,null);assert.equal(state.history.length,1);assert.deepEqual(Object.keys(state.mistakes),['port-1']);assert.equal(state.mistakes['port-1'].answer,null);});
test('acertar erro em nova sessão remove-o do caderno; errar atualiza',()=>{const state=emptyState();state.mistakes['port-1']={id:'port-1',answer:0};state.active=sample({qids:['port-1'],answers:{'port-1':1}});complete(state,60000);assert.equal(Object.keys(state.mistakes).length,0);});
test('expiração usa tempo integral e não duplica encerramento',()=>{const state=emptyState();state.active=sample();const h=complete(state,180000,true);assert.equal(h.elapsedMs,120000);assert.equal(h.expired,true);assert.equal(complete(state,180000,true),null);assert.equal(state.history.length,1);});


test('transcrições substituem as antigas referências e preservam os gabaritos conferidos',()=>{
 const official=Object.values(BY_ID).filter(q=>q.source==='exam');assert.equal(official.length,400);assert.equal(questionPool({source:'official'}).length,0);
 for(const [edition,n] of [['2026-2',60],['2026-1',60],['2025-2',64]]){
  const qs=official.filter(q=>q.edition===edition);assert.equal(qs.length,n);
  assert.deepEqual(qs.map(q=>q.number),Array.from({length:n},(_,i)=>i+1));
  assert.ok(qs.every(q=>q.page>=2&&q.page<=22&&q.options.length===5));
 }
 // Pontos conferidos separadamente nos gabaritos oficiais consultados.
 assert.equal(BY_ID['fatec-2026-2-1'].correct,3);assert.equal(BY_ID['fatec-2026-2-60'].correct,3);
 assert.equal(BY_ID['fatec-2026-1-1'].correct,2);assert.equal(BY_ID['fatec-2026-1-60'].correct,1);
 assert.equal(BY_ID['fatec-2025-2-1'].correct,2);assert.equal(BY_ID['fatec-2025-2-64'].correct,4);
 assert.equal(BY_ID['fatec-2026-2-7'].area,'mat');assert.equal(BY_ID['fatec-2026-1-7'].area,'fis');
});
test('cada treino novo contém 60 questões na distribuição atual',()=>{
 for(const edition of ['practice-a','practice-b']){const ids=selectQuestions({full:true,source:'practice',edition});assert.equal(ids.length,60);assert.deepEqual(ids.map(id=>BY_ID[id].number),Array.from({length:60},(_,i)=>i+1));for(const a of AREAS)assert.equal(ids.filter(id=>BY_ID[id].area===a.id).length,a.count);}
});
test('nenhuma questão repete antes de esgotar o filtro, inclusive entre sessões',()=>{
 const state=emptyState();let now=1;const taken=[];
 const size=questionPool({source:'practice',area:'mat'}).length;
 while(taken.length<size){const ids=selectQuestions({source:'practice',area:'mat',count:Math.min(4,size-taken.length),seen:state.seen});assert.ok(ids.every(id=>!taken.includes(id)));taken.push(...ids);markSeen(state,ids,now++);}
 assert.equal(new Set(taken).size,size);
});
test('com poucas inéditas, completa a rodada sem duplicar e usa as menos vistas',()=>{
 const ids=['mat-1','mat-2','mat-3','mat-4'];const seen={'mat-1':{count:3,last:1},'mat-2':{count:1,last:20},'mat-3':{count:1,last:10}};
 assert.deepEqual(selectQuestions({ids,count:4,seen},()=>0.5),['mat-4','mat-3','mat-2','mat-1']);
});
test('migração preserva histórico, sessão e erros e contabiliza exposições anteriores uma vez',()=>{
 const state=emptyState();state.history=[{qids:['mat-1','port-1'],started:10},{qids:['mat-1'],started:5}];state.active={qids:['bio-1'],started:20};state.mistakes={'port-1':{answer:0}};
 migrateSeen(state);assert.equal(state.seen['mat-1'].count,2);assert.equal(state.seen['mat-1'].last,10);assert.equal(state.seen['bio-1'].count,1);migrateSeen(state);assert.equal(state.seen['mat-1'].count,2);assert.equal(state.history.length,2);assert.equal(state.mistakes['port-1'].answer,0);
});
test('ensaio rápido respeita caderno escolhido e cobre todas as áreas',()=>{
 const ids=miniQuestions({source:'practice',edition:'practice-b'});assert.equal(ids.length,12);assert.ok(ids.every(id=>BY_ID[id].edition==='practice-b'));assert.equal(new Set(ids.map(id=>BY_ID[id].area)).size,10);
});
test('gabarito oficial corrige marcação correta e distingue erro de transcrição',()=>{
 const s=sample({mode:'simulation',qids:['fatec-2026-2-1'],answers:{'fatec-2026-2-1':3},sheet:{'fatec-2026-2-1':3}});assert.equal(scoreSession(s).correct,1);s.sheet['fatec-2026-2-1']=0;assert.equal(scoreSession(s).correct,0);assert.equal(scoreSession(s).mismatches,1);
});


test('todos os novos exercícios exibem enunciado, alternativas e explicação independentes de arquivos externos',()=>{
 assert.equal(questionPool({source:'practice'}).length,120);
 for(const q of QUESTIONS.filter(q=>q.source!=='exam')){
  assert.ok(q.text.length>=35,q.id);assert.ok(q.explanation.length>=40,q.id);
  assert.equal(new Set(q.options).size,5,q.id);assert.ok(q.options.every(o=>o.trim().length>0),q.id);
  assert.ok(!/Consulte a questão|Alternativa [A-E] do caderno|https?:|\.pdf/i.test(q.text+' '+q.options.join(' ')),q.id);
  if(q.table){assert.ok(q.table.caption);assert.ok(q.table.rows.length>=3);assert.ok(q.table.rows.every(r=>r.length===q.table.headers.length));}
 }
 const practice=questionPool({source:'practice'});for(const n of [0,1,2,3,4])assert.equal(practice.filter(q=>q.correct===n).length,24);
 assert.equal(new Set(QUESTIONS.filter(q=>q.source!=='exam').map(q=>q.text)).size,180);
});
test('respostas dos 16 problemas novos de matemática correspondem a cálculos independentes',()=>{
 const checks=[
  [1,360/12*25,'750'],[2,1500*(1+0.02*4),'R$ 1.620'],[3,24/(0.5-0.2),'80 páginas'],
  [4,4/6,'2/3'],[5,Math.hypot(1.5,2),'2,5 m'],[6,(2*6+9)/3,'7'],[7,200*2**3,'1.600'],
  [8,40*25*30/1000,'30 litros'],[9,(450-15*20)/(30-15),'10'],[10,180/1.2,'R$ 150'],
  [11,81+27+9+3,'120'],[12,3*10*10,'300'],[13,12/2,'6'],[14,4*0.5,'2 m'],[15,200*0.6*0.25,'30'],[16,18-12,'6 °C']
 ];
 const numeric=[750,1620,80,2/3,2.5,7,1600,30,10,150,120,300,6,2,30,6];
 checks.forEach(([n,v,text],i)=>{assert.ok(Math.abs(v-numeric[i])<1e-9);const q=BY_ID[`practice-mat-${n}`];assert.equal(q.options[q.correct],text,q.id);});
});
test('respostas dos problemas novos de física e química respeitam unidades e relações utilizadas',()=>{
 const checks=[['fis',1,(10-4)/3,2,'2 m/s²'],['fis',2,40*5,200,'200 J'],['fis',3,200*0.5*10,1000,'1.000 cal'],['fis',4,24/(4+8),2,'2 A'],['fis',6,540/200,2.7,'2,7 g/cm³'],['fis',7,3*10*2,60,'60 J'],['fis',8,350/500,0.7,'70%'],['fis',9,340*3,1020,'1.020 m'],['fis',10,600/0.03,20000,'20.000 Pa'],['qui',1,0.4*100/400,0.1,'0,1 mol/L'],['qui',2,117/58.5,2,'2 mol'],['qui',4,25-12,13,'13'],['qui',8,80-30*2,20,'20 g'],['qui',10,1*6/3,2,'2 L']];
 for(const [area,n,v,expected,text] of checks){assert.ok(Math.abs(v-expected)<1e-9);const q=BY_ID[`practice-${area}-${n}`];assert.equal(q.options[q.correct],text,q.id);}
});
test('questões transcritas podem ser sorteadas e refeitas',()=>{
 const ids=selectQuestions({ids:['fatec-2026-1-1','mat-1','practice-bio-1'],count:10});assert.deepEqual(new Set(ids),new Set(['fatec-2026-1-1','mat-1','practice-bio-1']));assert.ok(ids.every(isPlayableId));
});
test('migração mantém sessão oficial, rascunhos, respostas e histórico e restaura erros arquivados',()=>{
 const state=emptyState();state.contentVersion=3;state.active=sample({qids:['fatec-2026-1-1'],answers:{'fatec-2026-1-1':2},essay:{title:'Título preservado',body:'Texto preservado',checks:[true]}});
 state.history=[{id:'concluida',qids:['mat-1'],score:{correct:1},started:10}];state.legacyMistakes={'fatec-2026-1-1':{id:'fatec-2026-1-1',answer:0}};
 const history=JSON.stringify(state.history);assert.equal(migrateContent(state,123),true);assert.equal(state.active.essay.body,'Texto preservado');assert.equal(state.active.answers['fatec-2026-1-1'],2);assert.equal(JSON.stringify(state.history),history);assert.equal(state.mistakes['fatec-2026-1-1'].answer,0);assert.equal(state.trainingSource,'exam');assert.equal(state.simEdition,'2026-2');assert.equal(migrateContent(state),false);
});
test('migração deixa sessões das questões iniciais em andamento',()=>{
 const state=emptyState();state.active=sample();state.active.essay={body:'meu texto'};migrateContent(state);assert.equal(state.active.id,'test');assert.equal(state.active.answers['mat-1'],1);assert.equal(state.active.essay.body,'meu texto');
});

test('sete arquivos somam 400 questões completas e gabaritos rastreáveis',()=>{
 assert.equal(EXAM_EDITIONS.length,7);assert.equal(EXAM_QUESTIONS.length,400);
 for(const e of EXAM_EDITIONS){assert.equal(EXAM_QUESTIONS.filter(q=>q.edition===e.id).length,e.count);assert.match(e.sha256,/^[a-f0-9]{64}$/);assert.ok(e.essay.content.length);assert.match(e.keyUrl,/^https:\/\/fatweb/);}
 for(const q of EXAM_QUESTIONS){assert.ok(q.text.trim(),q.id);assert.equal(q.options.length,5);assert.equal(q.optionContent.length,5);assert.ok(q.optionContent.every(b=>b.length),q.id);assert.ok(q.content.some(b=>b.type==='html'),q.id);assert.equal(BY_ID[q.id].source,'exam');
  for(const b of [...q.content,...q.optionContent.flat()]){
   if(b.type==='html')assert.ok(!/<(?:script|iframe|object|embed)\b|onerror=|javascript:/i.test(b.html),q.id);
   else {assert.match(b.src,/^\/assets\/exams\/[a-zA-Z0-9-]+\.webp$/);assert.ok(existsSync(new URL('../public'+b.src,import.meta.url)),b.src);}
  }
 }
 assert.equal(EXAM_QUESTIONS.filter(q=>q.cancelled).length,1);assert.equal(BY_ID['fatec-2024-2-44'].correct,2);
});
test('cadernos históricos preservam ordem, quantidade e questão anulada',()=>{
 for(const e of EXAM_EDITIONS){const ids=selectQuestions({source:'exam',edition:e.id,full:true});assert.equal(ids.length,e.count);assert.deepEqual(ids.map(id=>BY_ID[id].number),Array.from({length:e.count},(_,i)=>i+1));}
 assert.equal(questionPool({source:'exam'}).length,399);assert.ok(!selectQuestions({source:'exam',count:400}).some(id=>BY_ID[id].cancelled));
});
test('anulada não vira erro, branco, divergência ou parte do percentual',()=>{
 const id='fatec-2023-2-39',s=sample({mode:'simulation',qids:[id,'mat-1'],sheet:{'mat-1':1},answers:{[id]:0,'mat-1':1}}),state=emptyState();state.active=s;state.mistakes[id]={id};
 const score=scoreSession(s);assert.equal(score.total,2);assert.equal(score.scorable,1);assert.equal(score.cancelled,1);assert.equal(score.percent,100);assert.equal(score.blank,0);assert.equal(score.mismatches,0);complete(state,60000);assert.equal(Object.keys(state.mistakes).length,0);
});
test('textos contínuos e apoios visuais chegam às questões correspondentes',()=>{
 assert.match(BY_ID['fatec-2024-1-3'].text,/esse importante patrimônio/);
 assert.match(BY_ID['fatec-2023-1-23'].text,/sensores/);
 for(let n=7;n<=10;n++){const q=BY_ID[`fatec-2026-2-${n}`];assert.match(q.contextText,/radar/);assert.ok(q.content.some(b=>b.type==='image'));}
 for(const n of [52,53])assert.match(BY_ID[`fatec-2026-1-${n}`].contextText,/tirinha/);
 for(const n of [54,55])assert.match(BY_ID[`fatec-2026-1-${n}`].contextText,/meme/);
 assert.ok(!BY_ID['fatec-2024-2-25'].options[4].includes('Galeano'));
 for(const q of EXAM_QUESTIONS)assert.ok(!q.options.some(o=>o.includes('PROPOSTA DE REDAÇÃO')),q.id);
});
test('interface usa enunciado e alternativas nativos, sem leitor de PDF',()=>{
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');assert.ok(!/<iframe|<object|<embed/.test(app));assert.match(app,/stemHTML\(q\)/);assert.match(app,/optionHTML\(q,i\)/);
});
test('frações compactas preservam numerador e denominador de cada alternativa',()=>{
 const q=BY_ID['fatec-2026-2-8'];assert.deepEqual(q.options,['1/2','1/3','1/6','5/6','5/12']);assert.ok(q.optionContent.every(bs=>bs[0].html.includes('<mfrac>')));
});
test('apoios de colunas à esquerda chegam a todas as questões da faixa',()=>{
 for(const [edition,nums] of [['2023-2',[6,7,36,37,39,40,41]],['2023-1',[12,13,15,16]]])for(const n of nums){const q=BY_ID[`fatec-${edition}-${n}`];assert.ok(q.contextText.length>100,q.id);}
 for(const n of [39,40,41])assert.ok(BY_ID[`fatec-2023-2-${n}`].content.some(b=>b.type==='image'));
});

test('rascunho primeiro separa escrita inicial e transcrição e reserva 5 horas',()=>{
 const p=planFor();assert.deepEqual(p.map(s=>s.id),['essay-draft','first','essay-final','second','sheet']);assert.deepEqual(p.map(s=>s.minutes),[45,100,30,95,30]);assert.equal(p.reduce((n,s)=>n+s.minutes,0),300);
 const mini=planFor('draft-first',30);assert.deepEqual(mini.map(s=>s.minutes),[4.5,10,3,9.5,3]);assert.equal(mini.reduce((n,s)=>n+s.minutes,0),30);
});
test('limites do cronômetro conduzem do rascunho à transcrição e ao gabarito',()=>{
 const s=sample({mode:'simulation',durationMs:18000000,deadline:18000000,plan:planFor()});
 for(const [minute,id] of [[0,'essay-draft'],[44.99,'essay-draft'],[45,'first'],[145,'essay-final'],[175,'second'],[270,'sheet']])assert.equal(phaseAt(s,minute*60000).id,id);
 assert.equal(phaseAt(s,145*60000).focus,'essay-body');
});
test('nova preferência preserva plano ativo, histórico e redações existentes',()=>{
 const state=emptyState();state.order='questions';state.active=sample({plan:planFor('questions'),essay:{body:'Texto antigo',draft:'Rascunho novo'}});state.history=[{id:'salvo',essay:{body:'Final anterior'}}];const old=JSON.stringify({active:state.active,history:state.history});
 assert.equal(migrateStrategy(state),true);assert.equal(state.order,'draft-first');assert.equal(JSON.stringify({active:state.active,history:state.history}),old);state.order='questions';assert.equal(migrateStrategy(state),false);assert.equal(state.order,'questions');
});
test('rascunho e texto definitivo permanecem separados após encerrar e serializar',()=>{
 const state=emptyState();state.active=sample({essay:{title:'Tema',draft:'Ideias do rascunho',body:'Texto revisado',checks:[true,false,false,true]}});complete(state,60000);const h=JSON.parse(JSON.stringify(state)).history[0];assert.equal(h.essay.draft,'Ideias do rascunho');assert.equal(h.essay.body,'Texto revisado');
});
