/* =====================================================================
   SI-PANTAU ANGGARAN — pages.js (semua halaman)
   Semua data dibaca dari Store lokal → perpindahan menu & data instan.
   ===================================================================== */
'use strict';

/* ---------- Pembantu halaman ---------- */
function ph(o) {
  return `<div class="ph"><div style="flex:1;min-width:260px">${o.eyebrow ? `<div class="eyebrow">${o.eyebrowIc ? ic(o.eyebrowIc, 'sm') : ''}${esc(o.eyebrow)}</div>` : ''}<h1>${esc(o.title)}</h1>${o.desc ? `<p>${o.desc}</p>` : ''}</div>${o.acts ? `<div class="acts no-print">${o.acts}</div>` : ''}</div>`;
}
const optBidang = (all) => [['', all || 'Semua Bidang']].concat(Store.bidangList().map((b) => [b, b]));
const optBulan = () => K.BULAN.map((b, i) => [i + 1, b]);
const skLabel = (sk) => sk ? `[${sk.Kode_SubKeg || '-'}] ${sk.Nama_SubKegiatan}` : '-';
const pejabatOpts = (first) => [['', first || '— pilih —']].concat(S.t.pengguna.filter((u) => u.Aktif !== 'TIDAK' && (u.Role === 'PEJABAT' || u.Role === 'ADMIN')).sort(byKey('Nama')).map((u) => [u.Email, u.Nama + (u.Jabatan ? ' — ' + u.Jabatan : '')]));
/** Turunan (semua bawahan rekursif) dari email mana pun, dihitung dari tabel Pengguna */
function turunanDari(email) {
  const out = [], seen = {}; const walk = (e) => { S.t.pengguna.forEach((u) => { if (norm(u.Atasan_Email) === norm(e) && !seen[norm(u.Email)]) { seen[norm(u.Email)] = 1; out.push(u.Email); walk(u.Email); } }); };
  walk(email); return out;
}
/** Sub kegiatan dalam tanggung jawab seorang pejabat (PIC dirinya atau turunannya) */
function skLingkup(email) { const set = [email].concat(turunanDari(email)).map(norm); return S.t.subkeg.filter((s) => set.indexOf(norm(s.PIC_Email)) > -1); }
function cutSelect(st, name) { return `<select class="in" name="${name || 'cut'}" aria-label="Posisi data">${K.BULAN.map((b, i) => `<option value="${i + 1}" ${num(st.cut) === i + 1 ? 'selected' : ''}>s.d. ${b}</option>`).join('')}</select>`; }
function selectHtml(name, opts, val, attrs) { return `<select class="in" name="${name}" ${attrs || ''}>${opts.map((o) => { const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`; }

/* =====================================================================
   1. DASHBOARD
   ===================================================================== */
