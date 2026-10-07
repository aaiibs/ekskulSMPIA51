/**
 * Backend presensi & pendampingan ekstrakurikuler
 * SMP Islam Al Azhar 51 IIBS Karanganyar — T.A. 2026/2027
 *
 * Spreadsheet ini adalah basis data utama. Spreadsheet lama (format grid bulanan)
 * tetap menjadi cadangan dan diisi ulang oleh fungsi sinkronKeFormatLama().
 *
 * Cara pasang:
 *  1. Buat Google Sheets baru, beri nama "DB Presensi Ekskul JHS 51 IIBS".
 *  2. Ekstensi -> Apps Script, tempel seluruh berkas ini.
 *  3. Isi KONFIG di bawah.
 *  4. Jalankan setup() sekali (Izinkan akses saat diminta).
 *  5. Deploy -> New deployment -> Web app
 *       Execute as     : Me
 *       Who has access : Anyone
 *     Salin URL /exec, tempel ke API_URL di berkas app.js situs.
 */

const KONFIG = {
  // Kata sandi bersama antara situs dan backend. GANTI dengan teks acak Anda sendiri,
  // lalu salin nilai yang sama ke API_TOKEN di app.js.
  TOKEN: 'ganti-dengan-kata-sandi-acak-anda',

  // URL berkas seed.json di GitHub Pages, dipakai sekali saja oleh setup().
  // Contoh: https://aaiibs.github.io/ekskul/data/seed.json
  SEED_URL: 'https://aaiibs.github.io/ekskul/data/seed.json',

  // ID spreadsheet lama SETELAH dikonversi ke Google Sheets (bukan .xlsx).
  // Dipakai oleh sinkronKeFormatLama(). Kosongkan kalau belum siap.
  ID_SHEET_LAMA_HARIAN: '1uO_ZNmGRzpyU94O8Zh0tcDhedc9K9ajA9H9mh0BFHFE',
  ID_SHEET_LAMA_SABTU:  '1fsJ4M3HwI98sQZEqWYyH9tHWQQ2djUIs0vglFVdeU2Y'
};

const TAB = { MURID: 'MURID', KELOMPOK: 'KELOMPOK', SESI: 'SESI', PRESENSI: 'PRESENSI' };

const KOLOM = {
  MURID:    ['id', 'nama', 'kelas', 'tingkat', 'gender'],
  KELOMPOK: ['id', 'program', 'judul', 'ekskul', 'kelas', 'gender', 'jadwal', 'anggota'],
  SESI:     ['id', 'groupId', 'program', 'ekskul', 'bulan', 'urut', 'tanggal', 'label',
             'pembina', 'materi', 'kendala', 'tindakLanjut', 'sumber', 'diperbarui'],
  PRESENSI: ['kunci', 'sesiId', 'muridId', 'status', 'catatan', 'diperbarui', 'oleh']
};

/* ------------------------------------------------------------------ utilitas */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function tab_(nama) {
  const s = ss_().getSheetByName(nama);
  if (!s) throw new Error('Tab "' + nama + '" belum ada. Jalankan setup() dulu.');
  return s;
}

/** Seluruh isi satu tab sebagai array objek. */
function baca_(nama) {
  const sheet = tab_(nama);
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const kolom = KOLOM[nama];
  const nilai = sheet.getRange(2, 1, last - 1, kolom.length).getValues();
  return nilai
    .filter(function (r) { return String(r[0]).trim() !== ''; })
    .map(function (r) {
      const o = {};
      kolom.forEach(function (k, i) { o[k] = r[i]; });
      return o;
    });
}

/** Peta id baris -> nomor baris, untuk upsert tanpa memindai ulang. */
function indeks_(nama) {
  const sheet = tab_(nama);
  const last = sheet.getLastRow();
  const peta = {};
  if (last < 2) return peta;
  const kunci = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < kunci.length; i++) {
    const k = String(kunci[i][0]).trim();
    if (k) peta[k] = i + 2;
  }
  return peta;
}

function barisDari_(nama, obj) {
  return KOLOM[nama].map(function (k) { return obj[k] == null ? '' : obj[k]; });
}

