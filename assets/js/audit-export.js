/* ══════════════════════════════════════════════════
   REPORTS TAB — Download Quality Audit + Appreciation/Escalation raw data
   as an Excel workbook (parameter-wise columns from the scores JSON),
   filterable by agent and a custom date range independent of the
   dashboard's own period selector.
   ══════════════════════════════════════════════════ */

const AUDIT_EXPORT_URL = 'https://automation.openmindhelpline.com/webhook/call-audit-export';

function renderReports() {
  const container = document.getElementById('viewReports');
  if (!container) return;
  const data = window.APP_DATA;
  const processName = data.currentState.selectedProcess;

  if (!processName) {
    container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--muted);"><i class="ti ti-file-off" style="font-size:40px;display:block;margin-bottom:12px;"></i><p>Select a process to download its audit report.</p></div>`;
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  container.innerHTML = `
    <div class="panel">
      <div class="panel-header"><i class="ti ti-file-spreadsheet"></i> Audit Report — ${processName}</div>
      <div class="panel-body">
        <p style="font-size:12px;color:var(--muted);margin-bottom:16px;">
          Downloads an Excel workbook with a sheet per report type selected below -- <strong>Quality Audits</strong>
          has every field, with the scores breakdown expanded into one column per parameter.
        </p>
        <div class="grid-3" style="margin-bottom:16px;">
          <div>
            <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:6px;">From</label>
            <input type="date" class="form-input w-full" id="reportsFrom" value="${monthAgo}">
          </div>
          <div>
            <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:6px;">To</label>
            <input type="date" class="form-input w-full" id="reportsTo" value="${today}">
          </div>
          <div>
            <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:6px;">Agent</label>
            <select class="form-select w-full" id="reportsAgent">
              <option value="All">All Agents</option>
            </select>
          </div>
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:8px;">Include</label>
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;margin-right:20px;cursor:pointer;">
            <input type="checkbox" id="reportsIncludeQuality" checked> Quality Audits
          </label>
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="reportsIncludeActivity" checked> Appreciation &amp; Escalation
          </label>
        </div>
        <button class="btn btn-primary" id="reportsDownloadBtn" onclick="downloadAuditReport()">
          <i class="ti ti-file-spreadsheet"></i> Download Excel
        </button>
        <div id="reportsMsg" style="font-size:12px;margin-top:10px;min-height:16px;"></div>
      </div>
    </div>`;

  populateAuditExportAgents();
}

function populateAuditExportAgents() {
  const sel = document.getElementById('reportsAgent');
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
  const btn = document.getElementById('reportsDownloadBtn');
  const msg = document.getElementById('reportsMsg');
  const data = window.APP_DATA;
  const processName = data.currentState.selectedProcess;
  if (!processName) { msg.textContent = 'Select a process first.'; msg.style.color = 'var(--accent4)'; return; }

  const from = document.getElementById('reportsFrom').value;
  const to = document.getElementById('reportsTo').value;
  const agent = document.getElementById('reportsAgent').value || 'All';
  if (!from || !to) { msg.textContent = 'Pick both a From and To date.'; msg.style.color = 'var(--accent4)'; return; }

  const includeQuality = document.getElementById('reportsIncludeQuality').checked;
  const includeActivity = document.getElementById('reportsIncludeActivity').checked;
  if (!includeQuality && !includeActivity) { msg.textContent = 'Select at least one report type to include.'; msg.style.color = 'var(--accent4)'; return; }

  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2"></i> Preparing...';
  msg.textContent = '';

  try {
    const params = new URLSearchParams({ process: processName, from, to, agent });
    const res = await fetch(`${AUDIT_EXPORT_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const payload = await res.json();

    const wb = XLSX.utils.book_new();
    const summaryParts = [];

    let qualityRows = [];
    if (includeQuality) {
      qualityRows = flattenQualityAudits(payload.qualityAudits || []);
      const wsQuality = XLSX.utils.json_to_sheet(qualityRows.length ? qualityRows : [{ 'No records': 'No quality audits in this range' }]);
      XLSX.utils.book_append_sheet(wb, wsQuality, 'Quality Audits');
      summaryParts.push(`${qualityRows.length} quality audits`);
    }

    let activityRows = [];
    if (includeActivity) {
      activityRows = payload.appreciationEscalation || [];
      const wsActivity = XLSX.utils.json_to_sheet(activityRows.length ? activityRows : [{ 'No records': 'No appreciation/escalation in this range' }]);
      XLSX.utils.book_append_sheet(wb, wsActivity, 'Appreciation & Escalation');
      summaryParts.push(`${activityRows.length} appreciation/escalation rows`);
    }

    const typeSuffix = includeQuality && !includeActivity ? '-Quality' : !includeQuality && includeActivity ? '-Appreciation-Escalation' : '';
    const agentSuffix = agent !== 'All' ? `-${agent}` : '';
    const filename = `${processName}-Call-Audit-Report-${from}_to_${to}${typeSuffix}${agentSuffix}.xlsx`;
    XLSX.writeFile(wb, filename);

    msg.textContent = `Downloaded — ${summaryParts.join(', ')}.`;
    msg.style.color = 'var(--accent2)';
  } catch (err) {
    msg.textContent = 'Failed to generate report: ' + err.message;
    msg.style.color = 'var(--accent4)';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-file-spreadsheet"></i> Download Excel';
  }
}
