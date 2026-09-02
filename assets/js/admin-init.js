/* ══════════════════════════════════════════════════
   ADMIN-INIT — Bootstrap + views for admin.html
   Cross-process rollup only. Per-process deep dives
   live on process.html?process=X (see process-init.js).
   ══════════════════════════════════════════════════ */

(async function init() {
  const setLoad = (pct, msg) => {
    const bar = document.getElementById('loaderBar');
    const txt = document.getElementById('loaderText');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = msg;
  };

  const authorized = await window.AUTH.guardPage(access => access.role === 'admin' ? true : window.AUTH.homeUrl());
  if (!authorized) return; // gate is showing sign-in / access-denied UI

  setLoad(15, 'Connecting to API...');
  try {
    await window.APP_DATA.fetchData();
    setLoad(55, 'Processing data...');

    document.getElementById('userAvatar').textContent = window.AUTH.user.name.charAt(0).toUpperCase();
    document.getElementById('userName').textContent = window.AUTH.user.name;

    window.APP_DATA.currentState.selectedProcess = '';
    window.APP_DATA.currentState.role = 'admin';

    const sel = document.getElementById('globalProcessFilter');
    if (sel) {
      sel.innerHTML = '<option value="">Jump to a process...</option>' +
        window.APP_DATA.processList.map(p => `<option value="${p}">${p}</option>`).join('');
    }

    setDateInputs();
    applyTheme();
    window.reRenderActiveView = navigateAdmin;

    setLoad(85, 'Preparing dashboard...');
    await new Promise(r => setTimeout(r, 250));
    setLoad(100, 'Ready!');
    await new Promise(r => setTimeout(r, 150));
    document.getElementById('preloader').classList.add('hide');
    document.getElementById('appShell').style.display = 'flex';

    navigateAdmin('overview');
  } catch (e) {
    document.getElementById('preloader').innerHTML = `<div style="text-align:center;color:var(--accent4);"><i class="ti ti-alert-circle" style="font-size:36px;"></i><p style="margin-top:10px;">Failed to load data: ${e.message}</p><button class="btn btn-primary" onclick="location.reload()" style="margin-top:12px;">Retry</button></div>`;
  }
})();

async function handleLogout() {
  await window.AUTH.signOut();
  location.href = 'index.html';
}

