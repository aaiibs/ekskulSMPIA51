/* Presensi & Pendampingan Ekstrakurikuler — SMPI Al Azhar 51 IIBS Karanganyar */
(function(){
"use strict";
const $ = (s,r)=> (r||document).querySelector(s);
const esc = s => String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const BULAN = {8:"Agustus",9:"September",10:"Oktober",11:"November",12:"Desember",1:"Januari",2:"Februari",3:"Maret",4:"April",5:"Mei",6:"Juni",7:"Juli"};
const ST = [["hadir","H"],["izin","I"],["sakit","S"],["alpha","A"]];
const STNAME = {hadir:"Hadir",izin:"Izin",sakit:"Sakit",alpha:"Alpa"};
let DATA = {murid:[],kelompok:[],sesi:[],presensi:[],ekskulSabtu:["Berkuda","Memanah","Berenang","Literasi","ASBD"]};
let MURID=new Map(), KEL=new Map(), KELAS=[], EKSKUL_ALL=[];
let seedSesi=new Map(), seedPres=new Map();
const dbSesi=new Map(), dbPres=new Map();
let canWrite=null;
let FOTO=[];

/* ---------- peran ---------- */
const PERAN_KEY="ekskul.peran.v2";
let PERAN=null, NAMA_PETUGAS="";
function muatPeran(){
  try{ const r=JSON.parse(localStorage.getItem(PERAN_KEY)||"null");
       if(r && (r.peran==="admin"||r.peran==="pendamping")){ PERAN=r.peran; NAMA_PETUGAS=r.nama||""; } }
  catch(e){}
}
function simpanPeran(){
  try{ localStorage.setItem(PERAN_KEY, JSON.stringify({peran:PERAN,nama:NAMA_PETUGAS})); }catch(e){}
}
function keluarPeran(){
  PERAN=null; NAMA_PETUGAS="";
  try{ localStorage.removeItem(PERAN_KEY); }catch(e){}
  layarMasuk();
}
function bolehTab(k){ return PERAN==="admin" ? true : (k==="presensi"||k==="pantauan"); }

function pasangData(d){
  DATA=d;
  MURID=new Map(DATA.murid.map(m=>[m.id,m]));
  KEL=new Map(DATA.kelompok.map(g=>[g.id,g]));
  KELAS=[...new Set(DATA.murid.map(m=>m.kelas))].sort();
  const dly=[...new Set(DATA.kelompok.filter(g=>g.program==="daily").map(g=>g.ekskul))];
  EKSKUL_ALL=[...new Set([...dly,...DATA.ekskulSabtu])].sort();
  seedSesi=new Map(DATA.sesi.map(s=>[s.id,s]));
  seedPres=new Map();
  DATA.presensi.forEach(r=>{
    if(!seedPres.has(r.sesiId)) seedPres.set(r.sesiId,new Map());
    seedPres.get(r.sesiId).set(r.muridId,{s:r.status,c:r.catatan||""});
  });
  FOTO = Array.isArray(DATA.foto) ? DATA.foto : [];
  dbSesi.clear(); dbPres.clear();
}

function allSesi(){ const m=new Map(seedSesi); dbSesi.forEach((v,k)=>m.set(k,v)); return m; }
function presOf(sesiId){
  const out = new Map(seedPres.get(sesiId)||[]);
  const d = dbPres.get(sesiId);
  if(d && d.murid) Object.keys(d.murid).forEach(k=>{
    const v=d.murid[k]; if(v && (v.s||v.c)) out.set(k,{s:v.s||"",c:v.c||""}); else out.delete(k);
  });
  return out;
}
function sesiOfGroup(gid){
  return [...allSesi().values()].filter(s=>s.groupId===gid)
    .sort((a,b)=> (a.bulan-b.bulan) || ((a.tanggal||"")<(b.tanggal||"")?-1:1) || (a.urut-b.urut));
}
function anggotaOf(gid){ const g=KEL.get(gid); return (g.anggota||[]).map(id=>MURID.get(id)).filter(Boolean)
  .sort((a,b)=> a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama)); }
function sesiLabel(s){
  if(s.tanggal){ const d=new Date(s.tanggal+"T00:00:00");
    return d.toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"}); }
  return s.label;
}
function sesiEkskul(s){ return s.ekskul || (KEL.get(s.groupId)||{}).ekskul || "-"; }

/* ---------- ui shell ---------- */
const TABS = [
  ["ringkasan","Ringkasan",'<path d="M3 13h5v8H3zM9.5 3h5v18h-5zM16 9h5v12h-5z"/>'],
  ["presensi","Presensi",'<path d="M4 4h16v16H4z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12l3 3 5-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'],
  ["pantauan","Pantauan",'<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'],
  ["murid","Murid",'<circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" fill="none" stroke="currentColor" stroke-width="2"/>']
];
let tab = "ringkasan";
function icon(p){ return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'+p+'</svg>'; }
function renderNav(){
  const daftar = TABS.filter(([k])=>bolehTab(k));
  if(!daftar.some(([k])=>k===tab)) tab = daftar[0][0];
  const html = daftar.map(([k,l,p])=>`<button data-tab="${k}" aria-current="${k===tab}">${icon(p)}<span>${l}</span></button>`).join("")
    + `<button data-keluar="1" class="keluar">${icon('<path d="M10 4H5v16h5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 8l4 4-4 4M19 12H9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>')}<span>Keluar</span></button>`;
  $("#rail").innerHTML=html; $("#tabs").innerHTML=html;
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{ tab=b.dataset.tab; pState.selesai=null; render(); window.scrollTo({top:0}); });
  document.querySelectorAll("[data-keluar]").forEach(b=>b.onclick=keluarPeran);
}
function toast(msg){
  const t=document.createElement("div"); t.className="toast"; t.textContent=msg; document.body.appendChild(t);
  setTimeout(()=>t.remove(),1900);
}

/* ---------- halaman masuk ---------- */
let masukMode=null, masukPesan="";
function layarMasuk(){
  document.body.classList.add("mode-masuk");
  $("#rail").innerHTML=""; $("#tabs").innerHTML="";
  const m = $("#main");
  if(masukMode!=="admin"){
    m.innerHTML = `<section class="masuk">
      <div class="masuk-kop">
        <h2>Assalamu'alaikum</h2>
        <p>Presensi dan pendampingan ekstrakurikuler</p>
      </div>
      <div class="masuk-pilih">
        <button class="kartu-peran utama" data-masuk="pendamping">
          <b>Pendamping</b>
          <small>Mengisi presensi dan dokumentasi</small>
        </button>
        <button class="kartu-peran" data-masuk="admin">
          <b>Admin</b>
          <small>Kemuridan &middot; perlu kode masuk</small>
        </button>
      </div>
    </section>`;
  } else {
    m.innerHTML = `<section class="masuk"><div class="masuk-kotak">
      <button class="bk" id="mk-balik">&larr; Kembali</button>
      <h2>Masuk sebagai Admin</h2>
      <div class="field"><label for="mk-kode">Kode masuk</label>
        <input type="password" id="mk-kode" placeholder="Kode dari tim Kemuridan" autocomplete="current-password"></div>
      ${masukPesan?`<p class="masuk-salah">${esc(masukPesan)}</p>`:""}
      <button class="btn" id="mk-ok">Masuk</button>
    </div></section>`;
  }
  ikatMasuk();
}
function masukSebagai(peran){
  PERAN=peran; NAMA_PETUGAS=""; simpanPeran();
  document.body.classList.remove("mode-masuk");
  tab = PERAN==="admin" ? "ringkasan" : "presensi";
  masukMode=null; masukPesan="";
  mulai();
}
function ikatMasuk(){
  document.querySelectorAll("[data-masuk]").forEach(b=>b.onclick=()=>{
    if(b.dataset.masuk==="pendamping") masukSebagai("pendamping");
    else { masukMode="admin"; masukPesan=""; layarMasuk(); setTimeout(()=>{ const el=$("#mk-kode"); if(el) el.focus(); },50); }
  });
  on("#mk-balik","click",()=>{ masukMode=null; masukPesan=""; layarMasuk(); });
  const kirim=()=>{
    const kode=($("#mk-kode")?$("#mk-kode").value:"").trim();
    if(kode!==CONFIG.ADMIN_CODE){ masukPesan="Kode masuk tidak cocok."; layarMasuk(); return; }
    masukSebagai("admin");
  };
  on("#mk-ok","click",kirim);
  on("#mk-kode","keydown",e=>{ if(e.key==="Enter") kirim(); });
}

/* ---------- stats ---------- */
function tally(entries){
  const t={hadir:0,izin:0,sakit:0,alpha:0,total:0};
  entries.forEach(e=>{ if(e && t[e.s]!=null){ t[e.s]++; t.total++; } });
  t.rate = t.total? Math.round(t.hadir/t.total*100) : null;
  return t;
}
// all recorded marks as flat rows, with filters
function rows(f){
  const out=[]; const sm=allSesi();
  sm.forEach(s=>{
    if(f.program && s.program!==f.program) return;
    if(f.bulan && String(s.bulan)!==String(f.bulan)) return;
    if(f.ekskul && sesiEkskul(s)!==f.ekskul) return;
    if(f.groupId && s.groupId!==f.groupId) return;
    presOf(s.id).forEach((e,mid)=>{
      if(!e.s) return;
      const m=MURID.get(mid); if(!m) return;
      if(f.kelas && m.kelas!==f.kelas) return;
      if(f.tingkat && m.tingkat!==f.tingkat) return;
      if(f.muridId && mid!==f.muridId) return;
      if(f.status && e.s!==f.status) return;
      out.push({sesi:s,murid:m,status:e.s,catatan:e.c||""});
    });
  });
  return out;
}

/* ---------- RINGKASAN ---------- */
let ringkasFilter = {program:"",bulan:""};
function viewRingkasan(){
  const f = {program:ringkasFilter.program, bulan:ringkasFilter.bulan};
  const rs = rows(f);
  const t = tally(rs.map(r=>({s:r.status})));
  const sm=[...allSesi().values()].filter(s=>(!f.program||s.program===f.program)&&(!f.bulan||String(s.bulan)===String(f.bulan)));
  const tercatat = sm.filter(s=>presOf(s.id).size>0).length;

  // per ekskul
  const byEk = new Map();
  rs.forEach(r=>{ const k=sesiEkskul(r.sesi); if(!byEk.has(k)) byEk.set(k,[]); byEk.get(k).push({s:r.status}); });
  const ekRows=[...byEk.entries()].map(([k,v])=>({k,t:tally(v)})).sort((a,b)=> (a.t.rate??-1)-(b.t.rate??-1));

  // perhatian: alpa >= 2
  const byM = new Map();
  rs.forEach(r=>{ if(!byM.has(r.murid.id)) byM.set(r.murid.id,[]); byM.get(r.murid.id).push({s:r.status}); });
  const perhatian=[...byM.entries()].map(([id,v])=>({m:MURID.get(id),t:tally(v)}))
    .filter(x=>x.t.alpha>=2).sort((a,b)=> b.t.alpha-a.t.alpha || a.m.nama.localeCompare(b.m.nama)).slice(0,12);

  const bulanOpts = [...new Set([...allSesi().values()].map(s=>s.bulan))].sort((a,b)=>a-b);

  return `
  <section class="card"><div class="card-b">
    <div class="filters">
      <div class="field"><label for="rf-prog">Program</label>
        <select id="rf-prog"><option value="">Semua program</option>
          <option value="daily"${f.program==="daily"?" selected":""}>Ekskul pilihan (Senin–Jumat)</option>
          <option value="sabtu"${f.program==="sabtu"?" selected":""}>Ekskul Sabtu</option></select></div>
      <div class="field"><label for="rf-bln">Bulan</label>
        <select id="rf-bln"><option value="">Semua bulan</option>
          ${bulanOpts.map(b=>`<option value="${b}"${String(f.bulan)===String(b)?" selected":""}>${BULAN[b]}</option>`).join("")}</select></div>
    </div>
  </div></section>

  <div class="kpis">
    <div class="kpi accent"><div class="n">${t.rate==null?"–":t.rate+"%"}</div><div class="l">Kehadiran rata-rata</div></div>
    <div class="kpi"><div class="n">${tercatat}</div><div class="l">Pertemuan tercatat</div></div>
    <div class="kpi"><div class="n">${t.total}</div><div class="l">Baris presensi</div></div>
    <div class="kpi"><div class="n">${t.alpha}</div><div class="l">Tanpa keterangan</div></div>
  </div>

  <section class="card">
    <div class="card-h"><h2>Kehadiran per jenis ekskul</h2><span class="sub">diurutkan dari yang paling perlu perhatian</span></div>
    <div class="card-b">
      ${ekRows.length? `<div class="bars">${ekRows.map(r=>barRow(r.k,r.t)).join("")}</div>
      <div class="legend">
        <span><i class="dot" style="background:var(--ok)"></i>Hadir</span>
        <span><i class="dot" style="background:var(--izin)"></i>Izin</span>
        <span><i class="dot" style="background:var(--sakit)"></i>Sakit</span>
        <span><i class="dot" style="background:var(--alpha)"></i>Alpa</span>
        <span>Angka di kanan = persentase hadir</span>
      </div>` : emptyBox("Belum ada presensi pada filter ini","Pilih bulan lain, atau catat pertemuan baru di tab Presensi.")}
    </div>
  </section>

  <section class="card">
    <div class="card-h"><h2>Murid perlu pendampingan</h2><span class="sub">alpa 2 kali atau lebih</span></div>
    ${perhatian.length? `<div class="tw"><table><thead><tr><th>Nama</th><th>Kelas</th><th class="num">Alpa</th><th class="num">Izin</th><th class="num">Hadir</th><th class="num">%</th></tr></thead><tbody>
      ${perhatian.map(x=>`<tr data-murid="${x.m.id}" style="cursor:pointer"><td><span class="nmcell">${esc(x.m.nama)}</span></td><td>${x.m.kelas}</td>
      <td class="num"><b style="color:var(--alpha)">${x.t.alpha}</b></td><td class="num">${x.t.izin}</td><td class="num">${x.t.hadir}</td><td class="num">${x.t.rate}%</td></tr>`).join("")}
    </tbody></table></div>` : emptyBox("Tidak ada yang alpa 2 kali atau lebih","Pada filter ini kehadiran terpantau aman.")}
  </section>`;
}
function barRow(name,t){
  const tot=t.total||1;
  const seg = (cls,v)=> v? `<i class="${cls}" style="width:${(v/tot*100).toFixed(2)}%"></i>`:"";
  return `<div class="bar-row"><span class="nm" title="${esc(name)}">${esc(name)}</span>
    <span class="track">${seg("h",t.hadir)}${seg("i",t.izin)}${seg("s",t.sakit)}${seg("a",t.alpha)}</span>
    <span class="pc">${t.rate}%</span></div>`;
}
function emptyBox(b,p){ return `<div class="empty"><b>${esc(b)}</b>${esc(p)}</div>`; }

/* ---------- PRESENSI ---------- */
let pState = {program:"daily", groupId:null, sesiId:null, baru:false, konfirmHapus:false, catatanMurid:null, selesai:null, adaGagal:false};
function viewPresensi(){
  const groups = DATA.kelompok.filter(g=>g.program===pState.program);
  if(!pState.groupId || !KEL.get(pState.groupId) || KEL.get(pState.groupId).program!==pState.program){
    pState.groupId = groups[0].id; pState.sesiId=null;
  }
  const g = KEL.get(pState.groupId);
  const ss = sesiOfGroup(g.id);
  if(pState.sesiId && !allSesi().has(pState.sesiId)) pState.sesiId=null;
  if(!pState.sesiId && ss.length) pState.sesiId = ss[ss.length-1].id;

  if(pState.selesai) return layarSelesai();

  let body;
  if(pState.baru){ body = formPertemuan(g); }
  else if(!pState.sesiId){ body = `<div class="card-b">${emptyBox("Belum ada pertemuan untuk "+g.judul,"Tekan ‘Pertemuan baru’ untuk mulai mencatat.")}</div>`; }
  else { body = panelPresensi(g, allSesi().get(pState.sesiId)); }

  return `
  <section class="card"><div class="card-b">
    <div class="filters" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">
      <div class="field"><label for="p-prog">Program</label>
        <select id="p-prog">
          <option value="daily"${pState.program==="daily"?" selected":""}>Ekskul pilihan (Senin–Jumat sore)</option>
          <option value="sabtu"${pState.program==="sabtu"?" selected":""}>Ekskul Sabtu</option></select></div>
      <div class="field"><label for="p-grp">${pState.program==="daily"?"Kelompok ekskul":"Kelas"}</label>
        <select id="p-grp">${groups.map(x=>`<option value="${x.id}"${x.id===g.id?" selected":""}>${esc(x.judul)}</option>`).join("")}</select></div>
      <div class="field"><label for="p-ses">Pertemuan</label>
        <select id="p-ses"${ss.length?"":" disabled"}>${ss.length?ss.map(s=>`<option value="${s.id}"${s.id===pState.sesiId?" selected":""}>${esc(sesiLabel(s))}${s.program==="sabtu"?" · "+esc(s.ekskul):""}</option>`).join(""):'<option>— belum ada —</option>'}</select></div>
      <div class="field"><label>&nbsp;</label><button class="btn gold" id="p-new">+ Pertemuan baru</button></div>
    </div>
  </div></section>
  <section class="card">${body}</section>`;
}

function layarSelesai(){
  const r = pState.selesai;
  return `<section class="card terima">
    <div class="terima-ikon" aria-hidden="true">
      <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" stroke-width="3" opacity=".3"/>
        <path d="M19 33l9.5 9.5L45 24" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <h2>Barakallahu fiikum</h2>
    <p class="terima-ayat">Jazakumullahu khairan atas pendampingannya hari ini.</p>
    <p class="terima-sub">Presensi <b>${esc(r.ekskul)}</b> &mdash; ${esc(r.kelompok)}<br>${esc(r.tanggal)} sudah tersimpan di spreadsheet sekolah.</p>
    ${r.gagal?`<div class="flag" style="justify-content:center">⚑ Sebagian data gagal terkirim. Periksa jaringan, lalu buka lagi pertemuan ini untuk memastikan.</div>`:""}
    <div class="terima-angka">
      <div><b>${r.hadir}</b><span>Hadir</span></div>
      <div><b>${r.izin}</b><span>Izin</span></div>
      <div><b>${r.sakit}</b><span>Sakit</span></div>
      <div><b>${r.alpha}</b><span>Alpa</span></div>
    </div>
    <p class="terima-catatan">${r.belum?`${r.belum} murid belum diisi statusnya.`:"Seluruh murid sudah diisi."}
      ${r.foto?` &middot; ${r.foto} foto dokumentasi terunggah.`:" &middot; Belum ada foto dokumentasi."}
      ${r.catatan?` &middot; ${r.catatan} catatan pendampingan.`:""}</p>
    <div class="row" style="justify-content:center">
      <button class="btn" id="ts-lagi">Catat pertemuan lain</button>
      <button class="btn ghost" id="ts-pantau">Lihat pantauan</button>
    </div>
  </section>`;
}

function formPertemuan(g){
  const today = new Date().toISOString().slice(0,10);
  return `<div class="card-h"><h2>Pertemuan baru — ${esc(g.judul)}</h2></div>
  <div class="card-b sessbar">
    <div class="filters" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">
      <div class="field"><label for="nb-tgl">Tanggal</label><input type="date" id="nb-tgl" value="${today}"></div>
      ${g.program==="sabtu"? `<div class="field"><label for="nb-ek">Ekskul</label><select id="nb-ek">${DATA.ekskulSabtu.map(e=>`<option>${esc(e)}</option>`).join("")}</select></div>`
        : `<div class="field"><label>Ekskul</label><input type="text" value="${esc(g.ekskul)}" disabled></div>`}
      <div class="field"><label for="nb-pem">Pembina / pendamping</label><input type="text" id="nb-pem" placeholder="Nama pembina"></div>
    </div>
    <div class="row"><button class="btn" id="nb-ok">Buat pertemuan</button><button class="btn ghost" id="nb-cancel">Batal</button></div>
  </div>`;
}

function panelPresensi(g, s){
  const pres = presOf(s.id);
  const ang = anggotaOf(g.id);
  const t = tally(ang.map(m=>pres.get(m.id)).filter(Boolean));
  const meta = dbSesi.get(s.id) || {};
  const ro = canWrite===false;
  const fotoSesi = FOTO.filter(f=>f.sesiId===s.id);
  return `
  <div class="card-h">
    <h2>${esc(sesiLabel(s))}</h2>
    <span class="sub">${esc(g.judul)} · ${esc(sesiEkskul(s))} · ${esc(g.jadwal)}</span>
  </div>
  <div class="card-b sessbar">
    <div class="ssum">
      <span class="pill p-hadir">Hadir ${t.hadir}</span>
      <span class="pill p-izin">Izin ${t.izin}</span>
      <span class="pill p-sakit">Sakit ${t.sakit}</span>
      <span class="pill p-alpha">Alpa ${t.alpha}</span>
      <span class="pill p-kosong">Belum diisi ${ang.length-t.total}</span>
      <span class="note" style="margin-left:auto">${ang.length} murid terdaftar</span>
    </div>
    ${ro?'<div class="hint">Akses Anda hanya membaca, jadi presensi di halaman ini tidak bisa diubah.</div>':
      `<div class="row"><button class="btn ghost" id="pz-all">Tandai semua hadir</button>
        <button class="btn ghost" id="pz-clear">Kosongkan</button></div>`}
  </div>
  <div class="mlist">
    ${ang.map(m=>{
      const e = pres.get(m.id)||{s:"",c:""};
      return `<div class="mrow" data-m="${m.id}">
        <div class="who"><b>${esc(m.nama)}</b><small>${m.kelas}</small></div>
        <div class="seg">${ST.map(([k,l])=>`<button class="${l.toLowerCase()}" data-st="${k}" aria-pressed="${e.s===k}" ${ro?"disabled":""} title="${STNAME[k]}">${l}</button>`).join("")}</div>
      </div>`;
    }).join("")}
  </div>

  <div class="card-b" style="border-top:1px solid var(--line)">
    <h3 style="font-size:15px;margin-bottom:12px">Catatan pendampingan</h3>
    <div class="filters" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
      <div class="field"><label for="sm-pem">Pembina / pendamping</label>
        <input type="text" id="sm-pem" value="${esc(meta.pembina||"")}" ${ro?"disabled":""} placeholder="Nama pembina"></div>
      <div class="field"><label for="sm-mat">Materi / kegiatan</label>
        <input type="text" id="sm-mat" value="${esc(meta.materi||"")}" ${ro?"disabled":""} placeholder="Silakan isi sesuai yang diketahui, bisa ditanyakan Pelatih"></div>
    </div>
    <div class="field" style="margin-top:12px"><label for="sm-ken">Catatan selama mendampingi</label>
      <textarea id="sm-ken" ${ro?"disabled":""} placeholder="Jalannya kegiatan, hal yang perlu diketahui sekolah, atau murid yang perlu perhatian">${esc(meta.kendala||"")}</textarea></div>
    <p class="note" style="margin-top:8px">Tersimpan otomatis${s.sumber==="spreadsheet"?" &middot; data awal diimpor dari spreadsheet presensi":""}.</p>

    ${ro?"":`<div class="catatan-blok">
      <p class="eyebrow">Dokumentasi kegiatan</p>
      <div class="foto-aksi">
        <label class="btn gold" for="fo-kamera">Ambil foto</label>
        <input type="file" id="fo-kamera" accept="image/*" capture="environment" multiple hidden>
        <label class="btn ghost" for="fo-galeri">Pilih dari galeri</label>
        <input type="file" id="fo-galeri" accept="image/*" multiple hidden>
        <span class="note" id="fo-status">${fotoSesi.length?fotoSesi.length+" foto terunggah":"Belum ada foto"}</span>
      </div>
      ${fotoSesi.length?`<div class="foto-grid">${fotoSesi.map(f=>`
        <figure class="foto"><img src="${esc(f.url)}" alt="${esc(f.nama)}" loading="lazy">
          <figcaption><span>${esc(f.oleh||"")}</span><button class="foto-hapus" data-hapus-foto="${esc(f.id)}" title="Hapus foto">&times;</button></figcaption>
        </figure>`).join("")}</div>`:""}
    </div>`}

    ${ro?"":`<div class="selesai-blok">
      <div>
        <b>Sudah selesai mencatat?</b>
        <p class="note">Presensi tersimpan otomatis setiap kali Anda menekan H/I/S/A. Tombol ini untuk mengakhiri dan melihat ringkasannya.</p>
      </div>
      <button class="btn besar" id="pz-selesai">Simpan &amp; selesai</button>
    </div>`}
  </div>

  ${ro?"":`<div class="zona-bahaya">
    ${pState.konfirmHapus ? `<div class="konfirm">
        <b>Hapus pertemuan ${esc(sesiLabel(s))}?</b>
        <p>${t.total} baris presensi, catatan pendampingan, dan ${fotoSesi.length} foto di pertemuan ini ikut terhapus. Tindakan ini tidak bisa dibatalkan.</p>
        ${s.sumber==="spreadsheet"?'<p class="peringatan">Pertemuan ini berasal dari impor spreadsheet lama, bukan dibuat lewat situs.</p>':''}
        <div class="row"><button class="btn bahaya-isi" id="pz-del-ya">Ya, hapus</button>
          <button class="btn ghost" id="pz-del-batal">Batal</button></div>
      </div>`
    : `<button class="tautan-bahaya" id="pz-del">Hapus pertemuan ini</button>`}
  </div>`}`;
}

/* ---------- PANTAUAN ---------- */
let fState = {program:"",bulan:"",kelas:"",ekskul:"",status:"",q:""};
function viewPantauan(){
  const f = {program:fState.program,bulan:fState.bulan,kelas:fState.kelas,ekskul:fState.ekskul,status:fState.status};
  let rs = rows(f);
  const q = fState.q.trim().toLowerCase();
  if(q) rs = rs.filter(r=> r.murid.nama.toLowerCase().includes(q));

  const byM = new Map();
  rs.forEach(r=>{ if(!byM.has(r.murid.id)) byM.set(r.murid.id,[]); byM.get(r.murid.id).push(r); });
  const rek = [...byM.entries()].map(([id,v])=>({m:MURID.get(id),t:tally(v.map(x=>({s:x.status}))),
      ek:[...new Set(v.map(x=>sesiEkskul(x.sesi)))]}))
    .sort((a,b)=> (a.t.rate-b.t.rate) || a.m.nama.localeCompare(b.m.nama));
  const tot = tally(rs.map(r=>({s:r.status})));
  const catatanSesi = [...allSesi().values()]
    .filter(s=>(!f.program || s.program===f.program))
    .filter(s=>(!f.bulan   || String(s.bulan)===String(f.bulan)))
    .filter(s=>(!f.ekskul  || sesiEkskul(s)===f.ekskul))
    .map(s=>Object.assign({}, s, dbSesi.get(s.id)||{}))
    .filter(s=>s.materi || s.kendala)
    .sort((a,b)=> String(b.tanggal||"").localeCompare(String(a.tanggal||"")) || b.bulan-a.bulan)
    .slice(0,25);
  const bulanOpts=[...new Set([...allSesi().values()].map(s=>s.bulan))].sort((a,b)=>a-b);

  const sm=allSesi();
  const fotoTampil = FOTO.map(f=>{
      const s=sm.get(f.sesiId); if(!s) return null;
      const g=KEL.get(s.groupId)||{};
      return {...f, sesi:s, ekskul:sesiEkskul(s), kelompok:g.judul||"", tanggal:sesiLabel(s)};
    }).filter(Boolean)
    .filter(f=>(!fState.program || f.sesi.program===fState.program))
    .filter(f=>(!fState.bulan   || String(f.sesi.bulan)===String(fState.bulan)))
    .filter(f=>(!fState.ekskul  || f.ekskul===fState.ekskul))
    .sort((a,b)=> String(b.waktu||"").localeCompare(String(a.waktu||"")));

  return `
  <section class="card">
    <div class="card-h"><h2>Pantauan bersama</h2><span class="sub">saring menurut waktu, kelas, murid, dan jenis ekskul</span></div>
    <div class="card-b" style="display:grid;gap:12px">
      <div class="filters">
        <div class="field"><label for="f-prog">Program</label><select id="f-prog">
          <option value="">Semua program</option>
          <option value="daily"${f.program==="daily"?" selected":""}>Ekskul pilihan</option>
          <option value="sabtu"${f.program==="sabtu"?" selected":""}>Ekskul Sabtu</option></select></div>
        <div class="field"><label for="f-bln">Bulan</label><select id="f-bln">
          <option value="">Semua bulan</option>
          ${bulanOpts.map(b=>`<option value="${b}"${String(f.bulan)===String(b)?" selected":""}>${BULAN[b]}</option>`).join("")}</select></div>
        <div class="field"><label for="f-kls">Kelas</label><select id="f-kls">
          <option value="">Semua kelas</option>
          ${KELAS.map(k=>`<option value="${k}"${f.kelas===k?" selected":""}>${k}</option>`).join("")}</select></div>
        <div class="field"><label for="f-ek">Jenis ekskul</label><select id="f-ek">
          <option value="">Semua ekskul</option>
          ${EKSKUL_ALL.map(e=>`<option value="${esc(e)}"${f.ekskul===e?" selected":""}>${esc(e)}</option>`).join("")}</select></div>
      </div>
      <div class="filters" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">
        <div class="field"><label for="f-st">Status</label><select id="f-st">
          <option value="">Semua status</option>
          ${ST.map(([k])=>`<option value="${k}"${f.status===k?" selected":""}>${STNAME[k]}</option>`).join("")}</select></div>
        <div class="field"><label for="f-q">Cari murid</label><input type="search" id="f-q" value="${esc(fState.q)}" placeholder="Ketik nama murid"></div>
        <div class="field"><label>&nbsp;</label><div class="row">
          <button class="btn ghost" id="f-reset">Atur ulang</button>
          <button class="btn" id="f-csv">Unduh CSV</button></div></div>
      </div>
    </div>
  </section>

  <div class="kpis">
    <div class="kpi accent"><div class="n">${tot.rate==null?"–":tot.rate+"%"}</div><div class="l">Kehadiran</div></div>
    <div class="kpi"><div class="n">${rek.length}</div><div class="l">Murid terdata</div></div>
    <div class="kpi"><div class="n">${tot.izin+tot.sakit}</div><div class="l">Izin &amp; sakit</div></div>
    <div class="kpi"><div class="n">${tot.alpha}</div><div class="l">Alpa</div></div>
  </div>

  <section class="card">
    <div class="card-h"><h2>Rekap per murid</h2><span class="sub">${rek.length} murid · urut dari kehadiran terendah</span></div>
    ${rek.length? `<div class="tw"><table><thead><tr><th>Nama</th><th>Kelas</th><th>Ekskul</th>
      <th class="num">H</th><th class="num">I</th><th class="num">S</th><th class="num">A</th><th class="num">Hadir</th></tr></thead><tbody>
      ${rek.map(x=>`<tr data-murid="${x.m.id}" style="cursor:pointer">
        <td><span class="nmcell">${esc(x.m.nama)}</span></td><td>${x.m.kelas}</td>
        <td><span class="nmcell" style="min-width:140px;color:var(--fg-muted);font-size:12.5px">${esc(x.ek.join(", "))}</span></td>
        <td class="num">${x.t.hadir}</td><td class="num">${x.t.izin}</td><td class="num">${x.t.sakit}</td>
        <td class="num"${x.t.alpha?' style="color:var(--alpha);font-weight:700"':''}>${x.t.alpha}</td>
        <td class="num"><b>${x.t.rate}%</b></td></tr>`).join("")}
    </tbody></table></div>`: emptyBox("Tidak ada data yang cocok","Longgarkan salah satu saringan di atas.")}
  </section>

  <section class="card">
    <div class="card-h"><h2>Dokumentasi kegiatan</h2>
      <span class="sub">${fotoTampil.length} foto${fState.bulan?" pada "+BULAN[fState.bulan]:" pada semua bulan"}</span></div>
    <div class="card-b">
      ${fotoTampil.length?`<div class="foto-grid besar">${fotoTampil.map(f=>`
        <figure class="foto">
          <a href="https://drive.google.com/file/d/${esc(f.fileId)}/view" target="_blank" rel="noopener">
            <img src="${esc(f.url)}" alt="Dokumentasi ${esc(f.ekskul)}" loading="lazy"></a>
          <figcaption><b>${esc(f.ekskul)}</b><span>${esc(f.tanggal)}${f.oleh?" · "+esc(f.oleh):""}</span></figcaption>
        </figure>`).join("")}</div>`
        : emptyBox("Belum ada dokumentasi pada saringan ini","Foto yang diunggah pendamping saat mengisi presensi akan muncul di sini.")}
    </div>
  </section>

  <section class="card">
    <div class="card-h"><h2>Catatan pendampingan</h2><span class="sub">materi dan catatan pembina pada saringan ini</span></div>
    <div class="card-b">
      ${catatanSesi.length? catatanSesi.map(s=>`<div class="histrow"><div>
          <b>${esc(sesiEkskul(s))}</b> <small>${esc(sesiLabel(s))} · ${esc((KEL.get(s.groupId)||{}).judul||"")}${s.pembina?" · "+esc(s.pembina):""}</small>
          ${s.materi?`<div style="margin-top:4px"><b style="font-weight:600">Materi:</b> ${esc(s.materi)}</div>`:""}
          ${s.kendala?`<div style="margin-top:3px">${esc(s.kendala)}</div>`:""}</div>
          </div>`).join("")
        : emptyBox("Belum ada catatan pendampingan","Catatan diisi pembina di bagian bawah halaman Presensi.")}
    </div>
  </section>`;
}

/* ---------- MURID ---------- */
let mState={id:null,q:""};
function viewMurid(){
  if(mState.id) return viewProfil(MURID.get(mState.id));
  const q=mState.q.trim().toLowerCase();
  const list = DATA.murid.filter(m=>!q||m.nama.toLowerCase().includes(q)||m.kelas.toLowerCase()===q)
    .sort((a,b)=> a.kelas.localeCompare(b.kelas)||a.nama.localeCompare(b.nama)).slice(0,120);
  return `<section class="card">
    <div class="card-h"><h2>Direktori murid</h2><span class="sub">${DATA.murid.length} murid di 14 kelas</span></div>
    <div class="card-b" style="display:grid;gap:14px">
      <div class="field"><label for="m-q">Cari nama atau kelas</label><input type="search" id="m-q" value="${esc(mState.q)}" placeholder="Misal: Kania, atau 8D"></div>
      ${list.length? `<div class="people">${list.map(m=>`<button class="person" data-murid="${m.id}"><b>${esc(m.nama)}</b><small>${m.kelas}</small></button>`).join("")}</div>
        ${list.length>=120?'<p class="note">Menampilkan 120 teratas — persempit pencarian untuk hasil lebih tepat.</p>':''}`
        : emptyBox("Murid tidak ditemukan","Coba nama lain atau ketik kode kelas seperti 9D.")}
    </div></section>`;
}
function viewProfil(m){
  const rs = rows({muridId:m.id});
  const t = tally(rs.map(r=>({s:r.status})));
  const groups = DATA.kelompok.filter(g=>(g.anggota||[]).includes(m.id));
  const byG = new Map();
  rs.forEach(r=>{ const k=r.sesi.groupId; if(!byG.has(k)) byG.set(k,[]); byG.get(k).push(r); });
  const hist = rs.slice().sort((a,b)=> ((b.sesi.tanggal||"")+"").localeCompare((a.sesi.tanggal||"")+"") || b.sesi.bulan-a.sesi.bulan);
  return `<section class="card">
    <div class="card-b"><button class="bk" id="m-back">&larr; Semua murid</button></div>
    <div class="card-h" style="border-top:1px solid var(--line)">
      <h2>${esc(m.nama)}</h2><span class="sub">Kelas ${m.kelas} · ${m.gender==="PI"?"Putri":"Putra"}</span></div>
    <div class="card-b" style="display:grid;gap:16px">
      <div class="kpis">
        <div class="kpi accent"><div class="n">${t.rate==null?"–":t.rate+"%"}</div><div class="l">Kehadiran</div></div>
        <div class="kpi"><div class="n">${t.hadir}</div><div class="l">Hadir</div></div>
        <div class="kpi"><div class="n">${t.izin+t.sakit}</div><div class="l">Izin &amp; sakit</div></div>
        <div class="kpi"><div class="n">${t.alpha}</div><div class="l">Alpa</div></div>
      </div>
      ${t.alpha>=3?`<div class="flag">⚑ Alpa ${t.alpha} kali — layak dibicarakan dengan wali kelas.</div>`:""}
      <div>
        <p class="eyebrow" style="margin:0 0 8px">Ekskul yang diikuti</p>
        <div class="row">${groups.map(g=>{
          const tt=tally((byG.get(g.id)||[]).map(x=>({s:x.status})));
          return `<span class="pill p-prog">${esc(g.program==="sabtu"?"Sabtu — "+g.judul:g.ekskul)}${tt.total?` · ${tt.rate}%`:""}</span>`;
        }).join("")||'<span class="note">Belum terdaftar di kelompok mana pun.</span>'}</div>
      </div>
      <div>
        <p class="eyebrow" style="margin:0 0 6px">Riwayat kehadiran</p>
        ${hist.length? hist.map(r=>`<div class="histrow"><div><b>${esc(sesiEkskul(r.sesi))}</b>
            <small>${esc(sesiLabel(r.sesi))} · ${esc((KEL.get(r.sesi.groupId)||{}).judul||"")}</small>
            ${r.catatan?`<div style="margin-top:3px;font-size:13px">${esc(r.catatan)}</div>`:""}</div>
            <span class="pill p-${r.status}">${STNAME[r.status]}</span></div>`).join("")
          : emptyBox("Belum ada riwayat presensi","Kehadirannya akan muncul begitu pembina mencatat pertemuan.")}
      </div>
    </div></section>`;
}

/* ---------- render + events ---------- */
let pendingRender=false;
function renderSafe(){
  const a=document.activeElement;
  if(a && (a.tagName==="INPUT"||a.tagName==="TEXTAREA")){ pendingRender=true; return; }
  render();
}
document.addEventListener("focusout",()=>{ if(pendingRender) setTimeout(()=>{ const a=document.activeElement;
  if(pendingRender && !(a&&(a.tagName==="INPUT"||a.tagName==="TEXTAREA"))){ pendingRender=false; render(); } },120); });
function render(){
  if(!PERAN){ layarMasuk(); return; }
  pendingRender=false;
  renderNav();
  const main=$("#main");
  main.innerHTML = tab==="ringkasan"?viewRingkasan(): tab==="presensi"?viewPresensi(): tab==="pantauan"?viewPantauan(): viewMurid();
  bind();
}
function on(sel,ev,fn){ const el=$(sel); if(el) el.addEventListener(ev,fn); }
function bind(){
  document.querySelectorAll("[data-murid]").forEach(el=>{
    el.addEventListener("click",()=>{ mState.id=el.dataset.murid; tab="murid"; render(); window.scrollTo({top:0}); });
  });
  // ringkasan
  on("#rf-prog","change",e=>{ringkasFilter.program=e.target.value;render()});
  on("#rf-bln","change",e=>{ringkasFilter.bulan=e.target.value;render()});
  // presensi
  on("#p-prog","change",e=>{pState.program=e.target.value;pState.groupId=null;pState.sesiId=null;pState.baru=false;render()});
  on("#p-grp","change",e=>{pState.groupId=e.target.value;pState.sesiId=null;pState.baru=false;pState.konfirmHapus=false;render()});
  on("#p-ses","change",e=>{pState.sesiId=e.target.value;pState.konfirmHapus=false;render()});
  on("#p-new","click",()=>{pState.baru=true;render()});
  on("#nb-cancel","click",()=>{pState.baru=false;render()});
  on("#nb-ok","click",buatPertemuan);
  on("#pz-all","click",()=>massal("hadir"));
  on("#pz-clear","click",()=>massal(""));
  on("#pz-selesai","click",selesaiPresensi);
  on("#ts-lagi","click",()=>{ pState.selesai=null; pState.baru=true; render(); window.scrollTo({top:0}); });
  on("#ts-pantau","click",()=>{ pState.selesai=null; tab="pantauan"; render(); window.scrollTo({top:0}); });
  ["#fo-kamera","#fo-galeri"].forEach(sel=>on(sel,"change",e=>unggahFoto(e.target.files)));
  document.querySelectorAll("[data-hapus-foto]").forEach(b=>{
    b.addEventListener("click",()=>hapusFoto(b.dataset.hapusFoto));
  });
  on("#pz-del","click",()=>{ pState.konfirmHapus=true; render(); });
  on("#pz-del-batal","click",()=>{ pState.konfirmHapus=false; render(); });
  on("#pz-del-ya","click",hapusPertemuan);
  document.querySelectorAll(".mrow [data-st]").forEach(b=>{
    b.addEventListener("click",()=>{
      const mid=b.closest(".mrow").dataset.m, st=b.dataset.st;
      const cur=presOf(pState.sesiId).get(mid);
      tulisMurid(mid, (cur&&cur.s===st)?"":st, undefined);
    });
  });
  [["#sm-pem","pembina"],["#sm-mat","materi"],["#sm-ken","kendala"]].forEach(([sel,key])=>{
    on(sel,"input",e=>debounce("s"+key,()=>tulisSesi(pState.sesiId,{[key]:e.target.value}),700));
  });
  // pantauan
  on("#f-prog","change",e=>{fState.program=e.target.value;render()});
  on("#f-bln","change",e=>{fState.bulan=e.target.value;render()});
  on("#f-kls","change",e=>{fState.kelas=e.target.value;render()});
  on("#f-ek","change",e=>{fState.ekskul=e.target.value;render()});
  on("#f-st","change",e=>{fState.status=e.target.value;render()});
  on("#f-q","input",e=>debounce("fq",()=>{fState.q=e.target.value;render();const el=$("#f-q");if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}},350));
  on("#f-reset","click",()=>{fState={program:"",bulan:"",kelas:"",ekskul:"",status:"",q:""};render()});
  on("#f-csv","click",unduhCSV);
  // murid
  on("#m-q","input",e=>debounce("mq",()=>{mState.q=e.target.value;render();const el=$("#m-q");if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}},350));
  on("#m-back","click",()=>{mState.id=null;render()});
}
const timers={};
function debounce(k,fn,ms){ clearTimeout(timers[k]); timers[k]=setTimeout(fn,ms); }

