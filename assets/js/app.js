/* ══════════════════════════════════════════════════
   APP — Shared Dashboard Library
   Used by process.html and admin.html (and, for the
   login flow, index.html via index-init.js).
   No page-specific bootstrap lives here — see
   process-init.js / admin-init.js / index-init.js.
   ══════════════════════════════════════════════════ */

let isDark = false;

/* ── SET DEFAULT DATE INPUTS ── */
function setDateInputs() {
  const data = window.APP_DATA;
  const from = document.getElementById('globalDateFrom');
  const to = document.getElementById('globalDateTo');
  if (from) from.value = data.currentState.dateFrom;
  if (to) to.value = data.currentState.dateTo;
  const mf = document.getElementById('globalMonthFilter');
  if (mf) mf.value = data.currentState.dateFrom.slice(0, 7);
}

/* ── PERIOD SELECTOR (Daily / Weekly / Monthly) ── */
function setPeriod(period) {
  const data = window.APP_DATA;
  data.currentState.reportPeriod = period;
  if (period === 'monthly') {
    // Reset to the current month by default whenever this tab is clicked, so it
    // doesn't silently keep whatever single-day range Daily/testing left behind.
    const range = data.computeDefaultRange();
    data.currentState.dateFrom = range.from;
    data.currentState.dateTo = range.to;
    setDateInputs();
  } else if (period === 'daily') {
    // Clear any leftover date (from Weekly/Monthly, or a previously-picked day)
    // so the tab starts fresh at the latest active date — a manual pick via the
    // date filter while already on this tab still overrides it (see
    // getPeriodDateRange), this only resets on switching tabs.
    data.currentState.dateFrom = '';
    data.currentState.dateTo = '';
    setDateInputs();
  }
  document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.period-tab[data-period="${period}"]`).classList.add('active');
  (window.reRenderActiveView || navigateTo)('dashboard');
}

function getPeriodDateRange(period) {
  const data = window.APP_DATA;
  const now = new Date();
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  if (period === 'daily') {
    // If the user picked a specific date via the topbar date filter while on
    // this tab, honor it. Otherwise default to the most recent date with real
    // activity for this process, not literally "yesterday" — a process that
    // doesn't work Sundays (etc.) would otherwise show a misleading blank
    // snapshot every time yesterday happened to be a day off.
    if (data.currentState.dateFrom) return { from: data.currentState.dateFrom, to: data.currentState.dateFrom };
    const processName = data.currentState.selectedProcess;
    const scoped = processName ? data.allRows.filter(r => r["Process Name"] === processName) : data.allRows;
    const latest = data.latestActiveDate(scoped);
    const day = latest || fmt(y);
    return { from: day, to: day };
  }
  if (period === 'weekly') {
    const w = new Date(now); w.setDate(w.getDate() - 7);
    return { from: fmt(w), to: fmt(y) };
  }
  // monthly — use existing filter dates
  const cs = data.currentState;
  return { from: cs.dateFrom, to: cs.dateTo };
}

/* Immediately-preceding range of the same length — used for trend badges */
function getPreviousRange(from, to) {
  const f = new Date(from + 'T00:00:00');
  const t = new Date(to + 'T00:00:00');
  const days = Math.max(1, Math.round((t - f) / 86400000) + 1);
  const prevTo = new Date(f); prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - (days - 1));
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { from: fmt(prevFrom), to: fmt(prevTo) };
}

/* ── NAVIGATION (process.html views: dashboard/agents/insights/chatbot) ── */
function navigateTo(view) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (navItem) navItem.classList.add('active');

  document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view${view.charAt(0).toUpperCase() + view.slice(1)}`);
  if (target) {
    target.classList.add('active');
    const state = window.APP_DATA.currentState;
    const breadcrumb = document.getElementById('breadcrumb');
    if (breadcrumb) {
      if (view === 'dashboard') {
        const label = state.selectedProcess ? state.selectedProcess : 'Overall Business Performance';
        breadcrumb.innerHTML = `<span>Dashboard</span> <i class="ti ti-chevron-right" style="font-size:10px;color:var(--muted);"></i> <span style="color:var(--accent);font-weight:600;">${label}</span>`;
      } else {
        breadcrumb.innerHTML = `<span>${view.charAt(0).toUpperCase() + view.slice(1)}</span>`;
      }
    }
  }

  switch (view) {
    case 'dashboard': renderDashboard(); break;
    case 'agents': renderAgents(); break;
    case 'insights': renderInsights(); break;
    case 'chatbot': renderChatbot(); break;
  }
}

/* ── POPULATE DROPDOWNS (safe no-op if elements absent) ── */
function populateProcessDropdowns() {
  const procList = window.APP_DATA.processList;
  const options = procList.map(p => `<option value="${p}">${p}</option>`).join('');
  const globalFilter = document.getElementById('globalProcessFilter');
  if (globalFilter) {
    globalFilter.innerHTML = '<option value="">All Processes</option>' + options;
  }
  const loginSelect = document.getElementById('loginProcessSelect');
  if (loginSelect) {
    loginSelect.innerHTML = options;
  }
}

/* ── FILTERS ── */
function applyMonthFilter(value) {
  if (!value) return;
  const [year, month] = value.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  window.APP_DATA.currentState.dateFrom = `${value}-01`;
  window.APP_DATA.currentState.dateTo = `${value}-${String(lastDay).padStart(2, '0')}`;
  const from = document.getElementById('globalDateFrom');
  const to = document.getElementById('globalDateTo');
  if (from) from.value = window.APP_DATA.currentState.dateFrom;
  if (to) to.value = window.APP_DATA.currentState.dateTo;
  const active = document.querySelector('.page-view.active');
  if (active) {
    const view = active.id.replace('view', '').toLowerCase();
    (window.reRenderActiveView || navigateTo)(view);
  }
}

function applyDateFilter() {
  const mf = document.getElementById('globalMonthFilter');
  if (mf) mf.value = '';
  window.APP_DATA.currentState.dateFrom = document.getElementById('globalDateFrom').value || '';
  window.APP_DATA.currentState.dateTo = document.getElementById('globalDateTo').value || '';
  const active = document.querySelector('.page-view.active');
  if (active) {
    const view = active.id.replace('view', '').toLowerCase();
    (window.reRenderActiveView || navigateTo)(view);
  }
}

