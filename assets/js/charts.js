/* ══════════════════════════════════════════════════
   CHARTS — Chart.js Configurations
   ══════════════════════════════════════════════════ */

const chartColors = {
  blue: '#2563eb',
  green: '#059669',
  amber: '#d97706',
  red: '#dc2626',
  purple: '#7c3aed',
  teal: '#0891b2',
  pink: '#be185d',
  orange: '#ea580c'
};

const colorPalette = ['#2563eb','#059669','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#ea580c'];

if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);

/* Shared data-label formatter — hides zero/empty values so charts with many
   near-zero bars (e.g. Agent Missed) don't get cluttered with "0" everywhere. */
function dlFormatter(value) {
  if (value === null || value === undefined || value === '' || value === 0) return '';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return String(value);
}

function getCtx(id) {
  let el = document.getElementById(id);
  if (!el) return null;
  // If container is not a canvas, create one inside it
  if (el.tagName !== 'CANVAS') {
    const canvas = document.createElement('canvas');
    canvas.id = id + '-canvas';
    el.innerHTML = '';
    el.appendChild(canvas);
    el = canvas;
  }
  const ctx = el.getContext('2d');
  if (ctx && ctx.chart) ctx.chart.destroy();
  return ctx;
}

function defaultOpts(title, isDark) {
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: textColor, font: { size: 10 }, boxWidth: 12, padding: 8 } },
      tooltip: { backgroundColor: isDark ? '#1a1d2e' : '#fff', titleColor: isDark ? '#e8eaed' : '#1a1d2e', bodyColor: isDark ? '#b0b5c0' : '#6b7280', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderWidth: 1, padding: 10, cornerRadius: 8 },
      datalabels: { anchor: 'end', align: 'end', offset: 2, color: isDark ? '#e8eaed' : '#374151', font: { size: 9, weight: '600' }, formatter: dlFormatter, clamp: true }
    },
    scales: {
      x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
      y: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false }, beginAtZero: true }
    }
  };
}

/* ── KPI TREND LINE ── */
function renderTrendChart(id, timeSeries, metric, label, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const data = timeSeries;
  const values = data.map(d => metric === 'aht' ? (d.aht || 0) : d[metric] || 0);
  ctx.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date?.slice(5) || ''),
      datasets: [{
        label, data: values,
        borderColor: chartColors.blue,
        backgroundColor: (ctx) => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 260);
          g.addColorStop(0, 'rgba(37,99,235,0.18)');
          g.addColorStop(1, 'rgba(37,99,235,0.01)');
          return g;
        },
        fill: true, tension: 0.35,
        pointRadius: 2, pointHoverRadius: 5,
        borderWidth: 2
      }]
    },
    options: {
      ...defaultOpts(label, isDark),
      plugins: { ...defaultOpts(label, isDark).plugins, legend: { display: false } },
      interaction: { intersect: false, mode: 'index' }
    }
  });
}

/* ── PROCESS COMPARISON BAR ── */
function renderProcessComparison(id, processStats, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const labels = processStats.map(p => p.process);
  const productivity = processStats.map(p => p.totalProductivity);
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Productivity', data: productivity, backgroundColor: colorPalette.slice(0, labels.length), borderRadius: 4 }
      ]
    },
    options: {
      ...defaultOpts('Process Comparison', isDark),
      indexAxis: 'y',
      plugins: { ...defaultOpts('Process Comparison', isDark).plugins, legend: { display: false } }
    }
  });
}

/* ── AGENT RANKING BAR ── */
function renderAgentRanking(id, agents, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const top = agents.slice(0, 10);
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(a => a.agent),
      datasets: [{
        label: 'Productivity',
        data: top.map(a => a.productivityTotal),
        backgroundColor: top.map((_, i) => i === 0 ? chartColors.amber : i === 1 ? '#9ca3af' : i === 2 ? chartColors.orange : chartColors.blue),
        borderRadius: 4
      }]
    },
    options: {
      ...defaultOpts('Top Agents', isDark),
      indexAxis: 'y',
      plugins: { ...defaultOpts('Top Agents', isDark).plugins, legend: { display: false } }
    }
  });
}

/* ── PARETO ── */
function renderPareto(id, agents, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const sorted = [...agents].sort((a, b) => b.productivityTotal - a.productivityTotal);
  const total = sorted.reduce((s, a) => s + a.productivityTotal, 0) || 1;
  let cumSum = 0;
  const cumPct = sorted.map(a => { cumSum += a.productivityTotal; return (cumSum / total) * 100; });
  const labels = sorted.map(a => a.agent);

  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Productivity',
          data: sorted.map(a => a.productivityTotal),
          backgroundColor: chartColors.blue,
          borderRadius: 2,
          yAxisID: 'y'
        },
        {
          label: 'Cumulative %',
          data: cumPct,
          type: 'line',
          borderColor: chartColors.red,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: chartColors.red,
          tension: 0.3,
          yAxisID: 'y1',
          datalabels: { align: 'top', color: chartColors.red, formatter: v => v.toFixed(0) + '%' }
        }
      ]
    },
    options: {
      ...defaultOpts('Pareto Analysis', isDark),
      scales: {
        x: { ticks: { color: isDark ? '#b0b5c0' : '#6b7280', font: { size: 9 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: isDark ? '#b0b5c0' : '#6b7280', font: { size: 9 } }, grid: { display: false }, title: { display: true, text: 'Productivity', color: isDark ? '#b0b5c0' : '#6b7280', font: { size: 10 } } },
        y1: { beginAtZero: true, max: 100, position: 'right', ticks: { color: chartColors.red, font: { size: 9 }, callback: v => v + '%' }, grid: { display: false }, title: { display: true, text: 'Cumulative %', color: chartColors.red, font: { size: 10 } } }
      },
      plugins: { ...defaultOpts('Pareto Analysis', isDark).plugins, legend: { position: 'bottom', labels: { color: isDark ? '#b0b5c0' : '#6b7280', font: { size: 10 } } } }
    }
  });
}