Pages.add({
  id: 'dashboard', title: 'Dashboard', icon: 'dashboard', nav: true, group: 'Menu Utama', short: 'Beranda',
  render(el, q, st) {
    st.cut = st.cut || Calc.cutDefault(); st.bidang = st.bidang == null ? '' : st.bidang;
    const cut = num(st.cut), list = Calc.subkeg({ bidang: st.bidang }), a = Calc.agg(list, cut);
    const kontrak = S.t.kontrak.filter((k) => list.some((s) => s.ID_SubKeg === k.ID_SubKeg));
    const ks = Calc.kesiapan(kontrak), amb = num(S.settings.AMBANG_DEVIASI) || 5;
    const twNow = Math.ceil(cut / 3);
    const groups = [1, 2, 3, 4].map((tw) => { const g = Calc.agg(list, tw === twNow ? cut : tw * 3); const fut = tw > twNow; return { label: 'Triwulan ' + K.ROMAWI[tw], sub: fut ? 'Rencana ' + fmtN(g.ren, 0) + '%' : (tw === twNow ? 'Posisi aktif' : 'Selesai'), values: fut ? [0, 0] : [g.fisik, g.keuPct], dim: fut }; });
    const perBidang = Store.bidangList().filter((b) => !st.bidang || sameBidang(b, st.bidang)).map((b) => ({ b, g: Calc.agg(Calc.subkeg({ bidang: b }), cut) })).filter((x) => x.g.n);
    const warn = list.map((s) => Calc.sk(s, cut)).filter((x) => x.dev < 0).sort((x, y) => x.dev - y.dev).slice(0, 8);
    const telat = kontrak.filter((k) => Calc.kontrakStatus(k) === 'TERLAMBAT').length;
    el.innerHTML = ph({ eyebrow: 'Sistem Monitoring & Pengendalian APBD', title: 'Dashboard Pengendalian & Realisasi Anggaran',
      desc: `Tahun Anggaran ${esc(S.tahun)} · ${esc(S.settings.NAMA_INSTANSI || '')} · Posisi data s.d. ${K.BULAN[cut - 1]} ${esc(S.tahun)}`,
      acts: `${selectHtml('bidang', optBidang('Semua Bidang (' + Store.bidangList().length + ')'), st.bidang)}${cutSelect(st)}<button class="btn pri" data-act="print">${ic('print', 'sm')}Cetak Ringkasan</button>` }) +
    `<div class="grid g4 mb">
      ${kpi({ l: 'Total Pagu Anggaran (DPA)', i: 'bank', v: rpS(a.pagu), title: rp(a.pagu), s: `${chip(a.n + ' Sub Kegiatan', 'slate')} Nilai kontrak ${rpS(a.nilaiKontrak)}` })}
      ${kpi({ l: 'Realisasi Keuangan', i: 'receipt', v: `${rpS(a.keu)}`, title: rp(a.keu), bar: a.keuPct, barCls: 'gold', tick: a.ren, s: `<b class="c-${a.keuPct - a.ren < -amb ? 'err' : 'ok'}">${pct(a.keuPct)}</b> dari pagu · target ${pct(a.ren, 0)}` })}
      ${kpi({ l: 'Realisasi Fisik Rata-rata', i: 'trend', v: `${pct(a.fisik)} <small>tertimbang pagu</small>`, bar: a.fisik, tick: a.ren, s: `Rencana ${pct(a.ren)} · Deviasi ${devChip(a.dev, amb)}${a.belumVerif ? ' · ' + chip(a.belumVerif + ' belum verifikasi', 'warn') : ''}` })}
      ${kpi({ l: 'Kesiapan Audit & Dokumen', i: 'checklist', gold: true, v: `${pct(ks.pct)} <small>(${ks.siap}/${ks.n} kontrak lengkap)</small>`, bar: ks.pct, barCls: 'gold', s: telat ? chip(telat + ' kontrak terlambat', 'err', 'warn') : chip('Tidak ada kontrak terlambat', 'ok') })}
    </div>
    <div class="grid g-73 mb">
      <div class="card"><div class="card-h"><h3>Komparasi Realisasi Fisik vs Keuangan per Triwulan</h3><div class="acts">${Chart.legend([{ name: 'Realisasi Fisik', color: '#1E3A5F' }, { name: 'Realisasi Keuangan', color: '#D4A017' }])}</div><p>Kumulatif s.d. akhir triwulan, tertimbang pagu. Triwulan mendatang ditampilkan abu-abu.</p></div>
        <div class="card-b">${list.length ? Chart.bars({ groups, series: [{ name: 'Fisik', color: '#1E3A5F' }, { name: 'Keuangan', color: '#D4A017' }], max: 100 }) + `<div class="tw mt"><table class="t light"><thead><tr><th>Tahapan</th><th class="n">Rencana fisik</th><th class="n">Real. fisik</th><th class="n">Real. keuangan</th><th class="c">Deviasi</th></tr></thead><tbody>${[1, 2, 3, 4].map((tw) => { const g = Calc.agg(list, Math.min(tw * 3, tw === twNow ? cut : tw * 3)); const fut = tw > twNow; return `<tr class="${tw === twNow ? 'flag' : ''}"><td>Triwulan ${K.ROMAWI[tw]}${tw === twNow ? ' ' + chip('s.d. ' + K.BLN[cut - 1], 'gold') : ''}</td><td class="n">${pct(g.ren)}</td><td class="n">${fut ? '-' : pct(g.fisik)}</td><td class="n">${fut ? '-' : rpS(g.keu) + ' <span class="mini">(' + pct(g.keuPct) + ')</span>'}</td><td class="c">${fut ? chip('Rencana', 'slate') : devChip(g.dev, amb)}</td></tr>`; }).join('')}</tbody></table></div>` : emptyBox('Belum ada sub kegiatan', 'Tambahkan data di menu Perencanaan Anggaran.')}</div></div>
      <div class="card"><div class="card-h"><h3>Realisasi per Bidang Kerja</h3><p>Sebaran pagu dan penyerapan per unit eselon III.</p></div>
        <div class="card-b" style="padding-top:4px">${perBidang.length ? perBidang.map((x) => `<div class="bid"><div class="bid-h"><div><b>${esc(x.b)}</b><small>Pagu ${rp(x.g.pagu)}</small></div><div style="text-align:right"><b class="num">${pct(x.g.keuPct)}</b><small>${rp(x.g.keu)}</small></div></div>
          <div class="bid-r"><span>FISIK</span>${bar(x.g.fisik, '', x.g.ren)}<span>${pct(x.g.fisik)}</span></div><div class="bid-r"><span>KEU</span>${bar(x.g.keuPct, 'gold')}<span>${pct(x.g.keuPct)}</span></div></div>`).join('') : emptyBox('Belum ada data bidang', '')}</div></div>
    </div>
    <div class="card"><div class="card-h"><h3>Sub Kegiatan Realisasi Terendah ${chip('Early Warning', 'err', 'warn')}</h3><div class="acts no-print"><a class="btn sm" href="#/laporan?tab=tabel">${ic('table', 'sm')}Rekap lengkap</a></div><p>Deviasi fisik negatif terhadap rencana s.d. ${K.BULAN[cut - 1]} · ambang toleransi ${amb}%</p></div>
      ${warn.length ? `<div class="tw"><table class="t"><thead><tr><th>Kode</th><th>Sub Kegiatan</th><th>Bidang / PIC</th><th class="n">Pagu (Rp)</th><th class="n">Rencana</th><th class="n">Real. Fisik</th><th class="c">Deviasi</th><th class="n">Real. Keuangan</th></tr></thead><tbody>
      ${warn.map((x) => `<tr class="click ${x.dev <= -amb ? 'flag' : ''}" data-sk="${esc(x.sk.ID_SubKeg)}"><td class="mono">${esc(x.sk.Kode_SubKeg)}</td><td><b>${esc(x.sk.Nama_SubKegiatan)}</b><span class="sub">${esc(x.sk.Nama_Kegiatan)}</span></td><td>${esc(x.sk.Bidang)}<span class="sub">${esc(Store.nama(x.sk.PIC_Email))}</span></td><td class="n">${fmtN(x.pagu)}</td><td class="n">${pct(x.ren)}</td><td class="n">${pct(x.fisik)}</td><td class="c">${devChip(x.dev, amb)}</td><td class="n">${fmtN(x.keu)}<span class="sub">${pct(x.keuPct)}</span></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${ic('check')}<b>Tidak ada deviasi negatif</b><div>Semua sub kegiatan sesuai atau di atas rencana.</div></div>`}
      <div class="card-f">${ic('info', 'sm')}Fisik = % kumulatif terakhir yang diajukan/terverifikasi; keuangan = jumlah SP2D s.d. bulan posisi.</div></div>`;
    el.onchange = (e) => { if (e.target.name === 'bidang' || e.target.name === 'cut') { st[e.target.name] = e.target.value; App.refresh(); } };
    el.onclick = (e) => { if (e.target.closest('[data-act=print]')) window.print(); const r = e.target.closest('[data-sk]'); if (r) App.go('#/realisasi?sk=' + r.dataset.sk); };
  }
});

/* =====================================================================
   2. PERENCANAAN ANGGARAN
   ===================================================================== */
/* Rincian Anggaran Belanja (format SIPD-RI) — dimuat saat dibuka, di-cache per Sub Kegiatan (memori + localStorage, maks 25) */
const RB = {
  mem: {},
  ver(id) { const s = Store.get('subkeg', id) || {}; return String(s.Diperbarui || '') + '|' + (s.Jumlah_Rincian || 0); },
  reset() { this.mem = {}; try { LS.set('sp_rb', {}); } catch (e) { /* abaikan */ } },
  async ambil(id) {
    const v = this.ver(id); let m = this.mem[id];
    if (!m) { const all = LS.get('sp_rb', {}) || {}; m = all[id]; }
    if (m && m.v === v) { this.mem[id] = m; return m.rows; }
    const r = await api('dpa.rincian', { ID_SubKeg: id }, { quiet: true });
    if (!r.success) throw new Error(r.message || 'Gagal memuat rincian belanja.');
    const h = r.data.h, NUM = ['No', 'Volume', 'Harga', 'Jumlah', 'Jumlah_Sebelum', 'Tahun'];
    const rows = r.data.r.map((x) => { const o = {}; h.forEach((k, i) => { const val = x[i] == null ? '' : x[i]; o[k] = NUM.indexOf(k) > -1 && val !== '' ? Number(val) : String(val); }); return o; });
    m = { v, rows }; this.mem[id] = m;
    try { const all = LS.get('sp_rb', {}) || {}; delete all[id]; all[id] = m; const ks = Object.keys(all); while (ks.length > 25) delete all[ks.shift()]; LS.set('sp_rb', all); } catch (e) { /* kuota penuh: cukup di memori */ }
    return rows;
  }
};
/* v1.2.1: pilih uraian dari Rincian DPA (rekening → [#] kelompok → [-] keterangan → item) untuk Nama Paket & Uraian Pekerjaan Kontrak */
const DpaPilih = {
  pot(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; },
  /** Rincian → grup per rekening rinci (kode yang punya kelompok/item di bawahnya). Uraian kembar dalam satu rekening cukup sekali. */
  susun(rows) {
    const daun = new Set(rows.filter((r) => r.Jenis !== 'REK' && r.Kode_Rekening).map((r) => String(r.Kode_Rekening).trim())), grup = new Map();
    rows.forEach((r) => {
      const kode = String(r.Kode_Rekening || '').trim(), ur = String(r.Uraian || '').replace(/\s+/g, ' ').trim();
      if (!kode || !ur || !daun.has(kode)) return;
      if (!grup.has(kode)) grup.set(kode, { kode, nama: '', jumlah: 0, opsi: [], lihat: new Set() });
      const g = grup.get(kode); if (r.Jenis === 'REK') { g.nama = ur; g.jumlah = num(r.Jumlah); }
      const kunci = norm(ur); if (g.lihat.has(kunci)) return; g.lihat.add(kunci);
      g.opsi.push({ jenis: r.Jenis, kode, uraian: ur, jumlah: num(r.Jumlah), vol: r.Jenis === 'ITEM' && r.Volume !== '' ? fmtN(r.Volume, 2).replace(/,00$/, '') + ' ' + (r.Satuan || '') : '' });
    });
    return [...grup.values()];
  },
  label(o) {
    const pre = { KELOMPOK: '\u00a0\u00a0[#] ', KETERANGAN: '\u00a0\u00a0\u00a0\u00a0[-] ', ITEM: '\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0• ' }[o.jenis] || 'Rekening: ';
    return pre + this.pot(o.uraian, 100) + (o.vol ? ' · ' + o.vol : '') + ' — Rp ' + fmtN(Math.round(o.jumlah));
  },
  /** Pasang pilihan di wadah .f. opt = { input: elemen nama/uraian, pakai: Set(norm uraian yang sudah dipakai), isi(o, grup), labelPakai } */
  async pasang(box, idSk, opt) {
    const tok = box.dataset.tok = Math.random().toString(36).slice(2);
    if (!idSk) { box.innerHTML = '<label>Ambil dari Rincian DPA</label><div class="hint" style="margin:0">Pilih Sub Kegiatan terlebih dahulu.</div>'; return; }
    box.innerHTML = '<label>Ambil dari Rincian DPA</label><select class="in" data-dpa disabled><option>Memuat rincian DPA…</option></select><div class="hint"></div>';
    const sel = box.querySelector('select'), hint = box.querySelector('.hint');
    let rows; try { rows = await RB.ambil(idSk); } catch (e) { if (box.dataset.tok === tok) { sel.innerHTML = '<option value="">Rincian DPA gagal dimuat</option>'; hint.textContent = e.message + ' Ketik manual.'; } return; }
    if (box.dataset.tok !== tok) return;
    const grup = this.susun(rows), semua = [];
    if (!grup.length) { sel.innerHTML = '<option value="">Rincian DPA belum diimpor</option>'; hint.innerHTML = 'Impor PDF "RKA/DPA Rincian Belanja" dari SIPD-RI untuk Sub Kegiatan ini di menu Perencanaan Anggaran, atau ketik manual di bawah.'; return; }
    const pakai = opt.pakai || new Set();
    sel.innerHTML = '<option value="">— pilih uraian rekening atau rincian di bawahnya —</option>' + grup.map((g) => `<optgroup label="${esc(g.kode + ' · ' + this.pot(g.nama || 'Rekening', 90))}">${g.opsi.map((o) => { semua.push(o); return `<option value="${semua.length - 1}">${esc((pakai.has(norm(o.uraian)) ? '✓ ' : '') + this.label(o))}</option>`; }).join('')}</optgroup>`).join('');
    sel.disabled = false;
    const dasar = grup.length + ' rekening · ' + semua.length + ' uraian' + ([...pakai].some((u) => semua.some((o) => norm(o.uraian) === u)) ? ' · ✓ = ' + (opt.labelPakai || 'sudah dipakai') : '');
    const tampil = () => {
      const t = norm(opt.input.value), i = t ? semua.findIndex((o) => norm(o.uraian) === t) : -1;
      sel.value = i > -1 ? String(i) : '';
      const o = semua[i];
      hint.innerHTML = o ? `${ic('check', 'sm')} Sesuai uraian DPA · rekening <span class="mono">${esc(o.kode)}</span> · Rp ${fmtN(Math.round(o.jumlah))}` : t ? `<span class="c-warn">${ic('warn', 'sm')} Tidak sama persis dengan uraian DPA mana pun — pilih dari daftar bila memungkinkan.</span>` : esc(dasar);
    };
    sel.onchange = () => { const o = semua[num(sel.value)]; if (sel.value === '' || !o) { tampil(); return; } opt.isi(o, grup.find((g) => g.kode === o.kode)); opt.input.dispatchEvent(new Event('input', { bubbles: true })); tampil(); };
    opt.input.addEventListener('input', tampil);
    tampil();
  }
};
const isContoh = (id) => /^CTH-/.test(String(id || ''));

Pages.add({
  id: 'perencanaan', title: 'Perencanaan Anggaran', icon: 'wallet', nav: true, group: 'Menu Utama',
  render(el, q, st) {
    if (q.sk && Store.get('subkeg', q.sk)) return this.detail(el, q, st);
    st.cari = st.cari || ''; st.bidang = st.bidang || ''; st.prog = st.prog || '';
    const all = S.t.subkeg, prog = [...new Set(all.map((s) => s.Nama_Program).filter(Boolean))];
    const keg = new Set(all.map((s) => s.Kode_Kegiatan + '|' + s.Nama_Kegiatan));
    const tot = all.reduce((a, s) => a + num(s.Pagu), 0);
    const kontrakTot = S.t.kontrak.reduce((a, k) => a + num(k.Nilai_Kontrak), 0);
    el.innerHTML = ph({ eyebrow: 'Master Data DPA', eyebrowIc: 'verified', title: 'Perencanaan Anggaran (RKA / DPA)', desc: `Master data Program, Kegiatan, dan Sub Kegiatan Tahun Anggaran ${esc(S.tahun)}.`,
      acts: (Can.editPlan() ? `<button class="btn" data-act="import">${ic('upload', 'sm')}Impor RKA/DPA (SIPD · Excel · PDF)</button>` : '') + `<button class="btn" data-act="xls">${ic('download', 'sm')}Export Excel</button>` + (Can.editPlan() ? `<button class="btn gold" data-act="add">${ic('add', 'sm')}Tambah Sub Kegiatan</button>` : '') }) +
    `<div class="grid g4 mb">${kpi({ l: 'Total Pagu Induk DPA', i: 'bank', v: rpS(tot), title: rp(tot), s: 'Terkontrak ' + pct(tot ? (kontrakTot / tot) * 100 : 0) })}${kpi({ l: 'Total Program', i: 'tree', v: prog.length, s: 'Program strategis' })}${kpi({ l: 'Total Kegiatan', i: 'task', v: keg.size, s: 'Kegiatan teknis' })}${kpi({ l: 'Total Sub Kegiatan', i: 'checklist', gold: true, v: all.length, s: 'Unit kerja anggaran' })}</div>
    <div class="card mb"><div class="filters"><div class="search">${ic('search')}<input class="in" name="cari" placeholder="Cari kode, nama kegiatan, indikator…" value="${esc(st.cari)}"></div>${selectHtml('prog', [['', 'Semua Program']].concat(prog.map((p) => [p, p])), st.prog)}${selectHtml('bidang', optBidang(), st.bidang)}</div></div>
    <div class="card"><div id="tbl"></div><div class="card-f">${ic('info', 'sm')}Rencana fisik kumulatif per triwulan (default 25/50/75/100%) dipakai untuk menghitung deviasi realisasi.</div></div>`;
    const draw = () => {
      const c = norm(st.cari);
      const rows = all.filter((s) => (!st.bidang || sameBidang(s.Bidang, st.bidang)) && (!st.prog || s.Nama_Program === st.prog) && (!c || norm([s.Kode_SubKeg, s.Nama_SubKegiatan, s.Nama_Kegiatan, s.Nama_Program, s.Indikator].join(' ')).indexOf(c) > -1))
        .sort((a, b) => String(a.Kode_SubKeg).localeCompare(String(b.Kode_SubKeg), 'id', { numeric: true }));
      if (!rows.length) { $('#tbl').innerHTML = emptyBox(all.length ? 'Tidak ada yang cocok dengan filter' : 'Belum ada sub kegiatan', all.length ? 'Ubah kata kunci atau filter.' : 'Tambahkan manual atau impor dari DPA.', Can.editPlan() && !all.length ? `<button class="btn gold mt" data-act="add">${ic('add', 'sm')}Tambah Sub Kegiatan</button>` : ''); return; }
      const groups = {}; rows.forEach((s) => { const p = s.Nama_Program || '(Tanpa program)'; const k = (s.Kode_Kegiatan || '') + '|' + (s.Nama_Kegiatan || '(Tanpa kegiatan)'); groups[p] = groups[p] || { kode: s.Kode_Program, keg: {} }; (groups[p].keg[k] = groups[p].keg[k] || []).push(s); });
      let body = '';
      Object.keys(groups).forEach((p) => {
        const g = groups[p], all_ = Object.values(g.keg).flat();
        body += `<tr class="lv1"><td class="mono">${esc(g.kode || '')}</td><td colspan="2">${ic('folder', 'sm')} ${esc(p)}</td><td class="n">${fmtN(all_.reduce((a, s) => a + num(s.Pagu), 0))}</td><td colspan="3"></td></tr>`;
        Object.keys(g.keg).forEach((k) => {
          const [kode, nama] = k.split('|'), sks = g.keg[k];
          body += `<tr class="lv2"><td class="mono">${esc(kode)}</td><td class="nm" colspan="2">${ic('subdir', 'sm')} ${esc(nama)}</td><td class="n">${fmtN(sks.reduce((a, s) => a + num(s.Pagu), 0))}</td><td colspan="3"></td></tr>`;
          sks.forEach((s) => { const nk = S.t.kontrak.filter((x) => x.ID_SubKeg === s.ID_SubKeg).length;
            body += `<tr class="lv3 ${s._pending ? 'c-mut' : ''}"><td class="mono">${esc(s.Kode_SubKeg)}</td><td class="nm"><a href="#/perencanaan?sk=${esc(s.ID_SubKeg)}"><b>${esc(s.Nama_SubKegiatan)}</b></a>${nk ? ' ' + chip(nk + ' Kontrak', 'gold') : ''}${/SIPD/.test(s.Sumber_Import || '') ? ' ' + chip('SIPD · ' + (s.Jumlah_Rincian || 0) + ' item', 'info') : ''}${isContoh(s.ID_SubKeg) ? ' ' + chip('Contoh', 'slate') : ''}${!s.Bidang || !s.PIC_Email ? ' ' + chip('Lengkapi bidang/PIC', 'warn') : ''}</td><td>${esc(s.Indikator)}<span class="sub c-warn">Target: ${esc(fmtN(s.Target, 2).replace(/,00$/, ''))} ${esc(s.Satuan)}</span></td><td class="n">${fmtN(s.Pagu)}</td><td>${chip(s.Bidang || '-', 'slate')}</td><td>${esc(Store.nama(s.PIC_Email))}<span class="sub">${esc((Store.user(s.PIC_Email) || {}).Jabatan || '')}</span></td>
              <td class="acts"><a class="btn ghost icon" href="#/perencanaan?sk=${esc(s.ID_SubKeg)}" title="Rincian anggaran belanja">${ic('receipt', 'sm')}</a>${Can.editPlan() ? `<button class="btn ghost icon" data-edit="${esc(s.ID_SubKeg)}" title="Ubah">${ic('edit', 'sm')}</button><button class="btn ghost icon" data-del="${esc(s.ID_SubKeg)}" title="Hapus">${ic('trash', 'sm')}</button>` : `<a class="btn ghost icon" href="#/realisasi?sk=${esc(s.ID_SubKeg)}" title="Realisasi">${ic('trend', 'sm')}</a>`}</td></tr>`; });
        });
      });
      $('#tbl').innerHTML = `<div class="tw"><table class="t"><thead><tr><th>Kode</th><th>Program / Kegiatan / Sub Kegiatan</th><th>Indikator & Target</th><th class="n">Pagu (Rp)</th><th>Bidang</th><th>Pejabat PIC</th><th></th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="3">Jumlah (${rows.length} sub kegiatan)</td><td class="n">${fmtN(rows.reduce((a, s) => a + num(s.Pagu), 0))}</td><td colspan="3"></td></tr></tfoot></table></div>`;
    };
    draw();
    el.oninput = debounce((e) => { if (e.target.name === 'cari') { st.cari = e.target.value; draw(); } }, 120);
    el.onchange = (e) => { if (e.target.name === 'bidang' || e.target.name === 'prog') { st[e.target.name] = e.target.value; draw(); } };
    el.onclick = async (e) => {
      const t = e.target.closest('[data-act],[data-edit],[data-del]'); if (!t) return;
      if (t.dataset.act === 'add') Pages.formSubkeg();
      if (t.dataset.act === 'import') Pages.importData('subkeg');
      if (t.dataset.act === 'xls') exportXlsx('DPA_' + S.tahun, [{ name: 'DPA ' + S.tahun, cols: [18, 30, 18, 30, 18, 40, 40, 10, 12, 16, 14, 18, 28, 8, 8, 8, 8], aoa: [['Kode_Program', 'Nama_Program', 'Kode_Kegiatan', 'Nama_Kegiatan', 'Kode_SubKeg', 'Nama_SubKegiatan', 'Indikator', 'Target', 'Satuan', 'Pagu', 'Sumber_Dana', 'Bidang', 'PIC_Email', 'Rencana_TW1', 'Rencana_TW2', 'Rencana_TW3', 'Rencana_TW4']].concat(S.t.subkeg.map((s) => [s.Kode_Program, s.Nama_Program, s.Kode_Kegiatan, s.Nama_Kegiatan, s.Kode_SubKeg, s.Nama_SubKegiatan, s.Indikator, s.Target, s.Satuan, s.Pagu, s.Sumber_Dana, s.Bidang, s.PIC_Email, s.Rencana_TW1, s.Rencana_TW2, s.Rencana_TW3, s.Rencana_TW4])) }]);
      if (t.dataset.edit) Pages.formSubkeg(Store.get('subkeg', t.dataset.edit));
      if (t.dataset.del) {
        const s = Store.get('subkeg', t.dataset.del);
        if (S.t.kontrak.some((k) => k.ID_SubKeg === s.ID_SubKeg) || S.t.realisasi.some((r) => r.ID_SubKeg === s.ID_SubKeg) || S.t.pengadaan.some((p) => p.ID_SubKeg === s.ID_SubKeg)) { toast('Sub kegiatan masih dipakai kontrak/realisasi/paket pengadaan — tidak bisa dihapus.', 'warn'); return; }
        if (!(await confirmBox(`Hapus sub kegiatan <b>${esc(s.Nama_SubKegiatan)}</b>?`, { danger: true, ok: 'Hapus' }))) return;
        mutate('subkeg.hapus', { ID_SubKeg: s.ID_SubKeg }, { optimistic: () => { const old = Store.remove('subkeg', s.ID_SubKeg); return () => Store.upsert('subkeg', old); }, okMsg: 'Sub kegiatan dihapus.' });
      }
    };
  },

  /* ---------- Detail Sub Kegiatan: identitas, indikator, Rincian Anggaran Belanja (format SIPD-RI) ---------- */
  detail(el, q, st) {
    const s = Store.get('subkeg', q.sk), th = num(s.Tahun) || S.tahun, pic = Store.user(s.PIC_Email) || {};
    const paket = S.t.pengadaan.filter((p) => p.ID_SubKeg === s.ID_SubKeg && p.Status !== 'BATAL'), kontrak = S.t.kontrak.filter((k) => k.ID_SubKeg === s.ID_SubKeg), x = Calc.sk(s);
    const beda = num(s.Pagu_Sebelum) ? num(s.Pagu) - num(s.Pagu_Sebelum) : 0, bisaPaket = Can.role('ADMIN', 'PEJABAT', 'STAF') && Can.bidangOk(s.Bidang);
    st.mode = st.mode || 'semua';
    el.innerHTML = `<div class="row mb-s no-print"><a class="btn sm ghost" href="#/perencanaan">${ic('left', 'sm')}Daftar sub kegiatan</a></div>` +
      ph({ eyebrow: 'Rincian Anggaran Belanja Sub Kegiatan' + (s.Tahap_Anggaran ? ' · ' + s.Tahap_Anggaran : ''), eyebrowIc: 'wallet', title: s.Nama_SubKegiatan,
        desc: `<span class="mono">${esc(s.Kode_SubKeg)}</span> · ${esc(s.Bidang || 'bidang belum diisi')} · PIC ${esc(pic.Nama || '—')}${isContoh(s.ID_SubKeg) ? ' · ' + chip('Data contoh', 'slate') : ''}`,
        acts: `<button class="btn" data-act="xlsRb">${ic('excel', 'sm')}Export rincian</button>${bisaPaket ? `<button class="btn" data-act="paket">${ic('gavel', 'sm')}Buat paket pengadaan</button>` : ''}${Can.editPlan() ? `<button class="btn" data-act="imp">${ic('upload', 'sm')}Impor ulang PDF SIPD</button><button class="btn pri" data-act="ubah">${ic('edit', 'sm')}Ubah</button>` : ''}` }) +
      `<div class="grid g4 mb">${kpi({ l: 'Alokasi ' + th, i: 'bank', v: rpS(s.Pagu), title: rp(s.Pagu), s: num(s.Pagu_Sebelum) ? 'Sebelum perubahan ' + rpS(s.Pagu_Sebelum) + ' (' + (beda >= 0 ? '+' : '−') + rpS(Math.abs(beda)) + ')' : 'Pagu sub kegiatan' })}
        ${kpi({ l: 'Rincian belanja', i: 'receipt', v: (num(s.Jumlah_Rincian) || 0) + ' <small>item</small>', s: /SIPD/.test(s.Sumber_Import || '') ? esc(s.Sumber_Import) : 'Belum diimpor dari SIPD' })}
        ${kpi({ l: 'Paket pengadaan', i: 'gavel', gold: true, v: paket.length + ' <small>paket</small>', s: 'HPS ' + rpS(paket.reduce((a, p) => a + num(p.Nilai_HPS), 0)) })}
        ${kpi({ l: 'Realisasi', i: 'trend', v: pct(x.pagu ? (x.keu / x.pagu) * 100 : 0), bar: x.pagu ? (x.keu / x.pagu) * 100 : 0, s: 'Fisik ' + fmtN(x.fisik, 1) + '% · ' + kontrak.length + ' kontrak' })}</div>
      <div class="grid g2 mb"><div class="card"><div class="card-h"><h3>${ic('info', 'sm')}Identitas</h3></div><div class="card-b"><dl class="kv">
        <dt>Program</dt><dd><span class="mono">${esc(s.Kode_Program || '')}</span> ${esc(s.Nama_Program || '-')}</dd><dt>Kegiatan</dt><dd><span class="mono">${esc(s.Kode_Kegiatan || '')}</span> ${esc(s.Nama_Kegiatan || '-')}</dd>
        <dt>Sub Kegiatan</dt><dd><span class="mono">${esc(s.Kode_SubKeg)}</span> ${esc(s.Nama_SubKegiatan)}</dd><dt>Sumber pendanaan</dt><dd>${esc(s.Sumber_Dana || '-')}</dd>
        <dt>Lokasi</dt><dd>${esc(s.Lokasi || '-')}</dd><dt>Waktu pelaksanaan</dt><dd>${esc(s.Waktu_Pelaksanaan || '-')}</dd><dt>Kelompok sasaran</dt><dd>${esc(s.Kelompok_Sasaran || '-')}</dd>
        <dt>Alokasi ${th - 1} / ${th} / ${th + 1}</dt><dd class="num">${rp(s.Alokasi_Lalu || 0)} · <b>${rp(s.Pagu)}</b> · ${rp(s.Alokasi_Depan || 0)}</dd></dl></div></div>
        <div class="card"><div class="card-h"><h3>${ic('verified', 'sm')}Indikator & tolok ukur kinerja</h3></div><div class="tw"><table class="t light"><thead><tr><th>Indikator</th><th>Tolok ukur kinerja</th><th>Target kinerja</th></tr></thead><tbody>
        ${[['Capaian Program', (s.Capaian_Program || '').split(' — ')[0], (s.Capaian_Program || '').split(' — ')[1]], ['Masukan', 'Dana yang dibutuhkan', rp(s.Pagu)], ['Keluaran', s.Indikator, (s.Target !== '' ? fmtN(s.Target, 2).replace(/,00$/, '') + ' ' : '') + (s.Satuan || '')], ['Hasil', (s.Hasil || '').split(' — ')[0], (s.Hasil || '').split(' — ')[1]]]
          .map((r) => `<tr><td><b>${r[0]}</b></td><td>${esc(r[1] || '-')}</td><td>${esc(r[2] || '-')}</td></tr>`).join('')}</tbody></table></div></div></div>
      <div class="card"><div class="card-h"><h3>${ic('table', 'sm')}Rincian Anggaran Belanja Sub Kegiatan</h3><div class="row" style="margin-left:auto">${[['semua', 'Semua baris'], ['rek', 'Rekening'], ['item', 'Item belanja']].map((m) => `<button class="btn sm ${st.mode === m[0] ? 'pri' : ''}" data-mode="${m[0]}">${m[1]}</button>`).join('')}</div></div><div id="rbBox"><div class="card-b">${'<div class="sk" style="margin:10px 0"></div>'.repeat(5)}</div></div></div>`;
    let rows = null;
    const draw = () => {
      const box = $('#rbBox'); if (!box) return;
      if (!rows.length) { box.innerHTML = `<div class="card-b">${emptyBox('Belum ada rincian belanja', 'Impor PDF "Cetak RKA/DPA Rincian Belanja" Sub Kegiatan ini dari SIPD-RI — kode rekening, uraian, koefisien, harga, dan jumlah akan tampil di sini.', Can.editPlan() ? `<button class="btn gold mt" data-act="imp">${ic('upload', 'sm')}Impor PDF SIPD</button>` : '')}</div>`; return; }
      const ubah = rows.some((r) => r.Jumlah_Sebelum !== '' && r.Jumlah_Sebelum != null), lv = (k) => String(k || '').split('.').length;
      const tampil = rows.filter((r) => st.mode === 'semua' || (st.mode === 'rek' ? r.Jenis === 'REK' : r.Jenis === 'ITEM'));
      const rp0 = (v) => (v === '' || v == null ? '' : fmtN(v, 2).replace(/,00$/, ''));
      const tot = rows.find((r) => r.Jenis === 'REK' && lv(r.Kode_Rekening) === 1), totJ = tot ? tot.Jumlah : rows.filter((r) => r.Jenis === 'ITEM').reduce((a, r) => a + num(r.Jumlah), 0), totS = tot ? tot.Jumlah_Sebelum : '';
      box.innerHTML = `<div class="tw"><table class="t rb"><thead><tr><th>Kode rekening</th><th style="min-width:260px">Uraian</th><th>Koefisien</th><th>Satuan</th><th class="n">Harga (Rp)</th><th class="c">PPN</th><th class="n">Jumlah (Rp)</th>${ubah ? '<th class="n">Sebelum (Rp)</th><th class="n">Bertambah / (Berkurang)</th>' : ''}</tr></thead><tbody>
        ${tampil.map((r) => { const sel = ubah ? `<td class="n mini">${rp0(r.Jumlah_Sebelum)}</td><td class="n mini ${num(r.Jumlah) - num(r.Jumlah_Sebelum) < 0 ? 'c-err' : ''}">${r.Jumlah_Sebelum === '' ? '' : rp0(num(r.Jumlah) - num(r.Jumlah_Sebelum))}</td>` : '';
          if (r.Jenis === 'REK') { const l = lv(r.Kode_Rekening); return `<tr class="${l <= 3 ? 'lv1' : l <= 5 ? 'lv2' : 'lv3'}"><td class="mono">${esc(r.Kode_Rekening)}</td><td colspan="5"><b>${esc(r.Uraian)}</b></td><td class="n"><b>${rp0(r.Jumlah)}</b></td>${sel}</tr>`; }
          if (r.Jenis === 'KELOMPOK') return `<tr><td></td><td colspan="5"><b>[ # ] ${esc(r.Uraian)}</b>${r.Sumber_Dana ? `<span class="sub">Sumber Dana: ${esc(r.Sumber_Dana)}</span>` : ''}</td><td class="n"><b>${rp0(r.Jumlah)}</b></td>${sel}</tr>`;
          if (r.Jenis === 'KETERANGAN') return `<tr><td></td><td colspan="5">[ - ] ${esc(r.Uraian)}</td><td class="n">${rp0(r.Jumlah)}</td>${sel}</tr>`;
          return `<tr><td class="mono mini c-mut">${st.mode === 'item' ? esc(r.Kode_Rekening) : ''}</td><td>${esc(r.Uraian)}${r.Spesifikasi ? `<span class="sub">Spesifikasi: ${esc(r.Spesifikasi)}</span>` : ''}</td><td>${esc(r.Koefisien || rp0(r.Volume))}${ubah && r.Koefisien_Sebelum && r.Koefisien_Sebelum !== r.Koefisien ? `<span class="sub">sebelum ${esc(r.Koefisien_Sebelum)}</span>` : ''}</td><td>${esc(r.Satuan)}</td><td class="n">${rp0(r.Harga)}</td><td class="c">${esc(r.PPN || '-')}</td><td class="n">${rp0(r.Jumlah)}</td>${sel}</tr>`; }).join('')}
        </tbody><tfoot><tr><td colspan="6">Jumlah Anggaran Sub Kegiatan</td><td class="n">${rp0(totJ)}</td>${ubah ? `<td class="n">${rp0(totS)}</td><td class="n">${totS === '' ? '' : rp0(num(totJ) - num(totS))}</td>` : ''}</tr></tfoot></table></div>
        ${Math.abs(num(totJ) - num(s.Pagu)) > 1 ? `<div class="note warn" style="margin:12px">${ic('warn', 'sm')}<div>Jumlah rincian (${rp(totJ)}) berbeda dengan pagu sub kegiatan (${rp(s.Pagu)}). Impor ulang PDF SIPD terbaru atau periksa pagu.</div></div>` : ''}`;
    };
    RB.ambil(s.ID_SubKeg).then((r) => { rows = r; draw(); }, (e) => { const box = $('#rbBox'); if (box) box.innerHTML = `<div class="card-b"><div class="note err">${ic('warn', 'sm')}<div>${esc(e.message)}</div></div></div>`; });
    el.onclick = (e) => {
      const t = e.target.closest('[data-act],[data-mode]'); if (!t) return;
      if (t.dataset.mode) { st.mode = t.dataset.mode; $$('[data-mode]', el).forEach((b) => b.classList.toggle('pri', b.dataset.mode === st.mode)); if (rows) draw(); return; }
      const a = t.dataset.act;
      if (a === 'ubah') Pages.formSubkeg(s);
      if (a === 'imp') Pages.importData('subkeg');
      if (a === 'paket') Pages.formPaket(null, { ID_SubKeg: s.ID_SubKeg, Nama_Paket: '', Lokasi: s.Lokasi && !/^Semua/.test(s.Lokasi) ? s.Lokasi : '' });
      if (a === 'xlsRb') {
        if (!rows) { toast('Rincian masih dimuat.', 'info'); return; }
        const H = ['Jenis', 'Kode_Rekening', 'Uraian', 'Spesifikasi', 'Koefisien', 'Satuan', 'Harga', 'PPN', 'Jumlah', 'Koefisien_Sebelum', 'Jumlah_Sebelum', 'Sumber_Dana'];
        exportXlsx('Rincian_' + s.Kode_SubKeg, [{ name: 'Rincian Belanja', cols: [11, 22, 50, 40, 18, 14, 16, 8, 18, 18, 18, 30], aoa: [['RINCIAN ANGGARAN BELANJA — ' + s.Kode_SubKeg + ' ' + s.Nama_SubKegiatan], [s.Tahap_Anggaran || 'TA ' + th], [], H].concat(rows.map((r) => H.map((k) => r[k]))) }]);
      }
    };
  }
});
Pages.formSubkeg = function (s, prefill) {
  const baru = !s; s = Object.assign({ Tahun: S.tahun, Rencana_TW1: 25, Rencana_TW2: 50, Rencana_TW3: 75, Rencana_TW4: 100, Sumber_Dana: 'APBD' }, s || {}, prefill || {});
  const progs = [...new Set(S.t.subkeg.map((x) => x.Kode_Program + '|' + x.Nama_Program))];
  const m = modal({ title: baru ? 'Tambah Sub Kegiatan' : 'Ubah Sub Kegiatan', icon: 'wallet', size: 'lg',
    body: `<form class="fg" id="fSk"><div class="sect">Nomenklatur</div>
      ${fld({ name: 'Kode_Program', label: 'Kode Program', value: s.Kode_Program, span: 's4', ph: '2.15.03' })}${fld({ name: 'Nama_Program', label: 'Nama Program', value: s.Nama_Program, span: 's8', req: true })}
      ${fld({ name: 'Kode_Kegiatan', label: 'Kode Kegiatan', value: s.Kode_Kegiatan, span: 's4', ph: '2.15.03.2.12' })}${fld({ name: 'Nama_Kegiatan', label: 'Nama Kegiatan', value: s.Nama_Kegiatan, span: 's8', req: true })}
      ${fld({ name: 'Kode_SubKeg', label: 'Kode Sub Kegiatan', value: s.Kode_SubKeg, span: 's4', req: true, ph: '2.15.03.2.12.0004' })}${fld({ name: 'Nama_SubKegiatan', label: 'Nama Sub Kegiatan', value: s.Nama_SubKegiatan, span: 's8', req: true })}
      <div class="sect">Target & Anggaran</div>
      ${fld({ name: 'Indikator', label: 'Indikator Kinerja', value: s.Indikator, span: 's6', type: 'textarea', rows: 2 })}${fld({ name: 'Target', label: 'Target', value: s.Target, span: 's3', type: 'num' })}${fld({ name: 'Satuan', label: 'Satuan', value: s.Satuan, span: 's3', ph: 'Paket / Unit / Dokumen' })}
      ${fld({ name: 'Pagu', label: 'Pagu Anggaran', value: s.Pagu, span: 's6', type: 'rp', req: true })}${fld({ name: 'Sumber_Dana', label: 'Sumber Dana', value: s.Sumber_Dana, span: 's6' })}
      ${fld({ name: 'Bidang', label: 'Bidang Pengampu', value: s.Bidang, span: 's6', type: 'select', opts: optBidang('— pilih —'), req: true })}${fld({ name: 'PIC_Email', label: 'Pejabat PIC (verifikator realisasi)', value: s.PIC_Email, span: 's6', type: 'select', opts: pejabatOpts() })}
      <div class="sect">Informasi DPA / SIPD (opsional)</div>
      ${fld({ name: 'Lokasi', label: 'Lokasi', value: s.Lokasi, span: 's6' })}${fld({ name: 'Waktu_Pelaksanaan', label: 'Waktu pelaksanaan', value: s.Waktu_Pelaksanaan, span: 's6', ph: 'Januari s.d Desember' })}
      ${fld({ name: 'Pagu_Sebelum', label: 'Pagu sebelum perubahan', value: s.Pagu_Sebelum, span: 's6', type: 'rp', hint: 'Diisi bila DPA perubahan (DPPA)' })}${fld({ name: 'Tahap_Anggaran', label: 'Tahap anggaran', value: s.Tahap_Anggaran, span: 's6', ph: 'Penetapan APBD / Perubahan APBD ' + S.tahun })}
      ${fld({ name: 'Capaian_Program', label: 'Capaian program (tolok ukur — target)', value: s.Capaian_Program, ph: 'Konektivitas Laut — 50 Nilai' })}
      <div class="sect">Rencana fisik kumulatif per triwulan (%)</div>
      ${[1, 2, 3, 4].map((i) => fld({ name: 'Rencana_TW' + i, label: 'TW ' + K.ROMAWI[i], value: s['Rencana_TW' + i], span: 's3', type: 'pct' })).join('')}
      <datalist id="dlProg">${progs.map((p) => `<option value="${esc(p.split('|')[1])}">`).join('')}</datalist></form>`,
    foot: `<button class="btn" data-x>Batal</button><button class="btn pri" data-save>${ic('save', 'sm')}Simpan</button>` });
  m.el.querySelector('[name=Nama_Program]').setAttribute('list', 'dlProg');
  m.el.querySelector('[name=Nama_Program]').addEventListener('change', (e) => { const p = progs.find((x) => x.split('|')[1] === e.target.value); if (p) m.el.querySelector('[name=Kode_Program]').value = p.split('|')[0]; });
  m.el.querySelector('[data-save]').onclick = () => {
    const v = validate(m.el, { Nama_Program: req('Nama program'), Nama_Kegiatan: req('Nama kegiatan'), Kode_SubKeg: req('Kode sub kegiatan'), Nama_SubKegiatan: req('Nama sub kegiatan'), Pagu: (x) => (x > 0 ? '' : 'Pagu harus lebih dari 0.'), Bidang: req('Bidang'),
      Rencana_TW4: (x, all) => ([1, 2, 3, 4].some((i) => all['Rencana_TW' + i] < 0 || all['Rencana_TW' + i] > 100) ? 'Rencana 0–100%.' : (all.Rencana_TW1 > all.Rencana_TW2 || all.Rencana_TW2 > all.Rencana_TW3 || all.Rencana_TW3 > all.Rencana_TW4 ? 'Rencana harus naik (kumulatif).' : '')) });
    if (!v) return;
    if (S.t.subkeg.some((x) => x.Kode_SubKeg === v.Kode_SubKeg && x.ID_SubKeg !== s.ID_SubKeg)) { toast('Kode sub kegiatan sudah dipakai.', 'warn'); return; }
    const data = Object.assign({}, v, { Tahun: S.tahun }); if (!baru) data.ID_SubKeg = s.ID_SubKeg;
    m.close();
    mutate('subkeg.simpan', data, { table: 'subkeg', temp: data, okMsg: baru ? 'Sub kegiatan ditambahkan.' : 'Perubahan disimpan.', retry: () => Pages.formSubkeg(baru ? null : s, v) });
  };
};

/* =====================================================================
   3. KONTRAK PENGADAAN
   ===================================================================== */
Pages.add({
  id: 'kontrak', title: 'Kontrak Pengadaan', icon: 'kontrak', nav: true, group: 'Menu Utama', short: 'Kontrak',
  render(el, q, st) {
    st.cari = st.cari || ''; st.bidang = st.bidang || ''; st.status = q.f || st.status || ''; st.metode = st.metode || ''; st.pg = st.pg || 1;
    const all = S.t.kontrak, aktif = all.filter((k) => k.Status === 'AKTIF' || Calc.kontrakStatus(k) === 'TERLAMBAT');
    const nilai = all.reduce((a, k) => a + num(k.Nilai_Kontrak), 0);
    const bayar = (k) => Calc.bayarKontrak(k);
    const dibayar = all.reduce((a, k) => a + bayar(k), 0);
    const amb = num(S.settings.AMBANG_DEVIASI) || 5;
    const kondisi = (k) => { const sk = Store.get('subkeg', k.ID_SubKeg); if (Calc.kontrakStatus(k) === 'TERLAMBAT') return 'Lambat'; if (sk && Calc.sk(sk).dev <= -amb) return 'Kritis'; return 'Normal'; };
    const cnt = { Normal: 0, Kritis: 0, Lambat: 0 }; aktif.forEach((k) => { cnt[kondisi(k)]++; });
    const ks = Calc.kesiapan(all);
    el.innerHTML = ph({ eyebrow: 'Pengadaan Barang & Jasa · Kontrak Pelaksanaan', title: 'Daftar Kontrak Pengadaan (SPK & Kontrak Kerja)', desc: `Status kontrak penyedia, nilai perjanjian, jangka waktu, dan keterkaitan dengan Sub Kegiatan DPA TA ${esc(S.tahun)}.`,
      acts: `<button class="btn" data-act="xls">${ic('download', 'sm')}Export Excel</button>` + (Can.role('ADMIN', 'PEJABAT', 'STAF') ? `<button class="btn gold" data-act="add">${ic('add', 'sm')}Tambah Kontrak</button>` : '') }) +
    `<div class="grid g4 mb">${kpi({ l: 'Total Kontrak Aktif', i: 'kontrak', v: `${aktif.length} <small>Paket</small>`, s: 'Nilai seluruh kontrak ' + rpS(nilai) })}
      ${kpi({ l: 'Realisasi Pembayaran SP2D', i: 'receipt', v: rpS(dibayar), title: rp(dibayar), bar: nilai ? (dibayar / nilai) * 100 : 0, barCls: 'gold', s: 'Sisa tagihan ' + rpS(nilai - dibayar) })}
      ${kpi({ l: 'Status Kinerja Pelaksanaan', i: 'speed', v: `${cnt.Normal} <small>/ ${aktif.length} on track</small>`, s: `${chip(cnt.Kritis + ' Kritis', 'warn')} ${chip(cnt.Lambat + ' Lambat', 'err')}` })}
      ${kpi({ l: 'Kesiapan Audit Dokumen', i: 'checklist', gold: true, v: pct(ks.pct), bar: ks.pct, s: ks.siap + ' dari ' + ks.n + ' kontrak berkas lengkap' })}</div>
    <div class="card mb"><div class="filters"><div class="search">${ic('search')}<input class="in" name="cari" placeholder="Cari nomor SPK, penyedia, atau uraian pekerjaan…" value="${esc(st.cari)}"></div>${selectHtml('bidang', optBidang(), st.bidang)}${selectHtml('status', [['', 'Semua Status']].concat(Object.keys(K.ST_KONTRAK).map((k) => [k, K.ST_KONTRAK[k][0]])), st.status)}${selectHtml('metode', [['', 'Semua Metode']].concat(K.METODE.map((m) => [m, m])), st.metode)}</div></div>
    <div class="card" id="tbl"></div>`;
    const draw = () => {
      const c = norm(st.cari);
      const rows = all.filter((k) => { const sk = Store.get('subkeg', k.ID_SubKeg) || {};
        return (!st.bidang || sameBidang(sk.Bidang, st.bidang)) && (!st.status || Calc.kontrakStatus(k) === st.status) && (!st.metode || k.Metode === st.metode) && (!c || norm([k.No_SPK, k.Penyedia, k.Uraian_Pekerjaan, k.Direktur, sk.Nama_SubKegiatan].join(' ')).indexOf(c) > -1); })
        .sort((a, b) => String(b.Tgl_SPK || '').localeCompare(String(a.Tgl_SPK || '')));
      const per = 10, pages = Math.max(1, Math.ceil(rows.length / per)); st.pg = clamp(st.pg, 1, pages);
      const view = rows.slice((st.pg - 1) * per, st.pg * per);
      if (!rows.length) { $('#tbl').innerHTML = emptyBox(all.length ? 'Tidak ada kontrak yang cocok' : 'Belum ada kontrak', all.length ? 'Ubah filter pencarian.' : 'Tambahkan kontrak pertama untuk sub kegiatan.'); return; }
      $('#tbl').innerHTML = `<div class="tw"><table class="t"><thead><tr><th>No</th><th>Sub Kegiatan & SPK</th><th>Penyedia Jasa</th><th class="n">Nilai Kontrak (Rp)</th><th>Jangka Waktu & Sisa</th><th>Fisik vs Rencana</th><th class="c">Berkas</th><th class="c">Status</th><th></th></tr></thead><tbody>
        ${view.map((k, i) => { const sk = Store.get('subkeg', k.ID_SubKeg) || {}; const s = sk.ID_SubKeg ? Calc.sk(sk) : null; const st_ = Calc.kontrakStatus(k); const sisa = Calc.sisaHari(k);
          const durasi = k.Tgl_Mulai && k.Tgl_Selesai ? Math.max(1, daysBetween(k.Tgl_Mulai, k.Tgl_Selesai)) : 0; const jalan = durasi ? clamp(daysBetween(k.Tgl_Mulai, todayISO()) / durasi * 100, 0, 100) : 0;
          const cl = Calc.checklist(k.ID_Kontrak); const by = bayar(k);
          return `<tr class="${st_ === 'TERLAMBAT' ? 'flag' : ''}"><td>${(st.pg - 1) * per + i + 1}</td>
          <td style="min-width:240px"><span class="mono c-warn">${esc(sk.Kode_SubKeg || '')}</span><b style="display:block">${esc(sk.Nama_SubKegiatan || '(sub kegiatan tidak ditemukan)')}</b><span class="sub"><b class="mono">${esc(k.No_SPK)}</b> · ${tgl(k.Tgl_SPK)}</span></td>
          <td style="min-width:180px"><b>${esc(k.Penyedia)}</b><span class="sub">${esc(k.Direktur ? 'Dir: ' + k.Direktur : '')}</span><span class="sub">${esc(k.Metode || '')}</span></td>
          <td class="n"><b>${fmtN(k.Nilai_Kontrak)}</b><span class="sub">Dibayar ${fmtN(by)}</span></td>
          <td style="min-width:170px"><span class="mini">${tgl(k.Tgl_Mulai)} – ${tgl(k.Tgl_Selesai)}</span>${bar(jalan, st_ === 'TERLAMBAT' ? 'err' : jalan > 85 ? 'warn' : '')}<span class="sub ${sisa != null && sisa < 0 ? 'c-err' : ''}">${k.Status === 'SELESAI' ? 'Selesai' : sisa == null ? '-' : sisa >= 0 ? 'Sisa ' + sisa + ' hari' : 'Lewat ' + -sisa + ' hari'}</span></td>
          <td style="min-width:130px">${s ? `<span class="mini">Fisik <b>${pct(s.fisik)}</b></span>${bar(s.fisik, '', s.ren)}<span class="sub">${devChip(s.dev, amb)}</span>` : '-'}</td>
          <td class="c"><a href="#/checklist?k=${esc(k.ID_Kontrak)}" class="chip ${cl.pct >= 99.9 ? 'ok' : cl.pct >= 60 ? 'warn' : 'err'}">${fmtN(cl.pct, 0)}%</a></td>
          <td class="c">${stChip(K.ST_KONTRAK, st_)}${k._pending ? '<span class="sub">menyimpan…</span>' : ''}</td>
          <td class="acts"><button class="btn ghost icon" data-view="${esc(k.ID_Kontrak)}" title="Detail">${ic('eye', 'sm')}</button>${Can.editKontrak(sk) ? `<button class="btn ghost icon" data-edit="${esc(k.ID_Kontrak)}" title="Ubah">${ic('edit', 'sm')}</button>` : ''}<a class="btn ghost icon" href="#/arsip?k=${esc(k.ID_Kontrak)}" title="Arsip dokumen">${ic('arsip', 'sm')}</a></td></tr>`; }).join('')}
        </tbody></table></div>${pager(rows.length, st.pg, per)}`;
    };
    draw();
    el.oninput = debounce((e) => { if (e.target.name === 'cari') { st.cari = e.target.value; st.pg = 1; draw(); } }, 120);
    el.onchange = (e) => { if (['bidang', 'status', 'metode'].indexOf(e.target.name) > -1) { st[e.target.name] = e.target.value; st.pg = 1; if (e.target.name === 'status' && q.f) { history.replaceState(null, '', '#/kontrak'); } draw(); } };
    el.onclick = (e) => {
      const pg = e.target.closest('[data-pg]'); if (pg && !pg.disabled) { st.pg = num(pg.dataset.pg); draw(); return; }
      const t = e.target.closest('[data-act],[data-edit],[data-view]'); if (!t) return;
      if (t.dataset.act === 'add') Pages.formKontrak();
      if (t.dataset.edit) Pages.formKontrak(Store.get('kontrak', t.dataset.edit));
      if (t.dataset.view) Pages.detailKontrak(t.dataset.view);
      if (t.dataset.act === 'xls') exportXlsx('Kontrak_' + S.tahun, [{ name: 'Kontrak ' + S.tahun, cols: [22, 16, 12, 40, 30, 24, 16, 18, 12, 12, 12, 10, 10], aoa: [['No_SPK', 'Kode_SubKeg', 'Tgl_SPK', 'Uraian_Pekerjaan', 'Penyedia', 'Direktur', 'NPWP', 'Nilai_Kontrak', 'Metode', 'Tgl_Mulai', 'Tgl_Selesai', 'Status', 'Kelengkapan_%']].concat(all.map((k) => [k.No_SPK, (Store.get('subkeg', k.ID_SubKeg) || {}).Kode_SubKeg, k.Tgl_SPK, k.Uraian_Pekerjaan, k.Penyedia, k.Direktur, k.NPWP, k.Nilai_Kontrak, k.Metode, k.Tgl_Mulai, k.Tgl_Selesai, Calc.kontrakStatus(k), Math.round(Calc.checklist(k.ID_Kontrak).pct)])) }]);
    };
  }
});
Pages.formKontrak = function (k, prefill) {
  const baru = !k; k = Object.assign({ Status: 'AKTIF', Jabatan_Direktur: 'Direktur' }, k || {}, prefill || {});
  const sks = S.t.subkeg.filter((s) => Can.editKontrak(s) || s.ID_SubKeg === k.ID_SubKeg).sort(byKey('Kode_SubKeg'));
  if (!sks.length) { toast('Belum ada sub kegiatan di bidang Anda. Tambahkan di Perencanaan Anggaran.', 'warn'); return; }
  const m = modal({ title: baru ? 'Tambah Kontrak / SPK' : 'Ubah Kontrak ' + (k.No_SPK || ''), icon: 'kontrak', size: 'lg',
    body: `<form class="fg"><div class="sect">Paket pekerjaan</div>
      ${fld({ name: 'ID_SubKeg', label: 'Sub Kegiatan DPA', type: 'select', value: k.ID_SubKeg, req: true, opts: [['', '— pilih sub kegiatan —']].concat(sks.map((s) => [s.ID_SubKeg, skLabel(s)])) })}
      <div class="f" id="kPaket"></div>
      <div class="f"><div class="row"><button type="button" class="btn sm" data-spk>${ic('upload', 'sm')}Isi otomatis dari dokumen SPK (Word/Excel/PDF)</button><input type="file" id="fileSpk" class="hidden" accept=".docx,.xlsx,.xls,.pdf,.txt"><span class="mini">Nomor, tanggal, nilai, penyedia, NPWP ditebak dari teks — periksa sebelum simpan.</span></div></div>
      ${fld({ name: 'No_SPK', label: 'Nomor SPK / Kontrak', value: k.No_SPK, span: 's8', req: true, ph: '027/04/SPK-PPK/DISHUB/2026' })}${fld({ name: 'Tgl_SPK', label: 'Tanggal SPK', value: k.Tgl_SPK, type: 'date', span: 's4', req: true })}
      <div class="f" id="kDpa"></div>
      ${fld({ name: 'Uraian_Pekerjaan', label: 'Uraian Pekerjaan', value: k.Uraian_Pekerjaan, type: 'textarea', rows: 2, req: true, hint: 'Sebaiknya sama dengan uraian di DPA — pilih dari daftar di atas.' })}
      ${fld({ name: 'Nilai_Kontrak', label: 'Nilai Kontrak', value: k.Nilai_Kontrak, type: 'rp', span: 's6', req: true })}${fld({ name: 'Metode', label: 'Metode Pengadaan', value: k.Metode, type: 'select', span: 's6', opts: [['', '— pilih —']].concat(K.METODE.map((x) => [x, x])) })}
      ${fld({ name: 'Tgl_Mulai', label: 'Mulai', value: k.Tgl_Mulai, type: 'date', span: 's4', req: true })}${fld({ name: 'Tgl_Selesai', label: 'Selesai', value: k.Tgl_Selesai, type: 'date', span: 's4', req: true })}${fld({ name: 'Status', label: 'Status', value: k.Status, type: 'select', span: 's4', opts: [['DRAF', 'Draf'], ['AKTIF', 'Aktif'], ['SELESAI', 'Selesai'], ['PUTUS', 'Putus Kontrak']] })}
      <div class="sect">Penyedia</div>
      ${fld({ name: 'Penyedia', label: 'Nama Penyedia (CV/PT)', value: k.Penyedia, span: 's6', req: true })}${fld({ name: 'NPWP', label: 'NPWP', value: k.NPWP, span: 's6' })}
      ${fld({ name: 'Direktur', label: 'Nama Penandatangan Penyedia', value: k.Direktur, span: 's6' })}${fld({ name: 'Jabatan_Direktur', label: 'Jabatan', value: k.Jabatan_Direktur, span: 's6' })}
      ${fld({ name: 'Alamat_Penyedia', label: 'Alamat Penyedia', value: k.Alamat_Penyedia, type: 'textarea', rows: 2 })}
      <div class="sect">Rekening pembayaran</div>
      ${fld({ name: 'Nama_Bank', label: 'Bank', value: k.Nama_Bank, span: 's4' })}${fld({ name: 'No_Rekening', label: 'Nomor Rekening', value: k.No_Rekening, span: 's4' })}${fld({ name: 'Nama_Rekening', label: 'Atas Nama', value: k.Nama_Rekening, span: 's4' })}
      ${fld({ name: 'Catatan', label: 'Catatan', value: k.Catatan, type: 'textarea', rows: 2 })}</form>`,
    foot: `${!baru && Can.hapusKontrak() ? `<button class="btn danger" data-del style="margin-right:auto">${ic('trash', 'sm')}Hapus</button>` : ''}<button class="btn" data-x>Batal</button><button class="btn pri" data-save>${ic('save', 'sm')}Simpan Kontrak</button>` });
  /* v1.1: paket pengadaan (Instruksi/HPS/Spesifikasi) yang menjadi dasar kontrak */
  const drawPaket = (idSk) => {
    const box = m.el.querySelector('#kPaket'); const ps = S.t.pengadaan.filter((p) => p.ID_SubKeg === idSk && (p.ID_Paket === k.ID_Paket || (p.Status !== 'BATAL' && (!p.ID_Kontrak || p.ID_Kontrak === k.ID_Kontrak))));
    if (!idSk || !ps.length) { box.innerHTML = `<input type="hidden" name="ID_Paket" value=""><div class="hint" style="margin:0">${idSk ? 'Belum ada paket pengadaan (HPS) untuk sub kegiatan ini — kontrak tetap dapat disimpan tanpa paket.' : ''}</div>`; return; }
    const cur = ps.some((p) => p.ID_Paket === k.ID_Paket) ? k.ID_Paket : '';
    box.innerHTML = `<label>Paket pengadaan (HPS) — opsional</label>${selectHtml('ID_Paket', [['', '— tanpa paket pengadaan —']].concat(ps.map((p) => [p.ID_Paket, p.Nama_Paket + ' · HPS ' + rp(p.Nilai_HPS)])), cur)}<div class="hint" id="kPaketInfo"></div>`;
    infoPaket();
  };
  const infoPaket = () => { const sel = m.el.querySelector('select[name=ID_Paket]'), inf = m.el.querySelector('#kPaketInfo'); if (!sel || !inf) return; const p = Store.get('pengadaan', sel.value); inf.innerHTML = p ? `HPS ${rp(p.Nilai_HPS)} · ${esc(p.Metode || 'metode belum diisi')} · arsip Instruksi/HPS/Spesifikasi paket ini ikut terhitung di checklist kontrak.` : 'Tautkan bila kontrak ini hasil dari paket pengadaan di menu Pengadaan Barang/Jasa.'; };
  drawPaket(k.ID_SubKeg);
  const fK = m.el.querySelector('form');
  const drawDpa = (idSk) => DpaPilih.pasang(m.el.querySelector('#kDpa'), idSk, { input: fK.Uraian_Pekerjaan, labelPakai: 'sudah dipakai kontrak lain',
    pakai: new Set(S.t.kontrak.filter((x) => x.ID_SubKeg === idSk && x.ID_Kontrak !== k.ID_Kontrak).map((x) => norm(x.Uraian_Pekerjaan))),
    isi: (o) => { fK.Uraian_Pekerjaan.value = o.uraian; } });
  drawDpa(k.ID_SubKeg);
  m.el.querySelector('[data-spk]').onclick = () => { const inp = m.el.querySelector('#fileSpk'); inp.onchange = async () => { const fl = inp.files[0]; inp.value = ''; if (!fl) return;
    try { const g = Impor.tebakSpk(await Impor.teks(fl)), f = m.el.querySelector('form'); let n = 0;
      Object.keys(g).forEach((key) => { const el = f.elements[key]; if (!el || g[key] === '' || g[key] == null) return; if (el.value) return; el.value = key === 'Nilai_Kontrak' ? fmtN(g[key]) : g[key]; el.dispatchEvent(new Event('input', { bubbles: true })); n++; });
      toast(n ? n + ' isian terisi dari ' + fl.name + '. Periksa kembali.' : 'Tidak ada isian yang dikenali dari ' + fl.name + '.', n ? 'ok' : 'warn'); } catch (er) { toast(er.message, 'err'); } }; inp.click(); };
  m.el.addEventListener('change', (e) => {
    if (e.target.name === 'ID_SubKeg') { drawPaket(e.target.value); drawDpa(e.target.value); }
    if (e.target.name === 'ID_Paket') { infoPaket(); const p = Store.get('pengadaan', e.target.value), f = m.el.querySelector('form'); if (p && baru) { if (!f.Uraian_Pekerjaan.value) f.Uraian_Pekerjaan.value = p.Nama_Paket; if (!f.Metode.value && p.Metode) f.Metode.value = p.Metode; } }
  });
  m.el.querySelector('[data-save]').onclick = async () => {
    const v = validate(m.el, { ID_SubKeg: req('Sub kegiatan'), No_SPK: req('Nomor SPK'), Tgl_SPK: req('Tanggal SPK'), Uraian_Pekerjaan: req('Uraian'), Nilai_Kontrak: (x) => (x > 0 ? '' : 'Nilai kontrak harus lebih dari 0.'), Tgl_Mulai: req('Tanggal mulai'), Penyedia: req('Penyedia'),
      Tgl_Selesai: (x, a) => (!x ? 'Tanggal selesai wajib diisi.' : a.Tgl_Mulai && x < a.Tgl_Mulai ? 'Tanggal selesai sebelum tanggal mulai.' : '') });
    if (!v) return;
    const sk = Store.get('subkeg', v.ID_SubKeg); const lain = S.t.kontrak.filter((x) => x.ID_SubKeg === v.ID_SubKeg && x.ID_Kontrak !== k.ID_Kontrak).reduce((a, x) => a + num(x.Nilai_Kontrak), 0);
    if (sk && lain + v.Nilai_Kontrak > num(sk.Pagu)) { toast(`Total nilai kontrak (${rp(lain + v.Nilai_Kontrak)}) melebihi pagu sub kegiatan (${rp(sk.Pagu)}).`, 'warn'); return; }
    if (S.t.kontrak.some((x) => norm(x.No_SPK) === norm(v.No_SPK) && x.ID_Kontrak !== k.ID_Kontrak)) { toast('Nomor SPK sudah terdaftar.', 'warn'); return; }
    v.ID_Paket = v.ID_Paket || '';
    const pk = v.ID_Paket ? Store.get('pengadaan', v.ID_Paket) : null;
    if (pk && num(pk.Nilai_HPS) > 0 && v.Nilai_Kontrak > num(pk.Nilai_HPS) && !(await confirmBox(`Nilai kontrak <b>${rp(v.Nilai_Kontrak)}</b> melebihi HPS paket <b>${rp(pk.Nilai_HPS)}</b>. Periksa kembali dasar penetapannya. Tetap simpan?`, { ok: 'Tetap simpan' }))) return;
    const data = Object.assign({}, v, { Tahun: S.tahun }); if (!baru) data.ID_Kontrak = k.ID_Kontrak;
    const paketLama = k.ID_Paket || '';
    m.close();
    mutate('kontrak.simpan', data, { table: 'kontrak', temp: data, okMsg: baru ? 'Kontrak ditambahkan.' : 'Kontrak diperbarui.', retry: () => Pages.formKontrak(baru ? null : k, v),
      onOk: (d) => { const row = d.row || {};
        if (paketLama && paketLama !== row.ID_Paket) { const pl = Store.get('pengadaan', paketLama); if (pl) Store.upsert('pengadaan', Object.assign({}, pl, { ID_Kontrak: '', Status: 'PROSES' })); }
        if (row.ID_Paket) { const pb = Store.get('pengadaan', row.ID_Paket); if (pb) Store.upsert('pengadaan', Object.assign({}, pb, { ID_Kontrak: row.ID_Kontrak, Status: 'SELESAI' })); }
        (d.peringatan || []).forEach((w) => toast(w, 'warn')); } });
  };
  const d = m.el.querySelector('[data-del]');
  if (d) d.onclick = async () => {
    if (S.t.arsip.some((a) => a.ID_Kontrak === k.ID_Kontrak)) { toast('Kontrak masih memiliki arsip dokumen — hapus arsipnya lebih dulu.', 'warn'); return; }
    if (!(await confirmBox(`Hapus kontrak <b>${esc(k.No_SPK)}</b>?`, { danger: true, ok: 'Hapus' }))) return;
    m.close(); mutate('kontrak.hapus', { ID_Kontrak: k.ID_Kontrak }, { optimistic: () => { const o = Store.remove('kontrak', k.ID_Kontrak); return () => Store.upsert('kontrak', o); }, okMsg: 'Kontrak dihapus.' });
  };
};
Pages.detailKontrak = function (id) {
  const k = Store.get('kontrak', id); if (!k) return; const sk = Store.get('subkeg', k.ID_SubKeg) || {}; const s = sk.ID_SubKeg ? Calc.sk(sk) : null; const cl = Calc.checklist(id);
  const satu = S.t.kontrak.filter((x) => x.ID_SubKeg === k.ID_SubKeg && x.Status !== 'PUTUS').length === 1;
  const docs = S.t.arsip.filter((a) => a.ID_Kontrak === id); const pays = S.t.realisasi.filter((r) => r.ID_Kontrak === id || (satu && r.ID_SubKeg === k.ID_SubKeg && !r.ID_Kontrak)).sort((a, b) => a.Bulan - b.Bulan);
  const m = modal({ title: k.No_SPK, icon: 'kontrak', size: 'lg',
    body: `<div class="row mb-s">${stChip(K.ST_KONTRAK, Calc.kontrakStatus(k))}${chip('Berkas ' + fmtN(cl.pct, 0) + '%', cl.pct >= 99.9 ? 'ok' : 'warn')}${s ? devChip(s.dev) : ''}</div>
      <div class="grid g2"><dl class="kv"><dt>Sub kegiatan</dt><dd>${esc(skLabel(sk))}</dd><dt>Uraian</dt><dd>${esc(k.Uraian_Pekerjaan)}</dd><dt>Nilai</dt><dd class="num">${rp(k.Nilai_Kontrak)}</dd><dt>Metode</dt><dd>${esc(k.Metode || '-')}</dd><dt>Jangka waktu</dt><dd>${tgl(k.Tgl_Mulai)} – ${tgl(k.Tgl_Selesai)}</dd></dl>
      <dl class="kv"><dt>Penyedia</dt><dd>${esc(k.Penyedia)}</dd><dt>Penandatangan</dt><dd>${esc(k.Direktur || '-')} (${esc(k.Jabatan_Direktur || '-')})</dd><dt>NPWP</dt><dd>${esc(k.NPWP || '-')}</dd><dt>Rekening</dt><dd>${esc([k.Nama_Bank, k.No_Rekening, k.Nama_Rekening].filter(Boolean).join(' · ') || '-')}</dd><dt>PIC</dt><dd>${esc(Store.nama(sk.PIC_Email))}</dd></dl></div>
      <div class="lbl mt mb-s">Pembayaran tercatat · ${rp(Calc.bayarKontrak(k))}</div>${pays.length ? `<table class="t light"><thead><tr><th>Bulan</th><th>SP2D</th><th class="n">Nilai</th><th>Status</th></tr></thead><tbody>${pays.map((r) => `<tr><td>${K.BULAN[r.Bulan - 1]}</td><td class="mono">${esc(r.No_SP2D || '-')}</td><td class="n">${fmtN(r.Realisasi_Keuangan)}</td><td>${stChip(K.ST_REAL, r.Status)}</td></tr>`).join('')}</tbody></table>` : '<p class="mini">Belum ada realisasi yang dikaitkan ke kontrak ini.</p>'}
      <div class="lbl mt mb-s">Dokumen (${docs.length})</div><p class="mini" style="margin:0">${docs.map((d) => esc(jenisNama(d.Jenis_Dokumen))).join(' · ') || 'Belum ada dokumen.'}</p>`,
    foot: `<a class="btn" href="#/arsip?k=${esc(id)}" data-x>${ic('arsip', 'sm')}Arsip</a><a class="btn" href="#/checklist?k=${esc(id)}" data-x>${ic('checklist', 'sm')}Checklist</a>${Can.generate() ? `<button class="btn" data-gen>${ic('docadd', 'sm')}Buat Dokumen</button>` : ''}${Can.editKontrak(sk) ? `<button class="btn pri" data-ed>${ic('edit', 'sm')}Ubah</button>` : ''}` });
  const g = m.el.querySelector('[data-gen]'); if (g) g.onclick = () => { m.close(); Gen.open({ ID_Kontrak: id }); };
  const e = m.el.querySelector('[data-ed]'); if (e) e.onclick = () => { m.close(); Pages.formKontrak(k); };
};

/* =====================================================================
   4. REALISASI BULANAN
   ===================================================================== */
Pages.add({
  id: 'realisasi', title: 'Realisasi Bulanan', icon: 'trend', nav: true, group: 'Menu Utama', short: 'Realisasi',
  badge() { return S.t.realisasi.filter((r) => r.Status === 'DIAJUKAN' && Can.verifReal(Store.get('subkeg', r.ID_SubKeg))).length; },
  render(el, q, st) {
    st.tab = q.tab || st.tab || 'input';
    if (q.sk) st.sk = q.sk;
    const bisa = S.t.subkeg.filter((s) => Can.inputReal(s) || Can.verifReal(s) || Can.role('PROGRAM')).sort(byKey('Kode_SubKeg'));
    if (!st.sk || !Store.get('subkeg', st.sk)) st.sk = (bisa[0] || S.t.subkeg[0] || {}).ID_SubKeg || '';
    if (!st.bulan) { const c = Calc.cutDefault(); const sk0 = st.sk; const ada = S.t.realisasi.filter((r) => r.ID_SubKeg === sk0).map((r) => r.Bulan); st.bulan = Math.min(12, ada.length ? Math.max(...ada) + (ada.indexOf(c) > -1 ? 0 : 1) : c); st.bulan = clamp(st.bulan, 1, 12); }
    const nVerif = this.badge();
    el.innerHTML = ph({ eyebrow: 'Modul Pelaksanaan APBD', title: 'Input & Verifikasi Realisasi Bulanan', desc: 'Pencatatan progres fisik (% kumulatif) dan realisasi keuangan (SP2D) per Sub Kegiatan.' }) +
      `<div class="tabs mb" style="border-radius:var(--r)"><button data-tab="input" class="${st.tab === 'input' ? 'on' : ''}">${ic('edit', 'sm')}Input Realisasi</button><button data-tab="verif" class="${st.tab === 'verif' ? 'on' : ''}">${ic('verified', 'sm')}Menunggu Verifikasi ${nVerif ? chip(nVerif, 'gold') : ''}</button><button data-tab="rekap" class="${st.tab === 'rekap' ? 'on' : ''}">${ic('table', 'sm')}Rekap Bulanan</button></div><div id="tabBody"></div>`;
    const body = $('#tabBody');
    if (st.tab === 'input') this.input(body, st, bisa);
    else if (st.tab === 'verif') this.verif(body, st);
    else this.rekap(body, st);
    el.onclick = (e) => { const t = e.target.closest('[data-tab]'); if (t) { st.tab = t.dataset.tab; if (q.tab || q.sk) history.replaceState(null, '', '#/realisasi'); App.refresh(); } };
  },
  input(body, st, bisa) {
    if (!S.t.subkeg.length) { body.innerHTML = `<div class="card">${emptyBox('Belum ada sub kegiatan', 'Isi master DPA di menu Perencanaan Anggaran terlebih dahulu.')}</div>`; return; }
    const sk = Store.get('subkeg', st.sk); const b = num(st.bulan);
    const rows = Calc.realRows(sk.ID_SubKeg); const row = rows.find((r) => r.Bulan === b);
    const prev = Calc.sk(sk, b - 1); const ren = Calc.rencana(sk, b); const amb = num(S.settings.AMBANG_DEVIASI) || 5;
    const boleh = Can.inputReal(sk) && (!row || row.Status !== 'TERVERIFIKASI' || Can.verifReal(sk));
    const kontrak = S.t.kontrak.filter((k) => k.ID_SubKeg === sk.ID_SubKeg);
    const isPIC = Can.verifReal(sk);
    body.innerHTML = `<div class="card mb"><div class="card-h"><h3>${ic('filter', 'sm')}Parameter Rekening & Periode</h3><p>Tahun Anggaran berjalan: <b>${esc(S.tahun)}</b></p></div><div class="card-b"><div class="fg">
        <div class="f s8"><label>Sub Kegiatan</label>${selectHtml('sk', (bisa.length ? bisa : S.t.subkeg).map((s) => [s.ID_SubKeg, skLabel(s)]), st.sk)}</div>
        <div class="f s4"><label>Periode laporan</label>${selectHtml('bulan', optBulan().map((o) => [o[0], o[1] + ' ' + S.tahun + (rows.some((r) => r.Bulan === o[0]) ? ' ✓' : '')]), b)}</div></div></div></div>
      <div class="card mb" style="border-left:4px solid var(--accent)"><div class="card-h"><h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase">Ringkasan realisasi berjalan (s.d. ${b > 1 ? K.BULAN[b - 2] : 'awal tahun'})</h3><div class="acts">${chip('PIC: ' + Store.nama(sk.PIC_Email), 'slate', 'person')}</div></div><div class="card-b"><div class="grid g4">
        ${kpi({ l: 'Pagu Sub Kegiatan', v: rp(sk.Pagu), s: esc(sk.Sumber_Dana || 'DPA') })}${kpi({ l: 'Nilai Kontrak', v: rp(prev.nilaiKontrak), s: kontrak.length + ' kontrak · sisa ' + rpS(num(sk.Pagu) - prev.nilaiKontrak) })}
        ${kpi({ l: 'Akumulasi Keuangan', v: rp(prev.keu), bar: prev.keuPct, barCls: 'gold', s: pct(prev.keuPct) + ' dari pagu' })}${kpi({ l: 'Akumulasi Fisik', v: pct(prev.fisik), bar: prev.fisik, tick: Calc.rencana(sk, b - 1), s: 'Rencana ' + pct(Calc.rencana(sk, b - 1)) })}</div>
        <div class="note warn mt">${ic('flag', 'sm')}<div>Sasaran rencana ${K.BULAN[b - 1]} ${esc(S.tahun)}: <b>fisik ${pct(ren)}</b> (kumulatif) · keuangan kumulatif <b>${rp((ren / 100) * num(sk.Pagu))}</b></div></div></div></div>
      <div class="card mb"><div class="card-h"><h3>${ic('edit', 'sm')}Form Capaian Realisasi ${K.BULAN[b - 1]} ${esc(S.tahun)}</h3><div class="acts">${row ? stChip(K.ST_REAL, row.Status) : chip('Belum ada entri', 'slate')}</div>${row && row.Catatan_Verifikasi ? `<p class="c-err">Catatan verifikator: ${esc(row.Catatan_Verifikasi)}</p>` : ''}</div>
        <div class="card-b"><form class="fg" id="fReal">
          <div class="f s6"><label>Realisasi fisik kumulatif s.d. bulan ini <span class="req">*</span></label><div class="affix r"><input class="in num" name="Realisasi_Fisik" inputmode="decimal" data-num value="${row ? esc(String(row.Realisasi_Fisik).replace('.', ',')) : ''}" ${boleh ? '' : 'readonly'} placeholder="${esc(String(prev.fisik).replace('.', ','))}"><span>%</span></div><div class="hint" id="devHint"></div><div class="err-m"></div></div>
          <div class="f s6"><label>Realisasi keuangan bulan ini (SP2D terbit)</label><div class="affix"><span>Rp</span><input class="in num" name="Realisasi_Keuangan" data-rp data-num inputmode="numeric" value="${row ? fmtN(row.Realisasi_Keuangan) : ''}" ${boleh ? '' : 'readonly'} placeholder="0"></div><div class="hint" id="keuHint"></div><div class="err-m"></div></div>
          ${fld({ name: 'ID_Kontrak', label: 'Kontrak terkait (opsional)', type: 'select', span: 's4', value: row ? row.ID_Kontrak : (kontrak.length === 1 ? kontrak[0].ID_Kontrak : ''), dis: !boleh, opts: [['', '— tanpa kontrak / swakelola —']].concat(kontrak.map((k) => [k.ID_Kontrak, k.No_SPK + ' — ' + k.Penyedia])) })}
          ${fld({ name: 'No_SP2D', label: 'Nomor SP2D', value: row && row.No_SP2D, span: 's4', ro: !boleh })}${fld({ name: 'Tgl_SP2D', label: 'Tanggal SP2D', value: row && row.Tgl_SP2D, type: 'date', span: 's4', ro: !boleh })}
          ${fld({ name: 'Uraian', label: 'Uraian hasil pekerjaan fisik', value: row && row.Uraian, type: 'textarea', rows: 3, ro: !boleh, max: 1000 })}
          ${fld({ name: 'Kendala', label: 'Kendala / hambatan lapangan', value: row && row.Kendala, type: 'textarea', rows: 2, span: 's6', ro: !boleh })}${fld({ name: 'Rencana_Aksi', label: 'Rencana aksi / mitigasi percepatan', value: row && row.Rencana_Aksi, type: 'textarea', rows: 2, span: 's6', ro: !boleh })}
        </form>
        ${boleh ? `<div class="lbl mt mb-s">Lampiran bukti (SP2D / foto lapangan)</div><div class="drop" id="dropR">${ic('upload')}<b>Tarik file ke sini atau klik untuk memilih</b><span class="mini">PDF/Word/Excel/JPG/PNG/ZIP maks. ${esc(S.settings.MAKS_UNGGAH_MB || 10)} MB · tersimpan di Arsip Dokumen</span><div class="prog hidden"><i></i></div></div><input type="file" id="fileR" class="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip">` : `<div class="note info mt">${ic('lock', 'sm')}<div>${row && row.Status === 'TERVERIFIKASI' ? 'Realisasi bulan ini sudah terverifikasi; hanya PIC/Admin yang dapat mengubah.' : 'Anda tidak berwenang menginput realisasi untuk sub kegiatan di bidang ini.'}</div></div>`}
        </div>
        ${boleh ? `<div class="card-f" style="justify-content:flex-end">${ic('info', 'sm')}<span style="margin-right:auto">${isPIC ? 'Anda PIC sub kegiatan ini — pengajuan langsung terverifikasi.' : 'Pengajuan diverifikasi oleh PIC: ' + esc(Store.nama(sk.PIC_Email))}</span><button class="btn" data-save="draf">${ic('save', 'sm')}Simpan Draf</button><button class="btn gold" data-save="ajukan">${ic('send', 'sm')}${isPIC ? 'Simpan & Verifikasi' : 'Ajukan Verifikasi'}</button></div>` : ''}</div>
      <div class="card"><div class="card-h"><h3>Riwayat Realisasi Fisik & Keuangan</h3><p>${esc(skLabel(sk))}</p></div><div class="tw"><table class="t"><thead><tr><th>Bulan</th><th class="n">Rencana Fisik</th><th class="n">Real. Fisik</th><th class="c">Deviasi</th><th class="n">Rencana Keu. Kum.</th><th class="n">Real. Bulan (Rp)</th><th class="n">Kumulatif (Rp)</th><th>No. SP2D</th><th>Status</th><th>Diinput</th></tr></thead><tbody>
        ${(() => { let kum = 0; return [...Array(12).keys()].map((i) => { const m = i + 1, r = rows.find((x) => x.Bulan === m); if (r && Calc.counted(r)) kum += num(r.Realisasi_Keuangan); const rf = Calc.rencana(sk, m); if (!r && m > Math.max(b, Calc.cutDefault())) return ''; return `<tr class="${m === b ? 'flag' : ''} click" data-bln="${m}"><td>${K.BULAN[i]}</td><td class="n">${pct(rf)}</td><td class="n">${r ? pct(r.Realisasi_Fisik) : '-'}</td><td class="c">${r ? devChip(r.Realisasi_Fisik - rf, amb) : ''}</td><td class="n">${fmtN((rf / 100) * num(sk.Pagu))}</td><td class="n">${r ? fmtN(r.Realisasi_Keuangan) : '-'}</td><td class="n">${r ? fmtN(kum) : ''}</td><td class="mono">${r ? esc(r.No_SP2D || '') : ''}</td><td>${r ? stChip(K.ST_REAL, r.Status) + (r._pending ? '<span class="sub">menyimpan…</span>' : '') : '<span class="mini">belum diinput</span>'}</td><td>${r ? esc(Store.nama(r.Diinput_Oleh)) : ''}</td></tr>`; }).join(''); })()}
      </tbody></table></div></div>`;
    const f = $('#fReal'), dev = $('#devHint'), kh = $('#keuHint');
    const live = () => { const v = formVals(f); if (String(f.Realisasi_Fisik.value).trim() !== '') { const d = v.Realisasi_Fisik - ren; dev.innerHTML = `Deviasi terhadap rencana ${pct(ren)}: <b class="${d <= -amb ? 'c-err' : d < 0 ? 'c-warn' : 'c-ok'}">${sgn(d)}</b>${d <= -amb ? ' — wajib isi kendala & rencana aksi' : ''}`; } else dev.textContent = ''; const tot = prev.keu + v.Realisasi_Keuangan; kh.innerHTML = `Total akumulasi s.d. ${K.BULAN[b - 1]}: <b>${rp(tot)}</b> (${pct(num(sk.Pagu) ? (tot / num(sk.Pagu)) * 100 : 0)} dari pagu)`; };
    live(); f.oninput = live;
    body.onchange = (e) => { if (e.target.name === 'sk' || e.target.name === 'bulan') { st[e.target.name] = e.target.value; if (e.target.name === 'sk') st.bulan = 0; App.refresh(); } };
    body.onclick = (e) => {
      const tr = e.target.closest('[data-bln]'); if (tr) { st.bulan = num(tr.dataset.bln); App.refresh(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      const sv = e.target.closest('[data-save]'); if (!sv) return;
      const ajukan = sv.dataset.save === 'ajukan';
      const v = validate(f, { Realisasi_Fisik: (x) => { if (String(f.Realisasi_Fisik.value).trim() === '') return 'Isi realisasi fisik kumulatif.'; if (x < 0 || x > 100) return 'Nilai 0–100%.'; if (x + 0.0001 < prev.fisik && ajukan) return 'Fisik kumulatif tidak boleh turun dari bulan sebelumnya (' + pct(prev.fisik) + ').'; return ''; },
        Realisasi_Keuangan: (x) => { const lain = rows.filter((r) => r.Bulan !== b && r.Status !== 'DITOLAK').reduce((a, r) => a + num(r.Realisasi_Keuangan), 0); return x < 0 ? 'Tidak boleh negatif.' : lain + x > num(sk.Pagu) ? 'Total realisasi keuangan melebihi pagu (' + rp(sk.Pagu) + ').' : ''; },
        Kendala: (x, a) => (ajukan && a.Realisasi_Fisik - ren <= -amb && !x ? 'Deviasi melewati ambang — jelaskan kendalanya.' : '') });
      if (!v) return;
      const data = Object.assign({}, v, { ID_SubKeg: sk.ID_SubKeg, Tahun: S.tahun, Bulan: b, ajukan });
      const status = ajukan ? (isPIC ? 'TERVERIFIKASI' : 'DIAJUKAN') : 'DRAF';
      const temp = Object.assign({}, data, { ID: row ? row.ID : undefined, Status: status, Diinput_Oleh: S.me.email, Tgl_Input: todayISO() }); delete temp.ajukan;
      mutate('realisasi.simpan', data, { table: 'realisasi', temp, btn: sv, okMsg: ajukan ? (isPIC ? 'Realisasi disimpan & terverifikasi.' : 'Realisasi diajukan ke PIC.') : 'Draf disimpan.' });
    };
    const drop = $('#dropR'), inp = $('#fileR');
    if (drop) Upload.bind(drop, inp, (files) => Upload.kirim(files, { ID_SubKeg: sk.ID_SubKeg, ID_Kontrak: f.ID_Kontrak ? f.ID_Kontrak.value : '', Jenis_Dokumen: 'SP2D', Keterangan: 'Bukti realisasi ' + K.BULAN[b - 1] }, drop, true));
  },
  verif(body, st) {
    const rows = S.t.realisasi.filter((r) => r.Status === 'DIAJUKAN' && Can.verifReal(Store.get('subkeg', r.ID_SubKeg))).sort((a, b) => a.Bulan - b.Bulan);
    const amb = num(S.settings.AMBANG_DEVIASI) || 5;
    body.innerHTML = `<div class="card"><div class="card-h"><h3>Pengajuan menunggu verifikasi Anda</h3><p>Hanya PIC sub kegiatan (atau Admin) yang dapat memverifikasi.</p></div>${rows.length ? `<div class="tw"><table class="t"><thead><tr><th>Sub Kegiatan</th><th>Bulan</th><th class="n">Fisik</th><th class="c">Deviasi</th><th class="n">Keuangan (Rp)</th><th>SP2D</th><th>Uraian / Kendala</th><th>Diajukan</th><th></th></tr></thead><tbody>
      ${rows.map((r) => { const sk = Store.get('subkeg', r.ID_SubKeg) || {}; const d = r.Realisasi_Fisik - Calc.rencana(sk, r.Bulan); return `<tr><td style="min-width:200px"><b>${esc(sk.Nama_SubKegiatan)}</b><span class="sub mono">${esc(sk.Kode_SubKeg)}</span></td><td>${K.BULAN[r.Bulan - 1]}</td><td class="n">${pct(r.Realisasi_Fisik)}</td><td class="c">${devChip(d, amb)}</td><td class="n">${fmtN(r.Realisasi_Keuangan)}</td><td class="mono">${esc(r.No_SP2D || '-')}</td><td style="min-width:220px">${esc(r.Uraian || '-')}${r.Kendala ? `<span class="sub c-warn">Kendala: ${esc(r.Kendala)}</span>` : ''}</td><td>${esc(Store.nama(r.Diinput_Oleh))}<span class="sub">${tgl(r.Tgl_Input)}</span></td><td class="acts"><button class="btn sm danger" data-tolak="${esc(r.ID)}">Tolak</button> <button class="btn sm pri" data-ok="${esc(r.ID)}">${ic('check', 'sm')}Setujui</button></td></tr>`; }).join('')}</tbody></table></div>` : `<div class="empty">${ic('check')}<b>Tidak ada pengajuan</b><div>Semua realisasi sudah diverifikasi.</div></div>`}</div>`;
    body.onclick = async (e) => {
      const ok = e.target.closest('[data-ok]'), no = e.target.closest('[data-tolak]'); if (!ok && !no) return;
      const id = (ok || no).dataset.ok || (ok || no).dataset.tolak; const r = Store.get('realisasi', id);
      let catatan = '';
      if (no) { catatan = await new Promise((res) => { const m = modal({ title: 'Tolak realisasi', size: 'sm', body: fld({ name: 'c', label: 'Alasan penolakan', type: 'textarea', rows: 3, req: true }), foot: '<button class="btn" data-x>Batal</button><button class="btn danger" data-y>Tolak</button>' }); m.el.querySelector('[data-y]').onclick = () => { const v = m.el.querySelector('[name=c]').value.trim(); if (!v) { toast('Isi alasan penolakan.', 'warn'); return; } m.close(); res(v); }; m.el.addEventListener('click', (ev) => { if (ev.target.closest('[data-x]')) res(null); }); }); if (catatan == null) return; }
      mutate('realisasi.verifikasi', { ID: id, setuju: !!ok, catatan }, { table: 'realisasi', optimistic: () => { const old = Object.assign({}, r); Store.upsert('realisasi', Object.assign({}, r, { Status: ok ? 'TERVERIFIKASI' : 'DITOLAK', Catatan_Verifikasi: catatan, _pending: true })); return () => Store.upsert('realisasi', old); }, okMsg: ok ? 'Realisasi diverifikasi.' : 'Realisasi ditolak.' });
    };
  },
  rekap(body, st) {
    st.rb = st.rb || '';
    const list = Calc.subkeg({ bidang: st.rb }).sort(byKey('Kode_SubKeg'));
    const cell = (sk, m) => { const r = Calc.realRows(sk.ID_SubKeg).find((x) => x.Bulan === m); if (!r) return '<td class="c c-mut">·</td>'; const d = r.Realisasi_Fisik - Calc.rencana(sk, m); const cls = r.Status === 'DITOLAK' ? 'err' : r.Status === 'DRAF' ? 'slate' : r.Status === 'DIAJUKAN' ? 'warn' : d < -(num(S.settings.AMBANG_DEVIASI) || 5) ? 'err' : 'ok'; return `<td class="c"><span class="chip ${cls}" title="${esc(K.ST_REAL[r.Status][0])} · deviasi ${sgn(d)}">${fmtN(r.Realisasi_Fisik, 0)}</span></td>`; };
    body.innerHTML = `<div class="card"><div class="card-h"><h3>Matriks realisasi fisik kumulatif (%)</h3><div class="acts">${selectHtml('rb', optBidang(), st.rb)}</div><p>Hijau = sesuai rencana & terverifikasi · kuning = diajukan · merah = di bawah ambang/ditolak · abu = draf. Klik baris untuk membuka input.</p></div>
      ${list.length ? `<div class="tw"><table class="t"><thead><tr><th>Sub Kegiatan</th>${K.BLN.map((b) => `<th class="c">${b}</th>`).join('')}</tr></thead><tbody>${list.map((sk) => `<tr class="click" data-sk="${esc(sk.ID_SubKeg)}"><td style="min-width:240px"><b>${esc(sk.Nama_SubKegiatan)}</b><span class="sub">${esc(sk.Bidang)} · ${esc(Store.nama(sk.PIC_Email))}</span></td>${[...Array(12).keys()].map((i) => cell(sk, i + 1)).join('')}</tr>`).join('')}</tbody></table></div>` : emptyBox('Belum ada data', '')}</div>`;
    body.onchange = (e) => { if (e.target.name === 'rb') { st.rb = e.target.value; App.refresh(); } };
    body.onclick = (e) => { const r = e.target.closest('[data-sk]'); if (r) { st.sk = r.dataset.sk; st.bulan = 0; st.tab = 'input'; App.refresh(); } };
  }
});

/* =====================================================================
   5. EVALUASI TRIWULANAN BERJENJANG
   ===================================================================== */
Pages.add({
  id: 'evaluasi', title: 'Evaluasi Triwulanan', icon: 'review', nav: true, group: 'Menu Utama',
  badge() { const tw = num(S.settings.TRIWULAN_AKTIF) || 1; return (S.me.bawahan || []).filter((e) => !S.t.evaluasi.some((v) => norm(v.Email_Pejabat) === norm(e) && v.Triwulan === tw && v.Status === 'TERKUNCI')).length; },
  render(el, q, st) {
    st.tw = num(q.tw || st.tw || S.settings.TRIWULAN_AKTIF || 1);
    const baw = (S.me.bawahan || []).map((e) => Store.user(e)).filter(Boolean);
    if (q.p) st.p = q.p;
    if (!st.p || !baw.some((u) => norm(u.Email) === norm(st.p))) st.p = baw[0] ? baw[0].Email : '';
    const evOf = (email, tw) => S.t.evaluasi.find((v) => norm(v.Email_Pejabat) === norm(email) && v.Triwulan === tw);
    const saya = S.t.evaluasi.filter((v) => norm(v.Email_Pejabat) === norm(S.me.email)).sort((a, b) => b.Triwulan - a.Triwulan);
    el.innerHTML = ph({ eyebrow: 'Monev Kinerja & Akuntabilitas Pelaksanaan', eyebrowIc: 'shield', title: 'Evaluasi Kinerja & Progres Anggaran Triwulanan',
      desc: `Mekanisme pengawasan berjenjang (Kasi → Kabid → Sekretaris/Kadis) · Triwulan ${K.ROMAWI[st.tw]} TA ${esc(S.tahun)}`,
      acts: `${selectHtml('tw', [1, 2, 3, 4].map((t) => [t, 'Triwulan ' + K.ROMAWI[t]]), st.tw)}` }) + '<div id="evBody"></div>';
    const box = $('#evBody');
    let html = '';
    if (baw.length) {
      html += `<div class="card mb"><div class="card-h"><h3>${ic('tree', 'sm')}Bawahan langsung yang Anda nilai</h3><p>Pilih pejabat untuk melihat ringkasan kinerja dan mengisi predikat.</p></div><div class="card-b row">${baw.map((u) => { const ev = evOf(u.Email, st.tw); return `<button class="btn ${norm(u.Email) === norm(st.p) ? 'pri' : ''}" data-p="${esc(u.Email)}">${esc(u.Nama)} ${ev ? (ev.Status === 'TERKUNCI' ? ic('lock', 'sm') : chip('draf', 'warn')) : ''}</button>`; }).join('')}</div></div>`;
      html += this.panel(st.p, st.tw);
    } else if (!Can.role('ADMIN', 'PROGRAM')) html += `<div class="note info mb">${ic('info', 'sm')}<div>Anda tidak memiliki bawahan langsung untuk dinilai. Di bawah ini adalah hasil evaluasi atas kinerja Anda.</div></div>`;
    if (Can.role('ADMIN', 'PROGRAM')) html += this.matriks();
    html += `<div class="card mt"><div class="card-h"><h3>${ic('medal', 'sm')} Riwayat evaluasi atas kinerja saya</h3><p>Dinilai oleh atasan langsung: ${esc(Store.nama(S.me.atasan) || '-')}</p></div>${saya.length ? saya.map((v) => `<div class="card-b" style="border-bottom:1px solid var(--border);display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap"><div class="kpi-i">${ic(v.Status === 'TERKUNCI' ? 'lock' : 'edit')}</div><div style="flex:1;min-width:240px"><b class="strong">Triwulan ${K.ROMAWI[v.Triwulan]} TA ${esc(v.Tahun)}</b> ${chip('Predikat: ' + (K.PREDIKAT[v.Predikat] || '-'), K.PRED_CHIP[v.Predikat])} ${v.Status === 'TERKUNCI' ? chip('Terkunci', 'navy') : chip('Draf atasan', 'warn')}<p style="margin:6px 0 0">${esc(v.Catatan || '')}</p>${v.Arahan ? `<p class="mini" style="white-space:pre-line;margin:6px 0 0"><b>Arahan:</b> ${esc(v.Arahan)}</p>` : ''}<span class="mini">Tgl monev ${tgl(v.Tgl_Monev)} · dinilai ${esc(Store.nama(v.Email_Atasan))}</span></div><a class="btn sm" href="#/laporan?tab=monev&p=${encodeURIComponent(S.me.email)}&tw=${v.Triwulan}">${ic('print', 'sm')}Lembar Monev</a></div>`).join('') : '<div class="card-b mini">Belum ada evaluasi.</div>'}</div>`;
    box.innerHTML = html;
    el.onchange = (e) => { if (e.target.name === 'tw') { st.tw = num(e.target.value); history.replaceState(null, '', '#/evaluasi'); App.refresh(); } };
    el.onclick = async (e) => {
      const p = e.target.closest('[data-p]'); if (p) { st.p = p.dataset.p; history.replaceState(null, '', '#/evaluasi'); App.refresh(); return; }
      const sv = e.target.closest('[data-ev]'); if (!sv) return;
      const kunci = sv.dataset.ev === 'kunci'; const f = $('#fEv');
      const v = validate(f, { Predikat: req('Predikat'), Arahan: (x) => (kunci && !x ? 'Isi arahan/solusi sebelum mengunci.' : '') }); if (!v) return;
      if (kunci && !(await confirmBox('Setelah dikunci, predikat dan arahan tersimpan permanen dan <b>tidak dapat diubah</b> oleh siapa pun. Lanjutkan?', { ok: 'Kunci & Sahkan' }))) return;
      const old = evOf(st.p, st.tw);
      const data = { Email_Pejabat: st.p, Tahun: S.tahun, Triwulan: st.tw, Predikat: v.Predikat, Catatan: v.Catatan, Arahan: v.Arahan, kunci };
      mutate('evaluasi.simpan', data, { table: 'evaluasi', btn: sv, temp: Object.assign({}, data, { ID: old ? old.ID : undefined, Email_Atasan: S.me.email, Status: kunci ? 'TERKUNCI' : 'DRAF', Tgl_Monev: todayISO() }), okMsg: kunci ? 'Evaluasi dikunci & disahkan.' : 'Draf evaluasi disimpan.' });
    };
  },
  panel(email, tw) {
    const u = Store.user(email); if (!u) return '';
    const sks = skLingkup(email), a = Calc.agg(sks, tw * 3), ev = S.t.evaluasi.find((v) => norm(v.Email_Pejabat) === norm(email) && v.Triwulan === tw);
    const locked = ev && ev.Status === 'TERKUNCI', amb = num(S.settings.AMBANG_DEVIASI) || 5;
    const kartu = sks.map((sk) => { const s = Calc.sk(sk, tw * 3); const last = Calc.realRows(sk.ID_SubKeg).filter((r) => r.Bulan <= tw * 3).pop() || {}; const kt = S.t.kontrak.filter((k) => k.ID_SubKeg === sk.ID_SubKeg);
      return `<div class="sk-card"><div class="row"><span class="code">${esc(sk.Kode_SubKeg)}</span>${s.dev <= -amb ? chip('Deviasi signifikan (' + sgn(s.dev) + ')', 'err', 'warn') : s.dev < 0 ? chip('Toleransi (' + sgn(s.dev) + ')', 'warn') : chip('Sesuai rencana (' + sgn(s.dev) + ')', 'ok')}<span class="spacer"></span><span class="mini">Pagu <b class="num">${rp(s.pagu)}</b></span></div>
        <h4>${esc(sk.Nama_SubKegiatan)}</h4><div class="row mini" style="justify-content:space-between"><span>Progres fisik riil: <b class="${s.dev <= -amb ? 'c-err' : 'strong'}">${pct(s.fisik)}</b></span><span>Target TW ${K.ROMAWI[tw]}: ${pct(s.ren)}</span></div>${bar(s.fisik, s.dev <= -amb ? 'err' : s.dev >= 0 ? 'gold' : '', s.ren)}
        <div class="row mini mt" style="justify-content:space-between"><span>Realisasi keu: <b>${pct(s.keuPct)}</b> (${rpS(s.keu)})</span><span>${kt.length} SPK · PIC ${esc(Store.nama(sk.PIC_Email))}</span></div>
        ${last.Kendala ? `<div class="note warn mt">${ic('warn', 'sm')}<div><b>Kendala lapangan:</b> ${esc(last.Kendala)}${last.Rencana_Aksi ? `<br><b>Rencana aksi:</b> ${esc(last.Rencana_Aksi)}` : ''}</div></div>` : ''}</div>`; }).join('');
    return `<div class="card mb"><div class="card-b row" style="gap:16px">
        <div class="person"><div class="av">${ic('person')}</div><div><span class="lbl">Atasan langsung (pejabat penilai)</span><b>${esc(S.me.nama)}</b><small>${esc(S.me.jabatan || '')} · NIP ${esc(S.me.nip || '-')}</small></div></div>
        <div class="person"><div class="av gold">${initials(u.Nama)}</div><div><span class="lbl">Pejabat pelapor (dievaluasi)</span><b>${esc(u.Nama)}</b><small>${esc(u.Jabatan || '')} · NIP ${esc(u.NIP || '-')}</small></div></div></div></div>
      <div class="split"><div>
        <div class="card mb"><div class="card-h"><h3>${ic('chart', 'sm')}Ringkasan kinerja ${sks.length} sub kegiatan</h3><div class="acts">${chip('Unit: ' + (u.Bidang || '-'), 'slate')}</div></div><div class="card-b"><div class="grid g3">
          ${kpi({ l: 'Total alokasi pagu', v: rpS(a.pagu), s: 'DPA TA ' + esc(S.tahun) })}${kpi({ l: 'Rata-rata fisik', v: pct(a.fisik), bar: a.fisik, tick: a.ren, s: 'Target ' + pct(a.ren) + ' · ' + devChip(a.dev, amb) })}${kpi({ l: 'Realisasi keuangan', v: rpS(a.keu), s: pct(a.keuPct) + ' s.d. ' + K.BULAN[tw * 3 - 1] })}</div></div></div>
        ${kartu || `<div class="card">${emptyBox('Tidak ada sub kegiatan', 'Pejabat ini belum menjadi PIC sub kegiatan mana pun.')}</div>`}
      </div>
      <div class="form-panel"><div class="card-h"><h3>Formulir penetapan predikat & arahan</h3><div class="acts">${locked ? chip('Terkunci', 'navy', 'lock') : ev ? chip('Draf tersimpan', 'warn') : chip('Belum dinilai', 'slate')}</div><p>Evaluasi berkala Triwulan ${K.ROMAWI[tw]} TA ${esc(S.tahun)}</p></div>
        <div class="card-b"><form class="fg" id="fEv">
          ${fld({ name: 'Predikat', label: 'Predikat kinerja triwulan ' + K.ROMAWI[tw], type: 'select', value: ev ? ev.Predikat : '', dis: locked, req: true, opts: [['', '— pilih predikat —']].concat(Object.keys(K.PREDIKAT).map((k) => [k, K.PREDIKAT[k]])) })}
          ${fld({ name: 'Catatan', label: 'Catatan evaluasi capaian kinerja', type: 'textarea', rows: 4, value: ev ? ev.Catatan : '', ro: locked })}
          ${fld({ name: 'Arahan', label: 'Arahan wajib & solusi tindak lanjut', type: 'textarea', rows: 5, value: ev ? ev.Arahan : '', ro: locked, ph: '1. …\n2. …', hint: 'Akan tercetak di bagian C Lembar Monev.' })}</form>
          ${locked ? `<div class="note info mt">${ic('lock', 'sm')}<div>Dikunci ${tgl(ev.Tgl_Monev)}. Nilai ini permanen dan menjadi catatan monev resmi.</div></div>` : `<div class="note warn mt">${ic('lock', 'sm')}<div><b>Penguncian permanen.</b> Setelah "Kunci & Sahkan", predikat dan arahan tidak dapat diubah lagi.</div></div>`}</div>
        <div class="card-f">${locked ? `<a class="btn block" href="#/laporan?tab=monev&p=${encodeURIComponent(email)}&tw=${tw}">${ic('print', 'sm')}Cetak Lembar Monev</a>` : `<button class="btn" data-ev="draf">${ic('save', 'sm')}Simpan Draf</button><button class="btn pri" data-ev="kunci" style="flex:1">${ic('verified', 'sm')}Kunci & Sahkan Evaluasi</button>`}</div></div></div>`;
  },
  matriks() {
    const pej = S.t.pengguna.filter((u) => u.Role === 'PEJABAT' && u.Atasan_Email && u.Aktif !== 'TIDAK').sort(byKey('Nama'));
    const cel = (u, tw) => { const v = S.t.evaluasi.find((x) => norm(x.Email_Pejabat) === norm(u.Email) && x.Triwulan === tw); return `<td class="c">${v ? (v.Status === 'TERKUNCI' ? chip(K.PREDIKAT[v.Predikat] || '-', K.PRED_CHIP[v.Predikat]) : chip('Draf', 'warn')) : '<span class="c-mut">—</span>'}</td>`; };
    return `<div class="card mb"><div class="card-h"><h3>${ic('table', 'sm')}Status evaluasi seluruh pejabat TA ${esc(S.tahun)}</h3><p>Pantauan Bagian Program/Admin — hanya atasan langsung yang dapat mengisi.</p></div>${pej.length ? `<div class="tw"><table class="t"><thead><tr><th>Pejabat</th><th>Penilai</th><th class="c">TW I</th><th class="c">TW II</th><th class="c">TW III</th><th class="c">TW IV</th><th></th></tr></thead><tbody>${pej.map((u) => `<tr><td><b>${esc(u.Nama)}</b><span class="sub">${esc(u.Jabatan || '')}</span></td><td>${esc(Store.nama(u.Atasan_Email))}</td>${[1, 2, 3, 4].map((t) => cel(u, t)).join('')}<td class="acts"><a class="btn ghost icon" title="Lembar Monev" href="#/laporan?tab=monev&p=${encodeURIComponent(u.Email)}">${ic('print', 'sm')}</a></td></tr>`).join('')}</tbody></table></div>` : emptyBox('Belum ada pejabat berjenjang', 'Atur atasan langsung di Manajemen User.')}</div>`;
  }
});

/* =====================================================================
   6. ARSIP DOKUMEN & UNGGAH
   ===================================================================== */
const Upload = {
  bind(drop, inp, fn) {
    drop.onclick = () => inp.click(); inp.onchange = () => { if (inp.files.length) fn(Array.from(inp.files)); inp.value = ''; };
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files.length) fn(Array.from(e.dataTransfer.files)); };
  },
  async kirim(files, meta, drop, quiet) {
    const maks = (num(S.settings.MAKS_UNGGAH_MB) || 10) * 1048576, okExt = /\.(pdf|jpe?g|png|zip|docx?|xlsx?)$/i;
    const bar_ = drop && drop.querySelector('.prog'); const fill = bar_ && bar_.querySelector('i');
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!okExt.test(f.name)) { toast(f.name + ': format tidak didukung (PDF, Word, Excel, JPG, PNG, ZIP).', 'warn'); continue; }
      if (f.size > maks) { toast(f.name + ': ukuran ' + fmtN(f.size / 1048576, 1) + ' MB melebihi batas ' + fmtN(maks / 1048576) + ' MB. Kompres scan terlebih dahulu.', 'warn'); continue; }
      if (bar_) { bar_.classList.remove('hidden'); fill.style.width = '5%'; }
      const b64 = await fileToB64(f, (p) => { if (fill) fill.style.width = (5 + p * 35) + '%'; });
      if (fill) fill.style.width = '55%';
      const tick = fill ? setInterval(() => { const w = parseFloat(fill.style.width); if (w < 92) fill.style.width = (w + 3) + '%'; }, 400) : null;
      const r = await mutate('arsip.upload', Object.assign({ Tahun: S.tahun, Nama_File: f.name, Mime: f.type || 'application/octet-stream', base64: b64 }, meta), { table: 'arsip', okMsg: (quiet ? 'Lampiran ' : '') + f.name + ' tersimpan.' });
      clearInterval(tick); if (fill) fill.style.width = r.success ? '100%' : '0';
    }
    setTimeout(() => { if (bar_) { bar_.classList.add('hidden'); fill.style.width = 0; } }, 800);
  }
};
const docIcon = (d) => /pdf/i.test(d.Mime) ? ['pdf', ''] : /image/i.test(d.Mime) ? ['image', 'img'] : ['doc', 'oth'];
Pages.add({
  id: 'arsip', title: 'Arsip Dokumen', icon: 'arsip', nav: true, group: 'Audit & Arsip',
  render(el, q, st) {
    if (q.k) st.k = q.k; st.tab = q.tab || st.tab || 'kelengkapan';
    const ks = S.t.kontrak.slice().sort(byKey('No_SPK'));
    if (!st.k || !Store.get('kontrak', st.k)) st.k = (ks[0] || {}).ID_Kontrak || '';
    const k = Store.get('kontrak', st.k);
    el.innerHTML = ph({ eyebrow: 'Inspektorat · BPK · APH', eyebrowIc: 'verified', title: 'Arsip Dokumen Kontrak & Kesiapan Audit', desc: 'Pengarsipan scan dokumen bertanda tangan basah dan uji kelengkapan bukti dukung pengadaan per paket pekerjaan.' }) +
      (ks.length ? `<div class="card mb"><div class="filters"><span class="lbl">${ic('task', 'sm')} Paket pekerjaan</span><div style="flex:1;min-width:240px">${selectHtml('k', ks.map((x) => [x.ID_Kontrak, x.No_SPK + ' — ' + ((Store.get('subkeg', x.ID_SubKeg) || {}).Nama_SubKegiatan || x.Uraian_Pekerjaan)]), st.k)}</div></div></div>` : '') + '<div id="arBody"></div>';
    const body = $('#arBody');
    if (!k) { body.innerHTML = `<div class="card">${emptyBox('Belum ada kontrak', 'Arsip dokumen dikelompokkan per kontrak. Tambahkan kontrak terlebih dahulu.', `<a class="btn gold mt" href="#/kontrak">${ic('add', 'sm')}Ke Daftar Kontrak</a>`)}</div>`; }
    else {
      const cl = Calc.checklist(k.ID_Kontrak), docs = S.t.arsip.filter((a) => a.ID_Kontrak === k.ID_Kontrak).sort((a, b) => String(b.Tgl_Upload).localeCompare(String(a.Tgl_Upload)));
      const risk = cl.pct >= 90 ? ['RISIKO RENDAH', 'ok'] : cl.pct >= 60 ? ['RISIKO SEDANG', 'warn'] : ['RISIKO TINGGI', 'err'];
      const missing = cl.items.filter((i) => i.status === 'BELUM');
      body.innerHTML = `<div class="grid g3 mb">${kpi({ l: 'Kepatuhan berkas kontrak', i: 'checklist', gold: true, v: pct(cl.pct), bar: cl.pct, barCls: 'gold', s: `${cl.ok} dari ${cl.total} dokumen wajib lengkap` })}
        ${kpi({ l: 'Status risiko pemeriksaan', i: 'shield', v: chip(risk[0], risk[1]), s: missing.length ? `Tersisa ${missing.length} dokumen: ${esc(missing.slice(0, 2).map((i) => i.m.Item).join(', '))}${missing.length > 2 ? '…' : ''}` : 'Semua dokumen wajib tersedia.' })}
        ${kpi({ l: 'Direktori arsip', i: 'folder', v: `${docs.length} <small>berkas · ${fmtN(docs.reduce((a, d) => a + num(d.Ukuran), 0) / 1048576, 1)} MB</small>`, s: 'Google Drive /Arsip/' + esc(S.tahun) + '/' + esc(k.ID_Kontrak) })}</div>
        <div class="card"><div class="tabs">${[['kelengkapan', 'checklist', 'Kelengkapan Dokumen'], ['galeri', 'image', 'Galeri Scan & Arsip'], ['generator', 'docadd', 'Generator Draf Dokumen']].map((t) => `<button data-tab="${t[0]}" class="${st.tab === t[0] ? 'on' : ''}">${ic(t[1], 'sm')}${t[2]}</button>`).join('')}</div><div id="arTab"></div></div>
        ${Can.arsip() ? `<div class="grid g-64 mt"><div class="card"><div class="card-h"><h3>${ic('upload', 'sm')}Unggah scan dokumen baru</h3><p>Pastikan stempel basah dan tanda tangan pejabat terbaca jelas.</p></div><div class="card-b"><div class="fg mb-s"><div class="f s6"><label>Jenis dokumen</label>${selectHtml('jenis', K.JENIS.map((j) => [j[0], j[1]]), st.jenis || (missing[0] ? missing[0].m.Jenis_Dokumen : 'SPK'))}</div><div class="f s6"><label>Keterangan (opsional)</label><input class="in" name="ket" placeholder="mis. Termin I, foto 50%"></div></div>
          <div class="drop" id="dropA">${ic('upload')}<b>Tarik scan PDF/JPG, Word, atau Excel ke sini, atau klik untuk memilih</b><span class="mini">Maksimal ${esc(S.settings.MAKS_UNGGAH_MB || 10)} MB per dokumen · tersimpan privat di Drive dinas</span><div class="prog hidden"><i></i></div></div><input type="file" id="fileA" class="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"></div></div>
          <div class="card"><div class="card-h"><h3>${ic('info', 'sm')}Standar kepatuhan</h3></div><div class="card-b mini" style="line-height:20px">Dokumen yang diunggah otomatis menandai item checklist dengan jenis yang sama sebagai <b>Lengkap</b>. Gunakan menu <a href="#/checklist?k=${esc(k.ID_Kontrak)}">Checklist Audit</a> untuk menandai "Tidak Perlu", menautkan berkas lain, atau menambah catatan pemeriksa.<br><br>Berkas tidak dibagikan publik: dibuka melalui aplikasi dengan sesi login.</div></div></div>` : ''}`;
      const tb = $('#arTab');
      if (st.tab === 'kelengkapan') tb.innerHTML = `<div class="tw"><table class="t"><thead><tr><th>No</th><th>Tahapan</th><th>Dokumen bukti dukung</th><th>Dasar regulasi</th><th class="c">Status</th><th>Berkas tersimpan</th></tr></thead><tbody>${cl.items.map((it, i) => `<tr class="${it.status === 'BELUM' ? 'flag' : ''}"><td>${i + 1}</td><td><b>${esc(it.m.Tahapan)}</b></td><td>${esc(it.m.Item)}<span class="sub">${esc(jenisNama(it.m.Jenis_Dokumen))}</span></td><td><span class="chip slate">${esc(it.m.Dasar_Regulasi || '-')}</span></td><td class="c">${stChip(K.ST_CL, it.status)}${it.auto ? '<span class="sub">otomatis</span>' : ''}</td><td>${it.doc ? `<a href="#" data-open="${esc(it.doc.ID_Dokumen)}" class="row" style="gap:6px">${ic('pdf', 'sm')}<span>${esc(it.doc.Nama_File)}</span></a><span class="sub">${fmtN(num(it.doc.Ukuran) / 1048576, 1)} MB · ${tgl(String(it.doc.Tgl_Upload).slice(0, 10))}</span>` : `<span class="mini">Belum ada berkas</span>${Can.arsip() && it.status === 'BELUM' ? ` <button class="btn sm" data-up="${esc(it.m.Jenis_Dokumen)}">${ic('upload', 'sm')}Unggah</button>` : ''}`}</td></tr>`).join('')}</tbody></table></div>`;
      else if (st.tab === 'galeri') tb.innerHTML = `<div class="card-b">${docs.length ? `<div class="docs">${docs.map((d) => { const di = docIcon(d); return `<div class="doc"><div class="di ${di[1]}">${ic(di[0])}</div><div style="min-width:0;flex:1"><b>${esc(d.Nama_File)}</b><small>${esc(jenisNama(d.Jenis_Dokumen))} · ${fmtN(num(d.Ukuran) / 1048576, 2)} MB</small><small>${tgl(String(d.Tgl_Upload).slice(0, 10))} · ${esc(Store.nama(d.Oleh))}</small>${d.Keterangan ? `<small>${esc(d.Keterangan)}</small>` : ''}<div class="acts"><button class="btn sm" data-open="${esc(d.ID_Dokumen)}">${ic('eye', 'sm')}Lihat</button><button class="btn sm ghost icon" data-dl="${esc(d.ID_Dokumen)}" title="Unduh">${ic('download', 'sm')}</button>${Can.hapusArsip() ? `<button class="btn sm ghost icon" data-hapus="${esc(d.ID_Dokumen)}" title="Hapus">${ic('trash', 'sm')}</button>` : ''}</div></div></div>`; }).join('')}</div>` : emptyBox('Belum ada dokumen', 'Unggah scan dokumen di panel bawah.')}</div>`;
      else tb.innerHTML = `<div class="card-b">${Gen.listHtml({ ID_Kontrak: k.ID_Kontrak })}</div>`;
      const drop = $('#dropA'); if (drop) Upload.bind(drop, $('#fileA'), (files) => Upload.kirim(files, { ID_Kontrak: k.ID_Kontrak, ID_SubKeg: k.ID_SubKeg, Jenis_Dokumen: $('[name=jenis]', body).value, Keterangan: $('[name=ket]', body).value }, drop));
    }
    el.onchange = (e) => { if (e.target.name === 'k') { st.k = e.target.value; history.replaceState(null, '', '#/arsip'); App.refresh(); } if (e.target.name === 'jenis') st.jenis = e.target.value; };
    el.onclick = async (e) => {
      const t = e.target.closest('[data-tab],[data-open],[data-dl],[data-hapus],[data-up],[data-gen],[data-dok]'); if (!t) return; e.preventDefault();
      if (t.dataset.tab) { st.tab = t.dataset.tab; App.refresh(); }
      if (t.dataset.open) bukaBerkas('arsip.ambil', { ID_Dokumen: t.dataset.open });
      if (t.dataset.dl) bukaBerkas('arsip.ambil', { ID_Dokumen: t.dataset.dl }, 'unduh');
      if (t.dataset.up) { st.jenis = t.dataset.up; const s = $('[name=jenis]', el); if (s) s.value = t.dataset.up; $('#fileA').click(); }
      if (t.dataset.hapus) { const d = Store.get('arsip', t.dataset.hapus); if (!(await confirmBox(`Hapus berkas <b>${esc(d.Nama_File)}</b>? Berkas dipindah ke tempat sampah Drive.`, { danger: true, ok: 'Hapus' }))) return; mutate('arsip.hapus', { ID_Dokumen: d.ID_Dokumen }, { optimistic: () => { const o = Store.remove('arsip', d.ID_Dokumen); return () => Store.upsert('arsip', o); }, okMsg: 'Berkas dihapus.' }); }
      if (t.dataset.gen != null) Gen.open({ ID_Kontrak: st.k, ID_Template: t.dataset.gen || '' });
      if (t.dataset.dok) Gen.unduh(t.dataset.dok, t.dataset.fmt);
    };
  }
});

/* =====================================================================
   7. CHECKLIST KESIAPAN AUDIT
   ===================================================================== */
Pages.add({
  id: 'checklist', title: 'Checklist Kesiapan Audit', icon: 'checklist', nav: true, group: 'Audit & Arsip',
  render(el, q, st) {
    if (q.k) st.k = q.k;
    const ks = S.t.kontrak.slice().sort(byKey('No_SPK'));
    if (!st.k || !Store.get('kontrak', st.k)) st.k = (ks[0] || {}).ID_Kontrak || '';
    if (st.dirtyK !== st.k) { st.dirty = {}; st.dirtyK = st.k; }
    const k = Store.get('kontrak', st.k);
    el.innerHTML = ph({ eyebrow: 'Audit & Pemeriksaan', title: 'Checklist Kesiapan Audit Pemeriksaan Fisik & Keuangan', desc: 'Validasi kelengkapan portofolio pertanggungjawaban kontraktual, fisik, dan keuangan per paket.',
      acts: (Can.admin() ? `<button class="btn" data-act="master">${ic('settings', 'sm')}Kelola Master</button>` : '') + `<button class="btn" data-act="print">${ic('print', 'sm')}Cetak Lembar Kerja</button>` }) +
      (ks.length ? `<div class="card mb"><div class="filters"><span class="lbl">Berkas kontrak aktif</span><div style="flex:1;min-width:240px">${selectHtml('k', ks.map((x) => [x.ID_Kontrak, x.No_SPK + ' — ' + x.Penyedia]), st.k)}</div></div></div>` : '') + '<div id="clBody"></div>';
    const body = $('#clBody');
    if (!k) { body.innerHTML = `<div class="card">${emptyBox('Belum ada kontrak', 'Checklist disusun per kontrak.')}</div>`; }
    else {
      const draw = () => {
        const cl = Calc.checklist(k.ID_Kontrak); const docs = S.t.arsip.filter((a) => a.ID_Kontrak === k.ID_Kontrak);
        const eff = (it) => (st.dirty[it.m.Kode] && st.dirty[it.m.Kode].Status) || it.status;
        const wajib = cl.items.filter((i) => eff(i) !== 'TIDAK_PERLU'), ok = wajib.filter((i) => eff(i) === 'LENGKAP').length, p = wajib.length ? (ok / wajib.length) * 100 : 0;
        const tah = {}; cl.items.forEach((i) => { const t = i.m.Tahapan || 'Lainnya'; tah[t] = tah[t] || { n: 0, ok: 0 }; if (eff(i) !== 'TIDAK_PERLU') { tah[t].n++; if (eff(i) === 'LENGKAP') tah[t].ok++; } });
        const nDirty = Object.keys(st.dirty).length;
        body.innerHTML = `<div class="grid g4 mb">${kpi({ l: 'Skor kesiapan audit', i: 'shield', gold: true, v: pct(p), bar: p, barCls: 'gold', s: `${ok}/${wajib.length} item · ${p >= 90 ? chip('Siap uji petik', 'ok') : chip('Perlu dilengkapi', 'warn')}` })}
          ${Object.keys(tah).slice(0, 3).map((t) => kpi({ l: t, v: `${pct(tah[t].n ? (tah[t].ok / tah[t].n) * 100 : 100, 0)} <small>${tah[t].ok}/${tah[t].n}</small>`, bar: tah[t].n ? (tah[t].ok / tah[t].n) * 100 : 100 })).join('')}</div>
        <div class="note info mb">${ic('info', 'sm')}<div><b>${esc(k.No_SPK)}</b> · ${esc(k.Penyedia)} · ${esc(k.Uraian_Pekerjaan)}. Status otomatis "Lengkap" muncul bila berkas dengan jenis yang sama sudah diunggah; ubah manual bila perlu.</div></div>
        <div class="card"><div class="tw"><table class="t"><thead><tr><th>No</th><th>Item pemeriksaan kepatuhan</th><th>Dasar hukum / regulasi</th><th style="min-width:150px">Status eviden</th><th style="min-width:180px">Tautan berkas</th><th style="min-width:200px">Catatan pengawas</th></tr></thead><tbody>
          ${cl.items.map((it, i) => { const d = st.dirty[it.m.Kode] || {}; const s = d.Status || it.status; const docId = d.ID_Dokumen != null ? d.ID_Dokumen : (it.doc ? it.doc.ID_Dokumen : ''); const cat = d.Catatan != null ? d.Catatan : (it.r ? it.r.Catatan : '');
            return `<tr class="${s === 'BELUM' ? 'flag' : ''}"><td>${String(i + 1).padStart(2, '0')}</td><td><b>${esc(it.m.Item)}</b><span class="sub">${esc(it.m.Tahapan)} · ${esc(jenisNama(it.m.Jenis_Dokumen))}</span></td><td><span class="chip slate">${esc(it.m.Dasar_Regulasi || '-')}</span></td>
            <td>${Can.arsip() ? selectHtml('st_' + it.m.Kode, [['LENGKAP', 'Lengkap'], ['BELUM', 'Belum Lengkap'], ['TIDAK_PERLU', 'Tidak Perlu']], s, 'data-kode="' + esc(it.m.Kode) + '" data-f="Status"') : stChip(K.ST_CL, s)}${it.auto && !d.Status ? '<span class="sub">otomatis dari arsip</span>' : ''}</td>
            <td>${Can.arsip() ? selectHtml('doc_' + it.m.Kode, [['', '— tidak ada —']].concat(docs.map((x) => [x.ID_Dokumen, x.Nama_File])), docId, 'data-kode="' + esc(it.m.Kode) + '" data-f="ID_Dokumen"') : (it.doc ? esc(it.doc.Nama_File) : '-')}</td>
            <td>${Can.arsip() ? `<input class="in" data-kode="${esc(it.m.Kode)}" data-f="Catatan" value="${esc(cat)}" placeholder="Catatan">` : esc(cat)}</td></tr>`; }).join('')}
          </tbody></table></div>
          ${Can.arsip() ? `<div class="card-f" style="position:sticky;bottom:0">${ic(nDirty ? 'edit' : 'check', 'sm')}<span style="margin-right:auto">${nDirty ? `<b>${nDirty} perubahan belum disimpan</b>` : 'Semua perubahan tersimpan.'}</span><button class="btn" data-act="batal" ${nDirty ? '' : 'disabled'}>Batal</button><button class="btn pri" data-act="simpan" ${nDirty ? '' : 'disabled'}>${ic('save', 'sm')}Simpan Checklist</button></div>` : ''}</div>`;
      };
      draw(); st.draw = draw;
      body.onchange = (e) => {
        const t = e.target; if (!t.dataset.kode) return;
        const d = st.dirty[t.dataset.kode] = st.dirty[t.dataset.kode] || {}; d[t.dataset.f] = t.value;
        if (t.dataset.f !== 'Catatan') { draw(); return; }
        const sp = body.querySelector('.card-f span'); if (sp) sp.innerHTML = `<b>${Object.keys(st.dirty).length} perubahan belum disimpan</b>`;
        body.querySelectorAll('.card-f button').forEach((b) => { b.disabled = false; });
      };
    }
    el.onchange = (e) => {
      if (e.target.name !== 'k') return;
      if (Object.keys(st.dirty || {}).length && !confirm('Perubahan checklist belum disimpan. Tinggalkan?')) { e.target.value = st.k; return; }
      st.k = e.target.value; history.replaceState(null, '', '#/checklist'); App.refresh();
    };
    el.onclick = (e) => {
      const t = e.target.closest('[data-act]'); if (!t) return;
      if (t.dataset.act === 'print') window.print();
      if (t.dataset.act === 'master') Pages.masterChecklist();
      if (t.dataset.act === 'batal') { st.dirty = {}; st.draw(); }
      if (t.dataset.act === 'simpan') {
        const cl = Calc.checklist(k.ID_Kontrak);
        const items = Object.keys(st.dirty).map((kode) => { const it = cl.items.find((x) => x.m.Kode === kode); const d = st.dirty[kode]; return { Kode_Item: kode, Status: d.Status || it.status, ID_Dokumen: d.ID_Dokumen != null ? d.ID_Dokumen : (it.doc ? it.doc.ID_Dokumen : ''), Catatan: d.Catatan != null ? d.Catatan : (it.r ? it.r.Catatan : '') }; });
        const dirty = st.dirty; st.dirty = {};
        mutate('checklist.simpan', { ID_Kontrak: k.ID_Kontrak, items }, { table: 'checklist', btn: t,
          optimistic: () => { const olds = []; items.forEach((it) => { const ex = S.t.checklist.find((c) => c.ID_Kontrak === k.ID_Kontrak && c.Kode_Item === it.Kode_Item); olds.push(ex ? Object.assign({}, ex) : null); Store.upsert('checklist', Object.assign({}, ex || { ID: uid() }, it, { ID_Kontrak: k.ID_Kontrak, _pending: true })); }); return () => { st.dirty = dirty; items.forEach((it, i) => { if (olds[i]) Store.upsert('checklist', olds[i]); else { const c = S.t.checklist.find((x) => x.ID_Kontrak === k.ID_Kontrak && x.Kode_Item === it.Kode_Item); if (c) Store.remove('checklist', c.ID); } }); }; },
          okMsg: 'Checklist disimpan.' });
      }
    };
  }
});
Pages.masterChecklist = function () {
  const rows = S.t.checklistMaster.slice().sort((a, b) => num(a.Urutan) - num(b.Urutan));
  const tr = (r, i) => `<tr><td><input class="in" data-c="Urutan" value="${esc(r.Urutan || i + 1)}" style="width:60px"></td><td><input class="in" data-c="Tahapan" value="${esc(r.Tahapan || '')}"></td><td><input class="in" data-c="Item" value="${esc(r.Item || '')}"></td><td><input class="in" data-c="Dasar_Regulasi" value="${esc(r.Dasar_Regulasi || '')}"></td><td>${selectHtml('j', K.JENIS, r.Jenis_Dokumen, 'data-c="Jenis_Dokumen"')}</td><td>${selectHtml('a', [['YA', 'Aktif'], ['TIDAK', 'Nonaktif']], r.Aktif || 'YA', 'data-c="Aktif"')}</td><td><input type="hidden" data-c="Kode" value="${esc(r.Kode || '')}"></td></tr>`;
  const m = modal({ title: 'Master Checklist Audit', icon: 'checklist', size: 'lg', body: `<div class="note warn mb">${ic('warn', 'sm')}<div>Lengkapi kolom <b>Dasar Regulasi</b> dengan pasal yang berlaku (Perpres PBJ & perubahannya, ketentuan pengelolaan keuangan daerah). Isi awal bersifat umum dan perlu diverifikasi bagian hukum/PBJ.</div></div><div class="tw"><table class="t light"><thead><tr><th>Urut</th><th>Tahapan</th><th>Item</th><th>Dasar regulasi</th><th>Jenis dokumen</th><th>Status</th><th></th></tr></thead><tbody id="mcBody">${rows.map(tr).join('')}</tbody></table></div><button class="btn sm mt" data-add>${ic('add', 'sm')}Tambah item</button>`,
    foot: `<button class="btn" data-x>Batal</button><button class="btn pri" data-save>${ic('save', 'sm')}Simpan Master</button>` });
  m.el.querySelector('[data-add]').onclick = () => m.el.querySelector('#mcBody').insertAdjacentHTML('beforeend', tr({ Aktif: 'YA', Jenis_Dokumen: 'LAINNYA' }, m.el.querySelectorAll('#mcBody tr').length));
  m.el.querySelector('[data-save]').onclick = (e) => {
    const items = $$('#mcBody tr', m.el).map((t) => { const o = {}; $$('[data-c]', t).forEach((i) => { o[i.dataset.c] = i.value.trim(); }); o.Urutan = num(o.Urutan); return o; }).filter((o) => o.Item);
    mutate('checklistMaster.simpan', { items }, { btn: e.target, onOk: (d) => { if (d.rows) { S.t.checklistMaster = d.rows.map(Store.normRow); Store.bump(); Store.save(); } m.close(); }, okMsg: 'Master checklist disimpan.' });
  };
};

/* =====================================================================
   8. LAPORAN & REKAP (grafik, tabel, lembar monev, dokumen)
   ===================================================================== */
Pages.add({
  id: 'laporan', title: 'Laporan & Rekap', icon: 'laporan', nav: true, group: 'Audit & Arsip', short: 'Laporan',
  render(el, q, st) {
    st.tab = q.tab || st.tab || 'grafik'; st.cut = st.cut || Calc.cutDefault(); st.bidang = st.bidang == null ? '' : st.bidang;
    el.innerHTML = ph({ eyebrow: 'Modul Akuntabilitas Kinerja & Keuangan', title: 'Laporan & Rekap Eksekutif Anggaran', desc: `Kompilasi realisasi fisik, penyerapan keuangan SP2D, dan evaluasi triwulanan TA ${esc(S.tahun)}.` }) +
      `<div class="card"><div class="tabs no-print">${[['grafik', 'chart', 'Grafik & Analisis'], ['tabel', 'table', 'Tabel Rekapitulasi'], ['monev', 'review', 'Lembar Monev (Bagian Program)'], ['dokumen', 'docadd', 'Dokumen Otomatis']].map((t) => `<button data-tab="${t[0]}" class="${st.tab === t[0] ? 'on' : ''}">${ic(t[1], 'sm')}${t[2]}</button>`).join('')}</div><div id="lpBody"></div></div>`;
    const b = $('#lpBody');
    this[st.tab](b, st, q);
    el.onclick = (e) => { const t = e.target.closest('[data-tab]'); if (t) { st.tab = t.dataset.tab; history.replaceState(null, '', '#/laporan'); App.refresh(); } };
  },
  filt(st) { return `<div class="filters no-print" style="border-bottom:1px solid var(--border)">${selectHtml('bidang', optBidang(), st.bidang)}${cutSelect(st)}<span class="spacer"></span><button class="btn" data-x="xls">${ic('excel', 'sm')}Export Excel</button><button class="btn pri" data-x="print">${ic('pdf', 'sm')}Cetak / PDF</button></div>`; },
  bindFilt(b, st, xls) { b.onchange = (e) => { if (e.target.name === 'bidang' || e.target.name === 'cut') { st[e.target.name] = e.target.value; App.refresh(); } }; b.addEventListener('click', (e) => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'print') window.print(); if (x.dataset.x === 'xls') xls(); }); },
  grafik(b, st) {
    const cut = num(st.cut), list = Calc.subkeg({ bidang: st.bidang }), a = Calc.agg(list, cut);
    const months = [...Array(12).keys()].map((i) => i + 1);
    const ren = months.map((m) => Calc.agg(list, m).ren), fis = months.map((m) => (m <= cut ? Calc.agg(list, m).fisik : null)), keu = months.map((m) => (m <= cut ? Calc.agg(list, m).keuPct : null));
    const ks = Calc.kesiapan(S.t.kontrak.filter((k) => list.some((s) => s.ID_SubKeg === k.ID_SubKeg)));
    const bid = Store.bidangList().filter((x) => !st.bidang || sameBidang(x, st.bidang)).map((x) => ({ x, g: Calc.agg(Calc.subkeg({ bidang: x }), cut) })).filter((y) => y.g.n);
    b.innerHTML = this.filt(st) + `<div class="card-b"><div class="print-only"><h2 style="margin:0">Rekap Eksekutif Anggaran TA ${esc(S.tahun)} — s.d. ${K.BULAN[cut - 1]}</h2><p>${esc(S.settings.NAMA_INSTANSI || '')}${st.bidang ? ' · Bidang ' + esc(st.bidang) : ''}</p></div>
      <div class="grid g4 mb">${kpi({ l: 'Total pagu DPA', i: 'bank', v: rpS(a.pagu), s: a.n + ' sub kegiatan' })}${kpi({ l: 'Realisasi keuangan (SP2D)', i: 'receipt', v: rpS(a.keu), bar: a.keuPct, barCls: 'gold', s: pct(a.keuPct) + ' · target ' + pct(a.ren, 0) })}${kpi({ l: 'Rata-rata progres fisik', i: 'trend', v: pct(a.fisik), bar: a.fisik, tick: a.ren, s: devChip(a.dev) + ' terhadap rencana' })}${kpi({ l: 'Kepatuhan administrasi PBJ', i: 'checklist', gold: true, v: pct(ks.pct), s: ks.siap + '/' + ks.n + ' kontrak lengkap' })}</div>
      <div class="grid g-73"><div class="card"><div class="card-h"><h3>Kurva S realisasi kumulatif</h3><div class="acts">${Chart.legend([{ name: 'Rencana', color: '#9CA3AF' }, { name: 'Fisik', color: '#1E3A5F' }, { name: 'Keuangan', color: '#D4A017' }])}</div></div><div class="card-b">${Chart.line({ xs: K.BLN, mark: cut - 1, series: [{ name: 'Rencana', color: '#9CA3AF', values: ren, dash: true, w: 2 }, { name: 'Fisik', color: '#1E3A5F', values: fis, dots: true }, { name: 'Keuangan', color: '#D4A017', values: keu, dots: true }] })}
        <table class="t light mt"><thead><tr><th>Tahapan</th><th class="n">Target</th><th class="n">Real. Fisik</th><th class="n">Real. Keu</th><th class="c">Deviasi</th></tr></thead><tbody>${[1, 2, 3, 4].map((tw) => { const g = Calc.agg(list, tw * 3); const fut = tw * 3 > cut && Math.ceil(cut / 3) < tw; return `<tr class="${Math.ceil(cut / 3) === tw ? 'flag' : ''}"><td>Triwulan ${K.ROMAWI[tw]}</td><td class="n">${pct(g.ren)}</td><td class="n">${fut ? '-' : pct(g.fisik)}</td><td class="n">${fut ? '-' : pct(g.keuPct)}</td><td class="c">${fut ? chip('Rencana', 'slate') : devChip(g.dev)}</td></tr>`; }).join('')}</tbody></table></div></div>
      <div class="card"><div class="card-h"><h3>Kinerja anggaran per bidang</h3></div><div class="card-b" style="padding-top:4px">${bid.map((y) => `<div class="bid"><div class="bid-h"><div><b>${esc(y.x)}</b><small>Pagu ${rp(y.g.pagu)}</small></div><div style="text-align:right"><b>${pct(y.g.keuPct)} keu</b><small>${pct(y.g.fisik)} fisik</small></div></div><div class="bid-r"><span>FISIK</span>${bar(y.g.fisik, '', y.g.ren)}<span>${pct(y.g.fisik)}</span></div><div class="bid-r"><span>KEU</span>${bar(y.g.keuPct, 'gold')}<span>${pct(y.g.keuPct)}</span></div></div>`).join('') || emptyBox('Belum ada data', '')}</div></div></div></div>`;
    this.bindFilt(b, st, () => this.xlsRekap(list, cut));
  },
  tabel(b, st) {
    st.cari = st.cari || ''; const cut = num(st.cut);
    b.innerHTML = this.filt(st) + `<div class="filters no-print"><div class="search">${ic('search')}<input class="in" name="cari" placeholder="Cari sub kegiatan, penyedia, PIC…" value="${esc(st.cari)}"></div></div><div id="rkT"></div>`;
    const draw = () => {
      const c = norm(st.cari);
      const list = Calc.subkeg({ bidang: st.bidang }).filter((s) => !c || norm([s.Kode_SubKeg, s.Nama_SubKegiatan, s.Bidang, Store.nama(s.PIC_Email), S.t.kontrak.filter((k) => k.ID_SubKeg === s.ID_SubKeg).map((k) => k.Penyedia).join(' ')].join(' ')).indexOf(c) > -1).sort(byKey('Kode_SubKeg'));
      const rows = list.map((s) => Calc.sk(s, cut)); const a = Calc.agg(list, cut);
      $('#rkT').innerHTML = `<div class="print-only" style="padding:0 0 8px"><h2 style="margin:0">Rekapitulasi Kinerja & Penyerapan Anggaran per Sub Kegiatan — TA ${esc(S.tahun)} s.d. ${K.BULAN[cut - 1]}</h2></div>${rows.length ? `<div class="tw"><table class="t"><thead><tr><th>No</th><th>Kode</th><th>Sub kegiatan & kontrak</th><th>Bidang / PIC</th><th class="n">Pagu DPA (Rp)</th><th class="n">Target fisik</th><th class="n">Real. fisik</th><th class="c">Deviasi</th><th class="n">Real. SP2D (Rp)</th><th class="n">% Keu</th></tr></thead><tbody>${rows.map((x, i) => `<tr><td>${i + 1}</td><td class="mono">${esc(x.sk.Kode_SubKeg)}</td><td style="min-width:240px"><b>${esc(x.sk.Nama_SubKegiatan)}</b>${x.kontrak.map((k) => `<span class="sub">${esc(k.Penyedia)} · ${esc(k.No_SPK)}</span>`).join('')}</td><td>${esc(x.sk.Bidang)}<span class="sub">${esc(Store.nama(x.sk.PIC_Email))}</span></td><td class="n">${fmtN(x.pagu)}</td><td class="n">${pct(x.ren)}</td><td class="n"><b>${pct(x.fisik)}</b></td><td class="c">${devChip(x.dev)}</td><td class="n">${fmtN(x.keu)}</td><td class="n">${pct(x.keuPct)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="4">Grand total (${rows.length} sub kegiatan)</td><td class="n">${fmtN(a.pagu)}</td><td class="n">${pct(a.ren)}</td><td class="n">${pct(a.fisik)}</td><td class="c">${devChip(a.dev)}</td><td class="n">${fmtN(a.keu)}</td><td class="n">${pct(a.keuPct)}</td></tr></tfoot></table></div>` : emptyBox('Tidak ada data', '')}`;
    };
    draw();
    b.oninput = debounce((e) => { if (e.target.name === 'cari') { st.cari = e.target.value; draw(); } }, 120);
    this.bindFilt(b, st, () => this.xlsRekap(Calc.subkeg({ bidang: st.bidang }), cut));
  },
  xlsRekap(list, cut) {
    const aoa = [['REKAPITULASI KINERJA DAN PENYERAPAN ANGGARAN PER SUB KEGIATAN'], [S.settings.NAMA_INSTANSI || '', '', 'TA ' + S.tahun + ' s.d. ' + K.BULAN[cut - 1]], [], ['No', 'Kode', 'Program', 'Kegiatan', 'Sub Kegiatan', 'Bidang', 'PIC', 'Pagu', 'Target Fisik %', 'Realisasi Fisik %', 'Deviasi %', 'Realisasi Keuangan', '% Keuangan', 'Kontrak']];
    list.slice().sort(byKey('Kode_SubKeg')).forEach((s, i) => { const x = Calc.sk(s, cut); aoa.push([i + 1, s.Kode_SubKeg, s.Nama_Program, s.Nama_Kegiatan, s.Nama_SubKegiatan, s.Bidang, Store.nama(s.PIC_Email), x.pagu, +x.ren.toFixed(2), +x.fisik.toFixed(2), +x.dev.toFixed(2), x.keu, +x.keuPct.toFixed(2), x.kontrak.map((k) => k.No_SPK + ' (' + k.Penyedia + ')').join('; ')]); });
    exportXlsx('Rekap_Anggaran_' + S.tahun + '_sd_' + K.BLN[cut - 1], [{ name: 'Rekap', aoa, cols: [5, 20, 30, 30, 40, 18, 24, 16, 10, 10, 10, 16, 10, 40] }]);
  },
  /* ---- Lembar Monev format Bagian Program (meniru file MONEV_STRUKTURAL) ---- */
  monev(b, st, q) {
    if (q.p) st.mp = q.p; if (q.tw) st.mtw = num(q.tw);
    st.mtw = st.mtw || num(S.settings.TRIWULAN_AKTIF) || 1;
    const pej = S.t.pengguna.filter((u) => (u.Role === 'PEJABAT' || u.Role === 'ADMIN') && u.Aktif !== 'TIDAK' && skLingkup(u.Email).length).sort(byKey('Nama'));
    const bisaSemua = Can.role('ADMIN', 'PROGRAM');
    const pilihan = bisaSemua ? pej : pej.filter((u) => norm(u.Email) === norm(S.me.email) || (S.me.turunan || []).map(norm).indexOf(norm(u.Email)) > -1);
    if (!st.mp || !pilihan.some((u) => norm(u.Email) === norm(st.mp))) st.mp = (pilihan[0] || {}).Email || '';
    b.innerHTML = `<div class="filters no-print" style="border-bottom:1px solid var(--border)">${pilihan.length ? selectHtml('mp', pilihan.map((u) => [u.Email, u.Nama + ' — ' + (u.Jabatan || '')]), st.mp) : ''}${selectHtml('mtw', [1, 2, 3, 4].map((t) => [t, 'Triwulan ' + K.ROMAWI[t]]), st.mtw)}<span class="spacer"></span>${bisaSemua ? `<button class="btn" data-m="xlsAll">${ic('excel', 'sm')}Excel semua pejabat</button>` : ''}<button class="btn" data-m="xls">${ic('excel', 'sm')}Excel lembar ini</button><button class="btn pri" data-m="print">${ic('print', 'sm')}Cetak / PDF</button></div>
      <div class="card-b" style="background:var(--bg)">${st.mp ? Monev.html(st.mp, st.mtw) : emptyBox('Belum ada pejabat dengan sub kegiatan', 'Atur PIC sub kegiatan di Perencanaan Anggaran dan atasan langsung di Manajemen User.')}</div>`;
    b.onchange = (e) => { if (e.target.name === 'mp' || e.target.name === 'mtw') { st[e.target.name] = e.target.name === 'mtw' ? num(e.target.value) : e.target.value; history.replaceState(null, '', '#/laporan'); App.refresh(); } };
    b.onclick = (e) => { const x = e.target.closest('[data-m]'); if (!x) return; if (x.dataset.m === 'print') window.print(); if (x.dataset.m === 'xls') Monev.xls([st.mp], st.mtw); if (x.dataset.m === 'xlsAll') Monev.xls(pej.map((u) => u.Email), st.mtw); };
  },
  dokumen(b) {
    b.innerHTML = `<div class="card-b">${Gen.listHtml({})}</div>`;
    b.onclick = (e) => { const t = e.target.closest('[data-gen],[data-dok]'); if (!t) return; if (t.dataset.gen != null) Gen.open({ ID_Template: t.dataset.gen || '' }); if (t.dataset.dok) Gen.unduh(t.dataset.dok, t.dataset.fmt); };
  }
});

/* ---------- Lembar Monev (format MONEV_STRUKTURAL Dishub) ---------- */
const Monev = {
  data(email, tw) {
    const u = Store.user(email) || { Email: email, Nama: email }; const at = Store.user(u.Atasan_Email) || {};
    const sks = skLingkup(email).sort(byKey('Kode_SubKeg'));
    const prog = {}; sks.forEach((s) => { const p = (s.Kode_Program || '') + '|' + (s.Nama_Program || ''); const k = (s.Kode_Kegiatan || '') + '|' + (s.Nama_Kegiatan || ''); prog[p] = prog[p] || {}; (prog[p][k] = prog[p][k] || []).push(s); });
    const ev = S.t.evaluasi.find((v) => norm(v.Email_Pejabat) === norm(email) && v.Triwulan === tw);
    return { u, at, sks, prog, ev };
  },
  /** baris tabel A: [no, nama, indikator, target, satuan, f1..f4, %, pagu, k1..k4, %keu, ket, level] */
  rows(d, tw) {
    const out = []; let no = 0;
    const line = (lv, list, label, ind, tgt, sat, nomor) => {
      const pagu = list.reduce((a, s) => a + num(s.Pagu), 0);
      const f = [1, 2, 3, 4].map((t) => (t <= tw ? (pagu ? list.reduce((a, s) => a + Calc.fisikTW(s.ID_SubKeg, t) * num(s.Pagu), 0) / pagu : 0) : null));
      const k = [1, 2, 3, 4].map((t) => (t <= tw ? list.reduce((a, s) => a + Calc.keuTW(s.ID_SubKeg, t), 0) : null));
      const keuTot = k.reduce((a, v) => a + (v || 0), 0);
      const last = lv === 3 ? (Calc.realRows(list[0].ID_SubKeg).filter((r) => r.Bulan <= tw * 3).pop() || {}) : {};
      out.push({ lv, no: nomor || '', nama: label, ind: ind || '', tgt: tgt == null ? '' : tgt, sat: sat || '', f, fp: f[tw - 1] || 0, pagu, k, kp: pagu ? (keuTot / pagu) * 100 : 0, ket: lv === 3 ? [last.Uraian, last.Kendala ? 'Kendala: ' + last.Kendala : ''].filter(Boolean).join('. ') : '' });
    };
    Object.keys(d.prog).forEach((p) => { const kegs = d.prog[p]; line(1, Object.values(kegs).flat(), p.split('|')[1] || '(Program)', '', null, ''); Object.keys(kegs).forEach((k) => { no++; line(2, kegs[k], k.split('|')[1] || '(Kegiatan)', '', null, '', no); kegs[k].forEach((s) => line(3, [s], s.Nama_SubKegiatan, s.Indikator, s.Target, s.Satuan)); }); });
    return out;
  },
  html(email, tw) {
    const d = this.data(email, tw), rows = this.rows(d, tw), eselon = d.u.Atasan_Email && (Store.user(d.u.Atasan_Email) || {}).Atasan_Email ? 'IV' : 'III';
    const f = (v) => (v == null ? '' : fmtN(v, 1).replace(/,0$/, '')), g = (v) => (v == null ? '' : fmtN(v));
    const kota = S.settings.KOTA || 'Balikpapan', tglMon = d.ev && d.ev.Tgl_Monev ? tglP(d.ev.Tgl_Monev) : '…………………';
    return `<div class="monev-page monev"><h2>FORMAT LAPORAN DAN MONEV KINERJA PEGAWAI (ESELON ${eselon}) TAHUN ${esc(S.tahun)}</h2>
      <table class="idn"><tr><td>Nama Pejabat yang Melaporkan Kinerja</td><td>: ${esc(d.u.Nama)}</td></tr><tr><td>Jabatan Pelapor</td><td>: ${esc(d.u.Jabatan || '')}</td></tr><tr><td>Nama Pimpinan yang Melakukan Monev</td><td>: ${esc(d.at.Nama || '-')}</td></tr><tr><td>Jabatan Pimpinan Pelapor</td><td>: ${esc(d.at.Jabatan || '-')}</td></tr><tr><td>Periode Waktu Monitoring</td><td>: Triwulan ${K.ROMAWI[tw]}</td></tr></table>
      <p style="margin:12px 0 4px"><b>A. LAPORAN CAPAIAN KINERJA INDIVIDU DAN REALISASI ANGGARAN</b></p>
      <div class="tw"><table class="mt"><thead><tr><th rowspan="2">No</th><th colspan="4">Kinerja</th><th colspan="5">Realisasi Fisik (% kumulatif)</th><th colspan="6">Keuangan (Rp)</th><th rowspan="2">Keterangan / Penjelasan</th></tr>
        <tr><th>Program/ Kegiatan/ Sub Kegiatan</th><th>Indikator Program/ Outcome/ Hasil</th><th>Target</th><th>Satuan</th><th>TW I</th><th>TW II</th><th>TW III</th><th>TW IV</th><th>%</th><th>Pagu</th><th>TW I</th><th>TW II</th><th>TW III</th><th>TW IV</th><th>%</th></tr></thead>
        <tbody>${rows.length ? rows.map((r) => `<tr style="${r.lv === 1 ? 'font-weight:700;background:#F2F2F2' : r.lv === 2 ? 'font-weight:600' : ''}"><td style="text-align:center">${r.no}</td><td style="${r.lv === 3 ? 'padding-left:14px' : ''}">${esc(r.nama)}</td><td>${esc(r.ind)}</td><td style="text-align:right">${r.tgt === '' ? '' : esc(fmtN(r.tgt, 2).replace(/,00$/, ''))}</td><td>${esc(r.sat)}</td>${r.f.map((v) => `<td style="text-align:right">${f(v)}</td>`).join('')}<td style="text-align:right">${f(r.fp)}</td><td style="text-align:right">${g(r.pagu)}</td>${r.k.map((v) => `<td style="text-align:right">${g(v)}</td>`).join('')}<td style="text-align:right">${f(r.kp)}</td><td>${esc(r.ket)}</td></tr>`).join('') : '<tr><td colspan="17" style="text-align:center">Tidak ada sub kegiatan dalam lingkup pejabat ini.</td></tr>'}</tbody></table></div>
      <p style="margin:12px 0 4px"><b>B. PENILAIAN PIMPINAN</b></p><p style="margin:0">Berdasarkan capaian kinerja yang diperjanjikan dan realisasi anggaran sampai dengan saat ini dapat disimpulkan bahwa dalam melaksanakan tugas dan fungsi saudara termasuk dalam kriteria: <b>${d.ev && d.ev.Predikat ? esc(K.PREDIKAT[d.ev.Predikat]) : 'Sangat Berhasil / Berhasil / Kurang Berhasil / Tidak Berhasil'}</b>${d.ev && d.ev.Status !== 'TERKUNCI' ? ' <i>(draf, belum dikunci)</i>' : ''}</p>
      ${d.ev && d.ev.Catatan ? `<p style="margin:4px 0 0">${esc(d.ev.Catatan)}</p>` : ''}
      <p style="margin:12px 0 4px"><b>C. ARAHAN/ SOLUSI DARI PIMPINAN</b></p><p style="margin:0">Untuk meningkatkan Capaian Kinerja dan Penyerapan Anggaran, diminta agar Saudara melaksanakan hal-hal sebagai berikut:</p><p style="margin:4px 0 0;white-space:pre-line">${d.ev && d.ev.Arahan ? esc(d.ev.Arahan) : '1. ……………………………………\n2. ……………………………………\n3. ……………………………………'}</p>
      <div class="ttd"><div>Telah dilakukan Monitoring dan Evaluasi pada tanggal ${esc(tglMon)}<br>${esc(d.at.Jabatan || '')}<div class="sp"></div><b><u>${esc(String(d.at.Nama || '').toUpperCase())}</u></b><br>NIP. ${esc(d.at.NIP || '')}</div>
      <div>${esc(kota)}, ${esc(tglMon)}<br>${esc(d.u.Jabatan || '')}<div class="sp"></div><b><u>${esc(String(d.u.Nama || '').toUpperCase())}</u></b><br>NIP. ${esc(d.u.NIP || '')}</div></div></div>`;
  },
  aoa(email, tw) {
    const d = this.data(email, tw), rows = this.rows(d, tw);
    const r2 = (v) => (v == null ? '' : Math.round(v * 100) / 100);
    const out = [['LAPORAN DAN MONEV KINERJA INDIVIDU PEGAWAI TAHUN ' + S.tahun], [], ['Nama Pejabat yang Melaporkan Kinerja', '', '', ': ' + d.u.Nama], ['Jabatan Pelapor', '', '', ': ' + (d.u.Jabatan || '')], ['Nama Pimpinan yang Melakukan Monev', '', '', ': ' + (d.at.Nama || '')], ['Jabatan Pimpinan Pelapor', '', '', ': ' + (d.at.Jabatan || '')], ['Periode Waktu Monitoring', '', '', ': Triwulan ' + K.ROMAWI[tw]], [],
      ['A. LAPORAN CAPAIAN KINERJA INDIVIDU DAN REALISASI ANGGARAN'],
      ['No', 'Program/ Kegiatan/ Sub Kegiatan', 'Indikator Program/ Outcome/ Hasil', 'Target', 'Satuan', 'Fisik TW I (%)', 'Fisik TW II (%)', 'Fisik TW III (%)', 'Fisik TW IV (%)', '%', 'Pagu', 'Keu TW I', 'Keu TW II', 'Keu TW III', 'Keu TW IV', '% Keu', 'Keterangan/ Penjelasan']];
    rows.forEach((r) => out.push([r.no, (r.lv === 3 ? '   ' : '') + r.nama, r.ind, r.tgt, r.sat].concat(r.f.map(r2), [r2(r.fp), r.pagu], r.k.map((v) => (v == null ? '' : v)), [r2(r.kp), r.ket])));
    out.push([], ['B. PENILAIAN PIMPINAN'], ['Kriteria: ' + (d.ev && d.ev.Predikat ? K.PREDIKAT[d.ev.Predikat] + (d.ev.Status !== 'TERKUNCI' ? ' (draf)' : '') : 'Belum dinilai')], [], ['C. ARAHAN/ SOLUSI DARI PIMPINAN']);
    String((d.ev && d.ev.Arahan) || '').split('\n').filter(Boolean).forEach((l) => out.push([l]));
    out.push([], ['Telah dilakukan Monitoring dan Evaluasi', '', '', '', '', '', '', '', '', '', (S.settings.KOTA || 'Balikpapan') + ', ' + (d.ev && d.ev.Tgl_Monev ? tglP(d.ev.Tgl_Monev) : '')], [d.at.Jabatan || '', '', '', '', '', '', '', '', '', '', d.u.Jabatan || ''], [], [], [d.at.Nama || '', '', '', '', '', '', '', '', '', '', d.u.Nama || ''], ['NIP. ' + (d.at.NIP || ''), '', '', '', '', '', '', '', '', '', 'NIP. ' + (d.u.NIP || '')], [], []);
    return out;
  },
  xls(emails, tw) {
    const byB = {}; emails.forEach((e) => { const u = Store.user(e) || {}; const b = 'TW ' + K.ROMAWI[tw] + '. ' + String(u.Bidang || 'LAINNYA').toUpperCase(); (byB[b] = byB[b] || []).push(e); });
    exportXlsx('MONEV_STRUKTURAL_DISHUB_' + S.tahun + '_TW' + tw, Object.keys(byB).map((b) => ({ name: b, cols: [5, 44, 40, 8, 10, 9, 9, 9, 9, 7, 16, 14, 14, 14, 14, 7, 40], aoa: byB[b].reduce((a, e) => a.concat(this.aoa(e, tw)), []) })));
  }
};

/* =====================================================================
   GENERATOR DOKUMEN dari template (SPK, BAST, Laporan)
   ===================================================================== */
const Gen = {
  PAKET: ['INSTRUKSI', 'HPS', 'SPESIFIKASI'],
  JENIS: { SPK: 'SPK / Kontrak', BAST: 'BAST', LAPORAN: 'Laporan', INSTRUKSI: 'Instruksi PPK', HPS: 'HPS', SPESIFIKASI: 'Spesifikasi Teknis', LAINNYA: 'Lainnya' },
  skema(t) { try { return JSON.parse(t.Skema || '[]'); } catch (e) { return []; } },
  /** Template yang relevan: paket pengadaan → Instruksi/HPS/Spesifikasi(+Lainnya); konteks lain → selain ketiganya */
  tplFor(ctx) {
    return S.t.template.filter((t) => t.Aktif !== 'TIDAK' && (ctx.jenis ? t.Jenis === ctx.jenis : ctx.ID_Paket ? this.PAKET.concat('LAINNYA').indexOf(t.Jenis) > -1 : this.PAKET.indexOf(t.Jenis) < 0));
  },
  isSheets(x) { return (x && x.Engine) === 'sheets'; },
  listHtml(ctx) {
    const tps = this.tplFor(ctx);
    const docs = S.t.dokumen.filter((d) => (ctx.ID_Paket ? d.ID_Paket === ctx.ID_Paket : !ctx.ID_Kontrak || d.ID_Kontrak === ctx.ID_Kontrak)).sort((a, b) => String(b.Dibuat).localeCompare(String(a.Dibuat)));
    const btn = (d) => `${d.File_Pdf ? `<button class="btn sm" data-dok="${esc(d.ID)}" data-fmt="pdf">${ic('pdf', 'sm')}PDF</button>` : ''} ${this.isSheets(d) ? `<button class="btn sm" data-dok="${esc(d.ID)}" data-fmt="xlsx">${ic('excel', 'sm')}XLSX</button>` : d.File_Docs ? `<button class="btn sm" data-dok="${esc(d.ID)}" data-fmt="docx">${ic('doc', 'sm')}DOCX</button>` : ''}`;
    return `<div class="note warn mb">${ic('info', 'sm')}<div>Dokumen yang dihasilkan adalah <b>draf siap cetak</b> (Word/Excel + PDF). Tanda tangan tetap basah: cetak → tandatangani → scan → unggah ke Arsip Dokumen. Template disusun dari kerangka umum dan wajib direview bagian hukum/PBJ sebelum dipakai resmi.</div></div>
      ${tps.length ? `<div class="docs mb">${tps.map((t) => `<div class="doc"><div class="di oth">${ic(this.isSheets(t) ? 'excel' : 'docadd')}</div><div style="flex:1"><b>${esc(t.Nama)}</b><small>${esc(this.JENIS[t.Jenis] || t.Jenis)} · ${this.isSheets(t) ? 'Excel' : 'Word'} · v${esc(t.Versi || 1)} · ${this.skema(t).length} isian</small>${Can.generate() ? `<div class="acts"><button class="btn sm pri" data-gen="${esc(t.ID_Template)}">${ic('docadd', 'sm')}Buat dokumen</button></div>` : ''}</div></div>`).join('')}</div>` : `<div class="empty">${ic('doc')}<b>Belum ada template dokumen${ctx.ID_Paket ? ' pengadaan' : ''}</b><div>Admin dapat mengunggah template ${ctx.ID_Paket ? 'Instruksi/HPS/Spesifikasi' : 'SPK/BAST/Laporan'} (Word, Excel, atau PDF) di menu Pengaturan → Template Dokumen.</div>${Can.admin() ? '<a class="btn gold mt" href="#/pengaturan?tab=template">' + ic('upload', 'sm') + 'Unggah template</a>' : ''}</div>`}
      <div class="lbl mb-s">Riwayat dokumen yang dihasilkan (${docs.length})</div>
      ${docs.length ? `<div class="tw"><table class="t light"><thead><tr><th>Dokumen</th><th>Nomor</th><th>Terkait</th><th>Dibuat</th><th></th></tr></thead><tbody>${docs.map((d) => { const t = Store.get('template', d.ID_Template) || {}; const k = Store.get('kontrak', d.ID_Kontrak); const p = d.ID_Paket ? Store.get('pengadaan', d.ID_Paket) : null; const s = Store.get('subkeg', d.ID_SubKeg); return `<tr><td><b>${esc(t.Nama || d.Jenis)}</b><span class="sub">${esc(this.JENIS[d.Jenis] || d.Jenis)}</span></td><td class="mono">${esc(d.Nomor || '-')}</td><td>${esc(p ? p.Nama_Paket : k ? k.No_SPK : s ? s.Nama_SubKegiatan : '-')}</td><td>${esc(Store.nama(d.Oleh))}<span class="sub">${tgl(String(d.Dibuat).slice(0, 10))}</span></td><td class="acts">${btn(d)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="mini">Belum ada dokumen.</p>'}`;
  },
  unduh(id, fmt) {
    const d = Store.get('dokumen', id); if (!d) return;
    const fid = fmt === 'pdf' ? d.File_Pdf : fmt === 'xlsx' ? d.File_Xlsx || d.File_Docs : d.File_Docs;
    bukaBerkas('berkas.ambil', { fileId: fid, format: fmt }, fmt === 'pdf' ? 'lihat' : 'unduh');
  },
  /** Konteks data: kontrak, paket pengadaan, sub kegiatan (saling melengkapi) */
  konteks(ctx) {
    const k0 = ctx.ID_Kontrak ? Store.get('kontrak', ctx.ID_Kontrak) : null;
    const pid = ctx.ID_Paket || (k0 && k0.ID_Paket) || '';
    const p = pid ? Store.get('pengadaan', pid) || null : null;
    const k = k0 || (p && p.ID_Kontrak ? Store.get('kontrak', p.ID_Kontrak) || null : null);
    const sk = Store.get('subkeg', (k && k.ID_SubKeg) || (p && p.ID_SubKeg) || ctx.ID_SubKeg) || null;
    return { k, p, sk };
  },
  /** Nilai otomatis dari data aplikasi */
  prefill(ctx) {
    const st = S.settings, c = this.konteks(ctx), k = c.k, p = c.p, sk = c.sk;
    const pic = sk ? Store.user(sk.PIC_Email) || {} : {}, at = pic.Atasan_Email ? Store.user(pic.Atasan_Email) || {} : {};
    const tw = num(ctx.tw || st.TRIWULAN_AKTIF) || 1, d = new Date();
    const v = { INSTITUSI_NAMA: st.NAMA_INSTANSI, INSTITUSI_ALAMAT: st.ALAMAT_INSTANSI, TEMPAT: st.KOTA, TAHUN: S.tahun, TANGGAL: todayISO(), HARI: K.HARI[d.getDay()],
      TRIWULAN: K.ROMAWI[tw], PERIODE: 'Triwulan ' + K.ROMAWI[tw] + ' TA ' + S.tahun, JENIS_LAPORAN: 'TRIWULANAN' };
    if (k) Object.assign(v, { NOMOR_SPK: k.No_SPK, TGL_SPK: k.Tgl_SPK, URAIAN_PEKERJAAN: k.Uraian_Pekerjaan, NAMA_PENYEDIA: k.Penyedia, NAMA_DIREKTUR: k.Direktur, JABATAN_DIREKTUR: k.Jabatan_Direktur, ALAMAT_PENYEDIA: k.Alamat_Penyedia, NPWP: k.NPWP,
      NILAI_KONTRAK: num(k.Nilai_Kontrak), TGL_MULAI: k.Tgl_Mulai, TGL_SELESAI: k.Tgl_Selesai, NAMA_BANK: k.Nama_Bank, NOMOR_REKENING: k.No_Rekening, NAMA_REKENING: k.Nama_Rekening, METODE: k.Metode });
    if (sk) { const s = Calc.sk(sk, tw * 3); const last = Calc.realRows(sk.ID_SubKeg).pop() || {};
      Object.assign(v, { NAMA_PROGRAM: sk.Nama_Program, NAMA_KEGIATAN: sk.Nama_Kegiatan, NAMA_SUBKEGIATAN: sk.Nama_SubKegiatan, KODE_SUBKEG: sk.Kode_SubKeg, SUMBER_DANA: sk.Sumber_Dana, BIDANG: sk.Bidang, PAGU: num(sk.Pagu),
        NAMA_PEJABAT_1: pic.Nama, JABATAN_1: pic.Jabatan, NIP_1: pic.NIP, NAMA_PIMPINAN: at.Nama, JABATAN_PIMPINAN: at.Jabatan, NIP_PIMPINAN: at.NIP,
        PERSEN_SELESAI: fmtN(s.fisik, 1), CAPAIAN_UTAMA: last.Uraian, KENDALA: last.Kendala, RENCANA_TINDAK_LANJUT: last.Rencana_Aksi }); }
    if (p) {
      const items = PK.items(p.ID_Paket), h = PK.hitung(items, p.PPN_Persen, p.Harga_Termasuk_PPN), hps = num(p.Nilai_HPS) || h.total;
      const dasar = String(p.Dasar_Instruksi || S.settings.DASAR_INSTRUKSI || '').split('\n').map((x) => x.trim()).filter(Boolean), met = String(p.Metode || '');
      Object.assign(v, { KODE_RUP: p.Kode_RUP, KODE_REKENING: p.Kode_Rekening, KUALIFIKASI: p.Kualifikasi, IJIN_USAHA: p.Ijin_Usaha, DASAR_INSTRUKSI: dasar.map((x, i) => (i + 1) + '. ' + x).join('\n'), NAMA_PEKERJAAN: p.Nama_Paket, PAGU_DANA: num(p.Pagu_Paket),
        PERIHAL: 'Instruksi Pengadaan ' + (/E-Purchasing/i.test(met) ? 'E-Purchasing' : met || 'Barang/Jasa'),
        CARA_PENGADAAN: /^(Tender|Seleksi)$/i.test(met) ? 'SPSE ' + met : /Swakelola/i.test(met) ? 'Swakelola' : 'SPSE Non-Tender',
        SUMBER_DANA_DOKUMEN: (sk && (num(sk.Pagu_Sebelum) || /perubahan/i.test(sk.Tahap_Anggaran || '')) ? 'DPPA ' : 'DPA ') + (sk ? sk.Tahun : S.tahun),
        KETERANGAN_PPN: p.Harga_Termasuk_PPN === 'YA' ? '*Harga Sudah Termasuk PPN ' + fmtN(p.PPN_Persen) + '%' : '*Harga belum termasuk PPN; PPN ' + fmtN(p.PPN_Persen) + '% dihitung terpisah',
        SPESIFIKASI_FUNGSI: p.Spesifikasi_Fungsi, JADWAL_KEDATANGAN: p.Jadwal_Kedatangan, LOKASI_KEDATANGAN: p.Lokasi_Kedatangan || p.Lokasi, METODE_PENGIRIMAN: p.Metode_Pengiriman,
        JUMLAH_HARGA: Math.round(items.reduce((a, i) => a + num(i.Volume) * num(i.Harga_Satuan), 0) * 100) / 100,
        PELAYANAN_PENYEDIA: p.Pelayanan_Penyedia || '-', PELATIHAN_TEKNIS: p.Pelatihan_Teknis || '-', PEMELIHARAAN: p.Pemeliharaan || '-', INFORMASI_LAINNYA: p.Informasi_Lainnya || '-' });
      const ppk = Store.user(p.Email_PPK) || {}, pp = Store.user(p.Email_Pejabat_Pengadaan) || {};
      Object.assign(v, { NAMA_PAKET: p.Nama_Paket, JENIS_PENGADAAN: PK.JENIS[p.Jenis_Pengadaan] || p.Jenis_Pengadaan, METODE: p.Metode || v.METODE, PAGU_PAKET: num(p.Pagu_Paket),
        NILAI_HPS: hps, JUMLAH_SEBELUM_PPN: h.sub, NILAI_PPN: Math.max(0, hps - h.sub), PPN_PERSEN: num(p.PPN_Persen), JUMLAH_ITEM: items.length, LOKASI: p.Lokasi, JANGKA_WAKTU: p.Jangka_Waktu,
        NOMOR_INSTRUKSI: p.Nomor_Instruksi, TGL_INSTRUKSI: p.Tgl_Instruksi, ISI_INSTRUKSI: p.Isi_Instruksi,
        NAMA_PPK: ppk.Nama, NIP_PPK: ppk.NIP, JABATAN_PPK: ppk.Jabatan, NAMA_PEJABAT_PENGADAAN: pp.Nama, NIP_PEJABAT_PENGADAAN: pp.NIP, JABATAN_PEJABAT_PENGADAAN: pp.Jabatan,
        SUBTOTAL: h.sub, TOTAL_JUMLAH: h.sub, TOTAL_HPS: hps });
    } else Object.assign(v, this.totalReal(ctx));
    if (ctx.email) { const u = Store.user(ctx.email) || {}, a2 = Store.user(u.Atasan_Email) || {}; const ev = S.t.evaluasi.find((x) => norm(x.Email_Pejabat) === norm(ctx.email) && x.Triwulan === tw) || {};
      Object.assign(v, { NAMA_PEJABAT_1: u.Nama, JABATAN_1: u.Jabatan, NIP_1: u.NIP, BIDANG: u.Bidang, NAMA_PIMPINAN: a2.Nama, JABATAN_PIMPINAN: a2.Jabatan, NIP_PIMPINAN: a2.NIP, ARAHAN_PIMPINAN: ev.Arahan }); }
    return v;
  },
  /** Kunci blok yang diisi dari item HPS paket (selain itu: baris realisasi) */
  blokItem(kunci) { return /ITEM|HPS|BARANG|SPEK|RINCIAN/.test(String(kunci || '').toUpperCase()); },
  lingkup(ctx) { return ctx.email ? skLingkup(ctx.email) : ctx.ID_SubKeg ? [Store.get('subkeg', ctx.ID_SubKeg)].filter(Boolean) : Calc.subkeg({ bidang: ctx.bidang }); },
  /** Total tabel realisasi untuk {{TOTAL_PAGU}}, {{TOTAL_KEUANGAN}}, {{TOTAL_FISIK}} (fisik tertimbang pagu) */
  totalReal(ctx) {
    const tw = num(ctx.tw || S.settings.TRIWULAN_AKTIF) || 1; let pg = 0, ku = 0, fw = 0;
    this.lingkup(ctx).forEach((s) => { const x = Calc.sk(s, tw * 3); pg += num(x.pagu); ku += num(x.keu); fw += num(x.fisik) * num(x.pagu); });
    return { TOTAL_PAGU: pg, TOTAL_KEUANGAN: ku, TOTAL_FISIK: fmtN(pg ? fw / pg : 0, 1) };
  },
  blokRows(ctx, kunci) {
    if (this.blokItem(kunci)) {
      const p = this.konteks(ctx).p; if (!p) return [];
      return PK.items(p.ID_Paket).map((x, i) => ({ NO: i + 1, URAIAN: x.Uraian, SPESIFIKASI: x.Spesifikasi, VOLUME: num(x.Volume), SATUAN: x.Satuan, HARGA_SATUAN: num(x.Harga_Satuan), JUMLAH: Math.round(num(x.Volume) * num(x.Harga_Satuan)), SUMBER_HARGA: x.Sumber_Harga, KETERANGAN: x.Keterangan }));
    }
    const tw = num(ctx.tw || S.settings.TRIWULAN_AKTIF) || 1;
    return this.lingkup(ctx).sort(byKey('Kode_SubKeg')).map((s, i) => { const x = Calc.sk(s, tw * 3); return { NO: i + 1, KEGIATAN: s.Nama_SubKegiatan, KODE: s.Kode_SubKeg, INDIKATOR: s.Indikator, TARGET: s.Target, SATUAN: s.Satuan, PAGU: x.pagu, FISIK: fmtN(x.fisik, 1), KEUANGAN: x.keu, DEVIASI: fmtN(x.dev, 1) }; });
  },
  open(ctx) {
    ctx = Object.assign({}, ctx);
    const tps = this.tplFor(ctx);
    if (!tps.length) { toast('Belum ada template ' + (ctx.jenis ? (this.JENIS[ctx.jenis] || ctx.jenis) : 'dokumen') + '. Admin dapat mengunggahnya (Word/Excel/PDF) di Pengaturan → Template Dokumen.', 'warn'); return; }
    const paketMode = !!ctx.ID_Paket;
    const kontrakOpts = [['', '— tidak terkait kontrak —']].concat(S.t.kontrak.map((k) => [k.ID_Kontrak, k.No_SPK + ' — ' + k.Penyedia]));
    const paketOpts = S.t.pengadaan.filter((p) => p.Status !== 'BATAL' || p.ID_Paket === ctx.ID_Paket).sort(byKey('Nama_Paket')).map((p) => [p.ID_Paket, p.Nama_Paket]);
    const pejOpts = [['', '— pilih —']].concat(S.t.pengguna.filter((u) => skLingkup(u.Email).length).map((u) => [u.Email, u.Nama]));
    const m = modal({ title: 'Buat Draf Dokumen', icon: 'docadd', size: 'lg', body: '<div id="genBody"></div>', foot: `<span class="mini" id="genOut" style="margin-right:auto"></span><button class="btn" data-x>Batal</button><button class="btn pri" data-go>${ic('docadd', 'sm')}Buat Dokumen</button>` });
    const area = (kk) => /CATATAN|URAIAN|ARAHAN|KENDALA|CAPAIAN|ALAMAT|RENCANA|DAFTAR|ISI|SPESIFIKASI|INSTRUKSI$|KETERANGAN|DASAR|INFORMASI/.test(kk);
    const draw = (tpl) => {
      const sk = this.skema(tpl), pre = this.prefill(Object.assign({}, ctx, { jenis: tpl.Jenis }));
      if (tpl.Jenis === 'SPK' && pre.NOMOR_SPK) pre.NOMOR = pre.NOMOR_SPK;
      if (tpl.Jenis === 'INSTRUKSI' && pre.NOMOR_INSTRUKSI) pre.NOMOR = pre.NOMOR_INSTRUKSI;
      const nonBlok = sk.filter((x) => !x.blok), blok = sk.filter((x) => x.blok);
      const c2 = paketMode ? `<div class="f s4"><label>Paket pengadaan (isi otomatis)</label>${selectHtml('ctxPk', paketOpts, ctx.ID_Paket)}</div>` : `<div class="f s4"><label>Kontrak (isi otomatis)</label>${selectHtml('ctxK', kontrakOpts, ctx.ID_Kontrak || '')}</div>`;
      const c3 = tpl.Jenis === 'LAPORAN' ? `<div class="f s4"><label>Pejabat pelapor</label>${selectHtml('ctxP', pejOpts, ctx.email || '')}</div>` : paketMode ? `<div class="f s4"><label>Nilai HPS paket</label><div class="in" style="display:flex;align-items:center;background:var(--nest)">${rp(pre.NILAI_HPS || 0)} <span class="mini" style="margin-left:6px">${pre.JUMLAH_ITEM || 0} item</span></div></div>` : `<div class="f s4"><label>Triwulan</label>${selectHtml('ctxTw', [1, 2, 3, 4].map((x) => [x, 'TW ' + K.ROMAWI[x]]), ctx.tw || S.settings.TRIWULAN_AKTIF || 1)}</div>`;
      $('#genOut', m.el).textContent = this.isSheets(tpl) ? 'Hasil: Google Sheets → Excel (.xlsx) + PDF di Drive dinas' : 'Hasil: Google Docs → Word (.docx) + PDF di Drive dinas';
      $('#genBody', m.el).innerHTML = `<div class="fg mb"><div class="f s4"><label>Template</label>${selectHtml('tpl', tps.map((x) => [x.ID_Template, x.Nama + ' (' + (this.isSheets(x) ? 'Excel' : 'Word') + ')']), tpl.ID_Template)}</div>${c2}${c3}</div>
        <div class="note info mb">${ic('info', 'sm')}<div>Isian di bawah sudah diisi otomatis dari data aplikasi bila tersedia. Periksa kembali sebelum membuat dokumen.</div></div>
        <form class="fg" id="genF">${fld({ name: '__NOMOR', label: 'Nomor dokumen', value: pre.NOMOR || '', span: 's6', hint: 'Dipakai untuk {{NOMOR}}' })}
        ${nonBlok.filter((x) => x.kunci !== 'NOMOR').map((x) => { const val = pre[x.kunci] != null ? pre[x.kunci] : ''; const tipe = x.tipe === 'tanggal' || /^(TGL|TANGGAL)/.test(x.kunci) ? 'date' : x.tipe === 'area' || x.tipe === 'naskah' || area(x.kunci) ? 'textarea' : x.tipe === 'angka' ? 'num' : 'text';
          return fld({ name: x.kunci, label: x.label || x.kunci, value: val, type: tipe, rows: /ISI_INSTRUKSI|DASAR/.test(x.kunci) ? 7 : 2, span: tipe === 'textarea' ? '' : 's6', hint: '{{' + x.kunci + '}}' + (x.pengubah ? ' · ' + x.pengubah : '') }); }).join('')}</form>
        ${blok.map((bk) => { const cols = (bk.kolom || []).map((c) => ({ kunci: String(c.kunci).split('.').pop(), label: c.label || c.kunci })); const rows = this.blokRows(ctx, bk.kunci); const isItem = this.blokItem(bk.kunci);
          return `<div class="lbl mt mb-s">Tabel berulang {{#${esc(bk.kunci)}}} — ${rows.length} baris dari ${isItem ? 'item HPS paket' : 'data realisasi'}${isItem && !rows.length ? ' <span class="c-warn">(pilih paket yang sudah memiliki item)</span>' : ''}</div><div class="tw"><table class="t light" data-blok="${esc(bk.kunci)}"><thead><tr>${cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => { const val = r[c.kunci] != null ? r[c.kunci] : ''; return area(c.kunci) ? `<td><textarea class="in" rows="2" data-k="${esc(c.kunci)}" style="min-width:200px">${esc(val)}</textarea></td>` : `<td><input class="in" data-k="${esc(c.kunci)}" value="${esc(val)}"></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`; }).join('')}`;
    };
    let cur = tps.find((x) => x.ID_Template === ctx.ID_Template) || tps[0]; draw(cur);
    m.el.addEventListener('change', (e) => { const n = e.target.name; if (n === 'tpl') { cur = Store.get('template', e.target.value); draw(cur); } if (n === 'ctxK') { ctx.ID_Kontrak = e.target.value; draw(cur); } if (n === 'ctxPk') { ctx.ID_Paket = e.target.value; draw(cur); } if (n === 'ctxP') { ctx.email = e.target.value; draw(cur); } if (n === 'ctxTw') { ctx.tw = num(e.target.value); draw(cur); } });
    m.el.querySelector('[data-go]').onclick = (e) => {
      const isian = formVals($('#genF', m.el)); const Nomor = isian.__NOMOR; delete isian.__NOMOR; isian.NOMOR = Nomor;
      Object.keys(isian).forEach((k2) => { const sk = this.skema(cur).find((x) => x.kunci === k2); if (sk && sk.tipe === 'angka') isian[k2] = num(isian[k2]); });
      const blok = {}; $$('[data-blok]', m.el).forEach((tb) => { blok[tb.dataset.blok] = $$('tbody tr', tb).map((tr) => { const o = {}; $$('[data-k]', tr).forEach((i) => { o[i.dataset.k] = i.value; }); return o; }); });
      const c = this.konteks(ctx);
      mutate('dokumen.generate', { ID_Template: cur.ID_Template, ID_Kontrak: (c.k && ctx.ID_Kontrak) || '', ID_Paket: ctx.ID_Paket || '', ID_SubKeg: (c.sk && c.sk.ID_SubKeg) || ctx.ID_SubKeg || '', Tahun: S.tahun, Nomor, isian, blok }, { table: 'dokumen', btn: e.target, okMsg: 'Dokumen dibuat.',
        onOk: (d) => { m.close(); const row = d.row || {}; const xl = this.isSheets(row) || this.isSheets(cur); const mm = modal({ title: 'Dokumen siap', icon: 'check', size: 'sm', body: `<p style="margin:0">Draf <b>${esc(cur.Nama)}</b> sudah dibuat. Cetak, tandatangani basah, lalu unggah scan-nya ke Arsip Dokumen${ctx.ID_Paket ? ' (tab Arsip paket)' : ''}.</p>`, foot: `<button class="btn" data-x>Tutup</button>${xl ? `<button class="btn" data-f="xlsx">${ic('excel', 'sm')}Unduh XLSX</button>` : row.File_Docs ? `<button class="btn" data-f="docx">${ic('doc', 'sm')}Unduh DOCX</button>` : ''}${row.File_Pdf ? `<button class="btn pri" data-f="pdf">${ic('pdf', 'sm')}Buka PDF</button>` : ''}` }); mm.el.addEventListener('click', (ev) => { const f = ev.target.closest('[data-f]'); if (f) Gen.unduh(row.ID, f.dataset.f); }); } });
    };
  }
};

/* =====================================================================
   9. MANAJEMEN USER
   ===================================================================== */
Pages.add({
  id: 'pengguna', title: 'Manajemen User', icon: 'users', nav: true, group: 'Administrasi Sistem', roles: ['ADMIN'],
  render(el, q, st) {
    st.cari = st.cari || ''; st.role = st.role || ''; st.bidang = st.bidang || ''; st.akt = st.akt || ''; st.view = st.view || 'tabel';
    const all = S.t.pengguna, aktif = all.filter((u) => u.Aktif !== 'TIDAK');
    const penilai = aktif.filter((u) => all.some((x) => norm(x.Atasan_Email) === norm(u.Email)));
    el.innerHTML = ph({ eyebrow: 'Tata Kelola Kepegawaian & Kewenangan', title: 'Manajemen User & Matriks Hak Akses (RBAC)', desc: 'Pengelolaan pengguna, pembagian peran, dan hierarki penilaian evaluasi kinerja berjenjang.', acts: `<button class="btn" data-act="import">${ic('upload', 'sm')}Import</button><button class="btn pri" data-act="add">${ic('add', 'sm')}Tambah Pengguna</button>` }) +
      `<div class="grid g4 mb">${kpi({ l: 'Total pengguna', i: 'group', v: aktif.length + ' <small>aktif</small>', s: (all.length - aktif.length) + ' nonaktif' })}${kpi({ l: 'Pejabat penilai', i: 'medal', gold: true, v: penilai.length, s: 'memiliki bawahan langsung' })}${kpi({ l: 'Pejabat pelapor', i: 'person', v: aktif.filter((u) => u.Role === 'PEJABAT').length, s: 'Kasi, Kabid, Sekretaris, Kadis' })}${kpi({ l: 'Staf & Program', i: 'users', v: aktif.filter((u) => u.Role === 'STAF' || u.Role === 'PROGRAM').length, s: 'operator & monev' })}</div>
      <div class="card mb"><div class="filters"><div class="search">${ic('search')}<input class="in" name="cari" placeholder="Cari nama, NIP, atau email…" value="${esc(st.cari)}"></div>${selectHtml('role', [['', 'Semua Peran']].concat(Object.keys(K.ROLE).map((r) => [r, K.ROLE[r]])), st.role)}${selectHtml('bidang', optBidang(), st.bidang)}${selectHtml('akt', [['', 'Semua Status'], ['YA', 'Aktif'], ['TIDAK', 'Nonaktif']], st.akt)}<div class="row"><button class="btn sm ${st.view === 'tabel' ? 'pri' : ''}" data-v="tabel">${ic('table', 'sm')}Tabel</button><button class="btn sm ${st.view === 'pohon' ? 'pri' : ''}" data-v="pohon">${ic('tree', 'sm')}Struktur</button></div></div></div>
      <div class="card" id="tbl"></div>
      <div class="card mt"><div class="card-b row" style="align-items:flex-start;gap:16px"><div class="kpi-i gold">${ic('shield')}</div><div style="flex:1"><b class="strong">Matriks ketentuan hak akses</b><div class="grid g3 mt">
        <div class="note info">${ic('medal', 'sm')}<div><b>Hierarki penilaian:</b> pejabat hanya dapat menilai bawahan langsungnya (kolom Atasan Langsung).</div></div><div class="note info">${ic('lock', 'sm')}<div><b>Integritas realisasi:</b> staf mengajukan; hanya PIC sub kegiatan yang memverifikasi.</div></div><div class="note info">${ic('key', 'sm')}<div>${Auth.cfg && Auth.cfg.loginSandi ? '<b>Kata sandi:</b> disimpan sebagai hash; admin hanya dapat me-reset, tidak dapat melihat.' : '<b>Login Google:</b> pegawai masuk dengan akun Google yang emailnya sama persis dengan kolom Email. Tidak ada kata sandi yang disimpan aplikasi.'}</div></div></div></div></div></div>`;
    const roleChip = (r) => chip(K.ROLE[r] || r, r === 'ADMIN' ? 'navy' : r === 'PEJABAT' ? 'info' : r === 'PROGRAM' ? 'gold' : 'slate');
    const pw = !!(Auth.cfg && Auth.cfg.loginSandi);
    const draw = () => {
      const c = norm(st.cari);
      const rows = all.filter((u) => (!st.role || u.Role === st.role) && (!st.bidang || sameBidang(u.Bidang, st.bidang)) && (!st.akt || (u.Aktif || 'YA') === st.akt) && (!c || norm([u.Nama, u.NIP, u.Email, u.Jabatan].join(' ')).indexOf(c) > -1)).sort(byKey('Nama'));
      if (st.view === 'pohon') {
        const roots = all.filter((u) => !u.Atasan_Email || !Store.user(u.Atasan_Email));
        const node = (u, d) => `<div style="padding:8px 0 8px ${d * 26}px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center">${d ? ic('subdir', 'sm c-mut') : ''}<div class="av ${u.Role === 'PEJABAT' ? 'gold' : 'soft'}" style="width:28px;height:28px;font-size:11px">${initials(u.Nama)}</div><div><b>${esc(u.Nama)}</b> <span class="mini">${esc(u.Jabatan || '')}</span> ${roleChip(u.Role)}</div></div>` + all.filter((x) => norm(x.Atasan_Email) === norm(u.Email)).sort(byKey('Nama')).map((x) => node(x, d + 1)).join('');
        $('#tbl').innerHTML = `<div class="card-h"><h3>${ic('tree', 'sm')}Struktur penilaian berjenjang</h3></div><div class="card-b">${roots.map((u) => node(u, 0)).join('') || emptyBox('Belum ada pengguna', '')}</div>`; return;
      }
      $('#tbl').innerHTML = rows.length ? `<div class="card-h"><h3>${ic('tree', 'sm')}Daftar pengguna & matriks penilaian</h3></div><div class="tw"><table class="t"><thead><tr><th>Pegawai & NIP</th><th>Email</th><th>Peran</th><th>Jabatan / Bidang</th><th>Atasan langsung (penilai)</th><th class="c">Status</th><th></th></tr></thead><tbody>${rows.map((u) => `<tr class="${u.Aktif === 'TIDAK' ? 'c-mut' : ''}"><td><div class="row" style="flex-wrap:nowrap"><div class="av ${u.Role === 'PEJABAT' ? 'gold' : 'soft'}">${initials(u.Nama)}</div><div><b>${esc(u.Nama)}</b><span class="sub mono">${esc(u.NIP || '-')}</span></div></div></td><td class="mono">${esc(u.Email)}</td><td>${roleChip(u.Role)}${pw && u.Wajib_Ganti_Sandi === 'YA' ? '<span class="sub c-warn">belum ganti sandi</span>' : ''}</td><td>${esc(u.Jabatan || '-')}<span class="sub">${esc(u.Bidang || 'Semua bidang')}</span></td><td>${u.Atasan_Email ? esc(Store.nama(u.Atasan_Email)) + `<span class="sub">${esc((Store.user(u.Atasan_Email) || {}).Jabatan || '')}</span>` : '<span class="mini">—</span>'}</td><td class="c">${u.Aktif === 'TIDAK' ? chip('Nonaktif', 'slate') : chip('Aktif', 'ok')}</td><td class="acts"><button class="btn ghost icon" data-edit="${esc(u.Email)}" title="Ubah">${ic('edit', 'sm')}</button>${pw ? `<button class="btn ghost icon" data-reset="${esc(u.Email)}" title="Reset kata sandi">${ic('key', 'sm')}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : emptyBox('Tidak ada pengguna yang cocok', '');
    };
    draw();
    el.oninput = debounce((e) => { if (e.target.name === 'cari') { st.cari = e.target.value; draw(); } }, 120);
    el.onchange = (e) => { if (['role', 'bidang', 'akt'].indexOf(e.target.name) > -1) { st[e.target.name] = e.target.value; draw(); } };
    el.onclick = async (e) => {
      const t = e.target.closest('[data-act],[data-edit],[data-reset],[data-v]'); if (!t) return;
      if (t.dataset.v) { st.view = t.dataset.v; App.refresh(); }
      if (t.dataset.act === 'add') Pages.formUser();
      if (t.dataset.act === 'import') Pages.importData('pengguna');
      if (t.dataset.edit) Pages.formUser(Store.user(t.dataset.edit));
      if (t.dataset.reset) {
        const u = Store.user(t.dataset.reset);
        if (!(await confirmBox(`Reset kata sandi <b>${esc(u.Nama)}</b>? Kata sandi baru akan ditampilkan sekali, dan semua sesi pengguna ini akan keluar.`, { ok: 'Reset' }))) return;
        const r = await api('user.resetSandi', { Email: u.Email });
        if (r.success) Pages.tampilSandi(u, r.data.sandiAwal); else toast(r.message, 'err');
      }
    };
  }
});
Pages.tampilSandi = function (u, sandi) {
  const m = modal({ title: 'Kata sandi awal', icon: 'key', size: 'sm', body: `<p style="margin:0 0 12px">Berikan kata sandi berikut kepada <b>${esc(u.Nama)}</b> (${esc(u.Email)}) melalui jalur aman. Kata sandi ini <b>hanya ditampilkan sekali</b> dan wajib diganti saat login pertama.</p><div class="row" style="flex-wrap:nowrap"><input class="in mono" value="${esc(sandi)}" readonly id="pwShow" style="font-size:16px;letter-spacing:.05em"><button class="btn" data-copy>${ic('doc', 'sm')}Salin</button></div>`, foot: '<button class="btn pri" data-x>Sudah dicatat</button>' });
  m.el.querySelector('[data-copy]').onclick = () => { const i = $('#pwShow', m.el); i.select(); (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(() => toast('Disalin.', 'ok'), () => { document.execCommand('copy'); toast('Disalin.', 'ok'); }); };
};
Pages.formUser = function (u, prefill) {
  const baru = !u; u = Object.assign({ Role: 'STAF', Aktif: 'YA' }, u || {}, prefill || {});
  const atasanOpts = [['', '— tidak ada (pimpinan tertinggi) —']].concat(S.t.pengguna.filter((x) => norm(x.Email) !== norm(u.Email) && x.Aktif !== 'TIDAK' && (x.Role === 'PEJABAT' || x.Role === 'ADMIN')).sort(byKey('Nama')).map((x) => [x.Email, x.Nama + (x.Jabatan ? ' — ' + x.Jabatan : '')]));
  const m = modal({ title: baru ? 'Tambah Pengguna' : 'Ubah Pengguna', icon: 'users', body: `<form class="fg">${fld({ name: 'Email', label: 'Email akun Google', value: u.Email, type: 'email', span: 's6', req: true, ro: !baru, hint: 'Harus sama dengan email yang dipakai untuk login Google' })}${fld({ name: 'Nama', label: 'Nama lengkap & gelar', value: u.Nama, span: 's6', req: true })}
    ${fld({ name: 'NIP', label: 'NIP', value: u.NIP, span: 's6', max: 18, ph: '18 digit' })}${fld({ name: 'Jabatan', label: 'Jabatan', value: u.Jabatan, span: 's6', ph: 'Kepala Seksi …' })}
    ${fld({ name: 'Role', label: 'Peran sistem', type: 'select', value: u.Role, span: 's6', opts: Object.keys(K.ROLE).map((r) => [r, K.ROLE[r]]) })}${fld({ name: 'Bidang', label: 'Bidang (pembatas hak tulis)', type: 'select', value: u.Bidang, span: 's6', opts: [['', 'Semua bidang']].concat(Store.bidangList().map((b) => [b, b])) })}
    ${fld({ name: 'Atasan_Email', label: 'Atasan langsung (pejabat penilai)', type: 'select', value: u.Atasan_Email, span: 's8', opts: atasanOpts })}${fld({ name: 'Aktif', label: 'Status akun', type: 'select', value: u.Aktif, span: 's4', opts: [['YA', 'Aktif'], ['TIDAK', 'Nonaktif']] })}</form>
    <div class="note info mt">${ic('info', 'sm')}<div><b>Pejabat</b> menilai bawahan langsung & memverifikasi realisasi sub kegiatan yang PIC-nya dia. <b>Staf</b> menginput realisasi & arsip. <b>Bagian Program</b> mengelola DPA & memantau seluruh bidang.</div></div>`,
    foot: `<button class="btn" data-x>Batal</button><button class="btn pri" data-save>${ic('save', 'sm')}Simpan</button>` });
  m.el.querySelector('[data-save]').onclick = async (e) => {
    const v = validate(m.el, { Email: (x) => (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x) ? 'Email tidak valid.' : baru && Store.user(x) ? 'Email sudah terdaftar.' : ''), Nama: req('Nama'), NIP: (x) => (x && !/^\d{18}$/.test(x.replace(/\s/g, '')) ? 'NIP harus 18 digit angka.' : '') });
    if (!v) return; v.Email = v.Email.toLowerCase(); v.NIP = (v.NIP || '').replace(/\s/g, '');
    if (v.Atasan_Email && turunanDari(v.Email).map(norm).indexOf(norm(v.Atasan_Email)) > -1) { toast('Atasan tidak boleh bawahan dari pengguna ini (siklus hierarki).', 'warn'); return; }
    m.close();
    mutate('user.simpan', v, { table: 'pengguna', temp: v, okMsg: baru ? 'Pengguna ditambahkan.' : 'Pengguna diperbarui.', retry: () => Pages.formUser(baru ? null : u, v), onOk: (d) => { if (d.sandiAwal) Pages.tampilSandi(v, d.sandiAwal); } });
  };
};

/* =====================================================================
   10. PENGATURAN (Admin)
   ===================================================================== */
Pages.add({
  id: 'pengaturan', title: 'Pengaturan', icon: 'settings', nav: true, group: 'Administrasi Sistem', roles: ['ADMIN'],
  render(el, q, st) {
    st.tab = q.tab || st.tab || 'umum';
    el.innerHTML = ph({ eyebrow: 'Administrasi Sistem', title: 'Pengaturan Aplikasi', desc: 'Identitas instansi, periode aktif, template dokumen, impor data, login Google, dan status kinerja server.' }) +
      `<div class="card"><div class="tabs">${[['umum', 'settings', 'Umum'], ['template', 'docadd', 'Template Dokumen'], ['import', 'upload', 'Import Data'], ['keamanan', 'shield', 'Keamanan & Login'], ['sistem', 'speed', 'Status Sistem']].map((t) => `<button data-tab="${t[0]}" class="${st.tab === t[0] ? 'on' : ''}">${ic(t[1], 'sm')}${t[2]}</button>`).join('')}</div><div class="card-b" id="pgBody"></div></div>`;
    const b = $('#pgBody'); this[st.tab](b, st);
    el.onclick = (e) => { const t = e.target.closest('[data-tab]'); if (t) { st.tab = t.dataset.tab; history.replaceState(null, '', '#/pengaturan'); App.refresh(); } };
  },
  umum(b) {
    const s = S.settings;
    b.innerHTML = `<form class="fg" id="fSet" style="max-width:860px">${fld({ name: 'NAMA_INSTANSI', label: 'Nama instansi', value: s.NAMA_INSTANSI, span: 's6' })}${fld({ name: 'KOTA', label: 'Kota (tempat tanda tangan)', value: s.KOTA, span: 's6' })}
      ${fld({ name: 'ALAMAT_INSTANSI', label: 'Alamat instansi (kop surat)', value: s.ALAMAT_INSTANSI, type: 'textarea', rows: 2 })}
      ${fld({ name: 'TAHUN_AKTIF', label: 'Tahun anggaran aktif', value: s.TAHUN_AKTIF, span: 's3', type: 'num' })}${fld({ name: 'TRIWULAN_AKTIF', label: 'Triwulan aktif', value: s.TRIWULAN_AKTIF, span: 's3', type: 'select', opts: [1, 2, 3, 4].map((t) => [t, 'Triwulan ' + K.ROMAWI[t]]) })}${fld({ name: 'AMBANG_DEVIASI', label: 'Ambang deviasi (%)', value: s.AMBANG_DEVIASI, span: 's3', type: 'num' })}${fld({ name: 'HARI_TUTUP_LAPORAN', label: 'Tanggal tutup laporan', value: s.HARI_TUTUP_LAPORAN, span: 's3', type: 'num' })}
      ${fld({ name: 'DAFTAR_BIDANG', label: 'Daftar bidang (pisahkan dengan ;)', value: s.DAFTAR_BIDANG, span: 's8' })}${fld({ name: 'MAKS_UNGGAH_MB', label: 'Maks. unggah (MB)', value: s.MAKS_UNGGAH_MB, span: 's4', type: 'num', hint: 'Disarankan ≤ 10 MB' })}
      ${fld({ name: 'NOTIF_EMAIL', label: 'Pengingat email harian', value: s.NOTIF_EMAIL, span: 's6', type: 'select', opts: [['TIDAK', 'Nonaktif'], ['YA', 'Aktif (jam 07.00 WITA)']] })}${fld({ name: 'NAMA_APLIKASI', label: 'Nama aplikasi', value: s.NAMA_APLIKASI, span: 's6' })}
      ${fld({ name: 'DASAR_INSTRUKSI', label: 'Dasar bawaan Instruksi PPK (satu dasar per baris)', value: s.DASAR_INSTRUKSI, type: 'textarea', rows: 5, hint: 'Dipakai saat paket pengadaan baru dibuat; dapat diubah per paket. Periksa kembali peraturan yang berlaku.' })}</form>
      <div class="row mt"><button class="btn pri" data-save>${ic('save', 'sm')}Simpan Pengaturan</button></div>`;
    b.onclick = (e) => { const t = e.target.closest('[data-save]'); if (!t) return; const v = formVals($('#fSet')); if (v.MAKS_UNGGAH_MB > 25) { toast('Batas unggah maksimal 25 MB (keterbatasan Apps Script).', 'warn'); return; }
      const old = Object.assign({}, S.settings); mutate('pengaturan.simpan', v, { btn: t, optimistic: () => { Object.assign(S.settings, v); Store.bump(); Store.saveSoon(); return () => { S.settings = old; }; }, onOk: (d) => { if (d.settings) { S.settings = d.settings; App.chrome(); } }, okMsg: 'Pengaturan disimpan.' }); };
  },
  template(b) {
    const tps = S.t.template, JN = Gen.JENIS;
    b.innerHTML = `<div class="note warn mb">${ic('warn', 'sm')}<div>Template berisi placeholder seperti <code>{{NOMOR}}</code>, <code>{{NILAI_HPS|rupiah}}</code>, atau baris tabel berulang <code>{{#ITEM}}</code> … <code>{{ITEM.URAIAN}}</code>. Format yang diterima: <b>Word (.docx)</b> → Google Docs, <b>Excel (.xlsx)</b> → Google Sheets (hasil cetak Excel + PDF), dan <b>PDF</b> → Google Docs lewat OCR (tata letak bisa bergeser — periksa hasilnya). Bisa juga menempel tautan Google Docs/Sheets.</div></div>
      ${tps.length ? `<div class="tw mb"><table class="t light"><thead><tr><th>Nama</th><th>Jenis</th><th>Format</th><th>Isian</th><th>Versi</th><th>Diperbarui</th><th></th></tr></thead><tbody>${tps.map((t) => `<tr><td><b>${esc(t.Nama)}</b></td><td>${chip(JN[t.Jenis] || t.Jenis, Gen.PAKET.indexOf(t.Jenis) > -1 ? 'gold' : 'slate')}</td><td>${Gen.isSheets(t) ? ic('excel', 'sm') + ' Excel' : ic('doc', 'sm') + ' Word'}</td><td class="mini" style="max-width:360px">${Gen.skema(t).map((x) => esc(x.kunci)).join(', ')}</td><td>v${esc(t.Versi || 1)}</td><td>${tgl(String(t.Diperbarui).slice(0, 10))}</td><td class="acts"><button class="btn sm" data-ganti="${esc(t.ID_Template)}">${ic('upload', 'sm')}Perbarui</button><button class="btn ghost icon" data-hapus="${esc(t.ID_Template)}">${ic('trash', 'sm')}</button></td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="card"><div class="card-h"><h3>${ic('upload', 'sm')}Unggah / perbarui template</h3></div><div class="card-b"><form class="fg" id="fTp">${fld({ name: 'Nama', label: 'Nama template', span: 's6', req: true, ph: 'Template HPS Pengadaan' })}${fld({ name: 'Jenis', label: 'Jenis', type: 'select', span: 's3', opts: Object.keys(JN).map((k) => [k, JN[k]]) })}<input type="hidden" name="ID_Template">${fld({ name: 'url', label: 'Atau tautan Google Docs/Sheets', span: 's3', ph: 'https://docs.google.com/…' })}</form>
        <div class="drop mt" id="dropT">${ic('doc')}<b>Tarik file Word, Excel, atau PDF ke sini, atau klik untuk memilih</b><span class="mini">.docx · .xlsx · .pdf — mis. Template_SPK_Kontrak.docx, Template_HPS.xlsx, Template_Instruksi_PPK.docx</span><div class="prog hidden"><i></i></div></div><input type="file" id="fileT" class="hidden" accept=".docx,.xlsx,.pdf">
        <div class="row mt"><button class="btn pri" data-kirim>${ic('save', 'sm')}Simpan dari tautan</button><span class="mini">Konversi berkas memerlukan layanan lanjutan Drive API aktif di proyek Apps Script.</span></div></div></div>`;
    const f = $('#fTp');
    const kirim = async (payload, btn) => { const v = validate(f, { Nama: req('Nama template') }); if (!v) return; const data = Object.assign({ Nama: v.Nama, Jenis: v.Jenis, ID_Template: v.ID_Template || undefined }, payload); const r = await mutate('template.simpan', data, { table: 'template', btn, okMsg: 'Template disimpan & dipindai.' }); if (r.success) { const sk = Gen.skema(r.data.row || {}); toast(sk.length + ' placeholder ditemukan.', 'info'); (r.data.peringatan || []).forEach((w) => toast(w, 'warn')); } };
    const MIME = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pdf: 'application/pdf' };
    Upload.bind($('#dropT'), $('#fileT'), async (files) => {
      const fl = files[0], ext = (fl.name.match(/\.(docx|xlsx|pdf)$/i) || [])[1]; if (!ext) { toast('Hanya file .docx, .xlsx, atau .pdf.', 'warn'); return; }
      if (fl.size > 10 * 1048576) { toast('Berkas template maksimal 10 MB.', 'warn'); return; }
      if (!f.Nama.value) f.Nama.value = fl.name.replace(/\.(docx|xlsx|pdf)$/i, '').replace(/_/g, ' ');
      if (!f.ID_Template.value) { const n = fl.name; f.Jenis.value = /instruksi/i.test(n) ? 'INSTRUKSI' : /hps|harga.?perkiraan/i.test(n) ? 'HPS' : /spesifikasi|spek/i.test(n) ? 'SPESIFIKASI' : /bast/i.test(n) ? 'BAST' : /lapor/i.test(n) ? 'LAPORAN' : /spk|kontrak/i.test(n) ? 'SPK' : f.Jenis.value; }
      const bar_ = $('#dropT .prog'); bar_.classList.remove('hidden'); bar_.firstChild.style.width = '40%';
      await kirim({ base64File: await fileToB64(fl), namaFile: fl.name, mime: MIME[ext.toLowerCase()] }); bar_.classList.add('hidden');
    });
    b.onclick = async (e) => {
      const t = e.target.closest('[data-kirim],[data-ganti],[data-hapus]'); if (!t) return;
      if (t.dataset.kirim != null) { if (!/docs\.google\.com\/(document|spreadsheets)|drive\.google\.com/.test(f.url.value)) { toast('Tempel tautan Google Docs/Sheets yang valid, atau unggah berkas Word/Excel/PDF.', 'warn'); return; } kirim({ url: f.url.value }, t); }
      if (t.dataset.ganti) { const tp = Store.get('template', t.dataset.ganti); f.ID_Template.value = tp.ID_Template; f.Nama.value = tp.Nama; f.Jenis.value = tp.Jenis; toast('Unggah berkas baru atau tempel tautan untuk memperbarui "' + tp.Nama + '".', 'info'); f.Nama.focus(); }
      if (t.dataset.hapus) { const tp = Store.get('template', t.dataset.hapus); if (!(await confirmBox(`Hapus template <b>${esc(tp.Nama)}</b>? Dokumen yang sudah dibuat tidak terhapus.`, { danger: true, ok: 'Hapus' }))) return; mutate('template.hapus', { ID_Template: tp.ID_Template }, { optimistic: () => { const o = Store.remove('template', tp.ID_Template); return () => Store.upsert('template', o); }, okMsg: 'Template dihapus.' }); }
    };
  },
  import(b) { Pages.importData('subkeg', b); },
  async keamanan(b) {
    const asal = location.origin;
    b.innerHTML = `<div class="grid g2"><div class="card"><div class="card-h"><h3>${ic('shield', 'sm')}Login Google (OAuth 2.0)</h3><p>Pegawai masuk tanpa kata sandi aplikasi, memakai akun Google yang terdaftar di Manajemen User.</p></div><div class="card-b" id="secBox"><div class="sk" style="margin:10px 0"></div><div class="sk" style="margin:10px 0"></div></div></div>
      <div class="card"><div class="card-h"><h3>${ic('info', 'sm')}Cara membuat Client ID</h3></div><div class="card-b"><ol style="margin:0;padding-left:18px;display:grid;gap:6px">
        <li>Buka <b>Google Cloud Console → APIs &amp; Services → Credentials</b> (akun pemilik skrip).</li>
        <li>Siapkan <b>OAuth consent screen</b> (Internal bila memakai Google Workspace dinas; External bila akun Gmail biasa).</li>
        <li><b>Create credentials → OAuth client ID → Web application</b>.</li>
        <li>Di <b>Authorized JavaScript origins</b> isi persis: <code>${esc(asal)}</code> <button class="btn sm" data-copy="${esc(asal)}">${ic('doc', 'sm')}Salin</button></li>
        <li>Salin <b>Client ID</b> (berakhiran <code>.apps.googleusercontent.com</code>) lalu tempel di kolom sebelah dan Simpan.</li></ol>
        <div class="note info mt">${ic('info', 'sm')}<div>Client ID bukan rahasia (memang dipakai browser), tetapi tetap disimpan di Script Properties server agar bisa diganti tanpa mengubah frontend. Token Google diverifikasi di server (aud, iss, email terverifikasi, kedaluwarsa).</div></div></div></div></div>`;
    const box = $('#secBox');
    const draw = (d) => { const c = d.GOOGLE_CLIENT_ID || {};
      box.innerHTML = `<dl class="kv mb"><dt>Status Client ID</dt><dd>${c.ada ? chip('Terpasang', 'ok') + ' <span class="mono mini">' + esc(c.samar) + '</span>' : chip('Belum diisi', 'err')}</dd><dt>Login kata sandi</dt><dd>${d.loginSandi ? chip('Aktif (cadangan)', 'warn') : chip('Nonaktif — Google saja', 'ok')}</dd><dt>Akses darurat</dt><dd>${chip('Tersedia', 'slate')} <span class="mini">tautan #darurat, tidak ditampilkan di menu</span></dd></dl>
        <form class="fg" id="fCid" autocomplete="off"><div class="f"><label>Google OAuth Client ID</label><input class="in mono" type="password" name="nilai" autocomplete="off" placeholder="${c.ada ? esc(c.samar) + ' (kosongkan = tidak diubah)' : 'xxxxxxxx.apps.googleusercontent.com'}"><div class="hint">Disimpan di Script Properties server; tidak pernah dikirim balik utuh.</div></div></form>
        <div class="row mt"><button class="btn pri" data-cid>${ic('save', 'sm')}Simpan Client ID</button>${c.ada ? `<button class="btn ghost" data-cidhapus>${ic('trash', 'sm')}Hapus</button>` : ''}</div>
        <div class="note warn mt">${ic('warn', 'sm')}<div>Login kata sandi hanya dapat dinyalakan/dimatikan dari editor Apps Script: jalankan <code>aktifkanLoginSandi()</code> atau <code>matikanLoginSandi()</code>. Bawaan: nonaktif.</div></div>`; };
    const load = async () => { const r = await api('rahasia.status', {}); if (!$('#secBox')) return; if (!r.success) { box.innerHTML = `<div class="note err">${ic('warn', 'sm')}<div>${esc(r.message)}</div></div>`; return; } draw(r.data || {}); };
    load();
    b.onclick = async (e) => {
      const cp = e.target.closest('[data-copy]'); if (cp) { (navigator.clipboard ? navigator.clipboard.writeText(cp.dataset.copy) : Promise.reject()).then(() => toast('Disalin.', 'ok'), () => toast('Salin manual: ' + cp.dataset.copy, 'info')); return; }
      const sv = e.target.closest('[data-cid],[data-cidhapus]'); if (!sv) return;
      let nilai;
      if (sv.dataset.cidhapus != null) { if (!(await confirmBox('Hapus Client ID? Semua pegawai tidak bisa login Google sampai diisi lagi (akses darurat tetap bisa).', { danger: true, ok: 'Hapus' }))) return; nilai = '__HAPUS__'; }
      else { const inp = $('#fCid [name=nilai]'); nilai = inp.value.trim(); if (!nilai) { toast('Kolom kosong — tidak ada yang diubah.', 'info'); return; } if (!/\.apps\.googleusercontent\.com$/.test(nilai)) { toast('Client ID harus berakhiran .apps.googleusercontent.com', 'warn'); return; } inp.value = ''; }
      sv.classList.add('busy'); const r = await api('rahasia.simpan', { kunci: 'GOOGLE_CLIENT_ID', nilai }); sv.classList.remove('busy');
      if (!r.success) { toast(r.message, 'err'); return; }
      toast('Client ID ' + (nilai === '__HAPUS__' ? 'dihapus.' : 'tersimpan. Uji di jendela penyamaran: tombol "Masuk dengan Google" harus muncul.'), 'ok');
      Auth.config(true); load();
    };
  },
  async sistem(b) {
    b.innerHTML = `<div class="card mb" id="ctBox"><div class="card-b"><div class="sk"></div></div></div><div class="row mb"><button class="btn" data-ref>${ic('refresh', 'sm')}Muat ulang status</button><button class="btn" data-ver>${ic('flag', 'sm')}Riwayat versi</button><button class="btn" data-perf>${ic('speed', 'sm')}Tampilkan Perf.table() di console</button></div><div id="sysBox">${'<div class="sk" style="margin:10px 0"></div>'.repeat(6)}</div>`;
    const muatContoh = async () => {
      const r = await api('contoh.status', {}, { quiet: true }), box = $('#ctBox'); if (!box) return;
      const d = (r && r.data) || {}, j = d.jumlah || {};
      box.innerHTML = `<div class="card-h"><h3>${ic('flag', 'sm')}Data contoh (dummy)</h3><p>Untuk mencoba aplikasi: pengguna @contoh.test, Sub Kegiatan format SIPD-RI beserta rincian belanja, paket pengadaan (Instruksi/HPS/Spesifikasi), kontrak, realisasi bulanan, dan evaluasi — tahun ${esc(d.tahun || S.tahun)}.</p></div>
        <div class="card-b">${d.ada ? `<div class="note warn mb">${ic('warn', 'sm')}<div><b>Data contoh aktif (${fmtN(d.total)} baris):</b> ${esc(Object.keys(j).filter((k) => j[k]).map((k) => k.replace(/_/g, ' ') + ' ' + j[k]).join(' · '))}. Hapus sebelum aplikasi dipakai resmi — semua ID berawalan <code>CTH-</code>.</div></div>` : `<p class="mini" style="margin:0 0 12px">Belum ada data contoh. Kode Sub Kegiatan yang sudah dipakai data Anda dilewati otomatis.</p>`}
        <div class="row">${d.ada ? `<button class="btn danger" data-ct="hapus">${ic('trash', 'sm')}Hapus data contoh</button>` : `<button class="btn gold" data-ct="isi">${ic('add', 'sm')}Isi data contoh</button>`}<span class="mini">Atau dari editor Apps Script: <code>isiDataContoh()</code> / <code>hapusDataContoh()</code></span></div></div>`;
    };
    muatContoh();
    $('#ctBox').addEventListener('click', async (e) => {
      const t = e.target.closest('[data-ct]'); if (!t) return; const isi = t.dataset.ct === 'isi';
      if (!(await confirmBox(isi ? 'Tambahkan data contoh ke database? Data contoh dapat dihapus kapan saja.' : 'Hapus SEMUA data contoh, termasuk data yang Anda tambahkan pada Sub Kegiatan/kontrak/paket contoh? Berkas di Google Drive tidak ikut dihapus.', isi ? { ok: 'Isi data contoh' } : { danger: true, ok: 'Hapus' }))) return;
      t.classList.add('busy'); const r = await api(isi ? 'contoh.isi' : 'contoh.hapus', {}); t.classList.remove('busy');
      if (!r.success) { toast(r.message, 'err'); return; }
      toast(r.message, 'ok'); ((r.data && r.data.peringatan) || []).forEach((w) => toast(w, 'warn'));
      RB.reset(); await Sync.run({ force: true }); muatContoh();
    });
    const load = async () => {
      const r = await api('sistem.status', {}); const box = $('#sysBox'); if (!box) return;
      if (!r.success) { box.innerHTML = `<div class="note err">${ic('warn', 'sm')}<div>${esc(r.message)}</div></div>`; return; }
      const d = r.data || {}; const ent = (o) => Object.keys(o || {}).map((k) => `<dt>${esc(k)}</dt><dd>${esc(typeof o[k] === 'object' ? JSON.stringify(o[k]) : o[k])}</dd>`).join('');
      const avg = Perf.log.length ? Math.round(Perf.log.reduce((a, x) => a + x.total, 0) / Perf.log.length) : 0;
      box.innerHTML = `<div class="grid g3 mb">${kpi({ l: 'Versi server', v: esc(d.versi || r.v || '-'), s: 'Frontend v' + APP_VERSION })}${kpi({ l: 'Respons rata-rata (sesi ini)', v: avg + ' <small>ms</small>', s: Perf.log.length + ' panggilan · server ' + (r.ms || 0) + ' ms' })}${kpi({ l: 'Keep-warm', v: esc(String(d.keepWarm || '-')), s: 'Trigger pemanasan cache' })}</div>
        <div class="grid g2"><div class="card"><div class="card-h"><h3>Jumlah baris per sheet</h3></div><div class="card-b"><dl class="kv">${ent(d.baris)}</dl></div></div><div class="card"><div class="card-h"><h3>Cache & trigger</h3></div><div class="card-b"><dl class="kv">${ent(d.cache)}${ent(d.trigger)}${ent(d.properti)}</dl></div></div></div>
        <div class="note info mt">${ic('info', 'sm')}<div>Data di perangkat ini disinkron otomatis tiap 45 detik saat aktif (3 menit saat diam). Perubahan langsung di Google Sheets akan terlihat setelah cache server berganti versi; gunakan menu ini untuk memeriksa.</div></div>`;
    };
    load();
    b.onclick = (e) => { if (e.target.closest('[data-ref]')) load(); if (e.target.closest('[data-ver]')) Versi.tampil(); if (e.target.closest('[data-perf]')) { Perf.table(); Perf.summary(); toast('Lihat tab Console di DevTools (F12).', 'info'); } };
  }
});
/** Import data — v1.1: semua lewat Impor.dialog (Excel, Word, PDF, CSV, atau tautan Google Sheets) */
Pages.importData = function (target, inline) {
  if (!inline) return Impor.dialog({ target, sheetUrl: true });
  const T = [['subkeg', 'wallet', 'Perencanaan Anggaran (RKA/DPA)', 'Sub kegiatan beserta program, kegiatan, pagu, indikator. PDF DPA dibaca otomatis berdasarkan pola kode rekening (mode DPA).'], ['kontrak', 'kontrak', 'Kontrak / SPK', 'Daftar kontrak; Kode Sub Kegiatan dipakai untuk menautkan ke DPA.'], ['pengguna', 'users', 'Pengguna', 'Email akun Google, nama, NIP, jabatan, peran, bidang, email atasan.']].filter((x) => Can.admin() || x[0] !== 'pengguna');
  inline.innerHTML = `<div class="note info mb">${ic('info', 'sm')}<div>Semua impor menerima <b>Excel (.xlsx/.xls), Word (.docx), PDF, CSV</b>, atau tautan Google Sheets. Berkas dibaca di perangkat ini, Anda mencocokkan kolom, lalu <b>Pindai</b> (tanpa menyimpan) sebelum <b>Jalankan Impor</b>. Impor aman diulang: data dengan kunci yang sama tidak digandakan.</div></div>
    <div class="grid g3">${T.map((x) => `<div class="card"><div class="card-b"><div class="row mb-s" style="flex-wrap:nowrap"><div class="kpi-i">${ic(x[1])}</div><b class="strong">${x[2]}</b></div><p class="mini" style="margin:0 0 12px">${x[3]}</p><button class="btn pri" data-imp="${x[0]}">${ic('upload', 'sm')}Impor ${x[0] === 'subkeg' ? 'DPA' : x[2]}</button></div></div>`).join('')}</div>
    <div class="note warn mt">${ic('warn', 'sm')}<div>Pembacaan PDF memakai teks yang tertanam di PDF. PDF hasil scan (gambar) tidak bisa dibaca — gunakan PDF asli dari aplikasi SIPD/Excel, atau ekspor ke Excel terlebih dahulu. Selalu periksa pratinjau sebelum menjalankan impor.</div></div>`;
  inline.onclick = (e) => { const t = e.target.closest('[data-imp]'); if (t) Impor.dialog({ target: t.dataset.imp, sheetUrl: true }); };
};

/* =====================================================================
   11. PROFIL & AKUN
   ===================================================================== */
Pages.add({
  id: 'profil', title: 'Profil & Keamanan', icon: 'person', nav: true, group: 'Akun', short: 'Akun',
  render(el) {
    const me = S.me, u = Store.user(me.email) || {};
    el.innerHTML = ph({ eyebrow: 'Akun', title: 'Profil & Keamanan', desc: 'Informasi akun, keamanan login, sesi perangkat, dan riwayat versi aplikasi.' }) +
      `<div class="grid g2"><div class="card"><div class="card-h"><h3>${ic('person', 'sm')}Informasi akun</h3></div><div class="card-b"><div class="row mb"><div class="av gold" style="width:52px;height:52px;font-size:18px">${initials(me.nama)}</div><div><b class="strong" style="font-size:17px">${esc(me.nama)}</b><div class="mini">${esc(me.email)}</div></div></div>
        <dl class="kv"><dt>Peran</dt><dd>${esc(K.ROLE[me.role] || me.role)}${me.darurat ? ' ' + chip('Akses darurat', 'err') : ''}</dd><dt>Jabatan</dt><dd>${esc(me.jabatan || u.Jabatan || '-')}</dd><dt>NIP</dt><dd class="mono">${esc(me.nip || u.NIP || '-')}</dd><dt>Bidang</dt><dd>${esc(me.bidang || 'Semua bidang')}</dd><dt>Atasan langsung</dt><dd>${esc(Store.nama(me.atasan) || '-')}</dd><dt>Bawahan langsung</dt><dd>${(me.bawahan || []).map((e) => esc(Store.nama(e))).join(', ') || '-'}</dd></dl></div></div>
      <div class="card"><div class="card-h"><h3>${ic('key', 'sm')}Keamanan</h3></div><div class="card-b">${me.darurat ? `<div class="note warn">${ic('warn', 'sm')}<div>Akun darurat tidak dapat mengganti sandi dari sini. Gunakan fungsi <code>resetAksesDarurat()</code> di editor Apps Script.</div></div>` : Auth.cfg && Auth.cfg.loginSandi ? `<button class="btn pri mb" data-act="pw">${ic('key', 'sm')}Ganti kata sandi</button>` : `<div class="note ok">${ic('shield', 'sm')}<div>Anda masuk dengan <b>akun Google</b> (${esc(me.email)}). Keamanan login (sandi, verifikasi 2 langkah) dikelola di akun Google Anda.</div></div>`}
        <div class="lbl mt mb-s">Sesi</div><div class="row"><button class="btn" data-act="out">${ic('logout', 'sm')}Keluar dari perangkat ini</button><button class="btn danger" data-act="outAll">${ic('logout', 'sm')}Keluar dari semua perangkat</button></div>
        <div class="lbl mt mb-s">Aplikasi</div><p class="mini" style="margin:0">Versi aplikasi ${APP_VERSION} · server ${esc((S.versi && S.versi.backend) || '-')} · data lokal ${S.at ? 'disinkron ' + new Date(S.at).toLocaleString('id-ID') : '-'}. Pasang sebagai aplikasi melalui ikon ${ic('install', 'sm')} di bilah atas (Chrome/Edge) atau "Tambahkan ke Layar Utama" (Safari).</p>
        <div class="row mt"><button class="btn sm" data-act="ver">${ic('flag', 'sm')}Riwayat versi</button><button class="btn sm" data-act="resync">${ic('sync', 'sm')}Sinkron ulang penuh</button></div></div></div></div>`;
    el.onclick = async (e) => {
      const t = e.target.closest('[data-act]'); if (!t) return;
      if (t.dataset.act === 'pw') this.gantiSandi(false);
      if (t.dataset.act === 'out') { if (await confirmBox('Keluar dari aplikasi di perangkat ini?', { ok: 'Keluar' })) Auth.logout(); }
      if (t.dataset.act === 'outAll') { if (!(await confirmBox('Semua sesi akun ini (di semua perangkat) akan diakhiri. Lanjutkan?', { danger: true, ok: 'Keluar semua' }))) return; const r = await api('auth.logoutSemua', {}); if (r.success) Auth.logout('Semua sesi telah diakhiri.'); else toast(r.message, 'err'); }
      if (t.dataset.act === 'ver') Versi.tampil();
      if (t.dataset.act === 'resync') { const r = await Sync.run({ force: true, loud: true }); if (r.success) toast('Data disinkron ulang.', 'ok'); }
    };
  },
  gantiSandi(wajib) {
    if (document.querySelector('[data-wajib-sandi]')) return;
    const m = modal({ title: wajib ? 'Ganti kata sandi awal (wajib)' : 'Ganti kata sandi', icon: 'key', size: 'sm',
      body: `${wajib ? `<div class="note warn mb">${ic('warn', 'sm')}<div>Anda masuk dengan kata sandi awal dari admin. Ganti sekarang sebelum melanjutkan.</div></div>` : ''}<form class="fg">${fld({ name: 'lama', label: 'Kata sandi saat ini', type: 'password', auto: 'current-password', req: true })}${fld({ name: 'baru', label: 'Kata sandi baru', type: 'password', auto: 'new-password', req: true, hint: 'Minimal 8 karakter, kombinasi huruf dan angka.' })}${fld({ name: 'ulang', label: 'Ulangi kata sandi baru', type: 'password', auto: 'new-password', req: true })}</form>`,
      foot: `${wajib ? '' : '<button class="btn" data-x>Batal</button>'}<button class="btn pri" data-go>${ic('save', 'sm')}Simpan</button>` });
    m.el.setAttribute('data-wajib-sandi', wajib ? '1' : '0');
    if (wajib) { m.el.querySelector('.x').remove(); m.el.addEventListener('click', (e) => { if (e.target === m.el) e.stopImmediatePropagation(); }, true); }
    m.el.querySelector('[data-go]').onclick = async (e) => {
      const v = validate(m.el, { lama: req('Kata sandi saat ini'), baru: (x, a) => (x.length < 8 || !/[A-Za-z]/.test(x) || !/\d/.test(x) ? 'Minimal 8 karakter berisi huruf dan angka.' : x === a.lama ? 'Harus berbeda dari kata sandi lama.' : ''), ulang: (x, a) => (x !== a.baru ? 'Tidak sama dengan kata sandi baru.' : '') });
      if (!v) return; e.target.classList.add('busy');
      const r = await api('auth.gantiSandi', { lama: v.lama, baru: v.baru }); e.target.classList.remove('busy');
      if (!r.success) { toast(r.message || 'Gagal.', 'err'); return; }
      if (r.data && r.data.token) Auth.set(r.data.token, Object.assign({}, Auth.me, { wajibGanti: false }));
      S.me.wajibGanti = false; Calc._memo = {}; Store.save(); m.close(); toast('Kata sandi diganti.', 'ok'); App.refresh();
    };
  }
});

/* ---------- Dialog global ---------- */
Pages.pilihTahun = function () {
  const y = new Date().getFullYear(), list = [y + 1, y, y - 1, y - 2, y - 3];
  const m = modal({ title: 'Tahun anggaran', icon: 'calendar', size: 'sm', body: `<p class="mini" style="margin-top:0">Tahun aktif dinas: <b>${esc(S.settings.TAHUN_AKTIF || '-')}</b>. Pilih tahun untuk menampilkan data historis (mis. untuk pemeriksaan).</p>${selectHtml('th', list.map((t) => [t, 'TA ' + t]), S.tahun)}`, foot: '<button class="btn" data-x>Batal</button><button class="btn pri" data-go>Tampilkan</button>' });
  m.el.querySelector('[data-go]').onclick = async (e) => { const t = num(m.el.querySelector('[name=th]').value); if (t === num(S.tahun)) { m.close(); return; } e.target.classList.add('busy'); const prev = S.tahun; S.tahun = t; const r = await Sync.run({ force: true, loud: true }); e.target.classList.remove('busy'); if (r.success) { m.close(); Object.keys(UI).forEach((k) => { delete UI[k]; }); App.refresh(); toast('Menampilkan data TA ' + t + '.', 'ok'); } else { S.tahun = prev; toast(r.message, 'err'); } };
};
Pages.loginDarurat = function () {
  const m = modal({ title: 'Akses darurat', icon: 'shield', size: 'sm', body: `<div class="note warn mb">${ic('warn', 'sm')}<div>Hanya untuk pemulihan bila admin tidak dapat masuk. Setiap percobaan dicatat; 5 kali salah mengunci akses 15 menit.</div></div><form class="fg">${fld({ name: 'u', label: 'Nama pengguna', auto: 'off' })}${fld({ name: 'p', label: 'Kata sandi', type: 'password', auto: 'off' })}</form>`, foot: '<button class="btn" data-x>Batal</button><button class="btn pri" data-go>Masuk</button>' });
  m.el.querySelector('[data-go]').onclick = async (e) => { const v = formVals(m.el); e.target.classList.add('busy'); const r = await Auth.darurat(v.u, v.p); e.target.classList.remove('busy'); if (!r.success) { toast(r.message, 'err'); return; } m.close(); App.enter(); };
};
