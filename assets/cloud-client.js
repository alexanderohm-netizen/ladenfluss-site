(function () {
  'use strict';
  let client;
  window.LadenflussCloud = {
    getClient() {
      if (client) return client;
      const config = window.LadenflussCloudConfig;
      if (!config?.url || !config?.publishableKey?.startsWith('sb_publishable_') || !window.supabase) {
        throw new Error('cloud_not_configured');
      }
      client = window.supabase.createClient(config.url, config.publishableKey, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true,
          detectSessionInUrl: true, storageKey: 'ladenfluss.auth.v1' }
      });
      return client;
    }
  };
})();