/* ── DAILY TREND MULTI-METRIC ── */
function renderDailyTrend(id, timeSeries, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const data = timeSeries;
  ctx.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date?.slice(5) || ''),
      datasets: [
        { label: 'Inbound', data: data.map(d => d.ib), borderColor: chartColors.blue, backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2 },
        { label: 'Outbound', data: data.map(d => d.ob), borderColor: chartColors.green, backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2 },
        { label: 'Missed', data: data.map(d => d.missed), borderColor: chartColors.red, backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2, borderDash: [4, 2] }
      ]
    },
    options: {
      ...defaultOpts('Daily Trend', isDark),
      interaction: { intersect: false, mode: 'index' }
    }
  });
}

/* ── HEATMAP (simulated with bar chart) ── */
function renderAgentHeatmap(id, agents, metric, label, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const top = agents.slice(0, 12);
  const values = top.map(a => {
    if (metric === 'occupancy') return Math.round(a.occupancy * 100);
    if (metric === 'missedRate') return Math.round(a.missedRate * 100);
    return a.productivityTotal;
  });
  const max = Math.max(...values, 1);
  const bg = values.map(v => {
    const pct = v / max;
    if (pct > 0.75) return chartColors.green;
    if (pct > 0.5) return chartColors.blue;
    if (pct > 0.25) return chartColors.amber;
    return chartColors.red;
  });
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(a => a.agent),
      datasets: [{ label, data: values, backgroundColor: bg, borderRadius: 3 }]
    },
    options: {
      ...defaultOpts(label, isDark),
      indexAxis: 'y',
      plugins: { ...defaultOpts(label, isDark).plugins, legend: { display: false } }
    }
  });
}

/* ── DAY-WISE BAR CHART (for Weekly/Monthly period) ── */
function renderDayWiseChart(id, timeSeries, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const data = timeSeries;
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.date?.slice(5) || ''),
      datasets: [
        { label: 'Inbound', data: data.map(d => d.ib), backgroundColor: 'rgba(37,99,235,0.75)', borderRadius: 3 },
        { label: 'Outbound', data: data.map(d => d.ob), backgroundColor: 'rgba(5,150,105,0.75)', borderRadius: 3 },
        { label: 'Missed', data: data.map(d => d.missed), backgroundColor: 'rgba(220,38,38,0.75)', borderRadius: 3 }
      ]
    },
    options: {
      ...defaultOpts('Daily Trend', isDark),
      plugins: { ...defaultOpts('Daily Trend', isDark).plugins, legend: { position: 'bottom', labels: { color: isDark ? '#b0b5c0' : '#6b7280', font: { size: 10 } } } },
      scales: {
        x: { stacked: false, ticks: { color: isDark ? '#b0b5c0' : '#6b7280', font: { size: 9 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: isDark ? '#b0b5c0' : '#6b7280', font: { size: 9 } }, grid: { display: false } }
      }
    }
  });
}

/* ── AGENT PRODUCTIVITY (Inbound Answered + Outbound All + Email Handled) ──
   vmmExtrasByAgent (VMM only): Map<agent, {caseUpdate, caseLoggedEmail,
   resolved, reminder}> from the live vmm-productivity webhook, keyed by the
   agent name as it appears in VMM's own CRM (vmm_users.name) -- merged in
   here by matching against `agent.agent` from combined_summary. Adds 4 more
   bars (plus Non Trading, already on the agent object) without touching the
   IB+OB+Email total shown in the axis label, for any other process. */
function renderAgentProductivity(id, agents, isDark, vmmExtrasByAgent) {
  const ctx = getCtx(id);
  if (!ctx) return;
  // Computed live here (IB + OB + Email) rather than trusting a precomputed
  // productivityTotal field, so it always matches whatever emailsHandled value
  // was actually passed in (e.g. the live tracker-insights override).
  const withTotal = agents.map(a => ({ ...a, liveTotal: (a.inboundAnswered || 0) + (a.outboundAll || 0) + (a.emailsHandled || 0) }));
  const sorted = withTotal.sort((a, b) => b.liveTotal - a.liveTotal);
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  const datasets = [
    { label: 'Inbound Answered', data: sorted.map(a => a.inboundAnswered), backgroundColor: 'rgba(37,99,235,0.75)', borderRadius: 3 },
    { label: 'Outbound All', data: sorted.map(a => a.outboundAll), backgroundColor: 'rgba(234,88,12,0.75)', borderRadius: 3 },
    { label: 'Email Handled', data: sorted.map(a => a.emailsHandled), backgroundColor: 'rgba(217,119,6,0.75)', borderRadius: 3 }
  ];
  if (vmmExtrasByAgent) {
    const extra = (a, field) => (vmmExtrasByAgent.get(a.agent) || {})[field] || 0;
    datasets.push(
      { label: 'Case Update', data: sorted.map(a => extra(a, 'caseUpdate')), backgroundColor: 'rgba(124,58,237,0.75)', borderRadius: 3 },
      { label: 'Case Logged (Email)', data: sorted.map(a => extra(a, 'caseLoggedEmail')), backgroundColor: 'rgba(220,38,38,0.75)', borderRadius: 3 },
      { label: 'Resolved/Closed', data: sorted.map(a => extra(a, 'resolved')), backgroundColor: 'rgba(16,185,129,0.75)', borderRadius: 3 },
      { label: 'Reminder', data: sorted.map(a => extra(a, 'reminder')), backgroundColor: 'rgba(245,158,11,0.75)', borderRadius: 3 },
      { label: 'Non Trading', data: sorted.map(a => a.nonTrading || 0), backgroundColor: 'rgba(107,114,128,0.75)', borderRadius: 3 }
    );
  }
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      // Multi-line tick: agent name + their IB+OB+Email total, shown as a per-agent
      // KPI under the axis rather than adding a 4th "total" bar to the chart.
      labels: sorted.map(a => [a.agent, `Total: ${a.liveTotal}`]),
      datasets
    },
    options: {
      ...defaultOpts('Agent Productivity', isDark),
      layout: { padding: { top: 24 } },
      plugins: {
        ...defaultOpts('Agent Productivity', isDark).plugins,
        legend: { position: 'bottom', labels: { color: textColor, font: { size: 10 } } }
      },
      scales: {
        x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: textColor, font: { size: 10 }, precision: 0 }, grid: { display: false } }
      }
    }
  });
}