/* ---------- jembatan ke Apps Script ---------- */
function api(metode, action, payload){
  if(metode==="GET"){ action="data"; payload=null; }
  return fetch(CONFIG.API_URL,{
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify({token:CONFIG.API_TOKEN, action:action, payload:payload})
  }).then(r=>r.json()).then(j=>{
    if(!j.ok) throw new Error(j.pesan||"Permintaan ditolak backend");
    return action==="data" ? j.data : j;
  });
}

function pencatat(){
  try{ return localStorage.getItem("ekskul.pencatat")||""; }catch(e){ return ""; }
}
function setPencatat(v){ try{ localStorage.setItem("ekskul.pencatat",v); }catch(e){} }

/* ---------- writes ---------- */
function needDb(){ return true; }

async function tulisMurid(mid, status, catatan){
  const sid=pState.sesiId; if(!sid) return;
  const cur=presOf(sid).get(mid)||{s:"",c:""};
  const body={ s: status===undefined?cur.s:status, c: catatan===undefined?cur.c:catatan };
  const d=dbPres.get(sid)||{murid:{}}; d.murid=d.murid||{}; d.murid[mid]=body; dbPres.set(sid,d);
  if(status!==undefined) render();
  try{
    await api("POST","simpanPresensi",{sesiId:sid, oleh:pembinaSesi()||pencatat(), entri:[{muridId:mid,status:body.s,catatan:body.c}]});
    jadwalSegar(4000);
  }catch(err){ pState.adaGagal=true; toast("Gagal menyimpan: "+err.message); }
}

