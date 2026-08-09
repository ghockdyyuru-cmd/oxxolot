(() => {
  const STORAGE_KEY = 'oxxolot.sessions.v1';
  const MODE_META = {
    otak: { icon: '🧠', label: 'Otak', emptyDesc: 'Mode <b>Otak</b> aktif — buat mikir & bedah masalah. Ketik apa aja di bawah.' },
    koding: { icon: '💻', label: 'Koding', emptyDesc: 'Mode <b>Koding</b> aktif — buat nulis & bedah kode. Ketik apa aja di bawah.' }
  };

  const el = {
    app: document.getElementById('app'),
    menuBtn: document.getElementById('menuBtn'),
    scrim: document.getElementById('sidebarScrim'),
    newChatBtn: document.getElementById('newChatBtn'),
    sessionList: document.getElementById('sessionList'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    modePills: Array.from(document.querySelectorAll('.mode-pill')),
    resetBtn: document.getElementById('resetBtn'),
    chatScroll: document.getElementById('chatScroll'),
    chatInner: document.getElementById('chatInner'),
    emptyState: document.getElementById('emptyState'),
    emptyDesc: document.getElementById('emptyDesc'),
    form: document.getElementById('composerForm'),
    input: document.getElementById('composerInput'),
    sendBtn: document.getElementById('sendBtn'),
    hint: document.getElementById('composerHint')
  };

  let info = { botName: 'Oxxolot', modes: {} };
  let sessions = loadSessions();
  let currentId = sessions.length ? sessions[0].id : createSession('otak');
  let mode = getSession(currentId).mode;
  let sending = false;

  // ---------- persistence ----------
  function loadSessions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  function saveSessions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }
  function getSession(id) { return sessions.find((s) => s.id === id); }
  function createSession(initialMode) {
    const s = { id: crypto.randomUUID(), title: 'Obrolan baru', mode: initialMode, messages: [], createdAt: Date.now() };
    sessions.unshift(s);
    saveSessions();
    return s.id;
  }

  // ---------- init ----------
  fetch('/api/info').then((r) => r.json()).then((data) => {
    info = data;
    document.title = `${info.botName} — AI Dual-Otak`;
    updateHint();
  }).catch(() => {});

  renderSessionList();
  applyMode(mode, { silent: true });
  renderMessages();

  // ---------- sidebar (mobile) ----------
  el.menuBtn.addEventListener('click', () => el.app.classList.add('sidebar-open'));
  el.scrim.addEventListener('click', () => el.app.classList.remove('sidebar-open'));

  // ---------- sessions ----------
  el.newChatBtn.addEventListener('click', () => {
    currentId = createSession(mode);
    renderSessionList();
    renderMessages();
    el.app.classList.remove('sidebar-open');
  });

  el.clearAllBtn.addEventListener('click', () => {
    if (!confirm('Hapus semua riwayat obrolan? Ini gak bisa dibatalin.')) return;
    sessions = [];
    saveSessions();
    currentId = createSession(mode);
    renderSessionList();
    renderMessages();
  });

  function renderSessionList() {
    el.sessionList.innerHTML = '';
    sessions.forEach((s) => {
      const item = document.createElement('div');
      item.className = 's-item session-item' + (s.id === currentId ? ' active' : '');
      item.innerHTML = `
        <span class="s-icon">${MODE_META[s.mode]?.icon ?? '💬'}</span>
        <span class="s-title">${escapeHtml(s.title)}</span>
        <button class="s-del" title="Hapus obrolan ini" aria-label="Hapus obrolan ini">✕</button>
      `;
      item.addEventListener('click', (e) => {
        if (e.target.closest('.s-del')) return;
        currentId = s.id;
        applyMode(s.mode, { silent: true });
        renderSessionList();
        renderMessages();
        el.app.classList.remove('sidebar-open');
      });
      item.querySelector('.s-del').addEventListener('click', () => {
        sessions = sessions.filter((x) => x.id !== s.id);
        if (!sessions.length) currentId = createSession(mode);
        else if (currentId === s.id) currentId = sessions[0].id;
        saveSessions();
        applyMode(getSession(currentId).mode, { silent: true });
        renderSessionList();
        renderMessages();
      });
      el.sessionList.appendChild(item);
    });
  }

  // ---------- mode switch ----------
  el.modePills.forEach((btn) => {
    btn.addEventListener('click', () => applyMode(btn.dataset.mode));
  });

  function applyMode(newMode, opts = {}) {
    mode = newMode;
    const s = getSession(currentId);
    if (s) { s.mode = newMode; saveSessions(); }
    el.modePills.forEach((btn) => btn.setAttribute('aria-selected', String(btn.dataset.mode === newMode)));
    document.documentElement.style.setProperty('--accent', newMode === 'koding' ? 'var(--mint)' : 'var(--cyan)');
    el.emptyDesc.innerHTML = MODE_META[newMode].emptyDesc;
    updateHint();
    if (!opts.silent) renderMessages();
  }

  function updateHint() {
    const m = info.modes?.[mode];
    el.hint.textContent = m ? `Model: ${m.model}` : 'Model: —';
  }

  el.resetBtn.addEventListener('click', () => {
    const s = getSession(currentId);
    if (!s) return;
    if (!s.messages.length) return;
    if (!confirm(`Reset riwayat obrolan ini (mode ${MODE_META[mode].label})?`)) return;
    s.messages = [];
    saveSessions();
    renderMessages();
  });

  // ---------- composer ----------
  el.input.addEventListener('input', () => {
    el.input.style.height = 'auto';
    el.input.style.height = Math.min(el.input.scrollHeight, 160) + 'px';
  });
  el.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      el.form.requestSubmit();
    }
  });

  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = el.input.value.trim();
    if (!text || sending) return;
    el.input.value = '';
    el.input.style.height = 'auto';
    sendMessage(text);
  });

  // ---------- rendering ----------
  function renderMessages() {
    const s = getSession(currentId);
    el.chatInner.innerHTML = '';
    if (!s || !s.messages.length) {
      el.chatInner.appendChild(el.emptyState);
      return;
    }
    s.messages.forEach((m) => el.chatInner.appendChild(renderMessage(m)));
    scrollToBottom();
  }

  const MASCOT_SVG = `
    <svg class="msg-avatar-mascot" viewBox="0 0 100 100" aria-hidden="true">
      <g class="gills gills-left"><ellipse cx="14" cy="38" rx="7" ry="11"/><ellipse cx="14" cy="50" rx="7" ry="11"/><ellipse cx="14" cy="62" rx="7" ry="11"/></g>
      <g class="gills gills-right"><ellipse cx="86" cy="38" rx="7" ry="11"/><ellipse cx="86" cy="50" rx="7" ry="11"/><ellipse cx="86" cy="62" rx="7" ry="11"/></g>
      <ellipse class="head" cx="50" cy="50" rx="26" ry="19"/>
      <circle class="eye" cx="41" cy="47" r="2.6"/><circle class="eye" cx="59" cy="47" r="2.6"/>
    </svg>`;

  function renderMessage(m) {
    const wrap = document.createElement('div');
    wrap.className = `msg ${m.role}`;
    const avatar = m.role === 'user' ? '🙂' : MASCOT_SVG;
    wrap.innerHTML = `
      <div class="msg-avatar">${avatar}</div>
      <div class="msg-body">
        <div class="msg-meta">${m.role === 'user' ? 'Kamu' : info.botName}</div>
        <div class="msg-content"></div>
      </div>
    `;
    const content = wrap.querySelector('.msg-content');
    if (m.role === 'assistant') {
      renderMarkdown(content, m.content || '');
    } else {
      content.textContent = m.content;
      content.style.whiteSpace = 'pre-wrap';
    }
    return wrap;
  }

  function renderMarkdown(container, text) {
    const raw = window.marked ? window.marked.parse(text) : text;
    const clean = window.DOMPurify ? window.DOMPurify.sanitize(raw) : raw;
    container.innerHTML = clean;
    container.querySelectorAll('pre').forEach((pre) => {
      pre.classList.add('code-block');
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = 'Salin';
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(pre.innerText).then(() => {
          btn.textContent = 'Tersalin!';
          setTimeout(() => (btn.textContent = 'Salin'), 1200);
        });
      });
      pre.appendChild(btn);
    });
  }

  function scrollToBottom() {
    requestAnimationFrame(() => { el.chatScroll.scrollTop = el.chatScroll.scrollHeight; });
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- chat send (streaming) ----------
  async function sendMessage(text) {
    const s = getSession(currentId);
    s.messages.push({ role: 'user', content: text });
    if (s.messages.length === 1) s.title = text.slice(0, 40);
    saveSessions();
    renderSessionList();
    renderMessages();

    sending = true;
    el.sendBtn.disabled = true;

    const assistantMsg = { role: 'assistant', content: '' };
    s.messages.push(assistantMsg);
    const bubble = renderMessage(assistantMsg);
    el.chatInner.appendChild(bubble);
    const contentEl = bubble.querySelector('.msg-content');
    const mascotEl = bubble.querySelector('.msg-avatar-mascot');
    mascotEl?.classList.add('is-thinking');
    contentEl.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
    scrollToBottom();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          messages: s.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }))
        })
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') continue;
          try {
            const json = JSON.parse(dataStr);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              if (firstChunk) { contentEl.innerHTML = ''; firstChunk = false; }
              assistantMsg.content += delta;
              renderMarkdown(contentEl, assistantMsg.content);
              scrollToBottom();
            }
          } catch { /* lewati baris SSE yang gak lengkap */ }
        }
      }

      if (!assistantMsg.content) {
        contentEl.innerHTML = '<div class="error-bubble">Gak ada jawaban yang diterima. Coba lagi ya.</div>';
        s.messages.pop();
      }
    } catch (err) {
      contentEl.innerHTML = `<div class="error-bubble">⚠️ ${escapeHtml(err.message || 'Gagal terhubung ke server.')}</div>`;
      s.messages.pop();
    } finally {
      mascotEl?.classList.remove('is-thinking');
      saveSessions();
      renderSessionList();
      sending = false;
      el.sendBtn.disabled = false;
    }
  }

  // ---------- PWA service worker ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
})();
