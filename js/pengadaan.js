/* =====================================================================
   SI-PANTAU ANGGARAN — pengadaan.js (v1.2)
   Pengadaan Barang/Jasa (sebelum Kontrak): Instruksi PPK ke Pejabat Pengadaan,
   HPS, Spesifikasi Teknis — impor Excel/Word/PDF, cetak Word/Excel/PDF, arsip.
   ===================================================================== */
'use strict';
const PK = {
  JENIS: { BARANG: 'Barang', KONSTRUKSI: 'Pekerjaan Konstruksi', KONSULTANSI: 'Jasa Konsultansi', JASA_LAINNYA: 'Jasa Lainnya' },
  ST: { DRAF: ['Draf', 'slate'], DIINSTRUKSIKAN: ['Diinstruksikan', 'info'], PROSES: ['Proses Pemilihan', 'warn'], SELESAI: ['Berkontrak', 'ok'], BATAL: ['Batal', 'err'] },
  items(id) { return S.t.pengadaanItem.filter((i) => i.ID_Paket === id).sort((a, b) => num(a.No) - num(b.No)); },
  /** termasuk='YA' → harga satuan sudah termasuk PPN (praktik HPS Dishub): total = Σ, PPN dihitung di dalamnya. */
  hitung(items, ppn, termasuk) {
    const j = items.reduce((a, i) => a + num(i.Volume) * num(i.Harga_Satuan), 0), r = num(ppn) / 100;
    if (termasuk === 'YA') { const total = Math.round(j), dpp = Math.round(total / (1 + r)); return { sub: dpp, ppn: total - dpp, total, termasuk: true }; }
    const p = Math.round(j * r); return { sub: j, ppn: p, total: Math.round(j + p), termasuk: false };
  },
  KUALIFIKASI: ['Kecil', 'Non-Kecil'],
  bisaUbah(p) { const sk = Store.get('subkeg', p.ID_SubKeg); return Can.role('ADMIN', 'PEJABAT', 'STAF') && Can.bidangOk(sk && sk.Bidang) && (!p.ID_Kontrak || Can.admin()); },
  docs(id) { return S.t.arsip.filter((a) => a.ID_Paket === id); },
  gen(id) { return S.t.dokumen.filter((d) => d.ID_Paket === id); }
};

