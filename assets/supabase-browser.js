/* Browser-only, lazy-loaded Supabase JS client. No secrets and no network traffic while disabled. */
(function (root) {
  'use strict';
  let clientPromise;
  const SDK_URL = 'https://esm.sh/@supabase/supabase-js@2.117.2';
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
      clientPromise = import(SDK_URL).then(({createClient}) => createClient(cfg.url, cfg.publishableKey, {
        auth: {autoRefreshToken:true, persistSession:true, detectSessionInUrl:true, flowType:'pkce'},
      })).catch(e => { clientPromise = null; throw e; });
    }
    return clientPromise;
  }
  root.LadenflussSupabase = Object.freeze({isEnabled,getClient});
})(window);
