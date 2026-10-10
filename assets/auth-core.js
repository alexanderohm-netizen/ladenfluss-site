/* Account domain logic. Browser + Node compatible, testable with a fake Supabase client.
 * Do not trust local session claims for authorization; getUser() revalidates server-side.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LadenflussAuthCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function authError(code, message) {
    const e = new Error(message);
    e.code = code;
    return e;
  }
  function normalizeEmail(raw) {
    const value = String(raw || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254)
      throw authError('INVALID_EMAIL', 'Bitte eine gültige E-Mail-Adresse eingeben.');
    return value;
  }
  function requirePassword(password, newPassword) {
    if (typeof password !== 'string' || password.length < (newPassword ? 12 : 1))
      throw authError('INVALID_PASSWORD', newPassword
        ? 'Bitte ein Passwort mit mindestens 12 Zeichen wählen.'
        : 'Bitte das Passwort eingeben.');
  }
  function redirectUrl(origin, pathname) {
    const url = new URL(origin);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname)))
      throw authError('INVALID_ORIGIN', 'Nur HTTPS-Weiterleitungen sind erlaubt.');
    return new URL(pathname, url.origin).toString();
  }

  function createAuthCore(client, {origin} = {}) {
    if (!client || !client.auth || typeof client.auth.signInWithPassword !== 'function')
      throw new TypeError('A Supabase Auth client is required.');
    if (!origin) throw new TypeError('Origin is required for secure redirect URLs.');

    async function validatedUser() {
      const {data:sessionData, error:sessionError} = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData || !sessionData.session) return null;
      const {data, error} = await client.auth.getUser();
      if (error) throw error;
      const user = data && data.user;
      if (!user || !user.email_confirmed_at) return null;
      return {id:user.id,email:user.email};
    }
    async function signUp(email, password) {
      const normalized = normalizeEmail(email);
      requirePassword(password,true);
      const {error} = await client.auth.signUp({
        email: normalized,
        password,
        options:{emailRedirectTo:redirectUrl(origin,'/konto')},
      });
      if (error) throw error;
      // Do not assume a session or reveal whether this email already exists.
      return {confirmationRequired:true};
    }
    async function signIn(email, password) {
      const normalized = normalizeEmail(email);
      requirePassword(password,false);
      const {error} = await client.auth.signInWithPassword({email:normalized,password});
      if (error) throw error;
      const user = await validatedUser();
      if (!user) {
        await client.auth.signOut();
        throw authError('EMAIL_UNVERIFIED','Bitte bestätige zuerst deine E-Mail-Adresse.');
      }
      return user;
    }
    async function requestPasswordReset(email) {
      const normalized = normalizeEmail(email);
      const {error} = await client.auth.resetPasswordForEmail(normalized,{
        redirectTo:redirectUrl(origin,'/passwort-zuruecksetzen'),
      });
      if (error) throw error;
      return {requested:true};
    }
    async function updatePassword(newPassword) {
      requirePassword(newPassword,true);
      const user = await validatedUser();
      if (!user) throw authError('AUTH_REQUIRED','Der Wiederherstellungslink ist nicht mehr gültig.');
      const {error} = await client.auth.updateUser({password:newPassword});
      if (error) throw error;
      await client.auth.signOut();
      return {updated:true};
    }
    async function signOut() {
      const {error} = await client.auth.signOut();
      if (error) throw error;
      return {signedOut:true};
    }
    async function firstCompany() {
      const user = await validatedUser();
      if (!user) return null;
      const {data,error} = await client.from('companies')
        .select('id,name').order('created_at',{ascending:true}).limit(1).maybeSingle();
      if (error) throw error;
      return data || null;
    }

    return {validatedUser,signUp,signIn,requestPasswordReset,updatePassword,signOut,firstCompany};
  }
  return {createAuthCore,normalizeEmail,redirectUrl};
});