/** Tulis banyak baris sekaligus: yang sudah ada ditimpa, yang baru ditambahkan. */
function upsert_(nama, daftar) {
  if (!daftar.length) return 0;
  const sheet = tab_(nama);
  const peta = indeks_(nama);
  const baru = [];
  daftar.forEach(function (obj) {
    const kunci = String(obj[KOLOM[nama][0]]);
    const baris = barisDari_(nama, obj);
    if (peta[kunci]) {
      sheet.getRange(peta[kunci], 1, 1, baris.length).setValues([baris]);
    } else {
      baru.push(baris);
    }
  });
  if (baru.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, baru.length, KOLOM[nama].length).setValues(baru);
  }
  return daftar.length;
}

function tanggalJakarta_() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', "yyyy-MM-dd'T'HH:mm:ss");
}

function jawab_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ setup */

/**
 * Jalankan sekali dari editor Apps Script.
 * Membuat keempat tab dan mengisinya dari seed.json (data hasil impor dua spreadsheet lama).
 * Aman diulang: data yang sudah ada ditimpa berdasarkan id, tidak digandakan.
 */
function setup() {
  const buku = ss_();

  Object.keys(TAB).forEach(function (k) {
    const nama = TAB[k];
    var sheet = buku.getSheetByName(nama);
    if (!sheet) sheet = buku.insertSheet(nama);
    sheet.getRange(1, 1, 1, KOLOM[nama].length).setValues([KOLOM[nama]])
         .setFontWeight('bold').setBackground('#E8F3FB');
    sheet.setFrozenRows(1);
  });

  const kosong = buku.getSheetByName('Sheet1') || buku.getSheetByName('Sheet 1');
  if (kosong && buku.getSheets().length > 4) buku.deleteSheet(kosong);

  const res = UrlFetchApp.fetch(KONFIG.SEED_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('Gagal mengambil seed.json (' + res.getResponseCode() + '). Periksa SEED_URL.');
  }
  const seed = JSON.parse(res.getContentText());

  upsert_(TAB.MURID, seed.murid);

  upsert_(TAB.KELOMPOK, seed.kelompok.map(function (g) {
    return {
      id: g.id, program: g.program, judul: g.judul, ekskul: g.ekskul,
      kelas: g.kelas || '', gender: g.gender, jadwal: g.jadwal,
      anggota: (g.anggota || []).join(',')
    };
  }));

  upsert_(TAB.SESI, seed.sesi.map(function (s) {
    return {
      id: s.id, groupId: s.groupId, program: s.program, ekskul: s.ekskul,
      bulan: s.bulan, urut: s.urut, tanggal: s.tanggal || '', label: s.label,
      pembina: '', materi: '', kendala: '', tindakLanjut: '',
      sumber: s.sumber, diperbarui: tanggalJakarta_()
    };
  }));

  upsert_(TAB.PRESENSI, seed.presensi.map(function (p) {
    return {
      kunci: p.sesiId + '|' + p.muridId, sesiId: p.sesiId, muridId: p.muridId,
      status: p.status, catatan: '', diperbarui: tanggalJakarta_(), oleh: 'impor-spreadsheet'
    };
  }));

  SpreadsheetApp.getActive().toast('Setup selesai: ' + seed.murid.length + ' murid, ' +
    seed.sesi.length + ' pertemuan, ' + seed.presensi.length + ' presensi.', 'Siap', 8);
}

/* ------------------------------------------------------------------ API */

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.token !== KONFIG.TOKEN) return jawab_({ ok: false, pesan: 'Token tidak cocok' });
    if (p.action === 'ping') return jawab_({ ok: true, waktu: tanggalJakarta_() });
    return jawab_({ ok: true, data: semuaData_() });
  } catch (err) {
    return jawab_({ ok: false, pesan: String(err) });
  }
}

/**
 * Situs mengirim POST dengan Content-Type text/plain supaya tidak memicu preflight CORS.
 * Isi badan: {"token":"...","action":"...","payload":{...}}
 */
