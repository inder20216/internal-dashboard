/* ══════════════════════════════════════════════════
   AUDIT EXPORT — Download Quality Audit + Appreciation/Escalation raw data
   as an Excel workbook (parameter-wise columns from the scores JSON),
   filterable by agent, scoped to the dashboard's currently active date range.
   ══════════════════════════════════════════════════ */

const AUDIT_EXPORT_URL = 'https://automation.openmindhelpline.com/webhook/call-audit-export';

function toggleAuditExportPanel() {
  const panel = document.getElementById('auditExportPanel');
  if (!panel) return;
  const opening = panel.style.display !== 'block';
  if (opening) {
    populateAuditExportAgents();
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}

function populateAuditExportAgents() {
  const sel = document.getElementById('auditExportAgent');
  if (!sel) return;
  const data = window.APP_DATA;
  const processName = data.currentState.selectedProcess;
  const agents = [...new Set(
    data.allRows
      .filter(r => !processName || r['Process Name'] === processName)
      .map(data.agentName)
      .filter(Boolean)
  )].sort((a, b) => String(a).localeCompare(String(b)));

  sel.innerHTML = ['<option value="All">All Agents</option>']
    .concat(agents.map(a => `<option value="${String(a).replace(/"/g, '&quot;')}">${a}</option>`))
    .join('');
}

/* Union of every "scores" key across all returned quality-audit rows --
   different processes use different rubrics, so this can't be a fixed list.
   Each row becomes one flat object with a column per parameter, blank where
   that row's rubric didn't include it. */
function flattenQualityAudits(rows) {
  const scoreKeys = new Set();
  rows.forEach(r => Object.keys(r.scores || {}).forEach(k => scoreKeys.add(k)));
  const sortedKeys = [...scoreKeys].sort();

  return rows.map(r => {
    const { scores, ...rest } = r;
    const flat = { ...rest };
    sortedKeys.forEach(k => { flat[k] = (scores && scores[k] !== undefined) ? scores[k] : ''; });
    return flat;
  });
}

async function downloadAuditReport() {
  const btn = document.getElementById('auditExportDownloadBtn');
  const data = window.APP_DATA;
  const processName = data.currentState.selectedProcess;
  if (!processName) { showToast('Select a process first.', 'error'); return; }

  const agent = document.getElementById('auditExportAgent').value || 'All';
  // Dashboard's active range isn't reliably sitting in currentState.dateFrom/dateTo
  // post-render (renderDashboard restores those to whatever they were before its
  // own temporary computation) -- recompute the same way it does, from the
  // selected report period, so this always matches what's actually on screen.
  const period = data.currentState.reportPeriod || 'monthly';
  const range = getPeriodDateRange(period);

  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2"></i> Preparing...';

  try {
    const params = new URLSearchParams({ process: processName, from: range.from, to: range.to, agent });
    const res = await fetch(`${AUDIT_EXPORT_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const payload = await res.json();

    const wb = XLSX.utils.book_new();

    const qualityRows = flattenQualityAudits(payload.qualityAudits || []);
    const wsQuality = XLSX.utils.json_to_sheet(qualityRows.length ? qualityRows : [{ 'No records': 'No quality audits in this range' }]);
    XLSX.utils.book_append_sheet(wb, wsQuality, 'Quality Audits');

    const activityRows = payload.appreciationEscalation || [];
    const wsActivity = XLSX.utils.json_to_sheet(activityRows.length ? activityRows : [{ 'No records': 'No appreciation/escalation in this range' }]);
    XLSX.utils.book_append_sheet(wb, wsActivity, 'Appreciation & Escalation');

    const agentSuffix = agent !== 'All' ? `-${agent}` : '';
    const filename = `${processName}-Call-Audit-Report-${range.from}_to_${range.to}${agentSuffix}.xlsx`;
    XLSX.writeFile(wb, filename);

    showToast('Audit report downloaded.', 'success');
    document.getElementById('auditExportPanel').style.display = 'none';
  } catch (err) {
    showToast('Failed to generate report: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-file-spreadsheet"></i> Download Excel';
  }
}
