function renderAnnouncementsOverlay(rules, uid = '') {
  const activeRules = rules.filter((rule) => rule.enabled !== false);
  const rulesJson = JSON.stringify(activeRules);
  const uidJson = JSON.stringify(String(uid || '').trim());

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nivroy TIKI-TIKI Announcements</title>
  <style>
    :root {
      color-scheme: dark;
      --panel: rgba(10, 12, 14, 0.78);
      --line: rgba(139, 232, 211, 0.42);
      --text: #eef7f5;
      --muted: #b8c7c3;
      --accent: #8be8d3;
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
    .stage {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      pointer-events: none;
    }
    .announcement {
      max-width: min(980px, calc(100vw - 48px));
      padding: 18px 24px;
      background: var(--panel);
      border: 2px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 22px 60px rgba(0, 0, 0, 0.46);
      opacity: 0;
      transform: translateY(18px) scale(0.98);
      transition: opacity 180ms ease, transform 180ms ease;
      backdrop-filter: blur(10px);
    }
    .announcement.is-visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .label {
      margin-bottom: 7px;
      color: var(--accent);
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .message {
      font-size: clamp(34px, 5.2vw, 72px);
      line-height: 1.05;
      font-weight: 900;
      text-align: center;
      overflow-wrap: anywhere;
      text-shadow: 0 3px 14px rgba(0, 0, 0, 0.50);
    }
    @media (max-width: 620px) {
      .stage { padding: 14px; }
      .announcement {
        max-width: calc(100vw - 28px);
        padding: 14px 16px;
      }
      .label { font-size: 11px; }
      .message { font-size: clamp(28px, 11vw, 44px); }
    }
  </style>
</head>
<body>
  <main class="stage">
    <section id="announcement" class="announcement" aria-live="polite">
      <div class="label">Anuncio</div>
      <div id="message" class="message"></div>
    </section>
  </main>
  <script>
    const initialRules = ${rulesJson};
    const overlayUid = ${uidJson};
    const visibleMs = 3000;
    let activeRules = initialRules;
    let hideTimer = null;
    let queue = Promise.resolve();

    function setRules(rules) {
      activeRules = rules.filter((rule) => rule.enabled !== false);
    }

    function announcementRuleIds() {
      return new Set(activeRules
        .filter((rule) => extractAnnouncementFromCommand(rule.command))
        .map((rule) => String(rule.id || '')));
    }

    function escapeText(value) {
      return String(value || '').trim();
    }

    function extractAnnouncementFromCommand(command) {
      const lines = String(command || '').split(/\\r?\\n|\\s+\\|\\s+/);
      for (const line of lines) {
        const runSayIndex = line.indexOf(' run say ');
        if (runSayIndex >= 0) {
          return escapeText(line.slice(runSayIndex + ' run say '.length));
        }

        const trimmed = line.trim();
        if (trimmed.startsWith('say ')) {
          return escapeText(trimmed.slice(4));
        }
      }
      return '';
    }

    function extractAnnouncementFromEvent(event) {
      const detail = String(event.detail || '');
      const commands = detail.includes(' -> ') ? detail.split(' -> ').slice(1).join(' -> ') : detail;
      return extractAnnouncementFromCommand(commands);
    }

    function showAnnouncement(message) {
      const text = escapeText(message);
      if (!text) {
        return;
      }

      queue = queue.then(() => new Promise((resolve) => {
        const panel = document.getElementById('announcement');
        const messageNode = document.getElementById('message');
        window.clearTimeout(hideTimer);
        messageNode.textContent = text;
        panel.classList.add('is-visible');
        hideTimer = window.setTimeout(() => {
          panel.classList.remove('is-visible');
          window.setTimeout(resolve, 220);
        }, visibleMs);
      }));
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

    function handleSocketPayload(payload) {
      if (payload.source === 'rules' || payload.type === 'rule_saved' || payload.type === 'rule_updated') {
        loadRules();
        return;
      }

      if (payload.type !== 'command_sent') {
        return;
      }

      const ruleId = String(payload.ruleId || '');
      const ids = announcementRuleIds();
      if (ruleId && !ids.has(ruleId)) {
        return;
      }

      showAnnouncement(extractAnnouncementFromEvent(payload));
    }

    function connectOverlaySocket() {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(protocol + '//' + window.location.host);

        socket.addEventListener('message', (event) => {
          try {
            handleSocketPayload(JSON.parse(event.data));
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
    loadRules();
  </script>
</body>
</html>`;
}

module.exports = {
  renderAnnouncementsOverlay,
};