function refreshData() {
  showToast('Refreshing data...', 'info');
  (async () => {
    try {
      const prevProcess = window.APP_DATA.currentState.selectedProcess;
      await window.APP_DATA.fetchData();
      window.APP_DATA.currentState.selectedProcess = prevProcess;
      populateProcessDropdowns();
      const pf = document.getElementById('globalProcessFilter');
      if (pf) pf.value = prevProcess || '';
      const active = document.querySelector('.page-view.active');
      if (active) {
        const view = active.id.replace('view', '').toLowerCase();
        (window.reRenderActiveView || navigateTo)(view);
      }
      showToast('Data refreshed successfully', 'success');
    } catch (e) {
      showToast('Refresh failed: ' + e.message, 'error');
    }
  })();
}

/* ── THEME ── */
function toggleTheme() {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  const icon = document.getElementById('themeIcon');
  if (icon) icon.className = isDark ? 'ti ti-sun' : 'ti ti-moon';
  const active = document.querySelector('.page-view.active');
  if (active) {
    const view = active.id.replace('view', '').toLowerCase();
    if (view !== 'chatbot') (window.reRenderActiveView || navigateTo)(view);
  }
}

function applyTheme() {
  isDark = false;
  document.documentElement.removeAttribute('data-theme');
  const icon = document.getElementById('themeIcon');
  if (icon) icon.className = 'ti ti-moon';
}

/* ── SIDEBAR ── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

/* ── TOAST ── */
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="ti ti-${type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info-circle'}"></i> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; toast.style.transition = '0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
}

/* ── COUNTER ANIMATION ── */
function animateCounters() {
  document.querySelectorAll('.kpi-value:not(.no-count)').forEach(el => {
    const raw = el.getAttribute('data-count');
    if (raw === null || raw === undefined) return;
    const target = parseFloat(raw);
    if (!Number.isFinite(target) || target <= 0) return;

    const text = el.textContent.trim();
    if (/^\d{1,2}:\d{2}/.test(text)) return;

    const duration = 800;
    const start = performance.now();
    const isDecimal = target % 1 !== 0;

    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const current = ease * target;
      el.textContent = isDecimal ? current.toFixed(1) : Math.round(current).toString();
      el.classList.add('counting');
      if (p < 1) requestAnimationFrame(tick);
      else el.classList.remove('counting');
    }
    el.textContent = isDecimal ? '0.0' : '0';
    requestAnimationFrame(tick);
  });
}

/* ── SCROLL OBSERVER ── */
let scrollObserver = null;
function observeScroll() {
  if (scrollObserver) scrollObserver.disconnect();
  scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('anim-fade-up');
        scrollObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.panel:not(.anim-fade-up), .insight-card:not(.anim-fade-up)').forEach(el => {
    scrollObserver.observe(el);
  });
}

/* ══════════════════════════════════════════════════
   VIEW RENDERERS
   ══════════════════════════════════════════════════ */

