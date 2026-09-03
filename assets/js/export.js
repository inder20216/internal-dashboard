/* ══════════════════════════════════════════════════
   EXPORT — Screenshot / PDF of the active dashboard view
   Captures the active .page-view only (KPIs, charts, tables) —
   deliberately excludes the sidebar and the topbar date filter,
   so what gets shared is just the report itself, ready to paste
   into Teams or attach as a PDF.
   ══════════════════════════════════════════════════ */

function getActiveViewEl() {
  return document.querySelector('.page-view.active') || document.getElementById('viewDashboard');
}

async function captureActiveView() {
  const el = getActiveViewEl();
  const isDarkNow = document.documentElement.getAttribute('data-theme') === 'dark';
  const bodyBg = getComputedStyle(document.body).backgroundColor;

  // Cards/panels fade in via a CSS animation on render — force them to their
  // final state before capturing, otherwise a capture triggered soon after a
  // (re)render grabs them mid-fade (washed out / partially transparent).
  const animated = el.querySelectorAll('.kpi-card, .panel, .stat-group-card, .attention-list');
  const prevStyles = [];
  animated.forEach(node => {
    prevStyles.push({ node, opacity: node.style.opacity, transform: node.style.transform, animation: node.style.animation });
    node.style.animation = 'none';
    node.style.opacity = '1';
    node.style.transform = 'none';
  });
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    // html2canvas defaults to the current viewport — explicitly pass the
    // element's full scroll size so content below the fold isn't cut off.
    return await html2canvas(el, {
      backgroundColor: bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' ? bodyBg : (isDarkNow ? '#0f1117' : '#f5f6fa'),
      scale: 2,
      useCORS: true,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
      width: el.scrollWidth,
      height: el.scrollHeight,
      scrollX: 0,
      scrollY: 0
    });
  } finally {
    prevStyles.forEach(({ node, opacity, transform, animation }) => {
      node.style.opacity = opacity;
      node.style.transform = transform;
      node.style.animation = animation;
    });
  }
}

async function exportDashboardImage() {
  showToast('Preparing screenshot…', 'info');
  try {
    const canvas = await captureActiveView();
    canvas.toBlob(async (blob) => {
      if (!blob) { showToast('Could not generate image.', 'error'); return; }
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('Copied — paste it into Teams with Ctrl+V.', 'success');
      } catch (err) {
        // Clipboard blocked (permissions/older browser) — fall back to a download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Clipboard unavailable — downloaded the image instead.', 'info');
      }
    }, 'image/png');
  } catch (err) {
    showToast('Screenshot failed: ' + err.message, 'error');
  }
}

async function exportDashboardPDF() {
  showToast('Preparing PDF…', 'info');
  try {
    const canvas = await captureActiveView();
    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL('image/png');
    const widthMm = 210; // A4 width
    const heightMm = (canvas.height / canvas.width) * widthMm;
    // Custom page height matching the full captured content, so it's one
    // continuous page with no mid-chart page breaks — meant for viewing/
    // sharing digitally, not for physical printing.
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [widthMm, heightMm] });
    pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);
    const proc = (window.APP_DATA && window.APP_DATA.currentState.selectedProcess) || 'dashboard';
    pdf.save(`${proc}-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('PDF downloaded.', 'success');
  } catch (err) {
    showToast('PDF export failed: ' + err.message, 'error');
  }
}
