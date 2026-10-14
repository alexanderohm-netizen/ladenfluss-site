/* Cloud-Beta-Schalter. Dieser öffentliche Wert enthält bewusst keine Schlüssel.
 * Erst nach Auth-Konfiguration, Redirect-Freigaben und E-Mail-Zustellung aktivieren.
 * Ausschließlich Supabase Publishable Keys (sb_publishable_...), niemals Secret-/Service-Role-Keys.
 */
window.LadenflussCloudConfig = Object.freeze({
  enabled: false,
  url: '',
  publishableKey: '',
});