function doPost(e) {
  const kunci = LockService.getScriptLock();
  try {
    kunci.waitLock(20000);
    const req = JSON.parse(e.postData.contents);
    if (req.token !== KONFIG.TOKEN) return jawab_({ ok: false, pesan: 'Token tidak cocok' });

    switch (req.action) {
      case 'data':           return jawab_({ ok: true, data: semuaData_() });
      case 'simpanPresensi': return jawab_(simpanPresensi_(req.payload));
      case 'simpanSesi':     return jawab_(simpanSesi_(req.payload));
      case 'hapusSesi':      return jawab_(hapusSesi_(req.payload));
      case 'sinkronLama':    return jawab_({ ok: true, hasil: sinkronKeFormatLama() });
      default:               return jawab_({ ok: false, pesan: 'Aksi tidak dikenal: ' + req.action });
    }
  } catch (err) {
    return jawab_({ ok: false, pesan: String(err) });
  } finally {
    try { kunci.releaseLock(); } catch (x) {}
  }
}

function semuaData_() {
  const kelompok = baca_(TAB.KELOMPOK).map(function (g) {
    g.anggota = String(g.anggota || '').split(',').filter(Boolean);
    return g;
  });
  const sesi = baca_(TAB.SESI).map(function (s) {
    if (s.tanggal instanceof Date) {
      s.tanggal = Utilities.formatDate(s.tanggal, 'Asia/Jakarta', 'yyyy-MM-dd');
    }
    s.tanggal = s.tanggal ? String(s.tanggal) : null;
    s.bulan = Number(s.bulan) || null;
    s.urut = Number(s.urut) || 1;
    return s;
  });
  return {
    sekolah: 'SMP Islam Al Azhar 51 IIBS Karanganyar',
    tahunAjaran: '2026/2027',
    ekskulSabtu: ['Berkuda', 'Memanah', 'Berenang', 'Literasi', 'ASBD'],
    murid: baca_(TAB.MURID),
    kelompok: kelompok,
    sesi: sesi,
    presensi: baca_(TAB.PRESENSI),
    diambil: tanggalJakarta_()
  };
}

/** payload: {sesiId, oleh, entri:[{muridId,status,catatan}]} */
function simpanPresensi_(payload) {
  const waktu = tanggalJakarta_();
  const baris = (payload.entri || []).map(function (en) {
    return {
      kunci: payload.sesiId + '|' + en.muridId,
      sesiId: payload.sesiId,
      muridId: en.muridId,
      status: en.status || '',
      catatan: en.catatan || '',
      diperbarui: waktu,
      oleh: payload.oleh || ''
    };
  });
  upsert_(TAB.PRESENSI, baris);
  return { ok: true, tersimpan: baris.length, waktu: waktu };
}

/** payload: objek sesi lengkap atau sebagian (id wajib) */
function simpanSesi_(payload) {
  const peta = indeks_(TAB.SESI);
  var dasar = {
    id: payload.id, groupId: '', program: '', ekskul: '', bulan: '', urut: 1,
    tanggal: '', label: '', pembina: '', materi: '', kendala: '', tindakLanjut: '',
    sumber: 'web', diperbarui: ''
  };
  if (peta[payload.id]) {
    const sheet = tab_(TAB.SESI);
    const nilai = sheet.getRange(peta[payload.id], 1, 1, KOLOM.SESI.length).getValues()[0];
    KOLOM.SESI.forEach(function (k, i) { dasar[k] = nilai[i]; });
    if (dasar.tanggal instanceof Date) {
      dasar.tanggal = Utilities.formatDate(dasar.tanggal, 'Asia/Jakarta', 'yyyy-MM-dd');
    }
  }
  Object.keys(payload).forEach(function (k) { if (k in dasar) dasar[k] = payload[k]; });
  dasar.diperbarui = tanggalJakarta_();
  upsert_(TAB.SESI, [dasar]);
  return { ok: true, sesi: dasar };
}

/** payload: {id} — menghapus sesi beserta presensinya */
function hapusSesi_(payload) {
  const sheetS = tab_(TAB.SESI);
  const petaS = indeks_(TAB.SESI);
  if (petaS[payload.id]) sheetS.deleteRow(petaS[payload.id]);

  const sheetP = tab_(TAB.PRESENSI);
  const last = sheetP.getLastRow();
  if (last > 1) {
    const kunci = sheetP.getRange(2, 1, last - 1, 1).getValues();
    for (var i = kunci.length - 1; i >= 0; i--) {
      if (String(kunci[i][0]).indexOf(payload.id + '|') === 0) sheetP.deleteRow(i + 2);
    }
  }
  return { ok: true, dihapus: payload.id };
}

