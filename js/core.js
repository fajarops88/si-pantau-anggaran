/* =====================================================================
   SI-PANTAU ANGGARAN — core.js
   API ke GAS (fetch text/plain), store lokal (SWR), optimistic UI,
   router hash, kalkulasi realisasi, grafik SVG, ekspor, utilitas UI.
   ===================================================================== */
'use strict';
const APP_VERSION = '1.2.4';
/** Riwayat versi frontend (terbaru di atas) — tampil di menu Profil → Riwayat Versi */
const FE_RIWAYAT = [
  { versi: '1.2.4', tanggal: '2026-11-26', catatan: ['Dokumen disarankan per metode, jenis, dan nilai: tab baru di Paket Pengadaan dan bagian di detail Kontrak, lengkap dengan dasar aturan (PerLKPP 3/2026, PerLKPP 2/2026, Perpres Pasal 28), status draf/scan, dan tombol Buat dokumen.', 'Template bawaan siap pasang (Pengaturan → Template Dokumen): Instruksi PPK, HPS, Spesifikasi, Surat Penunjukan, SPK Barang/Lumsum/Harga Satuan/Waktu Penugasan, Surat Perjanjian, Kuitansi, BA Serah Terima Lokasi, BAST Pekerjaan, BAST Akhir, dokumen e-Katalog, dan Laporan Triwulanan.', 'Jenis template baru: Surat Penunjukan Penyedia, Surat Perjanjian, Kuitansi, BA Serah Terima Lokasi, BAST Akhir.'] },
  { versi: '1.2.3', tanggal: '2026-11-26', catatan: ['Rujukan aturan untuk tugas PPK: dokumen harga otomatis bernama Referensi Harga untuk E-purchasing ≤ Rp100 juta (PerLKPP 2/2026 Ps. 13), saran bentuk kontrak menurut nilai (Perpres 16/2018 s.t.d.t.d. 46/2025 Ps. 28), dan jaminan pelaksanaan E-purchasing (PerLKPP 2/2026 Ps. 20).', 'Pemeriksaan teks dasar hukum: judul resmi & aturan yang belum/tidak berlaku pada tanggal dokumen; tombol teks dasar hukum baku.', 'Surat Pesanan/BAPP/BAST e-Katalog ditandai sebagai draf internal; dokumen sah diterbitkan sistem Katalog Elektronik.', 'Master checklist: isi dasar regulasi terverifikasi (HPS, kontrak, jaminan). Placeholder baru: {{JUDUL_HPS}}, {{SINGKATAN_HPS}}, {{DASAR_HARGA}}, {{BENTUK_KONTRAK}}.'] },
  { versi: '1.2.2', tanggal: '2026-11-26', catatan: ['Jenis template baru: Surat Pesanan dan BAPP (Berita Acara Penyelesaian Pekerjaan), tampil di dokumen Kontrak saja.', 'Isian Surat Pesanan/BAPP/BAST terisi otomatis dari kontrak (nilai sebelum PPN, PPN, termin, nomor BAPP sebelumnya, persen pekerjaan, penerima, lokasi); tabel berulang dapat ditambah/dihapus barisnya.', 'Pengaturan: NPWP instansi. Arsip: jenis BAPP.', 'Placeholder baru: {{NPWP_INSTANSI}}, {{NILAI_SEBELUM_PPN}}, {{NILAI_PPN_KONTRAK}}, {{JUMLAH_TERMIN}}, {{TERMIN_KE}}, {{NOMOR_BAPP}}, {{PERSEN_PEKERJAAN}}, {{NAMA_PENERIMA}}, {{TGL_SELESAI_PEKERJAAN}}, {{TGL_PEMERIKSAAN}}, blok {{#TERMIN}}.'] },
  { versi: '1.2.1', tanggal: '2026-11-26', catatan: ['Paket pengadaan: kolom Kode Rekening; nama paket dipilih dari uraian Rincian DPA (rekening, [#] kelompok, [-] keterangan, atau item) dan kode rekening serta pagu terisi otomatis.', 'Kontrak/SPK: Uraian Pekerjaan dapat dipilih dari uraian Rincian DPA Sub Kegiatan.', 'Placeholder dokumen baru: {{KODE_REKENING}}.'] },
  { versi: '1.2.0', tanggal: '2026-11-26', catatan: ['Perencanaan mengikuti format SIPD-RI: impor PDF "Cetak RKA/DPA Rincian Belanja" per Sub Kegiatan (bisa banyak berkas sekaligus), termasuk dokumen perubahan (sebelum/sesudah).', 'Halaman Rincian Anggaran Belanja per Sub Kegiatan: identitas, indikator, rincian rekening/item, export Excel.', 'Pengadaan mengikuti format Instruksi, HPS, dan Spesifikasi Teknis Dishub: Kode RUP, kualifikasi, ijin usaha, dasar instruksi, harga HPS sudah termasuk PPN, spesifikasi fungsi/waktu/pelayanan.', 'Isi otomatis dari dokumen Instruksi, impor tabel HPS dari PDF, impor spesifikasi mutu dari Word/PDF, dan ambil item HPS dari Rincian DPA.', 'Data contoh (dummy) dapat diisi/dihapus dari Pengaturan → Status Sistem.'] },
  { versi: '1.1.0', tanggal: '2026-11-25', catatan: ['Masuk dengan akun Google tanpa kata sandi (akses darurat tetap tersedia).', 'Menu baru Pengadaan Barang/Jasa: Instruksi PPK ke Pejabat Pengadaan, HPS, dan Spesifikasi Teknis; cetak Word/Excel/PDF dan arsip scan.', 'Impor dari Excel, Word, PDF, dan CSV dengan pratinjau & pencocokan kolom (termasuk DPA dari PDF).', 'Template dokumen bisa diunggah dalam bentuk Word, Excel, atau PDF.', 'Kontrak dapat ditautkan ke paket pengadaan; dokumen paket ikut menandai checklist audit.', 'Semua unggahan dokumen (arsip, lampiran realisasi, scan paket) menerima PDF, Word, dan Excel termasuk format lama .doc/.xls; formulir kontrak dapat diisi otomatis dari dokumen SPK.', 'Riwayat versi tercatat di aplikasi.'] },
  { versi: '1.0.0', tanggal: '2026-11-25', catatan: ['Rilis pertama: perencanaan DPA, kontrak, realisasi bulanan, evaluasi triwulanan berjenjang, arsip, checklist audit, laporan & Lembar Monev, generator SPK/BAST/Laporan.'] }
];

/* ---------------- Konfigurasi ---------------- */
const CFG = (function () {
  const c = Object.assign({ GAS_URL: '' }, window.APP_CONFIG || {});
  // Override khusus pengembangan lokal (tidak berlaku di GitHub Pages)
  try {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && localStorage.getItem('sp_dev_api')) c.GAS_URL = localStorage.getItem('sp_dev_api');
  } catch (e) {}
  c.ok = !!c.GAS_URL && !/GANTI|XXXX/.test(c.GAS_URL);
  return c;
})();

/* ---------------- Konstanta domain ---------------- */
const K = {
  ROLE: { ADMIN: 'Administrator', PEJABAT: 'Pejabat Struktural', STAF: 'Staf / Operator', PROGRAM: 'Bagian Program (Monev)' },
  BULAN: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
  BLN: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  HARI: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
  ROMAWI: ['', 'I', 'II', 'III', 'IV'],
  JENIS: [['RKA_DPA', 'RKA / DPA'], ['HPS', 'HPS & Survei Harga'], ['PENETAPAN', 'Penetapan Penyedia'], ['SPK', 'SPK / Kontrak'],
    ['JAMINAN', 'Jaminan Pelaksanaan'], ['SPMK', 'SPMK'], ['LAPORAN', 'Laporan Progres'], ['FOTO', 'Dokumentasi Foto'],
    ['BAPHP', 'BA Pemeriksaan Hasil Pekerjaan'], ['BAPP', 'BA Penyelesaian Pekerjaan (BAPP)'], ['INSTRUKSI', 'Instruksi PPK'], ['SPEK', 'Spesifikasi Teknis'], ['BAST', 'BAST'], ['SPM', 'SPM'], ['SP2D', 'SP2D'], ['PAJAK', 'Bukti Pajak'], ['LAINNYA', 'Lainnya']],
  PREDIKAT: { SANGAT_BERHASIL: 'Sangat Berhasil', BERHASIL: 'Berhasil', KURANG_BERHASIL: 'Kurang Berhasil', TIDAK_BERHASIL: 'Tidak Berhasil' },
  PRED_CHIP: { SANGAT_BERHASIL: 'info', BERHASIL: 'ok', KURANG_BERHASIL: 'warn', TIDAK_BERHASIL: 'err' },
  ST_KONTRAK: { DRAF: ['Draf', 'slate'], AKTIF: ['Aktif', 'ok'], SELESAI: ['Selesai', 'info'], PUTUS: ['Putus', 'err'], TERLAMBAT: ['Terlambat', 'err'] },
  ST_REAL: { DRAF: ['Draf', 'slate'], DIAJUKAN: ['Diajukan', 'warn'], TERVERIFIKASI: ['Terverifikasi', 'ok'], DITOLAK: ['Ditolak', 'err'] },
  ST_CL: { LENGKAP: ['Lengkap', 'ok'], BELUM: ['Belum Lengkap', 'warn'], TIDAK_PERLU: ['Tidak Perlu', 'slate'] },
  METODE: ['E-Purchasing / E-Katalog', 'Pengadaan Langsung', 'Penunjukan Langsung', 'Tender', 'Seleksi', 'Swakelola', 'Lainnya'],
  KEYS: { pengguna: 'Email', subkeg: 'ID_SubKeg', kontrak: 'ID_Kontrak', realisasi: 'ID', evaluasi: 'ID', arsip: 'ID_Dokumen',
    checklistMaster: 'Kode', checklist: 'ID', template: 'ID_Template', dokumen: 'ID', pengadaan: 'ID_Paket', pengadaanItem: 'ID', riwayatVersi: 'Versi' },
  NUM: ['Pagu', 'Target', 'Nilai_Kontrak', 'Realisasi_Fisik', 'Realisasi_Keuangan', 'Bulan', 'Tahun', 'Triwulan', 'Ukuran', 'Urutan',
    'Rencana_TW1', 'Rencana_TW2', 'Rencana_TW3', 'Rencana_TW4', 'Pagu_Paket', 'PPN_Persen', 'Nilai_HPS', 'Jangka_Waktu', 'Volume', 'Harga_Satuan', 'No',
    'Pagu_Sebelum', 'Alokasi_Lalu', 'Alokasi_Depan', 'Jumlah_Rincian']
};
const jenisNama = (k) => (K.JENIS.find((j) => j[0] === k) || [k, k || '-'])[1];

