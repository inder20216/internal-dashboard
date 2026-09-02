/* ══════════════════════════════════════════════════
   INDEX-INIT — Launcher: Microsoft sign-in, then redirects
   to admin.html or process.html?process=NAME based on the
   signed-in account's entry in ACCESS_MAP (see auth.js).
   ══════════════════════════════════════════════════ */

(async function init() {
  const setLoad = (pct, msg) => {
    const bar = document.getElementById('loaderBar');
    const txt = document.getElementById('loaderText');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = msg;
  };

  setLoad(40, 'Checking sign-in...');
  await window.AUTH.restoreSession();
  setLoad(100, 'Ready!');
  await new Promise(r => setTimeout(r, 150));
  document.getElementById('preloader').classList.add('hide');
  document.getElementById('loginScreen').style.display = 'flex';

  if (window.AUTH.user) {
    // Already signed in from a prior visit — go straight to their page,
    // or show the denial if this account isn't allowlisted.
    if (window.AUTH.access) {
      location.href = window.AUTH.homeUrl();
    } else {
      showDenied();
    }
  }
})();

function showDenied() {
  document.getElementById('loginMsg').innerHTML = `Signed in as <strong>${window.AUTH.user.email}</strong>, but this account doesn't have access here.<br>Contact your admin if this is unexpected.`;
  const btn = document.getElementById('loginAction');
  btn.innerHTML = '<i class="ti ti-logout"></i> Sign out';
  btn.onclick = async () => { await window.AUTH.signOut(); location.reload(); };
}

async function handleSignIn() {
  const msg = document.getElementById('loginMsg');
  const btn = document.getElementById('loginAction');
  msg.textContent = 'Signing in…';
  btn.style.display = 'none';
  try {
    await window.AUTH.signIn();
    if (window.AUTH.access) {
      location.href = window.AUTH.homeUrl();
    } else {
      btn.style.display = 'inline-flex';
      showDenied();
    }
  } catch (err) {
    msg.textContent = 'Sign-in failed: ' + err.message;
    btn.style.display = 'inline-flex';
  }
}
