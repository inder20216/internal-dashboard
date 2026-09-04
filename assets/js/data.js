/* ══════════════════════════════════════════════════
   DATA LAYER — Fetch, Aggregate, Transform
   Supports all 29 columns from source data
   ══════════════════════════════════════════════════ */

const API_URL = "https://automation.openmindhelpline.com/webhook/mis-dashboard";

let allRows = [];
let processList = [];

// "Facility" is a combined pseudo-process (not a real "Process Name" value in
// the source data) that rolls up Infres, VMM, and Nihon together, agent-wise.
const FACILITY_PROCESSES = ['Infres', 'VMM', 'Nihon'];
function matchesProcess(row, processName) {
  if (!processName) return true;
  if (processName === 'Facility') return FACILITY_PROCESSES.includes(row["Process Name"]);
  return row["Process Name"] === processName;
}

// Compute safe default date range (handles 1st-of-month edge case)
function computeDefaultRange() {
  const now = new Date();
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  // If yesterday is in the same month, show 1st→yesterday
  // If yesterday is prev month (today is 1st), show prev month
  let from, to;
  if (now.getDate() === 1) {
    // Show previous full month
    const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const ld = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    from = `${pm.getFullYear()}-${String(pm.getMonth()+1).padStart(2,'0')}-01`;
    to = `${pm.getFullYear()}-${String(pm.getMonth()+1).padStart(2,'0')}-${String(ld).padStart(2,'0')}`;
  } else {
    from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    to = `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`;
  }
  return { from, to };
}

const STORAGE_KEY = 'mis_dashboard_state';

function saveState() {
  try {
    const keep = { ...currentState };
    // Don't persist dateFrom/dateTo — always compute fresh on load. Don't persist
    // reportPeriod either — every visit should default to the Daily/yesterday
    // view, not silently reopen on whatever tab (e.g. Monthly) was last clicked
    // in a previous session.
    delete keep.dateFrom;
    delete keep.dateTo;
    delete keep.reportPeriod;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keep));
  } catch (_) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.role) currentState.role = saved.role;
    if (saved.userProcess !== undefined) currentState.userProcess = saved.userProcess;
    if (saved.selectedProcess !== undefined) currentState.selectedProcess = saved.selectedProcess;
    if (saved.theme) currentState.theme = saved.theme;
  } catch (_) {}
}

let currentState = {
  selectedProcess: '',
  // Empty on purpose -- the default view is Daily (below), which resolves its
  // own date fresh each render (see getPeriodDateRange). Seeding these with the
  // Monthly-style 1st-of-month default here made the very first render treat
  // that leftover date as if the user had manually picked it as a single day.
  dateFrom: '',
  dateTo: '',
  reportPeriod: 'daily',
  role: 'admin',
  userProcess: '',
  theme: 'light'
};
// Merge persisted values over defaults
loadState();