async function massal(status){
  const sid=pState.sesiId; if(!sid) return;
  const g=KEL.get(pState.groupId); const ang=anggotaOf(g.id);
  const d=dbPres.get(sid)||{murid:{}}; d.murid=d.murid||{};
  const entri=ang.map(m=>{ const cur=presOf(sid).get(m.id)||{s:"",c:""};
    d.murid[m.id]={s:status,c:cur.c||""}; return {muridId:m.id,status:status,catatan:cur.c||""}; });
  dbPres.set(sid,d); render();
  try{
    await api("POST","simpanPresensi",{sesiId:sid, oleh:pembinaSesi()||pencatat(), entri:entri});
    toast(status?"Semua ditandai hadir":"Presensi dikosongkan");
    jadwalSegar(4000);
  }catch(err){ pState.adaGagal=true; toast("Gagal menyimpan: "+err.message); }
}

async function tulisSesi(sid, patch){
  if(!sid) return;
  const cur=dbSesi.get(sid)||Object.assign({},allSesi().get(sid));
  const next=Object.assign({},cur,patch); dbSesi.set(sid,next);
  try{ await api("POST","simpanSesi",Object.assign({id:sid},patch)); }
  catch(err){ toast("Catatan belum tersimpan: "+err.message); }
}

function pembinaSesi(){
  const s = pState.sesiId ? (dbSesi.get(pState.sesiId)||allSesi().get(pState.sesiId)||{}) : {};
  return s.pembina || "";
}