/* ── BREAK DURATION vs 1-HOUR TARGET (total if 1 day selected, daily average otherwise) ── */
function renderBreakDuration(id, agents, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const TARGET_MIN = 60;
  const sorted = agents.filter(a => a.breakDaysCount > 0);
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(a => a.agent),
      datasets: [
        {
          label: 'Break Duration',
          type: 'bar',
          data: sorted.map(a => Math.round(a.breakSecForTarget / 60)),
          backgroundColor: sorted.map(a => a.breakVsTargetSec > 0 ? 'rgba(220,38,38,0.75)' : 'rgba(5,150,105,0.75)'),
          borderRadius: 3,
          order: 2,
          // Exactly 1h is compliant (breakVsTargetSec > 0 is a strict check) --
          // never flagged red. For bars that DO exceed, the label shows how
          // much OVER the 1h target they are, not the full break duration.
          datalabels: {
            anchor: 'end', align: 'start', offset: 4, color: '#fff', font: { size: 9, weight: '700' },
            formatter: (v, ctx2) => {
              if (!v) return '';
              const a = sorted[ctx2.dataIndex];
              return a.breakVsTargetSec > 0 ? `+${secondsToHms(a.breakVsTargetSec)}` : secondsToHms(v * 60);
            }
          }
        },
        {
          label: 'Target (1h)',
          type: 'line',
          data: sorted.map(() => TARGET_MIN),
          borderColor: 'rgba(220,38,38,0.9)',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          order: 1,
          datalabels: { display: false }
        }
      ]
    },
    options: {
      ...defaultOpts('Break Duration vs Target', isDark),
      plugins: { ...defaultOpts('Break Duration vs Target', isDark).plugins, legend: { position: 'bottom', labels: { color: textColor, font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: textColor, font: { size: 10 }, callback: v => secondsToHms(v * 60) }, grid: { display: false } }
      }
    }
  });
}

/* ── AGENT MISSED — INBOUND / OUTBOUND ── */
function renderAgentMissed(id, agents, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const sorted = [...agents].filter(a => (a.agentMissedIb || 0) + (a.agentMissedOb || 0) > 0)
    .sort((a, b) => (b.agentMissedIb + b.agentMissedOb) - (a.agentMissedIb + a.agentMissedOb));
  // % is out of that side's own total handled -- IB missed / (IB answered + IB
  // missed), OB missed / total OB dialed -- not out of the other side's volume.
  const ibLabel = (v, ctx) => { const a = sorted[ctx.dataIndex]; const denom = a.totalCalls || 1; return v ? `${v} (${Math.round(v / denom * 100)}%)` : ''; };
  const obLabel = (v, ctx) => { const a = sorted[ctx.dataIndex]; const denom = a.outboundAll || 1; return v ? `${v} (${Math.round(v / denom * 100)}%)` : ''; };
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(a => a.agent),
      datasets: [
        { label: 'Missed (Inbound)', data: sorted.map(a => a.agentMissedIb || 0), backgroundColor: 'rgba(220,38,38,0.75)', borderRadius: 3, datalabels: { anchor: 'center', align: 'center', color: '#fff', font: { size: 9, weight: '600' }, formatter: ibLabel } },
        { label: 'Missed (Outbound)', data: sorted.map(a => a.agentMissedOb || 0), backgroundColor: 'rgba(234,88,12,0.75)', borderRadius: 3, datalabels: { anchor: 'center', align: 'center', color: '#fff', font: { size: 9, weight: '600' }, formatter: obLabel } }
      ]
    },
    options: {
      ...defaultOpts('Agent Missed', isDark),
      plugins: { ...defaultOpts('Agent Missed', isDark).plugins, legend: { position: 'bottom', labels: { color: textColor, font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: textColor, font: { size: 10 }, precision: 0 }, grid: { display: false } }
      }
    }
  });
}

/* ── AGENT HANGUP — INBOUND / OUTBOUND (calls hung up within 10s) ── */
function renderAgentHangup(id, agents, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  const sorted = [...agents].filter(a => (a.hangupIB || 0) + (a.hangupOB || 0) > 0)
    .sort((a, b) => (b.hangupIB + b.hangupOB) - (a.hangupIB + a.hangupOB));
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(a => a.agent),
      datasets: [
        { label: 'Hangup (Inbound)', data: sorted.map(a => a.hangupIB || 0), backgroundColor: 'rgba(220,38,38,0.75)', borderRadius: 3, datalabels: { anchor: 'center', align: 'center', color: '#fff' } },
        { label: 'Hangup (Outbound)', data: sorted.map(a => a.hangupOB || 0), backgroundColor: 'rgba(234,88,12,0.75)', borderRadius: 3, datalabels: { anchor: 'center', align: 'center', color: '#fff' } }
      ]
    },
    options: {
      ...defaultOpts('Agent Hangup', isDark),
      plugins: { ...defaultOpts('Agent Hangup', isDark).plugins, legend: { position: 'bottom', labels: { color: textColor, font: { size: 10 } } } },
      scales: {
        x: { stacked: true, ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { color: textColor, font: { size: 10 }, precision: 0 }, grid: { display: false } }
      }
    }
  });
}

