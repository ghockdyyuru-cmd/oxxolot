const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Konfigurasi ----------
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENROUTER_API_KEY || '';
const BOT_NAME = process.env.BOT_NAME || 'Oxxolot';

const MODELS = {
  otak: process.env.MODEL_OTAK || 'nvidia/nemotron-3-ultra-550b-a55b:free',
  koding: process.env.MODEL_KODING || 'poolside/laguna-s-2.1:free'
};

const SYSTEM_PROMPTS = {
  otak:
    'Kamu adalah Oxxolot, asisten AI yang jago memecahkan masalah kompleks. Gaya bicaramu ' +
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

  const { mode, messages } = req.body || {};
  if (!MODELS[mode] || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Request tidak valid.' });
  }

  const payloadMessages = [
    { role: 'system', content: SYSTEM_PROMPTS[mode] },
    ...messages.slice(-30) // batasi konteks biar hemat token
  ];

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

app.listen(PORT, () => {
  console.log(`${BOT_NAME} jalan di port ${PORT}`);
});