/* ── DASHBOARD ── */
function renderDashboard() {
  const container = document.getElementById('viewDashboard');
  if (!container) return;
  const data = window.APP_DATA;
  if (!data.allRows || !data.allRows.length) {
    container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--muted);"><i class="ti ti-cloud-off" style="font-size:40px;display:block;margin-bottom:12px;"></i><p>No data loaded.</p></div>`;
    return;
  }

  const processName = data.currentState.selectedProcess;
  const period = data.currentState.reportPeriod || 'monthly';
  const range = getPeriodDateRange(period);
  const origFrom = data.currentState.dateFrom;
  const origTo = data.currentState.dateTo;

  data.currentState.dateFrom = range.from;
  data.currentState.dateTo = range.to;
  const processData = data.aggregateProcess(data.allRows, processName);

  const prevRange = getPreviousRange(range.from, range.to);
  data.currentState.dateFrom = prevRange.from;
  data.currentState.dateTo = prevRange.to;
  const prevData = data.aggregateProcess(data.allRows, processName);

  data.currentState.dateFrom = range.from;
  data.currentState.dateTo = range.to;
  const isDarkNow = document.documentElement.getAttribute('data-theme') === 'dark';

  data.currentState.dateFrom = origFrom;
  data.currentState.dateTo = origTo;

  const cards = buildKPICards(processData, prevData);
  const topGroups = buildTopStatGroups(processData);
  const attention = buildAttentionList(processData.agents);
  const label = processName || 'Overall Business Performance';
  const periodLabel = period === 'daily' ? 'Daily Snapshot' : period === 'weekly' ? 'Weekly Summary' : 'Monthly Report';

  container.innerHTML = `
    <div class="section">
      <div class="flex flex-between flex-wrap mb-3">
        <div>
          <div class="section-title" style="font-size:15px;"><i class="ti ti-calendar-stats"></i> ${periodLabel}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">${label} · ${range.from} → ${range.to}</div>
        </div>
        <div class="period-tabs" style="display:flex;gap:4px;background:var(--surface2);padding:3px;border-radius:8px;border:1px solid var(--border);">
          <button class="period-tab ${period === 'daily' ? 'active' : ''}" data-period="daily" onclick="setPeriod('daily')">Daily</button>
          <button class="period-tab ${period === 'weekly' ? 'active' : ''}" data-period="weekly" onclick="setPeriod('weekly')">Weekly</button>
          <button class="period-tab ${period === 'monthly' ? 'active' : ''}" data-period="monthly" onclick="setPeriod('monthly')">Monthly</button>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-title"><i class="ti ti-layout-dashboard"></i> Key Performance Indicators</div>
      </div>
      <div class="kpi-grid">${cards}</div>
    </div>

    ${topGroups}

    ${attention}

    <div class="panel">
      <div class="panel-header"><i class="ti ti-chart-bar"></i> Agent Productivity — Inbound Answered + Outbound + Email</div>
      <div class="panel-body"><div class="chart-container chart-container-lg" id="agentProductivityChart"></div></div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><i class="ti ti-coffee"></i> Break Duration vs 1-Hour Target — ${range.from === range.to ? 'Total for ' + range.from : 'Daily Average'}</div>
        <div class="panel-body"><div class="chart-container chart-container-sm" id="breakDurationChart"></div></div>
      </div>

      <div class="panel">
        <div class="panel-header"><i class="ti ti-phone-x"></i> Agent Missed — Inbound / Outbound</div>
        <div class="panel-body"><div class="chart-container chart-container-sm" id="agentMissedChart"></div></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><i class="ti ti-users"></i> Agent Performance</div>
      <div class="panel-body">
        ${buildAgentTable(processData.agents, processData.isOverall, processName)}
      </div>
    </div>

    ${processName !== 'ResMed' ? `
    <div class="panel">
      <div class="panel-header"><i class="ti ti-checklist"></i> Closed &amp; Partial Closed — ${range.from === range.to ? range.from : `${range.from} → ${range.to}`}</div>
      <div class="panel-body">
        ${buildClosedPartialTable(processData.agents)}
      </div>
    </div>` : ''}

    ${processName ? `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><i class="ti ti-school"></i> Training Duration &amp; Type — ${range.from === range.to ? range.from : `${range.from} → ${range.to}`}</div>
        <div class="panel-body" id="trainingInsightsBody"><div style="text-align:center;padding:20px;color:var(--muted);">Loading…</div></div>
      </div>

      <div class="panel">
        <div class="panel-header"><i class="ti ti-star"></i> Call Quality Ratio — Agent Wise</div>
        <div class="panel-body" id="qualityInsightsBody"><div style="text-align:center;padding:20px;color:var(--muted);">Loading…</div></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><i class="ti ti-plug-connected-x"></i> Downtime — from Form Submissions</div>
      <div class="panel-body" id="downtimeInsightsBody"><div style="text-align:center;padding:20px;color:var(--muted);">Loading…</div></div>
    </div>` : ''}

    ${processName === 'ResMed' ? `
    <div class="panel">
      <div class="panel-header"><i class="ti ti-heart-handshake"></i> Appreciation &amp; Escalation — Agent Wise</div>
      <div class="panel-body">
        ${buildAppreciationEscalationTable(processData.agents)}
      </div>
    </div>` : ''}`;

  setTimeout(() => {
    const charts = window.CHARTS;
    const obNoAnswer = Math.max(0, (processData.outboundAll || 0) - (processData.obAnswered || 0));
    charts.renderStatBar('statChartIB', ['Total', 'Answered', 'Missed'],
      [processData.totalCalls || 0, processData.inboundAnswered || 0, processData.totalMissed || 0],
      ['rgba(37,99,235,0.75)', 'rgba(5,150,105,0.75)', 'rgba(220,38,38,0.75)'], isDarkNow);
    charts.renderStatBar('statChartOB', ['Dialed', 'Answered', 'No Answer'],
      [processData.outboundAll || 0, processData.obAnswered || 0, obNoAnswer],
      ['rgba(37,99,235,0.75)', 'rgba(5,150,105,0.75)', 'rgba(217,119,6,0.75)'], isDarkNow);
    charts.renderStatBar('statChartAHTAvg', ['IB Avg', 'OB Avg'],
      [processData.ahtInboundSec || 0, processData.ahtOutboundSec || 0],
      ['rgba(37,99,235,0.75)', 'rgba(234,88,12,0.75)'], isDarkNow, v => secondsToHms(v));
    charts.renderStatBar('statChartAHTTotal', ['IB Total', 'OB Total'],
      [processData.ibTalkTimeSec || 0, processData.obTalkTimeSec || 0],
      ['rgba(37,99,235,0.75)', 'rgba(234,88,12,0.75)'], isDarkNow, v => secondsToHms(v));
    charts.renderStatBar('statChartMissed', ['Agent', 'IVR', 'Queue', 'Service'],
      [processData.agentMissedInbound || 0, processData.ivrMissed || 0, processData.queueMissed || 0, processData.serviceMissed || 0],
      ['rgba(220,38,38,0.75)', 'rgba(217,119,6,0.75)', 'rgba(124,58,237,0.75)', 'rgba(8,145,178,0.75)'], isDarkNow);
    charts.renderStatBar('statChartMissedHours', ['Working Hours', 'Non-Working Hours'],
      [processData.missedWorkingHours || 0, processData.missedNonWorkingHours || 0],
      ['rgba(220,38,38,0.75)', 'rgba(107,114,128,0.75)'], isDarkNow);
    charts.renderAgentProductivity('agentProductivityChart', processData.agents, isDarkNow);
    charts.renderBreakDuration('breakDurationChart', processData.agents, isDarkNow);
    charts.renderAgentMissed('agentMissedChart', processData.agents, isDarkNow);
    animateCounters();
    observeScroll();
  }, 80);

  if (processName) {
    data.fetchTrackerInsights(processName, range.from, range.to).then(insights => {
      const trainingEl = document.getElementById('trainingInsightsBody');
      const qualityEl = document.getElementById('qualityInsightsBody');
      const downtimeEl = document.getElementById('downtimeInsightsBody');
      if (trainingEl) trainingEl.innerHTML = buildTrainingInsights(insights.training);
      if (qualityEl) {
        qualityEl.innerHTML = buildQualityInsights(insights.quality);
        if (insights.quality && insights.quality.length) window.CHARTS.renderQualityRatio('qualityRatioChart', insights.quality, isDarkNow);
      }
      if (downtimeEl) downtimeEl.innerHTML = buildDowntimeInsights(insights.downtime);
    });
  }
}

/* ── AGENT BENCHMARK ── */
function renderAgents() {
  const container = document.getElementById('viewAgents');
  if (!container) return;
  const data = window.APP_DATA;
  const processName = data.currentState.selectedProcess;
  const processData = data.aggregateProcess(data.allRows, processName);
  const benchmark = data.getBenchmarkData(data.allRows);
  const isDarkNow = document.documentElement.getAttribute('data-theme') === 'dark';

  const topIntra = processData.agents?.slice(0, 8) || [];
  const topCross = benchmark.topOverall || [];

  container.innerHTML = `
    <div class="grid-2 mb-4">
      <div class="panel">
        <div class="panel-header"><i class="ti ti-crown"></i> Intra-Process: Top Agents (${processName || 'All'})</div>
        <div class="panel-body"><div class="chart-container" id="intraAgentChart"></div></div>
      </div>
      <div class="panel">
        <div class="panel-header"><i class="ti ti-globe"></i> Cross-Process: Global Top 10</div>
        <div class="panel-body"><div class="chart-container" id="crossAgentChart"></div></div>
      </div>
    </div>

    <div class="grid-2 mb-4">
      <div class="panel">
        <div class="panel-header"><i class="ti ti-heatmap"></i> Occupancy Heatmap</div>
        <div class="panel-body"><div class="chart-container" id="occupancyHeatmap"></div></div>
      </div>
      <div class="panel">
        <div class="panel-header"><i class="ti ti-heatmap"></i> Missed Rate Heatmap</div>
        <div class="panel-body"><div class="chart-container" id="missedHeatmap"></div></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><i class="ti ti-chart-infographic"></i> Global Agent Ranking (All Processes)</div>
      <div class="panel-body" style="max-height:400px;overflow-y:auto;">
        ${buildGlobalRankingTable(benchmark.allRanked)}
      </div>
    </div>`;

  setTimeout(() => {
    const charts = window.CHARTS;
    charts.renderAgentRanking('intraAgentChart', topIntra, isDarkNow);
    charts.renderAgentRanking('crossAgentChart', topCross, isDarkNow);
    charts.renderAgentHeatmap('occupancyHeatmap', topIntra, 'occupancy', 'Occupancy %', isDarkNow);
    charts.renderAgentHeatmap('missedHeatmap', topIntra, 'missedRate', 'Missed Rate %', isDarkNow);
    observeScroll();
  }, 50);
}