function selesaiPresensi(){
  const sid=pState.sesiId; if(!sid) return;
  const s=allSesi().get(sid), g=KEL.get(pState.groupId), ang=anggotaOf(g.id), pres=presOf(sid);
  const t=tally(ang.map(m=>pres.get(m.id)).filter(Boolean));
  pState.selesai = {
    ekskul: sesiEkskul(s), kelompok: g.judul, tanggal: sesiLabel(s),
    hadir:t.hadir, izin:t.izin, sakit:t.sakit, alpha:t.alpha,
    belum: ang.length - t.total,
    foto: FOTO.filter(f=>f.sesiId===sid).length,
    catatan: ang.filter(m=>(pres.get(m.id)||{}).c).length,
    gagal: !!pState.adaGagal
  };
  pState.adaGagal=false;
  render(); window.scrollTo({top:0});
}

/* Memperkecil foto sebelum dikirim: sisi terpanjang 1400px, JPEG mutu 0.72.
   Foto ponsel 4 MB menyusut ke ratusan KB, cukup untuk dokumentasi dan ringan diunggah. */
function kecilkanFoto(file){
  return new Promise((selesai,gagal)=>{
    const baca=new FileReader();
    baca.onerror=()=>gagal(new Error("Gambar tidak terbaca"));
    baca.onload=()=>{
      const img=new Image();
      img.onerror=()=>gagal(new Error("Format gambar tidak didukung"));
      img.onload=()=>{
        const maks=1400;
        let {width:w,height:h}=img;
        if(Math.max(w,h)>maks){ const r=maks/Math.max(w,h); w=Math.round(w*r); h=Math.round(h*r); }
        const c=document.createElement("canvas"); c.width=w; c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        const url=c.toDataURL("image/jpeg",0.72);
        selesai({data:url.split(",")[1], mime:"image/jpeg"});
      };
      img.src=baca.result;
    };
    baca.readAsDataURL(file);
  });
}