/* ---------------- Utilitas umum ---------------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, cls) => `<svg class="ic ${cls || ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const num = (v) => { if (v === '' || v == null) return 0; const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
const fmtN = (n, d) => (Number(n) || 0).toLocaleString('id-ID', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
const rp = (n) => 'Rp ' + fmtN(Math.round(Number(n) || 0));
const rpS = (n) => { n = Number(n) || 0; const a = Math.abs(n); if (a >= 1e12) return 'Rp ' + fmtN(n / 1e12, 2) + ' T'; if (a >= 1e9) return 'Rp ' + fmtN(n / 1e9, 2) + ' M'; if (a >= 1e6) return 'Rp ' + fmtN(n / 1e6, 1) + ' jt'; return rp(n); };
const pct = (n, d) => fmtN(n, d == null ? 1 : d) + '%';
const sgn = (n, d) => (n > 0 ? '+' : '') + fmtN(n, d == null ? 1 : d) + '%';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const uid = (p) => (p || 'tmp-') + Math.random().toString(36).slice(2, 9);
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const parseD = (s) => { if (!s) return null; const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const tgl = (s) => { const d = parseD(s); return d ? d.getDate() + ' ' + K.BLN[d.getMonth()] + ' ' + d.getFullYear() : (s || '-'); };
const tglP = (s) => { const d = parseD(s); return d ? d.getDate() + ' ' + K.BULAN[d.getMonth()] + ' ' + d.getFullYear() : (s || '-'); };
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const initials = (n) => String(n || '?').replace(/[,.].*$/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const norm = (s) => String(s || '').trim().toLowerCase();
const sameBidang = (a, b) => norm(a) === norm(b);
const byKey = (k) => (a, b) => String(a[k] || '').localeCompare(String(b[k] || ''), 'id', { numeric: true });

/* ---------------- Pengukur kinerja (console: Perf.table()) ---------------- */
const Perf = { log: [], add(r) { this.log.push(r); if (this.log.length > 200) this.log.shift(); },
  table() { console.table(this.log.slice(-30)); }, summary() { const g = {}; this.log.forEach((r) => { (g[r.aksi] = g[r.aksi] || []).push(r.total); }); console.table(Object.keys(g).map((k) => ({ aksi: k, n: g[k].length, rata: Math.round(g[k].reduce((a, b) => a + b, 0) / g[k].length) }))); } };
window.Perf = Perf;

/* ---------------- Penyimpanan lokal aman ---------------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ---------------- Aktivitas (polling adaptif) ---------------- */
const Activity = { at: Date.now(), last: {},
  init() { ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focus'].forEach((ev) => addEventListener(ev, () => { this.at = Date.now(); }, { passive: true })); },
  idle() { return Date.now() - this.at > 120000; },
  due(key, activeMs, idleMs) {
    if (document.visibilityState !== 'visible') return false;
    if (Date.now() - (this.last[key] || 0) < (this.idle() ? idleMs : activeMs) - 500) return false;
    this.last[key] = Date.now(); return true;
  } };

/* =====================================================================
   API
   ===================================================================== */
const READ = /^(boot|ping|sistem\.status|arsip\.ambil|berkas\.ambil)$/;
const _inflight = {}; let _writeEpoch = 0; let _busy = 0;
function progress(on) {
  _busy += on ? 1 : -1; const b = $('#syncBar'); if (!b) return;
  if (_busy > 0) { b.style.opacity = 1; b.style.width = '70%'; } else { b.style.width = '100%'; setTimeout(() => { if (_busy <= 0) { b.style.opacity = 0; b.style.width = 0; } }, 250); }
}
async function apiRun(action, data, opts) {
  opts = opts || {};
  if (!CFG.ok) return { success: false, message: 'GAS_URL belum diisi di js/config.js.', code: 'CONFIG' };
  if (!navigator.onLine) return { success: false, message: 'Perangkat sedang luring. Periksa koneksi internet.', network: true };
  const t0 = performance.now(); const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), opts.timeout || 90000);
  if (!opts.quiet) progress(true);
  let res;
  try {
    const r = await fetch(CFG.GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: Auth.token || '', data: data || {} }), signal: ctl.signal, redirect: 'follow' });
    const txt = await r.text();
    try { res = JSON.parse(txt); } catch (e) { res = { success: false, message: 'Respons server tidak valid. Pastikan Web App di-deploy dengan akses "Anyone" dan URL /exec benar.' }; }
  } catch (e) {
    res = { success: false, network: true, message: e.name === 'AbortError' ? 'Server terlalu lama merespons. Coba lagi.' : 'Tidak dapat terhubung ke server. Periksa koneksi internet.' };
  } finally { clearTimeout(to); if (!opts.quiet) progress(false); }
  const total = Math.round(performance.now() - t0);
  Perf.add({ aksi: action, total, server: res.ms || 0, net: total - (res.ms || 0), cache: !!res.cached });
  if (!res.success && res.code === 'AUTH' && Auth.token) Auth.expired(res.message);
  if (!res.success && res.code === 'GANTI_SANDI' && S.me && !document.querySelector('[data-wajib-sandi]')) { S.me.wajibGanti = true; setTimeout(() => Pages.map.profil.gantiSandi(true), 0); }
  return res;
}
function api(action, data, opts) {
  if (!READ.test(action)) { _writeEpoch++; return apiRun(action, data, opts); }
  const k = _writeEpoch + '|' + action + '|' + JSON.stringify(data || {});
  if (_inflight[k]) return _inflight[k];
  const p = apiRun(action, data, opts); _inflight[k] = p;
  p.then(() => delete _inflight[k], () => delete _inflight[k]);
  return p;
}
function warmUpServer(scope) {
  if (!CFG.ok) return;
  try { const k = 'sp_warm_' + scope; const last = +sessionStorage.getItem(k) || 0; if (Date.now() - last < 240000) return; sessionStorage.setItem(k, Date.now()); } catch (e) {}
  fetch(CFG.GAS_URL + (CFG.GAS_URL.indexOf('?') > -1 ? '&' : '?') + 'w=' + scope, { mode: 'no-cors' }).catch(() => {});
}

/* =====================================================================
   STORE — data lokal + indeks turunan
   ===================================================================== */
const S = { ver: '', tahun: 0, me: null, settings: {}, t: {}, at: 0, rev: 0 };
const TABLES = Object.keys(K.KEYS);
TABLES.forEach((n) => { S.t[n] = []; });

const Store = {
  key() { return 'sp_data_' + (Auth.me ? Auth.me.email : 'x'); },
  fromHR(tb) {
    if (!tb || !tb.h) return [];
    const h = tb.h; return (tb.r || []).map((row) => { const o = {}; h.forEach((k, i) => { o[k] = row[i]; }); return Store.normRow(o); });
  },
  normRow(o) { K.NUM.forEach((k) => { if (k in o && o[k] !== '' && o[k] != null) o[k] = num(o[k]); }); return o; },
  ingest(b) {
    S.ver = b.ver; S.tahun = Number(b.tahun) || S.tahun; S.me = Object.assign({}, b.me); S.settings = b.settings || {}; S.versi = b.versi || null;
    TABLES.forEach((n) => { S.t[n] = Store.fromHR((b.tables || {})[n]); });
    S.at = Date.now(); Store.bump(); Store.save();
  },
  save() {
    const tables = {}; TABLES.forEach((n) => { tables[n] = S.t[n]; });
    if (!LS.set(Store.key(), { ver: S.ver, tahun: S.tahun, me: S.me, settings: S.settings, versi: S.versi, tables, at: S.at, v: APP_VERSION })) {
      LS.del(Store.key()); // kuota penuh → jangan simpan setengah
    }
  },
  saveSoon: debounce(() => Store.save(), 400),
  load() {
    const d = LS.get(Store.key(), null); if (!d || d.v !== APP_VERSION || !d.tables) return false;
    S.ver = d.ver; S.tahun = d.tahun; S.me = d.me; S.settings = d.settings || {}; S.versi = d.versi || null; S.at = d.at || 0;
    TABLES.forEach((n) => { S.t[n] = (d.tables[n] || []).map(Store.normRow); });
    Store.bump(); return true;
  },
  bump() { S.rev++; Calc._memo = {}; },
  get(tb, id) { const k = K.KEYS[tb]; return S.t[tb].find((r) => String(r[k]) === String(id)); },
  upsert(tb, row, oldId) {
    const k = K.KEYS[tb]; row = Store.normRow(Object.assign({}, row));
    const i = S.t[tb].findIndex((r) => String(r[k]) === String(oldId != null ? oldId : row[k]));
    if (i > -1) S.t[tb][i] = row; else S.t[tb].push(row);
    Store.bump(); Store.saveSoon(); return row;
  },
  remove(tb, id) { const k = K.KEYS[tb]; const i = S.t[tb].findIndex((r) => String(r[k]) === String(id)); let old = null; if (i > -1) { old = S.t[tb][i]; S.t[tb].splice(i, 1); Store.bump(); Store.saveSoon(); } return old; },
  user(email) { return S.t.pengguna.find((u) => norm(u.Email) === norm(email)); },
  nama(email) { const u = Store.user(email); return u ? u.Nama : (email || '-'); },
  bidangList() { const s = String(S.settings.DAFTAR_BIDANG || '').split(';').map((x) => x.trim()).filter(Boolean); return s.length ? s : ['Sekretariat', 'Lalu Lintas Jalan', 'Angkutan', 'Perairan & Udara']; }
};

/* =====================================================================
   OTORISASI di sisi klien (hanya untuk tampilan; server tetap memutuskan)
   ===================================================================== */
const Can = {
  role(...r) { return !!S.me && r.indexOf(S.me.role) > -1; },
  admin() { return Can.role('ADMIN'); },
  bidangOk(b) { if (!S.me) return false; if (Can.admin()) return true; const mb = norm(S.me.bidang); return !mb || mb === 'semua' || !b || sameBidang(mb, b); },
  editPlan() { return Can.role('ADMIN', 'PROGRAM'); },
  editKontrak(sk) { return Can.role('ADMIN', 'PEJABAT', 'STAF') && Can.bidangOk(sk && sk.Bidang); },
  hapusKontrak() { return Can.role('ADMIN', 'PEJABAT'); },
  inputReal(sk) { return Can.role('ADMIN', 'PEJABAT', 'STAF') && Can.bidangOk(sk && sk.Bidang); },
  verifReal(sk) { return !!S.me && (Can.admin() || (sk && norm(sk.PIC_Email) === norm(S.me.email))); },
  nilai(email) { return !!S.me && (S.me.bawahan || []).map(norm).indexOf(norm(email)) > -1; },
  arsip() { return Can.role('ADMIN', 'PEJABAT', 'STAF'); },
  hapusArsip() { return Can.role('ADMIN', 'PEJABAT'); },
  generate() { return Can.role('ADMIN', 'PEJABAT', 'STAF'); }
};

/* =====================================================================
   KALKULASI — realisasi, rencana, agregat, checklist, peringatan
   ===================================================================== */