/* ── AI INSIGHTS ── */
function renderInsights() {
  const container = document.getElementById('viewInsights');
  if (!container) return;
  const data = window.APP_DATA;
  const processName = data.currentState.selectedProcess;
  const processData = data.aggregateProcess(data.allRows, processName);
  const benchmark = data.getBenchmarkData(data.allRows);
  const timeSeries = data.getTimeSeries(data.allRows, processName);
  const insights = window.AI_INSIGHTS.generateAll(processData, benchmark, timeSeries);

  const sixSigma = insights.sixSigma || {};
  const sigmaPct = Math.min((sixSigma.sigmaLevel || 1) / 6 * 100, 100);
  const sigmaColor = sixSigma.sigmaLevel >= 5 ? 'var(--accent2)' : sixSigma.sigmaLevel >= 4 ? 'var(--accent3)' : 'var(--accent4)';

  const leadershipHtml = (insights.leadership || []).map(l => `
    <div class="insight-card">
      <div class="insight-icon" style="background:rgba(124,58,237,0.1);color:var(--accent5);"><i class="ti ti-brain"></i></div>
      <h4>${l.framework}</h4>
      <p>${l.insight}</p>
    </div>`).join('');

  const trainingHtml = (insights.training || []).map(t => `
    <div class="insight-card" style="${t.priority === 'High' ? 'border-left:3px solid var(--accent4);' : t.priority === 'Medium' ? 'border-left:3px solid var(--accent3);' : 'border-left:3px solid var(--accent);'}">
      <div class="flex flex-between mb-2">
        <h4><i class="ti ti-${t.priority === 'High' ? 'alert-triangle' : t.priority === 'Medium' ? 'clock' : 'info-circle'}" style="color:${t.priority === 'High' ? 'var(--accent4)' : t.priority === 'Medium' ? 'var(--accent3)' : 'var(--accent)'};"></i> ${t.issue}</h4>
        <span class="insight-badge ${t.priority === 'High' ? 'red' : t.priority === 'Medium' ? 'amber' : 'blue'}">${t.priority}</span>
      </div>
      <p style="font-size:12px;margin-bottom:4px;"><strong>Agent(s):</strong> ${t.agent}</p>
      <p style="font-size:11px;color:var(--muted);">${t.desc}</p>
    </div>`).join('');

  const wasteHtml = (insights.leanWaste || []).map(w => `
    <div class="insight-card">
      <h4><i class="ti ti-trash" style="color:var(--accent4);"></i> ${w.type}</h4>
      <p>${w.desc}</p>
    </div>`).join('');

  const factRows = (insights.facts || []).map(f => `
    <div class="insight-card" style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;">
      <i class="ti ${f.icon}" style="font-size:18px;color:${f.type === 'danger' ? 'var(--accent4)' : f.type === 'warning' ? 'var(--accent3)' : f.type === 'success' ? 'var(--accent2)' : 'var(--accent)'};flex-shrink:0;margin-top:1px;"></i>
      <div><h4 style="font-size:12px;">${f.title}</h4><p style="font-size:11px;color:var(--muted);">${f.desc}</p></div>
    </div>`).join('');

  const swot = insights.swot || {};
  const swotHtml = `
    <div class="grid-2" style="grid-template-columns:1fr 1fr;">
      <div class="insight-card" style="border-left:3px solid var(--accent2);">
        <h4 style="color:var(--accent2);">✅ Strengths</h4>
        <ul style="font-size:11px;color:var(--muted);padding-left:14px;margin-top:6px;">${(swot.strengths || []).map(s => `<li style="margin-bottom:3px;">${s}</li>`).join('')}</ul>
      </div>
      <div class="insight-card" style="border-left:3px solid var(--accent4);">
        <h4 style="color:var(--accent4);">⚠️ Weaknesses</h4>
        <ul style="font-size:11px;color:var(--muted);padding-left:14px;margin-top:6px;">${(swot.weaknesses || []).map(s => `<li style="margin-bottom:3px;">${s}</li>`).join('')}</ul>
      </div>
      <div class="insight-card" style="border-left:3px solid var(--accent);">
        <h4 style="color:var(--accent);">💡 Opportunities</h4>
        <ul style="font-size:11px;color:var(--muted);padding-left:14px;margin-top:6px;">${(swot.opportunities || []).map(s => `<li style="margin-bottom:3px;">${s}</li>`).join('')}</ul>
      </div>
      <div class="insight-card" style="border-left:3px solid var(--accent3);">
        <h4 style="color:var(--accent3);">🔴 Threats</h4>
        <ul style="font-size:11px;color:var(--muted);padding-left:14px;margin-top:6px;">${(swot.threats || []).map(s => `<li style="margin-bottom:3px;">${s}</li>`).join('')}</ul>
      </div>
    </div>`;

  container.innerHTML = `
    <div class="section">
      <div class="section-header">
        <div class="section-title"><i class="ti ti-chart-infographic"></i> Lean Six Sigma Dashboard</div>
      </div>
      <div class="grid-2 mb-4">
        <div class="panel">
          <div class="panel-header"><i class="ti ti-target"></i> Six Sigma Metrics</div>
          <div class="panel-body">
            <div style="display:flex;align-items:center;gap:24px;">
              <div class="sigma-meter">
                <div class="sigma-ring">
                  <svg width="120" height="120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface3)" stroke-width="8"/>
                    <circle cx="60" cy="60" r="52" fill="none" stroke="${sigmaColor}" stroke-width="8"
                      stroke-dasharray="${sigmaPct} ${100 - sigmaPct}"
                      stroke-dashoffset="25" stroke-linecap="round"/>
                  </svg>
                  <span class="sigma-value" style="color:${sigmaColor};">${sixSigma.sigmaLevel || '—'}σ</span>
                </div>
                <span class="sigma-label">Sigma Level</span>
                <div class="sigma-scale">
                  ${[1,2,3,4,5,6].map(s => `<div class="sigma-step" style="background:${s <= (sixSigma.sigmaLevel || 1) ? sigmaColor : 'var(--surface3)'};"></div>`).join('')}
                </div>
              </div>
              <div style="flex:1;">
                <div class="stat-ring mb-3">
                  <div class="stat-ring-circle" style="background:rgba(5,150,105,0.1);color:var(--accent2);">${sixSigma.yield || 0}%</div>
                  <div class="stat-ring-info">
                    <h3>${sixSigma.yield || 0}%</h3>
                    <p>Process Yield</p>
                  </div>
                </div>
                <div><strong>DPMO:</strong> ${(sixSigma.dpmo || 0).toLocaleString()} defects per million opportunities</div>
                <div><strong>Defects:</strong> ${sixSigma.defects || 0} out of ${sixSigma.opportunities || 0} opportunities</div>
              </div>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><i class="ti ti-trending-up"></i> Forecast & Projection</div>
          <div class="panel-body">
            <p>${insights.forecast?.summary || 'Insufficient data for forecasting.'}</p>
            ${insights.forecast?.nextMonth !== null ? `
            <div class="stat-ring" style="margin-top:12px;">
              <div class="stat-ring-circle" style="background:rgba(37,99,235,0.1);color:var(--accent);font-size:16px;">${insights.forecast.nextMonth}</div>
              <div class="stat-ring-info">
                <h3>${insights.forecast.nextMonth}</h3>
                <p>Projected inbound (next period)</p>
              </div>
            </div>` : ''}
            <div style="margin-top:8px;font-size:11px;color:var(--muted);">
              ${insights.forecast?.trend ? `Trend: ${insights.forecast.trend} | R²: ${insights.forecast.r2}%` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-title"><i class="ti ti-bulb"></i> AI-Generated Facts</div>
      </div>
      <div class="grid-2" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));">${factRows}</div>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-title"><i class="ti ti-brain"></i> Leadership Methodology Insights</div>
      </div>
      <div class="grid-2" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));">${leadershipHtml}</div>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-title"><i class="ti ti-school"></i> Training Needs Analysis</div>
      </div>
      <div class="grid-2" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));">${trainingHtml || '<p>No training needs identified.</p>'}</div>
    </div>

    <div class="grid-2 mb-4">
      <div class="panel">
        <div class="panel-header"><i class="ti ti-trash"></i> Lean Waste (MUDA) Analysis</div>
        <div class="panel-body">
          <div class="grid-2" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));">${wasteHtml || '<p>No waste identified.</p>'}</div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><i class="ti ti-arrows-shuffle"></i> Benchmark Comparisons</div>
        <div class="panel-body">
          ${(insights.comparisons || []).map(c => `<div class="insight-card mb-2" style="padding:10px 12px;"><h4 style="font-size:12px;">${c.title}</h4><p style="font-size:11px;color:var(--muted);">${c.desc}</p></div>`).join('')}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-title"><i class="ti ti-analyze"></i> SWOT Analysis</div>
      </div>
      ${swotHtml}
    </div>`;

  setTimeout(() => observeScroll(), 50);
}

