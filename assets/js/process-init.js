/* ══════════════════════════════════════════════════
   PROCESS-INIT — Bootstrap for process.html
   Locks the dashboard to the ?process= in the URL.
   ══════════════════════════════════════════════════ */

(async function init() {
  const setLoad = (pct, msg) => {
    const bar = document.getElementById('loaderBar');
    const txt = document.getElementById('loaderText');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = msg;
  };

  const fail = (msg) => {
    document.getElementById('preloader').innerHTML = `<div style="text-align:center;color:var(--accent4);max-width:360px;padding:0 20px;"><i class="ti ti-alert-circle" style="font-size:36px;"></i><p style="margin-top:10px;">${msg}</p><a class="btn btn-primary" href="index.html" style="margin-top:12px;display:inline-flex;"><i class="ti ti-arrow-left"></i> Back to launcher</a></div>`;
  };

  const params = new URLSearchParams(location.search);
  const proc = params.get('process') || '';

  const authorized = await window.AUTH.guardPage(access => {
    if (access.role === 'admin') return true;
    if (access.process === proc) return true;
    return 'process.html?process=' + encodeURIComponent(access.process);
  });
  if (!authorized) return; // gate is showing sign-in / access-denied UI

  setLoad(15, 'Connecting to API...');
  try {
    await window.APP_DATA.fetchData();
    setLoad(55, 'Processing data...');

    const processList = window.APP_DATA.processList;

    if (!proc || !processList.includes(proc)) {
      fail(proc
        ? `Process "${proc}" was not found in the current data. It may have been renamed or has no data yet.`
        : 'No process specified. Open this page as <code>process.html?process=NAME</code>.');
      return;
    }

    window.APP_DATA.currentState.selectedProcess = proc;
    window.APP_DATA.currentState.userProcess = proc;
    window.APP_DATA.currentState.role = 'user';

    document.title = `${proc} — MIS Command Center`;
    document.getElementById('sidebarProcessName').textContent = proc;
    document.getElementById('userAvatar').textContent = window.AUTH.user.name.charAt(0).toUpperCase();
    document.getElementById('userName').textContent = window.AUTH.user.name;

    setDateInputs();
    applyTheme();
    setLoad(85, 'Preparing dashboard...');
    await new Promise(r => setTimeout(r, 250));
    setLoad(100, 'Ready!');
    await new Promise(r => setTimeout(r, 150));
    document.getElementById('preloader').classList.add('hide');
    document.getElementById('appShell').style.display = 'flex';

    navigateTo('dashboard');
  } catch (e) {
    fail(`Failed to load data: ${e.message}`);
  }
})();

async function handleLogout() {
  await window.AUTH.signOut();
  location.href = 'index.html';
}
