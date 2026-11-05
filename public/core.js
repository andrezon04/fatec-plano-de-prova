import {QUESTIONS,BY_ID,AREAS,isPlayableId} from './questions.js';
export const EXAM_DATE = '2026-12-13T13:00:00-03:00';
export const BASE_PLAN = [
  {id:'plan',name:'Leitura e plano',minutes:10,tip:'Leia a proposta de redação, localize as áreas e escolha por onde começar.'},
  {id:'first',name:'Primeira passada',minutes:100,tip:'Resolva as acessíveis. Se travar, marque para revisar e siga adiante.'},
  {id:'essay',name:'Redação',minutes:60,tip:'Planeje, escreva e revise. Reserve parte deste bloco para a versão definitiva.'},
  {id:'second',name:'Segunda passada',minutes:100,tip:'Volte às dúvidas, use eliminação e confira contas e interpretação.'},
  {id:'sheet',name:'Gabarito e conferência',minutes:30,tip:'Transfira com atenção ao número da questão e verifique os itens em branco.'}
];
export const DRAFT_FIRST_PLAN = [
  {id:'essay-draft',name:'Rascunho da redação',minutes:45,target:'essay',focus:'essay-draft',tip:'Leia a proposta e os textos de apoio, defina sua ideia central e escreva o rascunho completo. Deixe os ajustes finais para a volta.'},
  {id:'first',name:'Primeira passada nas questões',minutes:100,target:'questions',tip:'Resolva primeiro as questões acessíveis. Marque as dúvidas e siga sem ficar preso em uma só questão.'},
  {id:'essay-final',name:'Revisar e passar a limpo',minutes:30,target:'essay',focus:'essay-body',tip:'Releia o rascunho após a pausa, ajuste argumentos e linguagem e transcreva a versão definitiva com título. Confira a transcrição.'},
  {id:'second',name:'Segunda passada nas questões',minutes:95,target:'questions',tip:'Volte às dúvidas e às questões em branco. Confira cálculos e interpretação, respeitando a reserva para o gabarito.'},
  {id:'sheet',name:'Gabarito e conferência',minutes:30,target:'sheet',tip:'Transfira as respostas, confira a numeração e os itens em branco. Verifique se a redação definitiva está completa.'}
];
export function planFor(order='draft-first',total=300){
  const source=order==='draft-first'?DRAFT_FIRST_PLAN:BASE_PLAN;
  const plan=source.map(p=>({...p,minutes:p.minutes*total/300}));
  return order==='essay' ? [plan[0],plan[2],plan[1],plan[3],plan[4]] : plan;
}
export function migrateStrategy(state){
  if(state.strategyVersion===1)return false;
  state.order='draft-first';state.strategyVersion=1;
  // Sessões já iniciadas conservam o roteiro e o texto que estavam usando.
  return true;
}
export function remaining(s,now=Date.now()){
  if(!s)return 0;
  return Math.max(0,s.deadline-(s.pausedAt??now));
}
export function phaseAt(s,now=Date.now()){
  if(s.mode!=='simulation')return null;
  const elapsed=s.durationMs-remaining(s,now);let end=0;
  for(let i=0;i<s.plan.length;i++){end+=s.plan[i].minutes*60000;if(elapsed<end)return {...s.plan[i],index:i,remaining:Math.max(0,end-elapsed)};}
  return {...s.plan.at(-1),index:s.plan.length-1,remaining:0};
}
export function shuffled(items,rng=Math.random){
  const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;
}
export function questionPool({area='all',source='all',edition=null,includeCancelled=false}={}){
  return QUESTIONS.filter(q=>(includeCancelled||!q.cancelled)&&(area==='all'||q.area===area)&&(source==='all'||q.source===source)&&(!edition||q.edition===edition));
}
export function selectQuestions({area='all',source='all',edition=null,count=10,ids=null,full=false,seen={}},rng=Math.random){
  const pool=ids?[...new Set(ids)].filter(isPlayableId).map(id=>BY_ID[id]):questionPool({area,source,edition,includeCancelled:full});
  if(full){
    if(edition&&pool.length)return pool.sort((a,b)=>a.number-b.number).map(q=>q.id);
    return AREAS.flatMap(a=>selectQuestions({ids:pool.filter(q=>q.area===a.id).map(q=>q.id),count:a.count,seen},rng));
  }
  // Menos vistas primeiro. Entre exposições iguais, evita as mais recentes.
  return shuffled(pool.map(q=>q.id),rng).sort((a,b)=>(seen[a]?.count??0)-(seen[b]?.count??0)||(seen[a]?.last??0)-(seen[b]?.last??0)).slice(0,Math.min(count,pool.length));
}
export function miniQuestions(options={},rng=Math.random){
  if(typeof options==='function'){rng=options;options={};}
  const pool=questionPool(options),areas=[...new Set(pool.map(q=>q.area))];
  const ids=areas.map(area=>selectQuestions({...options,area,count:1},rng)[0]);
  for(const area of ['port','mat'])ids.push(selectQuestions({ids:pool.filter(q=>q.area===area&&!ids.includes(q.id)).map(q=>q.id),count:1,seen:options.seen},rng)[0]);
  return shuffled(ids,rng);
}
export function migrateSeen(state){
  if(state.seen&&typeof state.seen==='object')return state.seen;
  const seen={};
  for(const s of [...state.history].reverse().concat(state.active?[state.active]:[])){
    for(const id of s.qids??[])if(BY_ID[id])seen[id]={count:(seen[id]?.count??0)+1,last:s.started??s.ended??0};
  }
  state.seen=seen;return seen;
}
export function markSeen(state,ids,now=Date.now()){
  const seen=migrateSeen(state);
  for(const id of new Set(ids))if(BY_ID[id])seen[id]={count:(seen[id]?.count??0)+1,last:now};
}
export function migrateContent(state,now=Date.now()){
  migrateSeen(state);
  if(state.contentVersion===4)return false;
  state.legacyMistakes={...state.legacyMistakes};
  for(const [id,error] of Object.entries(state.legacyMistakes))if(isPlayableId(id)){
    if(!BY_ID[id].cancelled&&!state.mistakes[id])state.mistakes[id]=error;
    delete state.legacyMistakes[id];
  }
  for(const [id,error] of Object.entries(state.mistakes)){
    if(BY_ID[id]?.cancelled)delete state.mistakes[id];
    else if(!isPlayableId(id)){state.legacyMistakes[id]=error;delete state.mistakes[id];}
  }
  if(state.active?.qids.some(id=>!isPlayableId(id))){
    state.archivedSessions=[...(state.archivedSessions??[]),{...state.active,archivedAt:now}];state.active=null;
  }
  state.trainingSource='exam';state.trainingEdition=null;state.simEdition='2026-2';
  state.contentVersion=4;return true;
}