/* ── CHATBOT ── */
function renderChatbot() {
  const container = document.getElementById('viewChatbot');
  if (!container) return;
  container.innerHTML = `
    <div class="chatbot-container">
      <div class="chatbot-header">
        <i class="ti ti-message-chatbot"></i>
        <div>
          <h2>Analytics Assistant</h2>
          <p>Ask anything about your call center data</p>
        </div>
      </div>
      <div class="chatbot-messages" id="chatMessages"></div>
      <div class="chatbot-suggestions" id="chatSuggestions"></div>
      <div class="chatbot-input">
        <input type="text" id="chatInput" placeholder="Ask a question..." autocomplete="off">
        <button onclick="sendChatMessage()"><i class="ti ti-arrow-up"></i></button>
      </div>
    </div>`;

  window.CHATBOT.chartCounter = 0;
  window.CHATBOT.init();

  const suggestions = ['Top 5 agents', 'Compare processes', 'Show missed call trend', 'Training needs', 'Six Sigma metrics', 'Performance storyboard', 'Forecast next month', 'SWOT analysis'];
  const sugContainer = document.getElementById('chatSuggestions');
  sugContainer.innerHTML = suggestions.map(s => `<span class="chat-suggestion" onclick="document.getElementById('chatInput').value='${s}';sendChatMessage();">${s}</span>`).join('');

  document.getElementById('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChatMessage();
  });
}

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  window.CHATBOT.process(msg);
}

/* ══════════════════════════════════════════════════
   BUILDERS
   ══════════════════════════════════════════════════ */

/* Status classifier for a 0-100 percentage metric against a green/amber/red target */
function pctStatus(pct, { good, warn, higherIsBetter }) {
  if (higherIsBetter) {
    if (pct >= good) return 'green';
    if (pct >= warn) return 'amber';
    return 'red';
  }
  if (pct <= good) return 'green';
  if (pct <= warn) return 'amber';
  return 'red';
}

/* Trend badge for metrics with no fixed target — compares to the previous equal-length period */
function trendBadge(current, previous) {
  if (previous === null || previous === undefined || previous <= 0) return { arrow: '—', pct: null, cls: 'neutral' };
  const change = ((current - previous) / previous) * 100;
  if (change > 0.5) return { arrow: '▲', pct: change.toFixed(1), cls: 'up' };
  if (change < -0.5) return { arrow: '▼', pct: Math.abs(change).toFixed(1), cls: 'down' };
  return { arrow: '—', pct: '0.0', cls: 'neutral' };
}

const STATUS_COLORS = { green: 'var(--accent2)', amber: 'var(--accent3)', red: 'var(--accent4)' };
const STATUS_BG = { green: 'rgba(5,150,105,0.08)', amber: 'rgba(217,119,6,0.08)', red: 'rgba(220,38,38,0.08)' };
const STATUS_ICON = { green: 'circle-check', amber: 'alert-triangle', red: 'alert-octagon' };