/* ── NAVIGATION ── */
function navigateAdmin(view) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (navItem) navItem.classList.add('active');

  document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view${view.charAt(0).toUpperCase() + view.slice(1)}`);
  if (target) target.classList.add('active');

  const breadcrumb = document.getElementById('breadcrumb');
  if (breadcrumb) breadcrumb.innerHTML = `<span>${view.charAt(0).toUpperCase() + view.slice(1)}</span>`;

  switch (view) {
    case 'overview': renderOverview(); break;
    case 'leaderboard': renderLeaderboard(); break;
    case 'insights': renderInsights(); break;
    case 'chatbot': renderChatbot(); break;
  }
}

function jumpToProcess(value) {
  if (!value) return;
  location.href = 'process.html?process=' + encodeURIComponent(value);
}

/* ── OVERVIEW: company-wide KPIs + process comparison + drill-down tiles ── */
function renderOverview() {
  const container = document.getElementById('viewOverview');
  if (!container) return;
  const data = window.APP_DATA;
  if (!data.allRows || !data.allRows.length) {
    container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--muted);"><i class="ti ti-cloud-off" style="font-size:40px;display:block;margin-bottom:12px;"></i><p>No data loaded.</p></div>`;
    return;
  }

  const range = { from: data.currentState.dateFrom, to: data.currentState.dateTo };
  const overallData = data.aggregateProcess(data.allRows, '');

  const prevRange = getPreviousRange(range.from, range.to);
  data.currentState.dateFrom = prevRange.from;
  data.currentState.dateTo = prevRange.to;
  const prevOverallData = data.aggregateProcess(data.allRows, '');
  data.currentState.dateFrom = range.from;
  data.currentState.dateTo = range.to;

  const benchmark = data.getBenchmarkData(data.allRows);
  const timeSeries = data.getTimeSeries(data.allRows, '');
  const insights = window.AI_INSIGHTS.generateAll(overallData, benchmark, timeSeries);
  const isDarkNow = document.documentElement.getAttribute('data-theme') === 'dark';

  const cards = buildKPICards(overallData, prevOverallData);
  const topGroups = buildTopStatGroups(overallData);
  const highlights = buildHighlightsStrip(insights.facts);

  const tiles = data.processList.map(procName => {
    const pd = data.aggregateProcess(data.allRows, procName);
    const missedPct = (pd.missedCallPercent || 0) * 100;
    const occPct = (pd.occupancy || 0) * 100;
    const status = pctStatus(missedPct, { good: 5, warn: 10, higherIsBetter: false });
    const statusColors = { green: 'var(--accent2)', amber: 'var(--accent3)', red: 'var(--accent4)' };
    return `<a class="process-tile" href="process.html?process=${encodeURIComponent(procName)}">
      <div class="process-tile-accent" style="background:${statusColors[status]};"></div>
      <div class="process-tile-name">${procName} <span class="insight-badge ${status === 'green' ? 'green' : status === 'red' ? 'red' : 'amber'}">${status.toUpperCase()}</span></div>
      <div class="process-tile-stats">
        <div class="process-tile-stat"><div class="v">${pd.productivityTotal || 0}</div><div class="l">Productivity</div></div>
        <div class="process-tile-stat"><div class="v">${missedPct.toFixed(1)}%</div><div class="l">Missed</div></div>
        <div class="process-tile-stat"><div class="v">${occPct.toFixed(1)}%</div><div class="l">Occupancy</div></div>
      </div>
      <div class="process-tile-link"><i class="ti ti-arrow-right"></i> Open dashboard</div>
    </a>`;
  }).join('');

  container.innerHTML = `
    <div class="section">
      <div class="flex flex-between flex-wrap mb-3">
        <div>
          <div class="section-title" style="font-size:15px;"><i class="ti ti-building-skyscraper"></i> Company-Wide Overview</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">All Processes · ${range.from} → ${range.to}</div>
        </div>
      </div>
    </div>

    ${highlights}

    ${topGroups}

    <div class="section">
      <div class="section-header">
        <div class="section-title"><i class="ti ti-layout-dashboard"></i> Key Performance Indicators</div>
      </div>
      <div class="kpi-grid">${cards}</div>
    </div>

    <div class="panel mb-4">
      <div class="panel-header"><i class="ti ti-chart-bar"></i> Process Comparison — Total Productivity</div>
      <div class="panel-body"><div class="chart-container" id="processComparisonChart"></div></div>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-title"><i class="ti ti-apps"></i> Process Drill-Down</div>
      </div>
      <div class="process-tile-grid">${tiles}</div>
    </div>`;

  setTimeout(() => {
    window.CHARTS.renderProcessComparison('processComparisonChart', benchmark.processStats, isDarkNow);
    animateCounters();
    observeScroll();
  }, 80);
}

/* ── AGENT LEADERBOARD (global, across all processes) ── */
function renderLeaderboard() {
  const container = document.getElementById('viewLeaderboard');
  if (!container) return;
  const data = window.APP_DATA;
  const benchmark = data.getBenchmarkData(data.allRows);
  const isDarkNow = document.documentElement.getAttribute('data-theme') === 'dark';

  container.innerHTML = `
    <div class="panel mb-4">
      <div class="panel-header"><i class="ti ti-trophy"></i> Global Top 10</div>
      <div class="panel-body"><div class="chart-container" id="globalLeaderboardChart"></div></div>
    </div>
    <div class="panel">
      <div class="panel-header"><i class="ti ti-chart-infographic"></i> Global Agent Ranking (All Processes)</div>
      <div class="panel-body" style="max-height:500px;overflow-y:auto;">
        ${buildGlobalRankingTable(benchmark.allRanked)}
      </div>
    </div>`;

  setTimeout(() => {
    window.CHARTS.renderAgentRanking('globalLeaderboardChart', benchmark.topOverall, isDarkNow);
    observeScroll();
  }, 50);
}