const Calc = {
  _memo: {},
  memo(k, fn) { if (!(k in this._memo)) this._memo[k] = fn(); return this._memo[k]; },
  /** Bulan potong default: bulan berjalan bila tahun aktif = tahun ini, selain itu 12 */
  /** Posisi data bawaan: bulan lalu (bulan berjalan belum wajib dilaporkan); tahun lampau = Desember */
  cutDefault() { const d = new Date(); return Number(S.tahun) === d.getFullYear() ? Math.max(1, d.getMonth()) : (Number(S.tahun) < d.getFullYear() ? 12 : 1); },
  /** Rencana fisik kumulatif (%) pada bulan m, interpolasi linear antar titik triwulan */
  rencana(sk, m) {
    const tw = [0, num(sk.Rencana_TW1) || 25, num(sk.Rencana_TW2) || 50, num(sk.Rencana_TW3) || 75, num(sk.Rencana_TW4) || 100];
    m = clamp(Math.round(m), 0, 12); if (m === 0) return 0;
    const k = Math.ceil(m / 3), prev = tw[k - 1], cur = tw[k];
    return prev + (cur - prev) * ((m - 3 * (k - 1)) / 3);
  },
  realRows(idSk) { return Calc.memo('rr_' + idSk, () => S.t.realisasi.filter((r) => r.ID_SubKeg === idSk).sort((a, b) => a.Bulan - b.Bulan)); },
  counted(r) { return r.Status === 'TERVERIFIKASI' || r.Status === 'DIAJUKAN'; },
  /** Ringkasan satu sub kegiatan s.d. bulan cut */
  sk(sk, cut) {
    cut = cut || Calc.cutDefault();
    return Calc.memo('sk_' + sk.ID_SubKeg + '_' + cut, () => {
      const rows = Calc.realRows(sk.ID_SubKeg).filter((r) => r.Bulan <= cut && Calc.counted(r));
      let fisik = 0, keu = 0, last = 0, belumVerif = 0;
      rows.forEach((r) => { keu += num(r.Realisasi_Keuangan); if (r.Bulan >= last) { last = r.Bulan; fisik = num(r.Realisasi_Fisik); } if (r.Status === 'DIAJUKAN') belumVerif++; });
      const pagu = num(sk.Pagu), ren = Calc.rencana(sk, cut);
      const keuPct = pagu ? (keu / pagu) * 100 : 0;
      const kontrak = S.t.kontrak.filter((k) => k.ID_SubKeg === sk.ID_SubKeg);
      return { sk, pagu, keu, keuPct, fisik, ren, dev: fisik - ren, devKeu: keuPct - ren, last, belumVerif, kontrak,
        nilaiKontrak: kontrak.reduce((a, k) => a + num(k.Nilai_Kontrak), 0) };
    });
  },
  /** Agregat sekumpulan sub kegiatan (fisik & rencana tertimbang pagu) */
  agg(list, cut) {
    let pagu = 0, keu = 0, wf = 0, wr = 0, nk = 0, bv = 0;
    list.forEach((sk) => { const s = Calc.sk(sk, cut); pagu += s.pagu; keu += s.keu; wf += s.fisik * s.pagu; wr += s.ren * s.pagu; nk += s.nilaiKontrak; bv += s.belumVerif; });
    const fisik = pagu ? wf / pagu : 0, ren = pagu ? wr / pagu : 0;
    return { n: list.length, pagu, keu, keuPct: pagu ? (keu / pagu) * 100 : 0, fisik, ren, dev: fisik - ren, nilaiKontrak: nk, belumVerif: bv };
  },
  subkeg(filter) {
    filter = filter || {};
    return S.t.subkeg.filter((s) => (!filter.bidang || sameBidang(s.Bidang, filter.bidang)) && (!filter.pic || filter.pic.map(norm).indexOf(norm(s.PIC_Email)) > -1));
  },
  /** Keuangan per triwulan (Rp, bukan kumulatif) untuk satu sub kegiatan */
  keuTW(idSk, tw) { return Calc.realRows(idSk).filter((r) => Calc.counted(r) && Math.ceil(r.Bulan / 3) === tw).reduce((a, r) => a + num(r.Realisasi_Keuangan), 0); },
  fisikTW(idSk, tw) { const rows = Calc.realRows(idSk).filter((r) => Calc.counted(r) && r.Bulan <= tw * 3); return rows.length ? num(rows[rows.length - 1].Realisasi_Fisik) : 0; },
  /** Pembayaran (SP2D) per kontrak: realisasi yang ditautkan; bila sub kegiatan hanya punya 1 kontrak,
      realisasi tanpa tautan kontrak ikut dihitung untuk kontrak itu. */
  bayarKontrak(k) {
    return Calc.memo('by_' + k.ID_Kontrak, () => {
      const satu = S.t.kontrak.filter((x) => x.ID_SubKeg === k.ID_SubKeg && x.Status !== 'PUTUS').length === 1;
      return Calc.realRows(k.ID_SubKeg).filter((r) => Calc.counted(r) && (r.ID_Kontrak === k.ID_Kontrak || (satu && !r.ID_Kontrak))).reduce((a, r) => a + num(r.Realisasi_Keuangan), 0);
    });
  },
  /** Status kontrak turunan */
  kontrakStatus(k) { if (k.Status === 'AKTIF' && k.Tgl_Selesai && parseD(k.Tgl_Selesai) < parseD(todayISO())) return 'TERLAMBAT'; return k.Status || 'DRAF'; },
  sisaHari(k) { return k.Tgl_Selesai ? daysBetween(todayISO(), k.Tgl_Selesai) : null; },
  /** Checklist efektif satu kontrak */
  checklist(idK) {
    return Calc.memo('cl_' + idK, () => {
      const master = S.t.checklistMaster.filter((m) => m.Aktif !== 'TIDAK').sort((a, b) => num(a.Urutan) - num(b.Urutan));
      const rows = S.t.checklist.filter((c) => c.ID_Kontrak === idK);
      const kk = S.t.kontrak.find((x) => x.ID_Kontrak === idK) || {};
      const docs = S.t.arsip.filter((a) => a.ID_Kontrak === idK || (kk.ID_Paket && a.ID_Paket === kk.ID_Paket));
      const items = master.map((m) => {
        const r = rows.find((c) => c.Kode_Item === m.Kode);
        const autoDoc = docs.find((d) => d.Jenis_Dokumen === m.Jenis_Dokumen);
        const status = r ? r.Status : (autoDoc ? 'LENGKAP' : 'BELUM');
        const docId = (r && r.ID_Dokumen) || (autoDoc && autoDoc.ID_Dokumen) || '';
        return { m, r, status, doc: docId ? S.t.arsip.find((d) => d.ID_Dokumen === docId) : null, auto: !r && !!autoDoc };
      });
      const wajib = items.filter((i) => i.status !== 'TIDAK_PERLU'), ok = wajib.filter((i) => i.status === 'LENGKAP').length;
      return { items, total: wajib.length, ok, pct: wajib.length ? (ok / wajib.length) * 100 : 0 };
    });
  },
  kesiapan(kontrakList) {
    const ls = kontrakList.filter((k) => k.Status !== 'DRAF');
    if (!ls.length) return { pct: 0, n: 0, siap: 0 };
    let s = 0, siap = 0; ls.forEach((k) => { const c = Calc.checklist(k.ID_Kontrak); s += c.pct; if (c.pct >= 99.9) siap++; });
    return { pct: s / ls.length, n: ls.length, siap };
  },
  /** Peringatan untuk lonceng notifikasi */
  alerts() {
    if (!S.me) return [];
    return Calc.memo('alerts', () => {
      const a = [], me = norm(S.me.email);
      if (S.me.wajibGanti) a.push({ t: 'err', i: 'key', h: 'Ganti kata sandi awal', s: 'Demi keamanan, ganti kata sandi sekarang.', go: '#/profil' });
      const mySk = S.t.subkeg.filter((s) => norm(s.PIC_Email) === me);
      const tunggu = S.t.realisasi.filter((r) => r.Status === 'DIAJUKAN' && (Can.admin() ? true : mySk.some((s) => s.ID_SubKeg === r.ID_SubKeg)));
      if (tunggu.length) a.push({ t: 'warn', i: 'verified', h: tunggu.length + ' realisasi menunggu verifikasi', s: 'Periksa dan verifikasi input realisasi bulanan.', go: '#/realisasi?tab=verif' });
      const tw = num(S.settings.TRIWULAN_AKTIF) || Math.ceil((new Date().getMonth() + 1) / 3);
      const belum = (S.me.bawahan || []).filter((e) => !S.t.evaluasi.some((v) => norm(v.Email_Pejabat) === norm(e) && v.Triwulan === tw && v.Status === 'TERKUNCI'));
      if (belum.length) a.push({ t: 'info', i: 'review', h: 'Evaluasi TW ' + K.ROMAWI[tw] + ' belum dikunci', s: belum.map((e) => Store.nama(e)).slice(0, 3).join(', ') + (belum.length > 3 ? ' +' + (belum.length - 3) : ''), go: '#/evaluasi' });
      const telat = S.t.kontrak.filter((k) => Calc.kontrakStatus(k) === 'TERLAMBAT' && Can.bidangOk((Store.get('subkeg', k.ID_SubKeg) || {}).Bidang));
      if (telat.length) a.push({ t: 'err', i: 'warn', h: telat.length + ' kontrak melewati jangka waktu', s: telat.slice(0, 2).map((k) => k.No_SPK).join(', '), go: '#/kontrak?f=TERLAMBAT' });
      const m = new Date().getMonth(); // bulan lalu (1..12) = m
      if (m >= 1 && Number(S.tahun) === new Date().getFullYear()) {
        const kosong = mySk.filter((s) => !S.t.realisasi.some((r) => r.ID_SubKeg === s.ID_SubKeg && r.Bulan === m));
        if (kosong.length) a.push({ t: 'warn', i: 'trend', h: 'Realisasi ' + K.BULAN[m - 1] + ' belum diinput', s: kosong.length + ' sub kegiatan yang Anda tangani', go: '#/realisasi' });
      }
      return a;
    });
  }
};

/* =====================================================================
   SESI / AUTH
   ===================================================================== */
