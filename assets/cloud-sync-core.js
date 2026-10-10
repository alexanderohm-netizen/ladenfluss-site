/* Ladenfluss Cloud Sync Core — framework-free and usable from browsers or Node.js.
 * This file deliberately does NOT contain Supabase credentials or auto-sync on page load.
 * Browser callers must supply an authenticated Supabase client explicitly.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LadenflussCloudSync = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_PAYLOAD_BYTES = 1048576;
  const MODULES = new Set(['profile', 'vacation', 'pep', 'zahlenfluss', 'warenfluss']);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const copy = value => JSON.parse(JSON.stringify(value));

  function encodedPayload(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new TypeError('Cloud payload must be a JSON object');
    let json;
    try { json = JSON.stringify(value); } catch (_) { throw new TypeError('Cloud payload must be valid JSON'); }
    if (!json || json === '{}') { // Empty objects are valid.
      if (json !== '{}') throw new TypeError('Cloud payload must be valid JSON');
    }
    if (new TextEncoder().encode(json).length > MAX_PAYLOAD_BYTES)
      throw new RangeError('Cloud payload exceeds 1 MiB');
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new TypeError('Cloud payload must be a JSON object');
    return parsed;
  }

  function cloudError(code, message, cause) {
    const e = new Error(message);
    e.code = code;
    if (cause) e.cause = cause;
    return e;
  }

  function createSupabaseTransport(client) {
    if (!client || typeof client.from !== 'function' || typeof client.rpc !== 'function')
      throw new TypeError('An authenticated Supabase client is required');
    return {
      async read({companyId, moduleKey}) {
        const {data, error} = await client.from('cloud_documents')
          .select('payload,revision,updated_at')
          .eq('company_id', companyId).eq('module_key', moduleKey).maybeSingle();
        if (error) throw error;
        return data ? {payload:data.payload, revision:data.revision, updatedAt:data.updated_at} : null;
      },
      async create({companyId, moduleKey, payload}) {
        const {data, error} = await client.rpc('create_cloud_document_if_absent', {
          p_company_id: companyId, p_module_key: moduleKey, p_payload: payload,
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) throw cloudError('EMPTY_RESPONSE', 'Create returned no revision');
        return {revision:row.saved_revision, updatedAt:row.saved_at};
      },
      async write({companyId, moduleKey, expectedRevision, payload}) {
        const {data, error} = await client.rpc('save_cloud_document_if_revision', {
          p_company_id: companyId, p_module_key: moduleKey,
          p_expected_revision: expectedRevision, p_payload: payload,
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) throw cloudError('EMPTY_RESPONSE', 'Save returned no revision');
        return {revision:row.saved_revision, updatedAt:row.saved_at};
      },
    };
  }

  function createCloudSync({transport, storage, userId, companyId, moduleKey}) {
    if (!transport || typeof transport.read !== 'function' || typeof transport.write !== 'function')
      throw new TypeError('A cloud transport with read and write is required');
    if (!UUID.test(userId) || !UUID.test(companyId) || !MODULES.has(moduleKey))
      throw new TypeError('Valid user, company and module identifiers are required');
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function')
      throw new TypeError('Browser storage is required to preserve unsaved drafts');

    // Prevent one signed-in account from silently adopting another account's
    // unsent drafts on a shared browser. The legacy v1 key is intentionally
    // never auto-imported; any old data remains untouched for manual recovery.
    const draftKey = 'ladenfluss.cloud-draft.v2.' + userId.toLowerCase() + '.' + companyId.toLowerCase() + '.' + moduleKey;
    let remote = null;
    let loaded = false;
    let draft = null;
    let status = 'idle';
    let pendingSave = null;

    function validRemote(row) {
      if (row === null) return null;
      if (!row || !Number.isSafeInteger(row.revision) || row.revision < 1)
        throw cloudError('INVALID_REMOTE', 'Invalid cloud document revision');
      return {revision:row.revision, payload:encodedPayload(row.payload), updatedAt:row.updatedAt || null};
    }
    function restoreDraft() {
      const raw = storage.getItem(draftKey);
      if (raw === null) return null;
      try {
        const item = JSON.parse(raw);
        if (!item || !Number.isSafeInteger(item.baseRevision) || item.baseRevision < 0)
          throw new Error('Invalid base revision');
        return {baseRevision:item.baseRevision, payload:encodedPayload(item.payload)};
      } catch (e) { throw cloudError('INVALID_LOCAL_DRAFT', 'Local draft is corrupt; it has not been overwritten', e); }
    }
    function persist(next) {
      // NEVER mutate memory before successful local persistence.
      try {
        if (next) storage.setItem(draftKey, JSON.stringify(next));
        else storage.removeItem(draftKey);
      } catch (e) { throw cloudError('DRAFT_PERSISTENCE_FAILED', 'Could not safely persist local draft', e); }
      draft = next;
    }
    function state() {
      return {status, remote:remote && copy(remote), draft:draft && copy(draft), hasUnsavedChanges:!!draft};
    }
    function compare() {
      if (!draft) return remote ? 'synced' : 'missing';
      if (!remote) return draft.baseRevision === 0 ? 'dirty' : 'conflict';
      if (draft.baseRevision !== remote.revision) return 'conflict';
      return 'dirty';
    }

    async function load() {
      // Import local drafts first so a failed network request does not hide them.
      draft = restoreDraft();
      status = 'loading';
      try { remote = validRemote(await transport.read({companyId,moduleKey})); }
      catch (e) { status = draft ? 'offline-draft' : 'offline'; throw e; }
      loaded = true;
      status = compare();
      return state();
    }
    function edit(nextPayload) {
      if (!loaded && !draft) throw cloudError('NOT_LOADED', 'Load the cloud document first');
      if (status === 'conflict') throw cloudError('REVISION_CONFLICT', 'Resolve the conflict before editing');
      const next = {baseRevision:draft ? draft.baseRevision : (remote ? remote.revision : 0), payload:encodedPayload(nextPayload)};
      persist(next);
      status = compare();
      return state();
    }
    function resolveConflict(strategy) {
      if (status !== 'conflict' || !remote || !draft) throw cloudError('NO_CONFLICT', 'No conflict to resolve');
      if (strategy === 'use-remote') persist(null);
      else if (strategy === 'keep-local') persist({baseRevision:remote.revision, payload:draft.payload});
      else throw new TypeError('Choose use-remote or keep-local');
      status = compare();
      return state();
    }
    function discardDraft() {
      if (pendingSave || status === 'saving')
        throw cloudError('SAVE_IN_PROGRESS', 'Cannot discard an in-flight save');
      persist(null);
      status = compare();
      return state();
    }
    async function save() {
      if (pendingSave) return pendingSave;
      if (status === 'conflict') throw cloudError('REVISION_CONFLICT', 'Explicit conflict resolution required');
      if (!draft) throw cloudError('NO_DRAFT', 'No draft available to save');
      const snapshot = copy(draft);
      const creating = !remote && snapshot.baseRevision === 0;
      if (creating && typeof transport.create !== 'function')
        throw cloudError('CREATE_UNAVAILABLE', 'Cloud document creation API is unavailable');
      status = 'saving';
      pendingSave = (async () => {
        try {
          const result = creating
            ? await transport.create({companyId,moduleKey,payload:snapshot.payload})
            : await transport.write({companyId,moduleKey,expectedRevision:snapshot.baseRevision,payload:snapshot.payload});
          if (!result || result.revision !== snapshot.baseRevision + 1)
            throw cloudError('INVALID_REMOTE', 'Cloud returned an unexpected revision');
          remote = {revision:result.revision, updatedAt:result.updatedAt || null, payload:snapshot.payload};
          if (JSON.stringify(draft) === JSON.stringify(snapshot)) {
            persist(null);
          } else {
            // A newer edit occurred while the first save was in flight.
            // It remains unsaved and is rebased onto the confirmed revision.
            persist({baseRevision:result.revision, payload:draft.payload});
          }
          status = compare();
          return state();
        } catch (e) {
          if (e && (e.code === '40001' || e.code === '23505')) {
            // Keep local draft even when reading the new remote version fails.
            try { remote = validRemote(await transport.read({companyId,moduleKey})); }
            catch (_) { status = 'offline-draft'; throw e; }
            status = compare();
          } else if (e && e.code === 'DRAFT_PERSISTENCE_FAILED') {
            status = 'storage-error';
          } else {
            status = draft ? 'offline-draft' : 'offline';
          }
          throw e;
        } finally { pendingSave = null; }
      })();
      return pendingSave;
    }
    return {load, edit, save, resolveConflict, discardDraft, state, draftKey};
  }

  return {createCloudSync, createSupabaseTransport, MAX_PAYLOAD_BYTES};
});