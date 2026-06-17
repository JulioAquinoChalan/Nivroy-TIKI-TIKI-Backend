function renderRulesOverlay(rules, uid = '') {
  const rulesJson = JSON.stringify(rules.filter((rule) => rule.enabled !== false));
  const uidJson = JSON.stringify(String(uid || '').trim());

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nivroy TIKI-TIKI Overlay</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: rgba(10, 12, 14, 0.70);
      --panel: rgba(22, 26, 29, 0.86);
      --line: rgba(139, 232, 211, 0.32);
      --text: #eef7f5;
      --muted: #b8c7c3;
      --accent: #8be8d3;
      --accent-2: #ffe082;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      overflow: hidden;
      background: transparent;
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .overlay {
      width: min(460px, calc(100vw - 32px));
      margin: 6px;
      padding: 10px;
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.40);
      backdrop-filter: blur(10px);
    }
    .header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 7px;
    }
    h1 {
      margin: 0;
      font-size: 21px;
      line-height: 1;
      letter-spacing: 0;
    }
    .tagline {
      color: var(--muted);
      font-size: 11px;
      white-space: nowrap;
    }
    .rules {
      display: grid;
      grid-template-columns: 1fr;
      gap: 5px;
    }
    .rule {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 8px;
      min-height: 38px;
      padding: 5px;
      background: var(--panel);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
    }
    .event {
      display: inline-flex;
      width: fit-content;
      margin-bottom: 2px;
      padding: 2px 6px;
      border: 1px solid rgba(139, 232, 211, 0.38);
      border-radius: 999px;
      color: var(--accent);
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .instruction {
      font-size: 12px;
      line-height: 1.1;
      font-weight: 800;
    }
    .target {
      margin-top: 2px;
      color: var(--accent-2);
      font-size: 10px;
      font-weight: 700;
    }
    .empty {
      padding: 16px;
      color: var(--muted);
      background: var(--panel);
      border-radius: 14px;
    }
    @media (max-width: 620px) {
      .overlay { width: calc(100vw - 12px); margin: 6px; padding: 8px; }
      .rules { grid-template-columns: 1fr; }
      h1 { font-size: 18px; }
      .tagline { font-size: 10px; }
    }
  </style>
</head>
<body>
  <main class="overlay">
    <div class="header">
      <div class="tagline">Activa eventos en Minecraft</div>
    </div>
    <section id="rules" class="rules"></section>
  </main>
  <script>
    const initialRules = ${rulesJson};
    const overlayUid = ${uidJson};
    const pageSize = 6;
    let activeRules = initialRules;
    let pageIndex = 0;
    const labels = {
      gift: 'Regalo',
      like: 'Like',
      follow: 'Follow',
      member: 'Entrada',
      share: 'Share',
      chat: 'Chat'
    };

    function instruction(rule) {
      const trigger = escapeHtml(rule.trigger || '');
      if (rule.eventType === 'chat') return 'Escribe <strong>' + trigger + '</strong>';
      if (rule.eventType === 'like') return 'Toca like para activar';
      if (rule.eventType === 'follow') return 'Sigue el live';
      if (rule.eventType === 'member') return 'Entra al live';
      if (rule.eventType === 'share') return 'Comparte el live';
      return 'Envia <strong>' + trigger + '</strong>';
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function visibleRules() {
      if (activeRules.length <= pageSize) {
        pageIndex = 0;
        return activeRules;
      }

      const pageCount = Math.ceil(activeRules.length / pageSize);
      if (pageIndex >= pageCount) {
        pageIndex = 0;
      }

      const start = pageIndex * pageSize;
      return activeRules.slice(start, start + pageSize);
    }

    function setRules(rules) {
      activeRules = rules.filter((rule) => rule.enabled !== false);
      render(visibleRules());
    }

    function rotateRules() {
      if (activeRules.length <= pageSize) {
        return;
      }

      pageIndex = (pageIndex + 1) % Math.ceil(activeRules.length / pageSize);
      render(visibleRules());
    }

    function render(rules) {
      const root = document.getElementById('rules');
      if (!rules.length) {
        root.className = '';
        root.innerHTML = '<div class="empty">No hay comandos activos.</div>';
        return;
      }
      root.className = 'rules';
      root.innerHTML = rules.map((rule) => {
        const type = rule.eventType || 'gift';
        return '<article class="rule">' +
          '<div>' +
            '<div class="event">' + escapeHtml(labels[type] || type) + '</div>' +
            '<div class="instruction">' + instruction(rule) + '</div>' +
            '<div class="target">→ ' + escapeHtml(rule.target || 'Minecraft') + '</div>' +
          '</div>' +
        '</article>';
      }).join('');
    }

    async function loadRules() {
      try {
        const params = new URLSearchParams({ t: Date.now().toString() });
        if (overlayUid) {
          params.set('uid', overlayUid);
        }
        const response = await fetch('/overlay/rules.json?' + params.toString(), { cache: 'no-store' });
        const payload = await response.json();
        const rules = Array.isArray(payload) ? payload : payload.data;
        if (!Array.isArray(rules)) {
          throw new Error('Invalid rules response.');
        }
        setRules(rules);
      } catch (error) {
        setRules(initialRules);
      }
    }

    function connectOverlaySocket() {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(protocol + '//' + window.location.host);

        socket.addEventListener('message', (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.source === 'rules' || payload.type === 'rule_saved' || payload.type === 'rule_updated') {
              loadRules();
            }
          } catch (error) {
            loadRules();
          }
        });

        socket.addEventListener('close', () => {
          setTimeout(connectOverlaySocket, 2500);
        });
      } catch (error) {
        setTimeout(connectOverlaySocket, 5000);
      }
    }

    setRules(initialRules);
    connectOverlaySocket();
    setInterval(loadRules, 2000);
    setInterval(rotateRules, 3000);
    loadRules();
  </script>
</body>
</html>`;
}

module.exports = {
  renderRulesOverlay,
};