/* ------------------------------------------- sinkron ke spreadsheet lama */

const NAMA_BULAN = { 8: 'AGUSTUS', 9: 'SEPTEMBER', 10: 'OKTOBER', 11: 'NOVEMBER', 12: 'DESEMBER' };
const KODE_STATUS = { hadir: 'Present', izin: 'Permission', sakit: 'Sick', alpha: 'Alpha' };

/**
 * Menulis ulang grid bulanan di spreadsheet lama dari data basis data ini,
 * sehingga file lama tetap terbaca seperti biasa dan berfungsi sebagai cadangan.
 * Jalankan manual, atau pasang pemicu harian lewat menu Triggers.
 *
 * Catatan: hanya mengisi kotak status dan baris tanggal. Judul, daftar nama,
 * dan tata letak sheet lama tidak disentuh.
 */
function sinkronKeFormatLama() {
  const hasil = [];
  const data = semuaData_();
  const murid = {}; data.murid.forEach(function (m) { murid[m.id] = m; });
  const sesi  = {}; data.sesi.forEach(function (s) { sesi[s.id] = s; });

  // presensi dikelompokkan per sesi
  const perSesi = {};
  data.presensi.forEach(function (p) {
    if (!perSesi[p.sesiId]) perSesi[p.sesiId] = [];
    perSesi[p.sesiId].push(p);
  });

  data.kelompok.forEach(function (g) {
    const idBuku = g.program === 'sabtu' ? KONFIG.ID_SHEET_LAMA_SABTU : KONFIG.ID_SHEET_LAMA_HARIAN;
    if (!idBuku) return;

    var buku;
    try { buku = SpreadsheetApp.openById(idBuku); }
    catch (err) { hasil.push('Tidak bisa membuka ' + idBuku + ': ' + err); return; }

    const sheet = cariSheetLama_(buku, g);
    if (!sheet) { hasil.push('Sheet lama untuk "' + g.judul + '" tidak ketemu, dilewati.'); return; }

    const peta = petaSheetLama_(sheet, g.program);
    if (!peta) { hasil.push('Tata letak "' + sheet.getName() + '" tidak dikenali, dilewati.'); return; }

    const sesiGrup = data.sesi.filter(function (s) { return s.groupId === g.id; })
      .sort(function (a, b) { return (a.bulan - b.bulan) || String(a.tanggal).localeCompare(String(b.tanggal)); });

    sesiGrup.forEach(function (s) {
      const kolom = kolomUntukSesi_(sheet, peta, s, g.program);
      if (!kolom) { hasil.push('Kolom penuh untuk ' + s.label + ' di ' + sheet.getName()); return; }
      (perSesi[s.id] || []).forEach(function (p) {
        const m = murid[p.muridId];
        if (!m) return;
        const baris = peta.barisMurid[normalNama_(m.nama)];
        if (!baris) return;
        sheet.getRange(baris, kolom).setValue(KODE_STATUS[p.status] || '');
      });
    });
    hasil.push(sheet.getName() + ': ' + sesiGrup.length + ' pertemuan disalin.');
  });

  return hasil;
}

function normalNama_(n) { return String(n).toLowerCase().replace(/\s+/g, ' ').trim(); }