async function unggahFoto(files){
  const sid=pState.sesiId; if(!sid||!files||!files.length) return;
  const daftar=[...files].filter(f=>f.type.indexOf("image/")===0);
  if(!daftar.length){ toast("Hanya berkas gambar yang bisa diunggah"); return; }
  const st=$("#fo-status");
  for(let i=0;i<daftar.length;i++){
    if(st) st.textContent=`Mengunggah ${i+1} dari ${daftar.length}…`;
    try{
      const kecil=await kecilkanFoto(daftar[i]);
      const j=await api("POST","simpanFoto",{sesiId:sid, nama:daftar[i].name||("dokumentasi-"+Date.now()+".jpg"),
        mime:kecil.mime, data:kecil.data, oleh:pembinaSesi()});
      if(j.foto) FOTO.push(j.foto);
    }catch(err){
      pState.adaGagal=true;
      toast("Foto gagal diunggah: "+err.message);
      break;
    }
  }
  render(); jadwalSegar(4000);
}

async function hapusFoto(id){
  const simpan=FOTO.find(f=>f.id===id);
  FOTO=FOTO.filter(f=>f.id!==id); render();
  try{ await api("POST","hapusFoto",{id:id}); toast("Foto dihapus"); jadwalSegar(3000); }
  catch(err){ if(simpan) FOTO.push(simpan); toast("Gagal menghapus foto: "+err.message); render(); }
}