const Auth = {
  token: '', me: null,
  init() { const s = LS.get('sp_sesi', null); if (s && s.token) { this.token = s.token; this.me = s.me; } },
  set(token, me) { this.token = token; this.me = me; LS.set('sp_sesi', { token, me }); },
  clear() { this.token = ''; LS.del('sp_sesi'); },
  async login(email, password) {
    const r = await api('auth.login', { email: String(email).trim().toLowerCase(), password });
    if (r.success) { this.set(r.data.token, r.data.me); }
    return r;
  },
  cfg: null,
  /** Konfigurasi login publik (Client ID Google) — disimpan lokal agar halaman masuk instan */
  async config(fresh) {
    if (!fresh && this.cfg) return this.cfg;
    const c = LS.get('sp_authcfg', null); if (c && !fresh) { this.cfg = c; this.config(true); return c; }
    const r = await api('auth.config', {}, { quiet: true });
    if (r.success) { this.cfg = r.data || {}; LS.set('sp_authcfg', this.cfg); }
    return this.cfg || c || {};
  },
  async google(idToken) {
    const r = await api('auth.google', { idToken });
    if (r.success) this.set(r.data.token, r.data.me);
    return r;
  },
  async darurat(username, password) {
    const r = await api('auth.darurat', { username, password });
    if (r.success) this.set(r.data.token, r.data.me);
    return r;
  },
  logout(msg) {
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) {}
    const key = Store.key(); this.clear(); this.me = null; S.me = null; LS.del(key);
    TABLES.forEach((n) => { S.t[n] = []; }); S.ver = '';
    App.showLogin(msg);
  },
  expired(msg) { toast(msg || 'Sesi berakhir. Silakan masuk kembali.', 'warn'); this.logout(); }
};

/* =====================================================================
   SINKRONISASI (SWR)
   ===================================================================== */
const Sync = {
  running: null, state: 'idle', soonT: null,
  async run(opts) {
    opts = opts || {};
    if (this.running) return this.running;
    this.running = (async () => {
      this.ui('sync');
      const r = await api('boot', { ver: opts.force ? '' : S.ver, tahun: S.tahun || undefined }, { quiet: !opts.loud });
      if (r.success) {
        if (r.data && r.data.same) { S.at = Date.now(); this.ui('ok'); }
        else if (r.data) { Store.ingest(r.data); if (r.data.me) { Auth.me = r.data.me; LS.set('sp_sesi', { token: Auth.token, me: r.data.me }); } this.ui('ok'); App.dataChanged(); }
      } else this.ui(r.network ? 'off' : 'err', r.message);
      return r;
    })();
    try { return await this.running; } finally { this.running = null; }
  },
  soon() { clearTimeout(this.soonT); this.soonT = setTimeout(() => this.run(), 1500); },
  ui(st, msg) {
    this.state = st; const dot = $('#syncDot'), t = $('#syncTxt'), w = $('#syncWhen'); if (!dot) return;
    dot.className = 'dot ' + ({ ok: 'ok', off: 'off', err: 'err', sync: '' }[st] || '');
    t.textContent = { ok: 'Data tersinkron', off: 'Luring', err: 'Gagal sinkron', sync: 'Menyinkronkan…' }[st] || '';
    w.textContent = st === 'err' ? (msg || '').slice(0, 60) : (S.at ? 'Terakhir: ' + new Date(S.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA' : '');
  },
  start() {
    setInterval(() => { if (Auth.token && navigator.onLine && Activity.due('sync', 45000, 180000)) this.run(); }, 5000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Auth.token && Date.now() - S.at > 20000) this.run(); });
    addEventListener('online', () => { $('#offlineBar').classList.add('hidden'); if (Auth.token) this.run(); });
    addEventListener('offline', () => { $('#offlineBar').classList.remove('hidden'); this.ui('off'); });
  }
};

/* =====================================================================
   MUTASI dengan optimistic UI
   ===================================================================== */
/**
 * mutate(action, data, {table, temp, optimistic, okMsg, btn, onOk, onFail})
 * - temp: baris sementara langsung ditampilkan (ID tmp-*) lalu diganti baris server.
 * - optimistic(): ubah store lokal sendiri, kembalikan fungsi undo.
 */
async function mutate(action, data, o) {
  o = o || {};
  if (!navigator.onLine) { toast('Sedang luring — perubahan belum bisa disimpan.', 'err'); return { success: false }; }
  let undo = null, tempId = null;
  if (o.temp && o.table) { const k = K.KEYS[o.table]; const prev = o.temp[k] ? Store.get(o.table, o.temp[k]) : null; tempId = o.temp[k] || uid(); const row = Object.assign({}, prev || {}, o.temp, { [k]: tempId, _pending: true }); Store.upsert(o.table, row, tempId); undo = () => { if (prev) Store.upsert(o.table, prev, tempId); else Store.remove(o.table, tempId); }; App.refresh(); }
  else if (o.optimistic) { undo = o.optimistic(); App.refresh(); }
  if (o.btn) o.btn.classList.add('busy');
  const r = await api(action, data);
  if (o.btn) o.btn.classList.remove('busy');
  if (r.success) {
    const d = r.data || {};
    if (o.table && d.row) Store.upsert(o.table, d.row, tempId);
    if (o.table && d.rows) d.rows.forEach((row) => Store.upsert(o.table, row));
    // Versi lokal ikut maju hanya bila tidak ada tulisan pengguna lain di antaranya (verPrev cocok)
    if (r.ver && r.verPrev && r.verPrev === S.ver) { S.ver = r.ver; Store.saveSoon(); }
    if (o.onOk) o.onOk(d, r);
    if (o.okMsg !== false) toast(o.okMsg || r.message || 'Tersimpan.', 'ok');
    App.refresh(); Sync.soon();
  } else {
    if (undo) { undo(); App.refresh(); }
    if (o.onFail) o.onFail(r);
    toast(r.message || 'Gagal menyimpan.', 'err', o.retry ? { label: 'Coba lagi', fn: o.retry } : null);
  }
  return r;
}

/* =====================================================================
   UI: toast, modal, konfirmasi, form
   ===================================================================== */
function toast(msg, type, action) {
  const box = $('#toasts'); const el = document.createElement('div');
  el.className = 'toast ' + (type || 'info');
  el.innerHTML = ic({ ok: 'check', err: 'warn', warn: 'warn', info: 'info' }[type || 'info'] || 'info', 'sm') + '<div style="flex:1">' + esc(msg) + '</div>' + (action ? '<button class="btn sm">' + esc(action.label) + '</button>' : '');
  if (action) el.querySelector('button').onclick = () => { el.remove(); action.fn(); };
  box.appendChild(el); setTimeout(() => el.remove(), type === 'err' ? 7000 : 3500);
}
function modal(o) {
  const wrap = document.createElement('div'); wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${o.size || ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title)}">
    <div class="modal-h">${o.icon ? ic(o.icon) : ''}<h3>${esc(o.title)}</h3><button class="btn ghost icon x" data-x aria-label="Tutup">${ic('close')}</button></div>
    <div class="modal-b">${o.body || ''}</div>${o.foot !== false ? `<div class="modal-f">${o.foot || '<button class="btn" data-x>Tutup</button>'}</div>` : ''}</div>`;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-x]')) close(); });
  document.addEventListener('keydown', onKey);
  $('#modalRoot').appendChild(wrap);
  const api_ = { el: wrap, body: wrap.querySelector('.modal-b'), close };
  if (o.onMount) o.onMount(api_);
  setTimeout(() => { const f = wrap.querySelector('[autofocus], .modal-b .in'); if (f && window.innerWidth > 720) f.focus(); }, 30);
  return api_;
}
function confirmBox(msg, o) {
  o = o || {};
  return new Promise((res) => {
    const m = modal({ title: o.title || 'Konfirmasi', size: 'sm', body: `<p style="margin:0">${msg}</p>`,
      foot: `<button class="btn" data-x>Batal</button><button class="btn ${o.danger ? 'danger' : 'pri'}" data-ok>${esc(o.ok || 'Lanjutkan')}</button>` });
    m.el.querySelector('[data-ok]').onclick = () => { m.close(); res(true); };
    m.el.addEventListener('click', (e) => { if (e.target.closest('[data-x]') || e.target === m.el) res(false); });
  });
}
/** Ambil nilai [name] dari form → objek */
function formVals(root) {
  const o = {};
  $$('[name]', root).forEach((el) => {
    if (el.type === 'checkbox') o[el.name] = el.checked; else if (el.dataset.num !== undefined) o[el.name] = num(el.value); else o[el.name] = el.value.trim();
  });
  return o;
}
/** Validasi sederhana: rules = {name: fn(v, all) → pesan|''} */
function validate(root, rules) {
  let ok = true; const v = formVals(root);
  Object.keys(rules).forEach((n) => {
    const el = root.querySelector(`[name="${n}"]`); if (!el) return; const f = el.closest('.f'); const msg = rules[n](v[n], v);
    if (f) { f.classList.toggle('bad', !!msg); const m = f.querySelector('.err-m'); if (m) m.textContent = msg || ''; }
    if (msg && ok) { ok = false; el.focus(); }
  });
  return ok ? v : null;
}
const req = (label) => (v) => (v === '' || v == null ? label + ' wajib diisi.' : '');
/** Komponen field */
function fld(o) {
  const id = 'f_' + o.name + '_' + Math.random().toString(36).slice(2, 6);
  const v = o.value == null ? '' : o.value;
  let input;
  if (o.type === 'select') input = `<select class="in" id="${id}" name="${o.name}" ${o.dis ? 'disabled' : ''}>${(o.opts || []).map((x) => { const val = Array.isArray(x) ? x[0] : x, lb = Array.isArray(x) ? x[1] : x; return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lb)}</option>`; }).join('')}</select>`;
  else if (o.type === 'textarea') input = `<textarea class="in" id="${id}" name="${o.name}" rows="${o.rows || 3}" ${o.ro ? 'readonly' : ''} placeholder="${esc(o.ph || '')}" maxlength="${o.max || 2000}">${esc(v)}</textarea>`;
  else {
    const t = o.type === 'rp' || o.type === 'num' || o.type === 'pct' ? 'text' : (o.type || 'text');
    input = `<input class="in" id="${id}" name="${o.name}" type="${t}" value="${esc(o.type === 'rp' && v !== '' ? fmtN(v) : v)}" ${o.ro ? 'readonly' : ''} ${o.type === 'rp' || o.type === 'num' || o.type === 'pct' ? 'inputmode="decimal" data-num' : ''} ${o.type === 'rp' ? 'data-rp' : ''} placeholder="${esc(o.ph || '')}" ${o.max ? `maxlength="${o.max}"` : ''} ${o.auto ? `autocomplete="${o.auto}"` : ''}>`;
    if (o.type === 'rp') input = `<div class="affix"><span>Rp</span>${input}</div>`;
    if (o.type === 'pct') input = `<div class="affix r">${input}<span>%</span></div>`;
  }
  return `<div class="f ${o.span || ''}"><label for="${id}">${esc(o.label)}${o.req ? ' <span class="req">*</span>' : ''}</label>${input}${o.hint ? `<div class="hint">${o.hint}</div>` : ''}<div class="err-m"></div></div>`;
}
/** Format input Rupiah saat diketik */
document.addEventListener('input', (e) => {
  const el = e.target; if (!el.matches || !el.matches('input[data-rp]')) return;
  const pos = el.value.length - el.selectionStart; const n = String(el.value).replace(/[^0-9]/g, '');
  el.value = n ? fmtN(Number(n)) : ''; const p = Math.max(0, el.value.length - pos); try { el.setSelectionRange(p, p); } catch (x) {}
});

