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
      x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
      y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor }, beginAtZero: true }
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
        x: { ticks: { color: isDark ? '#b0b5c0' : '#6b7280', font: { size: 9 } }, grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' } },
        y: { beginAtZero: true, ticks: { color: isDark ? '#b0b5c0' : '#6b7280', font: { size: 9 } }, grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }, title: { display: true, text: 'Productivity', color: isDark ? '#b0b5c0' : '#6b7280', font: { size: 10 } } },
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
        x: { stacked: false, ticks: { color: isDark ? '#b0b5c0' : '#6b7280', font: { size: 9 } }, grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' } },
        y: { beginAtZero: true, ticks: { color: isDark ? '#b0b5c0' : '#6b7280', font: { size: 9 } }, grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' } }
      }
    }
  });
}

/* ── AGENT PRODUCTIVITY (Inbound Answered + Outbound All + Email Handled) ── */
function renderAgentProductivity(id, agents, isDark) {
  const ctx = getCtx(id);
  if (!ctx) return;
  const sorted = [...agents].sort((a, b) => b.productivityTotal - a.productivityTotal);
  const textColor = isDark ? '#b0b5c0' : '#6b7280';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      // Multi-line tick: agent name + their IB+OB+Email total, shown as a per-agent
      // KPI under the axis rather than adding a 4th "total" bar to the chart.
      labels: sorted.map(a => [a.agent, `Total: ${a.productivityTotal}`]),
      datasets: [
        { label: 'Inbound Answered', data: sorted.map(a => a.inboundAnswered), backgroundColor: 'rgba(37,99,235,0.75)', borderRadius: 3 },
        { label: 'Outbound All', data: sorted.map(a => a.outboundAll), backgroundColor: 'rgba(234,88,12,0.75)', borderRadius: 3 },
        { label: 'Email Handled', data: sorted.map(a => a.emailsHandled), backgroundColor: 'rgba(217,119,6,0.75)', borderRadius: 3 }
      ]
    },
    options: {
      ...defaultOpts('Agent Productivity', isDark),
      plugins: { ...defaultOpts('Agent Productivity', isDark).plugins, legend: { position: 'bottom', labels: { color: textColor, font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
        y: { beginAtZero: true, ticks: { color: textColor, font: { size: 10 }, precision: 0 }, grid: { color: gridColor } }
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
        x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
        y: { beginAtZero: true, ticks: { color: textColor, font: { size: 10 }, callback: v => secondsToHms(v * 60) }, grid: { color: gridColor } }
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
  ctx.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(a => a.agent),
      datasets: [
        { label: 'Missed (Inbound)', data: sorted.map(a => a.agentMissedIb || 0), backgroundColor: 'rgba(220,38,38,0.75)', borderRadius: 3, datalabels: { anchor: 'center', align: 'center', color: '#fff' } },
        { label: 'Missed (Outbound)', data: sorted.map(a => a.agentMissedOb || 0), backgroundColor: 'rgba(234,88,12,0.75)', borderRadius: 3, datalabels: { anchor: 'center', align: 'center', color: '#fff' } }
      ]
    },
    options: {
      ...defaultOpts('Agent Missed', isDark),
      indexAxis: 'y',
      plugins: { ...defaultOpts('Agent Missed', isDark).plugins, legend: { position: 'bottom', labels: { color: textColor, font: { size: 10 } } } },
      scales: {
        x: { stacked: true, beginAtZero: true, ticks: { color: textColor, font: { size: 10 }, precision: 0 }, grid: { color: gridColor } },
        y: { stacked: true, ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } }
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
        x: { min: 0, max: 100, ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
        y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } }
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
        y: { display: true, ticks: { color: isDark ? '#b0b5c0' : '#6b7280', font: { size: 9 } }, grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }, beginAtZero: true }
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
  renderAgentProductivity, renderBreakDuration, renderQualityRatio, renderAgentMissed,
  chartColors, colorPalette
};