async function hapusPertemuan(){
  const sid = pState.sesiId; if(!sid) return;
  const salinanSesi = allSesi().get(sid);
  const salinanPres = presOf(sid);
  // bersihkan di layar dulu supaya terasa responsif
  dbSesi.delete(sid); seedSesi.delete(sid); dbPres.delete(sid); seedPres.delete(sid);
  pState.sesiId = null; pState.konfirmHapus = false; render();
  try{
    await api("POST","hapusSesi",{id:sid});
    toast("Pertemuan dihapus");
    jadwalSegar(3000);
  }catch(err){
    // gagal di server -> kembalikan tampilan apa adanya
    if(salinanSesi) seedSesi.set(sid, salinanSesi);
    if(salinanPres.size){ const m={}; salinanPres.forEach((v,k)=>m[k]=v); dbPres.set(sid,{murid:m}); }
    pState.sesiId = sid;
    toast("Gagal menghapus: "+err.message); render();
  }
}

async function buatPertemuan(){
  const g=KEL.get(pState.groupId);
  const tgl=$("#nb-tgl").value;
  if(!tgl){ toast("Tanggal belum diisi"); return; }
  const ek = g.program==="sabtu" ? $("#nb-ek").value : g.ekskul;
  const pembina = ($("#nb-pem").value||"").trim();
  if(pembina) setPencatat(pembina);
  const id = g.id+"-u"+Date.now().toString(36);
  const bulan = parseInt(tgl.slice(5,7),10);
  const s={id,groupId:g.id,program:g.program,ekskul:ek,bulan,urut:99,tanggal:tgl,label:tgl,sumber:"web",
           pembina,materi:"",kendala:"",tindakLanjut:""};
  dbSesi.set(id,s); pState.sesiId=id; pState.baru=false; render();
  try{ await api("POST","simpanSesi",s); toast("Pertemuan dibuat"); jadwalSegar(4000); }
  catch(err){ dbSesi.delete(id); toast("Gagal membuat pertemuan: "+err.message); render(); }
}