/* ── TRAINING DURATION — AGENT WISE TOTAL (type breakdown stays in the table below) ── */
function renderTrainingByAgent(id, training, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  const totals = new Map();
  (training || []).forEach(t => totals.set(t.agent, (totals.get(t.agent) || 0) + t.durationSec));
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(([agent]) => agent),
      datasets: [{ label: 'Training Duration', data: sorted.map(([, sec]) => Math.round(sec / 60)), backgroundColor: 'rgba(37,99,235,0.8)', borderRadius: 3 }]
    },
    options: {
      ...defaultOpts('Training Duration by Agent', isDark),
      // Reserve headroom above the tallest bar or its datalabel gets clipped
      // by the canvas edge (happened with the previous no-padding layout).
      layout: { padding: { top: 24 } },
      plugins: { ...defaultOpts('Training Duration by Agent', isDark).plugins, legend: { display: false }, datalabels: { anchor: 'end', align: 'end', offset: 2, color: textColor, font: { size: 9, weight: '600' }, formatter: v => v ? secondsToHms(v * 60) : '' } },
      scales: {
        x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: textColor, font: { size: 10 }, callback: v => secondsToHms(v * 60) }, grid: { display: false } }
      }
    }
  });
}

/* ── APPRECIATION & ESCALATION — AGENT WISE (per-column detail stays in the table below) ── */
function renderAppreciationEscalation(id, agents, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  const sorted = (agents || []).filter(a => (a.appreciationCount || 0) + (a.escalationCount || 0) > 0)
    .sort((a, b) => (b.appreciationCount || 0) - (a.appreciationCount || 0));
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(a => a.agent),
      datasets: [
        { label: 'Appreciation', data: sorted.map(a => a.appreciationCount || 0), backgroundColor: 'rgba(5,150,105,0.8)', borderRadius: 3, datalabels: { anchor: 'center', align: 'center', color: '#fff', font: { size: 9, weight: '600' }, formatter: v => v || '' } },
        { label: 'Escalation', data: sorted.map(a => a.escalationCount || 0), backgroundColor: 'rgba(220,38,38,0.8)', borderRadius: 3, datalabels: { anchor: 'center', align: 'center', color: '#fff', font: { size: 9, weight: '600' }, formatter: v => v || '' } }
      ]
    },
    options: {
      ...defaultOpts('Appreciation & Escalation by Agent', isDark),
      plugins: { ...defaultOpts('Appreciation & Escalation by Agent', isDark).plugins, legend: { position: 'bottom', labels: { color: textColor, font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: textColor, font: { size: 10 }, precision: 0 }, grid: { display: false } }
      }
    }
  });
}

/* ── DOWNTIME — AGENT WISE TOTAL (reason breakdown stays in the table below) ── */
function renderDowntimeByAgent(id, downtime, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  const totals = new Map();
  (downtime || []).forEach(d => totals.set(d.agent, (totals.get(d.agent) || 0) + d.durationSec));
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(([agent]) => agent),
      datasets: [{ label: 'Downtime', data: sorted.map(([, sec]) => Math.round(sec / 60)), backgroundColor: 'rgba(220,38,38,0.8)', borderRadius: 3 }]
    },
    options: {
      ...defaultOpts('Downtime by Agent', isDark),
      layout: { padding: { top: 24 } },
      plugins: { ...defaultOpts('Downtime by Agent', isDark).plugins, legend: { display: false }, datalabels: { anchor: 'end', align: 'end', offset: 2, color: textColor, font: { size: 9, weight: '600' }, formatter: v => v ? secondsToHms(v * 60) : '' } },
      scales: {
        x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: textColor, font: { size: 10 }, callback: v => secondsToHms(v * 60) }, grid: { display: false } }
      }
    }
  });
}

/* ── CALL QUALITY RATIO — AGENT WISE (from quality_audit) ── */
function renderQualityRatio(id, quality, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const sorted = [...quality].sort((a, b) => b.avgPercentage - a.avgPercentage);
  const colorFor = pct => pct >= 95 ? 'rgba(5,150,105,0.75)' : pct >= 85 ? 'rgba(217,119,6,0.75)' : 'rgba(220,38,38,0.75)';
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(q => `${q.agent} (${q.count})`),
      datasets: [{
        label: 'Quality Ratio %',
        data: sorted.map(q => +(q.avgPercentage * 100).toFixed(1)),
        backgroundColor: sorted.map(q => colorFor(q.avgPercentage * 100)),
        borderRadius: 3,
        datalabels: { formatter: v => v ? v + '%' : '' }
      }]
    },
    options: {
      ...defaultOpts('Call Quality Ratio', isDark),
      indexAxis: 'y',
      plugins: { ...defaultOpts('Call Quality Ratio', isDark).plugins, legend: { display: false } },
      scales: {
        x: { min: 0, max: 100, ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

/* ── COMPACT STAT BAR (small horizontal bar chart replacing a plain number list
   inside a stat-group-card — e.g. IB Bifurcation, Missed Details) ── */
function renderStatBar(id, labels, values, colors, isDark, labelFormatter) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  const fmt = labelFormatter || (v => v);
  // The longest label (e.g. a formatted duration) needs room reserved past the
  // bar end, or the highest-value bar's own label gets clipped by the card's
  // edge — this happened with a bar near the axis max ("37" got sliced off).
  const maxLabelLen = Math.max(...values.map(v => String(fmt(v)).length), 1);
  const maxVal = Math.max(...values, 1);
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderRadius: 3, barThickness: 12 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 8 + maxLabelLen * 6 } },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: { anchor: 'end', align: 'end', offset: 3, clamp: true, color: textColor, font: { size: 9.5, weight: '700' }, formatter: fmt }
      },
      scales: {
        x: { display: false, beginAtZero: true, suggestedMax: maxVal * 1.001 },
        y: { ticks: { color: textColor, font: { size: 9.5 } }, grid: { display: false } }
      }
    }
  });
}

