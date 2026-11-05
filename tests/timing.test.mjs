import test from 'node:test';
import assert from 'node:assert/strict';
import {focusQuestion,questionTime,settleQuestionTime,complete,emptyState,scoreSession} from '../public/core.js';
const session=()=>({id:'timer',mode:'training',qids:['mat-1','port-1'],answers:{'mat-1':1},sheet:{},flags:{},deadline:120000,durationMs:120000,pausedAt:null});
test('tempo individual soma revisitas sem contar outra questão',()=>{const s=session();focusQuestion(s,'mat-1',0);assert.equal(questionTime(s,'mat-1',10000),10000);focusQuestion(s,'port-1',10000);focusQuestion(s,'mat-1',15000);assert.equal(questionTime(s,'mat-1',22000),17000);assert.equal(questionTime(s,'port-1',22000),5000);});
test('redação, gabarito, página oculta e pausa param o foco sem zerar o acumulado',()=>{const s=session();focusQuestion(s,'mat-1',0);focusQuestion(s,null,12000);assert.equal(questionTime(s,'mat-1',50000),12000);focusQuestion(s,'mat-1',50000);s.pausedAt=55000;focusQuestion(s,null,55000);assert.equal(questionTime(s,'mat-1',80000),17000);});
test('checkpoint não duplica tempo e recarga não conta período offline',()=>{const s=session();focusQuestion(s,'mat-1',0);settleQuestionTime(s,10000);assert.equal(questionTime(s,'mat-1',20000),20000);const saved=JSON.parse(JSON.stringify(s));saved.questionClock=null;assert.equal(questionTime(saved,'mat-1',80000),10000);focusQuestion(saved,'mat-1',80000);assert.equal(questionTime(saved,'mat-1',90000),20000);});
test('expiração limita contagem e mantém tempos por questão no resultado',()=>{const state=emptyState();state.active=session();focusQuestion(state.active,'mat-1',0);const h=complete(state,150000,true);assert.equal(h.score.rows[0].timeMs,120000);assert.equal(h.questionClock,null);assert.equal(h.score.rows[1].timeMs,null);});
test('consulta de explicação fica identificada como estudo com ajuda',()=>{const s=session();s.revealed={'mat-1':true};const score=scoreSession(s);assert.equal(score.assisted,1);assert.equal(score.rows[0].assisted,true);assert.equal(score.correct,1);});
test('acerto após abrir explicação não apaga um erro pendente como se fosse independente',()=>{
 const state=emptyState();state.mistakes['mat-1']={id:'mat-1',answer:0};state.active=session();state.active.revealed={'mat-1':true};complete(state,60000);assert.ok(state.mistakes['mat-1']);
 state.active=session();complete(state,60000);assert.ok(!state.mistakes['mat-1']);
});