/* ── HELPERS ── */
function toNumber(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(String(v).replace(/[% ,]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseTimeToSeconds(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  // HH:MM:SS or HH:MM
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const h = parseInt(m[1]), min = parseInt(m[2]), sec = m[3] ? parseInt(m[3]) : 0;
    return h * 3600 + min * 60 + sec;
  }
  // Excel decimal day
  const n = Number(s.replace(/[% ,]/g, ''));
  return Number.isFinite(n) && n > 0 ? n * 86400 : null;
}

function excelDayToSeconds(v) {
  const secs = parseTimeToSeconds(v);
  return secs !== null && secs > 0 ? secs : 0;
}

function toSeconds(v) {
  const secs = parseTimeToSeconds(v);
  return secs !== null ? secs : 0;
}

function secondsToHms(s) {
  if (!Number.isFinite(s) || s <= 0) return '—';
  const total = Math.round(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return [h, m, sec].map(p => String(p).padStart(2, '0')).join(':');
}

function avgSeconds(rows, key, formattedKey) {
  const vals = rows.map(r => excelDayToSeconds(r[key])).filter(v => v > 0);
  if (vals.length) return secondsToHms(vals.reduce((a, b) => a + b, 0) / vals.length);
  if (formattedKey) {
    const f = rows.map(r => r[formattedKey]).find(v => v !== undefined && v !== null && v !== '');
    if (f) return String(f);
  }
  return '—';
}

function sumSeconds(rows, key, formattedKey) {
  const total = rows.reduce((s, r) => s + excelDayToSeconds(r[key]), 0);
  if (total > 0) return secondsToHms(total);
  if (formattedKey) {
    const f = rows.map(r => r[formattedKey]).find(v => v !== undefined && v !== null && v !== '');
    if (f) return String(f);
  }
  return '—';
}

/* Raw seconds total for a per-row time field (HH:MM:SS or Excel decimal day).
   Unlike sumNumber(), this parses each row's time value correctly instead of
   returning 0 for "HH:MM:SS" strings that Number() can't parse. */
function sumSecondsRaw(rows, key) {
  return rows.reduce((s, r) => s + excelDayToSeconds(r[key]), 0);
}

function avgNumber(rows, key) {
  const vals = rows.map(r => toNumber(r[key])).filter(v => v > 0);
  return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
}

function sumNumber(rows, key) {
  return rows.reduce((s, r) => s + toNumber(r[key]), 0);
}

/* Some legacy fields (e.g. "Total Inbound Calls", "Total IB Missed") are constant
   at the (process, date) grain and repeated identically on every agent row for
   that process+day — summing them per row would multiply the true total by
   however many agents worked that day. This takes one value per (process, date)
   instead, then sums across dates/processes. */
function sumProcessDayConstant(rows, key) {
  const perGroup = new Map();
  rows.forEach(r => {
    if (!r.Date) return;
    const groupKey = (r["Process Name"] || '') + '||' + r.Date;
    if (!perGroup.has(groupKey)) perGroup.set(groupKey, toNumber(r[key]));
  });
  let total = 0;
  perGroup.forEach(v => { total += v; });
  return total;
}

/* Same process-day dedup as sumProcessDayConstant, but for a time-string field
   (e.g. "Call Back on Missed Call") averaged across the distinct days in range,
   since summing an average-duration metric across days would be meaningless. */
function avgProcessDayConstantSeconds(rows, key) {
  const perGroup = new Map();
  rows.forEach(r => {
    if (!r.Date) return;
    const groupKey = (r["Process Name"] || '') + '||' + r.Date;
    if (!perGroup.has(groupKey)) perGroup.set(groupKey, excelDayToSeconds(r[key]));
  });
  const vals = [...perGroup.values()].filter(v => v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

/* Baxter started tagging Sent emails by agent (Outlook category) on this date —
   "Email Sent"/"Email duration" are genuinely per-agent from here on, but before
   this they're still process-day-constant (broadcast to every agent row that day,
   same as Total Inbound Calls). Any aggregation of these two fields has to branch
   on this date or it will either double-count (treating old broadcast rows as
   per-agent) or under-count (treating new per-agent rows as a once-per-day constant). */
const EMAIL_TAGGING_START_DATE = '2026-08-01';

/* Combined (process-wide) email-sent count, correct across the tagging cutover:
   one value per (process, date) before the cutover, genuinely summed per row after. */
function sumEmailSentCount(rows) {
  const pre = rows.filter(r => !r.Date || r.Date < EMAIL_TAGGING_START_DATE);
  const post = rows.filter(r => r.Date >= EMAIL_TAGGING_START_DATE);
  return sumProcessDayConstant(pre, "Email Sent") + sumNumber(post, "Email Sent");
}

/* Same cutover-aware logic as sumEmailSentCount, but for the duration field
   (in seconds) — "Email duration" was also broadcast-then-per-agent. */
function sumEmailSentDurationSec(rows) {
  const pre = rows.filter(r => !r.Date || r.Date < EMAIL_TAGGING_START_DATE);
  const post = rows.filter(r => r.Date >= EMAIL_TAGGING_START_DATE);
  const perGroup = new Map();
  pre.forEach(r => {
    const groupKey = (r["Process Name"] || '') + '||' + r.Date;
    if (!perGroup.has(groupKey)) perGroup.set(groupKey, excelDayToSeconds(r["Email duration"]));
  });
  let preSec = 0;
  perGroup.forEach(v => { preSec += v; });
  return preSec + sumSecondsRaw(post, "Email duration");
}

/* Per-agent email count. "Email Received" is still process-day-constant (broadcast
   to every agent row that day, same as Total Inbound Calls) so it's NOT genuinely
   attributable to one agent. "Email Sent" is the same story UNTIL the tagging
   cutover above, after which it's real per-agent data and safe to sum per row.
   CRM(E-Mail)/CRM(Call) have always been real per-agent counts (from crm_daily_summary). */
function emailHandled(r) {
  const base = toNumber(r["Emails Handled"]) + toNumber(r["Email Handled"]) + toNumber(r["E-Mail Handled"])
    || toNumber(r["CRM(E-Mail)"]) + toNumber(r["CRM(Call)"]);
  const taggedEmailSent = (r.Date && r.Date >= EMAIL_TAGGING_START_DATE) ? toNumber(r["Email Sent"]) : 0;
  return base + taggedEmailSent;
}

// ResMed only tracks these 4 agents as real people — "Admin" in the raw data is
// actually Sagarika Bose's login identity, and every other ResMed agent name in
// the data is noise that shouldn't appear in any agent-wise breakdown. Different
// source tables spell these differently too (resmed_conversion uses first names
// only, e.g. "Avijit" instead of "Avijit Dey") — all normalized to the full name.
const RESMED_AGENT_ALLOWLIST = new Set(['Gulshan Khan', 'Kumkum', 'Avijit Dey', 'Sagarika Bose']);
const RESMED_AGENT_ALIASES = {
  'Admin': 'Sagarika Bose', 'Sagarika': 'Sagarika Bose',
  'Gulshan': 'Gulshan Khan', 'Avijit': 'Avijit Dey'
};
function normalizeResmedAgent(processName, rawAgentName) {
  if (processName === 'ResMed' && RESMED_AGENT_ALIASES[rawAgentName]) return RESMED_AGENT_ALIASES[rawAgentName];
  return rawAgentName;
}
function passesResmedAllowlist(processName, agentDisplayName) {
  return processName !== 'ResMed' || RESMED_AGENT_ALLOWLIST.has(agentDisplayName);
}

function agentName(r) {
  const raw = r.Agent || r["Agent Mapped"] || 'Unassigned';
  return normalizeResmedAgent(r["Process Name"], raw);
}

function hasActivity(r) {
  return toNumber(r["Inbound Answer"]) > 0 || toNumber(r["Outbound All"]) > 0 ||
    emailHandled(r) > 0 || excelDayToSeconds(r.AHT) > 0;
}

function parseLoginHour(v) {
  const m = String(v || '').match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = Number(m[1]), min = Number(m[2]);
  if (m[3]?.toUpperCase() === 'PM' && h < 12) h += 12;
  if (m[3]?.toUpperCase() === 'AM' && h === 12) h = 0;
  return h + min / 60;
}

function formatPercent(v) {
  if (v === undefined || v === null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return pct.toFixed(2) + '%';
}

/* ── DATE FILTERING ── */
function rowsInRange(rows, from, to) {
  if (!from && !to) return rows;
  return rows.filter(r => {
    if (!r.Date) return false;
    if (from && r.Date < from) return false;
    if (to && r.Date > to) return false;
    return true;
  });
}

function latestActiveDate(rows) {
  const dates = rows.filter(hasActivity).map(r => r.Date).filter(Boolean).sort();
  return dates.length ? dates.at(-1) : '';
}

/* ── AGGREGATE PROCESS DATA ── */
function aggregateProcess(rows, processName) {
  const { dateFrom, dateTo } = currentState;
  const scoped = processName ? rows.filter(r => matchesProcess(r, processName)) : rows;
  const ranged = rowsInRange(scoped, dateFrom, dateTo);
  const latest = latestActiveDate(scoped);
  const daily = dateFrom || dateTo ? ranged : (latest ? scoped.filter(r => r.Date === latest) : scoped);

  const reportLabel = dateFrom && dateTo ? (dateFrom === dateTo ? dateFrom : `${dateFrom} → ${dateTo}`)
    : dateFrom ? `${dateFrom} onward` : dateTo ? `up to ${dateTo}` : latest || '';

  /* Core metrics */
  const ib = sumNumber(daily, "Inbound Answer");
  const ob = sumNumber(daily, "Outbound All");
  const obAns = sumNumber(daily, "OB Answer");
  // Email Received is a process-wide daily total (broadcast to every agent row
  // for that process+day, same as Total Inbound Calls) — take one value per
  // (process, date), not a per-row sum. Email Sent is the same story before the
  // tagging cutover, genuinely per-agent after it — sumEmailSentCount() branches
  // on that date. CRM(E-Mail)/CRM(Call) are genuinely per-agent, so a plain sum.
  const email = sumNumber(daily, "Emails Handled") + sumNumber(daily, "Email Handled") + sumNumber(daily, "E-Mail Handled")
    + sumProcessDayConstant(daily, "Email Received") + sumEmailSentCount(daily)
    + sumNumber(daily, "CRM(E-Mail)") + sumNumber(daily, "CRM(Call)");
  const totalCalls = sumProcessDayConstant(daily, "Total Inbound Calls") || sumNumber(daily, "Inbound Offered") || sumNumber(daily, "Calls Offered") || sumNumber(daily, "Offered");
  const totalMissed = sumProcessDayConstant(daily, "Total IB Missed");
  const agentMissedIb = sumNumber(daily, "Agent Missed(IB)");
  const agentMissedOb = sumNumber(daily, "Agent Missed (OB)");
  const customerMissed = sumNumber(daily, "Customer Missed");
  // Queue/IVR/Service Missed are process-day-constant (same as Total Inbound
  // Calls) — these aren't attributable to a specific agent, process-level only.
  const queueMissed = sumProcessDayConstant(daily, "Queue Missed");
  const ivrMissed = sumProcessDayConstant(daily, "IVR Missed");
  const serviceMissed = sumProcessDayConstant(daily, "Service Missed");
  // Same process-day-constant pattern — a call that came in outside working
  // hours (no agent logged in) isn't attributable to any one agent either.
  const missedWorkingHours = sumProcessDayConstant(daily, "Missed Working Hours");
  const missedNonWorkingHours = sumProcessDayConstant(daily, "Missed Non-Working Hours");

  /* Time metrics — these fields arrive as "HH:MM:SS" strings, so they must be
     summed per-row via sumSecondsRaw(), not sumNumber() (which can't parse them). */
  const breakSec = sumSecondsRaw(daily, "Break time");
  const loginSec = sumSecondsRaw(daily, "Login Out");
  const workSec = sumSecondsRaw(daily, "Hours");
  const ibTTSec = sumSecondsRaw(daily, "IB TT");
  const obTTSec = sumSecondsRaw(daily, "OB TT");
  const talkSec = ibTTSec + obTTSec;
  // Total/Avg AHT stat charts are agent-wise metrics too — for ResMed they must
  // reflect only the 4 real agents, same as every other agent-wise panel, even
  // though the rest of this function's totals stay unfiltered (real KPIs/volume).
  const ahtRows = processName === 'ResMed' ? daily.filter(r => RESMED_AGENT_ALLOWLIST.has(agentName(r))) : daily;
  const ahtIbTTSec = sumSecondsRaw(ahtRows, "IB TT");
  const ahtObTTSec = sumSecondsRaw(ahtRows, "OB TT");
  const ahtIbAnswered = sumNumber(ahtRows, "Inbound Answer");
  const ahtObAnswered = sumNumber(ahtRows, "OB Answer");

  /* Quality metrics */
  const hangupIB = sumNumber(daily, "Call Hangup With in 10 Sec-IB");
  const hangupOB = sumNumber(daily, "Call Hangup With in 10 Sec-OB");
  const totalHangup = hangupIB + hangupOB;
  const emailDurationSec = sumEmailSentDurationSec(daily);
  const emailDuration = secondsToHms(emailDurationSec);
  const crmCall = sumNumber(daily, "CRM(Call)");
  const crmEmail = sumNumber(daily, "CRM(E-Mail)");
  const nonTrading = sumNumber(daily, "Non Trading");

  /* Derived metrics */
  const lateCount = daily.filter(r => { const h = parseLoginHour(r["Login Time"]); return h !== null && h > 9.5; }).length;
  // Facility spans 3 real processes, so its agent table should show the Process
  // column too, same as the true "all processes" admin view.
  const showProcessColumn = !processName || processName === 'Facility';
  const agents = aggregateAgents(daily, showProcessColumn);

  return {
    processName, reportLabel, isOverall: showProcessColumn,
    agentCount: new Set(daily.map(agentName).filter(Boolean)).size,
    /* Volume */
    totalCalls, inboundAnswered: ib, outboundAll: ob, obAnswered: obAns, emailsHandled: email,
    obAnswerPercent: ob > 0 ? obAns / ob : 0,
    productivityTotal: ib + ob + email,
    /* Missed */
    totalMissed, agentMissed: agentMissedIb + agentMissedOb, agentMissedInbound: agentMissedIb, customerMissed,
    missedCallPercent: totalCalls > 0 ? totalMissed / totalCalls : 0,
    agentMissedPercent: totalCalls > 0 ? (agentMissedIb + agentMissedOb) / totalCalls : 0,
    customerMissedPercent: ob > 0 ? customerMissed / ob : 0,
    queueMissed, ivrMissed, serviceMissed,
    missedWorkingHours, missedNonWorkingHours,
    /* Time */
    shrinkage: loginSec > 0 ? breakSec / loginSec : 0,
    occupancy: workSec > 0 ? talkSec / workSec : 0,
    productivity: loginSec > 0 ? workSec / loginSec : 0,
    aht: avgSeconds(daily, "AHT", "AHT (formatted)"),
    apt: avgSeconds(daily, "APT", "APT (formatted)"),
    ibTalkTime: sumSeconds(daily, "IB TT", "IB TT (formatted)"),
    obTalkTime: sumSeconds(daily, "OB TT", "OB TT (formatted)"),
    ibTalkTimeSec: ahtIbTTSec,
    obTalkTimeSec: ahtObTTSec,
    /* AHT split by direction: total talk time on that side / calls answered on that side */
    ahtInbound: ahtIbAnswered > 0 ? secondsToHms(ahtIbTTSec / ahtIbAnswered) : '—',
    ahtOutbound: ahtObAnswered > 0 ? secondsToHms(ahtObTTSec / ahtObAnswered) : '—',
    ahtInboundSec: ahtIbAnswered > 0 ? Math.round(ahtIbTTSec / ahtIbAnswered) : 0,
    ahtOutboundSec: ahtObAnswered > 0 ? Math.round(ahtObTTSec / ahtObAnswered) : 0,
    emailSentCount: sumEmailSentCount(daily),
    emailDuration,
    /* Quality */
    hangupIB, hangupOB, totalHangup,
    hangupRate: (ib + ob) > 0 ? totalHangup / (ib + ob) : 0,
    crmCall, crmEmail, crmTotal: crmCall + crmEmail,
    nonTrading,
    callbackOnMissedCall: secondsToHms(avgProcessDayConstantSeconds(daily, "Call Back on Missed Call")),
    /* People */
    lateLogin: lateCount,
    agents,
    daily
  };
}

/* ── AGGREGATE AGENTS (per-agent metrics) ── */
function aggregateAgents(rows, includeProcess) {
  const map = new Map();
  rows.forEach(r => {
    const proc = r["Process Name"] || 'Unassigned';
    const agent = agentName(r);
    const key = includeProcess ? `${proc}||${agent}` : agent;
    const cur = map.get(key) || {
      agent, sip: r.SIP || '', process: proc,
      inboundAnswered: 0, outboundAll: 0, obAnswered: 0, emailsHandled: 0,
      agentMissed: 0, agentMissedIb: 0, agentMissedOb: 0, customerMissed: 0,
      hangupIB: 0, hangupOB: 0, crmCall: 0, crmEmail: 0,
      nonTrading: 0, closedCases: 0, partialClosedCases: 0,
      appreciationCount: 0, escalationCount: 0,
      crmEscalationOpen: 0, crmEscalationPendingField: 0, crmEscalationPendingRhc: 0, rows: []
    };
    cur.inboundAnswered += toNumber(r["Inbound Answer"]);
    cur.outboundAll += toNumber(r["Outbound All"]);
    cur.obAnswered += toNumber(r["OB Answer"]);
    cur.emailsHandled += emailHandled(r);
    cur.agentMissed += toNumber(r["Agent Missed(IB)"]) + toNumber(r["Agent Missed (OB)"]);
    cur.agentMissedIb += toNumber(r["Agent Missed(IB)"]);
    cur.agentMissedOb += toNumber(r["Agent Missed (OB)"]);
    cur.customerMissed += toNumber(r["Customer Missed"]);
    cur.hangupIB += toNumber(r["Call Hangup With in 10 Sec-IB"]);
    cur.hangupOB += toNumber(r["Call Hangup With in 10 Sec-OB"]);
    cur.crmCall += toNumber(r["CRM(Call)"]);
    cur.crmEmail += toNumber(r["CRM(E-Mail)"]);
    cur.nonTrading += toNumber(r["Non Trading"]);
    cur.closedCases += toNumber(r["Closed"]);
    cur.partialClosedCases += toNumber(r["Partial Closed"]);
    cur.appreciationCount += toNumber(r["Appreciation"]);
    cur.escalationCount += toNumber(r["Escalation"]);
    cur.crmEscalationOpen += toNumber(r["Open"]);
    cur.crmEscalationPendingField += toNumber(r["Pending from field"]);
    cur.crmEscalationPendingRhc += toNumber(r["Pending from RHC"]);
    cur.rows.push(r);
    map.set(key, cur);
  });

  const BREAK_TARGET_SEC = 3600; // 1 hour
  return [...map.values()].map(a => {
    const ibSec = sumSecondsRaw(a.rows, "IB TT");
    const obSec = sumSecondsRaw(a.rows, "OB TT");
    const hrsSec = sumSecondsRaw(a.rows, "Hours");
    const breakSecTotal = sumSecondsRaw(a.rows, "Break time");
    const dayCount = new Set(a.rows.map(r => r.Date).filter(Boolean)).size || 1;
    const breakSecForTarget = dayCount > 1 ? breakSecTotal / dayCount : breakSecTotal;
    return {
      ...a,
      productivityTotal: a.inboundAnswered + a.outboundAll + a.emailsHandled,
      aht: avgSeconds(a.rows, "AHT", "AHT (formatted)"),
      apt: avgSeconds(a.rows, "APT", "APT (formatted)"),
      ibTalkTime: sumSeconds(a.rows, "IB TT", "IB TT (formatted)"),
      obTalkTime: sumSeconds(a.rows, "OB TT", "OB TT (formatted)"),
      // Avg talk time (AHT) per call direction, for Answered calls only —
      // distinct from the blended "AHT" column which mixes IB+OB.
      ahtInboundSec: a.inboundAnswered > 0 ? Math.round(ibSec / a.inboundAnswered) : 0,
      ahtOutboundSec: a.obAnswered > 0 ? Math.round(obSec / a.obAnswered) : 0,
      loginDuration: sumSeconds(a.rows, "Hours", "Hours (formatted)"),
      breakDuration: sumSeconds(a.rows, "Break time", "Break time (formatted)"),
      breakDaysCount: dayCount,
      breakSecForTarget,
      breakVsTargetSec: breakSecForTarget - BREAK_TARGET_SEC,
      trainingDuration: sumSeconds(a.rows, "Training Duration", "Training Duration (formatted)"),
      // Calls actually routed to this specific agent (answered by them or missed by them) —
      // NOT "Total Inbound Calls", which is a process-wide broadcast value repeated on every
      // agent's row and would make every agent look like they handled the whole process's volume.
      totalCalls: a.inboundAnswered + a.agentMissedIb,
      missedRate: (a.inboundAnswered + a.agentMissedIb) > 0 ? a.agentMissedIb / (a.inboundAnswered + a.agentMissedIb) : 0,
      hangupTotal: a.hangupIB + a.hangupOB,
      hangupRate: (a.inboundAnswered + a.outboundAll) > 0 ? (a.hangupIB + a.hangupOB) / (a.inboundAnswered + a.outboundAll) : 0,
      occupancy: hrsSec > 0 ? (ibSec + obSec) / hrsSec : 0
    };
  }).filter(a => passesResmedAllowlist(a.process, a.agent))
    .sort((a, b) => b.productivityTotal - a.productivityTotal);
}

/* ── PROCESS TIME-SERIES ── */
function getTimeSeries(rows, processName) {
  const scoped = processName ? rows.filter(r => matchesProcess(r, processName)) : rows;
  const dateMap = new Map();
  scoped.forEach(r => {
    if (!r.Date) return;
    const cur = dateMap.get(r.Date) || {
      date: r.Date, ib: 0, ob: 0, obAns: 0, email: 0, missed: 0, aht: 0,
      hangup: 0, crm: 0, nonTrading: 0, count: 0
    };
    cur.ib += toNumber(r["Inbound Answer"]);
    cur.ob += toNumber(r["Outbound All"]);
    cur.obAns += toNumber(r["OB Answer"]);
    cur.email += emailHandled(r);
    cur.missed += toNumber(r["Total IB Missed"]);
    cur.aht += excelDayToSeconds(r.AHT);
    cur.hangup += toNumber(r["Call Hangup With in 10 Sec-IB"]) + toNumber(r["Call Hangup With in 10 Sec-OB"]);
    cur.crm += toNumber(r["CRM(Call)"]) + toNumber(r["CRM(E-Mail)"]);
    cur.nonTrading += toNumber(r["Non Trading"]);
    cur.count += hasActivity(r) ? 1 : 0;
    dateMap.set(r.Date, cur);
  });
  return [...dateMap.values()]
    .filter(d => d.count > 0)
    .map(d => ({ ...d, aht: d.count > 0 ? d.aht / d.count : 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ── BENCHMARK ALL AGENTS ACROSS PROCESSES ── */
function getBenchmarkData(rows) {
  const allAgents = aggregateAgents(rows, true);
  const processStats = new Map();
  allAgents.forEach(a => {
    const cur = processStats.get(a.process) || { process: a.process, agents: [], totalProductivity: 0, count: 0 };
    cur.agents.push(a);
    cur.totalProductivity += a.productivityTotal;
    cur.count++;
    processStats.set(a.process, cur);
  });

  const topOverall = [...allAgents].sort((a, b) => b.productivityTotal - a.productivityTotal).slice(0, 10);

  processStats.forEach(p => {
    p.avgProductivity = p.count > 0 ? p.totalProductivity / p.count : 0;
    p.topAgent = [...p.agents].sort((a, b) => b.productivityTotal - a.productivityTotal)[0];
  });

  const allRanked = [...allAgents]
    .sort((a, b) => b.productivityTotal - a.productivityTotal)
    .map((a, i) => ({ ...a, globalRank: i + 1 }));

  return { processStats: [...processStats.values()], topOverall, allRanked };
}

/* ── COMPUTE LEAN SIX SIGMA METRICS ── */
function computeSixSigma(processData) {
  const defects = processData.agentMissed + processData.totalMissed + processData.totalHangup;
  const opportunities = processData.totalCalls + processData.outboundAll || 1;
  const rawDpm = (defects / opportunities) * 1e6;
  const dpm = Math.round(rawDpm);

  const sigmaTable = [[3.4, 6], [233, 5], [6210, 4], [66807, 3], [308537, 2], [691462, 1]];
  let sigmaLevel = 1;
  for (const [d, s] of sigmaTable) {
    if (dpm <= d) { sigmaLevel = s; break; }
  }

  const yield_ = opportunities > 0 ? ((opportunities - defects) / opportunities * 100).toFixed(2) : 0;

  return { dpm, sigmaLevel, yield: yield_, defects, opportunities, dpmo: dpm };
}

/* ── FETCH ── */
async function fetchData() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  allRows = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
  if (!allRows.length) throw new Error('No data');
  processList = [...new Set(allRows.map(r => r["Process Name"]).filter(Boolean))].sort();
  APP_DATA.allRows = allRows;
  APP_DATA.processList = processList;
  return { allRows, processList };
}

/* ── TRACKER INSIGHTS (Training Type / Quality Ratio / Downtime / etc.) ──
   Separate data source: training_tracker / quality_audit / activity_tracker / etc.
   were never wired into the Sheet26 pipeline the main dashboard reads from, so
   this hits 8 independent webhooks, each querying its own MySQL table(s) — split
   apart from a single 12-branch UNION query so one bad branch (e.g. a collation
   mismatch) can't take down every insights panel at once; each endpoint fails
   on its own and the others still populate. */
const INSIGHTS_BASE = "https://inder20216.app.n8n.cloud/webhook/";
const INSIGHTS_ENDPOINTS = [
  'tracker-training', 'tracker-quality', 'tracker-downtime', 'tracker-conversion',
  'tracker-ob-activity', 'tracker-hourly', 'tracker-fresh-calls', 'tracker-stg-tagging'
];

async function fetchTrackerInsights(processName, from, to) {
  try {
    const results = await Promise.all(INSIGHTS_ENDPOINTS.map(async (endpoint) => {
      try {
        const url = `${INSIGHTS_BASE}${endpoint}?process=${encodeURIComponent(processName)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${endpoint} ${res.status}`);
        const data = await res.json();
        return Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
      } catch (err) {
        console.error(`fetchTrackerInsights: ${endpoint} failed:`, err);
        return [];
      }
    }));
    return aggregateTrackerInsights(results.flat());
  } catch (err) {
    console.error('fetchTrackerInsights failed:', err);
    return { training: [], quality: [], downtime: [], conversions: [], obActivity: [], hourlyMissed: [], freshCallsComparison: [], stgTagging: [] };
  }
}

function aggregateTrackerInsights(rows) {
  const training = rows.filter(r => r.metric_type === 'training').map(r => ({
    agent: normalizeResmedAgent(r.process_name, r.agent_name), process: r.process_name, category: r.category || 'Unspecified',
    durationSec: Number(r.value) || 0, count: Number(r.cnt) || 0
  })).filter(o => passesResmedAllowlist(o.process, o.agent));
  const quality = rows.filter(r => r.metric_type === 'quality').map(r => ({
    agent: normalizeResmedAgent(r.process_name, r.agent_name), process: r.process_name, avgPercentage: Number(r.score) || 0,
    totalScore: Number(r.value) || 0, count: Number(r.cnt) || 0
  })).filter(o => passesResmedAllowlist(o.process, o.agent));
  const downtime = rows.filter(r => r.metric_type === 'downtime').map(r => ({
    agent: normalizeResmedAgent(r.process_name, r.agent_name), process: r.process_name, category: r.category || 'Unspecified',
    durationSec: Number(r.value) || 0, count: Number(r.cnt) || 0
  })).filter(o => passesResmedAllowlist(o.process, o.agent));
  const conversions = rows.filter(r => r.metric_type === 'conversion').map(r => ({
    agent: normalizeResmedAgent(r.process_name, r.agent_name), process: r.process_name, category: r.category || 'Unspecified', count: Number(r.cnt) || 0
  })).filter(o => passesResmedAllowlist(o.process, o.agent));
  const obActivity = rows.filter(r => r.metric_type === 'ob_activity').map(r => ({
    agent: normalizeResmedAgent(r.process_name, r.agent_name), process: r.process_name, category: r.category || 'Unspecified',
    connected: Number(r.value) || 0, total: Number(r.cnt) || 0
  })).filter(o => passesResmedAllowlist(o.process, o.agent));
  // score carries the hour here (category is the missed-disposition type instead).
  const hourlyMissed = rows.filter(r => r.metric_type === 'hourly_missed').map(r => ({
    hour: Number(r.score), type: r.category || 'Unspecified', count: Number(r.value) || 0
  }));
  // Merge the two independently-dated series (CDR notes vs CRM logging) onto a
  // single date axis -- either side can have days the other doesn't.
  const cdrByDate = new Map(rows.filter(r => r.metric_type === 'fresh_calls_cdr').map(r => [r.category, Number(r.value) || 0]));
  const crmByDate = new Map(rows.filter(r => r.metric_type === 'fresh_calls_crm').map(r => [r.category, Number(r.value) || 0]));
  const freshDates = [...new Set([...cdrByDate.keys(), ...crmByDate.keys()])].sort();
  const freshCallsComparison = freshDates.map(date => ({
    date, cdrCount: cdrByDate.get(date) || 0, crmCount: crmByDate.get(date) || 0
  }));
  // Agent-wise "STg tagging" case count (from CDR notes) -- Facility only.
  const stgTagging = rows.filter(r => r.metric_type === 'stg_tagging').map(r => ({
    agent: r.agent_name, process: r.process_name, count: Number(r.value) || 0, calls: Number(r.cnt) || 0
  }));
  return { training, quality, downtime, conversions, obActivity, hourlyMissed, freshCallsComparison, stgTagging };
}

/* ── EXPORT GLOBALLY ── */
const APP_DATA = {
  allRows, processList, currentState, API_URL,
  aggregateProcess, getTimeSeries, getBenchmarkData, computeSixSigma,
  fetchData, toNumber, formatPercent, excelDayToSeconds, secondsToHms,
  avgSeconds, sumSeconds, toSeconds, parseTimeToSeconds, computeDefaultRange,
  agentName, hasActivity, rowsInRange, latestActiveDate, parseLoginHour, emailHandled,
  fetchTrackerInsights
};
// sumNumber/avgNumber/sumSecondsRaw are used internally but also exposed for app.js
APP_DATA.sumNumber = sumNumber;
APP_DATA.avgNumber = avgNumber;
APP_DATA.sumSecondsRaw = sumSecondsRaw;
window.APP_DATA = APP_DATA;