/* ── HOURLY MISSED CALLS BIFURCATION (stacked by disposition type, 8am start) ── */
function renderHourlyMissed(id, hourlyMissed, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const typeColors = {
    'Agent Missed': 'rgba(220,38,38,0.75)',
    'IVR Missed': 'rgba(217,119,6,0.75)',
    'Queue Missed': 'rgba(124,58,237,0.75)',
    'Service Missed': 'rgba(8,145,178,0.75)'
  };
  const fallbackPalette = ['rgba(37,99,235,0.75)', 'rgba(5,150,105,0.75)', 'rgba(107,114,128,0.75)'];
  const types = [...new Set((hourlyMissed || []).map(r => r.type))].sort();
  const byHourType = new Map((hourlyMissed || []).map(r => [`${r.hour}|${r.type}`, r.count]));
  const order = Array.from({ length: 24 }, (_, i) => (i + 8) % 24);
  const labels = order.map(h => h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`);
  const datasets = types.map((type, i) => ({
    label: type,
    data: order.map(h => byHourType.get(`${h}|${type}`) || 0),
    backgroundColor: typeColors[type] || fallbackPalette[i % fallbackPalette.length],
    borderRadius: 2
  }));
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      ...defaultOpts('Hourly Missed Calls', isDark),
      plugins: { ...defaultOpts('Hourly Missed Calls', isDark).plugins, datalabels: { anchor: 'center', align: 'center', color: '#fff', font: { size: 9, weight: '700' }, formatter: dlFormatter } },
      scales: {
        x: { stacked: true, ticks: { color: textColor, font: { size: 9.5 } }, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

/* ── FRESH CALLS: CDR NOTES vs CRM LOGGED (day-wise comparison) ── */
function renderFreshCallsComparison(id, freshCallsComparison, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  const rows = freshCallsComparison || [];
  // Both CDR-side (Fresh Inbound / Call Back on Missed) and CRM-side (cases
  // logged) are now split the same way -- 4 bars total -- instead of the CRM
  // side being one combined total, so IB and CB compare directly on both sides.
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.agent),
      datasets: [
        {
          label: 'Fresh Inbound', data: rows.map(r => r.ibFreshCount || 0), backgroundColor: 'rgba(37,99,235,0.75)', borderRadius: 3,
          datalabels: { anchor: 'end', align: 'end', offset: 2, color: textColor, font: { size: 9, weight: '600' }, formatter: v => v || '' }
        },
        {
          label: 'Call Back on Missed', data: rows.map(r => r.callbackFreshCount || 0), backgroundColor: 'rgba(217,119,6,0.75)', borderRadius: 3,
          datalabels: { anchor: 'end', align: 'end', offset: 2, color: textColor, font: { size: 9, weight: '600' }, formatter: v => v || '' }
        },
        {
          label: 'CRM Case Logged (Inbound)', data: rows.map(r => r.crmIbCount || 0), backgroundColor: 'rgba(5,150,105,0.75)', borderRadius: 3,
          datalabels: { anchor: 'end', align: 'end', offset: 2, color: textColor, font: { size: 9, weight: '600' }, formatter: v => v || '' }
        },
        {
          label: 'CRM Case Logged (Call Back)', data: rows.map(r => r.crmCbCount || 0), backgroundColor: 'rgba(124,58,237,0.75)', borderRadius: 3,
          datalabels: { anchor: 'end', align: 'end', offset: 2, color: textColor, font: { size: 9, weight: '600' }, formatter: v => v || '' }
        }
      ]
    },
    options: {
      ...defaultOpts('Fresh Calls vs CRM Logged', isDark),
      layout: { padding: { top: 24 } },
      scales: {
        x: { ticks: { color: textColor, font: { size: 9.5 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

/* ── FACILITY: AGENT-WISE CASE COMPARISON CHARTS (Infres/VMM/Nihon combined) ── */
function renderFacilityCallCases(id, agents, stgTagging, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const stgMap = new Map((stgTagging || []).map(r => [`${r.process}||${r.agent}`, r.count]));
  const rows = agents || [];
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(a => a.agent),
      datasets: [
        { label: 'Sum of Inbound Answered', data: rows.map(a => a.inboundAnswered || 0), backgroundColor: 'rgba(37,99,235,0.8)', borderRadius: 3 },
        { label: 'CRM Cases Logged', data: rows.map(a => a.crmCall || 0), backgroundColor: 'rgba(220,38,38,0.8)', borderRadius: 3 },
        { label: 'Cases as per STg Tagging', data: rows.map(a => stgMap.get(`${a.process}||${a.agent}`) || 0), backgroundColor: 'rgba(132,204,22,0.8)', borderRadius: 3 }
      ]
    },
    options: defaultOpts('Answered Calls vs CRM Case Logged', isDark)
  });
}

function renderFacilityEmailCases(id, agents, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const rows = agents || [];
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(a => a.agent),
      datasets: [
        { label: 'E-mail Case Logged Count', data: rows.map(a => a.crmEmail || 0), backgroundColor: 'rgba(37,99,235,0.8)', borderRadius: 3 },
        { label: 'Email CRM Case Logged + Non Trading', data: rows.map(a => (a.crmEmail || 0) + (a.nonTrading || 0)), backgroundColor: 'rgba(220,38,38,0.8)', borderRadius: 3 }
      ]
    },
    options: defaultOpts('Email vs CRM Email Case Logged', isDark)
  });
}

/* ── IB CALLS vs CRM CASES vs APPOINTMENTS — AGENT WISE (PSRI only) ── */
function renderIBCasesAppointments(id, agents, appointments, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  const apptByAgent = new Map((appointments || []).map(a => [a.agent, a.count]));
  const rows = (agents || []).filter(a => (a.inboundAnswered || 0) + (a.crmInboundCases || 0) + (apptByAgent.get(a.agent) || 0) > 0);
  const crmCases = rows.map(a => a.crmInboundCases || 0);
  const ibHandled = rows.map(a => a.inboundAnswered || 0);
  const apptCounts = rows.map(a => apptByAgent.get(a.agent) || 0);
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(a => a.agent),
      datasets: [
        { label: 'IB Calls Answered', data: rows.map(a => a.inboundAnswered || 0), backgroundColor: 'rgba(37,99,235,0.8)', borderRadius: 3 },
        // Inbound-only, not the blended Total_Cases (which also includes
        // outbound-originated CRM cases) -- this chart is specifically IB vs CRM vs Appointments.
        { label: 'CRM Cases Logged', data: crmCases, backgroundColor: 'rgba(220,38,38,0.8)', borderRadius: 3 },
        {
          label: 'Appointments', data: apptCounts, backgroundColor: 'rgba(5,150,105,0.8)', borderRadius: 3,
          // Appointment % = Appointments / IB Calls Answered (inbound handled),
          // shown alongside the raw count on the bar's own label.
          datalabels: {
            anchor: 'end', align: 'end', offset: 2, clamp: true, color: textColor, font: { size: 9, weight: '600' },
            formatter: (value, ctx2) => {
              if (!value) return '';
              const total = ibHandled[ctx2.dataIndex] || 0;
              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
              return `${value} (${pct}%)`;
            }
          }
        }
      ]
    },
    options: defaultOpts('IB Calls vs CRM Cases vs Appointments', isDark)
  });
}

/* ── EMAIL SENT — AGENT WISE (tagged, post-cutover only; Email Received has no
   per-agent attribution in the source data, so it isn't charted) ── */
function renderEmailSentAgentWise(id, agents, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const rows = (agents || []).filter(a => (a.emailSentTagged || 0) > 0)
    .sort((a, b) => (b.emailSentTagged || 0) - (a.emailSentTagged || 0));
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(a => a.agent),
      datasets: [{ label: 'Email Sent', data: rows.map(a => a.emailSentTagged || 0), backgroundColor: 'rgba(37,99,235,0.8)', borderRadius: 3 }]
    },
    options: defaultOpts('Email Sent — Agent Wise', isDark)
  });
}

/* ── OUTBOUND ACTIVITY — Total/Connected bars, connectivity % labeled on the
   Connected bar itself instead of a separate line series ──
   rows: [{ category, total, connected }, ...] */
function renderObActivityCombo(id, rows, isDark, title) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const labels = sorted.map(r => r.category);
  const totals = sorted.map(r => r.total);
  const connected = sorted.map(r => r.connected);
  const pct = (c, t) => t > 0 ? Math.round((c / t) * 100) : 0;
  const textColor = isDark ? '#b0b5c0' : '#6b7280';

  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Total', data: totals, backgroundColor: chartColors.orange, borderRadius: 2,
          datalabels: { anchor: 'end', align: 'end', offset: 2, clamp: true, color: textColor, font: { size: 9, weight: '700' }, formatter: dlFormatter }
        },
        {
          label: 'Connected', data: connected, backgroundColor: '#9ca3af', borderRadius: 2,
          datalabels: {
            anchor: 'end', align: 'end', offset: 2, clamp: true, color: chartColors.amber, font: { size: 9, weight: '700' },
            formatter: (v, ctx) => v === 0 ? '' : `${v} (${pct(v, totals[ctx.dataIndex])}%)`
          }
        }
      ]
    },
    options: {
      ...defaultOpts(title, isDark),
      layout: { padding: { top: 16 } },
      plugins: { ...defaultOpts(title, isDark).plugins, legend: { position: 'bottom', labels: { color: textColor, font: { size: 10 }, boxWidth: 12, padding: 8 } } },
      scales: {
        x: { ticks: { color: textColor, font: { size: 9 }, maxRotation: 40, minRotation: 0 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: textColor, font: { size: 9 } }, grid: { display: false } }
      }
    }
  });
}

/* ── HST FULFILMENT (ResMed only) ──
   hstRows: [{ date, agent, leadSource, status, conversionIssue }, ...] */

/* Shared builder for both Chart 1 (grouped Lead Source -> Agent) and Chart 2
   (grouped Agent -> Lead Source) -- matches the source Excel PivotCharts: a
   single series, one bar per (outer, inner) combo, with the outer label
   shown ONCE, centered under its whole group of inner bars -- not one color
   per agent, and not the outer value repeated as a second tick line under
   every single bar (Chart.js's array-label ticks print the same text on
   every tick, they don't merge across ticks into a spanning header).

   To get an actual spanning header this draws it manually with a per-chart
   plugin (afterDraw): x-axis ticks carry only the inner value (single line,
   never rotated), and the plugin centers the outer-group text beneath the
   pixel span of that group's bars, with a bracket underline when the group
   has more than one bar.

   Every bar gets a fixed pixel width (sized to the longest inner label, so
   short agent names and long lead-source strings both fit without
   overlapping) inside a wrapper (id + "Wrap") that grows to fit all bars;
   the panel-body around it scrolls horizontally (overflow-x:auto in the
   HTML) once that exceeds the panel's width -- so labels stay horizontal
   and fully visible instead of rotating, clipping, or disappearing.

   A null-value spacer bar is inserted between groups (Chart.js leaves a gap
   for a null data point without drawing anything) so groups are visually
   separated by more space than the bars within a group. */
function renderHstNestedBar(id, hstRows, isDark, status, outerKey, innerKey, seriesLabel, seriesColor, title, sortOuterByName, rotateInner) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  const rows = status ? (hstRows || []).filter(r => r.status === status) : (hstRows || []);

  const counts = new Map();
  rows.forEach(r => {
    const key = r[outerKey] + '||' + r[innerKey];
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const outerTotals = new Map();
  rows.forEach(r => outerTotals.set(r[outerKey], (outerTotals.get(r[outerKey]) || 0) + 1));
  const outerValues = sortOuterByName
    ? [...outerTotals.keys()].sort((a, b) => String(a).localeCompare(String(b)))
    : [...outerTotals.keys()].sort((a, b) => outerTotals.get(b) - outerTotals.get(a));

  const bars = [];
  outerValues.forEach((outerVal, gi) => {
    if (gi > 0) bars.push({ outerVal: '', innerVal: '', count: null, spacer: true });
    const inners = [...new Set(rows.filter(r => r[outerKey] === outerVal).map(r => r[innerKey]))].sort();
    inners.forEach(innerVal => {
      bars.push({ outerVal, innerVal, count: counts.get(outerVal + '||' + innerVal) || 0 });
    });
  });

  // No forced width / scrolling -- Chart.js's responsive:true sizes the
  // canvas to exactly fill the panel, compressing bar width as needed so
  // everything always fits on one page. Long inner labels still wrap onto
  // a 2nd line rather than being cut off.
  const WRAP_CHARS = 14;
  const wrapLabel = (s) => {
    const str = String(s || '');
    if (str.length <= WRAP_CHARS) return str;
    const words = str.split(' ');
    const lines = [];
    let cur = '';
    words.forEach(w => {
      if (cur && (cur + ' ' + w).length > WRAP_CHARS) { lines.push(cur); cur = w; }
      else cur = cur ? cur + ' ' + w : w;
    });
    if (cur) lines.push(cur);
    return lines;
  };

  const groupHeaderPlugin = {
    id: 'hstGroupHeader_' + id,
    afterDraw(chart) {
      const c = chart.ctx;
      const x = chart.scales.x;
      // chart.chartArea.bottom is the axis LINE position, not the bottom of
      // the rendered tick text -- fine for short horizontal ticks (~20px
      // tall) but for 90-degree rotated tick text (can be 100+ px tall)
      // that lands the header text in the middle of the tick labels.
      // x.bottom is the actual bottom edge of the space Chart.js reserved
      // for the (possibly rotated) tick labels -- always below all tick text.
      const bottom = x.bottom;
      c.save();
      c.font = '600 9px system-ui, -apple-system, sans-serif';
      c.fillStyle = textColor;
      c.textAlign = 'center';
      c.textBaseline = 'top';
      // Use getPixelForTick(index), NOT getPixelForValue(index) -- on a
      // CategoryScale, getPixelForValue treats a bare number as a label to
      // look up (via labels.indexOf), not an index; since our labels are
      // strings, that lookup always fails and silently returns garbage
      // pixel positions. getPixelForTick resolves the index directly.
      let i = 0;
      while (i < bars.length) {
        if (bars[i].spacer) { i++; continue; }
        const val = bars[i].outerVal;
        let j = i;
        while (j + 1 < bars.length && !bars[j + 1].spacer && bars[j + 1].outerVal === val) j++;
        const xStart = x.getPixelForTick(i);
        const xEnd = x.getPixelForTick(j);
        const cx = (xStart + xEnd) / 2;
        // No underline -- just the centered group label, with a small gap
        // below the tick text (x.bottom already sits below the full tick
        // label, rotated or not, so a small fixed gap is enough either way).
        c.fillText(val, cx, bottom + 8);
        i = j + 1;
      }
      c.restore();
    }
  };

  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      // Rotated (vertical) labels read fine at full length -- no need to
      // wrap those onto a 2nd line; only horizontal labels get wrapped.
      labels: bars.map(b => b.spacer ? '' : (rotateInner ? b.innerVal : wrapLabel(b.innerVal))),
      datasets: [{
        label: seriesLabel, data: bars.map(b => b.count),
        backgroundColor: seriesColor, borderRadius: 3,
        categoryPercentage: 0.9, barPercentage: 0.85,
        datalabels: { anchor: 'end', align: 'end', offset: 4, clamp: true, color: textColor, font: { size: 9, weight: '600' }, formatter: dlFormatter }
      }]
    },
    options: {
      ...defaultOpts(title, isDark),
      layout: { padding: { top: 24, bottom: 40 } },
      plugins: { ...defaultOpts(title, isDark).plugins, legend: { display: false } },
      scales: {
        x: {
          ticks: {
            color: textColor, font: { size: 9 }, autoSkip: false,
            maxRotation: rotateInner ? 90 : 0, minRotation: rotateInner ? 90 : 0
          },
          grid: { display: false, drawTicks: false },
          border: { display: false }
        },
        y: { beginAtZero: true, ticks: { color: textColor, font: { size: 9 } }, grid: { display: false } }
      }
    },
    plugins: [groupHeaderPlugin]
  });
}

/* Chart 1: HST Counts — Lead Source wise, ALL records regardless of status
   (matches the reference pivot's Status = (All) filter). Grouped Lead
   Source (outer, sorted alphabetically -- shown once as the spanning
   header) -> Agent (inner, individual bars, also alphabetical), single
   "Total" series. Date-scoped to the dashboard's selected range by the
   caller (Create Date) -- the only one of the three HST charts that is. */
function renderHstCountsByLeadSource(id, hstRows, isDark) {
  renderHstNestedBar(id, hstRows, isDark, null, 'leadSource', 'agent', 'Total', chartColors.purple, 'HST Counts — Lead Source Wise', true);
}

/* Chart 2: Follow Up Status, Not Closed records. Grouped Agent (outer) ->
   Lead Source (inner), single "Not Closed" series. */
function renderHstFollowUpStatus(id, hstRows, isDark) {
  renderHstNestedBar(id, hstRows, isDark, 'Not Closed', 'agent', 'leadSource', 'Not Closed', chartColors.red, 'HST Follow Up Status', true, true);
}

/* Chart 3: Closed — Conversion Issues, grouped by issue category with one
   series per agent. r.status === 'Closed' is the broad bucket (Irrelevant/
   Junk/NA also collapse into it) -- this chart additionally requires the
   literal raw HST Patient Status text to be exactly "Closed", since a
   Conversion Issue only makes sense for a genuinely closed-out lead, not
   one dumped into the bucket for other reasons. Blank Conversion Issue
   still excluded. */
function renderHstClosedConversionIssues(id, hstRows, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  const rows = (hstRows || []).filter(r => r.status === 'Closed' && r.rawHstStatus === 'Closed' && r.conversionIssue);
  const agents = [...new Set(rows.map(r => r.agent))].sort();
  const issues = [...new Set(rows.map(r => r.conversionIssue))].sort((a, b) => {
    const countA = rows.filter(r => r.conversionIssue === a).length;
    const countB = rows.filter(r => r.conversionIssue === b).length;
    return countB - countA;
  });
  const counts = new Map();
  rows.forEach(r => {
    const key = r.conversionIssue + '||' + r.agent;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: issues,
      datasets: agents.map((agent, i) => ({
        label: agent,
        data: issues.map(issue => counts.get(issue + '||' + agent) || 0),
        backgroundColor: colorPalette[i % colorPalette.length],
        borderRadius: 3,
        datalabels: { anchor: 'end', align: 'end', offset: 2, clamp: true, color: textColor, font: { size: 9, weight: '600' }, formatter: dlFormatter }
      }))
    },
    options: {
      ...defaultOpts('Closed — Conversion Issues', isDark),
      // Top padding so the datalabel on the tallest bar (anchor:'end') has
      // room to render above the bar instead of getting clipped by the
      // canvas edge when that bar is close to the axis max.
      layout: { padding: { top: 20 } },
      plugins: { ...defaultOpts('Closed — Conversion Issues', isDark).plugins, legend: { position: 'bottom', labels: { color: textColor, font: { size: 10 }, boxWidth: 12, padding: 8 } } },
      scales: {
        x: { ticks: { color: textColor, font: { size: 9 }, maxRotation: 40, minRotation: 0 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: textColor, font: { size: 9 } }, grid: { display: false } }
      }
    }
  });
}

/* ── CHATBOT CHART RENDERER (inline) ── */
function renderMiniChart(canvasId, type, labels, data, label, color, isDark) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  if (ctx.chart) ctx.chart.destroy();
  return new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [{ label, data, backgroundColor: color || chartColors.blue, borderColor: color || chartColors.blue, tension: 0.3, fill: type === 'line', pointRadius: 2, borderRadius: 3 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: { anchor: 'end', align: type === 'line' ? 'top' : 'end', offset: 2, color: isDark ? '#e8eaed' : '#374151', font: { size: 9, weight: '600' }, formatter: dlFormatter, clamp: true }
      },
      scales: {
        x: { display: true, ticks: { color: isDark ? '#b0b5c0' : '#6b7280', font: { size: 9 } }, grid: { display: false } },
        y: { display: true, ticks: { color: isDark ? '#b0b5c0' : '#6b7280', font: { size: 9 } }, grid: { display: false }, beginAtZero: true }
      },
      animation: { duration: 500 }
    }
  });
}

/* ── QUALITY TREND (Hangup + CRM over time) ── */
function renderQualityTrend(id, timeSeries, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const data = timeSeries;
  ctx.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date?.slice(5) || ''),
      datasets: [
        { label: 'Hangup ≤10s', data: data.map(d => d.hangup || 0), borderColor: chartColors.red, backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2, borderDash: [4, 2] },
        { label: 'CRM Activity', data: data.map(d => d.crm || 0), borderColor: chartColors.purple, backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2 },
        { label: 'Non Trading', data: data.map(d => d.nonTrading || 0), borderColor: chartColors.amber, backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2, borderDash: [2, 2] }
      ]
    },
    options: {
      ...defaultOpts('Quality Trend', isDark),
      interaction: { intersect: false, mode: 'index' }
    }
  });
}

window.CHARTS = {
  renderTrendChart, renderProcessComparison, renderAgentRanking,
  renderPareto, renderDailyTrend, renderQualityTrend,
  renderAgentHeatmap, renderMiniChart, renderDayWiseChart,
  renderAgentProductivity, renderBreakDuration, renderQualityRatio, renderAgentMissed, renderAgentHangup, renderTrainingByAgent, renderDowntimeByAgent, renderAppreciationEscalation, renderStatBar, renderHourlyMissed, renderFreshCallsComparison,
  renderFacilityCallCases, renderFacilityEmailCases, renderEmailSentAgentWise, renderIBCasesAppointments,
  renderObActivityCombo,
  renderHstCountsByLeadSource, renderHstFollowUpStatus, renderHstClosedConversionIssues,
  chartColors, colorPalette
};
