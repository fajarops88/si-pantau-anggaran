/* =====================================================================
   SI-PANTAU ANGGARAN — impor.js (v1.1)
   Impor dari Excel (.xlsx/.xls/.ods), CSV, Word (.docx, tabel & teks), dan PDF (teks bertata letak).
   Semua berkas dibaca DI BROWSER; ke server hanya dikirim CSV hasil pemetaan kolom
   (aksi import.jalankan yang sudah ada, dengan dry-run lebih dulu).
   ===================================================================== */
'use strict';
const Impor = {
  LIB: {
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    zip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfw: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  },
  EXT: '.xlsx,.xls,.ods,.csv,.txt,.docx,.pdf',
  ext(f) { return String(f.name || '').toLowerCase().split('.').pop(); },

  /** Baca berkas → { tables:[{nama, rows:[[sel]]}], teks } */
  async baca(file) {
    const e = this.ext(file);
    if (e === 'csv' || e === 'txt') { const t = await file.text(); return { tables: [{ nama: file.name, rows: this.csvParse(t) }], teks: t }; }
    if (e === 'xlsx' || e === 'xls' || e === 'ods') return this.bacaExcel(file);
    if (e === 'docx') return this.bacaWord(file);
    if (e === 'pdf') return this.bacaPdf(file);
    if (e === 'doc') throw new Error('Format .doc lama belum didukung. Buka di Word lalu Simpan Sebagai .docx.');
    throw new Error('Format berkas tidak didukung. Gunakan Excel (.xlsx), Word (.docx), PDF, atau CSV.');
  },
  async bacaExcel(file) {
    await loadScript(this.LIB.xlsx);
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const tables = wb.SheetNames.map((n) => ({ nama: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' }).map((r) => r.map((c) => String(c == null ? '' : c).trim())) }))
      .filter((t) => t.rows.some((r) => r.some(Boolean)));
    return { tables, teks: tables.map((t) => t.rows.map((r) => r.join('\t')).join('\n')).join('\n\n') };
  },
  async bacaWord(file) {
    await loadScript(this.LIB.zip);
    const z = await JSZip.loadAsync(await file.arrayBuffer());
    const xml = await z.file('word/document.xml').async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const teksDari = (el) => Array.from(el.getElementsByTagNameNS(W, 'p')).map((p) => Array.from(p.getElementsByTagNameNS(W, 't')).map((t) => t.textContent).join('')).join('\n').trim();
    const tables = Array.from(doc.getElementsByTagNameNS(W, 'tbl')).filter((tb) => !tb.parentNode || tb.parentNode.localName !== 'tc').map((tb, i) => ({
      nama: 'Tabel ' + (i + 1),
      rows: Array.from(tb.childNodes).filter((n) => n.localName === 'tr').map((tr) => Array.from(tr.childNodes).filter((n) => n.localName === 'tc').map((tc) => teksDari(tc).replace(/\n+/g, ' ')))
    })).filter((t) => t.rows.length);
    const body = doc.getElementsByTagNameNS(W, 'body')[0];
    const paras = Array.from(body.childNodes).filter((n) => n.localName === 'p').map((p) => Array.from(p.getElementsByTagNameNS(W, 't')).map((t) => t.textContent).join(''));
    return { tables, teks: paras.join('\n').replace(/\n{3,}/g, '\n\n').trim() };
  },
  async bacaPdf(file) {
    await loadScript(this.LIB.pdf);
    const lib = window.pdfjsLib;
    if (!lib.GlobalWorkerOptions.workerSrc) {
      try { const b = await (await fetch(this.LIB.pdfw)).blob(); lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(b); } catch (e) { lib.GlobalWorkerOptions.workerSrc = this.LIB.pdfw; }
    }
    const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const rows = [], lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p); const tc = await page.getTextContent();
      const items = tc.items.filter((it) => it.str && it.str.trim()).map((it) => ({ s: it.str, x: it.transform[4], y: Math.round(it.transform[5]), w: it.width || it.str.length * 4, h: Math.abs(it.transform[3]) || 8 }));
      if (!items.length) continue;
      // kelompokkan per baris (toleransi tinggi huruf)
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const grp = []; items.forEach((it) => { const g = grp.find((x) => Math.abs(x.y - it.y) <= Math.max(2, it.h * 0.4)); if (g) g.it.push(it); else grp.push({ y: it.y, it: [it] }); });
      grp.sort((a, b) => b.y - a.y).forEach((g) => {
        g.it.sort((a, b) => a.x - b.x);
        const cells = []; let cur = null;
        g.it.forEach((it) => { const gap = cur ? it.x - (cur.x + cur.w) : 0; if (cur && gap < Math.max(6, it.h * 1.2)) { cur.s += (gap > 1 ? ' ' : '') + it.s; cur.w = it.x + it.w - cur.x; } else { cur = { s: it.s, x: it.x, w: it.w }; cells.push(cur); } });
        rows.push(cells.map((c) => c.s.trim())); lines.push(cells.map((c) => c.s.trim()).join(' '));
      });
    }
    if (!rows.length) throw new Error('PDF tidak memiliki lapisan teks (hasil scan gambar). Gunakan PDF asli dari SIPD/aplikasi, atau Excel/Word.');
    return { tables: [{ nama: 'Teks PDF (' + pdf.numPages + ' hlm)', rows, pdf: true }], teks: lines.join('\n') };
  },
  /** Tebak isian kontrak dari teks SPK (Word/Excel/PDF). Heuristik — hasil wajib diperiksa pengguna. */
  tebakSpk(t) {
    t = String(t || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ');
    const BL = { januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12 };
    const iso = (d, m, y) => (y && m && d ? y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0') : '');
    const tgl = (s) => { let x = String(s || '').match(/(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})/i); if (x) return iso(x[1], BL[x[2].toLowerCase()], x[3]);
      x = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/); if (x) return iso(x[3], x[2], x[1]); x = String(s || '').match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/); return x ? iso(x[1], x[2], x[3]) : ''; };
    const cari = (re) => { const m = t.match(re); return m ? m[1].trim().replace(/[ ,;:.]+$/, '') : ''; };
    const o = {};
    o.No_SPK = cari(/(?:^|\n)\s*(?:Nomor|No\.?)\s*(?:SPK|Kontrak)?\s*:?\s*([^\n]*\/[^\n]{2,80})/i);
    o.Tgl_SPK = tgl(cari(/Tanggal\s*(?:SPK|Kontrak)?\s*:?\s*([^\n]{6,40})/i)) || tgl(t.slice(0, 1500));
    o.Uraian_Pekerjaan = cari(/(?:Paket\s+Pekerjaan|Nama\s+Pekerjaan|Nama\s+Paket|Pekerjaan)\s*:\s*([^\n]{5,250})/i);
    o.Penyedia = cari(/\b((?:CV|PT|UD|Firma|Koperasi)\.?\s+[A-Z0-9][^\n,;:()]{2,70})/);
    o.NPWP = cari(/\b(\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3})\b/) || cari(/NPWP\s*:?\s*(\d{15,16})\b/i);
    o.Nama_Bank = cari(/(?:Nama\s+)?Bank\s*:\s*([^\n]{3,50})/i);
    o.No_Rekening = cari(/(?:Nomor|No\.?)\s*Rekening\s*:?\s*([\d][\d .-]{5,30})/i).replace(/\s+/g, '');
    const nil = (t.match(/Rp\.?\s*[\d.]{4,}(?:,\d{1,2})?/gi) || []).map((x) => this.angka(x.replace(/Rp\.?\s*/i, ''))).filter((x) => typeof x === 'number' && x >= 1000);
    if (nil.length) o.Nilai_Kontrak = Math.max(...nil);
    const mulai = cari(/(?:mulai|tanggal\s+mulai)[^\n]{0,30}?(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/i), selesai = cari(/(?:selesai|berakhir|sampai\s+dengan|s\.?d\.?)[^\n]{0,30}?(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/i);
    if (tgl(mulai)) o.Tgl_Mulai = tgl(mulai); if (tgl(selesai)) o.Tgl_Selesai = tgl(selesai);
    return o;
  },
  /** Teks polos (untuk Isi Instruksi / SPK) dari Word/Excel/PDF/TXT */
  async teks(file) { const r = await this.baca(file); return r.teks || ''; },
  csvParse(t) {
    t = String(t || '').replace(/^﻿/, ''); const first = t.split(/\r?\n/)[0] || '';
    const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : first.indexOf('\t') > -1 ? '\t' : ',';
    const out = []; let row = [], f = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true; else if (c === sep) { row.push(f.trim()); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f.trim()); out.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f || row.length) { row.push(f.trim()); out.push(row); }
    return out.filter((r) => r.some(Boolean));
  },
  toCsv(head, rows) { const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; return [head.map(q).join(';')].concat(rows.map((r) => r.map(q).join(';'))).join('\n'); },
  /** Angka gaya Indonesia: "Rp 1.250.000,50" → 1250000.5 */
  angka(v) { let s = String(v == null ? '' : v).replace(/[^0-9.,-]/g, ''); if (!s) return ''; if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/[.,](?=\d{3}(\D|$))/g, ''); const n = Number(s); return isFinite(n) ? n : ''; },
  normH(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); },

  /* ---------- Definisi target impor (kolom & alias) ---------- */
  TARGET: {
    subkeg: { judul: 'Sub Kegiatan (DPA)', kolom: [['Kode_SubKeg', 'Kode Sub Kegiatan', ['kodesubkegiatan', 'koderekening', 'kode', 'kodesubkeg']], ['Nama_SubKegiatan', 'Nama Sub Kegiatan', ['namasubkegiatan', 'subkegiatan', 'uraian', 'nomenklatur']], ['Pagu', 'Pagu', ['pagu', 'paguanggaran', 'anggaran', 'jumlah', 'nilai', 'jumlahrp']], ['Kode_Program', 'Kode Program', ['kodeprogram']], ['Nama_Program', 'Program', ['program', 'namaprogram']], ['Kode_Kegiatan', 'Kode Kegiatan', ['kodekegiatan']], ['Nama_Kegiatan', 'Kegiatan', ['kegiatan', 'namakegiatan']], ['Indikator', 'Indikator', ['indikator', 'indikatorkinerja', 'tolokukur', 'keluaran']], ['Target', 'Target', ['target', 'targetkinerja']], ['Satuan', 'Satuan', ['satuan']], ['Sumber_Dana', 'Sumber Dana', ['sumberdana']], ['Bidang', 'Bidang', ['bidang', 'unitkerja']], ['PIC_Email', 'Email PIC', ['picemail', 'pic', 'emailpic']]], wajib: ['Kode_SubKeg', 'Nama_SubKegiatan', 'Pagu'], angka: ['Pagu', 'Target'] },
    kontrak: { judul: 'Kontrak', kolom: [['No_SPK', 'Nomor SPK', ['nospk', 'nomorspk', 'nomorkontrak']], ['Kode_SubKeg', 'Kode Sub Kegiatan', ['kodesubkeg', 'kodesubkegiatan', 'koderekening']], ['Tgl_SPK', 'Tanggal SPK', ['tglspk', 'tanggalspk', 'tanggal']], ['Uraian_Pekerjaan', 'Uraian Pekerjaan', ['uraianpekerjaan', 'uraian', 'pekerjaan', 'namapaket']], ['Penyedia', 'Penyedia', ['penyedia', 'rekanan', 'namapenyedia']], ['Direktur', 'Direktur', ['direktur', 'penandatangan']], ['NPWP', 'NPWP', ['npwp']], ['Nilai_Kontrak', 'Nilai Kontrak', ['nilaikontrak', 'nilai', 'nilaispk']], ['Metode', 'Metode', ['metode', 'metodepengadaan']], ['Tgl_Mulai', 'Tanggal Mulai', ['tglmulai', 'mulai']], ['Tgl_Selesai', 'Tanggal Selesai', ['tglselesai', 'selesai']], ['Status', 'Status', ['status']]], wajib: ['No_SPK', 'Kode_SubKeg', 'Nilai_Kontrak'], angka: ['Nilai_Kontrak'] },
    pengguna: { judul: 'Pengguna', kolom: [['Email', 'Email', ['email', 'emaildinas']], ['Nama', 'Nama', ['nama', 'namalengkap']], ['NIP', 'NIP', ['nip']], ['Jabatan', 'Jabatan', ['jabatan']], ['Role', 'Peran', ['role', 'peran']], ['Bidang', 'Bidang', ['bidang']], ['Atasan_Email', 'Email Atasan', ['atasanemail', 'atasan', 'emailatasan']], ['Aktif', 'Aktif', ['aktif', 'status']]], wajib: ['Email', 'Nama'], angka: [] },
    pengadaanItem: { judul: 'Item HPS & Spesifikasi', kolom: [['Uraian', 'Uraian / Nama Barang', ['uraian', 'namabarang', 'jenisbarangjasa', 'item', 'barang', 'namabarangjasa', 'uraianpekerjaan']], ['Spesifikasi', 'Spesifikasi', ['spesifikasi', 'spek', 'spesifikasiteknis', 'merktipe']], ['Volume', 'Volume', ['volume', 'vol', 'jumlah', 'kuantitas', 'qty', 'banyaknya']], ['Satuan', 'Satuan', ['satuan', 'sat']], ['Harga_Satuan', 'Harga Satuan', ['hargasatuan', 'harga', 'hargasatuanrp']], ['Sumber_Harga', 'Sumber Harga', ['sumberharga', 'referensi', 'sumber']], ['Keterangan', 'Keterangan', ['keterangan', 'ket']]], wajib: ['Uraian'], angka: ['Volume', 'Harga_Satuan'] }
  },
  /** Tebak kolom target untuk tiap kolom sumber berdasarkan judul */
  tebak(header, def) {
    const pakai = {};
    return header.map((h) => { const n = this.normH(h); if (!n) return ''; const k = def.kolom.find((c) => !pakai[c[0]] && (c[2].indexOf(n) > -1 || this.normH(c[0]) === n)) || def.kolom.find((c) => !pakai[c[0]] && c[2].some((a) => a.length > 3 && (n.indexOf(a) > -1))); if (k) { pakai[k[0]] = 1; return k[0]; } return ''; });
  },
  /** Baris judul = baris pertama (dari 15 teratas) dengan kecocokan alias terbanyak */
  cariJudul(rows, def) { let best = 0, skor = -1; rows.slice(0, 15).forEach((r, i) => { const s = this.tebak(r, def).filter(Boolean).length; if (s > skor) { skor = s; best = i; } }); return best; },
  /** Mode DPA untuk PDF/Excel SIPD: baris berawalan kode 3/5/6+ segmen → program/kegiatan/sub kegiatan; pagu = angka terakhir di baris */
  dpa(rows) {
    const out = []; let prog = ['', ''], keg = ['', ''];
    const KODE = /^(\d+(?:\.\d+){2,})\b\s*(.*)$/;
    rows.forEach((r) => {
      const sel = r.map((c) => String(c || '').trim()).filter(Boolean); if (!sel.length) return;
      let kode = '', nama = '', sisa = [];
      for (let i = 0; i < sel.length; i++) { const m = sel[i].match(KODE); if (m) { kode = m[1]; nama = m[2]; sisa = sel.slice(i + 1); break; } }
      if (!kode) return;
      if (!nama) { const t = sisa.find((c) => /[A-Za-z]{3,}/.test(c)); nama = t || ''; }
      const nums = sisa.concat([nama]).map((c) => this.angka(c)).filter((n) => n !== '' && n >= 1000);
      const pagu = nums.length ? nums[nums.length - 1] : '';
      nama = nama.replace(/\s+[\d.,]{4,}$/, '').trim();
      const seg = kode.split('.').length;
      if (seg <= 3) prog = [kode, nama]; else if (seg <= 5) keg = [kode, nama];
      else out.push({ Kode_Program: prog[0], Nama_Program: prog[1], Kode_Kegiatan: keg[0], Nama_Kegiatan: keg[1], Kode_SubKeg: kode, Nama_SubKegiatan: nama, Pagu: pagu });
    });
    return out;
  },

  /* ---------- Dialog impor ---------- */
  /**
   * o = { target, extra:{...data tambahan untuk import.jalankan}, sheetUrl:bool, onDone(res) }
   */
  dialog(o) {
    const def = this.TARGET[o.target]; const st = { data: null, ti: 0, hr: 0, map: [], dpa: false };
    const m = modal({ title: 'Impor ' + def.judul, icon: 'upload', size: 'lg',
      body: `<div class="note info mb">${ic('info', 'sm')}<div>Pilih berkas <b>Excel, Word, PDF, atau CSV</b>. Berkas dibaca di perangkat ini, ditampilkan sebagai pratinjau, lalu Anda mencocokkan kolomnya. Klik <b>Pindai</b> untuk melihat hasil tanpa menyimpan, lalu <b>Jalankan Impor</b>.</div></div>
        <div class="drop" id="impDrop">${ic('upload')}<b>Tarik berkas ke sini atau klik untuk memilih</b><span class="mini">.xlsx · .xls · .docx · .pdf · .csv</span></div><input type="file" id="impFile" class="hidden" accept="${this.EXT}">
        ${o.sheetUrl ? `<div class="fg mt"><div class="f s8"><label>Atau tautan Google Sheets (hanya dibaca server)</label><input class="in" name="sheetUrl" placeholder="https://docs.google.com/spreadsheets/d/…"></div><div class="f s4"><label>Nama sheet</label><input class="in" name="namaSheet" placeholder="kosong = sheet pertama"></div></div>` : ''}
        <div id="impPrev" class="mt"></div><div id="impRes" class="mt"></div>`,
      foot: `<label class="check" style="margin-right:auto"><input type="checkbox" name="timpa"> ${o.target === 'pengadaanItem' ? 'Ganti semua item yang ada' : 'Perbarui data yang sudah ada'}</label><button class="btn" data-x>Tutup</button><button class="btn" data-run="1">${ic('search', 'sm')}Pindai</button><button class="btn pri" data-run="0">${ic('upload', 'sm')}Jalankan Impor</button>` });
    const prev = $('#impPrev', m.el);
    const draw = () => {
      if (!st.data) { prev.innerHTML = ''; return; }
      const tb = st.data.tables[st.ti]; if (!tb) { prev.innerHTML = `<div class="note warn">${ic('warn', 'sm')}<div>Tidak ditemukan tabel di berkas ini.</div></div>`; return; }
      const rows = tb.rows, head = rows[st.hr] || [], ncol = Math.max(...rows.slice(st.hr, st.hr + 30).map((r) => r.length), 1);
      const opts = [['', '— abaikan —']].concat(def.kolom.map((c) => [c[0], c[1] + (def.wajib.indexOf(c[0]) > -1 ? ' *' : '')]));
      const n = this.hasil().length;
      prev.innerHTML = `<div class="fg mb-s">${st.data.tables.length > 1 ? `<div class="f s6"><label>Tabel / sheet</label>${selectHtml('ti', st.data.tables.map((t, i) => [i, t.nama + ' (' + t.rows.length + ' baris)']), st.ti)}</div>` : ''}
          <div class="f s3"><label>Baris judul kolom</label>${selectHtml('hr', rows.slice(0, 20).map((r, i) => [i, 'Baris ' + (i + 1) + ': ' + r.filter(Boolean).slice(0, 2).join(' · ').slice(0, 30)]), st.hr)}</div>
          ${o.target === 'subkeg' ? `<div class="f s3"><label>Mode</label><label class="check" style="height:38px"><input type="checkbox" name="dpa" ${st.dpa ? 'checked' : ''}> Deteksi otomatis kode DPA</label></div>` : ''}</div>
        ${st.dpa ? `<div class="note info mb-s">${ic('info', 'sm')}<div>Mode DPA: baris berawalan kode 3 segmen dibaca sebagai <b>program</b>, 5 segmen sebagai <b>kegiatan</b>, 6 segmen atau lebih sebagai <b>sub kegiatan</b>; pagu = angka terakhir di baris. Ditemukan <b>${n}</b> sub kegiatan. Periksa hasilnya di bawah.</div></div>` : ''}
        <div class="tw" style="max-height:360px;overflow:auto"><table class="t light">${st.dpa ? `<thead><tr><th>Kode</th><th>Sub Kegiatan</th><th>Kegiatan</th><th>Program</th><th class="n">Pagu</th></tr></thead><tbody>${this.hasil().slice(0, 60).map((r) => `<tr><td class="mono">${esc(r.Kode_SubKeg)}</td><td>${esc(r.Nama_SubKegiatan)}</td><td>${esc(r.Nama_Kegiatan)}</td><td>${esc(r.Nama_Program)}</td><td class="n">${r.Pagu === '' ? '<span class="c-err">?</span>' : fmtN(r.Pagu)}</td></tr>`).join('')}</tbody>`
          : `<thead><tr>${[...Array(ncol).keys()].map((i) => `<th style="min-width:130px">${selectHtml('map' + i, opts, st.map[i] || '', 'data-col="' + i + '"')}<span class="sub" style="color:var(--text2);text-transform:none">${esc(head[i] || 'Kolom ' + (i + 1))}</span></th>`).join('')}</tr></thead><tbody>${rows.slice(st.hr + 1, st.hr + 13).map((r) => `<tr>${[...Array(ncol).keys()].map((i) => `<td>${esc(r[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody>`}</table></div>
        <p class="mini">${st.dpa ? '' : `Menampilkan 12 baris pertama dari ${Math.max(0, rows.length - st.hr - 1)} baris data. Kolom bertanda * wajib dipetakan.`} Siap dikirim: <b>${n}</b> baris.</p>`;
    };
    this.hasil = () => {
      if (!st.data) return [];
      const rows = st.data.tables[st.ti].rows;
      if (st.dpa) return this.dpa(rows);
      return rows.slice(st.hr + 1).map((r) => { const ob = {}; st.map.forEach((k, i) => { if (k) ob[k] = def.angka.indexOf(k) > -1 ? this.angka(r[i]) : String(r[i] || '').trim(); }); return ob; })
        .filter((ob) => def.wajib.every((k) => ob[k] !== '' && ob[k] != null) && !/^(jumlah|total|sub\s*total)/i.test(String(ob[def.wajib[0]] || '')));
    };
    const muat = async (file) => {
      prev.innerHTML = `<div class="sk" style="margin:10px 0"></div><p class="mini">Membaca ${esc(file.name)}…</p>`;
      try {
        st.data = await this.baca(file); st.ti = 0;
        const big = st.data.tables.reduce((b, t, i) => (t.rows.length > st.data.tables[b].rows.length ? i : b), 0); st.ti = big;
        st.hr = this.cariJudul(st.data.tables[st.ti].rows, def); st.map = this.tebak(st.data.tables[st.ti].rows[st.hr] || [], def);
        st.dpa = o.target === 'subkeg' && (st.data.tables[st.ti].pdf || st.map.filter(Boolean).length < 2) && this.dpa(st.data.tables[st.ti].rows).length > 0;
        draw();
      } catch (e) { st.data = null; prev.innerHTML = `<div class="note err">${ic('warn', 'sm')}<div>${esc(e.message || 'Gagal membaca berkas.')}</div></div>`; }
    };
    Upload.bind($('#impDrop', m.el), $('#impFile', m.el), (files) => muat(files[0]));
    m.el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'ti') { st.ti = num(t.value); st.hr = this.cariJudul(st.data.tables[st.ti].rows, def); st.map = this.tebak(st.data.tables[st.ti].rows[st.hr] || [], def); draw(); }
      if (t.name === 'hr') { st.hr = num(t.value); st.map = this.tebak(st.data.tables[st.ti].rows[st.hr] || [], def); draw(); }
      if (t.name === 'dpa') { st.dpa = t.checked; draw(); }
      if (t.dataset.col != null) { st.map[num(t.dataset.col)] = t.value; draw(); }
    });
    m.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-run]'); if (!b) return;
      const dry = b.dataset.run === '1', timpa = m.el.querySelector('[name=timpa]').checked;
      const url = m.el.querySelector('[name=sheetUrl]'), nama = m.el.querySelector('[name=namaSheet]');
      const data = Object.assign({ target: o.target, dryRun: dry, timpa, tahun: S.tahun }, o.extra || {});
      if (st.data) {
        const rows = this.hasil(); if (!rows.length) { toast('Belum ada baris yang valid. Petakan kolom wajib (bertanda *).', 'warn'); return; }
        const miss = def.wajib.filter((k) => !st.dpa && st.map.indexOf(k) < 0); if (miss.length) { toast('Kolom wajib belum dipetakan: ' + miss.join(', '), 'warn'); return; }
        const head = def.kolom.map((c) => c[0]).filter((k) => rows.some((r) => r[k] !== undefined && r[k] !== ''));
        data.csv = this.toCsv(head, rows.map((r) => head.map((k) => r[k])));
      } else if (url && url.value.trim()) { data.sheetUrl = url.value.trim(); data.namaSheet = nama.value.trim(); }
      else { toast('Pilih berkas atau isi tautan Google Sheets.', 'warn'); return; }
      if (!dry && !(await confirmBox('Jalankan impor ke database?' + (timpa ? ' Data yang ada akan ' + (o.target === 'pengadaanItem' ? 'diganti.' : 'diperbarui.') : ''), { ok: 'Jalankan' }))) return;
      b.classList.add('busy'); const r = await api('import.jalankan', data); b.classList.remove('busy');
      const box = $('#impRes', m.el);
      if (!r.success) { box.innerHTML = `<div class="note err">${ic('warn', 'sm')}<div>${esc(r.message)}</div></div>`; return; }
      const d = r.data || {}, rep = d.report || {};
      box.innerHTML = `<div class="note ${dry ? 'info' : 'ok'}">${ic(dry ? 'info' : 'check', 'sm')}<div><b>${dry ? 'Hasil pindai — belum ada yang disimpan' : 'Impor selesai'}</b>: sumber ${esc(rep.sumber || 0)} baris · ditambah <b>${esc(rep.ditambah || 0)}</b> · diperbarui <b>${esc(rep.diperbarui || 0)}</b> · dilewati ${esc(rep.dilewati || 0)}${d.nilaiHps != null ? ' · total HPS <b>' + rp(d.nilaiHps) + '</b>' : ''}</div></div>${(d.peringatan || []).length ? `<div class="note warn mt">${ic('warn', 'sm')}<div>${d.peringatan.map(esc).join('<br>')}</div></div>` : ''}`
        + ((d.sandiAwal || []).length ? `<div class="note warn mt">${ic('key', 'sm')}<div><b>Sandi awal pengguna baru — hanya tampil sekali, catat sekarang.</b><table class="t light mt"><thead><tr><th>Email</th><th>Sandi awal</th></tr></thead><tbody>${d.sandiAwal.map((x) => `<tr><td class="mono">${esc(x.email)}</td><td class="mono">${esc(x.sandi)}</td></tr>`).join('')}</tbody></table></div></div>` : '');
      if (!dry) { if (o.onDone) o.onDone(d); Sync.run({ force: true }); }
    });
    return m;
  }
};
