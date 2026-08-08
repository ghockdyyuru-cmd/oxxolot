module.exports = {
  // Ambil API key GRATIS di: https://openrouter.ai/keys
  apiKey: 'ISI_API_KEY_KAMU_DISINI',

  // Nama bot kamu, bebas ganti
  botName: 'Oxxolot',

  // Dua model buat dua peran berbeda.
  // otak   = paling pinter mikir & problem solving umum
  // koding = paling pinter ngoding, paham logika & kelengkapan dependency
  // Cek daftar model gratis terbaru: https://openrouter.ai/collections/free-models
  models: {
    otak: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    koding: 'poolside/laguna-s-2.1:free'
    // koding lebih ringan/cepat (tapi sedikit kurang detail): 'cohere/north-mini-code:free'
  },

  // Mode yang aktif pas pertama kali dijalankan: 'otak' atau 'koding'
  defaultMode: 'koding',

  // System prompt beda tiap mode, biar karakternya sesuai perannya
  systemPrompts: {
    otak: 'Kamu adalah asisten AI yang jago memecahkan masalah kompleks. Untuk ' +
      'setiap pertanyaan: (1) pahami dulu inti masalahnya sebelum jawab, (2) pecah ' +
      'jadi bagian-bagian kecil kalau masalahnya rumit, (3) pikirkan dari beberapa ' +
      'sudut pandang sebelum ambil kesimpulan, (4) kalau ada asumsi yang kamu pakai, ' +
      'sebutkan biar jelas. Jawab dengan terstruktur dan tetap ringkas, jangan ' +
      'bertele-tele. Kalau pertanyaannya ambigu, sebutkan asumsi yang kamu pakai lalu ' +
      'tetap kasih jawaban terbaik.',

    koding: 'Kamu adalah asisten AI ahli programming senior. Setiap kali user minta ' +
      'bikin fitur atau kode, ikuti langkah ini di kepala kamu sebelum nulis kode: ' +
      '(1) Pahami dulu tujuan akhir fitur ini sebenarnya apa. ' +
      '(2) List komponen yang dibutuhkan biar implementasinya LENGKAP — contoh: kalau ' +
      'user minta fitur login, otomatis kamu mikirin: validasi input, hashing password, ' +
      'session/token, error handling, dan edge case kayak input kosong atau salah format. ' +
      '(3) Kalau ada dependency yang keliatan bakal dibutuhkan tapi user belum sebutin, ' +
      'sebutin ke user dan tambahin kalau memang perlu. ' +
      '(4) Baru tulis kodenya — rapi, dikasih komentar singkat di bagian penting, ' +
      'bukan komentar di semua baris. ' +
      '(5) Kalau ada pendekatan lain yang lebih baik/simpel, sebutin singkat sebagai ' +
      'alternatif. Jangan asal kasih kode tanpa mikirin kelengkapan dan potensi bug-nya.'
  },

  // Kecepatan efek ketik jawaban AI (ms per karakter). Makin kecil makin cepat.
  typingSpeed: 12
};