function buildStatusCard(c) {
  return `<div class="kpi-card status-${c.status}">
      <div class="kpi-accent" style="background:${STATUS_COLORS[c.status]};"></div>
      <div class="kpi-header">
        <div class="kpi-icon-wrap" style="background:${STATUS_BG[c.status]};color:${STATUS_COLORS[c.status]};"><i class="ti ${c.icon}"></i></div>
        <span class="kpi-badge ${c.status === 'green' ? 'up' : c.status === 'red' ? 'down' : 'neutral'}"><i class="ti ti-${STATUS_ICON[c.status]}"></i> ${c.status.toUpperCase()}</span>
      </div>
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value}</div>
      <div class="kpi-sub">${c.sub}</div>
    </div>`;
}

function buildKPICards(d, prevData) {
  const missedPct = (d.missedCallPercent || 0) * 100;
  const hangupPct = (d.hangupRate || 0) * 100;
  const obAnsPct = (d.obAnswerPercent || 0) * 100;

  const statusCards = [
    {
      label: 'Missed Call %', icon: 'ti-phone-x',
      value: missedPct.toFixed(1) + '%',
      status: pctStatus(missedPct, { good: 5, warn: 10, higherIsBetter: false }),
      sub: `${d.totalMissed || 0} missed of ${d.totalCalls || 0} offered · Target ≤5%`
    },
    {
      label: 'Hangup Rate', icon: 'ti-phone-pause',
      value: hangupPct.toFixed(1) + '%',
      status: pctStatus(hangupPct, { good: 3, warn: 7, higherIsBetter: false }),
      sub: `${d.totalHangup || 0} calls ≤10s · Target ≤3%`
    },
    {
      label: 'OB Answer Rate', icon: 'ti-phone-call',
      value: obAnsPct.toFixed(1) + '%',
      status: pctStatus(obAnsPct, { good: 40, warn: 25, higherIsBetter: true }),
      sub: `Target ≥40%`
    }
  ];

  const statusHtml = statusCards.map(buildStatusCard).join('');

  const trend = trendBadge(d.productivityTotal || 0, prevData ? prevData.productivityTotal : null);
  const trendHtml = `<div class="kpi-card status-neutral">
      <div class="kpi-accent" style="background:var(--accent);"></div>
      <div class="kpi-header">
        <div class="kpi-icon-wrap" style="background:rgba(37,99,235,0.08);color:var(--accent);"><i class="ti ti-bolt"></i></div>
        <span class="kpi-badge ${trend.cls}">${trend.arrow}${trend.pct !== null ? ' ' + trend.pct + '%' : ''}</span>
      </div>
      <div class="kpi-label">Total Productivity</div>
      <div class="kpi-value" data-count="${d.productivityTotal || 0}">${d.productivityTotal || 0}</div>
      <div class="kpi-sub">IB Answered ${d.inboundAnswered || 0} · OB Dialed ${d.outboundAll || 0} · Email ${d.emailsHandled || 0} · vs previous period</div>
    </div>`;

  const callbackHtml = `<div class="kpi-card status-neutral">
      <div class="kpi-accent" style="background:var(--accent);"></div>
      <div class="kpi-header">
        <div class="kpi-icon-wrap" style="background:rgba(37,99,235,0.08);color:var(--accent);"><i class="ti ti-phone-call"></i></div>
      </div>
      <div class="kpi-label">Callback on Missed Call</div>
      <div class="kpi-value">${d.callbackOnMissedCall || '—'}</div>
      <div class="kpi-sub">Avg. working-hours gap between a missed call and the callback</div>
    </div>`;

  const pickTimeHtml = `<div class="kpi-card status-neutral">
      <div class="kpi-accent" style="background:var(--accent);"></div>
      <div class="kpi-header">
        <div class="kpi-icon-wrap" style="background:rgba(37,99,235,0.08);color:var(--accent);"><i class="ti ti-clock-play"></i></div>
      </div>
      <div class="kpi-label">Avg Pick Time</div>
      <div class="kpi-value">${d.apt || '—'}</div>
      <div class="kpi-sub">Average time to answer, across the whole process</div>
    </div>`;

  return statusHtml + trendHtml + pickTimeHtml + callbackHtml;
}

/* Top-of-dashboard stat groups. */
function buildTopStatGroups(d) {
  const obNoAnswer = Math.max(0, (d.outboundAll || 0) - (d.obAnswered || 0));
  return `<div class="stat-group-row">
    <div class="stat-group-card">
      <div class="stat-group-title"><i class="ti ti-phone-incoming"></i> IB Bifurcation</div>
      <div class="stat-group-chart" id="statChartIB"></div>
    </div>
    <div class="stat-group-card">
      <div class="stat-group-title"><i class="ti ti-phone-outgoing"></i> OB Bifurcation</div>
      <div class="stat-group-chart" id="statChartOB"></div>
    </div>
    <div class="stat-group-card">
      <div class="stat-group-title"><i class="ti ti-clock-hour-4"></i> AHT - Avg. &amp; Total</div>
      <div class="stat-group-split">
        <div class="stat-group-chart-sm" id="statChartAHTAvg"></div>
        <div class="stat-group-chart-sm" id="statChartAHTTotal"></div>
      </div>
    </div>
    <div class="stat-group-card">
      <div class="stat-group-title"><i class="ti ti-phone-x"></i> Missed Details</div>
      <div class="stat-group-chart" id="statChartMissed"></div>
    </div>
    <div class="stat-group-card">
      <div class="stat-group-title"><i class="ti ti-clock-off"></i> Missed — Working / Non-Working Hours</div>
      <div class="stat-group-chart" id="statChartMissedHours"></div>
    </div>
    <div class="stat-group-card">
      <div class="stat-group-title"><i class="ti ti-mail"></i> Emails Handled</div>
      <div class="stat-group-values">
        <div class="stat-group-item"><div class="v">${d.emailSentCount || 0}</div><div class="l">Total</div></div>
        <div class="stat-group-item"><div class="v">${d.emailDuration || '—'}</div><div class="l">Duration</div></div>
      </div>
    </div>
  </div>`;
}

