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
  // renderDashboard() creates charts on an 80ms setTimeout and fetches tracker
  // insights (training/quality/downtime/etc.) asynchronously — a capture fired
  // right after navigating/switching dates can otherwise land mid-render and
  // grab a page that's still genuinely empty, not just mid fade-in.
  const pending = window.APP_DATA && window.APP_DATA.dashboardRenderReady;
  if (pending) { try { await pending; } catch (err) { /* proceed with whatever rendered */ } }

  const el = getActiveViewEl();
  const isDarkNow = document.documentElement.getAttribute('data-theme') === 'dark';
  const bodyBg = getComputedStyle(document.body).backgroundColor;

  // .app-shell (height:100vh, overflow:hidden), .main-content (overflow:hidden)
  // and .page-container (overflow-y:auto) all clip their content to the current
  // viewport -- passing scrollHeight to html2canvas only sizes the OUTPUT
  // canvas, it doesn't undo that clipping, since html2canvas lays out and
  // renders a real clone of this DOM+CSS. Without this, anything below the
  // visible fold on a long dashboard silently never made it into the image.
  // Walk every ancestor up to <body> and neutralize overflow/height so the
  // full content can actually lay out, then restore it all afterward.
  const ancestorPrevStyles = [];
  let ancestor = el.parentElement;
  while (ancestor && ancestor !== document.body) {
    ancestorPrevStyles.push({
      node: ancestor,
      overflow: ancestor.style.overflow, overflowX: ancestor.style.overflowX, overflowY: ancestor.style.overflowY,
      height: ancestor.style.height, maxHeight: ancestor.style.maxHeight
    });
    ancestor.style.overflow = 'visible';
    ancestor.style.overflowX = 'visible';
    ancestor.style.overflowY = 'visible';
    ancestor.style.height = 'auto';
    ancestor.style.maxHeight = 'none';
    ancestor = ancestor.parentElement;
  }

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

  // html2canvas re-implements CSS layout/paint from scratch rather than using
  // the browser's real renderer, and reliably capturing a *live* <canvas> that
  // way (animation timing, backing-store size, its own cloning quirks) is a
  // known weak point -- exactly what caused the last two rounds of blank
  // charts. Sidestepping it entirely: bake every chart to a static image
  // ourselves first (Chart.js's own toBase64Image(), reading the exact pixels
  // already correctly on screen), swap it in for the live canvas, and let
  // html2canvas just screenshot a plain <img> -- something it handles well.
  // Every chart instance is stashed as `.chart` on the canvas's 2D context
  // (see charts.js: `ctx.chart = new Chart(ctx, ...)`), not on the <canvas>
  // element itself.
  const canvasSwaps = [];
  el.querySelectorAll('canvas').forEach(canvas => {
    const chart = canvas.getContext('2d').chart;
    if (!chart || typeof chart.toBase64Image !== 'function') return;
    if (typeof chart.resize === 'function') chart.resize();
    if (typeof chart.update === 'function') chart.update('none'); // instant, final state -- no animation frame to wait on
    const rect = canvas.getBoundingClientRect();
    const img = document.createElement('img');
    img.src = chart.toBase64Image();
    img.style.width = rect.width + 'px';
    img.style.height = rect.height + 'px';
    img.style.display = 'block';
    canvas.parentNode.insertBefore(img, canvas);
    canvasSwaps.push({ canvas, img, prevDisplay: canvas.style.display });
    canvas.style.display = 'none';
  });
  // Let the swapped-in <img> elements actually finish decoding before handing
  // the page to html2canvas.
  await Promise.all(canvasSwaps.map(({ img }) => img.decode().catch(() => {})));

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
    canvasSwaps.forEach(({ canvas, img, prevDisplay }) => {
      img.remove();
      canvas.style.display = prevDisplay;
    });
    prevStyles.forEach(({ node, opacity, transform, animation }) => {
      node.style.opacity = opacity;
      node.style.transform = transform;
      node.style.animation = animation;
    });
    ancestorPrevStyles.forEach(({ node, overflow, overflowX, overflowY, height, maxHeight }) => {
      node.style.overflow = overflow;
      node.style.overflowX = overflowX;
      node.style.overflowY = overflowY;
      node.style.height = height;
      node.style.maxHeight = maxHeight;
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
