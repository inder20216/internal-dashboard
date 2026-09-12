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

/* ── AGENT PRODUCTIVITY (Inbound Answered + Outbound All + Email Handled) ── */
function renderAgentProductivity(id, agents, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  // Computed live here (IB + OB + Email) rather than trusting a precomputed
  // productivityTotal field, so it always matches whatever emailsHandled value
  // was actually passed in (e.g. the live tracker-insights override).
  const withTotal = agents.map(a => ({ ...a, liveTotal: (a.inboundAnswered || 0) + (a.outboundAll || 0) + (a.emailsHandled || 0) }));
  const sorted = withTotal.sort((a, b) => b.liveTotal - a.liveTotal);
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      // Multi-line tick: agent name + their IB+OB+Email total, shown as a per-agent
      // KPI under the axis rather than adding a 4th "total" bar to the chart.
      labels: sorted.map(a => [a.agent, `Total: ${a.liveTotal}`]),
      datasets: [
        { label: 'Inbound Answered', data: sorted.map(a => a.inboundAnswered), backgroundColor: 'rgba(37,99,235,0.75)', borderRadius: 3 },
        { label: 'Outbound All', data: sorted.map(a => a.outboundAll), backgroundColor: 'rgba(234,88,12,0.75)', borderRadius: 3 },
        { label: 'Email Handled', data: sorted.map(a => a.emailsHandled), backgroundColor: 'rgba(217,119,6,0.75)', borderRadius: 3 }
      ]
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
          datalabels: { anchor: 'end', align: 'start', offset: 4, color: '#fff', font: { size: 9, weight: '700' }, formatter: v => v ? secondsToHms(v * 60) : '' }
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
  // CDR side is one solid bar (Fresh Inbound + Call Back on Missed combined),
  // with the IB/Missed split shown only in the datalabel text, not as separate
  // stacked colors. CRM Case Logged stays a separate bar alongside it.
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      // Multi-line tick: agent name + their IB/CB split shown as a subtitle
      // under the axis, rather than crowding the bar's own datalabel.
      labels: rows.map(r => [r.agent, `(IB-${r.ibFreshCount || 0}/CB-${r.callbackFreshCount || 0})`]),
      datasets: [
        {
          label: 'Fresh Calls (CDR Notes)', data: rows.map(r => (r.ibFreshCount || 0) + (r.callbackFreshCount || 0)), backgroundColor: 'rgba(37,99,235,0.75)', borderRadius: 3,
          datalabels: { anchor: 'end', align: 'end', offset: 2, color: textColor, font: { size: 9, weight: '600' }, formatter: v => v || '' }
        },
        {
          label: 'Fresh CRM Case (Logged)', data: rows.map(r => r.crmCount), backgroundColor: 'rgba(5,150,105,0.75)', borderRadius: 3,
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
  const apptByAgent = new Map((appointments || []).map(a => [a.agent, a.count]));
  const rows = (agents || []).filter(a => (a.inboundAnswered || 0) + (a.crmTotalCases || 0) + (apptByAgent.get(a.agent) || 0) > 0);
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(a => a.agent),
      datasets: [
        { label: 'IB Calls Answered', data: rows.map(a => a.inboundAnswered || 0), backgroundColor: 'rgba(37,99,235,0.8)', borderRadius: 3 },
        { label: 'CRM Cases Logged', data: rows.map(a => a.crmTotalCases || 0), backgroundColor: 'rgba(220,38,38,0.8)', borderRadius: 3 },
        { label: 'Appointments', data: rows.map(a => apptByAgent.get(a.agent) || 0), backgroundColor: 'rgba(5,150,105,0.8)', borderRadius: 3 }
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
  chartColors, colorPalette
};
