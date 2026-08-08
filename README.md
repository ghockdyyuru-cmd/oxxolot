# Oxxolot 🩷

AI chat dual-otak (**Otak** 🧠 buat mikir, **Koding** 💻 buat ngoding) — sekarang jadi **web app** yang bisa di-install kayak aplikasi (PWA) dan diakses siapa aja lewat internet.

Ini versi upgrade dari script CLI Termux kamu. Bedanya:

| | CLI lama | Oxxolot web |
|---|---|---|
| Tampilan | teks terminal | UI chat penuh, bubble, markdown, syntax highlight |
| Akses | cuma di 1 HP kamu | link, bisa dibuka & di-install siapa aja |
| Riwayat | 1 sesi per mode | banyak sesi tersimpan, kayak ChatGPT |
| Jawaban | ngetik efek lambat | streaming asli (nyicil kayak ChatGPT) |
| API key | ketik manual di config | disimpan aman di server, gak keliatan user |

## Fitur

- 🧠 / 💻 dua mode AI, bisa ganti kapan aja
- Multi-obrolan tersimpan di HP masing-masing user (localStorage)
- Streaming jawaban real-time
- Render markdown + syntax highlight kode + tombol "Salin"
- Bisa di-**install sebagai app** (PWA) — ada icon axolotl di homescreen
- Rate limit bawaan biar API key kamu gak jebol kalau rame
- Desain aquatic gelap dengan maskot axolotl

## Struktur file

```
oxxolot/
├── server.js              # backend Express + proxy streaming ke OpenRouter
├── package.json
├── .env.example            # contoh environment variable
└── public/
    ├── index.html
    ├── style.css
    ├── app.js
    ├── manifest.json        # config PWA
    ├── sw.js                 # service worker (offline shell)
    └── icon-*.png            # ikon maskot axolotl
```

## 1. Coba dulu di Termux (opsional)

```bash
cd ~/oxxolot
pkg install nodejs -y
npm install
cp .env.example .env
nano .env      # isi OPENROUTER_API_KEY punya kamu
node server.js
```
Buka `http://localhost:3000` di browser HP kamu.

## 2. Deploy online (biar bisa diakses & didownload siapa aja)

Kamu butuh akun **GitHub** dulu (gratis) buat naruh kodenya, baru dihubungkan ke Render/Railway.

### Upload ke GitHub lewat Termux
```bash
pkg install git -y
cd ~/oxxolot
git init
git add .
git commit -m "Oxxolot web app"
```
Buat repo baru (kosong) di https://github.com/new, lalu:
```bash
git remote add origin https://github.com/USERNAME/oxxolot.git
git branch -M main
git push -u origin main
```

### Deploy ke Render (rekomendasi, gratis)
1. Buka https://render.com → daftar/login pakai akun GitHub.
2. **New +** → **Web Service** → pilih repo `oxxolot`.
3. Isi:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Di bagian **Environment Variables**, tambahkan:
   - `OPENROUTER_API_KEY` = API key kamu dari https://openrouter.ai/keys
   - `BOT_NAME` = `Oxxolot` (bebas)
5. Klik **Create Web Service**. Tunggu build selesai → kamu dapat link publik, contoh `https://oxxolot.onrender.com`.

> Catatan: paket gratis Render bisa "tidur" kalau gak ada yang akses beberapa menit, jadi request pertama kadang agak lambat (± 30 detik) buat bangunin lagi. Ini normal buat tier gratis.

### Alternatif: Railway
1. https://railway.app → login GitHub → **New Project** → **Deploy from GitHub repo**.
2. Tambahkan environment variable yang sama seperti di atas (`OPENROUTER_API_KEY`, `BOT_NAME`).
3. Railway otomatis deteksi `npm start` dan kasih kamu URL publik.

## 3. Install sebagai aplikasi (PWA)

Setelah link online-nya jadi, buka link itu di HP (Chrome/Safari):
- **Android (Chrome)**: menu titik tiga → **Install app** / **Tambahkan ke layar utama**.
- **iPhone (Safari)**: tombol Share → **Add to Home Screen**.

Nanti muncul icon axolotl di homescreen, buka full-screen kayak app asli — link itulah yang bisa kamu share ke siapa aja buat mereka install juga.

## Soal API key & biaya

Kamu pilih pakai 1 API key OpenRouter buat semua orang yang pakai Oxxolot. Beberapa hal penting:
- Server sudah dikasih **rate limit** (default 12 pesan/menit per pengguna) biar gak gampang jebol kalau tiba-tiba rame.
- Model default (`:free`) di OpenRouter punya limit rate dari OpenRouter sendiri juga — kalau kena limit, ganti model di environment variable `MODEL_OTAK` / `MODEL_KODING` (cek daftar model gratis terbaru di https://openrouter.ai/collections/free-models).
- Kalau suatu saat mau ganti supaya tiap user isi API key sendiri-sendiri (lebih aman & gak dibatasi kamu doang), tinggal bilang — strukturnya gampang diubah ke arah situ.

## Kustomisasi cepat

- **Ganti nama bot**: env var `BOT_NAME`.
- **Ganti model**: env var `MODEL_OTAK` / `MODEL_KODING`.
- **Ganti system prompt / kepribadian**: edit `SYSTEM_PROMPTS` di `server.js`.
- **Ganti warna & maskot**: edit variabel warna di `public/style.css` (bagian `:root`).

## Lain kali mau nambah fitur lagi?

Beberapa fitur lanjutan yang bisa ditambah kalau mau (tinggal bilang aja mau yang mana):
- Upload gambar/file ke AI
- Voice input (ngomong, bukan ngetik)
- Login akun biar tiap user isi API key sendiri
- Custom persona/karakter bot