function cariSheetLama_(buku, g) {
  const nama = buku.getSheets().map(function (s) { return s.getName(); });
  const target = g.program === 'sabtu' ? g.kelas : g.judul;
  // cocokkan longgar: "DESAIN GRAFIS PA" vs "Desain Grafis Putra"
  const ringkas = function (t) { return String(t).toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  const kandidat = ringkas(target).replace('PUTRA', 'PA').replace('PUTRI', 'PI');
  for (var i = 0; i < nama.length; i++) {
    if (ringkas(nama[i]) === ringkas(target) || ringkas(nama[i]) === kandidat) return buku.getSheets()[i];
  }
  for (var j = 0; j < nama.length; j++) {
    if (ringkas(nama[j]).indexOf(kandidat.substring(0, 6)) === 0) return buku.getSheets()[j];
  }
  return null;
}

/**
 * Membaca tata letak satu sheet lama.
 * Tata letaknya: beberapa baris judul, lalu baris pita bulan (AGUSTUS, SEPTEMBER, ...)
 * atau pita ekskul Sabtu (BERKUDA, MEMANAH, ...), lalu baris judul kolom (NO | NAMA | ...),
 * kadang diikuti satu baris tanggal, lalu daftar murid.
 */
function petaSheetLama_(sheet, program) {
  const nilai = sheet.getDataRange().getValues();

  var barisHeader = -1;
  for (var r = 0; r < Math.min(nilai.length, 15); r++) {
    if (String(nilai[r][0]).trim().toUpperCase() === 'NO') { barisHeader = r; break; }
  }
  if (barisHeader < 0) return null;

  const kolomNama = nilai[barisHeader].map(function (v) {
    return String(v).trim().toUpperCase();
  }).indexOf('NAMA');
  if (kolomNama < 0) return null;

  // Pita bulan / ekskul bisa berada di baris judul itu sendiri atau satu-dua baris di atasnya.
  const label = program === 'sabtu'
    ? ['BERKUDA', 'MEMANAH', 'BERENANG', 'LITERASI', 'ASBD']
    : ['AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
  const blok = {};
  var barisPita = -1;
  for (var dy = 0; dy >= -2 && barisPita < 0; dy--) {
    const baris = nilai[barisHeader + dy];
    if (!baris) continue;
    var ketemu = 0;
    baris.forEach(function (v, i) {
      const t = String(v).trim().toUpperCase();
      if (label.indexOf(t) >= 0 && blok[t] == null) { blok[t] = i; ketemu++; }
    });
    if (ketemu) barisPita = barisHeader + dy;
  }
  if (barisPita < 0) return null;

  // Baris tanggal: baris pertama sesudah judul yang kolom NO dan NAMA-nya kosong.
  // Kalau tidak ada, tanggal ditulis di baris judul itu sendiri (sel di bawah pita masih kosong).
  var barisTanggal = barisHeader;
  const kandidat = nilai[barisHeader + 1];
  if (kandidat && String(kandidat[0]).trim() === '' && String(kandidat[kolomNama]).trim() === '') {
    barisTanggal = barisHeader + 1;
  }

  const barisMurid = {};
  for (var k = barisTanggal + 1; k < nilai.length; k++) {
    const n = String(nilai[k][kolomNama] || '').trim();
    if (n) barisMurid[normalNama_(n)] = k + 1;   // 1-based
  }

  return {
    barisHeader: barisHeader + 1,
    barisTanggal: barisTanggal + 1,
    blok: blok,
    barisMurid: barisMurid,
    program: program,
    lebarBlok: 5
  };
}

/** Kolom (1-based) untuk satu sesi; dipakai ulang kalau tanggalnya sudah tercatat. */
function kolomUntukSesi_(sheet, peta, s, program) {
  const namaBlok = program === 'sabtu'
    ? String(s.ekskul).toUpperCase()
    : NAMA_BULAN[Number(s.bulan)];
  if (!namaBlok || peta.blok[namaBlok] == null) return null;

  const awal = peta.blok[namaBlok] + 1;   // 1-based
  const lebar = peta.lebarBlok;
  const tanggal = s.tanggal || s.label;
  const isiBaris = sheet.getRange(peta.barisTanggal, awal, 1, lebar).getValues()[0];

  function teks_(v) {
    return v instanceof Date
      ? Utilities.formatDate(v, 'Asia/Jakarta', 'yyyy-MM-dd')
      : String(v == null ? '' : v).trim();
  }

  for (var i = 0; i < lebar; i++) {
    if (teks_(isiBaris[i]) === String(tanggal)) return awal + i;
  }
  for (var j = 0; j < lebar; j++) {
    const t = teks_(isiBaris[j]);
    if (!t || t.indexOf('*Isi') === 0) {
      sheet.getRange(peta.barisTanggal, awal + j).setValue(tanggal);
      return awal + j;
    }
  }
  return null;   // lima slot blok ini sudah terpakai semua
}

/* ------------------------------------------------------------------ menu */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ekskul')
    .addItem('Setup / muat ulang data awal', 'setup')
    .addItem('Sinkron ke spreadsheet lama', 'sinkronManual')
    .addToUi();
}

function sinkronManual() {
  const hasil = sinkronKeFormatLama();
  SpreadsheetApp.getUi().alert('Sinkron selesai\n\n' + hasil.join('\n'));
}
