# Presensi & Pendampingan Ekstrakurikuler — SMPI Al Azhar 51 IIBS Karanganyar

Situs statis (GitHub Pages) dengan Google Apps Script sebagai jembatan ke spreadsheet sekolah.
Spreadsheet tetap menjadi tempat data tersimpan; situs hanya jendela untuk mengisi dan memantau.

```
Pembina  →  GitHub Pages (index.html + app.js)
                     ↓  HTTPS
            Apps Script Web App  (Code.gs)
                     ↓
        DB Presensi Ekskul  (Google Sheets — basis data)
                     ↓  sinkron berkala
        Dua spreadsheet lama (grid bulanan — cadangan)
```

## Isi repo

| Berkas | Guna |
| --- | --- |
| `index.html` | Kerangka halaman, gaya, dan konfigurasi API |
| `app.js` | Seluruh logika: presensi, catatan pendampingan, pantauan, profil murid |
| `data/seed.json` | Data awal hasil impor dua spreadsheet lama — dipakai sekali oleh `setup()` |
| `Code.gs` | Kode Apps Script (disalin ke editor, bukan dijalankan dari sini) |

## Pemasangan

### 1. Unggah repo dan nyalakan Pages

Buat repo `ekskulSMPIA51` di organisasi GitHub AAIIBS, unggah isi folder ini, lalu
**Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
Alamatnya akan menjadi `https://aaiibs.github.io/ekskulSMPIA51/`.

Pastikan `data/seed.json` bisa dibuka di `https://aaiibs.github.io/ekskulSMPIA51/data/seed.json`
sebelum melangkah ke nomor 3.

### 2. Buat spreadsheet basis data

Google Sheets baru, beri nama **DB Presensi Ekskul JHS 51 IIBS**.
Lalu **Ekstensi → Apps Script**, hapus isi `Code.gs` bawaan, tempel seluruh `Code.gs` dari repo ini.

Di bagian `KONFIG` paling atas, ganti `TOKEN` dengan teks acak buatan sendiri
(misalnya hasil acak 24 karakter). Nilai yang sama nanti dipakai di `index.html`.

`SEED_URL` dan dua `ID_SHEET_LAMA_*` sudah terisi — keduanya menunjuk ke hasil konversi
spreadsheet lama ke format Google Sheets.

### 3. Jalankan setup

Di editor Apps Script, pilih fungsi `setup`, tekan **Run**, dan izinkan akses saat diminta.
Sekali jalan ini membuat empat tab (`MURID`, `KELOMPOK`, `SESI`, `PRESENSI`)
dan mengisinya dari `seed.json`: 273 murid, 25 kelompok, 46 pertemuan, 741 baris presensi.

Aman diulang — baris yang sudah ada ditimpa berdasarkan id, tidak digandakan.

### 4. Deploy sebagai Web app

**Deploy → New deployment → Web app**

- Description: `API presensi ekskul`
- Execute as: **Me**
- Who has access: **Anyone**

Salin URL yang berakhiran `/exec`.

> "Anyone" di sini berarti siapa pun yang tahu URL **dan** token bisa memanggil API.
> Itu sebabnya token wajib diganti dan tidak disebar di luar tim.

### 5. Sambungkan situs ke backend

Buka `index.html`, isi dua baris di blok `CONFIG`:

```js
const CONFIG = {
  API_URL:   "https://script.google.com/macros/s/..../exec",
  API_TOKEN: "token-yang-sama-dengan-Code.gs"
};
```

Commit, tunggu Pages menerbitkan ulang, lalu buka situsnya.

## Pemakaian harian

- **Presensi** — pilih program → kelompok/kelas → pertemuan, ketuk H/I/S/A tiap murid.
  Kolom di bawah nama untuk catatan pendampingan per anak; di bagian bawah halaman ada
  catatan pertemuan (pembina, materi, kendala, tindak lanjut). Tersimpan otomatis.
- **Pantauan** — saring menurut program, bulan, kelas, jenis ekskul, status, atau nama.
  Tombol Unduh CSV mengambil hasil saringan apa adanya.
- **Murid** — profil tiap anak: ekskul yang diikuti, persentase hadir, riwayat, catatan.

Halaman menyegarkan datanya sendiri tiap satu menit, jadi dua pembina yang mengisi
bersamaan akan saling melihat hasilnya.

## Menjaga spreadsheet lama tetap terisi

Di spreadsheet basis data muncul menu **Ekskul → Sinkron ke spreadsheet lama**.
Fungsi itu menyalin status presensi ke grid bulanan di kedua file lama, pada kolom
yang sesuai tanggalnya, tanpa menyentuh judul atau daftar nama.

Agar berjalan sendiri, pasang pemicu: di editor Apps Script, **Triggers → Add trigger**
→ fungsi `sinkronKeFormatLama`, sumber `Time-driven`, `Day timer`, jam 10–11 malam.

Satu batas yang perlu diketahui: tiap bulan hanya tersedia lima kolom di grid lama.
Pertemuan keenam dalam satu bulan tidak punya tempat dan akan dilaporkan sebagai
terlewat saat sinkron — tambahkan kolom di sheet lama bila itu terjadi.

## Keamanan

- Ganti `TOKEN` sebelum dipakai, dan jangan menaruhnya di repo publik.
  Kalau repo AAIIBS bersifat publik, token ikut terbaca siapa pun — buat repo privat,
  atau terima bahwa siapa pun yang membuka situs bisa menulis presensi.
- Setelan berbagi kedua spreadsheet saat ini "siapa pun yang punya link bisa mengedit".
  Sebaiknya diubah menjadi berbagi ke orang per orang: pembina dan tim Kesiswaan.