Pages.add({
  id: 'pengadaan', title: 'Pengadaan Barang/Jasa', icon: 'gavel', nav: true, group: 'Menu Utama', short: 'Pengadaan', after: 'perencanaan',
  render(el, q, st) {
    if (q.id && Store.get('pengadaan', q.id)) return this.detail(el, q, st);
    st.cari = st.cari || ''; st.bidang = st.bidang || ''; st.status = st.status || ''; st.jenis = st.jenis || '';
    const all = S.t.pengadaan, aktif = all.filter((p) => p.Status !== 'BATAL');
    const pagu = aktif.reduce((a, p) => a + num(p.Pagu_Paket), 0), hps = aktif.reduce((a, p) => a + num(p.Nilai_HPS), 0);
    const belum = aktif.filter((p) => !p.ID_Kontrak).length, tanpaHps = aktif.filter((p) => !PK.items(p.ID_Paket).length).length;
    el.innerHTML = ph({ eyebrow: 'Persiapan Pengadaan · Sebelum Kontrak', eyebrowIc: 'gavel', title: 'Pengadaan Barang/Jasa', desc: 'Instruksi PPK kepada Pejabat Pengadaan, Harga Perkiraan Sendiri (HPS), dan Spesifikasi Teknis per paket pekerjaan, sampai paket ditautkan ke kontrak.',
      acts: `<button class="btn" data-act="xls">${ic('download', 'sm')}Export Excel</button>` + (Can.role('ADMIN', 'PEJABAT', 'STAF') ? `<button class="btn gold" data-act="add">${ic('add', 'sm')}Tambah Paket</button>` : '') }) +
      `<div class="grid g4 mb">${kpi({ l: 'Paket pengadaan aktif', i: 'gavel', v: aktif.length + ' <small>paket</small>', s: belum + ' belum berkontrak' })}${kpi({ l: 'Total pagu paket', i: 'bank', v: rpS(pagu), title: rp(pagu) })}${kpi({ l: 'Total nilai HPS', i: 'receipt', v: rpS(hps), bar: pagu ? (hps / pagu) * 100 : 0, barCls: 'gold', s: pct(pagu ? (hps / pagu) * 100 : 0) + ' dari pagu paket' })}${kpi({ l: 'Kelengkapan', i: 'checklist', gold: true, v: (aktif.length - tanpaHps) + ' <small>/ ' + aktif.length + ' ber-HPS</small>', s: tanpaHps ? chip(tanpaHps + ' paket belum ada HPS', 'warn') : chip('Semua paket ber-HPS', 'ok') })}</div>
      <div class="card mb"><div class="filters"><div class="search">${ic('search')}<input class="in" name="cari" placeholder="Cari nama paket, nomor instruksi, sub kegiatan…" value="${esc(st.cari)}"></div>${selectHtml('bidang', optBidang(), st.bidang)}${selectHtml('jenis', [['', 'Semua Jenis']].concat(Object.keys(PK.JENIS).map((k) => [k, PK.JENIS[k]])), st.jenis)}${selectHtml('status', [['', 'Semua Status']].concat(Object.keys(PK.ST).map((k) => [k, PK.ST[k][0]])), st.status)}</div></div>
      <div class="card" id="tbl"></div>`;
    const draw = () => {
      const c = norm(st.cari);
      const rows = all.filter((p) => { const sk = Store.get('subkeg', p.ID_SubKeg) || {}; return (!st.bidang || sameBidang(sk.Bidang, st.bidang)) && (!st.jenis || p.Jenis_Pengadaan === st.jenis) && (!st.status || p.Status === st.status) && (!c || norm([p.Nama_Paket, p.Kode_Rekening, p.Nomor_Instruksi, sk.Nama_SubKegiatan, sk.Kode_SubKeg].join(' ')).indexOf(c) > -1); }).sort(byKey('Nama_Paket'));
      if (!rows.length) { $('#tbl').innerHTML = emptyBox(all.length ? 'Tidak ada paket yang cocok' : 'Belum ada paket pengadaan', all.length ? 'Ubah filter.' : 'Tambah paket untuk menyusun instruksi, HPS, dan spesifikasi teknis sebelum kontrak.', !all.length && Can.role('ADMIN', 'PEJABAT', 'STAF') ? `<button class="btn gold mt" data-act="add">${ic('add', 'sm')}Tambah Paket</button>` : ''); return; }
      $('#tbl').innerHTML = `<div class="tw"><table class="t"><thead><tr><th>Paket pekerjaan</th><th>Sub kegiatan</th><th>Jenis / metode</th><th class="n">Pagu paket (Rp)</th><th class="n">HPS / Ref. Harga (Rp)</th><th class="c">Dokumen</th><th class="c">Status</th><th></th></tr></thead><tbody>${rows.map((p) => {
        const sk = Store.get('subkeg', p.ID_SubKeg) || {}, it = PK.items(p.ID_Paket), k = p.ID_Kontrak ? Store.get('kontrak', p.ID_Kontrak) : null, lebih = num(p.Nilai_HPS) > num(p.Pagu_Paket);
        const dot = (ok, t) => `<span class="chip ${ok ? 'ok' : 'slate'}" title="${t}">${ok ? '✓' : '·'} ${t}</span>`;
        return `<tr class="click ${lebih ? 'flag' : ''}" data-id="${esc(p.ID_Paket)}"><td style="min-width:220px"><b>${esc(p.Nama_Paket)}</b>${p.Kode_Rekening ? `<span class="sub mono">Rek. ${esc(p.Kode_Rekening)}</span>` : ''}<span class="sub">${p.Nomor_Instruksi ? 'Instruksi ' + esc(p.Nomor_Instruksi) + ' · ' + tgl(p.Tgl_Instruksi) : 'Belum ada nomor instruksi'}</span>${k ? `<span class="sub c-ok">${ic('link', 'sm')} ${esc(k.No_SPK)}</span>` : ''}</td>
          <td style="min-width:180px"><span class="mono c-warn">${esc(sk.Kode_SubKeg || '')}</span><span class="sub">${esc(sk.Nama_SubKegiatan || '-')}</span></td><td>${esc(PK.JENIS[p.Jenis_Pengadaan] || '-')}<span class="sub">${esc(p.Metode || '')}</span></td>
          <td class="n">${fmtN(p.Pagu_Paket)}</td><td class="n"><b class="${lebih ? 'c-err' : ''}">${fmtN(p.Nilai_HPS)}</b><span class="sub">${it.length} item · PPN ${fmtN(p.PPN_Persen)}%</span></td>
          <td class="c" style="white-space:nowrap">${dot(!!p.Nomor_Instruksi, 'Instruksi')} ${dot(it.length > 0, Aturan.harga(p).kode === 'REF' ? 'Ref. Harga' : 'HPS')} ${dot(it.some((i) => i.Spesifikasi), 'Spek')}</td><td class="c">${stChip(PK.ST, p.Status)}${p._pending ? '<span class="sub">menyimpan…</span>' : ''}</td><td class="acts"><button class="btn ghost icon" data-id="${esc(p.ID_Paket)}" title="Buka">${ic('right', 'sm')}</button></td></tr>`; }).join('')}</tbody></table></div>`;
    };
    draw();
    el.oninput = debounce((e) => { if (e.target.name === 'cari') { st.cari = e.target.value; draw(); } }, 120);
    el.onchange = (e) => { if (['bidang', 'jenis', 'status'].indexOf(e.target.name) > -1) { st[e.target.name] = e.target.value; draw(); } };
    el.onclick = (e) => {
      const a = e.target.closest('[data-act]'); if (a && a.dataset.act === 'add') return Pages.formPaket();
      if (a && a.dataset.act === 'xls') return exportXlsx('Pengadaan_' + S.tahun, [{ name: 'Paket', cols: [36, 24, 18, 16, 20, 16, 16, 8, 22, 14, 18], aoa: [['Nama_Paket', 'Kode_Rekening', 'Kode_SubKeg', 'Jenis', 'Metode', 'Pagu_Paket', 'Nilai_HPS', 'PPN_%', 'Nomor_Instruksi', 'Status', 'No_SPK']].concat(all.map((p) => [p.Nama_Paket, p.Kode_Rekening || '', (Store.get('subkeg', p.ID_SubKeg) || {}).Kode_SubKeg, PK.JENIS[p.Jenis_Pengadaan] || '', p.Metode, p.Pagu_Paket, p.Nilai_HPS, p.PPN_Persen, p.Nomor_Instruksi, (PK.ST[p.Status] || [''])[0], ((Store.get('kontrak', p.ID_Kontrak) || {}).No_SPK) || ''])) },
        { name: 'Item HPS', cols: [36, 5, 36, 44, 10, 10, 16, 16, 24], aoa: [['Paket', 'No', 'Uraian', 'Spesifikasi', 'Volume', 'Satuan', 'Harga_Satuan', 'Jumlah', 'Sumber_Harga']].concat(S.t.pengadaanItem.map((i) => [(Store.get('pengadaan', i.ID_Paket) || {}).Nama_Paket, i.No, i.Uraian, i.Spesifikasi, i.Volume, i.Satuan, i.Harga_Satuan, num(i.Volume) * num(i.Harga_Satuan), i.Sumber_Harga])) }]);
      const r = e.target.closest('[data-id]'); if (r) App.go('#/pengadaan?id=' + r.dataset.id);
    };
  },

  /* ---------------- Detail paket ---------------- */
  detail(el, q, st) {
    const p = Store.get('pengadaan', q.id), sk = Store.get('subkeg', p.ID_SubKeg) || {}, bisa = PK.bisaUbah(p);
    st.tab = q.tab || st.tab || 'instruksi'; if (st.dirtyId !== p.ID_Paket) { st.items = null; st.dirtyId = p.ID_Paket; }
    const k = p.ID_Kontrak ? Store.get('kontrak', p.ID_Kontrak) : null, hg = Aturan.harga(p);
    el.innerHTML = `<div class="row mb-s no-print"><a class="btn sm ghost" href="#/pengadaan">${ic('left', 'sm')}Daftar paket</a></div>` +
      ph({ eyebrow: (PK.JENIS[p.Jenis_Pengadaan] || 'Pengadaan') + ' · ' + (p.Metode || 'metode belum diisi'), eyebrowIc: 'gavel', title: p.Nama_Paket, desc: `${esc(skLabel(sk))}${p.Kode_Rekening ? ` · Rek. <span class="mono">${esc(p.Kode_Rekening)}</span>` : ''} · Pagu paket <b>${rp(p.Pagu_Paket)}</b> · ${hg.singkat} <b>${rp(p.Nilai_HPS)}</b>`,
        acts: `${stChip(PK.ST, p.Status)}${bisa ? `<button class="btn" data-act="edit">${ic('edit', 'sm')}Ubah paket</button>` : ''}${k ? `<a class="btn" href="#/kontrak">${ic('link', 'sm')}${esc(k.No_SPK)}</a>` : (bisa ? `<button class="btn gold" data-act="kontrak">${ic('kontrak', 'sm')}Buat Kontrak</button>` : '')}` }) +
      (num(p.Nilai_HPS) > num(p.Pagu_Paket) ? `<div class="note err mb">${ic('warn', 'sm')}<div>Nilai ${hg.singkat} (${rp(p.Nilai_HPS)}) melebihi pagu paket (${rp(p.Pagu_Paket)}). Tinjau kembali harga atau volume.</div></div>` : '') +
      `<div class="card"><div class="tabs">${[['instruksi', 'send', 'Instruksi PPK'], ['hps', 'receipt', hg.singkat], ['spek', 'doc', 'Spesifikasi Teknis'], ['saran', 'checklist', 'Dokumen Disarankan'], ['arsip', 'arsip', 'Dokumen & Arsip']].map((t) => `<button data-tab="${t[0]}" class="${st.tab === t[0] ? 'on' : ''}">${ic(t[1], 'sm')}${t[2]}</button>`).join('')}</div><div class="card-b" id="pkBody"></div></div>`;
    const b = $('#pkBody');
    this['tab_' + st.tab](b, p, st, bisa);
    el.onclick = (e) => {
      const t = e.target.closest('[data-tab],[data-act]'); if (!t) return;
      if (t.dataset.tab) { if (st.items && !confirm('Perubahan item belum disimpan. Pindah tab?')) return; st.items = null; st.tab = t.dataset.tab; history.replaceState(null, '', '#/pengadaan?id=' + p.ID_Paket); App.refresh(); }
      if (t.dataset.act === 'edit') Pages.formPaket(p);
      if (t.dataset.act === 'kontrak') Pages.formKontrak(null, { ID_SubKeg: p.ID_SubKeg, ID_Paket: p.ID_Paket, Uraian_Pekerjaan: p.Nama_Paket, Metode: p.Metode, Status: 'AKTIF' });
    };
  },
  tab_instruksi(b, p, st, bisa) {
    const ppk = Store.user(p.Email_PPK) || {}, pp = Store.user(p.Email_Pejabat_Pengadaan) || {};
    const userOpts = (first) => [['', first]].concat(S.t.pengguna.filter((u) => u.Aktif !== 'TIDAK').sort(byKey('Nama')).map((u) => [u.Email, u.Nama + (u.Jabatan ? ' — ' + u.Jabatan : '')]));
    b.innerHTML = `<div class="grid g-73"><div><form class="fg" id="fIns">
        ${fld({ name: 'Nomor_Instruksi', label: 'Nomor instruksi', value: p.Nomor_Instruksi, span: 's8', ro: !bisa, ph: '027/…/PPK-DISHUB/2026' })}${fld({ name: 'Tgl_Instruksi', label: 'Tanggal', type: 'date', value: p.Tgl_Instruksi, span: 's4', ro: !bisa })}
        ${fld({ name: 'Email_PPK', label: 'Pejabat Pembuat Komitmen (PPK)', type: 'select', value: p.Email_PPK, span: 's6', dis: !bisa, opts: userOpts('— pilih PPK —') })}${fld({ name: 'Email_Pejabat_Pengadaan', label: 'Pejabat Pengadaan', type: 'select', value: p.Email_Pejabat_Pengadaan, span: 's6', dis: !bisa, opts: userOpts('— pilih pejabat pengadaan —') })}
        ${fld({ name: 'Kode_RUP', label: 'Kode RUP', value: p.Kode_RUP, span: 's4', ro: !bisa, ph: 'contoh 68660530' })}${fld({ name: 'Kualifikasi', label: 'Kualifikasi usaha', type: 'select', value: p.Kualifikasi, span: 's4', dis: !bisa, opts: [['', '— pilih —']].concat(PK.KUALIFIKASI.map((x) => [x, x])) })}${fld({ name: 'Ijin_Usaha', label: 'Ijin usaha', value: p.Ijin_Usaha, span: 's4', ro: !bisa, ph: 'KBLI …' })}
        ${fld({ name: 'Dasar_Instruksi', label: 'Dasar (satu per baris, dinomori otomatis saat cetak)', type: 'textarea', rows: 6, value: p.Dasar_Instruksi || S.settings.DASAR_INSTRUKSI || '', ro: !bisa, max: 5000, hint: 'Bawaan diambil dari Pengaturan → Umum → Dasar instruksi. Tambahkan nomor DPA/DPPA bila perlu.' })}<div class="f" id="cekDasarIns">${Aturan.cekDasarHtml(p.Dasar_Instruksi || S.settings.DASAR_INSTRUKSI, p.Tgl_Instruksi)}</div>
        ${fld({ name: 'Isi_Instruksi', label: 'Catatan / instruksi tambahan (opsional)', type: 'textarea', rows: 4, value: p.Isi_Instruksi, ro: !bisa, max: 20000 })}</form>
        ${bisa ? `<div class="row mt"><button class="btn" data-ins="impor">${ic('upload', 'sm')}Isi otomatis dari dokumen Instruksi (Word/Excel/PDF)</button><input type="file" id="fileIns" class="hidden" accept=".docx,.xlsx,.xls,.pdf,.txt"><span class="spacer"></span><button class="btn" data-ins="simpan">${ic('save', 'sm')}Simpan</button>${p.Status === 'DRAF' ? `<button class="btn pri" data-ins="terbit">${ic('send', 'sm')}Simpan & Tandai Diinstruksikan</button>` : ''}</div>` : ''}</div>
      <div><div class="card"><div class="card-h"><h3>${ic('print', 'sm')}Cetak instruksi</h3><p>Hasil Google Docs → Word/PDF, tercatat di riwayat dokumen paket.</p></div><div class="card-b">${this.cetakBtn(p, 'INSTRUKSI')}
        <dl class="kv mt"><dt>PPK</dt><dd>${esc(ppk.Nama || '-')}</dd><dt>Pejabat Pengadaan</dt><dd>${esc(pp.Nama || '-')}</dd><dt>Pagu dana</dt><dd class="num">${rp(p.Pagu_Paket)}</dd><dt>Nilai ${esc(Aturan.harga(p).singkat)}</dt><dd class="num">${rp(p.Nilai_HPS)}</dd><dt>Waktu pelaksanaan</dt><dd>${p.Jangka_Waktu ? esc(p.Jangka_Waktu) + ' hari kalender' : '-'}</dd><dt>Lokasi</dt><dd>${esc(p.Lokasi || '-')}</dd></dl>
        <div class="note warn mt">${ic('info', 'sm')}<div>Tanda tangan tetap basah. Setelah ditandatangani, unggah scan di tab <b>Dokumen & Arsip</b> dengan jenis <b>Instruksi</b>.</div></div></div></div></div></div>`;
    const f = $('#fIns', b);
    const cekDasar = () => { $('#cekDasarIns', b).innerHTML = Aturan.cekDasarHtml(f.Dasar_Instruksi.value, f.Tgl_Instruksi.value); };
    b.oninput = (e) => { if (e.target.name === 'Dasar_Instruksi') cekDasar(); };
    b.onchange = (e) => { if (e.target.name === 'Tgl_Instruksi') cekDasar(); };
    b.onclick = async (e) => {
      const t = e.target.closest('[data-ins],[data-cetak]'); if (!t) return;
      if (t.dataset.cetak) return Gen.open({ ID_Paket: p.ID_Paket, jenis: t.dataset.cetak, ID_Template: t.dataset.tpl });
      const a = t.dataset.ins;
      if (a === 'impor') { const inp = $('#fileIns', b); inp.onchange = async () => { const fl = inp.files[0]; inp.value = ''; if (!fl) return;
        try { const tx = await Impor.teks(fl); if (!tx.trim()) { toast('Tidak ada teks yang terbaca dari berkas.', 'warn'); return; }
          const g = Impor.tebakInstruksi(tx), isi = []; Object.keys(g).forEach((k) => { const el2 = f.elements[k]; if (!el2 || g[k] === '' || g[k] == null) return; el2.value = g[k]; isi.push(k.replace(/_/g, ' ')); });
          const lain = ['Pagu_Paket', 'Jangka_Waktu', 'Lokasi'].filter((k) => g[k] && String(g[k]) !== String(p[k]));
          toast(isi.length ? 'Terisi dari ' + fl.name + ': ' + isi.join(', ') + '. Periksa lalu simpan.' : 'Tidak ada isian instruksi yang dikenali di ' + fl.name + '.', isi.length ? 'ok' : 'warn');
          if (lain.length) toast('Dokumen memuat ' + lain.map((k) => k.replace(/_/g, ' ') + ' ' + (k === 'Pagu_Paket' ? rp(g[k]) : g[k])).join(', ') + ' — ubah lewat "Ubah paket" bila perlu.', 'info');
        } catch (er) { toast(er.message, 'err'); } }; inp.click(); }
      if (a === 'simpan' || a === 'terbit') {
        const v = formVals(f); const data = Object.assign({}, p, v, a === 'terbit' ? { Status: 'DIINSTRUKSIKAN' } : {}); delete data._pending;
        if (a === 'terbit' && (!v.Nomor_Instruksi || !v.Tgl_Instruksi || !v.Email_PPK || !v.Email_Pejabat_Pengadaan || !v.Dasar_Instruksi)) { toast('Lengkapi nomor, tanggal, PPK, pejabat pengadaan, dan dasar instruksi.', 'warn'); return; }
        mutate('pengadaan.simpan', data, { table: 'pengadaan', btn: t, temp: data, okMsg: a === 'terbit' ? 'Instruksi disimpan & ditandai diinstruksikan.' : 'Instruksi disimpan.' });
      }
    };
  },
  /** v1.2.3: keterangan HPS / Referensi Harga menurut metode & nilai */
  notaHarga(p) { const hg = Aturan.harga(p); return hg.ket ? `<div class="note ${hg.kode === 'REF' ? 'warn' : 'info'} mb" data-notaharga>${ic('info', 'sm')}<div><b>${esc(hg.nama)}.</b> ${esc(hg.ket)} <span class="mini">(${esc(hg.dasar)})</span></div></div>` : ''; },
  kerangka(p) {
    const sk = Store.get('subkeg', p.ID_SubKeg) || {};
    return `Dalam rangka pelaksanaan Sub Kegiatan ${sk.Nama_SubKegiatan || '…'} Tahun Anggaran ${S.tahun}, dengan ini Pejabat Pembuat Komitmen menginstruksikan kepada Pejabat Pengadaan untuk:\n\n1. Melaksanakan proses pengadaan ${PK.JENIS[p.Jenis_Pengadaan] || 'barang/jasa'} untuk paket "${p.Nama_Paket}" dengan metode ${p.Metode || '…'}.\n2. Menggunakan ${Aturan.harga(p).nama} sebesar ${rp(p.Nilai_HPS)} (termasuk PPN ${fmtN(p.PPN_Persen)}%) dan Spesifikasi Teknis terlampir sebagai acuan.\n3. Lokasi pekerjaan: ${p.Lokasi || '…'}; jangka waktu pelaksanaan ${p.Jangka_Waktu || '…'} hari kalender.\n4. Melaporkan hasil pemilihan penyedia kepada PPK paling lambat …\n\nDemikian instruksi ini untuk dilaksanakan dengan penuh tanggung jawab.\n\n(Kerangka contoh — sesuaikan dengan ketentuan yang berlaku dan review bagian hukum/PBJ.)`;
  },
  cetakBtn(p, jenis) {
    const tps = S.t.template.filter((t) => t.Aktif !== 'TIDAK' && t.Jenis === jenis);
    return tps.length ? `<div class="row">${tps.map((t) => `<button class="btn pri" data-cetak="${jenis}" data-tpl="${esc(t.ID_Template)}">${ic('print', 'sm')}${esc(t.Nama)}</button>`).join('')}</div>` : `<p class="mini" style="margin:0">Belum ada template <b>${jenis === 'HPS' ? 'HPS' : jenis === 'SPESIFIKASI' ? 'Spesifikasi Teknis' : 'Instruksi'}</b>. ${Can.admin() ? '<a href="#/pengaturan?tab=template">Unggah template</a> (Word, Excel, atau PDF).' : 'Minta admin mengunggahnya.'}</p>`;
  },
  /** Editor item (dipakai tab HPS & Spesifikasi). mode: 'hps' | 'spek' */
  tab_hps(b, p, st, bisa) { this.editor(b, p, st, bisa, 'hps'); },
  tab_spek(b, p, st, bisa) { this.editor(b, p, st, bisa, 'spek'); },
  editor(b, p, st, bisa, mode) {
    if (!st.items) st.items = PK.items(p.ID_Paket).map((i) => Object.assign({}, i));
    const draw = () => {
      const it = st.items, h = PK.hitung(it, p.PPN_Persen, p.Harga_Termasuk_PPN), dirty = JSON.stringify(it.map(this.bersih)) !== JSON.stringify(PK.items(p.ID_Paket).map(this.bersih));
      const cell = (i, k, opt) => bisa ? (opt.ta ? `<textarea class="in" data-i="${i}" data-k="${k}" rows="${opt.rows || 2}" style="min-height:${opt.rows ? 60 : 40}px">${esc(it[i][k] || '')}</textarea>` : `<input class="in ${opt.n ? 'num' : ''}" data-i="${i}" data-k="${k}" value="${esc(opt.n ? (it[i][k] === '' || it[i][k] == null ? '' : fmtN(it[i][k], 2).replace(/,00$/, '')) : it[i][k] || '')}" ${opt.n ? 'inputmode="decimal" style="text-align:right"' : ''} ${opt.ph ? `placeholder="${opt.ph}"` : ''}>`) : esc(opt.n ? fmtN(it[i][k], 2).replace(/,00$/, '') : it[i][k] || '');
      const fu = $('#fSpekU', b), keep = fu ? formVals(fu) : null, buka = fu ? fu.closest('details').open : null;
      b.innerHTML = (mode === 'spek' ? this.spekUmum(p, bisa) : this.notaHarga(p)) + `<div class="row mb">${bisa ? `<button class="btn" data-ed="impor">${ic('upload', 'sm')}Impor Excel / Word / PDF</button>${mode === 'spek' ? `<button class="btn" data-ed="narasi">${ic('doc', 'sm')}Impor spesifikasi mutu (Word/PDF)</button><input type="file" id="fileNar" class="hidden" accept=".docx,.pdf,.txt">` : `<button class="btn" data-ed="dpa">${ic('wallet', 'sm')}Ambil dari Rincian DPA</button>`}<button class="btn" data-ed="tambah">${ic('add', 'sm')}Tambah baris</button>` : ''}<span class="spacer"></span>${this.cetakBtn(p, mode === 'hps' ? 'HPS' : 'SPESIFIKASI')}<button class="btn" data-ed="xls">${ic('excel', 'sm')}Excel cepat</button></div>
        ${it.length ? `<div class="tw"><table class="t light"><thead><tr><th style="width:44px">No</th><th style="min-width:200px">Uraian</th>${mode === 'spek' ? '<th style="min-width:320px">Spesifikasi teknis</th><th>Satuan</th><th class="n">Volume</th>' : '<th class="n" style="width:110px">Volume</th><th style="width:100px">Satuan</th><th class="n" style="width:150px">Harga satuan (Rp)</th><th class="n">Jumlah (Rp)</th><th style="min-width:150px">Sumber harga</th>'}${bisa ? '<th></th>' : ''}</tr></thead><tbody>
          ${it.map((x, i) => `<tr><td>${i + 1}</td><td>${cell(i, 'Uraian', { ta: mode === 'spek', ph: 'Nama barang/jasa' })}</td>${mode === 'spek' ? `<td>${cell(i, 'Spesifikasi', { ta: true, rows: 3 })}</td><td>${esc(x.Satuan || '')}</td><td class="n">${fmtN(x.Volume, 2).replace(/,00$/, '')}</td>` : `<td>${cell(i, 'Volume', { n: true })}</td><td>${cell(i, 'Satuan', {})}</td><td>${cell(i, 'Harga_Satuan', { n: true })}</td><td class="n"><b>${fmtN(num(x.Volume) * num(x.Harga_Satuan))}</b></td><td>${cell(i, 'Sumber_Harga', { ph: 'Survei / e-katalog / kontrak sejenis' })}</td>`}${bisa ? `<td class="acts"><button class="btn ghost icon" data-del="${i}" title="Hapus baris">${ic('trash', 'sm')}</button></td>` : ''}</tr>`).join('')}
          </tbody>${mode === 'hps' ? `<tfoot>${h.termasuk ? `<tr><td colspan="5" class="mini">*Harga sudah termasuk PPN ${fmtN(p.PPN_Persen)}% — di dalamnya PPN</td><td class="n mini">${fmtN(h.ppn)}</td><td colspan="${bisa ? 2 : 1}"></td></tr>` : `<tr><td colspan="5">Jumlah sebelum PPN</td><td class="n">${fmtN(h.sub)}</td><td colspan="${bisa ? 2 : 1}"></td></tr><tr><td colspan="5">PPN ${fmtN(p.PPN_Persen)}%</td><td class="n">${fmtN(h.ppn)}</td><td colspan="${bisa ? 2 : 1}"></td></tr>`}<tr><td colspan="5"><b>${(h.termasuk ? 'JUMLAH / Total ' : 'Total ') + (Aturan.harga(p).kode === 'REF' ? 'Referensi Harga' : 'HPS')}</b> ${h.total > num(p.Pagu_Paket) ? chip('melebihi pagu paket ' + rp(p.Pagu_Paket), 'err') : chip(pct(num(p.Pagu_Paket) ? (h.total / num(p.Pagu_Paket)) * 100 : 0) + ' dari pagu', 'ok')}</td><td class="n"><b>${fmtN(h.total)}</b></td><td colspan="${bisa ? 2 : 1}"></td></tr></tfoot>` : ''}</table></div>`
          : emptyBox('Belum ada item', mode === 'hps' ? 'Tambah baris atau impor tabel HPS dari Excel, Word, atau PDF.' : 'Spesifikasi diisi per item HPS. Tambah item di tab HPS atau impor dari dokumen.')}
        ${bisa ? `<div class="card-f mt" style="border-radius:var(--r);position:sticky;bottom:0">${ic(dirty ? 'edit' : 'check', 'sm')}<span style="margin-right:auto">${dirty ? '<b>Ada perubahan item yang belum disimpan</b>' : 'Semua item tersimpan.'} · ${p.Harga_Termasuk_PPN === 'YA' ? 'Harga satuan sudah termasuk PPN ' + fmtN(p.PPN_Persen) + '%' : 'PPN ' + fmtN(p.PPN_Persen) + '% ditambahkan di atas harga'} (ubah di "Ubah paket")</span><button class="btn" data-ed="batal" ${dirty ? '' : 'disabled'}>Batal</button><button class="btn pri" data-ed="simpan" ${dirty ? '' : 'disabled'}>${ic('save', 'sm')}Simpan Item</button></div>` : ''}`;
      const fu2 = $('#fSpekU', b); if (fu2 && keep) { Object.keys(keep).forEach((k) => { if (fu2.elements[k]) fu2.elements[k].value = keep[k]; }); fu2.closest('details').open = buka; }
    };
    draw();
    b.onchange = (e) => { const t = e.target; if (t.dataset.i == null) return; const x = st.items[num(t.dataset.i)]; x[t.dataset.k] = ['Volume', 'Harga_Satuan'].indexOf(t.dataset.k) > -1 ? Impor.angka(t.value) : t.value; draw(); };
    b.onclick = async (e) => {
      const t = e.target.closest('[data-ed],[data-del],[data-cetak]'); if (!t) return;
      if (t.dataset.cetak) { if (this.dirty(p, st)) { toast('Simpan item terlebih dahulu sebelum mencetak.', 'warn'); return; } return Gen.open({ ID_Paket: p.ID_Paket, jenis: t.dataset.cetak, ID_Template: t.dataset.tpl }); }
      if (t.dataset.del != null) { st.items.splice(num(t.dataset.del), 1); draw(); return; }
      const a = t.dataset.ed;
      if (a === 'simpanUmum') { const v = formVals($('#fSpekU')); const data = Object.assign({}, p, v); delete data._pending; return mutate('pengadaan.simpan', data, { table: 'pengadaan', btn: t, temp: data, okMsg: 'Spesifikasi umum disimpan.' }); }
      if (a === 'tambah') { st.items.push({ Uraian: '', Spesifikasi: '', Volume: 1, Satuan: '', Harga_Satuan: 0, Sumber_Harga: '', Keterangan: '' }); draw(); const last = b.querySelectorAll('[data-k=Uraian]'); if (last.length) last[last.length - 1].focus(); }
      if (a === 'batal') { st.items = null; App.refresh(); }
      if (a === 'impor') Impor.dialog({ target: 'pengadaanItem', extra: { ID_Paket: p.ID_Paket }, onDone: () => { st.items = null; } });
      if (a === 'dpa') return this.ambilDpa(p, st, draw);
      if (a === 'narasi') { const inp = $('#fileNar', b); inp.onchange = async () => { const fl = inp.files[0]; inp.value = ''; if (!fl) return; try { this.terapNarasi(Impor.spekNarasi(await Impor.teks(fl)), st, fl.name); draw(); } catch (er) { toast(er.message, 'err'); } }; inp.click(); return; }
      if (a === 'xls') { const h = PK.hitung(st.items, p.PPN_Persen, p.Harga_Termasuk_PPN); exportXlsx((mode === 'hps' ? 'HPS_' : 'Spesifikasi_') + p.Nama_Paket.slice(0, 40), [{ name: mode === 'hps' ? 'HPS' : 'Spesifikasi', cols: [5, 40, 50, 10, 10, 16, 18, 24], aoa: [[(mode === 'hps' ? (Aturan.harga(p).kode === 'REF' ? 'REFERENSI HARGA' : 'HARGA PERKIRAAN SENDIRI (HPS)') : 'SPESIFIKASI TEKNIS') + ' — ' + p.Nama_Paket], [S.settings.NAMA_INSTANSI || '', '', 'TA ' + S.tahun], [], ['No', 'Uraian', 'Spesifikasi', 'Volume', 'Satuan', 'Harga Satuan', 'Jumlah', 'Sumber Harga']].concat(st.items.map((x, i) => [i + 1, x.Uraian, x.Spesifikasi, num(x.Volume), x.Satuan, num(x.Harga_Satuan), num(x.Volume) * num(x.Harga_Satuan), x.Sumber_Harga]), [[], ['', 'Jumlah sebelum PPN', '', '', '', '', h.sub], ['', (h.termasuk ? '(termasuk) ' : '') + 'PPN ' + fmtN(p.PPN_Persen) + '%', '', '', '', '', h.ppn], ['', 'TOTAL ' + (Aturan.harga(p).kode === 'REF' ? 'REFERENSI HARGA' : 'HPS'), '', '', '', '', h.total]].concat(h.termasuk ? [['', '*Harga sudah termasuk PPN ' + fmtN(p.PPN_Persen) + '%']] : [])) }]); }
      if (a === 'simpan') {
        const items = st.items.map(this.bersih); const bad = items.findIndex((x) => !x.Uraian); if (bad > -1) { toast('Uraian baris ' + (bad + 1) + ' masih kosong.', 'warn'); return; }
        const olds = PK.items(p.ID_Paket).map((x) => Object.assign({}, x)); const oldP = Object.assign({}, p);
        mutate('pengadaan.itemSimpan', { ID_Paket: p.ID_Paket, items, tambah: false }, { btn: t, okMsg: 'Item disimpan.',
          optimistic: () => { S.t.pengadaanItem = S.t.pengadaanItem.filter((x) => x.ID_Paket !== p.ID_Paket).concat(items.map((x, i) => Object.assign({}, x, { ID: uid(), ID_Paket: p.ID_Paket, No: i + 1 }))); Store.upsert('pengadaan', Object.assign({}, p, { Nilai_HPS: PK.hitung(items, p.PPN_Persen, p.Harga_Termasuk_PPN).total, _pending: true })); st.items = null; return () => { S.t.pengadaanItem = S.t.pengadaanItem.filter((x) => x.ID_Paket !== p.ID_Paket).concat(olds); Store.upsert('pengadaan', oldP); Store.bump(); }; },
          onOk: (d) => { if (d.rows) { S.t.pengadaanItem = S.t.pengadaanItem.filter((x) => x.ID_Paket !== p.ID_Paket).concat(d.rows.map(Store.normRow)); Store.bump(); Store.saveSoon(); } if (d.paket) Store.upsert('pengadaan', d.paket); (d.peringatan || []).forEach((w) => toast(w, 'warn')); } });
      }
    };
  },
  SPEK_UMUM: [['Spesifikasi_Fungsi', 'Spesifikasi fungsi umum', 'textarea', 'Dapat diambil dari output/tujuan pada TOR dokumen anggaran'], ['Jadwal_Kedatangan', 'Jadwal kedatangan barang/jasa', '', 'Sesuai Surat Pesanan'],
    ['Lokasi_Kedatangan', 'Lokasi kedatangan barang/jasa', '', ''], ['Metode_Pengiriman', 'Metode pengantaran/pengiriman', '', 'Jalur Darat'], ['Pelayanan_Penyedia', 'Pelayanan penyedia barang/jasa', '', '-'],
    ['Pelatihan_Teknis', 'Pelatihan & bantuan teknis oleh penyedia', '', '-'], ['Pemeliharaan', 'Pemeliharaan', '', '-'], ['Informasi_Lainnya', 'Informasi lainnya', 'textarea', '-']],
  /** Kartu spesifikasi fungsi/waktu/pelayanan (format Dokumen Spesifikasi Teknis Dishub) */
  spekUmum(p, bisa) {
    return `<details class="card mb" ${p.Spesifikasi_Fungsi || p.Jadwal_Kedatangan ? '' : 'open'}><summary class="card-h" style="cursor:pointer"><h3>${ic('doc', 'sm')}Spesifikasi fungsi, waktu & pelayanan</h3><p>Dipakai template Spesifikasi Teknis (ID RUP: ${esc(p.Kode_RUP || '— isi di tab Instruksi')}, waktu pelaksanaan ${p.Jangka_Waktu ? esc(p.Jangka_Waktu) + ' hari kalender' : '—'}).</p></summary><div class="card-b"><form class="fg" id="fSpekU">
      ${this.SPEK_UMUM.map((x) => fld({ name: x[0], label: x[1], type: x[2] || 'text', rows: 2, value: p[x[0]] || (x[0] === 'Lokasi_Kedatangan' ? p.Lokasi || '' : ''), span: x[2] ? '' : 's6', ph: x[3], ro: !bisa })).join('')}</form>
      ${bisa ? `<div class="row mt"><span class="spacer"></span><button class="btn pri" data-ed="simpanUmum">${ic('save', 'sm')}Simpan spesifikasi umum</button></div>` : ''}</div></details>`;
  },
  /** Terapkan hasil Impor.spekNarasi ke item: cocokkan nomor urut, lalu nama barang */
  terapNarasi(r, st, nama) {
    if (!r.items.length) { toast('Tidak ditemukan daftar spesifikasi bernomor ("1. Nama barang" diikuti butir spesifikasi) di ' + nama + '.', 'warn'); return; }
    let cocok = 0, baru = 0;
    r.items.forEach((x) => {
      const n = norm(x.nama); let it = st.items.find((i) => norm(i.Uraian) === n) || st.items.find((i) => n && (norm(i.Uraian).indexOf(n) > -1 || n.indexOf(norm(i.Uraian)) > -1)) || st.items[x.no - 1];
      if (!it) { it = { Uraian: x.nama, Spesifikasi: '', Volume: x.volume || 1, Satuan: x.satuan || '', Harga_Satuan: 0, Sumber_Harga: '', Keterangan: '' }; st.items.push(it); baru++; } else cocok++;
      it.Spesifikasi = x.spes; if (x.volume && !num(it.Volume)) it.Volume = x.volume; if (x.satuan && !it.Satuan) it.Satuan = x.satuan;
    });
    toast(`Spesifikasi dari ${nama}: ${cocok} item diperbarui${baru ? ', ' + baru + ' item baru (harga 0 — isi di tab HPS)' : ''}. Periksa lalu klik Simpan Item.`, 'ok');
    if (Object.keys(r.umum).length) { const f = $('#fSpekU'); if (f) Object.keys(r.umum).forEach((k) => { if (f.elements[k] && !f.elements[k].value) f.elements[k].value = r.umum[k]; }); toast('Spesifikasi fungsi/waktu/pelayanan ikut terisi — klik "Simpan spesifikasi umum".', 'info'); }
  },
  /** Pilih item dari Rincian Anggaran Belanja (SIPD) Sub Kegiatan paket → tambahkan ke HPS */
  async ambilDpa(p, st, draw) {
    const sk = Store.get('subkeg', p.ID_SubKeg) || {};
    const m = modal({ title: 'Ambil dari Rincian DPA', icon: 'wallet', size: 'lg', body: `<p class="mini" style="margin:0 0 8px">${esc(skLabel(sk))}</p><div id="dpaBox"><div class="sk" style="margin:10px 0"></div><div class="sk"></div></div>`,
      foot: `<label class="check" style="margin-right:auto"><input type="checkbox" name="bagi"> Harga DPA belum termasuk PPN → tambahkan PPN ${fmtN(p.PPN_Persen)}%</label><button class="btn" data-x>Batal</button><button class="btn pri" data-ok disabled>${ic('add', 'sm')}Tambahkan ke HPS</button>` });
    let rows;
    try { rows = (await RB.ambil(p.ID_SubKeg)).filter((r) => r.Jenis === 'ITEM'); } catch (e) { $('#dpaBox', m.el).innerHTML = `<div class="note err">${ic('warn', 'sm')}<div>${esc(e.message)}</div></div>`; return; }
    if (!rows.length) { $('#dpaBox', m.el).innerHTML = emptyBox('Belum ada rincian belanja', 'Impor PDF RKA/DPA Rincian Belanja dari SIPD-RI di menu Perencanaan Anggaran.'); return; }
    const ada = new Set(st.items.map((i) => norm(i.Uraian)));
    $('#dpaBox', m.el).innerHTML = `<div class="tw" style="max-height:420px;overflow:auto"><table class="t light"><thead><tr><th><input type="checkbox" data-all></th><th>Kode rekening</th><th>Uraian & spesifikasi</th><th class="n">Volume</th><th>Satuan</th><th class="n">Harga (Rp)</th><th class="n">Jumlah (Rp)</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr class="${ada.has(norm(r.Uraian)) ? 'c-mut' : ''}"><td><input type="checkbox" data-i="${i}" ${num(r.Jumlah) > 0 ? '' : 'disabled'}></td><td class="mono mini">${esc(r.Kode_Rekening)}</td><td><b>${esc(r.Uraian)}</b><span class="sub">${esc(r.Spesifikasi || '')}</span>${ada.has(norm(r.Uraian)) ? '<span class="sub c-warn">sudah ada di HPS</span>' : ''}</td><td class="n">${fmtN(r.Volume, 2).replace(/,00$/, '')}</td><td>${esc(r.Satuan)}</td><td class="n">${fmtN(r.Harga)}</td><td class="n">${fmtN(r.Jumlah)}</td></tr>`).join('')}</tbody></table></div>`;
    const sel = () => $$('[data-i]:checked', m.el).map((c) => rows[num(c.dataset.i)]);
    m.el.addEventListener('change', (e) => { if (e.target.dataset.all != null) $$('[data-i]:not(:disabled)', m.el).forEach((c) => { c.checked = e.target.checked; }); m.el.querySelector('[data-ok]').disabled = !sel().length; });
    m.el.querySelector('[data-ok]').onclick = () => {
      const kali = m.el.querySelector('[name=bagi]').checked ? 1 + num(p.PPN_Persen) / 100 : 1;
      sel().forEach((r) => st.items.push({ Uraian: r.Uraian, Spesifikasi: r.Spesifikasi || '', Volume: num(r.Volume), Satuan: r.Satuan || '', Harga_Satuan: Math.round(num(r.Harga) * kali), Sumber_Harga: 'DPA ' + r.Kode_Rekening, Keterangan: '' }));
      m.close(); draw(); toast(sel().length + ' item ditambahkan. Periksa volume & harga, lalu klik Simpan Item.', 'ok');
    };
  },
  bersih(x) { return { Uraian: String(x.Uraian || '').trim(), Spesifikasi: String(x.Spesifikasi || '').trim(), Volume: num(x.Volume), Satuan: String(x.Satuan || '').trim(), Harga_Satuan: num(x.Harga_Satuan), Sumber_Harga: String(x.Sumber_Harga || '').trim(), Keterangan: String(x.Keterangan || '').trim() }; },
  dirty(p, st) { return !!st.items && JSON.stringify(st.items.map(this.bersih)) !== JSON.stringify(PK.items(p.ID_Paket).map(this.bersih)); },
  /** v1.2.4: daftar dokumen yang disarankan menurut metode, jenis, dan nilai paket/kontrak */
  tab_saran(b, p) {
    const k = p.ID_Kontrak ? Store.get('kontrak', p.ID_Kontrak) : null;
    b.innerHTML = Saran.html(p, k) + `<p class="mini mt">Status: ${chip('draf', 'info')} sudah dibuat di aplikasi · ${chip('scan', 'ok')} scan bertanda tangan sudah diunggah ke arsip (jenis dokumen yang sesuai).</p>`;
    b.onclick = null; Saran.bind(b, p, k);
  },
  tab_arsip(b, p, st, bisa) {
    const docs = PK.docs(p.ID_Paket).sort((a, c) => String(c.Tgl_Upload).localeCompare(String(a.Tgl_Upload)));
    b.innerHTML = `<div class="grid g-64"><div><div class="lbl mb-s">Scan dokumen bertanda tangan (${docs.length})</div>${docs.length ? `<div class="docs">${docs.map((d) => { const di = docIcon(d); return `<div class="doc"><div class="di ${di[1]}">${ic(di[0])}</div><div style="min-width:0;flex:1"><b>${esc(d.Nama_File)}</b><small>${esc(jenisNama(d.Jenis_Dokumen))} · ${fmtN(num(d.Ukuran) / 1048576, 2)} MB</small><small>${tgl(String(d.Tgl_Upload).slice(0, 10))} · ${esc(Store.nama(d.Oleh))}</small><div class="acts"><button class="btn sm" data-open="${esc(d.ID_Dokumen)}">${ic('eye', 'sm')}Lihat</button>${Can.hapusArsip() ? `<button class="btn sm ghost icon" data-hapus="${esc(d.ID_Dokumen)}" title="Hapus">${ic('trash', 'sm')}</button>` : ''}</div></div></div>`; }).join('')}</div>` : '<p class="mini">Belum ada scan. Cetak instruksi/HPS/spesifikasi, tandatangani basah, lalu unggah di sini.</p>'}
        <div class="lbl mt mb-s">Riwayat dokumen yang dicetak</div>${Gen.listHtml({ ID_Paket: p.ID_Paket })}</div>
      ${Can.arsip() ? `<div class="card"><div class="card-h"><h3>${ic('upload', 'sm')}Unggah scan</h3><p>Tersimpan di folder arsip dinas dan otomatis ikut ke kontrak paket ini.</p></div><div class="card-b"><div class="fg mb-s"><div class="f"><label>Jenis dokumen</label>${selectHtml('jenisP', [['INSTRUKSI', 'Instruksi PPK'], ['HPS', 'HPS & Survei Harga'], ['SPEK', 'Spesifikasi Teknis'], ['LAINNYA', 'Lainnya']], 'INSTRUKSI')}</div></div><div class="drop" id="dropP">${ic('upload')}<b>Tarik scan PDF/JPG, Word, atau Excel ke sini</b><span class="mini">maks. ${esc(S.settings.MAKS_UNGGAH_MB || 10)} MB</span><div class="prog hidden"><i></i></div></div><input type="file" id="fileP" class="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"></div></div>` : ''}</div>`;
    const drop = $('#dropP', b); if (drop) Upload.bind(drop, $('#fileP', b), (files) => Upload.kirim(files, { ID_Paket: p.ID_Paket, ID_SubKeg: p.ID_SubKeg, ID_Kontrak: p.ID_Kontrak || '', Jenis_Dokumen: $('[name=jenisP]', b).value }, drop));
    b.onclick = async (e) => {
      const t = e.target.closest('[data-open],[data-hapus],[data-gen],[data-dok]'); if (!t) return; e.preventDefault();
      if (t.dataset.open) bukaBerkas('arsip.ambil', { ID_Dokumen: t.dataset.open });
      if (t.dataset.hapus) { const d = Store.get('arsip', t.dataset.hapus); if (!(await confirmBox(`Hapus <b>${esc(d.Nama_File)}</b>?`, { danger: true, ok: 'Hapus' }))) return; mutate('arsip.hapus', { ID_Dokumen: d.ID_Dokumen }, { optimistic: () => { const o = Store.remove('arsip', d.ID_Dokumen); return () => Store.upsert('arsip', o); }, okMsg: 'Berkas dihapus.' }); }
      if (t.dataset.gen != null) Gen.open({ ID_Paket: p.ID_Paket, ID_Template: t.dataset.gen || '' });
      if (t.dataset.dok) Gen.unduh(t.dataset.dok, t.dataset.fmt);
    };
  }
});

Pages.formPaket = function (p, prefill) {
  const baru = !p; p = Object.assign({ Jenis_Pengadaan: 'BARANG', PPN_Persen: 11, Status: 'DRAF', Harga_Termasuk_PPN: 'YA' }, p || {}, prefill || {});
  const sks = S.t.subkeg.filter((s) => Can.editKontrak(s) || s.ID_SubKeg === p.ID_SubKeg).sort(byKey('Kode_SubKeg'));
  if (!sks.length) { toast('Belum ada sub kegiatan di bidang Anda.', 'warn'); return; }
  const m = modal({ title: baru ? 'Tambah Paket Pengadaan' : 'Ubah Paket', icon: 'gavel', size: 'lg',
    body: `<form class="fg">${fld({ name: 'ID_SubKeg', label: 'Sub Kegiatan DPA', type: 'select', value: p.ID_SubKeg, req: true, opts: [['', '— pilih —']].concat(sks.map((s) => [s.ID_SubKeg, skLabel(s)])) })}
      <div class="f" id="pDpa"></div>
      ${fld({ name: 'Nama_Paket', label: 'Nama paket pekerjaan', value: p.Nama_Paket, req: true, hint: 'Sebaiknya sama dengan uraian di DPA — pilih dari daftar di atas.' })}
      ${fld({ name: 'Kode_Rekening', label: 'Kode rekening belanja', value: p.Kode_Rekening, span: 's6', ph: '5.1.02.01.001.00024', hint: 'Terisi otomatis dari pilihan DPA. Lebih dari satu: pisahkan dengan koma.' })}${fld({ name: 'Kode_RUP', label: 'Kode RUP', value: p.Kode_RUP, span: 's6', ph: 'dari SIRUP' })}
      ${fld({ name: 'Jenis_Pengadaan', label: 'Jenis pengadaan', type: 'select', value: p.Jenis_Pengadaan, span: 's4', opts: Object.keys(PK.JENIS).map((k) => [k, PK.JENIS[k]]) })}${fld({ name: 'Metode', label: 'Metode pemilihan', type: 'select', value: p.Metode, span: 's4', opts: [['', '— pilih —']].concat(K.METODE.map((x) => [x, x]), p.Metode && K.METODE.indexOf(p.Metode) < 0 ? [[p.Metode, p.Metode + ' (data lama)']] : []) })}${fld({ name: 'Status', label: 'Status', type: 'select', value: p.Status, span: 's4', opts: Object.keys(PK.ST).filter((k) => k !== 'SELESAI' || p.Status === 'SELESAI').map((k) => [k, PK.ST[k][0]]) })}
      ${fld({ name: 'Pagu_Paket', label: 'Pagu paket', type: 'rp', value: p.Pagu_Paket, span: 's4', req: true })}${fld({ name: 'PPN_Persen', label: 'PPN (%)', type: 'pct', value: p.PPN_Persen, span: 's4', hint: 'Sesuaikan dengan ketentuan pajak yang berlaku' })}${fld({ name: 'Jangka_Waktu', label: 'Jangka waktu (hari kalender)', type: 'num', value: p.Jangka_Waktu, span: 's4' })}
      ${fld({ name: 'Harga_Termasuk_PPN', label: 'Harga satuan HPS', type: 'select', value: p.Harga_Termasuk_PPN || 'TIDAK', opts: [['YA', 'Sudah termasuk PPN (HPS = Σ volume × harga)'], ['TIDAK', 'Belum termasuk PPN (HPS = Σ × (1 + PPN))']] })}
      ${fld({ name: 'Kualifikasi', label: 'Kualifikasi usaha', type: 'select', value: p.Kualifikasi, span: 's6', opts: [['', '— pilih —']].concat(PK.KUALIFIKASI.map((x) => [x, x])) })}${fld({ name: 'Ijin_Usaha', label: 'Ijin usaha', value: p.Ijin_Usaha, span: 's6', ph: 'KBLI …' })}
      ${fld({ name: 'Lokasi', label: 'Lokasi pekerjaan', value: p.Lokasi })}${fld({ name: 'Catatan', label: 'Catatan', type: 'textarea', rows: 2, value: p.Catatan })}</form>`,
    foot: `${!baru && Can.role('ADMIN', 'PEJABAT') && !p.ID_Kontrak ? `<button class="btn danger" data-del style="margin-right:auto">${ic('trash', 'sm')}Hapus</button>` : ''}<button class="btn" data-x>Batal</button><button class="btn pri" data-save>${ic('save', 'sm')}Simpan</button>` });
  /* v1.2.1: nama paket & kode rekening dari Rincian DPA; pagu ikut terisi bila masih kosong / masih hasil pilihan sebelumnya */
  const f = m.el.querySelector('form'); let paguAuto = null;
  const drawDpa = (idSk) => DpaPilih.pasang(m.el.querySelector('#pDpa'), idSk, { input: f.Nama_Paket, labelPakai: 'sudah menjadi paket',
    pakai: new Set(S.t.pengadaan.filter((x) => x.ID_SubKeg === idSk && x.ID_Paket !== p.ID_Paket && x.Status !== 'BATAL').map((x) => norm(x.Nama_Paket))),
    isi: (o) => {
      f.Nama_Paket.value = o.uraian; f.Kode_Rekening.value = o.kode;
      const now = num(f.Pagu_Paket.value), j = Math.round(o.jumlah);
      if (j > 0 && (!now || now === paguAuto)) { f.Pagu_Paket.value = fmtN(j); paguAuto = j; }
      [f.Kode_Rekening, f.Pagu_Paket].forEach((x) => x.dispatchEvent(new Event('input', { bubbles: true })));
    } });
  drawDpa(p.ID_SubKeg);
  m.el.addEventListener('change', (e) => { if (e.target.name === 'ID_SubKeg') drawDpa(e.target.value); });
  m.el.querySelector('[data-save]').onclick = () => {
    const v = validate(m.el, { ID_SubKeg: req('Sub kegiatan'), Nama_Paket: req('Nama paket'), Kode_Rekening: (x) => (x && !String(x).split(/[,;\n]+/).map((y) => y.replace(/\s+/g, '')).filter(Boolean).every((y) => /^\d+(\.\d+)*$/.test(y)) ? 'Format kode rekening: angka bertitik, mis. 5.1.02.01.001.00024.' : ''), Pagu_Paket: (x) => (x > 0 ? '' : 'Pagu paket harus lebih dari 0.'), PPN_Persen: (x) => (x < 0 || x > 100 ? 'PPN 0–100%.' : '') });
    if (!v) return;
    const sk = Store.get('subkeg', v.ID_SubKeg), lain = S.t.pengadaan.filter((x) => x.ID_SubKeg === v.ID_SubKeg && x.ID_Paket !== p.ID_Paket && x.Status !== 'BATAL').reduce((a, x) => a + num(x.Pagu_Paket), 0);
    if (sk && lain + v.Pagu_Paket > num(sk.Pagu)) { toast(`Total pagu paket (${rp(lain + v.Pagu_Paket)}) melebihi pagu sub kegiatan (${rp(sk.Pagu)}).`, 'warn'); return; }
    const data = Object.assign({}, p, v, { Tahun: S.tahun }); delete data._pending; if (baru) delete data.ID_Paket;
    m.close();
    mutate('pengadaan.simpan', data, { table: 'pengadaan', temp: data, okMsg: baru ? 'Paket ditambahkan.' : 'Paket diperbarui.', retry: () => Pages.formPaket(baru ? null : p, v), onOk: (d) => { if (baru && d.row) App.go('#/pengadaan?id=' + d.row.ID_Paket); } });
  };
  const d = m.el.querySelector('[data-del]');
  if (d) d.onclick = async () => { if (!(await confirmBox(`Hapus paket <b>${esc(p.Nama_Paket)}</b> beserta itemnya?`, { danger: true, ok: 'Hapus' }))) return; m.close(); App.go('#/pengadaan'); mutate('pengadaan.hapus', { ID_Paket: p.ID_Paket }, { optimistic: () => { const o = Store.remove('pengadaan', p.ID_Paket); const its = S.t.pengadaanItem.filter((x) => x.ID_Paket === p.ID_Paket); S.t.pengadaanItem = S.t.pengadaanItem.filter((x) => x.ID_Paket !== p.ID_Paket); return () => { Store.upsert('pengadaan', o); S.t.pengadaanItem = S.t.pengadaanItem.concat(its); }; }, okMsg: 'Paket dihapus.' }); };
};