/* Top 2-3 headline facts, promoted above the KPI grid */
function buildHighlightsStrip(facts) {
  if (!facts || !facts.length) return '';
  const top = facts.slice(0, 3);
  const typeColor = { danger: 'red', warning: 'amber', success: 'green', info: 'blue' };
  return `<div class="highlights-strip">
    ${top.map(f => `<div class="highlight-pill ${typeColor[f.type] || 'blue'}">
      <i class="ti ${f.icon}"></i>
      <div><strong>${f.title}</strong><span>${f.desc}</span></div>
    </div>`).join('')}
  </div>`;
}

/* Compact "needs attention" list — top 3 agents by missed rate */
function buildAttentionList(agents) {
  if (!agents || !agents.length) return '';
  const flagged = [...agents].filter(a => a.totalCalls > 0 && a.missedRate > 0).sort((a, b) => b.missedRate - a.missedRate).slice(0, 3);
  if (!flagged.length) return '';
  return `<div class="attention-list">
    <div class="attention-list-title"><i class="ti ti-alert-triangle"></i> Needs Attention — Highest Missed Rate</div>
    ${flagged.map(a => `<div class="attention-item">
      <span class="attention-agent">${a.agent}</span>
      <span class="attention-metric">${(a.missedRate * 100).toFixed(1)}% missed (${a.agentMissedIb}/${a.totalCalls})</span>
      <span class="insight-badge ${a.missedRate > 0.1 ? 'red' : 'amber'}">${a.missedRate > 0.1 ? 'High' : 'Watch'}</span>
    </div>`).join('')}
  </div>`;
}

function buildAgentTable(agents, isOverall, processName) {
  if (!agents || !agents.length) return '<div style="text-align:center;padding:30px;color:var(--muted);">No agent data available.</div>';
  // ResMed doesn't work CRM case closure or escalations the way other
  // processes do — those columns don't apply there. Appreciation stays for
  // everyone; Escalation gets its own dedicated agent-wise panel instead.
  const showCrmEscalation = processName !== 'ResMed';
  const tableHtml = `<div class="table-wrap">
    <table>
      <thead><tr>
        <th>Rank</th>
        <th>Agent</th>${isOverall ? '<th>Process</th>' : ''}
        <th>Productivity</th>
        <th>IB</th>
        <th>OB</th>
        <th>OB Ans</th>
        <th>OB Connectivity</th>
        <th>Email</th>
        <th>AHT</th>
        <th>APT</th>
        <th>Missed</th>
        <th>IB Hangup</th>
        <th>OB Hangup</th>
        <th>Login Duration</th>
        <th>Break Duration</th>
        <th>Training Duration</th>${showCrmEscalation ? `
        <th>CRM Closed</th>
        <th>CRM Partial</th>` : ''}
        <th>CRM</th>
        <th>Occupancy</th>
        <th>IB TT</th>
        <th>OB TT</th>
        <th>Appreciation</th>${showCrmEscalation ? `
        <th>Escalation</th>
        <th>Esc. Open</th>
        <th>Esc. Pending (Field)</th>
        <th>Esc. Pending (RHC)</th>` : ''}
      </tr></thead>
      <tbody>${agents.map((a, i) => `<tr>
        <td><span class="rank-badge ${i < 3 ? `rank-${i+1}` : 'rank-other'}">${i+1}</span></td>
        <td>${a.agent}</td>${isOverall ? `<td>${a.process}</td>` : ''}
        <td><strong>${a.productivityTotal}</strong></td>
        <td>${a.inboundAnswered}</td>
        <td>${a.outboundAll}</td>
        <td>${a.obAnswered || 0}</td>
        <td>${a.outboundAll > 0 ? ((a.obAnswered || 0) / a.outboundAll * 100).toFixed(1) : '0.0'}%</td>
        <td>${a.emailsHandled}</td>
        <td>${a.aht}</td>
        <td>${a.apt}</td>
        <td>${a.agentMissed}</td>
        <td>${a.hangupIB || 0}</td>
        <td>${a.hangupOB || 0}</td>
        <td>${a.loginDuration}</td>
        <td>${a.breakDuration}</td>
        <td>${a.trainingDuration}</td>${showCrmEscalation ? `
        <td>${a.closedCases || 0}</td>
        <td>${a.partialClosedCases || 0}</td>` : ''}
        <td>${(a.crmCall || 0) + (a.crmEmail || 0)}</td>
        <td>${(a.occupancy * 100).toFixed(1)}%</td>
        <td>${a.ibTalkTime}</td>
        <td>${a.obTalkTime}</td>
        <td>${a.appreciationCount || 0}</td>${showCrmEscalation ? `
        <td>${a.escalationCount || 0}</td>
        <td>${a.crmEscalationOpen || 0}</td>
        <td>${a.crmEscalationPendingField || 0}</td>
        <td>${a.crmEscalationPendingRhc || 0}</td>` : ''}
      </tr>`).join('')}</tbody>
    </table>
  </div>`;

  return `<div class="table-collapse">
    <button class="table-collapse-toggle" type="button" onclick="const w=this.closest('.table-collapse');w.classList.toggle('open');this.querySelector('span').textContent=w.classList.contains('open')?'Hide full table':'Show full table (${agents.length} agents)';">
      <i class="ti ti-table"></i> <span>Show full table (${agents.length} agents)</span>
    </button>
    <div class="table-collapse-body">${tableHtml}</div>
  </div>`;
}

