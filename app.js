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
  const html = TABS.map(([k,l,p])=>`<button data-tab="${k}" aria-current="${k===tab}">${icon(p)}<span>${l}</span></button>`).join("");
  $("#rail").innerHTML=html; $("#tabs").innerHTML=html;
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{ tab=b.dataset.tab; render(); window.scrollTo({top:0}); });
}
function toast(msg){
  const t=document.createElement("div"); t.className="toast"; t.textContent=msg; document.body.appendChild(t);
  setTimeout(()=>t.remove(),1900);
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
let pState = {program:"daily", groupId:null, sesiId:null, baru:false};
function viewPresensi(){
  const groups = DATA.kelompok.filter(g=>g.program===pState.program);
  if(!pState.groupId || !KEL.get(pState.groupId) || KEL.get(pState.groupId).program!==pState.program){
    pState.groupId = groups[0].id; pState.sesiId=null;
  }
  const g = KEL.get(pState.groupId);
  const ss = sesiOfGroup(g.id);
  if(pState.sesiId && !allSesi().has(pState.sesiId)) pState.sesiId=null;
  if(!pState.sesiId && ss.length) pState.sesiId = ss[ss.length-1].id;

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
    ${db?"":'<div class="hint">Penyimpanan bersama belum aktif di tampilan ini, jadi pertemuan baru belum bisa disimpan.</div>'}
  </div>`;
}

function panelPresensi(g, s){
  const pres = presOf(s.id);
  const ang = anggotaOf(g.id);
  const t = tally(ang.map(m=>pres.get(m.id)).filter(Boolean));
  const meta = dbSesi.get(s.id) || {};
  const ro = canWrite===false;
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
      '<div class="row"><button class="btn ghost" id="pz-all">Tandai semua hadir</button><button class="btn ghost" id="pz-clear">Kosongkan</button></div>'}
  </div>
  <div class="mlist">
    ${ang.map(m=>{
      const e = pres.get(m.id)||{s:"",c:""};
      return `<div class="mrow" data-m="${m.id}">
        <div class="who"><b>${esc(m.nama)}</b><small>${m.kelas}</small></div>
        <div class="seg">${ST.map(([k,l])=>`<button class="${l.toLowerCase()}" data-st="${k}" aria-pressed="${e.s===k}" ${ro?"disabled":""} title="${STNAME[k]}">${l}</button>`).join("")}</div>
        <div class="noteline"><input type="text" data-note="${m.id}" value="${esc(e.c)}" placeholder="Catatan pendampingan untuk ${esc(m.nama.split(" ")[0])} (opsional)" ${ro?"disabled":""}></div>
      </div>`;
    }).join("")}
  </div>
  <div class="card-b" style="border-top:1px solid var(--line)">
    <h3 style="font-size:15px;margin-bottom:10px">Catatan pendampingan pertemuan</h3>
    <div class="filters" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
      <div class="field"><label for="sm-pem">Pembina</label><input type="text" id="sm-pem" value="${esc(meta.pembina||"")}" ${ro?"disabled":""} placeholder="Nama pembina"></div>
      <div class="field"><label for="sm-mat">Materi / kegiatan</label><input type="text" id="sm-mat" value="${esc(meta.materi||"")}" ${ro?"disabled":""} placeholder="Misal: dasar komposisi warna"></div>
    </div>
    <div class="filters" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:12px">
      <div class="field"><label for="sm-ken">Kendala</label><textarea id="sm-ken" ${ro?"disabled":""} placeholder="Hal yang menghambat jalannya kegiatan">${esc(meta.kendala||"")}</textarea></div>
      <div class="field"><label for="sm-tdl">Tindak lanjut</label><textarea id="sm-tdl" ${ro?"disabled":""} placeholder="Yang akan dilakukan pekan depan">${esc(meta.tindakLanjut||"")}</textarea></div>
    </div>
    <p class="note" style="margin-top:10px">Perubahan tersimpan otomatis${s.sumber==="spreadsheet"?" · data awal diimpor dari spreadsheet presensi":""}.</p>
  </div>`;
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
  const catatan = rs.filter(r=>r.catatan).sort((a,b)=> (a.sesi.tanggal||"")<(b.sesi.tanggal||"")?1:-1).slice(0,25);
  const bulanOpts=[...new Set([...allSesi().values()].map(s=>s.bulan))].sort((a,b)=>a-b);

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
    <div class="card-h"><h2>Catatan pendampingan terbaru</h2><span class="sub">dari presensi pada saringan ini</span></div>
    <div class="card-b">
      ${catatan.length? catatan.map(r=>`<div class="histrow"><div>
          <b>${esc(r.murid.nama)}</b> <small>${r.murid.kelas} · ${esc(sesiEkskul(r.sesi))} · ${esc(sesiLabel(r.sesi))}</small>
          <div style="margin-top:4px">${esc(r.catatan)}</div></div>
          <span class="pill p-${r.status}">${STNAME[r.status]}</span></div>`).join("")
        : emptyBox("Belum ada catatan pendampingan","Catatan per murid diisi lewat kolom di bawah nama pada tab Presensi.")}
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
  on("#p-grp","change",e=>{pState.groupId=e.target.value;pState.sesiId=null;pState.baru=false;render()});
  on("#p-ses","change",e=>{pState.sesiId=e.target.value;render()});
  on("#p-new","click",()=>{pState.baru=true;render()});
  on("#nb-cancel","click",()=>{pState.baru=false;render()});
  on("#nb-ok","click",buatPertemuan);
  on("#pz-all","click",()=>massal("hadir"));
  on("#pz-clear","click",()=>massal(""));
  document.querySelectorAll(".mrow [data-st]").forEach(b=>{
    b.addEventListener("click",()=>{
      const mid=b.closest(".mrow").dataset.m, st=b.dataset.st;
      const cur=presOf(pState.sesiId).get(mid);
      tulisMurid(mid, (cur&&cur.s===st)?"":st, undefined);
    });
  });
  document.querySelectorAll("[data-note]").forEach(inp=>{
    inp.addEventListener("input",()=>debounce("n"+inp.dataset.note,()=>tulisMurid(inp.dataset.note,undefined,inp.value),700));
  });
  [["#sm-pem","pembina"],["#sm-mat","materi"],["#sm-ken","kendala"],["#sm-tdl","tindakLanjut"]].forEach(([sel,key])=>{
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
    await api("POST","simpanPresensi",{sesiId:sid, oleh:pencatat(), entri:[{muridId:mid,status:body.s,catatan:body.c}]});
  }catch(err){ toast("Gagal menyimpan: "+err.message); }
}

async function massal(status){
  const sid=pState.sesiId; if(!sid) return;
  const g=KEL.get(pState.groupId); const ang=anggotaOf(g.id);
  const d=dbPres.get(sid)||{murid:{}}; d.murid=d.murid||{};
  const entri=ang.map(m=>{ const cur=presOf(sid).get(m.id)||{s:"",c:""};
    d.murid[m.id]={s:status,c:cur.c||""}; return {muridId:m.id,status:status,catatan:cur.c||""}; });
  dbPres.set(sid,d); render();
  try{
    await api("POST","simpanPresensi",{sesiId:sid, oleh:pencatat(), entri:entri});
    toast(status?"Semua ditandai hadir":"Presensi dikosongkan");
  }catch(err){ toast("Gagal menyimpan: "+err.message); }
}

async function tulisSesi(sid, patch){
  if(!sid) return;
  const cur=dbSesi.get(sid)||Object.assign({},allSesi().get(sid));
  const next=Object.assign({},cur,patch); dbSesi.set(sid,next);
  try{ await api("POST","simpanSesi",Object.assign({id:sid},patch)); }
  catch(err){ toast("Catatan belum tersimpan: "+err.message); }
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
  try{ await api("POST","simpanSesi",s); toast("Pertemuan dibuat"); }
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
function clock(){ const el=$("#clock"); if(el) el.textContent=new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}); }

function layarMuat(pesan){
  $("#main").innerHTML = `<section class="card"><div class="empty"><b>${esc(pesan)}</b>Mengambil data dari spreadsheet sekolah.</div></section>`;
}
function layarGagal(pesan){
  $("#main").innerHTML = `<section class="card"><div class="empty"><b>Data belum bisa dimuat</b>${esc(pesan)}</div>
    <div class="card-b" style="text-align:center"><button class="btn" id="ulang">Coba lagi</button></div></section>`;
  on("#ulang","click",mulai);
}

async function mulai(){
  clock(); renderNav(); layarMuat("Memuat data ekskul…");
  try{
    const d = await api("GET");
    pasangData(d);
    render();
  }catch(err){
    layarGagal(String(err && err.message || err));
  }
}
mulai();
setInterval(()=>{ if(!document.hidden && !pendingRender) segarkan(); }, 60000);
async function segarkan(){
  try{ const d = await api("GET"); pasangData(d); renderSafe(); }catch(e){}
}
})();
