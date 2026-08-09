const express = require('express');
const path = require('path');

// ---------- Web search (DuckDuckGo HTML, gratis tanpa API key) ----------
async function webSearch(query, limit = 5) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    }
  });
  if (!res.ok) throw new Error(`Pencarian gagal (HTTP ${res.status})`);
  const html = await res.text();

  const results = [];
  const blockRe = /<a rel="nofollow" class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
  const cleanUrl = (raw) => {
    try {
      const u = new URL(raw, 'https://duckduckgo.com');
      const real = u.searchParams.get('uddg');
      return real ? decodeURIComponent(real) : raw;
    } catch { return raw; }
  };

  while ((match = blockRe.exec(html)) && results.length < limit) {
    results.push({
      title: stripTags(match[2]),
      url: cleanUrl(match[1]),
      snippet: stripTags(match[3])
    });
  }
  return results;
}

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Konfigurasi ----------
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENROUTER_API_KEY || '';
const BOT_NAME = process.env.BOT_NAME || 'Oxxolot';

const MODELS = {
  otak: process.env.MODEL_OTAK || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  koding: process.env.MODEL_KODING || 'openai/gpt-oss-20b:free'
};

const SYSTEM_PROMPTS = {
  otak:
    'Kamu adalah Oxxolot, asisten AI yang jago memecahkan masalah kompleks dan bisa menganalisis gambar yang ' +
    'dikirim user (deskripsikan apa yang kamu lihat sebelum menjawab kalau ada gambar). Gaya bicaramu ' +
    'profesional tapi padat — langsung ke inti, tanpa basa-basi pembuka atau penutup generik. ' +
    'Aturan jawab: (1) jawab poin penting duluan, baru detail pendukung kalau perlu, (2) pakai ' +
    'daftar/poin buat hal yang punya banyak bagian, bukan paragraf panjang, (3) kalau ada asumsi ' +
    'yang kamu pakai, sebutkan singkat, (4) hindari mengulang pertanyaan user atau menyimpulkan ' +
    'ulang hal yang sudah jelas dari jawabanmu sendiri. Prioritaskan keringkasan tanpa mengorbankan ' +
    'akurasi — kalau topiknya butuh penjelasan panjang, boleh panjang, tapi jangan panjang karena ' +
    'bertele-tele.',
  koding:
    'Kamu adalah Oxxolot, asisten AI ahli programming senior. Gaya bicaramu profesional, padat, ' +
    'dan hemat kata — fokus ke kode dan solusi, bukan narasi panjang. Aturan jawab: (1) kalau ' +
    'diminta kode, langsung tulis kodenya dengan komentar singkat hanya di bagian yang non-obvious, ' +
    '(2) sertakan validasi/error handling/edge case yang relevan tanpa dijelaskan panjang lebar, ' +
    'cukup lewat kode itu sendiri, (3) sebutkan dependency yang dibutuhkan dalam satu baris singkat, ' +
    '(4) kalau ada pendekatan alternatif yang jauh lebih baik, sebutkan singkat di akhir — jangan ' +
    'jelaskan semua opsi yang ada. Hindari pembukaan seperti "Tentu, berikut adalah..." — langsung ke isi.'
};

// ---------- Rate limit sederhana per-IP (biar API key gak jebol) ----------
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 menit
const RATE_LIMIT_MAX = 12; // maks 12 request / menit / IP
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  entry.count++;
  hits.set(ip, entry);
  return entry.count > RATE_LIMIT_MAX;
}

// Bersihkan map dari waktu ke waktu biar gak bocor memori
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits) {
    if (now > entry.resetAt) hits.delete(ip);
  }
}, 5 * 60 * 1000);

// ---------- Shared chats (in-memory, buat fitur "Bagikan Percakapan") ----------
const sharedChats = new Map(); // id -> { mode, title, messages, createdAt }
const MAX_SHARED = 500;

function generateShareId() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

// ---------- Info publik (buat frontend) ----------
app.get('/api/info', (req, res) => {
  res.json({
    botName: BOT_NAME,
    modes: {
      otak: { label: 'Otak', icon: '🧠', model: MODELS.otak },
      koding: { label: 'Koding', icon: '💻', model: MODELS.koding }
    },
    configured: Boolean(API_KEY)
  });
});

// ---------- Endpoint chat (streaming SSE) ----------
app.post('/api/chat', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  if (!API_KEY) {
    return res.status(500).json({ error: 'Server belum diisi OPENROUTER_API_KEY.' });
  }

  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Kebanyakan request, coba lagi sebentar lagi.' });
  }

  const { mode, messages, browsing } = req.body || {};
  if (!MODELS[mode] || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Request tidak valid.' });
  }

  const payloadMessages = [
    { role: 'system', content: SYSTEM_PROMPTS[mode] }
  ];

  if (browsing) {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const queryText = typeof lastUser?.content === 'string'
      ? lastUser.content
      : Array.isArray(lastUser?.content)
        ? lastUser.content.find((c) => c.type === 'text')?.text
        : null;
    if (queryText) {
      try {
        const results = await webSearch(queryText);
        if (results.length) {
          const context = results
            .map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\nSumber: ${r.url}`)
            .join('\n\n');
          payloadMessages.push({
            role: 'system',
            content:
              `Hasil pencarian web terkini untuk pertanyaan user (query: "${queryText}"):\n\n${context}\n\n` +
              'Gunakan informasi di atas untuk menjawab secara akurat dan terkini. Sebutkan sumber secara singkat ' +
              'kalau relevan. Kalau hasil pencarian tidak relevan atau tidak cukup, katakan itu dengan jujur.'
          });
        }
      } catch (err) {
        payloadMessages.push({
          role: 'system',
          content: `Catatan: pencarian web gagal dilakukan (${err.message}). Jawab semampunya tanpa info terkini, dan beri tahu user kalau info yang kamu berikan mungkin bukan yang terbaru.`
        });
      }
    }
  }

  payloadMessages.push(...messages.slice(-30)); // batasi konteks biar hemat token

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://oxxolot.app',
        'X-Title': BOT_NAME
      },
      body: JSON.stringify({
        model: MODELS[mode],
        messages: payloadMessages,
        stream: true
      })
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => '');
      return res.status(upstream.status).json({ error: `OpenRouter error: ${errText || upstream.statusText}` });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: `Gagal konek ke OpenRouter: ${err.message}` });
    } else {
      res.end();
    }
  }
});

// ---------- Endpoint: buat link share ----------
app.post('/api/share', (req, res) => {
  const { mode, title, messages } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'Belum ada percakapan untuk dibagikan.' });
  }
  const safeMessages = messages
    .slice(-50)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));

  if (!safeMessages.length) {
    return res.status(400).json({ error: 'Belum ada percakapan untuk dibagikan.' });
  }

  if (sharedChats.size >= MAX_SHARED) {
    const oldestKey = sharedChats.keys().next().value;
    sharedChats.delete(oldestKey);
  }

  const id = generateShareId();
  sharedChats.set(id, {
    mode: MODELS[mode] ? mode : 'otak',
    title: (title || 'Percakapan Oxxolot').slice(0, 80),
    messages: safeMessages,
    createdAt: Date.now()
  });
  res.json({ id });
});

app.get('/api/share/:id', (req, res) => {
  const data = sharedChats.get(req.params.id);
  if (!data) return res.status(404).json({ error: 'Percakapan tidak ditemukan atau sudah kadaluarsa.' });
  res.json({ ...data, botName: BOT_NAME });
});

app.get('/share/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'share.html'));
});

app.listen(PORT, () => {
  console.log(`${BOT_NAME} jalan di port ${PORT}`);
});
