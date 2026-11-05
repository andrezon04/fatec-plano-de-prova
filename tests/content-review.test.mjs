import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {EXAM_QUESTIONS,EXAM_EDITIONS} from '../public/uploaded-exams.js';
import {SOLUTIONS} from '../public/solutions.js';
const byId=Object.fromEntries(EXAM_QUESTIONS.map(q=>[q.id,q]));
const text=blocks=>blocks.filter(b=>b.type==='html').map(b=>b.html.replace(/<[^>]+>/g,'')).join(' ');
test('todas as 400 questões têm resolução de estudo sem confundir anulação com acerto',()=>{
 assert.equal(Object.keys(SOLUTIONS).length,400);
 for(const q of EXAM_QUESTIONS){assert.ok(SOLUTIONS[q.id].explanation.length>80,q.id);assert.equal(q.explanation,SOLUTIONS[q.id].explanation);assert.ok(!/sem resolução comentada/.test(q.explanation),q.id);}
 assert.match(SOLUTIONS['fatec-2023-2-39'].explanation,/anulada/i);
});
test('cada alternativa tem texto visível ou figura local e nenhum parágrafo vira expoente',()=>{
 for(const q of EXAM_QUESTIONS){
  assert.equal(q.optionContent.length,5,q.id);
  for(const bs of q.optionContent)assert.ok(bs.some(b=>b.type==='image'||text([b]).trim().length),q.id);
  for(const b of [...q.content,...q.optionContent.flat()]){
   if(b.type==='image'){assert.ok(existsSync(new URL('../public'+b.src,import.meta.url)),b.src);assert.ok(b.width>0&&b.height>0);}
   else {for(const m of b.html.matchAll(/<(sup|sub)>(.*?)<\/\1>/gs))assert.ok(m[2].replace(/<[^>]+>/g,'').length<=24,q.id);assert.ok(!/<script|onerror=|<iframe/i.test(b.html),q.id);}
  }
 }
});
test('captura do usuário 2023/2 q48: enunciado único e alternativa E nativa, sem rodapé',()=>{
 const q=byId['fatec-2023-2-48'],html=text(q.content);
 assert.equal((html.match(/Após receber o exercício/g)||[]).length,1);assert.match(html,/20 kWh/);assert.match(html,/900 segundos/);assert.ok(!/\([ABCDE]\)|VESTIBULAR/.test(html));assert.ok(q.optionContent.every(bs=>bs.every(b=>b.type==='html')));assert.match(text(q.optionContent[4]),/entregadores não usarem motos/);assert.equal(q.correct,1);
});
test('captura do usuário 2024/2 q23: alternativa C não contém a B e gráfico mantém extremos',()=>{
 const q=byId['fatec-2024-2-23'];assert.match(text(q.optionContent[2]),/193\/500/);assert.ok(!/2005|não positivos/.test(text(q.optionContent[2])));assert.ok(q.optionContent.every(bs=>bs.every(b=>b.type==='html')));assert.ok(q.content.some(b=>b.type==='image'&&/23,1.*54,1/.test(b.alt)));assert.equal(q.correct,2);
});
test('alternativas antes vazias nas questões visuais 2026/2-46 e 2026/1-48 agora são completas',()=>{
 assert.ok(byId['fatec-2026-2-46'].optionContent.every(bs=>bs.some(b=>b.type==='image')));
 const q=byId['fatec-2026-1-48'];assert.ok(q.optionContent.every(bs=>text(bs).trim()));assert.match(q.options.join(' '),/estrela|★/i);
});
test('calorimetria e planta baixa têm os dados visuais necessários',()=>{
 const q=byId['fatec-2023-2-40'];assert.match(text(q.content),/227 g/);assert.match(text(q.content),/280/);assert.equal(q.content.filter(b=>b.type==='image').length,2);assert.ok(byId['fatec-2023-1-43'].content.some(b=>b.type==='image'));
 for(const n of [20,21])assert.ok(byId[`fatec-2023-1-${n}`].content.some(b=>b.type==='image'));
});
