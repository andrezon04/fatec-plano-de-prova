import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {handleProgress} from '../lib/progress.mjs';
import {ProgressSync, snapshot} from '../public/sync.js';
import {emptyState} from '../public/core.js';

let mf,db;
before(async()=>{
 mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-05-15',d1Databases:['DB'],cf:false});
 db=await mf.getD1Database('DB');
 const migration=readFileSync(new URL('../drizzle/0000_rainy_redwing.sql',import.meta.url),'utf8');
 for(const sql of migration.split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
});
after(async()=>{await mf?.dispose();});
const state=(n=0)=>({...emptyState(),mistakes:n?{['mat-'+n]:{id:'mat-'+n,answer:1}}:{}});
const put=(s,revision=0,origin='https://fatec.test')=>new Request('https://fatec.test/api/progress',{method:'PUT',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({state:s,revision})});
const get=(suffix='')=>new Request('https://fatec.test/api/progress'+suffix);
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
function device(user,initial=emptyState(),storage=memory()) {
 let value=initial,offline=false;
 const sync=new ProgressSync({getState:()=>value,applyState:s=>{value=s;},storage,fetcher:async(path,options)=>{
  if(offline)throw new TypeError('Offline');
  const headers=new Headers(options.headers);headers.set('Origin','https://fatec.test');
  return handleProgress(new Request('https://fatec.test'+path,{...options,headers}),db,user);
 }});
 return {sync,storage,get value(){return value;},edit:s=>{value=s;},offline:v=>{offline=v;}};
}
test('API refuses anonymous, cross-origin writes, malformed and oversized payloads',async()=>{
 assert.equal((await handleProgress(get(),db,null)).status,401);
 assert.equal((await handleProgress(put(state(),0,'https://evil.test'),db,'security')).status,403);
 assert.equal((await handleProgress(put({version:1},0),db,'security')).status,400);
 const req=put(state());req.headers.set('Content-Length','5000000');assert.equal((await handleProgress(req,db,'security')).status,413);
 assert.equal((await handleProgress(get(),null,'security')).status,503);
});
test('server isolates users and compare-and-swap rejects stale and simultaneous saves',async()=>{
 assert.equal((await handleProgress(put(state(1)),db,'a')).status,200);
 const results=await Promise.all([handleProgress(put(state(2),1),db,'a'),handleProgress(put(state(3),1),db,'a')]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 assert.equal((await (await handleProgress(get(),db,'b')).json()).state,null);
 assert.equal((await handleProgress(get('?backup=1'),db,'b')).status,404);
 assert.equal((await (await handleProgress(get('?backup=1'),db,'a')).json()).state.mistakes['mat-1'].answer,1);
});
test('old device uploads once; a clean second device pulls responses, essay, flags and timer',async()=>{
 const s=state(5);s.active={id:'session',mode:'simulation',qids:['mat-1'],answers:{'mat-1':3},sheet:{'mat-1':3},flags:{'mat-1':true},started:100,deadline:9999999999999,durationMs:1800000,current:0,questionTimes:{'mat-1':15000},questionClock:{id:'mat-1',since:100},essay:{title:'Meu título',draft:'Rascunho',body:'Texto definitivo',checks:[true,false,false,false]}};
 const a=device('migration',s),b=device('migration');await a.sync.sync();await b.sync.sync();
 assert.equal(a.sync.status.kind,'synced');assert.deepEqual(b.value,snapshot(s));
 assert.equal(b.value.active.questionClock,null);assert.equal(b.value.active.questionTimes['mat-1'],15000);
});
test('online edits move both directions; offline edits retry without loss',async()=>{
 const a=device('bidirectional',state(1)),b=device('bidirectional');await a.sync.sync();await b.sync.sync();
 b.edit(state(2));await b.sync.sync();await a.sync.sync();assert.deepEqual(a.value,state(2));
 a.offline(true);a.edit(state(3));await a.sync.sync();assert.equal(a.sync.status.kind,'offline');assert.deepEqual(a.value,state(3));
 a.offline(false);await a.sync.sync();await b.sync.sync();assert.deepEqual(b.value,state(3));
});
test('conflicting offline and first-import copies require explicit choice and preserve backups',async()=>{
 const a=device('conflicts',state(1)),b=device('conflicts',state(2));await a.sync.sync();await b.sync.sync();
 assert.equal(b.sync.status.kind,'conflict');assert.deepEqual(b.value,state(2));
 await b.sync.resolve('local');assert.equal(b.sync.status.kind,'synced');await a.sync.sync();assert.deepEqual(a.value,state(2));
 assert.equal(b.sync.localBackups().length,2);assert.ok(b.sync.localBackups().some(x=>x.state.mistakes['mat-1']));
 a.edit(state(3));b.edit(state(4));await a.sync.sync();await b.sync.sync();assert.equal(b.sync.status.kind,'conflict');
 await b.sync.resolve('cloud');assert.deepEqual(b.value,state(3));assert.ok(b.sync.localBackups().some(x=>x.state.mistakes['mat-4']));
});
test('a restored cloud backup is a new revision; old copies stay user-scoped',async()=>{
 const a=device('restore',state(1));await a.sync.sync();a.edit(state(2));await a.sync.sync();
 const backups=await a.sync.cloudBackups();assert.equal(backups[0].revision,1);
 await a.sync.restoreCloud(1);clearTimeout(a.sync.timer);assert.deepEqual(a.value,state(1));assert.equal(a.sync.meta.revision,3);
 assert.ok(a.sync.localBackups()[0].state.mistakes['mat-2']);
});
test('an edit made during an upload is saved in a subsequent upload',async()=>{
 let s=state(1),wait,entered;
 const gate=new Promise(r=>wait=r),entry=new Promise(r=>entered=r);let first=true;
 const sync=new ProgressSync({getState:()=>s,applyState:x=>s=x,storage:memory(),fetcher:async(path,opts)=>{
  if(opts.method==='PUT'&&first){first=false;entered();await gate;}
  const headers=new Headers(opts.headers);headers.set('Origin','https://fatec.test');return handleProgress(new Request('https://fatec.test'+path,{...opts,headers}),db,'inflight');
 }});
 const p=sync.sync();await entry;s=state(2);wait();await p;clearTimeout(sync.timer);await sync.sync();
 assert.equal(sync.meta.revision,2);assert.deepEqual((await (await handleProgress(get(),db,'inflight')).json()).state,state(2));
});
