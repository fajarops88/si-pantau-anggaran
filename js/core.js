/* =====================================================================
   SI-PANTAU ANGGARAN — core.js
   API ke GAS (fetch text/plain), store lokal (SWR), optimistic UI,
   router hash, kalkulasi realisasi, grafik SVG, ekspor, utilitas UI.
   ===================================================================== */
'use strict';
const APP_VERSION = '1.4.2';
/** Riwayat versi frontend (terbaru di atas) — tampil di menu Profil → Riwayat Versi */
const FE_RIWAYAT = [
  { versi: '1.4.2', tanggal: '2026-11-28', catatan: ['Checklist Kesiapan Audit: butir baru Penilaian kinerja Penyedia di sistem pengadaan secara elektronik (Perpres 16/2018 s.t.d.t.d. Perpres 46/2025 Pasal 11 ayat (1) huruf m; PerLKPP 3/2026 Lampiran I–III bab VIII). Untuk kontrak swakelola, tandai Tidak Perlu.',
    'Master Checklist → Isi dasar regulasi terverifikasi menambahkan butir tersebut bila belum ada di master (dikenali dari jenis dokumennya, tidak ditambahkan dua kali), lalu klik Simpan Master.',
    'Jenis dokumen arsip baru: Penilaian Kinerja Penyedia (mis. tangkapan layar hasil penilaian). Bila diunggah, butir checklist otomatis Lengkap.'] },
  { versi: '1.4.1', tanggal: '2026-11-28', catatan: ['Jaminan pelaksanaan dinilai untuk semua metode pemilihan (Perpres 16/2018 s.t.d.t.d. Perpres 46/2025 Pasal 33), bukan hanya E-purchasing: kontrak barang, pekerjaan konstruksi, dan jasa lainnya di atas Rp200 juta. Formulir dan detail kontrak menampilkan besarannya (5% nilai Kontrak, atau 5% HPS bila nilai kontrak di bawah 80% HPS; rancang dan bangun memakai pagu) dan masa berlakunya sampai serah terima.',
    'Dokumen Disarankan memuat Jaminan Pelaksanaan bila nilainya di atas Rp200 juta.',
    'Master Checklist → Isi dasar regulasi terverifikasi kini juga mengisi dasar untuk dokumen pemilihan & penetapan penyedia, jaminan pelaksanaan, SPMK, laporan progres, dokumentasi foto, BA pemeriksaan hasil pekerjaan, dan BAST (PerLKPP 3/2026 Lampiran I–III).',
    'Kesiapan Audit: catatan kontrak terlambat dan BAST yang melewati akhir kontrak merujuk ketentuan pemberian kesempatan (paling lama 50 hari kalender lewat adendum) dan denda keterlambatan 1‰ per hari sesuai lampiran PerLKPP 3/2026.'] },
  { versi: '1.4.0', tanggal: '2026-11-28', catatan: ['Alur terhubung: Perencanaan → Pengadaan → Kontrak → Realisasi → Evaluasi → Kesiapan Audit. Pilihan aktif (Sub Kegiatan, rekening, paket, kontrak, bulan) tampil di atas tiap halaman, terbawa saat pindah menu, dan ada tombol Lanjut ke tahap berikutnya.',
    'Perencanaan: tabel rekening belanja → paket → kontrak → SP2D, dengan tombol Buat paket dari rekening. Pengadaan dan Kontrak menyaring daftar menurut Sub Kegiatan aktif; tautan paket membuka kontraknya langsung.',
    'Kontrak: tahapan pekerjaan (SPK, SPMK, pelaksanaan, BA pemeriksaan, BAST, selesai), progres fisik per bulan (Catat progres), dan Catat SP2D yang mengisi kontrak serta rekening paket. Fisik Sub Kegiatan dihitung otomatis dari progres kontrak, ditimbang nilai kontrak.',
    'Realisasi: pilihan Rekening dan Periode pada kartu parameter (menyaring pagu per rekening dan daftar SP2D, dan mengisi formulir SP2D; tanggal SP2D tetap diisi sendiri). Fisik bulan yang berasal dari progres kontrak tampil terkunci beserta rinciannya.',
    'Evaluasi: tautan ke paket, kontrak, realisasi, dan kesiapan audit tiap Sub Kegiatan. Kesiapan Audit: ringkasan pemeriksaan fisik & keuangan (fisik vs pembayaran, BAST vs akhir kontrak) dan tanda data tercatat pada tiap item checklist.'] },
  { versi: '1.3.1', tanggal: '2026-11-27', catatan: ['Tidak ada perubahan fitur aplikasi. Versi disamakan dengan server v1.3.1 (data contoh lengkap 8 modul: Perencanaan, Pengadaan, Kontrak, Realisasi & SP2D, tahapan paket, Tindak Lanjut Pagu, Evaluasi Triwulanan, Checklist Kesiapan Audit) agar tidak muncul peringatan versi berbeda.'] },
  { versi: '1.3.0', tanggal: '2026-11-27', catatan: ['SP2D dicatat per kode rekening: satu SP2D dapat membayar beberapa rekening, nomor SP2D tidak bisa dicatat dua kali, dan pagu dicek per rekening maupun per sub kegiatan. Realisasi keuangan bulanan kini dihitung dari SP2D (menu Realisasi → tab SP2D & Rekening).', 'Realisasi lama (sebelum v1.3.0) yang belum punya kode rekening tetap dihitung dan ditandai "belum dipetakan"; petakan lewat tombol Petakan ke SP2D.', 'Impor DPA SIPD wajib memilih jenis versi (Murni, Pergeseran, Perubahan), tanggal penetapan, dan konfirmasi dokumen sudah ditetapkan. Kolom Sebelum dicek terhadap versi aktif; Pergeseran tidak boleh menambah kode rekening; versi lama disimpan (riwayat versi di halaman Rincian Anggaran).', 'Menu baru Tindak Lanjut Pagu: rekening yang realisasinya melebihi pagu aktif (mis. setelah DPA Pergeseran/Perubahan menurunkan pagu) ditandai merah. PPK memilih Cek SP2D, Menunggu penetapan, atau Diterima dengan alasan (hanya setelah DPA Perubahan). Tanda selesai otomatis bila angka sudah sesuai; riwayat tidak dihapus.', 'Rekening belanja rutin (listrik, air, telepon, internet, BBM) tidak lagi muncul di pilihan Nama Paket pengadaan; daftar polanya di Pengaturan → Umum.', 'Peran Pejabat Struktural ditampilkan sebagai Pejabat Struktural / PPK; teks peran disesuaikan.'] },
  { versi: '1.2.9', tanggal: '2026-11-27', catatan: ['Dicocokkan ulang dengan naskah PerLKPP 2/2026 dan PerLKPP 3/2026: metode Tender Cepat; jenis Jasa Konsultansi Konstruksi (rujukan Lampiran II); konstruksi terintegrasi rancang dan bangun (Lampiran III: tanpa HPS, pagu pekerjaan, surat perjanjian, Pokja Pemilihan).', 'Paket E-purchasing: metode (pembelian langsung/negosiasi harga/mini kompetisi), Katalog atau Toko Daring, dan produk berharga tetap; peringatan batas Rp50 juta, pelaksana menurut nilai (Pejabat Pengadaan/PPK/Pokja), serta HPS/Referensi Harga tidak diwajibkan untuk pembelian langsung berharga tetap (Pasal 11, 13–17).', 'Pelaksana pemilihan otomatis menurut metode dan nilai (PerLKPP 3/2026 butir 1.4 & 5.2); Instruksi PPK ditujukan ke Pejabat Pengadaan atau UKPBJ ({{KEPADA}}); Pejabat Pengadaan tidak wajib bila pelaksananya Pokja/PPK.', 'Analisis pasar bila barang/jasa tersedia di Katalog tetapi tidak memakai E-purchasing (PerLKPP 2/2026 Pasal 12), dengan template bawaan baru.', 'Konstruksi: sifat pekerjaan dan masa pemeliharaan, peringatan bila kurang dari 6 bulan (permanen) atau 3 bulan (semi permanen). Rujukan BAST Akhir konstruksi butir 7.2 & 7.3.', 'Pengaturan: tujuan surat ke UKPBJ dan wilayah Papua (batas nilai percepatan pembangunan Papua).', 'Koreksi: peringatan PerLKPP 9/2021 mengikuti aturan peralihan Pasal 23; BAST/BAPP e-Katalog tidak lagi dirujuk ke PerLKPP 2/2026 dan tidak lagi dinyatakan pasti diterbitkan sistem Katalog.'] },
  { versi: '1.2.8', tanggal: '2026-11-26', catatan: ['Manajemen User: Admin dapat menghapus pengguna (ikon tempat sampah di daftar, atau tombol Hapus di formulir Ubah Pengguna).', 'Penghapusan ditolak bila pengguna masih menjadi atasan langsung, PIC Sub Kegiatan tahun berjalan, atau PPK/Pejabat Pengadaan paket yang belum berkontrak; alasannya ditampilkan. Akun sendiri dan Admin aktif terakhir tidak dapat dihapus.', 'Riwayat realisasi, evaluasi, dan log audit tidak diubah dan tetap menyimpan email pengguna yang dihapus.'] },
  { versi: '1.2.7', tanggal: '2026-11-26', catatan: ['Bila server sedang sibuk (kunci tulis dipakai proses lain), simpan/impor dicoba ulang otomatis hingga 2 kali (jeda 4 dan 8 detik). Unggah arsip, simpan template, buat dokumen, dan ganti/reset sandi tidak diulang otomatis.'] },
  { versi: '1.2.6', tanggal: '2026-11-26', catatan: ['Peringatan batas nilai Pengadaan Langsung (Barang/Jasa Lainnya ≤ Rp200 juta, Konstruksi ≤ Rp400 juta, Konsultansi ≤ Rp100 juta) di formulir paket, formulir & detail kontrak, dan Dokumen Disarankan; tidak memblokir simpan.', 'Pemeriksaan dasar hukum mengikuti aturan peralihan PerLKPP 3/2026 Pasal 10: PerLKPP 12/2021 tetap dipakai untuk pemilihan yang sudah berjalan atau kontrak yang sudah ditandatangani sebelum berlaku.', 'Template Kuitansi: kotak meterai Rp10.000 di tanda tangan penerima; Dokumen Disarankan mengingatkan meterai untuk kuitansi di atas Rp5 juta (UU 10/2020).', 'Template Instruksi PPK: lampiran HPS tanpa batas "28 hari kerja" yang tidak ada lagi dasarnya. Template BAST Akhir: tenggat 14 hari kerja hanya untuk pengembalian jaminan pemeliharaan, retensi dibayar sesuai Kontrak (PerLKPP 3/2026 butir 7.2).', 'Surat Penunjukan untuk Pengadaan Langsung: dasar butir 6.1–6.2 & 5.3.3, tanpa catatan perlu verifikasi.'] },
  { versi: '1.2.5', tanggal: '2026-11-26', catatan: ['Halaman Progres untuk Kepala Dinas dan Sekretaris tanpa login: angka ringkasan, serapan per bidang, jumlah paket menurut status per bidang, dan daftar paket yang dapat dibuka untuk melihat tahapan serta realisasi bulanan.', 'Admin mengatur status Ditampilkan/Disembunyikan, bidang, dan bagian di Pengaturan → Halaman Progres. Bila disembunyikan, halaman depan tetap halaman login.', 'Evaluasi triwulanan berjenjang sampai Kepala Bidang: Kepala Dinas dan Sekretaris tidak perlu login; pejabat yang atasannya tidak terdaftar atau nonaktif tidak lagi muncul sebagai belum dinilai.'] },
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
  ROLE: { ADMIN: 'Administrator', PEJABAT: 'Pejabat Struktural / PPK', STAF: 'Staf / Operator', PROGRAM: 'Bagian Program (Monev)' },
  BULAN: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
  BLN: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  HARI: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
  ROMAWI: ['', 'I', 'II', 'III', 'IV'],
  JENIS: [['RKA_DPA', 'RKA / DPA'], ['HPS', 'HPS & Survei Harga'], ['PENETAPAN', 'Penetapan Penyedia'], ['SPK', 'SPK / Kontrak'],
    ['JAMINAN', 'Jaminan Pelaksanaan'], ['SPMK', 'SPMK'], ['LAPORAN', 'Laporan Progres'], ['FOTO', 'Dokumentasi Foto'],
    ['BAPHP', 'BA Pemeriksaan Hasil Pekerjaan'], ['BAPP', 'BA Penyelesaian Pekerjaan (BAPP)'], ['INSTRUKSI', 'Instruksi PPK'], ['SPEK', 'Spesifikasi Teknis'], ['ANALISIS_PASAR', 'Analisis Pasar'], ['BAST', 'BAST'], ['KINERJA', 'Penilaian Kinerja Penyedia'], ['SPM', 'SPM'], ['SP2D', 'SP2D'], ['PAJAK', 'Bukti Pajak'], ['LAINNYA', 'Lainnya']],
  PREDIKAT: { SANGAT_BERHASIL: 'Sangat Berhasil', BERHASIL: 'Berhasil', KURANG_BERHASIL: 'Kurang Berhasil', TIDAK_BERHASIL: 'Tidak Berhasil' },
  PRED_CHIP: { SANGAT_BERHASIL: 'info', BERHASIL: 'ok', KURANG_BERHASIL: 'warn', TIDAK_BERHASIL: 'err' },
  ST_KONTRAK: { DRAF: ['Draf', 'slate'], AKTIF: ['Aktif', 'ok'], SELESAI: ['Selesai', 'info'], PUTUS: ['Putus', 'err'], TERLAMBAT: ['Terlambat', 'err'] },
  ST_REAL: { DRAF: ['Draf', 'slate'], DIAJUKAN: ['Diajukan', 'warn'], TERVERIFIKASI: ['Terverifikasi', 'ok'], DITOLAK: ['Ditolak', 'err'] },
  /** v1.3.0 */
  ST_TL: { CEK_SP2D: ['Cek SP2D', 'err'], MENUNGGU_PENETAPAN: ['Menunggu penetapan', 'warn'], DITERIMA: ['Diterima dengan alasan', 'info'], SELESAI: ['Selesai', 'ok'] },
  VERSI: { MURNI: 'DPA Murni', PERGESERAN: 'DPA Pergeseran', PERUBAHAN: 'DPA Perubahan' },
  ST_VERSI: { AKTIF: ['Aktif', 'ok'], ARSIP: ['Arsip', 'slate'], DIBATALKAN: ['Dibatalkan', 'err'] },
  ST_CL: { LENGKAP: ['Lengkap', 'ok'], BELUM: ['Belum Lengkap', 'warn'], TIDAK_PERLU: ['Tidak Perlu', 'slate'] },
  METODE: ['E-Purchasing / E-Katalog', 'Pengadaan Langsung', 'Penunjukan Langsung', 'Tender Cepat', 'Tender', 'Seleksi', 'Swakelola', 'Lainnya'],
  /** v1.2.9: rincian paket menurut PerLKPP 2/2026 & 3/2026 */
  METODE_EP: [['', '— belum dipilih —'], ['PEMBELIAN_LANGSUNG', 'Pembelian langsung'], ['NEGOSIASI', 'Negosiasi harga'], ['MINI_KOMPETISI', 'Mini kompetisi']],
  KANAL_EP: [['KATALOG', 'Katalog Elektronik'], ['TOKO_DARING', 'Toko Daring (marketplace)']],
  PELAKSANA: { PP: 'Pejabat Pengadaan', POKJA: 'Pokja Pemilihan (melalui UKPBJ)', PPK: 'PPK (melaksanakan sendiri)' },
  TERSEDIA_KATALOG: [['', 'Belum dicek'], ['YA', 'Ya, tersedia di Katalog Elektronik'], ['TIDAK', 'Tidak tersedia']],
  SIFAT_KONSTRUKSI: [['', '— pilih —'], ['PERMANEN', 'Permanen (pemeliharaan ≥ 6 bulan)'], ['SEMI_PERMANEN', 'Semi permanen (pemeliharaan ≥ 3 bulan)']],
  KEYS: { pengguna: 'Email', subkeg: 'ID_SubKeg', kontrak: 'ID_Kontrak', realisasi: 'ID', evaluasi: 'ID', arsip: 'ID_Dokumen',
    checklistMaster: 'Kode', checklist: 'ID', template: 'ID_Template', dokumen: 'ID', pengadaan: 'ID_Paket', pengadaanItem: 'ID', riwayatVersi: 'Versi',
    sp2d: 'ID_SP2D', sp2dRincian: 'ID', versiAnggaran: 'ID_Versi', tindakLanjut: 'ID', paguRek: 'ID', progresKontrak: 'ID' },
  NUM: ['Pagu', 'Target', 'Nilai_Kontrak', 'Realisasi_Fisik', 'Realisasi_Keuangan', 'Bulan', 'Tahun', 'Triwulan', 'Ukuran', 'Urutan',
    'Rencana_TW1', 'Rencana_TW2', 'Rencana_TW3', 'Rencana_TW4', 'Pagu_Paket', 'PPN_Persen', 'Nilai_HPS', 'Jangka_Waktu', 'Volume', 'Harga_Satuan', 'No',
    'Pagu_Sebelum', 'Alokasi_Lalu', 'Alokasi_Depan', 'Jumlah_Rincian', 'Masa_Pemeliharaan_Bulan', 'Nilai', 'Nilai_Total', 'Realisasi', 'Selisih', 'Keuangan_Lama', 'Fisik']
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
const READ = /^(boot|ping|sistem\.status|arsip\.ambil|berkas\.ambil|progres\.publik|dpa\.rincian|versi\.rincian)$/;
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
/** v1.2.7: server menolak dengan kode SIBUK sebelum menulis apa pun (kunci tulis sedang dipakai), jadi aksi tulis boleh diulang.
    Kecuali aksi yang sudah berefek sebelum mengambil kunci (berkas Drive dibuat / sandi diubah). */
const TANPA_ULANG = /^(arsip\.upload|template\.simpan|dokumen\.generate|auth\.gantiSandi|user\.resetSandi)$/;
async function apiTulis(action, data, opts) {
  let r = await apiRun(action, data, opts);
  for (let i = 1; i <= 2 && r && r.code === 'SIBUK' && !TANPA_ULANG.test(action); i++) {
    if (!(opts && opts.quiet)) toast('Server sedang sibuk. Mencoba lagi otomatis (' + i + '/2)…', 'info');
    await new Promise((ok) => setTimeout(ok, 4000 * i));
    r = await apiRun(action, data, opts);
  }
  return r;
}
function api(action, data, opts) {
  if (!READ.test(action)) { _writeEpoch++; return apiTulis(action, data, opts); }
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
  /** v1.3.0: tindak lanjut tanda merah oleh PPK (peran Pejabat) & Admin, sesuai bidang */
  tindakLanjut(sk) { return Can.role('ADMIN', 'PEJABAT') && Can.bidangOk(sk && sk.Bidang); },
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
  /** Pembayaran per kontrak (v1.3.0): SP2D yang ditautkan + realisasi lama yang belum bersumber SP2D; bila sub kegiatan hanya punya 1 kontrak,
      pembayaran tanpa tautan kontrak ikut dihitung untuk kontrak itu. */
  bayarKontrak(k) {
    return Calc.memo('by_' + k.ID_Kontrak, () => Calc.bayarList(k).reduce((a, x) => a + x.nilai, 0));
  },
  bayarList(k) {
    return Calc.memo('bl_' + k.ID_Kontrak, () => {
      const satu = S.t.kontrak.filter((x) => x.ID_SubKeg === k.ID_SubKeg && x.Status !== 'PUTUS').length === 1;
      const cocok = (id) => id === k.ID_Kontrak || (satu && !id);
      const sp = Calc.sp2dRows(k.ID_SubKeg).filter((s) => s.Status !== 'DITOLAK' && cocok(s.ID_Kontrak)).map((s) => ({ bulan: s.Bulan, no: s.No_SP2D, tgl: s.Tgl_SP2D, nilai: num(s.Nilai_Total), status: s.Status, sp2d: true }));
      const lama = Calc.realRows(k.ID_SubKeg).filter((r) => r.Sumber_Keuangan !== 'SP2D' && Calc.counted(r) && num(r.Realisasi_Keuangan) && cocok(r.ID_Kontrak))
        .map((r) => ({ bulan: r.Bulan, no: r.No_SP2D, tgl: r.Tgl_SP2D, nilai: num(r.Realisasi_Keuangan), status: r.Status, sp2d: false }));
      return sp.concat(lama).sort((a, b) => a.bulan - b.bulan || String(a.tgl).localeCompare(String(b.tgl)));
    });
  },
  /* ---------- v1.3.0: SP2D, pagu per kode rekening, tanda merah ---------- */
  sp2dRows(idSk) { return Calc.memo('sp_' + idSk, () => S.t.sp2d.filter((s) => s.ID_SubKeg === idSk).sort((a, b) => String(a.Tgl_SP2D).localeCompare(String(b.Tgl_SP2D)) || String(a.No_SP2D).localeCompare(String(b.No_SP2D)))); },
  sp2dLines(idSp) { return Calc.memo('sl_' + idSp, () => S.t.sp2dRincian.filter((l) => l.ID_SP2D === idSp)); },
  /** Pagu per rekening daun versi aktif: [{Kode_Rekening, Uraian, Pagu, Pagu_Sebelum, Rutin}] */
  rekPagu(idSk) { return Calc.memo('rp_' + idSk, () => S.t.paguRek.filter((r) => r.ID_SubKeg === idSk)); },
  /** Realisasi SP2D aktif (bukan ditolak) per kode rekening */
  rekReal(idSk) {
    return Calc.memo('rr2_' + idSk, () => {
      const aktif = {}; Calc.sp2dRows(idSk).forEach((s) => { if (s.Status !== 'DITOLAK') aktif[s.ID_SP2D] = 1; });
      const o = {}; S.t.sp2dRincian.forEach((l) => { if (aktif[l.ID_SP2D]) o[l.Kode_Rekening] = (o[l.Kode_Rekening] || 0) + num(l.Nilai); }); return o;
    });
  },
  /** Bulan dengan realisasi lama yang belum dipetakan ke SP2D: [{row, sisa}] */
  belumPeta(idSk) {
    return Calc.memo('bp_' + idSk, () => Calc.realRows(idSk).map((r) => {
      const sisa = r.Sumber_Keuangan === 'SP2D' ? Math.max(0, num(r.Keuangan_Lama) - num(r.Realisasi_Keuangan)) : num(r.Realisasi_Keuangan);
      return { row: r, sisa, lama: r.Sumber_Keuangan === 'SP2D' ? num(r.Keuangan_Lama) : num(r.Realisasi_Keuangan) };
    }).filter((x) => x.sisa > 0.5 && x.row.Status !== 'DITOLAK'));
  },
  tlBuka(r) { return r.Status === 'CEK_SP2D' || r.Status === 'MENUNGGU_PENETAPAN'; },
  /** Tindak lanjut terbuka yang terlihat pengguna (Admin/PROGRAM/PPK bidang 'Semua' = semua; lainnya bidangnya) */
  tlLihat(r) { return Can.role('ADMIN', 'PROGRAM') || Can.bidangOk((Store.get('subkeg', r.ID_SubKeg) || {}).Bidang); },
  tlTerbuka() { return Calc.memo('tlb', () => S.t.tindakLanjut.filter((r) => Calc.tlBuka(r) && Calc.tlLihat(r))); },
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
  /* ---------- v1.4.0: progres fisik per kontrak (sama dengan server fisikOtomatis_) ---------- */
  progresK(idK) { return Calc.memo('pk_' + idK, () => S.t.progresKontrak.filter((p) => p.ID_Kontrak === idK).sort((a, b) => a.Bulan - b.Bulan)); },
  /** Fisik kumulatif kontrak s.d. bulan b (bawaan 12): { fisik, bulan } — bulan 0 = belum ada progres */
  fisikK(idK, b) { let v = 0, bm = 0; Calc.progresK(idK).forEach((p) => { if (p.Bulan <= (b || 12) && p.Bulan >= bm) { bm = p.Bulan; v = num(p.Fisik); } }); return { fisik: v, bulan: bm }; },
  bobotK(k) { return ['AKTIF', 'SELESAI', 'PUTUS'].indexOf(k.Status) > -1 && num(k.Nilai_Kontrak) > 0; },
  /** Fisik Sub Kegiatan otomatis bulan b: { nilai, rincian: [{ k, fisik, bobot }], m0 } atau null bila bulan itu diisi manual */
  fisikAuto(sk, b) {
    const rows = S.t.progresKontrak.filter((p) => p.ID_SubKeg === sk.ID_SubKeg);
    if (!rows.length) return null;
    const m0 = Math.min.apply(null, rows.map((p) => p.Bulan));
    if (b < m0) return null;
    const ks = S.t.kontrak.filter((k) => k.ID_SubKeg === sk.ID_SubKeg && Calc.bobotK(k)), tot = ks.reduce((a, k) => a + num(k.Nilai_Kontrak), 0);
    if (!tot) return null;
    const rincian = ks.map((k) => ({ k, fisik: Calc.fisikK(k.ID_Kontrak, b).fisik, bobot: num(k.Nilai_Kontrak) / tot * 100 }));
    const s = ks.reduce((a, k, i) => a + num(k.Nilai_Kontrak) * rincian[i].fisik, 0);
    return { nilai: Math.round(s / tot * 100) / 100, rincian, m0 };
  },
  /** Kode rekening pertama paket yang ada di pagu rekening Sub Kegiatan */
  rekPaket(p) {
    if (!p) return '';
    const kode = String(p.Kode_Rekening || '').split(/[,;\n]+/).map((x) => x.replace(/\s+/g, '')).filter(Boolean), ada = Calc.rekPagu(p.ID_SubKeg).map((r) => r.Kode_Rekening);
    return kode.find((x) => ada.indexOf(x) > -1) || kode[0] || '';
  },
  /** Pembayaran yang DITAUTKAN ke kontrak (SP2D dengan ID_Kontrak ini + realisasi lama bertaut) — dasar pemeriksaan fisik vs pembayaran */
  bayarTaut(k) {
    return Calc.memo('bt_' + k.ID_Kontrak, () => {
      const sp = Calc.sp2dRows(k.ID_SubKeg).filter((s) => s.Status !== 'DITOLAK' && s.ID_Kontrak === k.ID_Kontrak);
      const lama = Calc.realRows(k.ID_SubKeg).filter((r) => r.Sumber_Keuangan !== 'SP2D' && Calc.counted(r) && num(r.Realisasi_Keuangan) && r.ID_Kontrak === k.ID_Kontrak);
      return { n: sp.length, nilai: sp.reduce((a, s) => a + num(s.Nilai_Total), 0) + lama.reduce((a, r) => a + num(r.Realisasi_Keuangan), 0),
        lain: Calc.sp2dRows(k.ID_SubKeg).filter((s) => s.Status !== 'DITOLAK' && !s.ID_Kontrak).length };
    });
  },
  /** Ringkasan pemeriksaan fisik & keuangan satu kontrak (Kesiapan Audit) */
  periksaK(k) {
    return Calc.memo('pf_' + k.ID_Kontrak, () => {
      const nilai = num(k.Nilai_Kontrak), fk = Calc.fisikK(k.ID_Kontrak), sk = Store.get('subkeg', k.ID_SubKeg);
      const fisik = fk.bulan ? fk.fisik : (sk ? Calc.sk(sk, 12).fisik : 0);
      const bt = Calc.bayarTaut(k), bayar = bt.nilai, bayarPct = nilai ? bayar / nilai * 100 : 0, st = Calc.kontrakStatus(k), temuan = [];
      if (k.Status !== 'DRAF' && bayarPct > fisik + 0.5) temuan.push(['err', `Pembayaran ${pct(bayarPct)} melebihi progres fisik ${pct(fisik)}. Periksa dasar pembayaran (berita acara kemajuan pekerjaan).`]);
      /* v1.4.1: rujukan pemberian kesempatan & denda keterlambatan menurut lampiran PerLKPP 3/2026 */
      const pq = k.ID_Paket ? Store.get('pengadaan', k.ID_Paket) : null, jn = pq ? pq.Jenis_Pengadaan : '', L = Aturan.lamp(jn, Aturan.rb(pq));
      const denda = `denda keterlambatan 1‰ per hari dari harga Kontrak atau bagian Kontrak${L.L === 'II' ? ' (sebelum PPN)' : ''}`;
      const kesempatan = `Bila Penyedia diberi kesempatan, adendumnya dibuat sebelum masa pelaksanaan berakhir (paling lama 50 hari kalender; jaminan pelaksanaan diperpanjang bila ada) dan dikenai ${denda} (${L.nama} butir ${L.kesempatan} & ${L.denda}${jn ? '' : '; jenis pengadaan tidak diketahui, dianggap Lampiran I'}).`;
      if (k.Tgl_BAST && k.Tgl_Selesai && k.Tgl_BAST > k.Tgl_Selesai) temuan.push(['warn', `BAST ${tgl(k.Tgl_BAST)} melewati akhir kontrak ${tgl(k.Tgl_Selesai)} (${daysBetween(k.Tgl_Selesai, k.Tgl_BAST)} hari). Periksa adendum pemberian kesempatan dan ${denda} (${L.nama} butir ${L.kesempatan} & ${L.denda}).`]);
      if (!k.Tgl_BAST && st === 'TERLAMBAT') temuan.push(['warn', `Masa kontrak berakhir ${tgl(k.Tgl_Selesai)} (${daysBetween(k.Tgl_Selesai, todayISO())} hari lalu) dan BAST belum tercatat. ${kesempatan}`]);
      if (k.Status === 'SELESAI' && !k.Tgl_BAST) temuan.push(['warn', 'Status Selesai tetapi tanggal BAST belum diisi di data kontrak.']);
      if (k.Status !== 'PUTUS' && k.Status !== 'SELESAI' && fisik >= 100 && !k.Tgl_BAST) temuan.push(['info', 'Fisik sudah 100% tetapi BAST belum tercatat.']);
      if (k.Status === 'PUTUS') temuan.push(['warn', `Kontrak diputus: prestasi fisik ${pct(fisik)}, dibayar ${pct(bayarPct)}. Pastikan pembayaran sesuai prestasi dan sanksi sudah diproses.`]);
      if (k.Status !== 'DRAF' && !fk.bulan) temuan.push(['info', 'Progres fisik kontrak ini belum dicatat; angka fisik memakai realisasi Sub Kegiatan.']);
      if (k.Status !== 'DRAF' && !bt.n && bt.lain) temuan.push(['info', `Belum ada SP2D yang ditautkan ke kontrak ini (${bt.lain} SP2D Sub Kegiatan tanpa kontrak). Bila ada yang merupakan pembayaran kontrak ini, tautkan agar pemeriksaan pembayaran akurat.`]);
      return { nilai, fisik, bulanFisik: fk.bulan, bayar, bayarPct, selisih: bayarPct - fisik, sisa: nilai - bayar, temuan, st };
    });
  },
  /** Data yang sudah tercatat di aplikasi untuk satu jenis dokumen checklist ('' = tidak ada data) */
  dataCek(k, jenis) {
    const sk = Store.get('subkeg', k.ID_SubKeg), p = k.ID_Paket ? Store.get('pengadaan', k.ID_Paket) : null;
    switch (jenis) {
      case 'RKA_DPA': return sk && (sk.Jenis_Versi || num(sk.Jumlah_Rincian)) ? (K.VERSI[sk.Jenis_Versi] || 'Rincian DPA') + (sk.Tgl_Penetapan ? ' ditetapkan ' + tgl(sk.Tgl_Penetapan) : ' tercatat') : '';
      case 'HPS': return p && num(p.Nilai_HPS) ? 'HPS paket ' + rp(p.Nilai_HPS) : '';
      case 'PENETAPAN': return k.Status !== 'DRAF' && k.Penyedia ? 'Penyedia: ' + k.Penyedia : '';
      case 'SPK': return k.No_SPK ? k.No_SPK + (k.Tgl_SPK ? ' · ' + tgl(k.Tgl_SPK) : '') : '';
      case 'SPMK': return k.Tgl_SPMK ? 'SPMK ' + tgl(k.Tgl_SPMK) : '';
      case 'LAPORAN': { const pr = Calc.progresK(k.ID_Kontrak); return pr.length ? `Progres ${pr.length} bulan, terakhir ${pct(num(pr[pr.length - 1].Fisik))} (${K.BULAN[pr[pr.length - 1].Bulan - 1]})` : ''; }
      case 'BAPHP': return k.Tgl_BAPHP ? 'BA pemeriksaan ' + tgl(k.Tgl_BAPHP) : '';
      case 'BAST': return k.Tgl_BAST ? 'BAST ' + tgl(k.Tgl_BAST) : '';
      case 'SPM': case 'SP2D': { const bt = Calc.bayarTaut(k); return bt.n ? `${bt.n} SP2D tertaut · ${rp(bt.nilai)}` : ''; }
      default: return '';
    }
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
      const tSp = S.t.sp2d.filter((r) => r.Status === 'DIAJUKAN' && (Can.admin() ? true : mySk.some((s) => s.ID_SubKeg === r.ID_SubKeg)));
      if (tSp.length) a.push({ t: 'warn', i: 'verified', h: tSp.length + ' SP2D menunggu verifikasi', s: 'Periksa nomor, tanggal, dan rincian kode rekening SP2D.', go: '#/realisasi?tab=verif' });
      if (Can.role('ADMIN', 'PEJABAT')) { const tl = Calc.tlTerbuka(); if (tl.length) a.push({ t: 'err', i: 'flag', h: tl.length + ' rekening melebihi pagu aktif', s: 'Tindak lanjut PPK: cek SP2D atau tunggu penetapan berikutnya.', go: '#/tindaklanjut' }); }
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

/** v1.3.0: rekening belanja rutin (Pengaturan REKENING_RUTIN) — pola kode = awalan kode, selain itu potongan uraian */
const Rutin = {
  pola() { return String((S.settings && S.settings.REKENING_RUTIN) || '').split(/[;\n]/).map((x) => x.trim()).filter(Boolean); },
  cocok(kode, uraian) {
    kode = String(kode || '').trim(); const u = String(uraian || '').toLowerCase();
    return Rutin.pola().some((p) => (/^\d+(\.\d+)*$/.test(p) ? kode === p || kode.indexOf(p + '.') === 0 : !!u && u.indexOf(p.toLowerCase()) > -1));
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
   ALUR TERHUBUNG (v1.4.0): Perencanaan → Pengadaan → Kontrak → Realisasi → Evaluasi → Kesiapan Audit
   Pilihan aktif (Sub Kegiatan → Rekening → Paket → Kontrak → Bulan) disimpan per pengguna & tahun,
   tampil sebagai jejak di atas tiap halaman alur, dan dibaca halaman lain sebagai pilihan bawaan.
   ===================================================================== */
const Alur = {
  TAHAP: [['perencanaan', 'Perencanaan'], ['pengadaan', 'Pengadaan'], ['kontrak', 'Kontrak'], ['realisasi', 'Realisasi'], ['evaluasi', 'Evaluasi'], ['checklist', 'Kesiapan Audit']],
  key() { return 'sp_alur_' + (S.me ? norm(S.me.email) : 'x') + '_' + S.tahun; },
  get() {
    const s = Object.assign({ sk: '', rek: '', paket: '', kontrak: '', bulan: 0 }, LS.get(this.key(), {}) || {});
    if (s.sk && !Store.get('subkeg', s.sk)) { s.sk = ''; s.rek = ''; s.paket = ''; s.kontrak = ''; }
    if (s.paket && !Store.get('pengadaan', s.paket)) s.paket = '';
    if (s.kontrak && !Store.get('kontrak', s.kontrak)) s.kontrak = '';
    s.bulan = Number(s.bulan) || 0;
    return s;
  },
  /** Ubah pilihan; Sub Kegiatan lain → rekening/paket/kontrak dikosongkan dulu */
  set(o) {
    const s = this.get();
    if (o.sk !== undefined && o.sk !== s.sk) { s.rek = ''; s.paket = ''; s.kontrak = ''; }
    Object.keys(o).forEach((k) => { if (o[k] !== undefined && o[k] !== null) s[k] = o[k]; });
    LS.set(this.key(), s);
    return s;
  },
  reset() { LS.del(this.key()); },
  /** Pilih kontrak beserta Sub Kegiatan, paket, dan rekening paketnya */
  pilihKontrak(k) {
    if (!k) return;
    const p = k.ID_Paket ? Store.get('pengadaan', k.ID_Paket) : null, s = this.get();
    this.set({ sk: k.ID_SubKeg });
    this.set({ kontrak: k.ID_Kontrak, paket: k.ID_Paket || '', rek: (s.sk === k.ID_SubKeg && s.rek) || Calc.rekPaket(p) });
  },
  pilihPaket(p) {
    if (!p) return;
    this.set({ sk: p.ID_SubKeg });
    this.set({ paket: p.ID_Paket, kontrak: p.ID_Kontrak || '', rek: Calc.rekPaket(p) });
  },
  href(id) {
    const s = this.get();
    if (id === 'perencanaan') return s.sk ? '#/perencanaan?sk=' + encodeURIComponent(s.sk) : '#/perencanaan';
    if (id === 'pengadaan') return s.paket ? '#/pengadaan?id=' + encodeURIComponent(s.paket) : '#/pengadaan';
    if (id === 'kontrak') return s.kontrak ? '#/kontrak?id=' + encodeURIComponent(s.kontrak) : '#/kontrak';
    if (id === 'realisasi') return s.sk ? '#/realisasi?sk=' + encodeURIComponent(s.sk) : '#/realisasi';
    if (id === 'checklist') return s.kontrak ? '#/checklist?k=' + encodeURIComponent(s.kontrak) : '#/checklist';
    return '#/' + id;
  },
  bisa(id) { const p = Pages.map[id]; return !!p && (!p.roles || Can.role(...p.roles)); },
  /** Jejak pilihan aktif + tahapan; cur = id halaman saat ini */
  bar(cur) {
    const s = this.get(), tahap = this.TAHAP.filter((x) => this.bisa(x[0])), i = tahap.findIndex((x) => x[0] === cur);
    const sk = s.sk ? Store.get('subkeg', s.sk) : null, p = s.paket ? Store.get('pengadaan', s.paket) : null, k = s.kontrak ? Store.get('kontrak', s.kontrak) : null;
    const rek = s.rek && sk ? (Calc.rekPagu(sk.ID_SubKeg).find((r) => r.Kode_Rekening === s.rek) || { Kode_Rekening: s.rek, Uraian: '' }) : null;
    const c = (lbl, val, href, title) => `<a class="alur-c" href="${href}" title="${esc(title || val)}"><span>${esc(lbl)}</span><b>${esc(val)}</b></a>`;
    const jejak = [];
    if (sk) jejak.push(c('Sub Kegiatan', sk.Kode_SubKeg, this.href('perencanaan'), sk.Kode_SubKeg + ' ' + sk.Nama_SubKegiatan));
    if (rek) jejak.push(c('Rekening', rek.Kode_Rekening, '#/realisasi?sk=' + encodeURIComponent(sk.ID_SubKeg) + '&tab=sp2d', rek.Kode_Rekening + ' ' + (rek.Uraian || '')));
    if (p) jejak.push(c('Paket', p.Nama_Paket.length > 34 ? p.Nama_Paket.slice(0, 32) + '…' : p.Nama_Paket, this.href('pengadaan'), p.Nama_Paket));
    if (k) jejak.push(c('Kontrak', k.No_SPK || k.Uraian_Pekerjaan || k.ID_Kontrak, this.href('kontrak'), (k.No_SPK || '') + ' ' + (k.Uraian_Pekerjaan || '')));
    if (s.bulan) jejak.push(c('Bulan', K.BULAN[s.bulan - 1], this.href('realisasi')));
    const lanjut = i > -1 && i < tahap.length - 1 ? tahap[i + 1] : null;
    return `<nav class="alur no-print" aria-label="Alur pemantauan" data-alur>
      <ol class="alur-tahap">${tahap.map((x, j) => `<li class="${j === i ? 'on' : j < i ? 'lewat' : ''}"><a href="${this.href(x[0])}"${j === i ? ' aria-current="step"' : ''}><span class="n">${j + 1}</span><span class="t">${esc(x[1])}</span></a></li>`).join('')}</ol>
      <div class="alur-jejak">${jejak.length ? `<span class="alur-l">Pilihan aktif</span>${jejak.join('<span class="alur-s">›</span>')}<button type="button" class="btn sm ghost" data-alur-reset title="Kosongkan pilihan aktif">${ic('close', 'sm')}Kosongkan</button>`
        : `<span class="alur-l">Belum ada pilihan aktif.</span><span class="mini">Mulai dari Perencanaan: buka satu Sub Kegiatan, lalu ikuti tombol Lanjut.</span>`}
        ${lanjut ? `<a class="btn sm pri alur-go" href="${this.href(lanjut[0])}" data-alur-lanjut>Lanjut ke ${esc(lanjut[1])} ${ic('right', 'sm')}</a>` : ''}</div>
    </nav>`;
  }
};
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-alur-reset]');
  if (b) { e.preventDefault(); Alur.reset(); App.refresh(); return; }
  /* tautan yang sekaligus memilih Sub Kegiatan/kontrak (mis. dari Evaluasi) */
  const a = e.target.closest && e.target.closest('[data-alur-sk],[data-alur-k]');
  if (a) { const k = a.getAttribute('data-alur-k'); if (k) Alur.pilihKontrak(Store.get('kontrak', k)); else Alur.set({ sk: a.getAttribute('data-alur-sk') }); }
}, true);

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
    this._masuk = false; Progres.tutup();
    $('#appShell').classList.add('hidden'); $('#loginScreen').classList.remove('hidden');
    this.tautanProgres();
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
  /** Tautan "Kembali ke halaman progres" di kartu login (v1.2.5) */
  tautanProgres() { const a = $('#lgProgres'); if (a) a.classList.toggle('hidden', !(Progres.data && Progres.data.aktif)); },
  async enter() {
    Progres.tutup();
    $('#loginScreen').classList.add('hidden'); $('#appShell').classList.remove('hidden');
    if (this._masuk && S.me) { this.render(); return; }
    this._masuk = true;
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
    addEventListener('hashchange', () => {
      if (Progres.rute()) { Progres.tampil(); return; }
      if (Progres.on) { Progres.tutup(); if (Auth.token && Auth.me) this.enter(); else this.showLogin(); return; }
      this.render();
    });
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
    $('#lgProgres').onclick = (e) => { e.preventDefault(); Progres.pilihLogin = false; Progres.tampil(true); };
    // PWA install
    let deferred = null;
    addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('#installBtn').style.display = ''; });
    $('#installBtn').onclick = async () => { if (!deferred) return; deferred.prompt(); const c = await deferred.userChoice; if (c.outcome === 'accepted') $('#installBtn').style.display = 'none'; deferred = null; };
    if ('serviceWorker' in navigator && location.protocol !== 'file:') addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    if (!navigator.onLine) $('#offlineBar').classList.remove('hidden');
    // Mulai
    if (Progres.rute()) Progres.tampil();
    else if (Auth.token && Auth.me) this.enter();
    else Progres.depan();
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
   ATURAN PBJ — v1.2.9: dicocokkan dengan naskah PerLKPP 2/2026 (Katalog Elektronik, seluruh pasal) dan
   PerLKPP 3/2026 (Pasal 2, 10–12; Lampiran I barang/jasa lainnya & konsultansi nonkonstruksi, Lampiran II
   konstruksi & konsultansi konstruksi, Lampiran III konstruksi terintegrasi rancang dan bangun).
   Perpres 16/2018 s.t.d.t.d. Perpres 46/2025: Pasal 26 ayat (7), Pasal 28, Pasal 33, Pasal 38.
   v1.4.1: jaminan pelaksanaan semua metode (Perpres Pasal 33) + besarannya; dasar checklist C03 & C05–C10;
   rujukan pemberian kesempatan & denda (Lampiran I butir 6.19–6.20, II 6.20–6.21, III 6.18–6.19).
   v1.4.2: butir checklist penilaian kinerja Penyedia (Perpres Pasal 11 ayat (1) huruf m; PerLKPP 3/2026 Lampiran I–III bab VIII).
   Semua keluaran adalah PETUNJUK/peringatan untuk PPK; tidak memblokir simpan.
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
    /* v1.4.1: dasar C03, C05–C10 dicocokkan dengan naskah Perpres 46/2025 & PerLKPP 3/2026 */
    PENETAPAN: { item: '', lama: '', dasar: 'PerLKPP 3/2026 Lampiran I–III bab III–V (pemilihan Penyedia) & butir 6.1–6.2 (reviu BA hasil pemilihan, surat penunjukan Penyedia); E-purchasing: PerLKPP 2/2026 Pasal 14–17' },
    JAMINAN: { item: '', lama: '', dasar: 'Perpres 16/2018 s.t.d.t.d. Perpres 46/2025 Pasal 33 (kontrak barang/pekerjaan konstruksi/jasa lainnya > Rp200 juta, semua metode; 5% nilai Kontrak, atau 5% HPS bila penawaran < 80% HPS; berlaku sampai serah terima); E-purchasing: PerLKPP 2/2026 Pasal 20' },
    SPMK: { item: '', lama: '', dasar: 'PerLKPP 3/2026 Lampiran I butir 6.5 (SPMK/Surat Perintah Pengiriman paling lambat 14 hari kalender setelah kontrak), Lampiran II butir 6.5, Lampiran III butir 6.6' },
    LAPORAN: { item: '', lama: '', dasar: 'Ketentuan Kontrak; PerLKPP 3/2026 Lampiran I butir 6.8 huruf d–e (cara & frekuensi pelaporan disepakati pada rapat persiapan pelaksanaan Kontrak) & 6.11; Lampiran II butir 6.11.1 huruf a angka 5 (laporan berkala pengawas); Lampiran III butir 6.17' },
    FOTO: { item: '', lama: '', dasar: 'Ketentuan Kontrak/permintaan pemeriksa — PerLKPP 3/2026 tidak mengatur dokumentasi foto progres secara khusus' },
    BAPHP: { item: '', lama: '', dasar: 'PerLKPP 3/2026 Lampiran I butir 7.1.1 huruf b–d, Lampiran II butir 7.1 huruf b–d (pemeriksaan hasil pekerjaan sebelum serah terima); Lampiran III butir 7.1 (syarat serah terima pertama)' },
    BAST: { item: '', lama: '', dasar: 'PerLKPP 3/2026 Lampiran I butir 7.1.1 huruf e & 7.2 huruf h (serah terima akhir); Lampiran II & III butir 7.1 (serah terima pertama) & 7.3 (serah terima akhir); kepada PA/KPA: Lampiran I butir 7.1.2, Lampiran II & III butir 7.4' },
    /* v1.4.2: butir baru — bila master belum punya butir berjenis ini, tombol Isi dasar regulasi menambahkannya (baru = isi baris) */
    KINERJA: { item: '', lama: '', dasar: 'Perpres 16/2018 s.t.d.t.d. Perpres 46/2025 Pasal 11 ayat (1) huruf m (PPK menilai kinerja Penyedia); PerLKPP 3/2026 Lampiran I, II & III bab VIII (PPK/pejabat penandatangan Kontrak wajib memberikan penilaian kinerja Penyedia dalam sistem pengadaan secara elektronik; tata cara mengikuti PerLKPP tentang Pembinaan Pelaku Usaha)',
      baru: { Tahapan: 'Serah Terima', Item: 'Penilaian kinerja Penyedia di sistem pengadaan secara elektronik' } }
  },
  epur(metode) { return /purchasing|katalog/i.test(String(metode || '')); },
  /** v1.2.9: jasa konsultansi (nonkonstruksi atau konstruksi) */
  kons(j) { return j === 'KONSULTANSI' || j === 'KONSULTANSI_KONSTRUKSI'; },
  /** v1.2.9: Pengaturan → Umum → Wilayah Papua (batas nilai percepatan pembangunan Papua) */
  papua() { try { return String(((typeof S !== 'undefined' && S.settings) || {}).WILAYAH_PAPUA || '').toUpperCase() === 'YA'; } catch (e) { return false; } },
  /** v1.2.9: pekerjaan konstruksi terintegrasi rancang dan bangun (PerLKPP 3/2026 Lampiran III) */
  rb(p) { return !!p && p.Jenis_Pengadaan === 'KONSTRUKSI' && String(p.Rancang_Bangun || '').toUpperCase() === 'YA'; },
  /** v1.2.9: label rupiah ringkas untuk batas nilai */
  jt(x) { return x >= 1e9 ? 'Rp' + fmtN(x / 1e9) + ' miliar' : 'Rp' + fmtN(x / 1e6) + ' juta'; },
  /** v1.2.9: lampiran PerLKPP 3/2026 dan nomor butir yang dirujuk (dicocokkan dengan naskah) */
  lamp(jenis, rb) {
    const L = rb ? 'III' : (jenis === 'KONSTRUKSI' || jenis === 'KONSULTANSI_KONSTRUKSI') ? 'II' : 'I';
    const B = {
      I: { spes: '2.1', harga: '2.2', bentuk: '2.3.4', tunjuk: '6.1–6.2', kontrak: '6.3', lokasi: '6.4', spmk: '6.5', bast: '7.1', akhir: '7.2', jam: '7.2 huruf j', pl: '5.3.3', pel: '1.4', kesempatan: '6.19', denda: '6.20' },
      II: { spes: '2.1', harga: '2.2', bentuk: '2.3.4', tunjuk: '6.1–6.2', kontrak: '6.3', lokasi: '6.4', spmk: '6.5', bast: '7.1', akhir: '7.2 & 7.3', jam: '7.2 huruf j', pl: '5.3.3', pel: '1.4', kesempatan: '6.20', denda: '6.21' },
      III: { spes: '2.1', harga: '2.2', bentuk: '2.3.2.2', tunjuk: '6.1–6.2', kontrak: '6.3–6.4', lokasi: '6.5', spmk: '6.6', bast: '7.1', akhir: '7.2 & 7.3', jam: '7.2 huruf k', pl: '', pel: '1.4', kesempatan: '6.18', denda: '6.19' }
    }[L];
    return Object.assign({ L, nama: 'PerLKPP 3/2026 Lampiran ' + L }, B);
  },
  /** v1.2.9: nilai acuan paket untuk keputusan sebelum kontrak (HPS/Referensi Harga, pelaksana, batas metode): HPS tersimpan, bila belum ada pagu.
      Nilai kontrak sengaja TIDAK dipakai: dokumen harga dan pelaksana ditetapkan sebelum kontrak; bentuk kontrak & jaminan memakai nilai kontrak. */
  nilaiPaket(p) { return p ? num(p.Nilai_HPS) || num(p.Pagu_Paket) : 0; },
  /** Dokumen harga paket: HPS, Referensi Harga, atau Pagu Pekerjaan (rancang dan bangun). bebas = tidak wajib ditetapkan. */
  harga(p) {
    p = p || {}; const nilai = this.nilaiPaket(p), ep = this.epur(p.Metode), kec = 'PerLKPP 2/2026 Pasal 13 ayat (3)';
    if (this.rb(p)) return { kode: 'PAGU', nama: 'Pagu Pekerjaan Rancang dan Bangun', judul: 'PAGU PEKERJAAN KONSTRUKSI TERINTEGRASI RANCANG DAN BANGUN', singkat: 'Pagu Pekerjaan', dasar: 'PerLKPP 3/2026 Lampiran III butir 2.2', bebas: false,
      ket: 'Pekerjaan konstruksi terintegrasi rancang dan bangun tidak memakai HPS: PPK menetapkan pagu pekerjaan berdasarkan reviu pagu anggaran oleh konsultan manajemen konstruksi atau tim teknis.' };
    const tetap = ep && p.Metode_EP === 'PEMBELIAN_LANGSUNG' && String(p.Harga_Tetap || '').toUpperCase() === 'YA';
    if (ep && nilai > 0 && nilai <= 100e6) return { kode: 'REF', nama: 'Referensi Harga', judul: 'REFERENSI HARGA', singkat: 'Referensi Harga', dasar: 'PerLKPP 2/2026 Pasal 13 ayat (2)', bebas: tetap,
      ket: tetap ? 'Pembelian langsung produk berharga tetap: Referensi Harga tidak perlu disiapkan (' + kec + ').'
        : 'E-purchasing bernilai paling banyak Rp100 juta: PPK menyiapkan Referensi Harga, bukan HPS. Tidak diperlukan untuk pembelian langsung produk berharga tetap (' + kec + ').' };
    const r = { kode: 'HPS', nama: 'Harga Perkiraan Sendiri (HPS)', judul: 'HARGA PERKIRAAN SENDIRI', singkat: 'HPS', dasar: ep ? 'PerLKPP 2/2026 Pasal 13 ayat (1)' : this.PERPRES + ' Pasal 26', ket: '', bebas: false };
    if (ep) { r.bebas = tetap; r.ket = tetap ? 'Pembelian langsung produk berharga tetap: HPS tidak perlu ditetapkan (' + kec + ').' : 'E-purchasing di atas Rp100 juta: PPK menetapkan HPS. Tidak diperlukan untuk pembelian langsung produk berharga tetap (' + kec + ').'; }
    else if (num(p.Pagu_Paket) > 0 && num(p.Pagu_Paket) <= 10e6) { r.bebas = true; r.ket = 'Pagu paling banyak Rp10 juta: penyusunan HPS dikecualikan (' + this.PERPRES + ' Pasal 26 ayat (7)).'; }
    return r;
  },
  /** Bentuk kontrak (Perpres Pasal 28; PerLKPP 3/2026 butir 2.3.4). jenis = kode PK.JENIS; kosong → dianggap Barang/Jasa Lainnya. p = paket (opsional, untuk rancang dan bangun). */
  bentukKontrak(nilai, jenis, metode, p) {
    const n = num(nilai), P = this.PERPRES + ' Pasal 28';
    if (/swakelola/i.test(metode || '')) return null;
    if (p && this.rb(p)) return { bentuk: 'Surat perjanjian', dasar: 'PerLKPP 3/2026 Lampiran III butir 2.3.2.2', ket: 'bentuk kontrak pekerjaan konstruksi terintegrasi rancang dan bangun' };
    if (this.epur(metode)) return { bentuk: 'Surat/Bukti Pesanan', dasar: P + ' ayat (6); PerLKPP 2/2026 Pasal 19', ket: 'ditandatangani PPK dan Penyedia secara elektronik melalui sistem Katalog Elektronik' };
    if (!(n > 0)) return null;
    const o = (bentuk, ay) => ({ bentuk, dasar: P + ' ayat ' + ay, ket: jenis ? '' : 'jenis pengadaan belum diketahui, dianggap Barang/Jasa Lainnya' });
    if (this.kons(jenis)) return n <= 100e6 ? o('Surat Perintah Kerja (SPK)', '(4)') : o('Surat perjanjian', '(5)');
    if (jenis === 'KONSTRUKSI') return n <= 400e6 ? o('Surat Perintah Kerja (SPK)', '(4)') : o('Surat perjanjian', '(5)');
    if (n <= 10e6) return o('Bukti pembelian/pembayaran atau kuitansi', '(2)–(3)');
    if (n <= 50e6) return o('Kuitansi', '(3)');
    if (n <= 200e6) return o('Surat Perintah Kerja (SPK)', '(4)');
    return o('Surat perjanjian', '(5)');
  },
  /** v1.4.1: jaminan pelaksanaan untuk SEMUA metode pemilihan Penyedia — Perpres 16/2018 s.t.d.t.d. Perpres 46/2025 Pasal 33
      (E-purchasing juga PerLKPP 2/2026 Pasal 20). Kontrak barang/pekerjaan konstruksi/jasa lainnya di atas Rp200 juta;
      jasa konsultansi, swakelola, dan metode "Lainnya" tidak dinilai (null).
      Besaran (Pasal 33 ayat (3)–(4)): penawaran 80–100% HPS → 5% nilai Kontrak; di bawah 80% HPS → 5% HPS
      (pekerjaan terintegrasi/rancang dan bangun: pagu anggaran). Aturannya memakai nilai penawaran; di sini nilai kontrak
      dipakai sebagai pendekatan. Masa berlaku sampai serah terima (konstruksi: serah terima pertama) — ayat (5).
      p = paket (opsional) untuk HPS/pagu. Hasil { wajib, besar, basis: 'KONTRAK'|'HPS'|'PAGU'|'', masa, rincian, teks, dasar }. */
  jaminan(nilai, jenis, metode, p) {
    const n = num(nilai), m = String(metode || '');
    if (!(n > 0) || this.kons(jenis) || /swakelola|lainnya/i.test(m)) return null;
    const P = this.PERPRES + ' Pasal 33', ep = this.epur(m);
    if (n <= 200e6) return { wajib: false, besar: 0, basis: '', masa: '', rincian: '', teks: 'Jaminan pelaksanaan tidak disyaratkan: nilai kontrak paling banyak Rp200 juta.',
      dasar: P + ' ayat (1)' + (ep ? '; PerLKPP 2/2026 Pasal 20 ayat (1)' : '') };
    const rb = this.rb(p), acuan = p ? (rb ? num(p.Pagu_Paket) : num(p.Nilai_HPS)) : 0, nmA = rb ? 'pagu anggaran' : 'HPS';
    let besar = Math.round(n * 0.05), basis = 'KONTRAK', bes;
    if (acuan > 0) {
      const r = n / acuan * 100;
      if (r < 80) { besar = Math.round(acuan * 0.05); basis = rb ? 'PAGU' : 'HPS'; bes = 'Besarnya 5% dari ' + nmA + ' = ' + rp(besar) + ' (nilai kontrak ' + fmtN(r, 1) + '% dari ' + nmA + ', di bawah 80%).'; }
      else bes = 'Besarnya 5% dari nilai Kontrak = ' + rp(besar) + ' (nilai kontrak ' + fmtN(r, 1) + '% dari ' + nmA + ').';
    } else bes = 'Besarnya 5% dari nilai Kontrak = ' + rp(besar) + ' bila penawaran 80–100% ' + nmA + '; bila di bawah 80%, 5% dari ' + nmA + ' (' + nmA + ' paket belum tercatat).';
    const kec = jenis === 'JASA_LAINNYA' || !jenis ? ' Tidak diperlukan untuk jasa lainnya yang aset Penyedia dikuasai pengguna.' : '';
    const masa = 'Berlaku sampai serah terima ' + (jenis === 'KONSTRUKSI' ? 'pertama pekerjaan konstruksi.' : 'pekerjaan.');
    return { wajib: true, besar, basis, masa, rincian: bes + kec,
      teks: 'Jaminan pelaksanaan diberlakukan (nilai kontrak di atas Rp200 juta). ' + masa + ' ' + bes + kec + (jenis ? '' : ' Jenis pengadaan belum diketahui, dianggap Barang/Jasa Lainnya.'),
      dasar: P + ' ayat (1), (' + (rb ? 4 : 3) + ') & (5)' + (kec ? ', ayat (2) huruf a' : '') + (ep ? '; PerLKPP 2/2026 Pasal 20' : '') };
  },
  /** v1.2.6/v1.2.9: batas nilai Pengadaan Langsung. Barang/Jasa Lainnya ≤ Rp200 juta, Konstruksi ≤ Rp400 juta, Konsultansi ≤ Rp100 juta;
      Papua (Pengaturan WILAYAH_PAPUA = YA): ≤ Rp1 miliar, konsultansi ≤ Rp200 juta (PerLKPP 3/2026 butir 1.4 huruf b & 5.3.3). */
  batasMetode(nilai, jenis, metode) {
    const n = num(nilai), m = String(metode || ''), pap = this.papua();
    if (!(n > 0) || !/pengadaan langsung/i.test(m)) return null;
    const k = this.kons(jenis), ks = jenis === 'KONSTRUKSI', lim = pap ? (k ? 200e6 : 1e9) : (ks ? 400e6 : k ? 100e6 : 200e6);
    if (n <= lim) return null;
    const lbl = ks ? 'Pekerjaan Konstruksi' : jenis === 'KONSULTANSI_KONSTRUKSI' ? 'Jasa Konsultansi Konstruksi' : jenis === 'KONSULTANSI' ? 'Jasa Konsultansi Nonkonstruksi' : jenis ? (jenis === 'BARANG' ? 'Barang' : 'Jasa Lainnya') : 'Barang/Jasa Lainnya', L = this.lamp(jenis);
    return { teks: 'Nilai ' + rp(n) + ' melebihi batas Pengadaan Langsung untuk ' + lbl + ' (paling banyak ' + this.jt(lim) + (pap ? ', percepatan pembangunan di Papua' : '') + '). Periksa kembali metode pemilihannya (' + (k ? 'Seleksi' : 'Tender/Tender Cepat') + ', E-purchasing, atau Penunjukan Langsung bila memenuhi kriteria).' + (pap ? '' : ' Batas yang lebih tinggi hanya untuk percepatan pembangunan di Papua.') + (jenis ? '' : ' Jenis pengadaan belum diketahui, dianggap Barang/Jasa Lainnya.'),
      dasar: pap ? L.nama + ' butir 1.4 huruf b & 5.3.3' : this.PERPRES + ' Pasal 1 angka 40, 40a, 41 & Pasal 38 ayat (3); ' + L.nama + ' butir 5.3.3' };
  },
  /** v1.2.9: pelaksana pemilihan Penyedia menurut metode, nilai, dan jenis.
      PerLKPP 3/2026 Lampiran I/II butir 1.4 & 5.2, Lampiran III butir 1.4; PerLKPP 2/2026 Pasal 11, 14–17.
      Hasil { kode: 'PP'|'POKJA'|'PPK'|'' (belum pasti), boleh: [...], teks, dasar, catatan: [] } atau null (swakelola/lainnya/metode kosong). */
  pelaksana(p) {
    p = p || {}; const m = String(p.Metode || '').trim(), j = p.Jenis_Pengadaan || '', n = this.nilaiPaket(p), pap = this.papua(), rb = this.rb(p), L = this.lamp(j, rb), jt = (x) => this.jt(x);
    const r = (kode, boleh, teks, dasar, cat) => ({ kode, boleh, teks, dasar, catatan: cat || [] });
    if (!m || /swakelola|lainnya/i.test(m)) return null;
    if (rb) return r('POKJA', ['POKJA'], 'Pokja Pemilihan melaksanakan tender dan penunjukan langsung pekerjaan konstruksi terintegrasi rancang dan bangun.', L.nama + ' butir 1.4',
      /^(tender|penunjukan langsung)$/i.test(m) ? [] : ['Metode pemilihan rancang dan bangun hanya tender atau penunjukan langsung (' + L.nama + ' butir 1.4); metode "' + m + '" tidak sesuai.']);
    if (/^(tender|tender cepat|seleksi)$/i.test(m)) return r('POKJA', ['POKJA'], 'Tender, tender cepat, dan seleksi dilaksanakan Pokja Pemilihan.', L.nama + ' butir 1.4 huruf c');
    if (/pengadaan langsung/i.test(m)) return r('PP', ['PP'], 'Pengadaan Langsung dilaksanakan Pejabat Pengadaan.', L.nama + ' butir 1.4 huruf b');
    if (/penunjukan langsung/i.test(m)) {
      const lim = pap ? (this.kons(j) ? 200e6 : 1e9) : (this.kons(j) ? 100e6 : 200e6), d = L.nama + ' butir 1.4' + (L.L === 'I' ? ' & 5.2' : '');
      if (!(n > 0)) return r('', ['PP', 'POKJA'], 'Pelaksana Penunjukan Langsung bergantung pada nilai HPS (batas ' + jt(lim) + ').', d);
      return n <= lim ? r('PP', ['PP'], 'Penunjukan Langsung bernilai paling banyak ' + jt(lim) + ' dilaksanakan Pejabat Pengadaan.', d)
        : r('POKJA', ['POKJA'], 'Penunjukan Langsung di atas ' + jt(lim) + ' dilaksanakan Pokja Pemilihan.', d);
    }
    if (!this.epur(m)) return null;
    const D = 'PerLKPP 2/2026', me = p.Metode_EP || '', td = p.Kanal_EP === 'TOKO_DARING', ht = String(p.Harga_Tetap || '').toUpperCase() === 'YA', bt = pap ? 1e9 : 200e6, cat = [];
    if (td && n > 50e6) cat.push('E-purchasing pada Toko Daring paling banyak Rp50 juta per transaksi (' + D + ' Pasal 11 ayat (6)); nilai ' + rp(n) + ' melebihi batas.');
    if (me === 'PEMBELIAN_LANGSUNG') {
      if (ht) return n > bt ? r('PPK', ['PPK'], 'Pembelian langsung produk berharga tetap di atas ' + jt(bt) + ' dilaksanakan PPK.', D + ' Pasal 15 ayat (' + (pap ? 5 : 4) + ') huruf b', cat)
        : r('PP', ['PP'], 'Pembelian langsung produk berharga tetap paling banyak ' + jt(bt) + ' dilaksanakan Pejabat Pengadaan.', D + ' Pasal 15 ayat (' + (pap ? 5 : 4) + ') huruf a', cat);
      if (n > 50e6) cat.push('Pembelian langsung tanpa harga tetap paling banyak Rp50 juta (' + D + ' Pasal 15 ayat (1) huruf a–b). Untuk nilai ' + rp(n) + ' gunakan negosiasi harga atau mini kompetisi, kecuali produk berharga tetap.');
      return r('PP', ['PP'], 'Pembelian langsung paling banyak Rp50 juta dilaksanakan Pejabat Pengadaan.', D + ' Pasal 15 ayat (3)', cat);
    }
    if (me === 'NEGOSIASI') {
      if (td) return r('PP', ['PP'], 'Negosiasi harga pada Toko Daring (paling banyak Rp50 juta) dilaksanakan Pejabat Pengadaan.', D + ' Pasal 16 ayat (1) huruf b & e', cat);
      if (n <= bt) return r('PP', ['PP'], 'Negosiasi harga paling banyak ' + jt(bt) + ' dilaksanakan Pejabat Pengadaan.', D + ' Pasal 16 ayat (1) huruf ' + (pap ? 'd' : 'c') + ' angka 1', cat);
      cat.push('Negosiasi oleh PPK hanya untuk barang/jasa hasil konsolidasi yang dapat dinegosiasikan, praktik bisnis mapan yang tidak dikompetisikan, atau swakelola melalui E-purchasing (' + D + ' Pasal 16 ayat (2)).');
      return pap ? r('PPK', ['PPK'], 'Negosiasi harga di atas Rp1 miliar (Papua) dilaksanakan PPK.', D + ' Pasal 16 ayat (1) huruf d angka 2', cat)
        : r('', ['PPK', 'POKJA'], 'Negosiasi harga di atas Rp200 juta dilaksanakan PPK atau Pokja Pemilihan.', D + ' Pasal 16 ayat (1) huruf c angka 2–3', cat);
    }
    if (me === 'MINI_KOMPETISI') {
      cat.push('Mini kompetisi dilakukan terhadap paling sedikit 2 Penyedia Katalog dengan produk atau spesifikasi yang sama (' + D + ' Pasal 17 ayat (1)).');
      if (n <= bt) return r('PP', ['PP'], 'Mini kompetisi paling banyak ' + jt(bt) + ' dilaksanakan Pejabat Pengadaan.', D + ' Pasal 17 ayat (' + (pap ? 3 : 2) + ') huruf a', cat);
      return pap ? r('PPK', ['PPK'], 'Mini kompetisi di atas Rp1 miliar (Papua) dilaksanakan PPK.', D + ' Pasal 17 ayat (3) huruf b', cat)
        : r('POKJA', ['POKJA', 'PPK'], 'Mini kompetisi di atas Rp200 juta dilaksanakan Pokja Pemilihan; PPK hanya bila Pokja Pemilihan belum dapat melaksanakannya.', D + ' Pasal 17 ayat (2) huruf b & ayat (4)', cat);
    }
    cat.push('Metode E-purchasing (pembelian langsung, negosiasi harga, atau mini kompetisi) belum dipilih — isi di Ubah paket agar pelaksana dan batas nilainya dapat diperiksa (' + D + ' Pasal 14).');
    return n > 0 && n <= bt ? r('PP', ['PP'], 'E-purchasing paling banyak ' + jt(bt) + ' dilaksanakan Pejabat Pengadaan untuk semua metode E-purchasing.', D + ' Pasal 15–17', cat)
      : r('', ['PP', 'PPK', 'POKJA'], 'Pelaksana E-purchasing di atas ' + jt(bt) + ' bergantung pada metodenya.', D + ' Pasal 14–17', cat);
  },
  /** v1.2.9: pelaksana yang dipakai — pilihan di paket (Pelaksana_Pemilihan) atau saran otomatis */
  pelaksanaEfektif(p) {
    const pilih = String((p && p.Pelaksana_Pemilihan) || '').toUpperCase(); if (K.PELAKSANA[pilih]) return pilih;
    const a = this.pelaksana(p); return (a && a.kode) || '';
  },
  /** v1.2.9: tujuan surat Instruksi PPK ({{KEPADA}}) */
  kepadaInstruksi(p) {
    const pel = this.pelaksanaEfektif(p);
    return pel === 'POKJA' ? String((S.settings && S.settings.NAMA_UKPBJ) || 'Kepala UKPBJ').trim() + ' (Pokja Pemilihan)' : 'Pejabat Pengadaan';
  },
  /** v1.2.9: masa pemeliharaan pekerjaan konstruksi paling singkat 6 bulan (permanen) / 3 bulan (semi permanen) — Lampiran II/III butir 7.2 huruf d */
  pemeliharaan(p) {
    if (!p || p.Jenis_Pengadaan !== 'KONSTRUKSI') return null;
    const s = p.Sifat_Konstruksi, min = s === 'PERMANEN' ? 6 : s === 'SEMI_PERMANEN' ? 3 : 0, nm = min === 6 ? 'permanen' : 'semi permanen';
    const dasar = this.lamp('KONSTRUKSI', this.rb(p)).nama + ' butir 7.2 huruf d', isi = p.Masa_Pemeliharaan_Bulan;
    if (!min) return isi === '' || isi == null ? null : num(isi) < 3 ? { teks: 'Masa pemeliharaan ' + fmtN(num(isi)) + ' bulan kurang dari batas paling singkat pekerjaan konstruksi (3 bulan semi permanen, 6 bulan permanen).', dasar }
      : { teks: 'Pilih sifat pekerjaan (permanen/semi permanen) agar masa pemeliharaan paling singkat dapat diperiksa.', dasar };
    if (isi === '' || isi == null) return { teks: 'Masa pemeliharaan belum diisi: paling singkat ' + min + ' bulan untuk pekerjaan ' + nm + '.', dasar };
    return num(isi) < min ? { teks: 'Masa pemeliharaan ' + fmtN(num(isi)) + ' bulan kurang dari batas paling singkat ' + min + ' bulan untuk pekerjaan ' + nm + '.', dasar } : null;
  },
  /** v1.2.9: semua peringatan paket (formulir & Dokumen Disarankan). opsi.tanpaBatas = lewati batasMetode. */
  periksaPaket(p, opsi) {
    if (!p) return []; opsi = opsi || {};
    const w = [], m = String(p.Metode || ''), ep = this.epur(m);
    if (!opsi.tanpaBatas) { const bm = this.batasMetode(this.nilaiPaket(p), p.Jenis_Pengadaan, m); if (bm) w.push(bm); }
    const a = this.pelaksana(p);
    if (a) {
      a.catatan.forEach((c) => w.push({ teks: c, dasar: '' }));
      const pilih = String(p.Pelaksana_Pemilihan || '').toUpperCase();
      if (K.PELAKSANA[pilih] && a.boleh.indexOf(pilih) < 0) w.push({ teks: 'Pelaksana yang dipilih (' + K.PELAKSANA[pilih] + ') tidak sesuai: ' + a.teks, dasar: a.dasar });
    }
    if (this.rb(p)) w.push({ teks: 'Rancang dan bangun hanya untuk pekerjaan kompleks atau mendesak, dan ditetapkan oleh kepala daerah (APBD) bersama skema tim teknis/konsultan manajemen konstruksi.', dasar: 'PerLKPP 3/2026 Lampiran III butir 1.1.1' });
    const pm = this.pemeliharaan(p); if (pm) w.push(pm);
    if (m && !ep && !/swakelola|lainnya/i.test(m)) {
      const tk = String(p.Tersedia_Katalog || '').toUpperCase();
      if (tk === 'YA') w.push({ teks: 'Barang/jasa tersedia di Katalog Elektronik: E-purchasing wajib, kecuali PPK menilai tidak memenuhi kebutuhan (volume, spesifikasi, waktu, lokasi, layanan) atau lebih efisien/efektif dengan metode lain. Penilaian PPK didukung analisis pasar.', dasar: 'PerLKPP 2/2026 Pasal 12 ayat (2)–(6)' });
      else if (!tk) w.push({ teks: 'Ketersediaan di Katalog Elektronik belum dicek. Bila tersedia, E-purchasing wajib kecuali ada pengecualian berdasarkan penilaian PPK dengan analisis pasar.', dasar: 'PerLKPP 2/2026 Pasal 12 ayat (2)–(6)' });
    }
    return w;
  },
  /** Ringkasan aturan kontrak untuk ditampilkan (HTML). p = paket tertaut (opsional). */
  kontrakHtml(nilai, jenis, metode, p) {
    const b = this.bentukKontrak(nilai, jenis, metode, p), j = this.jaminan(nilai, jenis, metode, p), bm = this.batasMetode(nilai, jenis, metode);
    if (!b && !j && !bm) return '';
    const info = b || j ? `<div class="note info" data-aturan>${ic('info', 'sm')}<div>${b ? `Bentuk kontrak: <b>${esc(b.bentuk)}</b>${b.ket ? ' — ' + esc(b.ket) : ''} <span class="mini">(${esc(b.dasar)})</span>` : ''}${j ? `${b ? '<br>' : ''}${esc(j.teks)} <span class="mini">(${esc(j.dasar)})</span>` : ''}</div></div>` : '';
    return (bm ? `<div class="note warn${info ? ' mb-s' : ''}" data-batasmetode>${ic('warn', 'sm')}<div>${esc(bm.teks)} <span class="mini">(${esc(bm.dasar)})</span></div></div>` : '') + info;
  },
  /** v1.2.9: daftar peringatan paket sebagai HTML (formulir paket & detail) */
  periksaHtml(p, opsi) {
    const w = this.periksaPaket(p, opsi);
    return w.map((x) => `<div class="note warn mb-s" data-periksa>${ic('warn', 'sm')}<div>${esc(x.teks)}${x.dasar ? ` <span class="mini">(${esc(x.dasar)})</span>` : ''}</div></div>`).join('');
  },
  /** Peringatan teks dasar hukum: judul tidak resmi & aturan yang belum/tidak berlaku pada tanggal dokumen */
  cekDasar(teks, tgl) {
    const t = String(teks || ''), d = String(tgl || todayISO()).slice(0, 10), w = [], lk = (n) => new RegExp('(LKPP|Lembaga)[^;\\n]{0,90}Nomor ' + n + ' Tahun', 'i');
    if (/Nomor 46 Tahun 2025 tentang Perubahan atas/i.test(t)) w.push('Judul resmi Perpres 46/2025 adalah "Perubahan Kedua atas Peraturan Presiden Nomor 16 Tahun 2018".');
    if (lk('3').test(t) && /Nomor 3 Tahun 2026/i.test(t) && /Persiapan Pelaksanaan/i.test(t)) w.push('Judul resmi PerLKPP 3/2026: "Pedoman Persiapan dan Pelaksanaan Pengadaan Barang/Jasa Pemerintah Melalui Penyedia".');
    if (lk('2').test(t) && /Nomor 2 Tahun 2026/i.test(t) && d < '2026-09-01') w.push('PerLKPP 2/2026 baru berlaku 1 September 2026; sebelum itu berlaku PerLKPP 9/2021.');
    if (lk('3').test(t) && /Nomor 3 Tahun 2026/i.test(t) && d < '2026-09-22') w.push('PerLKPP 3/2026 (ditetapkan 21 September 2026) berlaku sejak tanggal diundangkan (Pasal 12); sebelum itu berlaku PerLKPP 12/2021 sebagaimana diubah PerLKPP 4/2024.');
    if (lk('9').test(t) && /Nomor 9 Tahun 2021/i.test(t) && d >= '2026-09-01') w.push('PerLKPP 9/2021 dicabut oleh PerLKPP 2/2026 (berlaku 1 September 2026, Pasal 24). Tetap dipakai hanya bila E-purchasing paket ini sudah dilaksanakan sebelum 1 September 2026 (Pasal 23 huruf c), atau Surat/Bukti Pesanannya ditandatangani berdasarkan PerLKPP 9/2021 dan kontraknya belum berakhir (Pasal 23 huruf d).');
    if (lk('12').test(t) && /Nomor 12 Tahun 2021/i.test(t) && d >= '2026-09-22') w.push('PerLKPP 12/2021 dan perubahannya dicabut oleh PerLKPP 3/2026 (Pasal 11). Tetap dipakai hanya bila pemilihan Penyedia paket ini sudah dilaksanakan sebelum PerLKPP 3/2026 berlaku (Pasal 10 huruf a), atau kontraknya sudah ditandatangani sebelumnya (Pasal 10 huruf b).');
    return w;
  },
  /** v1.2.4/v1.2.9: daftar dokumen yang disarankan menurut metode, jenis, dan nilai (PETUNJUK, bukan pengganti ketentuan).
      p = paket (boleh null), k = kontrak (boleh null). Tahap: persiapan → penunjukan/kontrak → pelaksanaan → serah terima.
      Rujukan butir: PerLKPP 3/2026 Lampiran I (barang/jasa lainnya & konsultansi nonkonstruksi), II (konstruksi & konsultansi konstruksi),
      III (konstruksi terintegrasi rancang dan bangun) — lihat Aturan.lamp(). */
  dokumen(p, k) {
    p = p || null; k = k || null;
    const metode = String((k && k.Metode) || (p && p.Metode) || ''), jenis = (p && p.Jenis_Pengadaan) || '', ep = this.epur(metode), rb = this.rb(p);
    const nilai = k ? num(k.Nilai_Kontrak) : p ? num(p.Nilai_HPS) || num(p.Pagu_Paket) : 0, B = this.lamp(jenis, rb), L = B.nama;
    const out = { metode, jenis, nilai, perkiraan: !k, catatan: [], daftar: [] };
    const add = (o) => out.daftar.push(Object.assign({ status: 'wajib', perluKontrak: true, ket: '' }, o));
    if (/swakelola/i.test(metode)) { out.catatan.push('Swakelola tidak memakai dokumen penyedia (HPS, SPK, BAST penyedia). Dokumen swakelola mengikuti pedoman swakelola LKPP tersendiri — belum dimodelkan di aplikasi ini (perlu verifikasi peraturan yang berlaku).'); return out; }
    if (/lainnya/i.test(metode) && !p) out.catatan.push('Metode "Lainnya": bila ini belanja non-pengadaan (gaji, listrik, air, telepon, BBM, perjalanan dinas), dokumen pertanggungjawabannya mengikuti ketentuan pengelolaan keuangan daerah, bukan dokumen di bawah ini. Perpres 16/2018 Pasal 61 mengecualikan antara lain barang/jasa dengan tarif yang dipublikasikan luas.');
    if (!metode) out.catatan.push('Metode pemilihan belum diisi — daftar disusun seolah Pengadaan Langsung/Non-Tender.');
    const bm = this.batasMetode(nilai, jenis, metode); if (bm) out.catatan.push(bm.teks + ' (' + bm.dasar + ')');
    if (p) this.periksaPaket(Object.assign({}, p, { Metode: metode }), { tanpaBatas: true }).forEach((w) => out.catatan.push(w.teks + (w.dasar ? ' (' + w.dasar + ')' : '')));
    if (p) {
      const a = this.pelaksana(Object.assign({}, p, { Metode: metode })), pel = this.pelaksanaEfektif(Object.assign({}, p, { Metode: metode }));
      add({ kode: 'INSTRUKSI', tahap: 'Persiapan (PPK)', nama: pel === 'POKJA' ? 'Instruksi/permintaan PPK kepada UKPBJ (Pokja Pemilihan)' : pel === 'PPK' ? 'Instruksi PPK (PPK melaksanakan pemilihan sendiri)' : 'Instruksi PPK kepada Pejabat Pengadaan/UKPBJ',
        jenis: 'INSTRUKSI', arsip: 'INSTRUKSI', status: pel === 'PPK' ? 'opsional' : 'internal', perluKontrak: false,
        dasar: 'Praktik internal dinas; PerLKPP 3/2026 mengatur penyampaian dokumen persiapan oleh PPK kepada Pejabat Pengadaan/UKPBJ' + (ep && pel === 'POKJA' ? '; PerLKPP 2/2026 Pasal 14 ayat (3)' : ''),
        ket: (pel === 'PPK' ? 'PPK melaksanakan pemilihan sendiri — instruksi tidak diperlukan. ' : '') + 'Nama "Instruksi PPK" tidak disebut dalam peraturan; pengantar dokumen persiapan.' + (a && a.teks ? ' Pelaksana: ' + a.teks + (a.dasar ? ' (' + a.dasar + ')' : '') : '') });
      if (rb) add({ kode: 'PENETAPAN_RB', tahap: 'Persiapan (PPK)', nama: 'Penetapan pekerjaan rancang dan bangun oleh kepala daerah', jenis: '', arsip: 'LAINNYA', perluKontrak: false, dasar: L + ' butir 1.1.1',
        ket: 'Kriteria pekerjaan kompleks atau mendesak; ditetapkan bersama skema tim teknis dan/atau konsultan manajemen konstruksi.' });
      if (!ep && !/swakelola|lainnya/i.test(metode) && String(p.Tersedia_Katalog || '').toUpperCase() === 'YA')
        add({ kode: 'ANALISIS_PASAR', tahap: 'Persiapan (PPK)', nama: 'Analisis pasar — pengecualian kewajiban E-purchasing', jenis: 'ANALISIS_PASAR', arsip: 'ANALISIS_PASAR', perluKontrak: false, dasar: 'PerLKPP 2/2026 Pasal 12 ayat (2)–(6)',
          ket: 'Paling sedikit mengidentifikasi: ketersediaan barang/jasa & Penyedia di Katalog; pemenuhan volume & spesifikasi; kesanggupan Penyedia (waktu, lokasi, layanan); kesesuaian kategori; perbandingan harga di dalam dan di luar Katalog.' });
      add({ kode: 'SPESIFIKASI', tahap: 'Persiapan (PPK)', nama: rb ? 'Dokumen Ketentuan PPK' : this.kons(jenis) ? 'Kerangka Acuan Kerja (KAK)' : 'Spesifikasi Teknis / KAK', jenis: 'SPESIFIKASI', arsip: 'SPEK', perluKontrak: false, dasar: L + ' butir ' + B.spes });
      const hg = this.harga(Object.assign({}, p, { Metode: metode }));
      add({ kode: 'HPS', tahap: 'Persiapan (PPK)', nama: hg.nama, jenis: 'HPS', arsip: 'HPS', perluKontrak: false, status: hg.bebas ? 'opsional' : 'wajib', dasar: hg.dasar + (ep || rb ? '' : '; ' + L + ' butir ' + B.harga), ket: hg.ket || 'Sah bila ditandatangani PPK.' });
    }
    const bk = this.bentukKontrak(nilai, jenis, metode, p), bentuk = bk ? bk.bentuk : '', pl = /pengadaan langsung/i.test(metode);
    const sp = /Surat Perintah Kerja/.test(bentuk), pj = /Surat perjanjian/i.test(bentuk), kw = /^Kuitansi$/.test(bentuk), bp = /Bukti pembelian/.test(bentuk);
    if (!bk && !ep) out.catatan.push('Nilai belum diketahui — isi pagu/HPS paket atau nilai kontrak agar bentuk kontrak dapat ditentukan.');
    if (bk) out.bentuk = bk;
    if (!ep && (sp || pj)) add({ kode: 'PENUNJUKAN', tahap: 'Penunjukan & Kontrak', nama: 'Surat Penunjukan Penyedia (SPPBJ)', jenis: 'PENUNJUKAN', arsip: 'PENETAPAN', status: pl ? 'disarankan' : 'wajib',
      dasar: L + ' butir ' + B.tunjuk + (pl && B.pl ? ' & ' + B.pl : ''), ket: 'Paling lambat 5 hari kerja setelah BA hasil pemilihan; tanggal kontrak tidak boleh mendahului surat ini.' + (pl ? ' Untuk Pengadaan Langsung, BA hasil pemilihan = berita acara hasil pengadaan langsung yang dilaporkan Pejabat Pengadaan kepada PPK.' : '') });
    /* v1.4.1: jaminan pelaksanaan semua metode (Perpres Pasal 33), sebelum dokumen kontrak */
    const jm = this.jaminan(nilai, jenis, metode, p), l1 = B.L === 'I' && !ep;
    if (jm && jm.wajib) add({ kode: 'JAMINAN', tahap: 'Penunjukan & Kontrak', nama: 'Jaminan Pelaksanaan', jenis: '', arsip: 'JAMINAN', dasar: jm.dasar + (l1 ? '; ' + L + ' butir 6.3.1 huruf h' : ''),
      ket: (k ? '' : 'Perkiraan dari nilai HPS/pagu paket. ') + jm.masa + ' ' + jm.rincian + (l1 ? ' PPK meminta Penyedia menyerahkan jaminan yang sah sebelum kontrak ditandatangani.' : '') + ' Dokumen dari penerbit jaminan — tidak memerlukan template.' });
    if (ep) {
      add({ kode: 'SURAT_PESANAN', tahap: 'Penunjukan & Kontrak', nama: 'Surat/Bukti Pesanan e-Katalog', jenis: 'SURAT_PESANAN', arsip: 'SPK', dasar: this.PERPRES + ' Pasal 28 ayat (6); PerLKPP 2/2026 Pasal 19', ket: 'Yang sah ditandatangani PPK dan Penyedia secara elektronik di sistem Katalog Elektronik; draf di sini untuk arsip internal.' });
      add({ kode: 'BAPP', tahap: 'Pelaksanaan', nama: 'BA Penyelesaian Pekerjaan (BAPP) per termin', jenis: 'BAPP', arsip: 'BAPP', status: 'disarankan', dasar: 'Kebutuhan pembayaran per termin (draf internal)',
        ket: 'PerLKPP 2/2026 tidak mengatur BAPP. Periksa apakah sistem Katalog Elektronik (INAPROC) menerbitkannya; bila ya, unggah PDF dari sistem.' });
      add({ kode: 'BAST', tahap: 'Serah Terima', nama: 'BAST e-Katalog', jenis: 'BAST', cari: 'katalog', arsip: 'BAST', dasar: L + ' butir ' + B.bast,
        ket: 'Draf internal. PerLKPP 2/2026 hanya mengatur Surat/Bukti Pesanan (Pasal 19); periksa apakah sistem Katalog Elektronik (INAPROC) menerbitkan BAST sendiri.' });
    } else if (bk) {
      if (bp) add({ kode: 'BUKTI', tahap: 'Penunjukan & Kontrak', nama: 'Bukti pembelian/pembayaran (nota/struk dari penyedia)', jenis: '', arsip: 'SPK', dasar: bk.dasar, ket: 'Dokumen dari penyedia — tidak memerlukan template. Kuitansi boleh dipakai sebagai gantinya.' });
      if (bp || kw) add({ kode: 'KUITANSI', tahap: 'Penunjukan & Kontrak', nama: 'Kuitansi', jenis: 'KUITANSI', arsip: 'SPK', status: kw ? 'wajib' : 'opsional', dasar: bk.dasar, ket: 'Langkah: pemesanan → serah terima → penyerahan bukti → pembayaran (' + L + ' butir ' + (B.pl || '5.3.3') + ').' + (nilai > 5e6 ? ' Bubuhkan meterai Rp10.000 pada tanda tangan penerima (nilai di atas Rp5 juta; UU 10/2020 Pasal 3 ayat (2) huruf g & Pasal 5).' : nilai > 0 ? ' Nilai paling banyak Rp5 juta: tidak wajib bea meterai (UU 10/2020 Pasal 3 ayat (2) huruf g); kotak meterai di template boleh dibiarkan kosong.' : '') });
      if (sp) add({ kode: 'SPK', tahap: 'Penunjukan & Kontrak', nama: 'Surat Perintah Kerja (SPK) — memuat ' + (jenis === 'BARANG' ? 'Surat Perintah Pengiriman' : 'SPMK'), jenis: 'SPK', cari: jenis === 'BARANG' ? 'barang' : this.kons(jenis) ? 'waktu penugasan|lumsum' : 'lumsum|harga satuan', arsip: 'SPK', dasar: bk.dasar + '; ' + L + ' butir ' + B.bentuk + ' & ' + B.spmk, ket: 'Ditandatangani paling lambat 14 hari kerja setelah surat penunjukan, bermeterai.' });
      if (pj) {
        add({ kode: 'PERJANJIAN', tahap: 'Penunjukan & Kontrak', nama: 'Surat Perjanjian', jenis: 'PERJANJIAN', arsip: 'SPK', dasar: bk.dasar + '; ' + L + ' butir ' + B.bentuk + ' & ' + B.kontrak, ket: 'Satu kesatuan dengan SSUK, SSKK, dan dokumen kontrak lain; dua rangkap bermeterai.' });
        add({ kode: 'SPMK', tahap: 'Penunjukan & Kontrak', nama: jenis === 'BARANG' ? 'Surat Perintah Pengiriman' : 'Surat Perintah Mulai Kerja (SPMK)', jenis: '', arsip: 'SPMK', dasar: L + ' butir ' + B.spmk, ket: (jenis === 'BARANG' ? 'Paling lambat 14 hari kalender setelah kontrak; penyedia menandatangani ≤ 7 hari kalender.' : 'Paling lambat 14 hari kalender setelah kontrak/penyerahan lokasi.') + ' Template terpisah belum tersedia — bagian ini ada di template SPK.' });
      }
      if (jenis === 'KONSTRUKSI' && (sp || pj)) add({ kode: 'BA_LOKASI', tahap: 'Pelaksanaan', nama: 'BA Peninjauan & Serah Terima Lokasi Kerja', jenis: 'BA_LOKASI', arsip: 'LAINNYA', dasar: L + ' butir ' + B.lokasi, ket: 'Lokasi yang tidak dapat diserahkan dapat menjadi peristiwa kompensasi.' });
      if (!bp) add({ kode: 'BAST', tahap: 'Serah Terima', nama: jenis === 'KONSTRUKSI' ? 'BA Serah Terima Pertama Hasil Pekerjaan (PHO)' : 'BA Serah Terima Hasil Pekerjaan (BAST)', jenis: 'BAST', cari: 'pekerjaan', arsip: 'BAST', status: kw ? 'disarankan' : 'wajib', dasar: L + ' butir ' + B.bast, ket: 'Pembayaran 95% dengan retensi 5%, atau 100% dengan jaminan pemeliharaan 5% (bila ada masa pemeliharaan).' });
      const pel = p && ((p.Pemeliharaan && p.Pemeliharaan !== '-') || num(p.Masa_Pemeliharaan_Bulan) > 0);
      if ((jenis === 'KONSTRUKSI' && (sp || pj)) || (pel && (sp || pj))) add({ kode: 'BAST_AKHIR', tahap: 'Serah Terima', nama: 'BA Serah Terima Akhir (setelah masa pemeliharaan)', jenis: 'BAST_AKHIR', arsip: 'BAST', status: jenis === 'KONSTRUKSI' ? 'wajib' : 'disarankan', dasar: L + ' butir ' + B.akhir,
        ket: 'Setelah BA ini PPK membayar sisa nilai Kontrak (retensi) sesuai Kontrak, atau mengembalikan jaminan pemeliharaan dalam 14 hari kerja setelah masa pemeliharaan selesai (butir ' + B.jam + ').' + (jenis === 'KONSTRUKSI' ? ' Masa pemeliharaan paling singkat 6 bulan (permanen) atau 3 bulan (semi permanen) — butir 7.2 huruf d.' : '') });
    }
    return out;
  },
  cekDasarHtml(teks, tgl) { const w = this.cekDasar(teks, tgl); return w.length ? `<div class="note warn mt-s" data-cekdasar>${ic('warn', 'sm')}<div>${w.map(esc).join('<br>')}</div></div>` : ''; }
};
