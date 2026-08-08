const readline = require('readline');
const config = require('./config-oxxolot');

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

const apiKey = (config.apiKey || '').trim();

if (!apiKey || apiKey.includes('ISI_API_KEY')) {
  console.log(`${c.red}⚠️  Kamu belum isi API key di config-oxxolot.js (atau kosong/spasi doang)!${c.reset}`);
  console.log(`   Ambil gratis di: ${c.cyan}https://openrouter.ai/keys${c.reset}\n`);
  process.exit(1);
}

function maskedKey(key) {
  if (key.length <= 8) return '*'.repeat(key.length);
  return `${key.slice(0, 6)}...${key.slice(-4)} (${key.length} karakter)`;
}

const MODE_INFO = {
  otak: { label: 'OTAK', icon: '🧠', color: c.cyan },
  koding: { label: 'KODING', icon: '💻', color: c.green }
};

let currentMode = config.defaultMode === 'otak' ? 'otak' : 'koding';

// Riwayat obrolan dipisah per mode biar konteksnya gak campur
const histories = {
  otak: [{ role: 'system', content: config.systemPrompts.otak }],
  koding: [{ role: 'system', content: config.systemPrompts.koding }]
};

// ---------- tampilan ----------
function banner() {
  const title = ` ${config.botName} `;
  const width = Math.max(title.length + 2, 30);
  const pad = Math.floor((width - title.length) / 2);
  const line = '═'.repeat(width);
  console.clear();
  console.log(`${c.magenta}╔${line}╗${c.reset}`);
  console.log(`${c.magenta}║${c.reset}${' '.repeat(pad)}${c.bold}${c.cyan}${title}${c.reset}${' '.repeat(width - pad - title.length)}${c.magenta}║${c.reset}`);
  console.log(`${c.magenta}╚${line}╝${c.reset}`);
  console.log(`${c.gray}"otak" / "koding" ganti mode • "reset" hapus riwayat • "help" bantuan • "exit" keluar${c.reset}`);
  console.log(`${c.gray}API key terbaca: ${maskedKey(apiKey)}${c.reset}\n`);
  printModeStatus();
}

function printModeStatus() {
  const m = MODE_INFO[currentMode];
  console.log(`${m.color}${m.icon} Mode aktif: ${c.bold}${m.label}${c.reset}${m.color} — model: ${config.models[currentMode]}${c.reset}\n`);
}

function promptLabel() {
  const m = MODE_INFO[currentMode];
  return `${c.bold}Kamu${c.reset} ${m.color}[${m.label}]${c.reset} ${c.gray}›${c.reset} `;
}

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
function startSpinner() {
  let i = 0;
  return setInterval(() => {
    process.stdout.write(`\r${c.cyan}${spinnerFrames[i]}${c.reset} ${c.dim}mengetik...${c.reset}`);
    i = (i + 1) % spinnerFrames.length;
  }, 80);
}
function stopSpinner(id) {
  clearInterval(id);
  process.stdout.write('\r' + ' '.repeat(30) + '\r');
}

function typeText(text, delay = 12) {
  return new Promise((resolve) => {
    let i = 0;
    const id = setInterval(() => {
      process.stdout.write(text[i] ?? '');
      i++;
      if (i >= text.length) {
        clearInterval(id);
        process.stdout.write('\n');
        resolve();
      }
    }, delay);
  });
}

function timestamp() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

// ---------- logic AI ----------
async function askAI(message) {
  const history = histories[currentMode];
  const model = config.models[currentMode];
  history.push({ role: 'user', content: message });

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://termux.local',
        'X-Title': config.botName
      },
      body: JSON.stringify({ model, messages: history })
    });

    const data = await res.json();

    if (data.error) {
      console.log(`\n${c.red}[Error] ${data.error.message || JSON.stringify(data.error)}${c.reset}`);
      if (/authentication|api key|unauthorized/i.test(data.error.message || '')) {
        console.log(`${c.yellow}→ Cek lagi apiKey di config-oxxolot.js, pastikan gak ada spasi nyasar/kepotong.${c.reset}`);
      }
      history.pop();
      return null;
    }

    const reply = data.choices?.[0]?.message?.content;
    if (reply) history.push({ role: 'assistant', content: reply });
    return reply;
  } catch (err) {
    console.log(`\n${c.red}[Gagal konek ke OpenRouter] ${err.message}${c.reset}`);
    history.pop();
    return null;
  }
}

// ---------- chat loop ----------
banner();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: promptLabel()
});

rl.prompt();

let isProcessing = false;

rl.on('line', async (line) => {
  const text = line.trim();
  const lower = text.toLowerCase();

  if (!text) return rl.prompt();

  // abaikan input tambahan yang numpuk selagi jawaban sebelumnya masih diproses
  if (isProcessing) return;

  if (['exit', 'keluar', 'quit'].includes(lower)) {
    console.log(`${c.gray}Sampai jumpa!${c.reset}`);
    rl.close();
    return;
  }

  if (lower === 'otak' || lower === 'koding') {
    currentMode = lower;
    console.log('');
    printModeStatus();
    rl.setPrompt(promptLabel());
    return rl.prompt();
  }

  if (lower === 'reset') {
    histories[currentMode] = [{ role: 'system', content: config.systemPrompts[currentMode] }];
    console.log(`${c.yellow}↺ Riwayat mode ${MODE_INFO[currentMode].label} direset${c.reset}\n`);
    return rl.prompt();
  }

  if (lower === 'help') {
    console.log(`${c.gray}reset  → hapus riwayat chat mode yang aktif`);
    console.log(`otak   → pindah ke mode reasoning/problem-solving`);
    console.log(`koding → pindah ke mode coding specialist`);
    console.log(`exit   → keluar dari program`);
    console.log(`help   → tampilkan pesan ini${c.reset}\n`);
    return rl.prompt();
  }

  isProcessing = true;
  console.log(`${c.dim}⏳ Diproses... (jangan ketik dulu sampai jawaban ini selesai)${c.reset}`);
  rl.pause();
  const spinner = startSpinner();
  const reply = await askAI(text);
  stopSpinner(spinner);

  if (reply) {
    const m = MODE_INFO[currentMode];
    process.stdout.write(`${m.color}${c.bold}${config.botName}${c.reset} ${c.gray}[${timestamp()}] [${m.label}]${c.reset} ${c.gray}›${c.reset} ${c.green}`);

    const LONG_REPLY_THRESHOLD = 400; // karakter — di atas ini, animasi di-skip biar gak nambah lama
    if (reply.length > LONG_REPLY_THRESHOLD) {
      process.stdout.write(reply);
    } else {
      await typeText(reply, config.typingSpeed ?? 12);
    }
    process.stdout.write(c.reset + '\n');
  }

  rl.resume();
  isProcessing = false;
  rl.prompt();
});

rl.on('close', () => {
  console.log(`${c.gray}Bye!${c.reset}`);
  process.exit(0);
});