// Tempo ativo na questão: a interface decide quando iniciar/parar o foco.
export function questionTime(s,id,now=Date.now()){
  const base=s.questionTimes?.[id]??0,clock=s.questionClock;
  const end=Math.min(now,s.pausedAt??now,s.deadline??now);
  return base+(clock?.id===id?Math.max(0,end-clock.since):0);
}
export function settleQuestionTime(s,now=Date.now()){
  if(!s?.questionClock)return;
  const {id}=s.questionClock;
  s.questionTimes??={};s.questionTimes[id]=questionTime(s,id,now);
  s.questionClock.since=Math.min(now,s.pausedAt??now,s.deadline??now);
}
export function focusQuestion(s,id,now=Date.now()){
  if(!s)return;
  settleQuestionTime(s,now);
  if(!id||s.pausedAt||now>=s.deadline||!s.qids.includes(id)){s.questionClock=null;return;}
  s.questionTimes??={};s.questionTimes[id]??=0;s.questionClock={id,since:now};
}
export function scoreSession(s){
  const submitted=s.mode==='simulation'?s.sheet:s.answers;
  const rows=s.qids.map(id=>({id,answer:submitted[id]??null,draft:s.answers[id]??null,timeMs:s.questionTimes&&Object.hasOwn(s.questionTimes,id)?questionTime(s,id):null,assisted:!!s.revealed?.[id],cancelled:!!BY_ID[id].cancelled,correct:BY_ID[id].cancelled?null:submitted[id]===BY_ID[id].correct,flag:!!s.flags[id]}));
  const correct=rows.filter(r=>r.correct).length,cancelled=rows.filter(r=>r.cancelled).length,scorable=rows.length-cancelled;
  const blank=rows.filter(r=>!r.cancelled&&r.answer===null).length;
  return {rows,assisted:rows.filter(r=>r.assisted).length,correct,total:rows.length,scorable,cancelled,blank,incorrect:scorable-correct,percent:scorable?Math.round(correct/scorable*100):0,mismatches:s.mode==='simulation'?rows.filter(r=>!r.cancelled&&r.answer!==r.draft).length:0};
}
export function emptyState(){return {version:1,history:[],mistakes:{},active:null,order:'draft-first'};}
export function complete(state,now=Date.now(),expired=false){
  const s=state.active;if(!s)return null;
  settleQuestionTime(s,Math.min(now,s.deadline));s.questionClock=null;
  const result={...s,ended:now,expired,elapsedMs:Math.max(0,s.durationMs-remaining(s,now)),score:scoreSession(s)};
  for(const row of result.score.rows){
    if(row.cancelled)delete state.mistakes[row.id];
    else if(row.correct){if(!row.assisted)delete state.mistakes[row.id];}
    else state.mistakes[row.id]={id:row.id,answer:row.answer,timeMs:row.timeMs,assisted:row.assisted,at:now,sessionId:s.id};
  }
  state.history.unshift(result);state.history=state.history.slice(0,100);state.active=null;return result;
}
