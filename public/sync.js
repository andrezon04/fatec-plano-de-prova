export const SYNC_KEY = 'fatec-prep-2027-sync-v1';
const BACKUP_KEY = 'fatec-prep-2027-device-backups-v1';
export function snapshot(state) {
  const s = JSON.parse(JSON.stringify(state));
  if (s.active) s.active.questionClock = null;
  return s;
}
const encode = s => JSON.stringify(snapshot(s));
export const hasProgress = s => !!(s?.active || s?.history?.length || Object.keys(s?.mistakes ?? {}).length || s?.archivedSessions?.length || Object.keys(s?.seen ?? {}).length);

// Whole-snapshot CAS deliberately asks on divergent edits instead of guessing
// which answer or essay paragraph to discard. Local work always remains usable.
export class ProgressSync {
  constructor({getState, applyState, storage, onStatus = () => {}, fetcher = (...args) => fetch(...args)}) {
    Object.assign(this, {getState, applyState, storage, onStatus, fetcher});
    this.meta = {revision:0, base:null}; this.status = {kind:'loading'};
    try {const m=JSON.parse(storage.getItem(SYNC_KEY)); if(Number.isSafeInteger(m?.revision)&&m.revision>=0&&typeof m.base==='string')this.meta=m;} catch {}
  }
  setStatus(kind, extra={}) {this.status={kind,...extra};this.onStatus(this.status);}
  saveMeta() {try {this.storage.setItem(SYNC_KEY, JSON.stringify(this.meta));} catch {this.setStatus('local-error');}}
  backup(state, label) {
    const value = {at:Date.now(), label, state:snapshot(state)};
    try {const old=JSON.parse(this.storage.getItem(BACKUP_KEY)||'[]');this.storage.setItem(BACKUP_KEY,JSON.stringify([value,...old].slice(0,5)));}
    catch {return false;} return true;
  }
  localBackups() {try {return JSON.parse(this.storage.getItem(BACKUP_KEY)||'[]');} catch {return [];}}
  touch() {
    if(this.conflict) {this.setStatus('conflict');return;}
    this.setStatus('pending');clearTimeout(this.timer);
    this.timer=setTimeout(()=>this.sync(),700);
  }
  async request(method='GET', body, suffix='') {
    const r=await this.fetcher('/api/progress'+suffix,{method, credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{}, ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
    if(r.status===401)throw Object.assign(new Error('signin'),{kind:'signin'});
    const data=await r.json();
    if(!r.ok&&r.status!==409)throw Object.assign(new Error(data.error),{kind:r.status===413?'too-large':'offline'});
    return {data, conflict:r.status===409};
  }
  accept(remote, apply=false) {
    if(apply) this.applyState(snapshot(remote.state));
    this.meta={revision:remote.revision, base:encode(remote.state), accountId:remote.accountId??this.meta.accountId,updatedAt:remote.updatedAt};
    this.saveMeta();this.setStatus('synced',{at:remote.updatedAt});
  }
  showConflict(remote) {this.conflict=remote;this.setStatus('conflict');}
  async sync() {
    if(this.busy||this.conflict)return;
    clearTimeout(this.timer);this.busy=true;
    try {
      const {data:remote}=await this.request();
      let local=snapshot(this.getState()), text=encode(local);
      if(remote.state && this.meta.accountId && remote.accountId!==this.meta.accountId) {this.showConflict(remote);return;}
      if(remote.state && encode(remote.state)===text) {this.accept(remote);return;}
      if(remote.state && remote.revision!==this.meta.revision) {
        const clean=text===this.meta.base || (!this.meta.base&&!hasProgress(local));
        if(clean) {this.accept(remote,true);return;}
        this.showConflict(remote);return;
      }
      if(!remote.state && !hasProgress(local) && !this.meta.base) {this.setStatus('synced');return;}
      if(text===this.meta.base && remote.revision===this.meta.revision) {this.setStatus('synced',{at:remote.updatedAt});return;}
      // A vanished cloud row must never silently replace an older known revision.
      if(remote.revision!==this.meta.revision) {this.showConflict(remote);return;}
      this.setStatus('saving');
      const response=await this.request('PUT',{revision:remote.revision,state:local});
      if(response.conflict) {this.showConflict({...response.data,accountId:remote.accountId});return;}
      this.meta={revision:response.data.revision,base:text,accountId:remote.accountId,updatedAt:response.data.updatedAt};
      this.saveMeta();
      if(encode(this.getState())!==text)this.touch();else this.setStatus('synced',{at:response.data.updatedAt});
    } catch(error) {this.setStatus(error.kind??'offline');}
    finally {this.busy=false;}
  }
  async resolve(choice) {
    if(!this.conflict||this.busy)return;
    const oldRemote=this.conflict;
    // Keep recoverable copies before either explicit choice.
    if(!this.backup(this.getState(),'Antes de resolver diferenças')) {this.setStatus('local-error');return;}
    if(oldRemote.state&&!this.backup(oldRemote.state,'Cópia da conta antes da escolha')) {this.setStatus('local-error');return;}
    if(choice==='cloud') {
      if(!oldRemote.state)return;
      this.conflict=null;this.accept(oldRemote,true);await this.sync();
    } else if(choice==='local') {
      this.meta={revision:oldRemote.revision,base:oldRemote.state?encode(oldRemote.state):null,accountId:oldRemote.accountId};
      this.conflict=null;this.saveMeta();await this.sync();
    }
  }
  async cloudBackups() {return (await this.request('GET',null,'?backups=1')).data.backups;}
  async restoreCloud(revision) {
    const {data}=await this.request('GET',null,'?backup='+encodeURIComponent(revision));
    if(!this.backup(this.getState(),'Antes de recuperar cópia'))throw new Error('local_backup_failed');
    this.applyState(snapshot(data.state));this.touch();await this.sync();
  }
  async restoreLocal(index) {
    const backup=this.localBackups()[index];if(!backup)return;
    if(!this.backup(this.getState(),'Antes de recuperar cópia local'))throw new Error('local_backup_failed');
    this.applyState(snapshot(backup.state));this.touch();await this.sync();
  }
}