/* ---------------- Komponen tampilan kecil ---------------- */
const chip = (txt, t, icn) => `<span class="chip ${t || 'slate'}">${icn ? ic(icn, 'sm') : ''}${esc(txt)}</span>`;
const stChip = (map, k) => { const m = map[k] || [k || '-', 'slate']; return chip(m[0], m[1]); };
const bar = (p, cls, tick) => `<div class="bar"><i class="${cls || ''}" style="width:${clamp(p, 0, 100)}%"></i>${tick != null ? `<span class="tick" style="left:calc(${clamp(tick, 0, 100)}% - 1px)"></span>` : ''}</div>`;
const devChip = (d, amb) => { amb = amb == null ? num(S.settings.AMBANG_DEVIASI) || 5 : amb; return chip(sgn(d), d <= -amb ? 'err' : d < 0 ? 'warn' : 'ok'); };
const emptyBox = (title, sub, cta) => `<div class="empty">${ic('folder')}<b>${esc(title)}</b><div>${esc(sub || '')}</div>${cta || ''}</div>`;
const kpi = (o) => `<div class="kpi"><div class="kpi-top"><div class="kpi-l">${esc(o.l)}</div>${o.i ? `<div class="kpi-i ${o.gold ? 'gold' : ''}">${ic(o.i)}</div>` : ''}</div><div class="kpi-val" title="${esc(o.title || '')}">${o.v}</div>${o.bar != null ? bar(o.bar, o.barCls, o.tick) : ''}<div class="kpi-sub">${o.s || ''}</div></div>`;
function pager(total, page, per, onAttr) {
  const pages = Math.max(1, Math.ceil(total / per)); page = clamp(page, 1, pages);
  const from = total ? (page - 1) * per + 1 : 0, to = Math.min(total, page * per);
  let btns = ''; const rng = [];
  for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) rng.push(i);
  let prev = 0; rng.forEach((i) => { if (i - prev > 1) btns += '<span>…</span>'; btns += `<button data-pg="${i}" class="${i === page ? 'on' : ''}">${i}</button>`; prev = i; });
  return `<div class="pager">Menampilkan <b>${from}–${to}</b> dari <b>${total}</b><span class="sp"></span><button data-pg="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Sebelumnya">‹</button>${btns}<button data-pg="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="Berikutnya">›</button></div>`;
}

/* =====================================================================
   GRAFIK SVG ringan (tanpa pustaka)
   ===================================================================== */