function secondsToHm(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

/* Agent-wise + type-wise training duration. Source is a UNION of training_tracker
   (historical Excel backfill + whatever form submissions exist) and login_events
   (agents can select the same reason-level statuses as the form's Type of Training
   dropdown — e.g. "Process Training", "Operational / CRM Work" — which is the
   authoritative source now that the form isn't reliably filled in). Both are
   merged server-side in tracker_insights_webhook.json, so this just renders
   whatever comes back, grouped by agent. */
function buildTrainingInsights(training) {
  if (!training || !training.length) return '<div style="text-align:center;padding:30px;color:var(--muted);">No training entries logged for this range.</div>';
  const totalSec = training.reduce((s, t) => s + t.durationSec, 0);
  const totalCount = training.reduce((s, t) => s + t.count, 0);
  const rows = [...training].sort((a, b) => b.durationSec - a.durationSec);
  return `
    <div class="stat-group-row" style="margin-bottom:14px;">
      <div class="stat-group-card">
        <div class="stat-group-title"><i class="ti ti-clock"></i> Total Training Duration (All Agents)</div>
        <div class="stat-group-values">
          <div class="stat-group-item"><div class="v">${secondsToHm(totalSec)}</div><div class="l">Total Duration</div></div>
          <div class="stat-group-item"><div class="v">${totalCount}</div><div class="l">Sessions</div></div>
        </div>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Agent</th><th>Training Type</th><th>Sessions</th><th>Total Duration</th></tr></thead>
        <tbody>${rows.map(t => `<tr><td>${t.agent}</td><td>${t.category}</td><td>${t.count}</td><td>${secondsToHm(t.durationSec)}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
}

/* Agent-wise Call Quality Ratio, from quality_audit via the tracker-insights webhook. */
function buildQualityInsights(quality) {
  if (!quality || !quality.length) return '<div style="text-align:center;padding:30px;color:var(--muted);">No quality audits logged for this range.</div>';
  const sorted = [...quality].sort((a, b) => b.avgPercentage - a.avgPercentage);
  return `<div class="chart-container" id="qualityRatioChart" style="height:${Math.max(160, sorted.length * 34)}px;margin-bottom:14px;"></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Agent</th><th>Audits</th><th>Quality Ratio</th></tr></thead>
      <tbody>${sorted.map(q => `<tr><td>${q.agent}</td><td>${q.count}</td><td>${(q.avgPercentage * 100).toFixed(1)}%</td></tr>`).join('')}</tbody>
    </table>
  </div>`;
}

/* Agent-wise + reason-wise Downtime, from activity_tracker (form submissions)
   via the tracker-insights webhook. Downtime reasons (Application/Portal Issue,
   Calling/Telephony Issue, System/Network Connectivity Issue, Power/Electricity
   Issue, External/Other) are system/technical issues with no equivalent status
   in login_events — Meal/Short Break/Bio-Break are a separate "Breaks" category,
   not Downtime, and must not be conflated with it. The form is the sole source. */
function buildDowntimeInsights(downtime) {
  if (!downtime || !downtime.length) return '<div style="text-align:center;padding:30px;color:var(--muted);">No downtime logged for this range.</div>';
  const totalSec = downtime.reduce((s, d) => s + d.durationSec, 0);
  const rows = [...downtime].sort((a, b) => b.durationSec - a.durationSec);
  return `
    <div class="stat-group-row" style="margin-bottom:14px;">
      <div class="stat-group-card">
        <div class="stat-group-title"><i class="ti ti-clock"></i> Total Downtime</div>
        <div class="stat-group-values">
          <div class="stat-group-item"><div class="v">${secondsToHm(totalSec)}</div><div class="l">Total Duration</div></div>
        </div>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Agent</th><th>Reason</th><th>Instances</th><th>Total Duration</th></tr></thead>
        <tbody>${rows.map(d => `<tr><td>${d.agent}</td><td>${d.category}</td><td>${d.count}</td><td>${secondsToHm(d.durationSec)}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function buildClosedPartialTable(agents) {
  if (!agents || !agents.length) return '<div style="text-align:center;padding:30px;color:var(--muted);">No data available.</div>';
  const rows = agents
    .map(a => {
      const total = (a.closedCases || 0) + (a.partialClosedCases || 0);
      const closedRatio = total > 0 ? (a.closedCases / total) * 100 : 0;
      return { agent: a.agent, closedCases: a.closedCases || 0, partialClosedCases: a.partialClosedCases || 0, total, closedRatio };
    })
    .filter(a => a.total > 0)
    .sort((a, b) => b.total - a.total);
  if (!rows.length) return '<div style="text-align:center;padding:30px;color:var(--muted);">No Closed/Partial Closed cases logged this month.</div>';
  return `<div class="table-wrap">
    <table>
      <thead><tr>
        <th>Agent</th>
        <th>Closed</th>
        <th>Partial Closed</th>
        <th>Total</th>
        <th>Closed Ratio</th>
      </tr></thead>
      <tbody>${rows.map(a => `<tr>
        <td>${a.agent}</td>
        <td>${a.closedCases}</td>
        <td>${a.partialClosedCases}</td>
        <td><strong>${a.total}</strong></td>
        <td>${a.closedRatio.toFixed(1)}%</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}

/* Agent-wise Appreciation/Escalation — for processes where these aren't shown
   as columns in the main Agent Performance table (e.g. ResMed, which doesn't
   have a CRM case/escalation workflow the same way other processes do). */
function buildAppreciationEscalationTable(agents) {
  if (!agents || !agents.length) return '<div style="text-align:center;padding:30px;color:var(--muted);">No data available.</div>';
  const rows = agents
    .filter(a => (a.appreciationCount || 0) + (a.escalationCount || 0) > 0)
    .sort((a, b) => (b.appreciationCount || 0) - (a.appreciationCount || 0));
  if (!rows.length) return '<div style="text-align:center;padding:30px;color:var(--muted);">No Appreciation or Escalation logged this month.</div>';
  return `<div class="table-wrap">
    <table>
      <thead><tr>
        <th>Agent</th>
        <th>Appreciation</th>
        <th>Escalation</th>
        <th>Esc. Open</th>
        <th>Esc. Pending (Field)</th>
        <th>Esc. Pending (RHC)</th>
      </tr></thead>
      <tbody>${rows.map(a => `<tr>
        <td>${a.agent}</td>
        <td>${a.appreciationCount || 0}</td>
        <td>${a.escalationCount || 0}</td>
        <td>${a.crmEscalationOpen || 0}</td>
        <td>${a.crmEscalationPendingField || 0}</td>
        <td>${a.crmEscalationPendingRhc || 0}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}

function buildGlobalRankingTable(allRanked) {
  if (!allRanked || !allRanked.length) return '<div style="text-align:center;padding:30px;color:var(--muted);">No ranking data.</div>';
  return `<div class="table-wrap">
    <table>
      <thead><tr><th>Global Rank</th><th>Agent</th><th>Process</th><th>Productivity</th><th>AHT</th><th>Missed</th><th>Occupancy</th></tr></thead>
      <tbody>${allRanked.map((a, i) => `<tr>
        <td><span class="rank-badge ${i < 3 ? `rank-${i+1}` : 'rank-other'}">${i+1}</span></td>
        <td><strong>${a.agent}</strong></td>
        <td>${a.process}</td>
        <td>${a.productivityTotal}</td>
        <td>${a.aht}</td>
        <td>${a.agentMissed}</td>
        <td>${(a.occupancy * 100).toFixed(1)}%</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}
