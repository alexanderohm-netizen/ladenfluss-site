/* Ladenfluss local privacy controls. Never touch Supabase Auth session keys. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LadenflussLocalPrivacy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PREFIX = 'ladenfluss.';
  function listLocalKeys(storage) {
    if (!storage || typeof storage.key !== 'function' || typeof storage.length !== 'number')
      throw new TypeError('Browser storage is required.');
    const keys = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (typeof key === 'string' && key.startsWith(PREFIX)) keys.push(key);
    }
    return keys;
  }
  function clearLadenflussData(storage) {
    const keys = listLocalKeys(storage);
    for (const key of keys) storage.removeItem(key);
    const remaining = listLocalKeys(storage);
    if (remaining.length > 0)
      throw new Error('Not all Ladenfluss data could be removed.');
    return keys.length;
  }
  return {listLocalKeys, clearLadenflussData};
});
