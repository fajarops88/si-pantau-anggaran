/* =====================================================================
   SI-PANTAU ANGGARAN — impor.js (v1.2)
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
    const token = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p); const tc = await page.getTextContent();
      tc.items.filter((it) => it.str && it.str.trim()).forEach((it) => token.push({ p, s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || it.str.length * 4, h: Math.abs(it.transform[3]) || 8 }));
    }
    const { rows, lines } = this.barisPdf(token);
    if (!rows.length) throw new Error('PDF tidak memiliki lapisan teks (hasil scan gambar). Gunakan PDF asli dari SIPD/aplikasi, atau Excel/Word.');
    return { tables: [{ nama: 'Teks PDF (' + pdf.numPages + ' hlm)', rows, pdf: true }], teks: lines.join('\n'), token };
  },
  /** Token pdf.js → baris teks (dikelompokkan per posisi vertikal; sel berdekatan digabung) */
  barisPdf(token) {
    const rows = [], lines = [];
    [...new Set(token.map((t) => t.p || 1))].sort((a, b) => a - b).forEach((p) => {
      const items = token.filter((t) => (t.p || 1) === p).map((t) => ({ s: t.s, x: t.x, y: Math.round(t.y), w: t.w, h: t.h || 8 }));
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const grp = []; items.forEach((it) => { const g = grp.find((x) => Math.abs(x.y - it.y) <= Math.max(2, it.h * 0.4)); if (g) g.it.push(it); else grp.push({ y: it.y, it: [it] }); });
      grp.sort((a, b) => b.y - a.y).forEach((g) => {
        g.it.sort((a, b) => a.x - b.x);
        const cells = []; let cur = null;
        g.it.forEach((it) => { const gap = cur ? it.x - (cur.x + cur.w) : 0; if (cur && gap < Math.max(6, it.h * 1.2)) { cur.s += (gap > 1 ? ' ' : '') + it.s; cur.w = it.x + it.w - cur.x; } else { cur = { s: it.s, x: it.x, w: it.w }; cells.push(cur); } });
        rows.push(cells.map((c) => c.s.trim())); lines.push(cells.map((c) => c.s.trim()).join(' '));
      });
    });
    return { rows, lines };
  },
  /* ---------- SIPD-RI: RKA/DPA Rincian Belanja per Sub Kegiatan (PDF) ----------
     Masukan: token teks pdf.js [{p, s, x, y, w, h}] (y = dari bawah halaman).
     Keluaran: { subkeg:{…}, rincian:[…], cek:{…}, perubahan, tahun, tahap, dicetak } atau null bila bukan format SIPD.
     Cara kerja: kolom tabel dikenali dari posisi judul kolom (Koefisien, Satuan, Harga, PPN, Jumlah, Bertambah);
     setiap baris tabel ditandai oleh angka di kolom Jumlah terakhir (isi sel rata-tengah vertikal), lalu token lain
     dipasangkan ke baris terdekat secara vertikal. Volume dihitung ulang = Jumlah ÷ (Harga × (1+PPN)). */
  sipd(items) {
    const T = (items || []).filter((i) => i && String(i.s || '').trim()).map((i) => ({ p: i.p || 1, s: String(i.s).replace(/\s+/g, ' ').trim(), x: +i.x, y: +i.y, w: +i.w || String(i.s).length * 5, h: +i.h || 10 }));
    const semua = T.map((t) => t.s).join(' ');
    if (!/Kode\s*Rekening/i.test(semua) || !/Sub\s*Kegiatan/i.test(semua) || !/Koefisien/i.test(semua)) return null;
    const UANG = /^-?\d{1,3}(\.\d{3})*,\d{2}$/;
    const rp = (s) => { const m = String(s || '').match(/-?[\d.]+,\d{2}/); return m ? Number(m[0].replace(/\./g, '').replace(',', '.')) : 0; };
    const kanan = (t) => t.x + t.w;
    const baris = (arr, tol) => { const g = []; arr.slice().sort((a, b) => b.y - a.y || a.x - b.x).forEach((t) => { const x = g.find((r) => Math.abs(r.y - t.y) <= (tol || 2.5)); if (x) x.t.push(t); else g.push({ y: t.y, t: [t] }); }); g.forEach((r) => r.t.sort((a, b) => a.x - b.x)); return g; };
    const gabungLebar = (ts) => ts.slice().sort((a, b) => b.y - a.y || a.x - b.x).map((t) => t.s).join(' ').replace(/\s+/g, ' ').trim();
    const gabungSempit = (ts) => { let s = ''; ts.slice().sort((a, b) => b.y - a.y || a.x - b.x).forEach((t) => { const a = t.s; if (!s) s = a; else if ((/\d$/.test(s) && /^\d/.test(a)) || (/[A-Za-z]$/.test(s) && /^[a-z]/.test(a))) s += a; else s += ' ' + a; }); return s.trim(); };
    const out = { subkeg: {}, rincian: [], cek: {}, perubahan: false, tahun: 0, tahap: '', dicetak: '' };

    // ---- Kop & identitas (halaman pertama yang memuat label "Sub Kegiatan") ----
    const m1 = semua.match(/Tahun Anggaran\s+(\d{4})/i); if (m1) out.tahun = +m1[1];
    const mf = semua.match(/SIPD[^:]*:\s*dicetak pada\s+([^|]+)\|\s*([^|]+?)\s*(\||$)/i);
    if (mf) { out.dicetak = mf[1].trim(); out.tahap = mf[2].trim(); }
    // v1.3.0: tanggal penandatanganan (mis. "Balikpapan,tanggal 31 Desember 2025") → saran tanggal penetapan
    const BLN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
    const mt = semua.match(/,\s*(?:tanggal\s+)?(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})/i);
    out.tglDok = mt ? mt[3] + '-' + String(BLN.indexOf(mt[2].toLowerCase()) + 1).padStart(2, '0') + '-' + String(+mt[1]).padStart(2, '0') : '';
    const p0 = (T.find((t) => /^Sub Kegiatan$/i.test(t.s)) || T[0]).p;
    const LBL = ['Urusan Pemerintahan', 'Bidang Urusan', 'Unit Organisasi', 'Sub Unit Organisasi', 'Program', 'Kegiatan', 'Sub Kegiatan', 'SPM', 'Jenis Layanan', 'Sumber Pendanaan', 'Lokasi', 'Waktu Pelaksanaan', 'Kelompok Sasaran', 'Keluaran Sub Kegiatan', 'Keterangan'];
    const kv = {};
    baris(T.filter((t) => t.p === p0)).forEach((r) => {
      const lab = r.t[0].s; const isi = r.t.slice(1).map((t) => t.s).join(' ').replace(/^:\s*/, '').trim();
      const ma = lab.match(/^Alokasi\s+(\d{4})$/i);
      if (ma) { kv['Alokasi ' + ma[1]] = isi; return; }
      if (LBL.indexOf(lab) > -1 && kv[lab] === undefined) kv[lab] = isi === '-' ? '' : isi;
    });
    const kodeNama = (v, re) => { const m = String(v || '').match(re); return m ? [m[1], m[2].trim()] : ['', String(v || '').trim()]; };
    const pr = kodeNama(kv.Program, /^([0-9X]\.[0-9X]{2}\.\d{2})\s+(.+)$/i), kg = kodeNama(kv.Kegiatan, /^([0-9X]\.[0-9X]{2}\.\d{2}\.\d\.\d{2})\s+(.+)$/i), sk = kodeNama(kv['Sub Kegiatan'], /^([0-9X]\.[0-9X]{2}\.\d{2}\.\d\.\d{2}\.\d{2,4})\s+(.+)$/i);
    if (!sk[0]) return null;
    if (!out.tahun) { const ys = Object.keys(kv).map((k) => (k.match(/^Alokasi (\d{4})$/) || [])[1]).filter(Boolean).map(Number).sort(); if (ys.length) out.tahun = ys[Math.floor(ys.length / 2)]; }
    const S = out.subkeg;
    Object.assign(S, { Tahun: out.tahun, Kode_Program: pr[0], Nama_Program: pr[1], Kode_Kegiatan: kg[0], Nama_Kegiatan: kg[1], Kode_SubKeg: sk[0], Nama_SubKegiatan: sk[1],
      Sumber_Dana: kv['Sumber Pendanaan'] || '', Lokasi: kv.Lokasi || '', Waktu_Pelaksanaan: kv['Waktu Pelaksanaan'] || '', Kelompok_Sasaran: kv['Kelompok Sasaran'] || '',
      Pagu: rp(kv['Alokasi ' + out.tahun]), Alokasi_Lalu: rp(kv['Alokasi ' + (out.tahun - 1)]), Alokasi_Depan: rp(kv['Alokasi ' + (out.tahun + 1)]),
      Tahap_Anggaran: out.tahap, Sumber_Import: 'SIPD-RI' + (out.dicetak ? ', dicetak ' + out.dicetak : '') });

    // ---- Indikator & tolok ukur kinerja (pakai kolom "Sesudah" bila dokumen perubahan) ----
    const tp = T.filter((t) => t.p === p0), labInd = ['Capaian Program', 'Masukan', 'Keluaran', 'Hasil'];
    const hInd = tp.find((t) => /^Indikator dan Tolak Ukur/i.test(t.s)), hRk = tp.find((t) => /^Rincian Anggaran Belanja Kegiatan$/i.test(t.s));
    if (hInd) {
      const zona = tp.filter((t) => t.y < hInd.y && (!hRk || t.y > hRk.y));
      const lab = zona.filter((t) => labInd.indexOf(t.s) > -1), kol = zona.filter((t) => t.s === 'Target Kinerja').sort((a, b) => a.x - b.x);
      const xs = lab.map((t) => t.x).sort((a, b) => a - b), xKiri = xs[xs.length - 1];
      const pakai = lab.filter((t) => Math.abs(t.x - xKiri) < 5), tgtX = kol.length ? kol[kol.length - 1].x - 40 : Infinity;
      const ind = {};
      zona.filter((t) => t.x > xKiri + 20 && labInd.indexOf(t.s) < 0 && !/^(Tolok Ukur Kinerja|Target Kinerja|Indikator|Sebelum|Sesudah)$/.test(t.s)).forEach((t) => {
        const l = pakai.reduce((b, x) => (!b || Math.abs(x.y - t.y) < Math.abs(b.y - t.y) ? x : b), null); if (!l) return;
        const o = ind[l.s] = ind[l.s] || { tolok: [], target: [] }; (t.x >= tgtX ? o.target : o.tolok).push(t);
      });
      const tx = (k, j) => (ind[k] ? gabungLebar(ind[k][j]).replace(/^:\s*/, '').replace(/^-$/, '') : '');
      const kel = tx('Keluaran', 'target'), mk = kel.match(/^([\d.,]+)\s*(.*)$/);
      S.Indikator = tx('Keluaran', 'tolok') || kv['Keluaran Sub Kegiatan'] || '';
      if (mk) { S.Target = this.angka(mk[1]); S.Satuan = mk[2].trim(); } else { S.Target = ''; S.Satuan = kel; }
      S.Capaian_Program = [tx('Capaian Program', 'tolok'), tx('Capaian Program', 'target')].filter(Boolean).join(' — ');
      S.Hasil = [tx('Hasil', 'tolok'), tx('Hasil', 'target')].filter(Boolean).join(' — ');
      out.perubahan = zona.some((t) => t.s === 'Sesudah');
      if (out.perubahan) { const mas = zona.filter((t) => t.x < xKiri && t.x > (xs[0] || 0) + 20).filter((t) => /^Rp/.test(t.s)); if (mas.length) S.Pagu_Sebelum = rp(mas[0].s); }
    } else S.Indikator = kv['Keluaran Sub Kegiatan'] || '';

    // ---- Tabel rincian belanja ----
    const pages = [...new Set(T.map((t) => t.p))].sort((a, b) => a - b);
    let kol = null, selesai = false; const rows = [];
    pages.forEach((p) => {
      if (selesai) return;
      const tk = T.filter((t) => t.p === p);
      const hKode = tk.find((t) => t.s === 'Kode Rekening');
      const lab = (n) => tk.filter((t) => t.s === n).sort((a, b) => a.x - b.x);
      if (hKode && lab('Koefisien').length) {
        const ko = lab('Koefisien'), sa = lab('Satuan'), ha = lab('Harga (Rp)'), pp = lab('PPN'), ju = lab('Jumlah (Rp)'), be = tk.find((t) => /^Bertambah/.test(t.s));
        const n = Math.min(ko.length, ju.length, 2);
        kol = { y: Math.min(...ko.map((t) => t.y)), kodeKanan: kanan(hKode) + 20, uraianBatas: ko[0].x - 3, set: [] };
        for (let i = 0; i < n; i++) kol.set.push({ ko: ko[i], sa: sa[i], ha: ha[i], pp: pp[i], ju: ju[i] });
        kol.uang = []; kol.set.forEach((c, i) => { if (c.ha) kol.uang.push({ k: 'ha' + i, r: kanan(c.ha) }); if (c.pp) kol.uang.push({ k: 'pp' + i, r: kanan(c.pp) }); kol.uang.push({ k: 'ju' + i, r: kanan(c.ju) }); });
        if (be && n === 2) kol.uang.push({ k: 'be', r: Math.max(kanan(be), ...tk.filter((t) => /^\(Berkurang\)/.test(t.s)).map(kanan)) });
        kol.teks = []; kol.set.forEach((c, i) => { kol.teks.push({ k: 'ko' + i, l: c.ko.x }); if (c.sa) kol.teks.push({ k: 'sa' + i, l: c.sa.x }); if (c.pp) kol.teks.push({ k: 'pp' + i, l: c.pp.x }); });
        out.perubahan = out.perubahan || n === 2;
      } else if (!kol) return;
      const atas = hKode ? kol.y - 3 : Infinity;
      const stops = tk.filter((t) => /^Jumlah Anggaran Sub Kegiatan/i.test(t.s)), stop = stops.length ? stops.reduce((a, b) => (b.y > a.y ? b : a)) : null;
      const bawah = stop ? stop.y + 3 : -Infinity;
      if (stop) { selesai = true; const tot = tk.filter((t) => UANG.test(t.s) && t.y <= stop.y + 3 && t.y > stop.y - 30).sort((a, b) => a.x - b.x); out.cek.totalDokumen = tot.map((t) => rp(t.s)); }
      const zona = tk.filter((t) => t.y < atas && t.y > bawah && !/^SIPD/.test(t.s) && !/^(Rincian Anggaran Belanja Sub Kegiatan|Satuan Kerja Perangkat Daerah|Rincian Perhitungan (Sebelum|Sesudah))$/.test(t.s));
      const akhir = 'ju' + (kol.set.length - 1);
      const kelas = (t) => {
        if (/^\d+(\.\d+)*$/.test(t.s) && t.x < kol.kodeKanan) return 'kode';
        if (kanan(t) <= kol.uraianBatas + 2 || t.x < kol.uraianBatas) return 'ur';
        if (UANG.test(t.s)) return kol.uang.reduce((b, c) => (!b || Math.abs(c.r - kanan(t)) < Math.abs(b.r - kanan(t)) ? c : b), null).k;
        return kol.teks.reduce((b, c) => (!b || Math.abs(c.l - t.x) < Math.abs(b.l - t.x) ? c : b), null).k;
      };
      const tag = zona.map((t) => ({ t, k: kelas(t) }));
      const jangkar = tag.filter((x) => x.k === akhir).map((x) => ({ y: x.t.y, sel: {} }));
      if (!jangkar.length) return;
      tag.forEach((x) => { const j = jangkar.reduce((b, a) => (!b || Math.abs(a.y - x.t.y) < Math.abs(b.y - x.t.y) ? a : b), null); (j.sel[x.k] = j.sel[x.k] || []).push(x.t); });
      jangkar.sort((a, b) => b.y - a.y).forEach((j) => rows.push(j.sel));
    });
    const iA = (kol ? kol.set.length : 1) - 1, iS = iA - 1;
    let rek = '', sumber = '';
    const pctPpn = (s) => { const m = String(s || '').match(/(\d+(?:[.,]\d+)?)\s*%/); return m ? Number(m[1].replace(',', '.')) : 0; };
    rows.forEach((c) => {
      const tx = (k, sempit) => (c[k] ? (sempit ? gabungSempit(c[k]) : gabungLebar(c[k])) : '');
      const kode = tx('kode'), ur = tx('ur'), r = { Jenis: '', Kode_Rekening: '', Uraian: '', Spesifikasi: '', Koefisien: tx('ko' + iA, 1), Koefisien_Sebelum: iS >= 0 ? tx('ko' + iS, 1) : '',
        Volume: '', Satuan: tx('sa' + iA, 1), Harga: c['ha' + iA] ? rp(tx('ha' + iA)) : '', PPN: tx('pp' + iA, 1).replace(/^-$/, ''), Jumlah: rp(tx('ju' + iA)), Jumlah_Sebelum: iS >= 0 && c['ju' + iS] ? rp(tx('ju' + iS)) : '', Sumber_Dana: '' };
      if (kode) { r.Jenis = 'REK'; r.Kode_Rekening = kode; r.Uraian = ur; if (kode.split('.').length >= 6) rek = kode; r.Koefisien = r.Satuan = ''; r.Harga = ''; }
      else if (/^\[\s*#\s*\]/.test(ur)) { const ms = ur.match(/Sumber Dana\s*:\s*(.+)$/i); sumber = ms ? ms[1].trim() : sumber; r.Jenis = 'KELOMPOK'; r.Uraian = ur.replace(/^\[\s*#\s*\]\s*/, '').replace(/\s*Sumber Dana\s*:.*$/i, '').trim(); r.Sumber_Dana = sumber; r.Kode_Rekening = rek; }
      else if (/^\[\s*-\s*\]/.test(ur)) { r.Jenis = 'KETERANGAN'; r.Uraian = ur.replace(/^\[\s*-\s*\]\s*/, '').trim(); r.Kode_Rekening = rek; r.Sumber_Dana = sumber; }
      else {
        r.Jenis = 'ITEM'; r.Kode_Rekening = rek; r.Sumber_Dana = sumber;
        const ix = ur.search(/Spesifikasi\s*:/i); r.Uraian = (ix > -1 ? ur.slice(0, ix) : ur).trim(); r.Spesifikasi = ix > -1 ? ur.slice(ix).replace(/^Spesifikasi\s*:\s*/i, '').trim() : '';
        const ppn = pctPpn(r.PPN), h = Number(r.Harga) || 0;
        if (h > 0) r.Volume = Math.round((r.Jumlah / (h * (1 + ppn / 100))) * 1e6) / 1e6;
        else { const mv = r.Koefisien.match(/^[\d.,]+/); r.Volume = mv ? Number(mv[0].replace(',', '.')) || 0 : 0; }
      }
      if (r.Jenis !== 'ITEM') { r.Koefisien = r.Koefisien_Sebelum = r.Satuan = r.PPN = ''; r.Harga = ''; }
      out.rincian.push(r);
    });
    const its = out.rincian.filter((r) => r.Jenis === 'ITEM'), r5 = out.rincian.find((r) => r.Jenis === 'REK' && r.Kode_Rekening.split('.').length === 1);
    out.cek.jumlahItem = its.length;
    out.cek.totalItem = Math.round(its.reduce((a, r) => a + (Number(r.Jumlah) || 0), 0) * 100) / 100;
    out.cek.totalRekening = r5 ? r5.Jumlah : out.cek.totalItem;
    if (!S.Pagu) S.Pagu = out.cek.totalRekening;
    out.cek.selisih = Math.round((out.cek.totalItem - S.Pagu) * 100) / 100;
    if (out.perubahan && !S.Pagu_Sebelum && r5) S.Pagu_Sebelum = r5.Jumlah_Sebelum;
    return out;
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
  /* ---------- Dokumen pengadaan (format Dishub: Instruksi PPK, HPS, Spesifikasi Teknis) ---------- */
  BULAN: { januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12 },
  tglId(s) { const m = String(s || '').match(/(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})/i); return m ? m[3] + '-' + String(this.BULAN[m[2].toLowerCase()]).padStart(2, '0') + '-' + m[1].padStart(2, '0') : ''; },
  /** Surat Instruksi PPK → isian paket (nomor, tanggal, RUP, kualifikasi, ijin usaha, dasar, pagu, waktu, lokasi) */
  tebakInstruksi(t) {
    t = String(t || '').replace(/\r/g, ''); const L = t.split('\n').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean), o = {};
    const val = (re) => { for (const l of L) { const m = l.match(re); if (m) return m[1].trim(); } return ''; };
    const nl = L.find((l) => /^Nomor\s*:/i.test(l));
    if (nl) o.Nomor_Instruksi = nl.replace(/^Nomor\s*:\s*/i, '').replace(/\s+[A-Z][A-Za-z ]+,\s*\d{1,2}\s+\w+\s+\d{4}.*$/, '').trim();
    o.Tgl_Instruksi = this.tglId((nl && nl.match(/,\s*(\d{1,2}\s+\w+\s+\d{4})/) || [])[1] || t.slice(0, 2000));
    o.Kode_RUP = val(/(?:Kode|ID)\s*RUP\s*:\s*([0-9A-Za-z.\-]+)/i);
    o.Kualifikasi = val(/^Kualifikasi(?:\s+Usaha)?\s*:\s*(.+)$/i);
    o.Ijin_Usaha = val(/^I[jz]in\s+Usaha\s*:\s*(.+)$/i);
    const pg = val(/^Pagu(?:\s+Dana)?\s*:\s*(.+)$/i); if (pg) o.Pagu_Paket = this.angka(pg);
    const wk = val(/^Waktu\s+Pelaksanaan\s*:\s*(\d+)/i); if (wk) o.Jangka_Waktu = Number(wk);
    o.Lokasi = val(/^Lokasi(?:\s+Pekerjaan)?\s*:\s*(.+)$/i);
    const i0 = L.findIndex((l) => /^Dasar\s*:?/i.test(l)), i1 = L.findIndex((l, i) => i > i0 && /instruksikan|sebagai berikut/i.test(l));
    if (i0 > -1) {
      const blok = L.slice(i0, i1 > -1 ? i1 : i0 + 25).join(' ').replace(/^Dasar\s*:?\s*/i, '').replace(/(^|\s)\d{1,2}\.(?=\s)/g, ' ').replace(/\s+/g, ' ').trim();
      const it = blok.split(/;\s*/).map((x) => x.trim()).filter(Boolean);
      if (it.length) o.Dasar_Instruksi = it.map((x, i) => x + (i < it.length - 1 ? ';' : '')).join('\n');
    }
    return o;
  },
  /** Dokumen Spesifikasi Teknis → { items:[{no, nama, spes, volume, satuan}], umum:{…} } */
  spekNarasi(t) {
    const L = String(t || '').replace(/\r/g, '').split('\n').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean), umum = {}, items = [];
    const ambil = (re, k) => { const l = L.find((x) => re.test(x)); if (!l) return; const v = l.replace(re, '').replace(/^[:\s]+/, '').trim(); if (v) umum[k] = v; };
    ambil(/^SPESIFIKASI FUNGSI UMUM/i, 'Spesifikasi_Fungsi'); ambil(/^JADWAL KEDATANGAN BARANG\/?\s*JASA/i, 'Jadwal_Kedatangan'); ambil(/^LOKASI KEDATANGAN BARANG\/?\s*JASA/i, 'Lokasi_Kedatangan');
    ambil(/^METODE PENGANTARAN\/?\s*PENGIRIMAN/i, 'Metode_Pengiriman'); ambil(/^PELAYANAN PENYEDIA/i, 'Pelayanan_Penyedia'); ambil(/^PELATIHAN DAN BANTUAN(\s+TEKNIS)?/i, 'Pelatihan_Teknis');
    ambil(/^PEMELIHARAAN/i, 'Pemeliharaan'); ambil(/^INFORMASI LAINNYA/i, 'Informasi_Lainnya');
    Object.keys(umum).forEach((k) => { umum[k] = umum[k].replace(/^BARANG\/JASA\s*/i, '').trim(); if (!umum[k]) delete umum[k]; });
    const a = L.findIndex((l) => /SPESIFIKASI MUTU/i.test(l)), b = L.findIndex((l, i) => i > a && /^SPESIFIKASI (JUMLAH|WAKTU|PELAYANAN)/i.test(l));
    const blok = L.slice(a > -1 ? a + 1 : 0, b > -1 ? b : L.length);
    const adaNomor = blok.some((l) => /^\d{1,2}\.\s+\S/.test(l));
    let cur = null, ln = '';
    blok.forEach((l, i) => {
      const m = l.match(/^(\d{1,2})\.\s+(.+)$/), labelSpes = /^[•·▪●]?\s*Spesifikasi\s*:?\s*$/i.test(l);
      const kepala = adaNomor ? !!m : (!labelSpes && /^[•·▪●]?\s*Spesifikasi\s*:?\s*$/i.test(blok[i + 1] || ''));
      if (kepala) { cur = { no: m ? +m[1] : items.length + 1, nama: (m ? m[2] : l).trim(), baris: [] }; items.push(cur); ln = ''; return; }
      if (!cur || labelSpes || (/[A-Z]/.test(l) && !/[a-z]/.test(l) && !/^[-•]/.test(l))) return;
      if (/^[a-z(]/.test(l) && cur.baris.length) { cur.baris[cur.baris.length - 1] += ' ' + l; return; }
      cur.baris.push(/^[-–•·]/.test(l) ? '- ' + l.replace(/^[-–•·]\s*/, '') : '- ' + l);
    });
    const jml = L.slice(L.findIndex((l) => /^SPESIFIKASI JUMLAH/i.test(l)) + 1);
    jml.forEach((l) => { const m = l.match(/^(\d{1,2})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([A-Za-z][\w/ ]{0,20})$/); if (!m) return; const it = items.find((x) => x.no === +m[1]); const vol = this.angka(m[3]);
      if (it) { it.volume = vol; it.satuan = m[4].trim(); } else if (!items.length || /^\d/.test(l)) items.push({ no: +m[1], nama: m[2], baris: [], volume: vol, satuan: m[4].trim() }); });
    return { items: items.map((x) => ({ no: x.no, nama: x.nama, spes: x.baris.join('\n'), volume: x.volume || '', satuan: x.satuan || '' })), umum };
  },
  /** Tabel item dari PDF (HPS / daftar barang): NO | URAIAN | VOL | SATUAN | HARGA | JUMLAH, sel ber-"Rp" & uraian terlipat ditangani */
  tabelItem(token) {
    const T0 = (token || []).filter((t) => t && String(t.s || '').trim()).map((t) => ({ p: t.p || 1, s: String(t.s).replace(/\s+/g, ' ').trim(), x: +t.x, y: +t.y, w: +t.w || 10 }))
      .sort((a, b) => a.p - b.p || b.y - a.y || a.x - b.x), T = [];
    T0.forEach((t) => { const q = T[T.length - 1]; if (q && q.p === t.p && Math.abs(q.y - t.y) < 1 && t.x - (q.x + q.w) < 1.5 && t.x >= q.x) { q.s += t.s; q.w = t.x + t.w - q.x; } else T.push(Object.assign({}, t)); });
    const LBL = [['no', /^(NO\.?|NOMOR)$/i], ['ur', /^(URAIAN|NAMA BARANG(\/JASA)?|JENIS BARANG(\/JASA)?|URAIAN (BARANG\/JASA|PEKERJAAN)|NAMA ITEM)$/i], ['vol', /^(VOL\.?|VOLUME|KUANTITAS|QTY|BANYAKNYA)$/i],
      ['sat', /^(SATUAN|SAT\.?)$/i], ['hrg', /^(HARGA( SATUAN)?( \(RP\))?)$/i], ['jml', /^(JUMLAH( HARGA)?( \(RP\))?|TOTAL)$/i]];
    const out = [['No', 'Uraian', 'Volume', 'Satuan', 'Harga Satuan', 'Jumlah']];
    [...new Set(T.map((t) => t.p))].forEach((p) => {
      const tk = T.filter((t) => t.p === p), ur = tk.find((t) => LBL[1][1].test(t.s)); if (!ur) return;
      const hd = tk.filter((t) => Math.abs(t.y - ur.y) < 5), cols = [];
      LBL.forEach(([k, re]) => { const h = hd.find((t) => re.test(t.s)); if (h) cols.push({ k, cx: h.x + h.w / 2, r: h.x + h.w }); });
      if (!cols.some((c) => c.k === 'vol' || c.k === 'sat')) return;
      cols.sort((a, b) => a.cx - b.cx);
      const bnd = cols.map((c, i) => (i === 0 ? -Infinity : c.k === 'ur' ? cols[i - 1].r + 4 : (cols[i - 1].cx + c.cx) / 2));
      // angka → pusat token; teks → tepi kiri (kolom uraian rata kiri dan bisa lebih lebar dari judulnya)
      const kolOf = (t) => { const ref = /^[\d.,]+$/.test(t.s) ? t.x + t.w / 2 : t.x + 1; let k = cols[0].k; cols.forEach((c, i) => { if (ref >= bnd[i]) k = c.k; }); return k; };
      const stop = tk.filter((t) => t.y < ur.y - 3 && /^(JUMLAH|TOTAL|SUB ?TOTAL|GRAND TOTAL)\b/i.test(t.s) && kolOf(t) !== 'jml' && kolOf(t) !== 'hrg').sort((a, b) => b.y - a.y)[0];
      const zona = tk.filter((t) => t.y < ur.y - 3 && (!stop || t.y > stop.y + 2) && !/^Rp\.?$/i.test(t.s));
      const kunci = cols.some((c) => c.k === 'no') ? 'no' : 'vol';
      const calon = zona.filter((t) => kolOf(t) === kunci && /^\d{1,6}([.,]\d+)?$/.test(t.s)).sort((a, b) => b.y - a.y), ank = [];
      calon.forEach((t) => { if (!ank.length) { if (ur.y - t.y < 150) ank.push({ y: t.y, sel: {} }); return; } const gaps = ank.slice(1).map((a, i) => ank[i].y - a.y), g = ank[ank.length - 1].y - t.y;
        const med = gaps.length ? gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0; if (g > 0.5 && (gaps.length ? g <= Math.max(3 * med, 40) : g < 150) && ank.length === calon.indexOf(t)) ank.push({ y: t.y, sel: {} }); });
      if (!ank.length) return;
      const gp = ank.length > 1 ? (ank[0].y - ank[ank.length - 1].y) / (ank.length - 1) : 20, bawah = ank[ank.length - 1].y - Math.min(30, gp * 0.6);
      zona.filter((t) => t.y > bawah && t.y < ank[0].y + Math.min(30, gp * 0.6) + 4).forEach((t) => { const a = ank.reduce((b, x) => (!b || Math.abs(x.y - t.y) < Math.abs(b.y - t.y) ? x : b), null); const k = kolOf(t); (a.sel[k] = a.sel[k] || []).push(t); });
      ank.sort((a, b) => b.y - a.y).forEach((a) => { const g = (k) => (a.sel[k] || []).sort((x, y) => y.y - x.y || x.x - y.x).map((t) => t.s.replace(/^Rp\.?\s*/i, '')).join(' ').trim();
        out.push([g('no'), g('ur'), g('vol'), g('sat'), g('hrg'), g('jml')]); });
    });
    return out.length > 1 ? { nama: 'Tabel item dari PDF', rows: out, pdf: true } : null;
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
  angka(v) { let s = String(v == null ? '' : v).replace(/[^0-9.,-]/g, '').replace(/^[.,]+/, ''); if (!s) return ''; if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/[.,](?=\d{3}(\D|$))/g, ''); const n = Number(s); return isFinite(n) ? n : ''; },
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
    // Hanya kode struktur program (urusan.bidang.program[.x.kegiatan[.subkegiatan]]), BUKAN kode rekening belanja 5.x.xx…
    const KODE = /^([0-9X]\.[0-9X]{2}\.\d{2}(?:\.\d\.\d{2}(?:\.\d{2,4})?)?)(?![.\d])\s*(.*)$/i;
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
      else { const sg = kode.split('.'), kk = sg.slice(0, 5).join('.'), kp = sg.slice(0, 3).join('.');
        out.push({ Kode_Program: kp, Nama_Program: prog[0] === kp ? prog[1] : '', Kode_Kegiatan: kk, Nama_Kegiatan: keg[0] === kk ? keg[1] : '', Kode_SubKeg: kode, Nama_SubKegiatan: nama, Pagu: pagu }); }
    });
    return out;
  },

  /** Ringkasan hasil baca PDF SIPD (satu baris per Sub Kegiatan) */
  sipdPreview(list) {
    const ok = list.filter((x) => x.h), salah = list.filter((x) => !x.h), th = ok.map((x) => x.h.tahun).filter((t) => t && t !== S.tahun);
    return `<div class="note info mb-s">${ic('info', 'sm')}<div>Format <b>SIPD-RI RKA/DPA Rincian Belanja</b> dikenali: ${ok.length} Sub Kegiatan${ok.some((x) => x.h.perubahan) ? ' (dokumen <b>perubahan</b>: dipakai kolom <i>Sesudah</i>, nilai <i>Sebelum</i> ikut disimpan)' : ''}. Bidang & Pejabat PIC Sub Kegiatan baru diisi setelah impor.</div></div>
      ${th.length ? `<div class="note warn mb-s">${ic('warn', 'sm')}<div>Tahun dokumen (${[...new Set(th)].join(', ')}) berbeda dengan tahun aktif aplikasi (${S.tahun}). Data masuk ke tahun sesuai dokumen.</div></div>` : ''}
      <div class="tw" style="max-height:360px;overflow:auto"><table class="t light"><thead><tr><th>Kode & Sub Kegiatan</th><th>Program / Kegiatan</th><th>Indikator keluaran</th><th class="n">Pagu (Rp)</th><th class="c">Rincian</th><th class="c">Cek total</th></tr></thead><tbody>
      ${ok.map((x) => { const s = x.h.subkeg, c = x.h.cek; const cocok = Math.abs(c.selisih) <= 1; return `<tr><td><span class="mono">${esc(s.Kode_SubKeg)}</span><span class="sub"><b>${esc(s.Nama_SubKegiatan)}</b></span><span class="sub mini">${esc(x.nama)}</span></td><td class="mini">${esc(s.Kode_Program + ' ' + s.Nama_Program)}<br>${esc(s.Kode_Kegiatan + ' ' + s.Nama_Kegiatan)}</td><td class="mini">${esc(s.Indikator || '-')}<br><b>${esc(fmtN(s.Target || 0, 2).replace(/,00$/, ''))} ${esc(s.Satuan || '')}</b></td><td class="n">${fmtN(s.Pagu)}${s.Pagu_Sebelum ? `<span class="sub">sebelum ${fmtN(s.Pagu_Sebelum)}</span>` : ''}</td><td class="c">${c.jumlahItem} item<span class="sub">${x.h.rincian.length} baris</span></td><td class="c">${cocok ? chip('Σ item = pagu', 'ok') : chip('selisih ' + fmtN(c.selisih, 2), 'err')}</td></tr>`; }).join('')}
      ${salah.map((x) => `<tr class="c-mut"><td colspan="6">${ic('warn', 'sm')} ${esc(x.nama)} — ${esc(x.err)}</td></tr>`).join('')}</tbody></table></div>
      <p class="mini">Klik <b>Pindai</b> untuk memeriksa tanpa menyimpan. <b>DPA Murni</b>: Sub Kegiatan yang sudah ada hanya diganti bila "Perbarui data yang sudah ada" dicentang. <b>Pergeseran/Perubahan</b>: Sub Kegiatan yang sudah ada diperbarui bila nilai Sebelum sama dengan versi aktif; versi lama disimpan.</p>`;
  },
  /** v1.3.0: isian versi penetapan DPA (wajib) */
  versiForm(list) {
    const ok = list.filter((x) => x.h), seb = ok.some((x) => x.h.perubahan), tg = [...new Set(ok.map((x) => x.h.tglDok).filter(Boolean))];
    return `<div class="card-b" style="padding:12px;border:1px solid var(--line);border-radius:var(--r)"><div class="lbl mb-s">${ic('review', 'sm')}Versi penetapan DPA <span class="req">*</span></div><div class="fg">
      ${fld({ name: 'Jenis_Versi', label: 'Jenis dokumen', type: 'select', span: 's4', req: true, value: '', opts: [['', '— pilih —'], ['MURNI', 'DPA Murni'], ['PERGESERAN', 'DPA Pergeseran'], ['PERUBAHAN', 'DPA Perubahan']],
        hint: seb ? 'Dokumen memiliki kolom Sebelum/Sesudah → Pergeseran atau Perubahan.' : 'Dokumen tanpa kolom Sebelum/Sesudah → DPA Murni.' })}
      ${fld({ name: 'Tgl_Penetapan', label: 'Tanggal penetapan', type: 'date', span: 's4', req: true, value: tg.length === 1 ? tg[0] : '', hint: tg.length === 1 ? 'Dibaca dari dokumen — periksa kembali.' : 'Isi sesuai tanggal pada dokumen yang ditandatangani.' })}
      ${fld({ name: 'No_Dokumen', label: 'Nomor dokumen (opsional)', span: 's4', ph: 'DPA/A.1/…' })}
      <div class="f"><label class="check"><input type="checkbox" name="Ditetapkan"> Dokumen sudah ditandatangani dan bertanggal penetapan</label><div class="hint">Dokumen yang belum ditetapkan tidak dapat diimpor. Pagu aktif dan batas realisasi mengikuti penetapan terakhir.</div></div></div></div>`;
  },

  /* ---------- Dialog impor ---------- */
  /**
   * o = { target, extra:{...data tambahan untuk import.jalankan}, sheetUrl:bool, onDone(res) }
   */
  dialog(o) {
    const def = this.TARGET[o.target]; const st = { data: null, ti: 0, hr: 0, map: [], dpa: false, sipd: null };
    const m = modal({ title: 'Impor ' + def.judul, icon: 'upload', size: 'lg',
      body: `<div class="note info mb">${ic('info', 'sm')}<div>Pilih berkas <b>Excel, Word, PDF, atau CSV</b>. Berkas dibaca di perangkat ini, ditampilkan sebagai pratinjau, lalu Anda mencocokkan kolomnya. Klik <b>Pindai</b> untuk melihat hasil tanpa menyimpan, lalu <b>Jalankan Impor</b>.</div></div>
        <div class="drop" id="impDrop">${ic('upload')}<b>Tarik berkas ke sini atau klik untuk memilih</b><span class="mini">.xlsx · .xls · .docx · .pdf · .csv${o.target === 'subkeg' ? ' — PDF RKA/DPA Rincian Belanja dari SIPD-RI dikenali otomatis; boleh pilih banyak berkas sekaligus' : ''}</span></div><input type="file" id="impFile" class="hidden" accept="${this.EXT}" ${o.target === 'subkeg' ? 'multiple' : ''}>
        ${o.sheetUrl ? `<div class="fg mt"><div class="f s8"><label>Atau tautan Google Sheets (hanya dibaca server)</label><input class="in" name="sheetUrl" placeholder="https://docs.google.com/spreadsheets/d/…"></div><div class="f s4"><label>Nama sheet</label><input class="in" name="namaSheet" placeholder="kosong = sheet pertama"></div></div>` : ''}
        <div id="impPrev" class="mt"></div><div id="impVersi" class="mt hidden"></div><div id="impRes" class="mt"></div>`,
      foot: `<label class="check" style="margin-right:auto"><input type="checkbox" name="timpa"> ${o.target === 'pengadaanItem' ? 'Ganti semua item yang ada' : 'Perbarui data yang sudah ada'}</label><button class="btn" data-x>Tutup</button><button class="btn" data-run="1">${ic('search', 'sm')}Pindai</button><button class="btn pri" data-run="0">${ic('upload', 'sm')}Jalankan Impor</button>` });
    const prev = $('#impPrev', m.el);
    const vBox = $('#impVersi', m.el);
    const draw = () => {
      if (st.sipd) { prev.innerHTML = this.sipdPreview(st.sipd); if (!vBox.dataset.isi) { vBox.innerHTML = this.versiForm(st.sipd); vBox.dataset.isi = '1'; } vBox.classList.remove('hidden'); return; }
      vBox.classList.add('hidden'); vBox.innerHTML = ''; delete vBox.dataset.isi;
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
    const muatBanyak = async (files) => {
      files = [...files];
      const pdfs = files.filter((f) => this.ext(f) === 'pdf');
      if (o.target === 'subkeg' && pdfs.length) {
        prev.innerHTML = `<div class="sk" style="margin:10px 0"></div><p class="mini">Membaca ${pdfs.length} PDF…</p>`;
        const hasil = [];
        for (const f of pdfs) { try { const b = await this.baca(f); const h = this.sipd(b.token); hasil.push(h ? { nama: f.name, h } : { nama: f.name, err: 'Bukan format SIPD Rincian Belanja.' , b }); } catch (e) { hasil.push({ nama: f.name, err: e.message }); } }
        if (hasil.some((x) => x.h)) { st.sipd = hasil; st.data = null; draw(); return; }
        if (pdfs.length === 1 && hasil[0].b) { st.sipd = null; return muat(pdfs[0], hasil[0].b); }
      }
      st.sipd = null; return muat(files[0]);
    };
    const muat = async (file, sudah) => {
      prev.innerHTML = `<div class="sk" style="margin:10px 0"></div><p class="mini">Membaca ${esc(file.name)}…</p>`;
      try {
        st.data = sudah || await this.baca(file); st.ti = 0;
        if (o.target === 'pengadaanItem' && st.data.token) { const ti = this.tabelItem(st.data.token); if (ti) st.data.tables.unshift(ti); }
        const big = st.data.tables[0].nama === 'Tabel item dari PDF' ? 0 : st.data.tables.reduce((b, t, i) => (t.rows.length > st.data.tables[b].rows.length ? i : b), 0); st.ti = big;
        st.hr = this.cariJudul(st.data.tables[st.ti].rows, def); st.map = this.tebak(st.data.tables[st.ti].rows[st.hr] || [], def);
        st.dpa = o.target === 'subkeg' && (st.data.tables[st.ti].pdf || st.map.filter(Boolean).length < 2) && this.dpa(st.data.tables[st.ti].rows).length > 0;
        draw();
      } catch (e) { st.data = null; prev.innerHTML = `<div class="note err">${ic('warn', 'sm')}<div>${esc(e.message || 'Gagal membaca berkas.')}</div></div>`; }
    };
    Upload.bind($('#impDrop', m.el), $('#impFile', m.el), (files) => muatBanyak(files));
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
      if (st.sipd) {
        const ok = st.sipd.filter((x) => x.h); if (!ok.length) { toast('Tidak ada dokumen SIPD yang terbaca.', 'warn'); return; }
        const vv = formVals(vBox);
        if (!vv.Jenis_Versi) { toast('Pilih jenis dokumen: DPA Murni, Pergeseran, atau Perubahan.', 'warn'); return; }
        if (!vv.Tgl_Penetapan) { toast('Isi tanggal penetapan dokumen.', 'warn'); return; }
        if (!vv.Ditetapkan) { toast('Centang konfirmasi bahwa dokumen sudah ditandatangani dan bertanggal penetapan.', 'warn'); return; }
        const nmV = { MURNI: 'DPA Murni', PERGESERAN: 'DPA Pergeseran', PERUBAHAN: 'DPA Perubahan' }[vv.Jenis_Versi];
        if (!dry && !(await confirmBox('Impor ' + ok.length + ' Sub Kegiatan sebagai <b>' + nmV + '</b> (ditetapkan ' + esc(tglP(vv.Tgl_Penetapan)) + ')?' + (vv.Jenis_Versi === 'MURNI' ? (timpa ? ' DPA Murni yang sudah ada akan diganti (versi lama disimpan di arsip).' : '') : ' Pagu Sub Kegiatan yang sudah ada diganti dengan nilai Sesudah; versi sebelumnya disimpan. Rekening yang realisasinya melebihi pagu baru masuk Tindak Lanjut Pagu.'), { ok: 'Jalankan' }))) return;
        b.classList.add('busy'); const r = await api('dpa.imporSipd', { Tahun: S.tahun, dryRun: dry, timpa, Jenis_Versi: vv.Jenis_Versi, Tgl_Penetapan: vv.Tgl_Penetapan, No_Dokumen: vv.No_Dokumen, Ditetapkan: !!vv.Ditetapkan, daftar: ok.map((x) => ({ subkeg: x.h.subkeg, rincian: x.h.rincian, perubahan: !!x.h.perubahan })) }); b.classList.remove('busy');
        const box = $('#impRes', m.el);
        if (!r.success) { box.innerHTML = `<div class="note err">${ic('warn', 'sm')}<div>${esc(r.message)}</div></div>`; return; }
        const d = r.data || {}, rep = d.report || {};
        box.innerHTML = `<div class="note ${dry ? 'info' : 'ok'}">${ic(dry ? 'info' : 'check', 'sm')}<div><b>${dry ? 'Hasil pindai — belum ada yang disimpan' : 'Impor SIPD selesai'}</b>: ${esc(rep.sumber || 0)} dokumen · ditambah <b>${esc(rep.ditambah || 0)}</b> · diperbarui <b>${esc(rep.diperbarui || 0)}</b> · dilewati ${esc(rep.dilewati || 0)} · ${esc(fmtN(d.rincian || 0))} baris rincian belanja${d.versi ? ' · versi <b>' + esc(nmV) + '</b>' : ''}</div></div>${(d.peringatan || []).length ? `<div class="note warn mt">${ic('warn', 'sm')}<div>${d.peringatan.map(esc).join('<br>')}</div></div>` : ''}${(d.tandaMerah || []).length ? `<div class="note err mt">${ic('flag', 'sm')}<div><b>${d.tandaMerah.length} rekening realisasinya melebihi pagu ${esc(nmV)}</b>${dry ? ' (akan masuk Tindak Lanjut Pagu bila dijalankan)' : ' → <a href="#/tindaklanjut" data-x>buka Tindak Lanjut Pagu</a>'}:<br>${d.tandaMerah.map(esc).join('<br>')}</div></div>` : ''}`;
        if (!dry) { RB.reset(); if (o.onDone) o.onDone(d); Sync.run({ force: true }); }
        return;
      }
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