/* ---------- CSV ---------- */
async function unduhCSV(){
  const f={program:fState.program,bulan:fState.bulan,kelas:fState.kelas,ekskul:fState.ekskul,status:fState.status};
  let rs=rows(f); const q=fState.q.trim().toLowerCase();
  if(q) rs=rs.filter(r=>r.murid.nama.toLowerCase().includes(q));
  const head=["Program","Kelompok","Ekskul","Pertemuan","Tanggal","Bulan","Nama","Kelas","Status","Catatan"];
  const esc2=v=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"';
  const lines=[head.join(",")].concat(rs.map(r=>[
    r.sesi.program==="sabtu"?"Sabtu":"Harian",(KEL.get(r.sesi.groupId)||{}).judul||"",sesiEkskul(r.sesi),
    r.sesi.label,r.sesi.tanggal||"",BULAN[r.sesi.bulan]||"",r.murid.nama,r.murid.kelas,STNAME[r.status],r.catatan
  ].map(esc2).join(",")));
  const csv="﻿"+lines.join("\r\n");
  const name="presensi-ekskul-jhs51-"+new Date().toISOString().slice(0,10)+".csv";
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000);
}

/* ---------- boot ---------- */
const seenPres=new Set();
const CACHE_KEY="ekskul.cache.v1";

