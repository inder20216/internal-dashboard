/* ══════════════════════════════════════════════════
   AUTH — Microsoft sign-in + access control for the dashboard
   Same Azure AD app used by tracker-form.html. Access is
   allowlisted by email in ACCESS_MAP — anyone who signs in
   with a Microsoft account NOT listed here is denied, no
   matter what organization they belong to.
   ══════════════════════════════════════════════════ */

const ACCESS_MAP = {
  'inder@openmind.in': { role: 'admin' },
  'amandeep@openmind.in': { role: 'user', process: 'Baxter' },
  'naveen@openmind.in': { role: 'user', process: 'Baxter' },
  'reenu.gupta@openmind.in': { role: 'user', process: 'Baxter' }
};

const authMsalConfig = {
  auth: {
    clientId: 'b8cda595-fd20-4d3c-a0e4-9cdf62af2028',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin + window.location.pathname
  },
  cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false }
};
const authLoginRequest = { scopes: ['User.Read', 'email', 'openid', 'profile'] };
const authMsalInstance = new msal.PublicClientApplication(authMsalConfig);

const AUTH = {
  user: null,
  access: null,

  _resolve(account) {
    const email = (account.username || '').toLowerCase().trim();
    this.user = { name: account.name || email, email };
    this.access = ACCESS_MAP[email] || null;
    return this.access;
  },

  /* Silently restores a prior session if one exists (page refresh, tab reopen).
     Returns the access entry if signed in AND allowlisted, otherwise null —
     null covers both "not signed in" and "signed in but not authorized",
     the caller distinguishes those via AUTH.user being set or not. */
  async restoreSession() {
    await authMsalInstance.initialize();
    await authMsalInstance.handleRedirectPromise();
    const accounts = authMsalInstance.getAllAccounts();
    if (!accounts.length) return null;
    authMsalInstance.setActiveAccount(accounts[0]);
    return this._resolve(accounts[0]);
  },

  async signIn() {
    const result = await authMsalInstance.loginPopup(authLoginRequest);
    authMsalInstance.setActiveAccount(result.account);
    return this._resolve(result.account);
  },

  async signOut() {
    const account = authMsalInstance.getActiveAccount();
    try { await authMsalInstance.logoutPopup({ account }); } catch (err) { /* proceed regardless */ }
    this.user = null;
    this.access = null;
  },

  /* Where this user belongs — used to bounce a signed-in-but-wrong-page user
     (e.g. a Baxter-only account hitting admin.html) to where they should be. */
  homeUrl() {
    if (!this.access) return null;
    return this.access.role === 'admin' ? 'admin.html' : 'process.html?process=' + encodeURIComponent(this.access.process);
  },

  /* Blocks the page behind #authGate until a signed-in, allowlisted user
     satisfies `validate(access)`. validate returns:
       true          -> allowed, gate hidden, page proceeds
       a URL string  -> redirect there instead (wrong page for this account)
       falsy         -> access denied, gate shows a denial message
     Requires the host page to include the #authGate/#authGateMsg/#authGateAction
     markup (see index.html / process.html / admin.html). */
  async guardPage(validate) {
    const gate = document.getElementById('authGate');
    const gateMsg = document.getElementById('authGateMsg');
    const gateAction = document.getElementById('authGateAction');

    const hidePreloader = () => {
      const pre = document.getElementById('preloader');
      if (pre) pre.classList.add('hide');
    };

    const showSignIn = () => {
      hidePreloader();
      gate.style.display = 'flex';
      gateMsg.textContent = 'Sign in with your Microsoft account to continue.';
      gateAction.style.display = 'inline-flex';
      gateAction.innerHTML = '<i class="ti ti-login"></i> Sign in with Microsoft';
      gateAction.onclick = async () => {
        gateMsg.textContent = 'Signing in…';
        gateAction.style.display = 'none';
        try {
          await AUTH.signIn();
          resolveAccess();
        } catch (err) {
          gateMsg.textContent = 'Sign-in failed: ' + err.message;
          gateAction.style.display = 'inline-flex';
        }
      };
    };

    const showDenied = () => {
      hidePreloader();
      gate.style.display = 'flex';
      gateMsg.innerHTML = `Signed in as <strong>${AUTH.user.email}</strong>, but this account doesn't have access here.<br>Contact your admin if this is unexpected.`;
      gateAction.style.display = 'inline-flex';
      gateAction.innerHTML = '<i class="ti ti-logout"></i> Sign out';
      gateAction.onclick = async () => { await AUTH.signOut(); location.reload(); };
    };

    const resolveAccess = () => {
      if (!AUTH.access) { showDenied(); return false; }
      const result = validate(AUTH.access);
      if (result === true) {
        gate.style.display = 'none';
        const pre = document.getElementById('preloader');
        if (pre) pre.classList.remove('hide');
        return true;
      }
      if (typeof result === 'string') { location.href = result; return false; }
      showDenied();
      return false;
    };

    await AUTH.restoreSession();
    if (!AUTH.user) { showSignIn(); return false; }
    return resolveAccess();
  }
};
window.AUTH = AUTH;
