/* ══════════════════════════════════════════════════
   CHATBOT — Conversational Analytics Assistant
   ══════════════════════════════════════════════════ */

window.CHATBOT = {
  messages: [],
  chartCounter: 0,

  init() {
    this.addMessage('bot', `👋 Welcome to the **MIS Analytics Assistant**!

I can help you explore call center data through natural language. Try asking:

• *"Show me the top 5 agents by productivity"*
• *"What's our missed call trend this month?"*
• *"Compare all processes"*
• *"Give me a performance storyboard"*
• *"What training needs do we have?"*
• *"Show Lean Six Sigma metrics"*`);
  },

  async process(input) {
    const q = input.toLowerCase().trim();
    if (!q) return;

    this.addMessage('user', input);
    this.showTyping();

    setTimeout(() => {
      this.hideTyping();
      const response = this.analyzeQuery(q);
      this.addMessage('bot', response.text, response.chart, response.table, response.chartType);
    }, 600 + Math.random() * 400);
  },

  analyzeQuery(q) {
    const data = window.APP_DATA;
    const processData = data.currentState.selectedProcess
      ? data.aggregateProcess(data.allRows, data.currentState.selectedProcess)
      : data.aggregateProcess(data.allRows, '');
    const benchmark = data.getBenchmarkData(data.allRows);
    const timeSeries = data.getTimeSeries(data.allRows, data.currentState.selectedProcess);
    const insights = window.AI_INSIGHTS.generateAll(processData, benchmark, timeSeries);

    // ── ROUTING ──
    if (q.includes('top agent') || (q.includes('top') && q.includes('agent')) || q.includes('best performer')) {
      return this.topAgents(processData, benchmark);
    }
    if (q.includes('compare') && (q.includes('process') || q.includes('all'))) {
      return this.compareProcesses(benchmark);
    }
    if (q.includes('trend') || q.includes('over time') || q.includes('daily')) {
      return this.trendAnalysis(timeSeries);
    }
    if (q.includes('missed') || q.includes('miss call')) {
      return this.missedCallAnalysis(processData, timeSeries);
    }
    if (q.includes('training') || q.includes('coach') || q.includes('develop')) {
      return this.trainingNeeds(insights);
    }
    if (q.includes('six sigma') || q.includes('lean') || q.includes('sigma') || q.includes('dmaic')) {
      return this.sixSigmaAnalysis(insights);
    }
    if (q.includes('storyboard') || q.includes('overview') || q.includes('summary') || q.includes('dashboard story')) {
      return this.storyboard(processData, benchmark, insights);
    }
    if (q.includes('forecast') || q.includes('predict') || q.includes('next month')) {
      return this.forecastAnalysis(insights);
    }
    if (q.includes('swot') || q.includes('strength') || q.includes('weakness')) {
      return this.swotAnalysis(insights);
    }
    if (q.includes('waste') || q.includes('muda') || q.includes('defect')) {
      return this.leanWaste(insights);
    }
    if (q.includes('occupancy') || q.includes('utilization')) {
      return this.singleMetric('Occupancy', processData.occupancy, 'percentage', 'Measures how busy agents are during logged-in time.');
    }
    if (q.includes('shrinkage')) {
      return this.singleMetric('Shrinkage', processData.shrinkage, 'percentage', 'Time agents are paid but not productive.');
    }
    if (q.includes('productivity')) {
      return this.productivityBreakdown(processData);
    }
    if (q.includes('aht') || q.includes('handle time')) {
      return this.singleMetric('AHT (Avg Handle Time)', processData.aht, 'time', 'Average time to handle an interaction from start to finish.');
    }
    if (q.includes('agent') && q.includes('heatmap')) {
      return this.agentHeatmap(processData);
    }
    if (q.includes('pareto')) {
      return this.paretoAnalysis(processData);
    }

    // ── DEFAULT ──
    return this.defaultResponse(processData, insights);
  },

  topAgents(data, benchmark) {
    const agents = data.agents || [];
    const top = agents.slice(0, 7);
    if (!top.length) return { text: 'No agent data available for the current selection.' };

    const rows = top.map((a, i) => `<tr><td><span class="rank-badge ${i < 3 ? `rank-${i+1}` : 'rank-other'}">${i+1}</span> ${a.agent}</td><td>${a.process}</td><td><strong>${a.productivityTotal}</strong></td><td>${a.aht}</td><td>${a.apt}</td><td>${a.agentMissed}</td></tr>`).join('');

    return {
      text: `**Top ${top.length} Agents by Productivity** — ${data.processName || 'All Processes'}`,
      table: `<table class="chat-table"><thead><tr><th>Agent</th><th>Process</th><th>Productivity</th><th>AHT</th><th>APT</th><th>Missed</th></tr></thead><tbody>${rows}</tbody></table>`
    };
  },

  compareProcesses(benchmark) {
    const stats = benchmark.processStats || [];
    if (!stats.length) return { text: 'No process comparison data available.' };

    const sorted = [...stats].sort((a, b) => (b.totalProductivity || 0) - (a.totalProductivity || 0));
    const rows = sorted.map((p, i) => `<tr><td>${i+1}</td><td><strong>${p.process}</strong></td><td>${p.totalProductivity || 0}</td><td>${p.count}</td><td>${p.topAgent?.agent || '—'}</td></tr>`).join('');

    const chartId = this.createChart();
    const chartHtml = `<div class="chat-chart" id="${chartId}"></div>`;

    return {
      text: `**Process Comparison** — ${sorted.length} processes ranked by total productivity.
${sorted.length ? `Top process: **${sorted[0].process}** (${sorted[0].totalProductivity} interactions).` : ''}`,
      table: `<table class="chat-table"><thead><tr><th>Rank</th><th>Process</th><th>Productivity</th><th>Agents</th><th>Top Agent</th></tr></thead><tbody>${rows}</tbody></table>`,
      chart: { id: chartId, type: 'bar', labels: sorted.map(p => p.process), data: sorted.map(p => p.totalProductivity || 0), label: 'Productivity' }
    };
  },

  trendAnalysis(timeSeries) {
    if (!timeSeries || timeSeries.length < 2) return { text: 'Not enough daily data to show trends. Need at least 2 days of data.' };

    const chartId = this.createChart();
    return {
      text: `**Daily Performance Trend** — ${timeSeries.length} days shown.`,
      chart: { id: chartId, type: 'line', labels: timeSeries.map(d => d.date?.slice(5) || ''), datasets: [
        { label: 'Inbound', data: timeSeries.map(d => d.ib) },
        { label: 'Outbound', data: timeSeries.map(d => d.ob) },
        { label: 'Missed', data: timeSeries.map(d => d.missed) }
      ]}
    };
  },

  missedCallAnalysis(data, timeSeries) {
    const missPct = data.missedCallPercent || 0;
    const total = data.totalCalls || 0;
    const missed = data.totalMissed || 0;

    const text = `**Missed Call Analysis**
• Total Calls: ${total}
• Missed: ${missed} (${(missPct * 100).toFixed(2)}%)
• Target: <5% | Status: ${missPct < 0.05 ? '✅ Within target' : missPct < 0.08 ? '⚠️ Near threshold' : '🔴 Above threshold'}
• Estimated Revenue Impact: ${(missed * 2.5).toFixed(0)} units (at ~2.5 avg value per call)`;

    if (!timeSeries || timeSeries.length < 2) return { text };

    const chartId = this.createChart();
    return {
      text,
      chart: { id: chartId, type: 'line', labels: timeSeries.map(d => d.date?.slice(5) || ''), datasets: [{ label: 'Missed Calls', data: timeSeries.map(d => d.missed) }] }
    };
  },

  trainingNeeds(insights) {
    const needs = insights.training || [];
    if (!needs.length) return { text: 'No training needs identified.' };

    const rows = needs.map(n => `<tr><td><span class="insight-badge ${n.priority === 'High' ? 'red' : n.priority === 'Medium' ? 'amber' : 'blue'}">${n.priority}</span></td><td><strong>${n.issue}</strong></td><td>${n.agent}</td><td>${n.desc}</td></tr>`).join('');

    return {
      text: `**Training & Development Needs** — ${needs.filter(n => n.priority === 'High').length} high priority items identified.`,
      table: `<table class="chat-table" style="min-width:500px"><thead><tr><th>Priority</th><th>Issue</th><th>Agent(s)</th><th>Recommendation</th></tr></thead><tbody>${rows}</tbody></table>`
    };
  },

  sixSigmaAnalysis(insights) {
    const s = insights.sixSigma || {};
    const leadership = insights.leadership || [];
    const leanWaste = insights.leanWaste || [];
    const lss = leadership.find(l => l.framework === 'Lean Six Sigma');

    let wasteRows = leanWaste.map(w => `<tr><td>${w.type}</td><td>${w.desc}</td></tr>`).join('');

    return {
      text: `**Lean Six Sigma Analysis**
• Sigma Level: **${s.sigmaLevel || 'N/A'}σ**
• DPMO: ${(s.dpmo || 0).toLocaleString()}
• Yield: ${s.yield || 0}%
• Defects: ${s.defects || 0}

**${lss?.framework || ''}**: ${lss?.insight || ''}`,
      table: leanWaste.length > 0 ? `<h4 style="margin:10px 0 6px;font-size:12px;">MUDA (Waste) Analysis</h4><table class="chat-table"><thead><tr><th>Waste Type</th><th>Description</th></tr></thead><tbody>${wasteRows}</tbody></table>` : ''
    };
  },

  storyboard(data, benchmark, insights) {
    const facts = insights.facts || [];
    const comps = insights.comparisons || [];
    const occ = data.occupancy || 0;
    const shr = data.shrinkage || 0;
    const miss = data.missedCallPercent || 0;

    const factBullets = facts.slice(0, 4).map(f => `• **${f.title}**: ${f.desc}`).join('\n');
    const compBullets = comps.slice(0, 3).map(c => `• **${c.title}**: ${c.desc}`).join('\n');

    return {
      text: `## 📊 Performance Storyboard

**Period**: ${data.reportLabel || 'Current'} | **Process**: ${data.processName || 'All Processes'}

### KPI Snapshot
• Productivity: ${data.productivityTotal} | Inbound: ${data.inboundAnswered} | Outbound: ${data.outboundAll} | Email: ${data.emailsHandled}
• AHT: ${data.aht} | APT: ${data.apt} | Occupancy: ${(occ*100).toFixed(1)}% | Shrinkage: ${(shr*100).toFixed(1)}%
• Missed: ${(miss*100).toFixed(1)}% | Active Agents: ${data.agentCount} | Late Logins: ${data.lateLogin}

### 🔍 AI Insights
${factBullets}

### 📈 Comparisons
${compBullets}

### 🎯 Verdict
${miss > 0.08 ? '**Action Required**: Missed calls need immediate attention. Consider staffing review.' : occ > 0.85 ? '**Watch**: Occupancy high — monitor for burnout.' : '**Stable**: Operations within acceptable parameters. Focus on continuous improvement.'}`
    };
  },

  forecastAnalysis(insights) {
    const f = insights.forecast || {};
    return {
      text: `**📈 Forecast & Projections**
${f.summary || 'Forecast data not available.'}
${f.nextMonth !== null ? `• Expected Inbound Next Period: ~${f.nextMonth} calls` : ''}
${f.r2 ? `• Model Confidence (R²): ${f.r2}%` : ''}
${f.trend ? `• Trend Direction: ${f.trend}` : ''}

*Based on linear regression of recent daily data. Update frequency improves accuracy.*`
    };
  },

  swotAnalysis(insights) {
    const swot = insights.swot || {};
    const renderList = (items, icon) => items.map(i => `• ${icon} ${i}`).join('\n');
    return {
      text: `**SWOT Analysis (Strategic)**

**Strengths**
${renderList(swot.strengths || ['No specific strengths identified'], '✅')}

**Weaknesses**
${renderList(swot.weaknesses || ['No specific weaknesses identified'], '⚠️')}

**Opportunities**
${renderList(swot.opportunities || ['None listed'], '💡')}

**Threats**
${renderList(swot.threats || ['None listed'], '🔴')}

*Generated from current operational data. Review quarterly.*`
    };
  },

  leanWaste(insights) {
    const wastes = insights.leanWaste || [];
    const rows = wastes.map(w => `<tr><td><strong>${w.type}</strong></td><td>${w.desc}</td></tr>`).join('');
    return {
      text: `**MUDA — Lean Waste Analysis**`,
      table: `<table class="chat-table"><thead><tr><th>Waste Type</th><th>Description</th></tr></thead><tbody>${rows || '<tr><td colspan="2">No significant wastes detected.</td></tr>'}</tbody></table>`
    };
  },

  singleMetric(label, value, type, desc) {
    if (value === undefined || value === null || value === '—') {
      return { text: `**${label}**: Data not available.` };
    }
    let display = value;
    if (type === 'percentage') display = (value * 100).toFixed(1) + '%';
    return { text: `**${label}**: ${display}\n\n${desc}` };
  },

  productivityBreakdown(data) {
    return {
      text: `**Productivity Breakdown**
• Total: **${data.productivityTotal}** interactions
• Inbound: ${data.inboundAnswered}  |  Outbound: ${data.outboundAll}  |  Email: ${data.emailsHandled}
• Agents Active: ${data.agentCount}
• Per-Agent Avg: ${data.agentCount > 0 ? (data.productivityTotal / data.agentCount).toFixed(1) : 'N/A'}
• Productivity Rate: ${data.productivity ? (data.productivity * 100).toFixed(1) + '%' : 'N/A'}`
    };
  },

  agentHeatmap(data) {
    const agents = data.agents || [];
    const chartId = this.createChart();
    if (!agents.length) return { text: 'No agent data available.' };
    return {
      text: `**Agent Productivity Heatmap** — Top ${Math.min(12, agents.length)} agents`,
      chart: { id: chartId, type: 'bar', labels: agents.slice(0, 12).map(a => a.agent), data: agents.slice(0, 12).map(a => a.productivityTotal), label: 'Productivity', horizontal: true }
    };
  },

  paretoAnalysis(data) {
    const agents = data.agents || [];
    const sorted = [...agents].sort((a, b) => b.productivityTotal - a.productivityTotal);
    const total = sorted.reduce((s, a) => s + a.productivityTotal, 0) || 1;
    let cum = 0;
    const top80 = [];
    for (const a of sorted) {
      cum += a.productivityTotal;
      top80.push(a);
      if (cum / total >= 0.8) break;
    }

    return {
      text: `**Pareto Analysis (80/20 Rule)**
• Total Agents: ${agents.length}
• Agents contributing 80% output: **${top80.length}** (${agents.length > 0 ? ((top80.length / agents.length) * 100).toFixed(0) : 0}% of team)
• Top 20% agents handle ${(() => { const s = [...sorted]; const t = total; const top = Math.ceil(s.length * 0.2); const topSum = s.slice(0, top).reduce((a, b) => a + b.productivityTotal, 0); return ((topSum / t) * 100).toFixed(0) + '%'; })()} of work

**Recommendation**: Replicate workflows of top performers. Coach bottom performers or consider restructuring.`
    };
  },

  defaultResponse(data, insights) {
    const occ = data.occupancy || 0;
    const shr = data.shrinkage || 0;
    const miss = data.missedCallPercent || 0;

    return {
      text: `**📊 Analytics Snapshot** — ${data.processName || 'All Processes'}
      
• **Productivity**: ${data.productivityTotal} total | ${data.agentCount} agents
• **Missed Calls**: ${(miss*100).toFixed(1)}% ${miss < 0.05 ? '✅' : miss < 0.08 ? '⚠️' : '🔴'}
• **Occupancy**: ${(occ*100).toFixed(1)}% | **Shrinkage**: ${(shr*100).toFixed(1)}%
• **AHT**: ${data.aht} | **APT**: ${data.apt}

💡 *Try specific questions like "top agents", "missed call trend", "training needs", "six sigma", or "storyboard" for deeper analysis.*`
    };
  },

  /* ── UI HELPERS ── */
  addMessage(role, text, chart, table, chartType) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${role}`;

    let html = `<div class="chat-bubble">`;
    if (text) {
      let formatted = text.replace(/\n/g, '<br>');
      formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      formatted = formatted.replace(/^## (.+)$/gm, '<h3 style="font-size:14px;margin-bottom:6px;">$1</h3>');
      formatted = formatted.replace(/^• /gm, '<span style="display:block;margin:2px 0;">• </span>');
      html += formatted;
    }
    if (chart) {
      const chartHeight = chart.horizontal ? '200px' : '160px';
      html += `<div class="chat-chart" id="${chart.id}" style="height:${chartHeight}"></div>`;
    }
    if (table) html += table;
    html += `<div class="chat-time">${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>`;
    html += `</div>`;

    msgDiv.innerHTML = html;
    container.appendChild(msgDiv);

    // Render chart if needed
    if (chart) {
      setTimeout(() => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (chart.datasets) {
          const colors = ['#2563eb', '#059669', '#dc2626', '#d97706', '#7c3aed'];
          const datasets = chart.datasets.map((ds, i) => ({
            ...ds,
            backgroundColor: chart.type === 'bar' ? colors[i % colors.length] : 'transparent',
            borderColor: colors[i % colors.length],
            borderWidth: 2,
            pointRadius: 2,
            fill: chart.type === 'line',
            tension: 0.3
          }));
          window.CHARTS.renderMiniChart(chart.id, chart.type, chart.labels, datasets[0]?.data || [], datasets[0]?.label || '', colors[0], isDark);
        } else {
          window.CHARTS.renderMiniChart(chart.id, chart.type, chart.labels, chart.data, chart.label, null, isDark);
        }
      }, 50);
    }

    container.scrollTop = container.scrollHeight;
    this.messages.push({ role, text, chart, table });
  },

  showTyping() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    if (document.getElementById('typingIndicator')) return;
    const div = document.createElement('div');
    div.className = 'chat-msg bot';
    div.id = 'typingIndicator';
    div.innerHTML = `<div class="chat-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  },

  hideTyping() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
  },

  createChart() {
    return `chat-chart-${++this.chartCounter}`;
  }
};