function clock(){ const el=$("#clock"); if(el) el.textContent=new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}); }

function simpanCache(d){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify({t:Date.now(), d:d})); }catch(e){} }
function ambilCache(){
  try{ const r=localStorage.getItem(CACHE_KEY); if(!r) return null;
       const o=JSON.parse(r); return (o && o.d && o.d.murid) ? o : null; }
  catch(e){ return null; }
}
function usia(ms){
  const m=Math.round((Date.now()-ms)/60000);
  if(m<1) return "baru saja"; if(m<60) return m+" menit lalu";
  const j=Math.round(m/60); return j<24 ? j+" jam lalu" : Math.round(j/24)+" hari lalu";
}

let barTimer=null;
function bar(teks, jenis){
  const el=$("#sync"); if(!el) return;
  el.className = "syncbar" + (jenis?" "+jenis:"");
  el.textContent = teks;
  el.hidden = false;
  clearTimeout(barTimer);
  if(jenis!=="kerja") barTimer=setTimeout(()=>{ el.hidden=true; }, 4000);
}
function barTutup(){ const el=$("#sync"); if(el) el.hidden=true; clearTimeout(barTimer); }

function layarMuat(pesan){
  $("#main").innerHTML = `<section class="card"><div class="empty"><b>${esc(pesan)}</b>Mengambil data dari spreadsheet sekolah. Pertama kali biasanya butuh beberapa detik.</div></section>`;
}
function layarGagal(pesan){
  $("#main").innerHTML = `<section class="card"><div class="empty"><b>Data belum bisa dimuat</b>${esc(pesan)}</div>
    <div class="card-b" style="text-align:center"><button class="btn" id="ulang">Coba lagi</button></div></section>`;
  on("#ulang","click",mulai);
}

async function mulai(){
  clock();
  if(!PERAN){ layarMasuk(); return; }
  document.body.classList.remove("mode-masuk");
  renderNav();
  const c = ambilCache();
  if(c){ pasangData(c.d); render(); bar("Data tersimpan "+usia(c.t)+" · memperbarui…","kerja"); }
  else { layarMuat("Memuat data ekskul…"); }
  try{
    const d = await api("GET");
    pasangData(d); simpanCache(d); render();
    if(c) bar("Data terbaru","baik"); else barTutup();
  }catch(err){
    if(c) bar("Gagal memperbarui — yang tampil data tersimpan","buruk");
    else layarGagal(String(err && err.message || err));
  }
}

let segarTimer=null;
function jadwalSegar(ms){ clearTimeout(segarTimer); segarTimer=setTimeout(segarkan, ms||2500); }
async function segarkan(){
  if(document.hidden) return;
  try{ const d = await api("GET"); pasangData(d); simpanCache(d); renderSafe(); }catch(e){}
}
setInterval(()=>{ if(!document.hidden && !pendingRender) segarkan(); }, 180000);
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) jadwalSegar(500); });

muatPeran();
mulai();
})();
