/* ══════════════════════════════════════════════════
   AI INSIGHTS ENGINE — Facts, Forecasts, Lean 6σ,
   Training Needs, Leadership Methodologies
   ══════════════════════════════════════════════════ */

window.AI_INSIGHTS = {

  /* ── GENERATE ALL INSIGHTS ── */
  generateAll(processData, benchmarkData, timeSeries) {
    const sixSigma = window.APP_DATA.computeSixSigma(processData);
    return {
      facts: this.generateFacts(processData, benchmarkData),
      sixSigma,
      forecast: this.generateForecast(timeSeries),
      training: this.identifyTrainingNeeds(processData, benchmarkData),
      comparisons: this.generateComparisons(processData, benchmarkData),
      leadership: this.leadershipInsights(processData, sixSigma),
      leanWaste: this.leanWasteAnalysis(processData),
      swot: this.swotAnalysis(processData, benchmarkData)
    };
  },

  /* ── AI FACTS ── */
  generateFacts(data, benchmark) {
    const facts = [];
    const occ = data.occupancy || 0;
    const shr = data.shrinkage || 0;
    const prod = data.productivity || 0;
    const missPct = data.missedCallPercent || 0;

    if (occ < 0.6) facts.push({ icon: 'ti-alert-triangle', type: 'warning', title: 'Low Occupancy Alert', desc: `Occupancy is at ${(occ*100).toFixed(1)}%. Industry benchmark is 75-85%. Consider cross-training or schedule realignment.` });
    else if (occ > 0.9) facts.push({ icon: 'ti-flame', type: 'danger', title: 'Burnout Risk', desc: `Occupancy at ${(occ*100).toFixed(1)}% — above the 85% threshold. Risk of agent burnout. Immediate hiring or schedule relief recommended.` });
    else facts.push({ icon: 'ti-thumb-up', type: 'success', title: 'Healthy Occupancy', desc: `Occupancy at ${(occ*100).toFixed(1)}% — within the 70-85% optimal band.` });

    if (shr > 0.35) facts.push({ icon: 'ti-arrows-minimize', type: 'warning', title: 'High Shrinkage', desc: `Shrinkage at ${(shr*100).toFixed(1)}%. Above industry norm of 25-30%. Review absence patterns.` });

    if (missPct > 0.08) facts.push({ icon: 'ti-phone-off', type: 'danger', title: 'Missed Call Rate', desc: `${(missPct*100).toFixed(1)}% calls missed. Target <5%. Potential revenue leakage.` });

    facts.push({
      icon: 'ti-chart-line', type: 'info', title: 'Productivity Pulse',
      desc: `Team handled ${data.productivityTotal} interactions. Top agent contributed ${benchmark.topOverall?.[0]?.productivityTotal || 0} — ${benchmark.topOverall?.[0] ? ((benchmark.topOverall[0].productivityTotal / data.productivityTotal)*100).toFixed(1) : 0}% of total.`
    });

    return facts;
  },

  /* ── FORECAST (Linear Trend) ── */
  generateForecast(timeSeries) {
    if (!timeSeries || timeSeries.length < 3) {
      return { summary: 'Insufficient data for forecasting (minimum 3 data points needed).', nextMonth: null };
    }
    const recent = timeSeries.slice(-10);
    const n = recent.length;
    const xMean = (n - 1) / 2;
    const yMean = recent.reduce((s, d) => s + d.ib, 0) / n;
    let num = 0, den = 0;
    recent.forEach((d, i) => {
      num += (i - xMean) * (d.ib - yMean);
      den += (i - xMean) ** 2;
    });
    const slope = den > 0 ? num / den : 0;
    const intercept = yMean - slope * xMean;
    const nextIb = Math.round(slope * n + intercept);

    const trend = slope > 0 ? 'upward' : slope < 0 ? 'downward' : 'stable';
    const yValues = recent.map(d => d.ib);
    const yMean2 = yValues.reduce((a, b) => a + b, 0) / n;
    const ssRes = yValues.reduce((s, v) => s + (v - (slope * yValues.indexOf(v) + intercept)) ** 2, 0);
    const ssTot = yValues.reduce((s, v) => s + (v - yMean2) ** 2, 0);
    const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

    return {
      summary: `Forecast: Next period inbound ~${Math.max(0, nextIb)} calls. Trend is ${trend} (R²=${(r2*100).toFixed(1)}%).`,
      nextMonth: Math.max(0, nextIb),
      slope,
      r2: Math.round(r2 * 100),
      trend
    };
  },

  /* ── TRAINING NEEDS ── */
  identifyTrainingNeeds(data, benchmark) {
    const needs = [];
    const agents = data.agents || [];

    // Identify agents with high missed rates
    const highMiss = agents.filter(a => a.missedRate > 0.1 && a.totalCalls > 10);
    if (highMiss.length) {
      needs.push({
        agent: highMiss.map(a => a.agent).join(', '),
        issue: 'High Miss Rate',
        desc: `${highMiss.length} agent(s) with miss rate >10%. Recommend call handling & time management training.`,
        priority: 'High'
      });
    }

    // Low occupancy agents
    const lowOcc = agents.filter(a => a.occupancy < 0.5 && a.rows.length > 3);
    if (lowOcc.length) {
      needs.push({
        agent: lowOcc.map(a => a.agent).join(', '),
        issue: 'Low Occupancy',
        desc: `${lowOcc.length} agent(s) below 50% occupancy. Review schedule adherence & multi-skill training.`,
        priority: 'Medium'
      });
    }

    // AHT outliers
    if (data.aht !== '—') {
      const ahtVal = data.aht;
      needs.push({
        agent: 'Team',
        issue: 'AHT Optimization',
        desc: `Current AHT is ${ahtVal}. Benchmark call quality vs handle time. Consider coaching on call control & screen navigation.`,
        priority: 'Medium'
      });
    }

    // Late login
    if (data.lateLogin > 2) {
      needs.push({
        agent: `${data.lateLogin} agent(s)`,
        issue: 'Late Login',
        desc: `${data.lateLogin} late logins recorded. Implement adherence coaching & attendance improvement plan.`,
        priority: 'Low'
      });
    }

    if (!needs.length) {
      needs.push({ agent: 'Team', issue: 'All Clear', desc: 'No critical training needs identified at this time.', priority: 'Info' });
    }

    return needs;
  },

  /* ── BENCHMARK COMPARISONS ── */
  generateComparisons(data, benchmark) {
    const comps = [];
    const agents = data.agents || [];

    if (!agents.length) return [{ title: 'No Data', desc: 'Agent data not available for comparison.' }];

    // Intra-process comparison
    const topIntra = agents[0];
    const avgProd = agents.reduce((s, a) => s + a.productivityTotal, 0) / agents.length;

    if (topIntra) {
      comps.push({
        title: 'Intra-Process Benchmark',
        desc: `Top performer: ${topIntra.agent} (${topIntra.productivityTotal}). Team avg: ${avgProd.toFixed(0)}. Gap: ${(topIntra.productivityTotal - avgProd).toFixed(0)} interactions.`
      });
    }

    // Cross-process comparison
    if (benchmark.processStats) {
      const allProcesses = benchmark.processStats;
      const currentProc = data.processName;
      const thisProc = allProcesses.find(p => p.process === currentProc);
      const topProc = [...allProcesses].sort((a, b) => (b.totalProductivity || 0) - (a.totalProductivity || 0))[0];

      if (thisProc && topProc) {
        const gap = topProc.totalProductivity - thisProc.totalProductivity;
        comps.push({
          title: 'Cross-Process Benchmark',
          desc: `Your process: ${thisProc.totalProductivity || 0} interactions. Best process: ${topProc.process} (${topProc.totalProductivity}). Gap: ${gap}.`
        });
      }
    }

    // Performance percentile
    if (benchmark.allRanked) {
      const currentAgents = agents.map(a => a.agent);
      const ranked = benchmark.allRanked.filter(r => currentAgents.includes(r.agent));
      if (ranked.length) {
        const avgRank = ranked.reduce((s, r) => s + r.globalRank, 0) / ranked.length;
        const totalAgents = benchmark.allRanked.length;
        comps.push({
          title: 'Global Percentile',
          desc: `Your agents avg rank: ${avgRank.toFixed(0)}/${totalAgents} (${((1 - avgRank / totalAgents) * 100).toFixed(0)}th percentile).`
        });
      }
    }

    return comps;
  },

  /* ── LEADERSHIP INSIGHTS ── */
  leadershipInsights(data, sixSigma) {
    const occ = data.occupancy || 0;
    const shr = data.shrinkage || 0;
    const prod = data.productivity || 0;

    return [
      {
        framework: 'Lean Six Sigma',
        insight: `Sigma Level: ${sixSigma?.sigmaLevel || 'N/A'}σ (DPMO: ${sixSigma?.dpmo?.toLocaleString() || 'N/A'}). ${sixSigma?.sigmaLevel < 4 ? 'Process below 4σ — requires DMAIC intervention.' : sixSigma?.sigmaLevel < 5 ? 'Moderate capability — focus on defect reduction.' : 'Excellent capability — sustain with control charts.'}`
      },
      {
        framework: 'Theory of Constraints (Goldratt)',
        insight: `${((occ * 100) > 85) ? 'Occupancy is high — the constraint is agent availability. Consider hiring or automation.' : ((occ * 100) < 65) ? 'Occupancy is low — demand is the constraint. Focus on marketing or upskilling.' : 'Operations appear balanced. Monitor for emerging bottlenecks.'}`
      },
      {
        framework: 'Pareto Principle (80/20)',
        insight: `Top 20% of agents handle ${(() => { const agents = data.agents; if (!agents?.length) return 'N/A'; const sorted = [...agents].sort((a,b) => b.productivityTotal - a.productivityTotal); const top20 = Math.ceil(sorted.length * 0.2); const topSum = sorted.slice(0, top20).reduce((s, a) => s + a.productivityTotal, 0); const total = sorted.reduce((s, a) => s + a.productivityTotal, 0); return total > 0 ? ((topSum / total) * 100).toFixed(0) + '%' : 'N/A'; })()} of total output. Replicate top performers' behaviors.`
      },
      {
        framework: 'Situational Leadership (Hersey-Blanchard)',
        insight: `${(() => { const agents = data.agents; if (!agents?.length) return 'N/A'; const low = agents.filter(a => a.productivityTotal < 5).length; const mid = agents.filter(a => a.productivityTotal >= 5 && a.productivityTotal < 20).length; const high = agents.filter(a => a.productivityTotal >= 20).length; return `High performers: ${high} (coaching/delegation). Mid: ${mid} (supporting). Low: ${low} (directing/training).`; })()}`
      },
      {
        framework: 'Kotter\'s 8-Step Change',
        insight: shr > 0.35
          ? `Shrinkage at ${(shr*100).toFixed(1)}% — urgency needed. Create coalition for attendance improvement, communicate vision of 25% target, empower managers to enforce policy.`
          : 'Shrinkage within acceptable range. Continue monitoring and celebrate adherence wins.'
      }
    ];
  },

  /* ── LEAN WASTE ANALYSIS (MUDA) ── */
  leanWasteAnalysis(data) {
    const wastes = [];
    const missPct = data.missedCallPercent || 0;
    const occ = data.occupancy || 0;

    if (missPct > 0.05) wastes.push({ type: 'Defects', desc: `${(missPct*100).toFixed(1)}% missed calls = defects in service delivery.` });
    if (data.lateLogin > 3) wastes.push({ type: 'Waiting', desc: `${data.lateLogin} late logins = waiting waste.` });
    if (occ < 0.6) wastes.push({ type: 'Underutilization', desc: `Low occupancy (${(occ*100).toFixed(1)}%) = talent underutilization.` });

    if (!wastes.length) wastes.push({ type: 'All Clear', desc: 'No significant lean wastes detected in current data.' });
    return wastes;
  },

  /* ── SWOT ANALYSIS ── */
  swotAnalysis(data, benchmark) {
    const occ = data.occupancy || 0;
    const shr = data.shrinkage || 0;
    const miss = data.missedCallPercent || 0;
    const prod = data.productivityTotal || 0;

    return {
      strengths: [
        occ >= 0.7 ? `Occupancy at ${(occ*100).toFixed(1)}% — strong utilization.` : null,
        prod > 100 ? `High throughput: ${prod} total interactions.` : null,
        data.agentCount > 0 ? `${data.agentCount} active agents deployed.` : null
      ].filter(Boolean),
      weaknesses: [
        miss > 0.08 ? `Missed call rate ${(miss*100).toFixed(1)}% above threshold.` : null,
        shr > 0.3 ? `Shrinkage at ${(shr*100).toFixed(1)}% — above target.` : null,
        data.lateLogin > 3 ? `${data.lateLogin} late logins impacting SLAs.` : null
      ].filter(Boolean),
      opportunities: [
        'Implement AI-powered call routing to reduce miss rate.',
        'Cross-train agents for multi-process flexibility.',
        'Deploy automated quality monitoring for real-time coaching.'
      ],
      threats: [
        'Seasonal volume spikes may strain capacity.',
        'High attrition risk if occupancy remains above 85%.',
        'Competition may poach top performers.'
      ]
    };
  }
};
