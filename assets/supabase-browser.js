/* Browser-only, lazy-loaded Supabase JS client. No secrets and no network traffic while disabled. */
(function (root) {
  'use strict';
  let clientPromise;
  // Transient, in-memory only: a normal active session is NOT proof of
  // a password-recovery link. Listen before the client handles redirect events.
  let recoveryUserId = null;
  const recoveryListeners = new Set();
  const SDK_URL = 'https://esm.sh/@supabase/supabase-js@2.117.2';

  function applyAuthEvent(event, session) {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryUserId = typeof session?.user?.id === 'string' ? session.user.id : null;
    } else if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      recoveryUserId = null;
    } else return;
    for (const listener of recoveryListeners) listener(recoveryUserId);
  }
  function subscribeRecovery(listener) {
    if (typeof listener !== 'function') throw new TypeError('Recovery listener must be a function');
    recoveryListeners.add(listener);
    return () => recoveryListeners.delete(listener);
  }
  function clearRecovery() {
    recoveryUserId = null;
    for (const listener of recoveryListeners) listener(null);
  }

  function configuration() {
    const cfg = root.LadenflussCloudConfig;
    if (!cfg || cfg.enabled !== true) return null;
    if (typeof cfg.url !== 'string' || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.url) ||
        typeof cfg.publishableKey !== 'string' || !/^sb_publishable_[a-zA-Z0-9_-]+$/.test(cfg.publishableKey)) {
      throw new Error('Cloud-Beta ist noch nicht korrekt konfiguriert.');
    }
    return cfg;
  }
  function isEnabled() { return !!configuration(); }
  async function getClient() {
    const cfg = configuration();
    if (!cfg) throw new Error('Cloud-Beta ist noch nicht freigeschaltet.');
    if (!clientPromise) {
      clientPromise = import(SDK_URL).then(({createClient}) => {
        const client = createClient(cfg.url, cfg.publishableKey, {
          auth: {autoRefreshToken:true, persistSession:true, detectSessionInUrl:true, flowType:'pkce'},
        });
        // Register synchronously immediately after createClient, before its
        // asynchronous redirect initialization can emit PASSWORD_RECOVERY.
        client.auth.onAuthStateChange((event, session) => applyAuthEvent(event, session));
        return client;
      }).catch(e => { clientPromise = null; clearRecovery(); throw e; });
    }
    return clientPromise;
  }
  root.LadenflussSupabase = Object.freeze({isEnabled,getClient,subscribeRecovery,clearRecovery,getRecoveryUserId:()=>recoveryUserId});
})(window);
