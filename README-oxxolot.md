# Oxxolot

Oxxolot — AI chat CLI standalone buat Termux, dual-model (mode otak & koding). Nggak nyangkut ke project lain.

## Setup (setelah download file dari chat)

File yang kamu download biasanya masuk ke folder `Download` HP kamu. Jalankan ini di Termux:

```
termux-setup-storage
```
(izinkan akses storage kalau muncul pop-up)

```
mkdir -p ~/oxxolot
cd ~/oxxolot
cp /sdcard/Download/index-oxxolot.js .
cp /sdcard/Download/config-oxxolot.js .
cp /sdcard/Download/package-oxxolot.json .
cp /sdcard/Download/README-oxxolot.md .
```

Install/update Node.js (butuh Node 18+ karena pakai `fetch` bawaan):
```
pkg update && pkg install nodejs -y
node -v
```

Edit config, isi API key & identitas bot:
```
nano config-oxxolot.js
```
Isi `apiKey`, `botName`, `systemPrompt` sesuai mau kamu → simpan pakai `CTRL+O`, Enter, keluar `CTRL+X`.

Jalankan:
```
node index-oxxolot.js
```

Lain kali tinggal:
```
cd ~/oxxolot && node index-oxxolot.js
```

## Dua mode AI

Script ini punya 2 model sekaligus, tinggal ganti pas lagi chat:

- **otak** 🧠 — model paling pinter buat mikir & pecahin masalah umum
- **koding** 💻 — model paling pinter ngoding, mikirin kelengkapan & dependency kode

Ketik `otak` atau `koding` kapan aja di chat buat pindah mode. Riwayat obrolan tiap mode kepisah sendiri-sendiri, jadi konteksnya gak ketuker.

## Perintah pas chat
- Ketik pesan biasa → dijawab AI sesuai mode aktif
- `otak` → pindah ke mode reasoning/problem-solving
- `koding` → pindah ke mode coding specialist
- `reset` → hapus riwayat chat mode yang aktif
- `exit` atau `keluar` → berhenti

## Catatan
- Model `:free` di OpenRouter ada limit rate, kalau kena limit tinggal ganti model lain di `config-oxxolot.js`.
- Kalau nanti mau ganti-ganti model atau nyambungin ke project lain, bilang aja.