const Chart = {
  /** groups: [{label, sub, values:[..]}], series: [{name,color}] */
  bars(o) {
    const W = 640, H = o.h || 260, pl = 40, pr = 10, pt = 16, pb = 46, gw = (W - pl - pr) / Math.max(1, o.groups.length);
    const max = o.max || Math.max(1, ...o.groups.flatMap((g) => g.values)) * 1.15;
    const ns = o.series.length, bw = Math.min(28, (gw * 0.7) / ns);
    let s = `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'Grafik')}">`;
    [0, 0.25, 0.5, 0.75, 1].forEach((f) => { const y = pt + (H - pt - pb) * (1 - f); s += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="#E5E7EB"/><text x="${pl - 6}" y="${y + 4}" text-anchor="end">${o.fmtAxis ? o.fmtAxis(max * f) : Math.round(max * f) + '%'}</text>`; });
    o.groups.forEach((g, gi) => {
      const x0 = pl + gi * gw + (gw - bw * ns - 4 * (ns - 1)) / 2;
      g.values.forEach((v, si) => {
        const h = ((H - pt - pb) * clamp(v, 0, max)) / max, x = x0 + si * (bw + 4), y = H - pb - h;
        s += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(h, v > 0 ? 1 : 0)}" rx="2" fill="${g.dim ? o.series[si].dim || '#D1D5DB' : o.series[si].color}"><title>${esc(g.label)} · ${esc(o.series[si].name)}: ${o.fmt ? o.fmt(v) : pct(v)}</title></rect>`;
        s += `<text class="lbl-v" x="${x + bw / 2}" y="${y - 4}" text-anchor="middle" ${g.dim ? 'style="fill:#9CA3AF"' : ''}>${o.fmt ? o.fmt(v) : fmtN(v, 1)}</text>`;
      });
      s += `<text x="${pl + gi * gw + gw / 2}" y="${H - pb + 16}" text-anchor="middle" style="fill:#1F2937;font-weight:600">${esc(g.label)}</text>`;
      if (g.sub) s += `<text x="${pl + gi * gw + gw / 2}" y="${H - pb + 30}" text-anchor="middle">${esc(g.sub)}</text>`;
    });
    return s + '</svg></div>';
  },
  /** Kurva S: xs label, series [{name,color,values,dash}] (nilai 0..100, null = putus) */
  line(o) {
    const W = 640, H = o.h || 240, pl = 40, pr = 14, pt = 14, pb = 34, n = o.xs.length;
    const X = (i) => pl + ((W - pl - pr) * i) / Math.max(1, n - 1), Y = (v) => pt + (H - pt - pb) * (1 - clamp(v, 0, 100) / 100);
    let s = `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'Kurva S')}">`;
    [0, 25, 50, 75, 100].forEach((v) => { s += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="#E5E7EB"/><text x="${pl - 6}" y="${Y(v) + 4}" text-anchor="end">${v}%</text>`; });
    o.xs.forEach((x, i) => { if (i % (n > 12 ? 2 : 1) === 0) s += `<text x="${X(i)}" y="${H - pb + 16}" text-anchor="middle">${esc(x)}</text>`; });
    if (o.mark != null) s += `<line x1="${X(o.mark)}" x2="${X(o.mark)}" y1="${pt}" y2="${H - pb}" stroke="#D4A017" stroke-dasharray="4 3"/>`;
    o.series.forEach((se) => {
      let d = ''; let pen = false;
      se.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1) + ' '; pen = true; });
      s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se.w || 2.5}" ${se.dash ? 'stroke-dasharray="6 4"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
      se.values.forEach((v, i) => { if (v != null && se.dots) s += `<circle cx="${X(i)}" cy="${Y(v)}" r="3.5" fill="#fff" stroke="${se.color}" stroke-width="2"><title>${esc(se.name)} ${esc(o.xs[i])}: ${pct(v)}</title></circle>`; });
    });
    return s + '</svg></div>';
  },
  legend(series) { return `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`; }
};

/* =====================================================================
   BERKAS: base64, unduh, buka, ekspor Excel/CSV
   ===================================================================== */
function fileToB64(file, onProg) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onprogress = (e) => { if (onProg && e.lengthComputable) onProg(e.loaded / e.total); };
    r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error('Gagal membaca berkas.'));
    r.readAsDataURL(file);
  });
}
function b64Blob(b64, mime) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime || 'application/octet-stream' }); }
function saveBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
/** Ambil berkas dari server lalu buka di tab baru (tab dibuka dulu agar tidak diblokir) */
async function bukaBerkas(action, data, mode) {
  const w = mode === 'unduh' ? null : window.open('about:blank', '_blank');
  if (w) w.document.write('<p style="font-family:sans-serif;padding:24px">Memuat dokumen…</p>');
  const r = await api(action, data);
  if (!r.success) { if (w) w.close(); toast(r.message || 'Gagal memuat berkas.', 'err'); return; }
  const blob = b64Blob(r.data.base64, r.data.mime);
  if (mode === 'unduh' || !w) saveBlob(blob, r.data.nama || 'dokumen');
  else w.location.href = URL.createObjectURL(blob);
}
const _scripts = {};
function loadScript(src) { if (_scripts[src]) return _scripts[src]; _scripts[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = () => { delete _scripts[src]; rej(new Error('Gagal memuat pustaka ekspor')); }; document.head.appendChild(s); }); return _scripts[src]; }
const XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
/** sheets: [{name, aoa:[[...]], cols:[lebar], merges?}] */
async function exportXlsx(filename, sheets) {
  try {
    await loadScript(XLSX_SRC);
    const wb = XLSX.utils.book_new();
    sheets.forEach((sh) => { const ws = XLSX.utils.aoa_to_sheet(sh.aoa); if (sh.cols) ws['!cols'] = sh.cols.map((w) => ({ wch: w })); if (sh.merges) ws['!merges'] = sh.merges; XLSX.utils.book_append_sheet(wb, ws, String(sh.name).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)); });
    XLSX.writeFile(wb, filename + '.xlsx'); toast('File Excel diunduh.', 'ok');
  } catch (e) {
    const sh = sheets[0]; const csv = sh.aoa.map((r) => r.map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    saveBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), filename + '.csv'); toast('Pustaka Excel tidak termuat — diunduh sebagai CSV.', 'warn');
  }
}

/* =====================================================================
   APLIKASI: router, navigasi, render
   ===================================================================== */
const Pages = { list: [], map: {}, add(p) { const i = p.after ? this.list.findIndex((x) => x.id === p.after) : -1; if (i > -1) this.list.splice(i + 1, 0, p); else this.list.push(p); this.map[p.id] = p; } };
const UI = {}; // state filter/halaman per page
const App = {
  cur: null, q: {}, pendingRender: false,
  route() {
    const h = location.hash.replace(/^#\/?/, ''); const [id, qs] = h.split('?');
    const q = {}; new URLSearchParams(qs || '').forEach((v, k) => { q[k] = v; });
    let p = Pages.map[id] || Pages.map.dashboard;
    if (p.roles && !Can.role(...p.roles)) p = Pages.map.dashboard;
    return { p, q };
  },
  go(hash) { if (location.hash === hash) this.render(); else location.hash = hash; },
  render(keepScroll) {
    if (!Auth.token || !S.me) return;
    const { p, q } = this.route(); const changed = !this.cur || this.cur.id !== p.id;
    this.cur = p; this.q = q; UI[p.id] = UI[p.id] || {};
    const v = $('#view'); const y = window.scrollY;
    try { p.render(v, q, UI[p.id]); } catch (e) { console.error(e); v.innerHTML = `<div class="note err">${ic('warn')}<div>Terjadi kesalahan saat menampilkan halaman: ${esc(e.message)}</div></div>`; }
    if (changed) { window.scrollTo(0, 0); $('#crumb').innerHTML = 'SIPANTAU ' + ic('right', 'sm') + ' <b>' + esc(p.title) + '</b>'; document.title = p.title + ' — SI-PANTAU'; }
    else if (keepScroll) window.scrollTo(0, y);
    this.nav(); this.closeSide();
  },
  /** Dipanggil setelah store berubah karena aksi pengguna */
  refresh() { this.render(true); this.chrome(); },
  /** Dipanggil setelah sinkron latar: jangan ganggu pengguna yang sedang mengetik */
  dataChanged() {
    const a = document.activeElement;
    if (a && $('#view').contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { this.pendingRender = true; return; }
    this.refresh();
  },
  nav() {
    const cur = this.cur ? this.cur.id : '';
    const vis = Pages.list.filter((p) => p.nav && (!p.roles || Can.role(...p.roles)));
    const alerts = Calc.alerts();
    let html = '', grp = '';
    vis.forEach((p) => {
      if (p.group !== grp) { grp = p.group; html += `<div class="nav-h">${esc(grp)}</div>`; }
      const n = p.badge ? p.badge() : 0;
      html += `<a href="#/${p.id}" class="${p.id === cur ? 'on' : ''}">${ic(p.icon)}<span>${esc(p.title)}</span>${n ? `<span class="badge-n">${n}</span>` : ''}</a>`;
    });
    $('#nav').innerHTML = html;
    const bn = ['dashboard', 'kontrak', 'realisasi', 'laporan', 'profil'].map((id) => Pages.map[id]).filter((p) => p && (!p.roles || Can.role(...p.roles)));
    $('#bnav').innerHTML = bn.map((p) => `<a href="#/${p.id}" class="${p.id === cur ? 'on' : ''}">${ic(p.icon)}<span>${esc(p.short || p.title)}</span></a>`).join('');
    const pip = $('#bellPip'); pip.textContent = alerts.length; pip.classList.toggle('hidden', !alerts.length);
  },
  chrome() {
    if (!S.me) return;
    $('#meNama').textContent = S.me.nama || S.me.email; $('#meRole').textContent = (S.me.jabatan || K.ROLE[S.me.role] || S.me.role) + (S.me.darurat ? ' · DARURAT' : '');
    $('#meAv').textContent = initials(S.me.nama || S.me.email);
    $('#taTxt').innerHTML = `TA ${esc(S.tahun)} <span class="t">· TRIWULAN ${K.ROMAWI[num(S.settings.TRIWULAN_AKTIF)] || '-'}</span>`;
    $$('[data-set]').forEach((el) => { const v = S.settings[el.dataset.set]; if (v) el.textContent = v; });
    const vb = $('#verBar'); if (vb) { const beda = Versi.beda(); vb.classList.toggle('hidden', !beda); if (beda) vb.innerHTML = ic('info', 'sm') + `Versi server ${esc(S.versi.backend)} berbeda dengan versi aplikasi ${APP_VERSION}. ${Can.admin() ? 'Perbarui backend (Deploy → Versi baru) atau frontend agar sama.' : 'Hubungi admin.'}`; }
  },
  openSide() { $('#side').classList.add('open'); $('#scrim').classList.remove('hidden'); },
  closeSide() { $('#side').classList.remove('open'); $('#scrim').classList.add('hidden'); },
  showLogin(msg) {
    $('#appShell').classList.add('hidden'); $('#loginScreen').classList.remove('hidden');
    $('#lgCfg').classList.toggle('hidden', CFG.ok);
    if (msg) { const e = $('#lgErr'); e.textContent = msg; e.classList.remove('hidden'); }
    warmUpServer('pub');
    if (CFG.ok) GIS.render();
  },
  async loginGoogle(cred) {
    const err = $('#lgErr'), info = $('#lgInfo'); err.classList.add('hidden'); info.textContent = 'Memeriksa akun Google…'; info.classList.remove('hidden');
    const r = await Auth.google(cred); info.classList.add('hidden');
    if (!r.success) { err.textContent = r.message || 'Gagal masuk.'; err.classList.remove('hidden'); return r; }
    this.enter(); return r;
  },
  async enter() {
    $('#loginScreen').classList.add('hidden'); $('#appShell').classList.remove('hidden');
    const hadLocal = Store.load();
    if (hadLocal) { S.me = Object.assign({}, S.me, Auth.me || {}); this.chrome(); this.render(); Sync.ui('ok'); Sync.run(); }
    else {
      S.me = Auth.me; $('#view').innerHTML = skeletonPage(); this.chrome();
      const r = await Sync.run({ force: true, loud: true });
      if (!r.success) { $('#view').innerHTML = `<div class="note err">${ic('warn')}<div><b>Gagal memuat data.</b><br>${esc(r.message)}</div></div><button class="btn pri mt" onclick="Sync.run({force:true,loud:true})">${ic('refresh')}Coba lagi</button>`; return; }
      this.render();
    }
    if (S.me && S.me.wajibGanti && !S.me.darurat && Auth.cfg && Auth.cfg.loginSandi) setTimeout(() => Pages.map.profil.gantiSandi(true), 300);
    setTimeout(() => Versi.cek(), 600);
  },
  init() {
    Activity.init(); Auth.init(); Sync.start();
    $('#lgVer').textContent = 'v' + APP_VERSION;
    addEventListener('hashchange', () => this.render());
    $('#menuBtn').onclick = () => this.openSide(); $('#scrim').onclick = () => this.closeSide();
    $('#meBox').onclick = () => this.go('#/profil');
    $('#taChip').onclick = () => Pages.pilihTahun();
    document.addEventListener('focusout', () => setTimeout(() => { if (this.pendingRender && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { this.pendingRender = false; this.refresh(); } }, 50));
    // Lonceng
    $('#bellBtn').onclick = (e) => {
      e.stopPropagation(); const pop = $('#bellPop'); const a = Calc.alerts();
      pop.innerHTML = `<div class="pop-h">Perlu perhatian</div>` + (a.length ? a.map((x) => `<a class="pop-i" href="${x.go}">${ic(x.i, 'c-' + (x.t === 'err' ? 'err' : x.t === 'warn' ? 'warn' : 'mut'))}<div><b>${esc(x.h)}</b><small>${esc(x.s)}</small></div></a>`).join('') : '<div class="empty" style="padding:24px">Tidak ada yang perlu ditindaklanjuti.</div>');
      pop.classList.toggle('hidden');
    };
    document.addEventListener('click', (e) => { if (!e.target.closest('#bellPop') && !e.target.closest('#bellBtn')) $('#bellPop').classList.add('hidden'); });
    // Login
    $('#lgEye').onclick = () => { const i = $('#lgPass'); i.type = i.type === 'password' ? 'text' : 'password'; };
    $('#pwForm').onsubmit = async (e) => {
      e.preventDefault(); const btn = $('#lgBtn'), err = $('#lgErr'); err.classList.add('hidden');
      const em = $('#lgEmail').value.trim(), pw = $('#lgPass').value;
      if (!em || !pw) { err.textContent = 'Isi email dan kata sandi.'; err.classList.remove('hidden'); return; }
      btn.classList.add('busy'); btn.textContent = 'Memeriksa…';
      const r = await Auth.login(em, pw);
      btn.classList.remove('busy'); btn.textContent = 'Masuk';
      if (!r.success) { err.textContent = r.message || 'Gagal masuk.'; err.classList.remove('hidden'); return; }
      $('#lgPass').value = ''; this.enter();
    };
    $('#lgPwLink').onclick = (e) => { e.preventDefault(); $('#pwForm').classList.toggle('hidden'); };
    $('#lgDarurat').onclick = (e) => { e.preventDefault(); Pages.loginDarurat(); };
    // PWA install
    let deferred = null;
    addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('#installBtn').style.display = ''; });
    $('#installBtn').onclick = async () => { if (!deferred) return; deferred.prompt(); const c = await deferred.userChoice; if (c.outcome === 'accepted') $('#installBtn').style.display = 'none'; deferred = null; };
    if ('serviceWorker' in navigator && location.protocol !== 'file:') addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    if (!navigator.onLine) $('#offlineBar').classList.remove('hidden');
    // Mulai
    if (Auth.token && Auth.me) this.enter(); else this.showLogin();
  }
};
/* ---------------- Google Identity Services (login tanpa kata sandi) ---------------- */
const GIS = {
  SRC: 'https://accounts.google.com/gsi/client',
  async render() {
    const box = $('#gBtn'), info = $('#lgInfo');
    const cfg = await Auth.config();
    $('#lgPwLink').classList.toggle('hidden', !(cfg && cfg.loginSandi));
    if (!cfg || !cfg.googleClientId) { box.innerHTML = ''; info.innerHTML = 'Login Google belum dikonfigurasi. Admin: masuk lewat <b>Akses darurat</b>, lalu isi Client ID di <b>Pengaturan → Keamanan</b>.'; info.classList.remove('hidden'); return; }
    try {
      await loadScript(this.SRC);
      google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: (resp) => App.loginGoogle(resp.credential), auto_select: false, cancel_on_tap_outside: true, ux_mode: 'popup' });
      box.innerHTML = ''; google.accounts.id.renderButton(box, { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'rectangular', logo_alignment: 'left', width: Math.min(320, box.clientWidth || 320), locale: 'id' });
    } catch (e) { box.innerHTML = ''; info.textContent = 'Tombol Google tidak dapat dimuat. Periksa koneksi internet lalu muat ulang halaman.'; info.classList.remove('hidden'); }
  }
};
/* ---------------- Riwayat versi ---------------- */
const Versi = {
  beda() { return !!(S.versi && S.versi.backend && S.versi.backend !== APP_VERSION); },
  cek() {
    if (!S.me) return;
    const seen = LS.get('sp_ver_seen', null);
    if (seen !== APP_VERSION) { LS.set('sp_ver_seen', APP_VERSION); this.tampil(true); }
    if (Can.admin() && !S.t.riwayatVersi.some((r) => r.Versi === APP_VERSION && r.Komponen === 'frontend')) {
      api('versi.catat', { versi: APP_VERSION, komponen: 'frontend', catatan: FE_RIWAYAT[0].catatan.join(' | ') }, { quiet: true }).then((r) => { if (r.success && r.data && r.data.row) { S.t.riwayatVersi.push(Store.normRow(r.data.row)); Store.bump(); Store.saveSoon(); } });
    }
  },
  tampil(baru) {
    const be = (S.versi && S.versi.riwayat) || [], pasang = S.t.riwayatVersi.slice().sort((a, b) => String(b.Tanggal_Pasang).localeCompare(String(a.Tanggal_Pasang)));
    const blok = (r) => `<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div class="row"><b class="strong">Versi ${esc(r.versi)}</b>${r.versi === APP_VERSION ? chip('terpasang', 'ok') : ''}<span class="mini">${tgl(r.tanggal)}</span></div><ul style="margin:6px 0 0;padding-left:20px">${(r.catatan || []).map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>`;
    modal({ title: baru ? 'Yang baru di versi ' + APP_VERSION : 'Riwayat Versi', icon: 'info', size: 'lg',
      body: `<div class="grid g2"><div><div class="lbl">Aplikasi (frontend) · v${APP_VERSION}</div>${FE_RIWAYAT.map(blok).join('')}</div><div><div class="lbl">Server (backend) · v${esc((S.versi && S.versi.backend) || '-')}</div>${be.length ? be.map(blok).join('') : '<p class="mini">Belum ada data versi server.</p>'}</div></div>
        ${this.beda() ? `<div class="note warn mt">${ic('warn', 'sm')}<div>Versi server dan aplikasi berbeda. Pastikan backend dan frontend sama-sama diperbarui.</div></div>` : ''}
        <div class="lbl mt mb-s">Catatan pemasangan di database</div>${pasang.length ? `<div class="tw"><table class="t light"><thead><tr><th>Versi</th><th>Komponen</th><th>Dipasang</th><th>Oleh</th></tr></thead><tbody>${pasang.map((r) => `<tr><td class="mono">${esc(r.Versi)}</td><td>${esc(r.Komponen)}</td><td>${esc(String(r.Tanggal_Pasang).slice(0, 16))}</td><td>${esc(Store.nama(r.Oleh))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mini">Belum ada catatan.</p>'}`,
      foot: '<button class="btn pri" data-x>Mengerti</button>' });
  }
};
function skeletonPage() {
  const k = '<div class="kpi"><div class="sk" style="width:60%"></div><div class="sk" style="height:28px;width:80%;margin-top:8px"></div><div class="sk" style="width:40%;margin-top:8px"></div></div>';
  return `<div class="ph"><div style="flex:1"><div class="sk" style="width:180px"></div><div class="sk" style="height:26px;width:60%;margin-top:10px"></div></div></div><div class="grid g4 mb">${k + k + k + k}</div><div class="card"><div class="card-b">${'<div class="sk" style="margin:12px 0"></div>'.repeat(8)}</div></div>`;
}
document.addEventListener('DOMContentLoaded', () => App.init());

/* =====================================================================
   ATURAN PBJ (v1.2.3) — hanya tugas PPK/internal dinas; proses Pejabat Pengadaan tidak dimodelkan.
   Rujukan dicocokkan dengan naskah: Perpres 16/2018 s.t.d.t.d. Perpres 46/2025 (Pasal 26 ayat 7, Pasal 28)
   dan PerLKPP 2/2026 (Pasal 1 angka 21/25/26, Pasal 13, 19, 20). Ketentuan lain sengaja tidak diterapkan.
   ===================================================================== */
const Aturan = {
  PERPRES: 'Perpres 16/2018 s.t.d.t.d. Perpres 46/2025',
  DASAR_BAKU: [
    'Peraturan Presiden Nomor 16 Tahun 2018 tentang Pengadaan Barang/Jasa Pemerintah sebagaimana telah diubah terakhir dengan Peraturan Presiden Nomor 46 Tahun 2025 tentang Perubahan Kedua atas Peraturan Presiden Nomor 16 Tahun 2018 tentang Pengadaan Barang/Jasa Pemerintah;',
    'Peraturan Lembaga Kebijakan Pengadaan Barang/Jasa Pemerintah Nomor 3 Tahun 2026 tentang Pedoman Persiapan dan Pelaksanaan Pengadaan Barang/Jasa Pemerintah Melalui Penyedia;',
    'Peraturan Lembaga Kebijakan Pengadaan Barang/Jasa Pemerintah Nomor 2 Tahun 2026 tentang Katalog Elektronik dalam Pengadaan Barang/Jasa Pemerintah;',
    'Dokumen Pelaksanaan Anggaran (DPA/DPPA) Tahun Anggaran berjalan.'
  ].join('\n'),
  /** Dasar regulasi checklist yang sudah diverifikasi (diisi hanya bila kolom masih kosong/"lengkapi") */
  CHECKLIST: {
    HPS: { item: 'HPS / Referensi Harga & bukti survei harga', lama: 'Harga Perkiraan Sendiri (HPS) & bukti survei harga',
      dasar: 'Perpres 16/2018 s.t.d.t.d. Perpres 46/2025 Pasal 26; PerLKPP 2/2026 Pasal 13 (E-purchasing: Referensi Harga ≤ Rp100 juta, HPS > Rp100 juta)' },
    SPK: { item: 'Kontrak sesuai bentuknya (bukti pembelian/kuitansi/SPK/surat perjanjian; E-purchasing: Surat/Bukti Pesanan elektronik)', lama: 'SPK / Surat Perjanjian bermeterai, ditandatangani basah kedua pihak',
      dasar: 'Perpres 16/2018 s.t.d.t.d. Perpres 46/2025 Pasal 28; PerLKPP 2/2026 Pasal 19 (Surat/Bukti Pesanan ditandatangani elektronik)' },
    JAMINAN: { item: '', lama: '', dasar: 'PerLKPP 2/2026 Pasal 20 (E-purchasing, nilai kontrak > Rp200 juta); metode lain: lengkapi pasal Perpres' }
  },
  epur(metode) { return /purchasing|katalog/i.test(String(metode || '')); },
  /** Dokumen harga paket: HPS atau Referensi Harga. Nilai = HPS tersimpan, bila belum ada = pagu paket. */
  harga(p) {
    p = p || {}; const nilai = num(p.Nilai_HPS) || num(p.Pagu_Paket), ep = this.epur(p.Metode);
    if (ep && nilai > 0 && nilai <= 100e6) return { kode: 'REF', nama: 'Referensi Harga', judul: 'REFERENSI HARGA', singkat: 'Referensi Harga', dasar: 'PerLKPP 2/2026 Pasal 13 ayat (2)',
      ket: 'E-purchasing bernilai paling banyak Rp100 juta: PPK menyiapkan Referensi Harga, bukan HPS. Kewajiban ini dikecualikan untuk pembelian langsung pada produk berharga tetap (Pasal 13 ayat (3)).' };
    const r = { kode: 'HPS', nama: 'Harga Perkiraan Sendiri (HPS)', judul: 'HARGA PERKIRAAN SENDIRI', singkat: 'HPS', dasar: ep ? 'PerLKPP 2/2026 Pasal 13 ayat (1)' : this.PERPRES + ' Pasal 26', ket: '' };
    if (ep) r.ket = 'E-purchasing di atas Rp100 juta: PPK menetapkan HPS. Dikecualikan untuk pembelian langsung pada produk berharga tetap (PerLKPP 2/2026 Pasal 13 ayat (3)).';
    else if (num(p.Pagu_Paket) > 0 && num(p.Pagu_Paket) <= 10e6) r.ket = 'Pagu paling banyak Rp10 juta: penyusunan HPS dikecualikan (' + this.PERPRES + ' Pasal 26 ayat (7)).';
    return r;
  },
  /** Bentuk kontrak (Perpres Pasal 28). jenis = kode PK.JENIS; kosong → dianggap Barang/Jasa Lainnya. */
  bentukKontrak(nilai, jenis, metode) {
    const n = num(nilai), P = this.PERPRES + ' Pasal 28';
    if (/swakelola/i.test(metode || '')) return null;
    if (this.epur(metode)) return { bentuk: 'Surat/Bukti Pesanan', dasar: P + ' ayat (6); PerLKPP 2/2026 Pasal 19', ket: 'ditandatangani PPK dan Penyedia secara elektronik melalui sistem Katalog Elektronik' };
    if (!(n > 0)) return null;
    const o = (bentuk, ay) => ({ bentuk, dasar: P + ' ayat ' + ay, ket: jenis ? '' : 'jenis pengadaan belum diketahui, dianggap Barang/Jasa Lainnya' });
    if (jenis === 'KONSULTANSI') return n <= 100e6 ? o('Surat Perintah Kerja (SPK)', '(4)') : o('Surat perjanjian', '(5)');
    if (jenis === 'KONSTRUKSI') return n <= 400e6 ? o('Surat Perintah Kerja (SPK)', '(4)') : o('Surat perjanjian', '(5)');
    if (n <= 10e6) return o('Bukti pembelian/pembayaran atau kuitansi', '(2)–(3)');
    if (n <= 50e6) return o('Kuitansi', '(3)');
    if (n <= 200e6) return o('Surat Perintah Kerja (SPK)', '(4)');
    return o('Surat perjanjian', '(5)');
  },
  /** Jaminan pelaksanaan — hanya ketentuan E-purchasing (PerLKPP 2/2026 Pasal 20) */
  jaminan(nilai, jenis, metode) {
    if (!this.epur(metode) || jenis === 'KONSULTANSI' || !(num(nilai) > 0)) return null;
    return num(nilai) > 200e6
      ? { wajib: true, teks: 'Jaminan pelaksanaan diberlakukan (nilai kontrak di atas Rp200 juta), kecuali jasa lainnya yang aset Penyedia dikuasai pengguna.', dasar: 'PerLKPP 2/2026 Pasal 20' }
      : { wajib: false, teks: 'Jaminan pelaksanaan tidak disyaratkan untuk E-purchasing bernilai paling banyak Rp200 juta.', dasar: 'PerLKPP 2/2026 Pasal 20 ayat (1)' };
  },
  /** Ringkasan aturan kontrak untuk ditampilkan (HTML) */
  kontrakHtml(nilai, jenis, metode) {
    const b = this.bentukKontrak(nilai, jenis, metode), j = this.jaminan(nilai, jenis, metode);
    if (!b && !j) return '';
    return `<div class="note info" data-aturan>${ic('info', 'sm')}<div>${b ? `Bentuk kontrak: <b>${esc(b.bentuk)}</b>${b.ket ? ' — ' + esc(b.ket) : ''} <span class="mini">(${esc(b.dasar)})</span>` : ''}${j ? `${b ? '<br>' : ''}${esc(j.teks)} <span class="mini">(${esc(j.dasar)})</span>` : ''}</div></div>`;
  },
  /** Peringatan teks dasar hukum: judul tidak resmi & aturan yang belum/tidak berlaku pada tanggal dokumen */
  cekDasar(teks, tgl) {
    const t = String(teks || ''), d = String(tgl || todayISO()).slice(0, 10), w = [], lk = (n) => new RegExp('(LKPP|Lembaga)[^;\\n]{0,90}Nomor ' + n + ' Tahun', 'i');
    if (/Nomor 46 Tahun 2025 tentang Perubahan atas/i.test(t)) w.push('Judul resmi Perpres 46/2025 adalah "Perubahan Kedua atas Peraturan Presiden Nomor 16 Tahun 2018".');
    if (lk('3').test(t) && /Nomor 3 Tahun 2026/i.test(t) && /Persiapan Pelaksanaan/i.test(t)) w.push('Judul resmi PerLKPP 3/2026: "Pedoman Persiapan dan Pelaksanaan Pengadaan Barang/Jasa Pemerintah Melalui Penyedia".');
    if (lk('2').test(t) && /Nomor 2 Tahun 2026/i.test(t) && d < '2026-09-01') w.push('PerLKPP 2/2026 baru berlaku 1 September 2026; sebelum itu berlaku PerLKPP 9/2021.');
    if (lk('3').test(t) && /Nomor 3 Tahun 2026/i.test(t) && d < '2026-09-22') w.push('PerLKPP 3/2026 diundangkan 22 September 2026; sebelum itu berlaku PerLKPP 12/2021 sebagaimana diubah PerLKPP 4/2024.');
    if (lk('9').test(t) && /Nomor 9 Tahun 2021/i.test(t) && d >= '2026-09-01') w.push('PerLKPP 9/2021 sudah dicabut oleh PerLKPP 2/2026 (berlaku 1 September 2026).');
    if (lk('12').test(t) && /Nomor 12 Tahun 2021/i.test(t) && d >= '2026-09-22') w.push('PerLKPP 12/2021 dan perubahannya sudah dicabut oleh PerLKPP 3/2026 (diundangkan 22 September 2026).');
    return w;
  },
  /** v1.2.4: daftar dokumen yang disarankan menurut metode, jenis, dan nilai (PETUNJUK, bukan pengganti ketentuan).
      p = paket (boleh null), k = kontrak (boleh null). Tahap: persiapan → penunjukan/kontrak → pelaksanaan → serah terima.
      Rujukan butir: Lampiran PerLKPP 3/2026 (I: barang/jasa lainnya & konsultansi nonkonstruksi; II: konstruksi & konsultansi konstruksi). */
  dokumen(p, k) {
    p = p || null; k = k || null;
    const metode = String((k && k.Metode) || (p && p.Metode) || ''), jenis = (p && p.Jenis_Pengadaan) || '', ep = this.epur(metode);
    const nilai = k ? num(k.Nilai_Kontrak) : p ? num(p.Nilai_HPS) || num(p.Pagu_Paket) : 0, L = 'PerLKPP 3/2026 Lampiran ' + (jenis === 'KONSTRUKSI' ? 'II' : 'I');
    const out = { metode, jenis, nilai, perkiraan: !k, catatan: [], daftar: [] };
    const add = (o) => out.daftar.push(Object.assign({ status: 'wajib', perluKontrak: true, ket: '' }, o));
    if (/swakelola/i.test(metode)) { out.catatan.push('Swakelola tidak memakai dokumen penyedia (HPS, SPK, BAST penyedia). Dokumen swakelola mengikuti pedoman swakelola LKPP tersendiri — belum dimodelkan di aplikasi ini (perlu verifikasi peraturan yang berlaku).'); return out; }
    if (/lainnya/i.test(metode) && !p) out.catatan.push('Metode "Lainnya": bila ini belanja non-pengadaan (gaji, listrik, air, telepon, BBM, perjalanan dinas), dokumen pertanggungjawabannya mengikuti ketentuan pengelolaan keuangan daerah, bukan dokumen di bawah ini. Perpres 16/2018 Pasal 61 mengecualikan antara lain barang/jasa dengan tarif yang dipublikasikan luas.');
    if (!metode) out.catatan.push('Metode pemilihan belum diisi — daftar disusun seolah Pengadaan Langsung/Non-Tender.');
    if (p) {
      add({ kode: 'INSTRUKSI', tahap: 'Persiapan (PPK)', nama: 'Instruksi PPK kepada Pejabat Pengadaan/UKPBJ', jenis: 'INSTRUKSI', arsip: 'INSTRUKSI', status: 'internal', perluKontrak: false,
        dasar: 'Praktik internal dinas; PerLKPP 3/2026 mengatur penyampaian dokumen persiapan oleh PPK kepada Pejabat Pengadaan/UKPBJ', ket: 'Nama "Instruksi PPK" tidak disebut dalam peraturan; pengantar dokumen persiapan.' });
      add({ kode: 'SPESIFIKASI', tahap: 'Persiapan (PPK)', nama: jenis === 'KONSULTANSI' ? 'Kerangka Acuan Kerja (KAK)' : 'Spesifikasi Teknis / KAK', jenis: 'SPESIFIKASI', arsip: 'SPEK', perluKontrak: false, dasar: L + ' butir 2.1' });
      const hg = this.harga(p), bebas = !ep && num(p.Pagu_Paket) > 0 && num(p.Pagu_Paket) <= 10e6;
      add({ kode: 'HPS', tahap: 'Persiapan (PPK)', nama: hg.nama, jenis: 'HPS', arsip: 'HPS', perluKontrak: false, status: bebas ? 'opsional' : 'wajib', dasar: hg.dasar + (ep ? '' : '; ' + L + ' butir 2.2'), ket: hg.ket || 'Sah bila ditandatangani PPK.' });
    }
    const bk = this.bentukKontrak(nilai, jenis, metode), bentuk = bk ? bk.bentuk : '';
    const sp = /Surat Perintah Kerja/.test(bentuk), pj = /Surat perjanjian/i.test(bentuk), kw = /^Kuitansi$/.test(bentuk), bp = /Bukti pembelian/.test(bentuk);
    if (!bk && !ep) out.catatan.push('Nilai belum diketahui — isi pagu/HPS paket atau nilai kontrak agar bentuk kontrak dapat ditentukan.');
    if (bk) out.bentuk = bk;
    if (!ep && (sp || pj)) add({ kode: 'PENUNJUKAN', tahap: 'Penunjukan & Kontrak', nama: 'Surat Penunjukan Penyedia (SPPBJ)', jenis: 'PENUNJUKAN', arsip: 'PENETAPAN', status: /pengadaan langsung/i.test(metode) ? 'disarankan' : 'wajib',
      dasar: L + ' butir 6.1–6.2', ket: 'Paling lambat 5 hari kerja setelah BA hasil pemilihan; tanggal kontrak tidak boleh mendahului surat ini.' + (/pengadaan langsung/i.test(metode) ? ' Untuk Pengadaan Langsung periksa kembali kewajibannya (perlu verifikasi).' : '') });
    if (ep) {
      add({ kode: 'SURAT_PESANAN', tahap: 'Penunjukan & Kontrak', nama: 'Surat/Bukti Pesanan e-Katalog', jenis: 'SURAT_PESANAN', arsip: 'SPK', dasar: this.PERPRES + ' Pasal 28 ayat (6); PerLKPP 2/2026 Pasal 19', ket: 'Yang sah diterbitkan & ditandatangani elektronik di sistem Katalog; draf di sini untuk arsip internal.' });
      add({ kode: 'BAPP', tahap: 'Pelaksanaan', nama: 'BA Penyelesaian Pekerjaan (BAPP) per termin', jenis: 'BAPP', arsip: 'BAPP', status: 'disarankan', dasar: 'Kebutuhan pembayaran per termin (draf internal)' });
      add({ kode: 'BAST', tahap: 'Serah Terima', nama: 'BAST e-Katalog', jenis: 'BAST', cari: 'katalog', arsip: 'BAST', dasar: 'PerLKPP 2/2026; ' + L + ' butir 7.1', ket: 'Draf internal; BAST sah mengikuti sistem Katalog bila tersedia di sana.' });
    } else if (bk) {
      if (bp) add({ kode: 'BUKTI', tahap: 'Penunjukan & Kontrak', nama: 'Bukti pembelian/pembayaran (nota/struk dari penyedia)', jenis: '', arsip: 'SPK', dasar: bk.dasar, ket: 'Dokumen dari penyedia — tidak memerlukan template. Kuitansi boleh dipakai sebagai gantinya.' });
      if (bp || kw) add({ kode: 'KUITANSI', tahap: 'Penunjukan & Kontrak', nama: 'Kuitansi', jenis: 'KUITANSI', arsip: 'SPK', status: kw ? 'wajib' : 'opsional', dasar: bk.dasar, ket: 'Langkah: pemesanan → serah terima → penyerahan bukti → pembayaran (' + L + ' butir 5.3.3).' });
      if (sp) add({ kode: 'SPK', tahap: 'Penunjukan & Kontrak', nama: 'Surat Perintah Kerja (SPK) — memuat ' + (jenis === 'BARANG' ? 'Surat Perintah Pengiriman' : 'SPMK'), jenis: 'SPK', cari: jenis === 'BARANG' ? 'barang' : jenis === 'KONSULTANSI' ? 'waktu penugasan|lumsum' : 'lumsum|harga satuan', arsip: 'SPK', dasar: bk.dasar + '; ' + L + ' butir 2.3.4 & 6.5', ket: 'Ditandatangani paling lambat 14 hari kerja setelah surat penunjukan, bermeterai.' });
      if (pj) {
        add({ kode: 'PERJANJIAN', tahap: 'Penunjukan & Kontrak', nama: 'Surat Perjanjian', jenis: 'PERJANJIAN', arsip: 'SPK', dasar: bk.dasar + '; ' + L + ' butir 2.3.4 & 6.3', ket: 'Satu kesatuan dengan SSUK, SSKK, dan dokumen kontrak lain; dua rangkap bermeterai.' });
        add({ kode: 'SPMK', tahap: 'Penunjukan & Kontrak', nama: jenis === 'BARANG' ? 'Surat Perintah Pengiriman' : 'Surat Perintah Mulai Kerja (SPMK)', jenis: '', arsip: 'SPMK', dasar: L + ' butir 6.5', ket: (jenis === 'BARANG' ? 'Paling lambat 14 hari kalender setelah kontrak; penyedia menandatangani ≤ 7 hari kalender.' : 'Paling lambat 14 hari kalender setelah kontrak/penyerahan lokasi.') + ' Template terpisah belum tersedia — bagian ini ada di template SPK.' });
      }
      if (jenis === 'KONSTRUKSI' && (sp || pj)) add({ kode: 'BA_LOKASI', tahap: 'Pelaksanaan', nama: 'BA Peninjauan & Serah Terima Lokasi Kerja', jenis: 'BA_LOKASI', arsip: 'LAINNYA', dasar: L + ' butir 6.4', ket: 'Lokasi yang tidak dapat diserahkan dapat menjadi peristiwa kompensasi.' });
      if (!bp) add({ kode: 'BAST', tahap: 'Serah Terima', nama: 'BA Serah Terima Hasil Pekerjaan (BAST)', jenis: 'BAST', cari: 'pekerjaan', arsip: 'BAST', status: kw ? 'disarankan' : 'wajib', dasar: L + ' butir 7.1', ket: 'Pembayaran 95% dengan retensi 5%, atau 100% dengan jaminan pemeliharaan 5% (bila ada masa pemeliharaan).' });
      const pel = p && p.Pemeliharaan && p.Pemeliharaan !== '-';
      if ((jenis === 'KONSTRUKSI' && (sp || pj)) || (pel && (sp || pj))) add({ kode: 'BAST_AKHIR', tahap: 'Serah Terima', nama: 'BA Serah Terima Akhir (setelah masa pemeliharaan)', jenis: 'BAST_AKHIR', arsip: 'BAST', status: jenis === 'KONSTRUKSI' ? 'wajib' : 'disarankan', dasar: L + ' butir 7.2', ket: 'Jaminan pemeliharaan/retensi dikembalikan paling lambat 14 hari kerja setelahnya.' });
    }
    return out;
  },
  cekDasarHtml(teks, tgl) { const w = this.cekDasar(teks, tgl); return w.length ? `<div class="note warn mt-s" data-cekdasar>${ic('warn', 'sm')}<div>${w.map(esc).join('<br>')}</div></div>` : ''; }
};
