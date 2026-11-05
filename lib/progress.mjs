const MAX_BYTES = 4 * 1024 * 1024;
const json = (data, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff'}});
const record = x => x && typeof x === 'object' && !Array.isArray(x);

export function validState(s) {
  if (!record(s) || s.version !== 1 || !Array.isArray(s.history) || s.history.length > 100 || !record(s.mistakes)) return false;
  const sessions = [...s.history, ...(s.active ? [s.active] : [])];
  return sessions.every(x => record(x) && typeof x.id === 'string' && x.id.length <= 200 && ['training', 'simulation'].includes(x.mode)
    && Array.isArray(x.qids) && x.qids.length <= 600 && x.qids.every(id => typeof id === 'string' && id.length < 100)
    && record(x.answers) && record(x.sheet) && record(x.flags)
    && Number.isFinite(x.started) && Number.isFinite(x.deadline) && Number.isFinite(x.durationMs)
    && (!x.essay || (record(x.essay) && typeof x.essay.title === 'string' && typeof x.essay.body === 'string' && Array.isArray(x.essay.checks)))
    && (!x.ended || (record(x.score) && Array.isArray(x.score.rows))));
}

async function current(db, userId) {
  const row = await db.prepare('SELECT revision, state, updated_at FROM progress WHERE user_id = ?').bind(userId).first();
  return row ? {revision: row.revision, state: JSON.parse(row.state), updatedAt: row.updated_at} : {revision: 0, state: null, updatedAt: null};
}

export async function handleProgress(request, db, userId) {
  if (!userId) return json({error: 'sign_in_required'}, 401);
  if (!db) return json({error: 'storage_unavailable'}, 503);
  try {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      if (url.searchParams.get('backups') === '1') {
        const rows = await db.prepare('SELECT revision, updated_at FROM progress_backups WHERE user_id = ? ORDER BY revision DESC LIMIT 20').bind(userId).all();
        return json({backups: rows.results.map(x => ({revision:x.revision, updatedAt:x.updated_at}))});
      }
      if (url.searchParams.has('backup')) {
        const n = Number(url.searchParams.get('backup'));
        if (!Number.isSafeInteger(n) || n < 1) return json({error: 'invalid_revision'}, 400);
        const row = await db.prepare('SELECT revision, state, updated_at FROM progress_backups WHERE user_id = ? AND revision = ?').bind(userId, n).first();
        return row ? json({revision:row.revision, state:JSON.parse(row.state), updatedAt:row.updated_at}) : json({error:'not_found'}, 404);
      }
      return json({...await current(db, userId), accountId:userId});
    }
    if (request.method !== 'PUT') return json({error: 'method_not_allowed'}, 405);
    if (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') return json({error: 'invalid_origin'}, 403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json({error:'invalid_content_type'}, 415);
    if (Number(request.headers.get('content-length')) > MAX_BYTES) return json({error:'too_large'}, 413);
    // Bound the streamed body too; Content-Length is optional and untrusted.
    const reader = request.body?.getReader();
    if (!reader) return json({error:'invalid_json'}, 400);
    const chunks = []; let size = 0;
    while (true) {
      const {value, done} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {await reader.cancel(); return json({error:'too_large'}, 413);}
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
    let input;
    try {input = JSON.parse(new TextDecoder().decode(bytes));} catch {return json({error:'invalid_json'}, 400);}
    if (!Number.isSafeInteger(input?.revision) || input.revision < 0 || !validState(input.state)) return json({error:'invalid_state'}, 400);
    // Runtime clocks belong to the visible browser, never to a shared snapshot.
    if (input.state.active) input.state.active.questionClock = null;
    const encoded = JSON.stringify(input.state), now = Date.now();
    // D1 batch is transactional. CAS prevents one computer overwriting a newer save.
    const result = await db.batch([
      db.prepare('INSERT OR IGNORE INTO progress_backups (user_id, revision, state, updated_at) SELECT user_id, revision, state, updated_at FROM progress WHERE user_id = ? AND revision = ?').bind(userId, input.revision),
      db.prepare('INSERT INTO progress (user_id, revision, state, updated_at) SELECT ?, 1, ?, ? WHERE ? = 0 ON CONFLICT(user_id) DO NOTHING RETURNING revision').bind(userId, encoded, now, input.revision),
      db.prepare('UPDATE progress SET state = ?, updated_at = ?, revision = revision + 1 WHERE user_id = ? AND revision = ? AND ? > 0 RETURNING revision').bind(encoded, now, userId, input.revision, input.revision),
      db.prepare('DELETE FROM progress_backups WHERE user_id = ? AND revision NOT IN (SELECT revision FROM progress_backups WHERE user_id = ? ORDER BY revision DESC LIMIT 20)').bind(userId, userId),
    ]);
    const revision = result[1].results[0]?.revision ?? result[2].results[0]?.revision;
    if (!revision) return json({error:'conflict', ...await current(db, userId)}, 409);
    return json({revision, updatedAt:now});
  } catch {
    // Never include essays or database errors in public diagnostics.
    return json({error:'storage_unavailable'}, 503);
  }
}
