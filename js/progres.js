/* =====================================================================
   SI-PANTAU ANGGARAN — progres.js (v1.2.5)
   Halaman Progres untuk pimpinan (Kepala Dinas/Sekretaris) TANPA login.
   - Admin memilih status (Disembunyikan/Ditampilkan), bidang, dan bagian di Pengaturan → Halaman Progres.
   - Server (aksi publik progres.publik) hanya mengirim bidang & bagian terpilih; data tidak disaring di browser.
   - Alamat langsung: <alamat aplikasi>/#/progres
   ===================================================================== */
'use strict';
const Progres = {
  data: null, on: false, pilihLogin: false, t: 0, _timer: null,
  BAGIAN: [['RINGKASAN', 'Angka ringkasan', 'pagu, realisasi keuangan, realisasi fisik, sisa anggaran'],
    ['SERAPAN', 'Serapan anggaran per bidang', 'batang persentase realisasi keuangan per bidang terpilih'],
    ['STATUS', 'Jumlah paket menurut status, per bidang', 'tabel Draf / Diinstruksikan / Pemilihan & kontrak / Pelaksanaan / Selesai'],
    ['PAKET', 'Daftar paket per bidang', 'nama paket, metode, jadwal, pagu, tahap, status, fisik, keuangan; baris dapat dibuka untuk rincian']],
  ST: { DRAF: ['Draf', '#9CA3AF', 'slate'], INSTRUKSI: ['Diinstruksikan', '#1D4ED8', 'info'], PEMILIHAN: ['Pemilihan & kontrak', '#0D9488', 'teal'],
    PELAKSANAAN: ['Pelaksanaan', '#D4A017', 'warn'], SELESAI: ['Selesai', '#166534', 'ok'], PUTUS: ['Putus kontrak', '#991B1B', 'err'] },
  ST_PENDEK: { DRAF: 'Draf', INSTRUKSI: 'Instruksi', PEMILIHAN: 'Pemilihan', PELAKSANAAN: 'Pelaksanaan', SELESAI: 'Selesai', PUTUS: 'Putus' },

  rute() { return /^#\/progres(\?|$)/.test(location.hash); },
  url() { return location.origin + location.pathname + '#/progres'; },

  async muat() {
    const r = await api('progres.publik', {}, { quiet: true, timeout: 45000 });
    if (r.success && r.data) { this.data = r.data; this.t = Date.now(); LS.set('sp_progres', r.data); }
    return r;
  },

  /** Halaman depan tanpa sesi: salinan lokal dulu (instan), lalu segarkan dari server. */
  depan() {
    const c = LS.get('sp_progres', null);
    if (c && c.aktif) { this.data = c; this.tampil(true); } else App.showLogin();
    this.muat().then((r) => {
      if (!r.success || !this.data) { if (this.on && !this.data) this.render(); return; }
      if (Auth.token && Auth.me) return;
      if (this.data.aktif && !this.pilihLogin) this.tampil(true);
      else if (!this.data.aktif && this.on && !this.rute()) { this.tutup(); App.showLogin(); }
      else if (this.on) this.render();
      App.tautanProgres();
    });
  },

  /** Tampilkan halaman progres (juga untuk pengguna yang sudah masuk lewat #/progres). */
  tampil(tanpaMuat) {
    $('#loginScreen').classList.add('hidden'); $('#appShell').classList.add('hidden');
    $('#progresScreen').classList.remove('hidden'); this.on = true;
    if (!this.data) this.data = LS.get('sp_progres', null);
    this.render(); window.scrollTo(0, 0);
    document.title = 'Progres Anggaran — ' + ((this.data && this.data.instansi) || 'SI-PANTAU');
    if (!tanpaMuat || !this.data) this.muat().then(() => { if (this.on) this.render(); });
    if (!this._timer) this._timer = setInterval(() => { if (this.on && document.visibilityState === 'visible' && Date.now() - this.t > 300000) this.muat().then(() => { if (this.on) this.render(); }); }, 60000);
  },
  tutup() { const el = $('#progresScreen'); if (el) el.classList.add('hidden'); this.on = false; },

  /** Tombol "Masuk untuk pegawai" / "Buka aplikasi" */
  masuk() {
    this.pilihLogin = true;
    if (this.rute()) history.replaceState(null, '', location.pathname + location.search + '#/');
    this.tutup();
    if (Auth.token && Auth.me) App.enter(); else App.showLogin();
  },

  /* ---------------- tampilan ---------------- */
  angka(v) { // "Rp 12,40 M" → angka besar + satuan kecil
    const s = rpS(v), m = s.match(/^(.*?)\s(M|T|jt)$/);
    return m ? `${esc(m[1])} <small>${m[2]}</small>` : esc(s);
  },
  bulanPendek(s) { const d = parseD(s); return d ? K.BLN[d.getMonth()] : ''; },
  jadwal(it) { if (!it.mulai && !it.selesai) return '–'; const a = this.bulanPendek(it.mulai), b = this.bulanPendek(it.selesai); return a && b ? (a === b ? a : a + '–' + b) : (a || b); },
  batang(v) { return v == null ? '<span class="pg-nil">–</span>' : `<span class="pg-mb"><i style="width:${clamp(v, 0, 100)}%"></i></span><b>${fmtN(v, v % 1 ? 1 : 0)}%</b>`; },
  chipSt(st) { const s = this.ST[st] || [st, '#999', 'slate']; return `<span class="chip ${s[2]}">${esc(s[0])}</span>`; },
  titik(it) { return '<span class="pg-tg" aria-hidden="true">' + it.tahap.map((t) => `<i class="${t.st}"></i>`).join('') + '</span>'; },

  render() {
    const el = $('#progresScreen'); if (!el) return;
    const d = this.data, masuk = Auth.token && Auth.me ? 'Buka aplikasi' : 'Masuk untuk pegawai';
    const inst = (d && d.instansi) || 'Dinas Perhubungan Kota Balikpapan';
    let body;
    if (!d) body = this.kerangka();
    else if (!d.aktif) body = `<div class="pg-card pg-off">${ic('lock')}<h2>Halaman progres sedang tidak ditampilkan</h2><p>Admin menyembunyikan halaman ini. Pegawai tetap dapat masuk ke aplikasi.</p><button class="btn pri" data-pg-masuk>${esc(masuk)}</button></div>`;
    else body = this.isi(d);
    el.innerHTML = `<header class="pg-top"><div class="pg-brand"><div class="brand-logo">SP</div><div><b>SI-PANTAU ANGGARAN</b><small>${esc(inst)}</small></div></div>
      <button class="btn pg-masuk" data-pg-masuk>${esc(masuk)} ${ic('right', 'sm')}</button></header><main class="pg-wrap" id="pgMain">${body}</main>`;
    el.onclick = (e) => {
      if (e.target.closest('[data-pg-masuk]')) { this.masuk(); return; }
      const r = e.target.closest('[data-pk]'); if (r) { const det = el.querySelector('#' + r.dataset.pk); if (det) { const buka = det.classList.toggle('hidden') === false; r.classList.toggle('open', buka); r.setAttribute('aria-expanded', buka); } }
    };
    el.onkeydown = (e) => { const r = e.target.closest('[data-pk]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); r.click(); } };
  },
  kerangka() {
    const k = '<div class="pg-card pg-kpi"><div class="sk" style="width:50%"></div><div class="sk" style="height:30px;width:70%;margin-top:10px"></div><div class="sk" style="width:40%;margin-top:10px"></div></div>';
    return `<div class="pg-h"><div><div class="sk" style="width:260px;height:28px"></div><div class="sk" style="width:180px;margin-top:10px"></div></div></div><div class="pg-g4">${k + k + k + k}</div><div class="pg-card"><div class="sk" style="margin:10px 0"></div><div class="sk" style="margin:10px 0"></div><div class="sk" style="margin:10px 0;width:60%"></div></div>`;
  },
  isi(d) {
    const ada = (b) => (d.bagian || []).indexOf(b) > -1, bd = d.bidang || [];
    let h = `<div class="pg-h"><div><h1>Progres Anggaran Tahun ${esc(d.tahun)}</h1><p>${bd.map((b) => esc(b.nama)).join(' · ')}</p></div>
      <div class="pg-up">Realisasi s.d. <b>${esc(K.BULAN[(d.bulan || 1) - 1])} ${esc(d.tahun)}</b><br>Dihitung ${esc(tgl(d.dihitung))}, ${esc(String(d.dihitung || '').slice(11, 16).replace(':', '.'))} WITA</div></div>`;
    if (ada('RINGKASAN') && d.ringkasan) {
      const r = d.ringkasan, dev = r.fisik - r.rencana;
      h += `<div class="pg-g4">
        <div class="pg-card pg-kpi"><div class="pg-k">Pagu anggaran</div><div class="pg-v">${this.angka(r.pagu)}</div><div class="pg-s">${fmtN(r.nPaket)} paket · ${fmtN(r.nSubkeg)} sub kegiatan</div></div>
        <div class="pg-card pg-kpi"><div class="pg-k">Realisasi keuangan</div><div class="pg-v">${fmtN(r.keuPct, 1)}<small>%</small></div><div class="pg-s">${esc(rpS(r.keu))} terserap</div><div class="pg-bar"><i style="width:${clamp(r.keuPct, 0, 100)}%"></i></div></div>
        <div class="pg-card pg-kpi"><div class="pg-k">Realisasi fisik</div><div class="pg-v">${fmtN(r.fisik, 1)}<small>%</small></div><div class="pg-s">rencana ${pct(r.rencana)} · deviasi <b class="${dev < -5 ? 'c-err' : dev < 0 ? 'c-warn' : 'c-ok'}">${sgn(dev)}</b></div><div class="pg-bar"><i style="width:${clamp(r.fisik, 0, 100)}%"></i></div></div>
        <div class="pg-card pg-kpi"><div class="pg-k">Sisa anggaran</div><div class="pg-v">${this.angka(r.sisa)}</div><div class="pg-s">${pct(r.pagu ? (r.sisa / r.pagu) * 100 : 0)} dari pagu</div></div></div>`;
    }
    const serapan = ada('SERAPAN'), status = ada('STATUS');
    if (serapan || status) {
      h += `<div class="pg-g2 ${serapan && status ? '' : 'satu'}">`;
      if (serapan) h += `<div class="pg-card"><h2>Serapan anggaran per bidang</h2><div class="pg-leg"><span style="--c:var(--primary)">Realisasi keuangan terhadap pagu bidang</span></div>${bd.map((b) => `<div class="pg-row"><div><b>${esc(b.nama)}</b><small>Pagu ${esc(rpS(b.pagu))} · fisik ${pct(b.fisik)}</small></div><div class="pg-bar l"><i style="width:${clamp(b.keuPct, 0, 100)}%"></i></div><div class="pg-pct">${pct(b.keuPct)}</div></div>`).join('')}</div>`;
      if (status) {
        const kol = ['DRAF', 'INSTRUKSI', 'PEMILIHAN', 'PELAKSANAAN', 'SELESAI'].concat(bd.some((b) => b.status && b.status.PUTUS) ? ['PUTUS'] : []);
        const tot = {}; kol.forEach((k) => { tot[k] = bd.reduce((a, b) => a + ((b.status || {})[k] || 0), 0); });
        h += `<div class="pg-card"><h2>Jumlah paket menurut status, per bidang</h2><div class="pg-leg">${kol.map((k) => `<span style="--c:${this.ST[k][1]}">${esc(this.ST[k][0])}</span>`).join('')}</div>
          <div class="tw pg-st-w"><table class="pg-st"><thead><tr><th>Bidang</th>${kol.map((k) => `<th>${esc(this.ST_PENDEK[k])}</th>`).join('')}<th>Total</th></tr></thead><tbody>
          ${bd.map((b) => { const s = b.status || {}, n = kol.reduce((a, k) => a + (s[k] || 0), 0); return `<tr><td>${esc(b.nama)}</td>${kol.map((k) => `<td>${s[k] || 0}</td>`).join('')}<td><b>${n}</b></td></tr><tr class="pg-bb"><td colspan="${kol.length + 2}"><div class="pg-stk">${n ? kol.filter((k) => s[k]).map((k) => `<i style="flex:${s[k]};background:${this.ST[k][1]}" title="${esc(this.ST[k][0])}: ${s[k]}"></i>`).join('') : '<em>belum ada paket</em>'}</div></td></tr>`; }).join('')}
          ${bd.length > 1 ? `<tr class="pg-tt"><td>Jumlah</td>${kol.map((k) => `<td>${tot[k]}</td>`).join('')}<td><b>${kol.reduce((a, k) => a + tot[k], 0)}</b></td></tr>` : ''}</tbody></table></div>
          <div class="pg-stl">${bd.map((b) => { const s = b.status || {}, n = kol.reduce((a, k) => a + (s[k] || 0), 0); return `<div><div class="pg-stl-h"><b>${esc(b.nama)}</b><span>${n} paket</span></div><div class="pg-stk">${n ? kol.filter((k) => s[k]).map((k) => `<i style="flex:${s[k]};background:${this.ST[k][1]}"></i>`).join('') : ''}</div><small>${n ? kol.filter((k) => s[k]).map((k) => esc(this.ST[k][0]) + ' ' + s[k]).join(' · ') : 'belum ada paket'}</small></div>`; }).join('')}</div></div>`;
      }
      h += '</div>';
    }
    if (ada('PAKET')) h += this.daftar(bd);
    h += `<div class="pg-ft"><span>Halaman hanya-baca. Nama penyedia, nilai kontrak, nomor rekening, dan dokumen tidak ditampilkan. Realisasi dihitung dari data yang diajukan dan diverifikasi.</span><span>SI-PANTAU v${esc(APP_VERSION)}</span></div>`;
    return h;
  },
  daftar(bd) {
    let h = `<div class="pg-card pg-pk"><h2>Daftar paket per bidang</h2><p class="pg-hint">Klik baris paket untuk melihat rincian tahapan dan realisasi bulanan.</p>`;
    bd.forEach((b, bi) => {
      const ps = b.paket || [];
      h += `<div class="pg-grp"><b>${esc(b.nama)}</b><span>${ps.length} paket${b.paguPaket ? ' · pagu paket ' + esc(rpS(b.paguPaket)) : ''}</span></div>`;
      if (!ps.length) { h += '<div class="pg-empty">Belum ada paket di bidang ini.</div>'; return; }
      h += `<div class="pg-list"><div class="pg-li pg-lh"><span>Paket</span><span>Metode</span><span>Jadwal</span><span class="n">Pagu</span><span>Tahap</span><span>Status</span><span>Fisik</span><span>Keuangan</span></div>`;
      ps.forEach((it, i) => {
        const id = 'pgd-' + bi + '-' + i;
        h += `<div class="pg-li" role="button" tabindex="0" aria-expanded="false" data-pk="${id}">
          <span class="pg-nm">${ic('right', 'sm pg-car')}<span><b>${esc(it.nama)}</b><small>${esc(it.subkeg)}</small></span></span>
          <span data-l="Metode">${esc(it.metode || '–')}</span><span data-l="Jadwal">${esc(this.jadwal(it))}</span>
          <span class="n" data-l="Pagu">${it.pagu ? esc(rpS(it.pagu)) : '–'}</span><span data-l="Tahap">${this.titik(it)}</span>
          <span data-l="Status">${this.chipSt(it.status)}${it.terlambat ? ' <span class="chip err">Lewat jadwal</span>' : ''}</span>
          <span class="pg-pc" data-l="Fisik">${this.batang(it.fisik)}</span><span class="pg-pc" data-l="Keuangan">${this.batang(it.keu)}</span></div>
          <div class="pg-det hidden" id="${id}">${this.rinci(it)}</div>`;
      });
      h += '</div>';
    });
    return h + '</div>';
  },
  rinci(it) {
    const ket = `<div><h3>Keterangan</h3><dl class="pg-kv"><dt>Sub kegiatan</dt><dd>${esc(it.subkeg)}${it.kode ? `<small class="mono">${esc(it.kode)}</small>` : ''}</dd><dt>Metode</dt><dd>${esc(it.metode || '–')}</dd>
      <dt>Jadwal</dt><dd>${it.mulai || it.selesai ? esc(tglP(it.mulai)) + ' – ' + esc(tglP(it.selesai)) : 'Belum berkontrak'}</dd><dt>Pagu paket</dt><dd>${it.pagu ? esc(rp(it.pagu)) : '–'}</dd><dt>Status</dt><dd>${esc((this.ST[it.status] || [it.status])[0])}${it.terlambat ? ' · melewati jadwal selesai' : ''}</dd></dl></div>`;
    const lbl = { ok: 'selesai', jalan: 'berjalan', belum: 'belum', putus: 'putus kontrak' };
    const tahap = `<div><h3>Tahapan paket</h3><div class="pg-stp">${it.tahap.map((t, i) => `<div class="${t.st}"><u>${t.st === 'ok' ? '✓' : i + 1}</u><span>${esc(t.nama)}</span><small>${esc(lbl[t.st] || t.st)}${t.tgl ? ' · ' + (i === 3 && t.st !== 'ok' ? 'jadwal ' : '') + esc(tgl(t.tgl)) : ''}</small></div>`).join('')}</div></div>`;
    let graf;
    if (!it.bulan || !it.bulan.length) graf = `<div><h3>Realisasi bulanan (kumulatif)</h3><p class="pg-nil">${it.tanpaTaut ? 'Realisasi sub kegiatan ini belum ditautkan ke kontrak paket ini, sehingga persentase per paket belum dapat dihitung.' : it.mulai ? 'Belum ada realisasi yang diajukan.' : 'Belum berkontrak.'}</p></div>`;
    else graf = `<div><h3>Realisasi bulanan (kumulatif)</h3><div class="pg-mc">${it.bulan.map((x) => `<div title="${esc(K.BULAN[x[0] - 1])}: fisik ${fmtN(x[1], 1)}%${x[2] != null ? ', keuangan ' + fmtN(x[2], 1) + '%' : ''}"><i style="height:${Math.max(1, clamp(x[1], 0, 100))}%"></i>${x[2] != null ? `<i class="k" style="height:${Math.max(1, clamp(x[2], 0, 100))}%"></i>` : ''}</div>`).join('')}</div>
      <div class="pg-ml">${it.bulan.map((x) => `<span>${esc(K.BLN[x[0] - 1].charAt(0))}</span>`).join('')}</div>
      <div class="pg-leg"><span style="--c:var(--primary)">Fisik ${it.fisik != null ? fmtN(it.fisik, 1) + '%' : '–'}</span><span style="--c:var(--accent)">Keuangan ${it.keu != null ? fmtN(it.keu, 1) + '%' : '–'}</span></div>
      <small class="pg-nil">Keuangan = pembayaran (SP2D) terhadap nilai kontrak.</small></div>`;
    return `<div class="pg-dt">${ket}${tahap}${graf}</div>`;
  },

  /* ---------------- Pengaturan (Admin) ---------------- */
  pengaturan(b) {
    const s = S.settings, daftar = String(s.DAFTAR_BIDANG || '').split(';').map((x) => x.trim()).filter(Boolean);
    const pilih = String(s.PROGRES_BIDANG || '').split(';').map(norm).filter(Boolean);
    const bag = String(s.PROGRES_BAGIAN == null ? 'RINGKASAN;SERAPAN;STATUS' : s.PROGRES_BAGIAN).split(';').map((x) => x.trim().toUpperCase());
    const tampil = String(s.PROGRES_PUBLIK || '').toUpperCase() === 'YA';
    const luar = [...new Set(S.t.subkeg.filter((x) => x.Bidang && !daftar.some((d) => sameBidang(d, x.Bidang))).map((x) => x.Bidang))];
    const cb = (name, val, on, judul, sub) => `<label class="pg-cb"><input type="checkbox" name="${name}" value="${esc(val)}" ${on ? 'checked' : ''}><span><b>${esc(judul)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></label>`;
    b.innerHTML = `<div style="max-width:980px"><div class="note info mb">${ic('info', 'sm')}<div>Halaman ini untuk <b>Kepala Dinas dan Sekretaris</b>: cukup membuka alamat aplikasi tanpa login. Anda yang menentukan isinya; pembaca tidak dapat memilih atau mengubah apa pun. Server hanya mengirim bidang dan bagian yang dicentang.</div></div>
      <form id="fPg"><div class="lbl mb-s">Status halaman</div><div class="row mb" style="gap:22px">
        <label class="check"><input type="radio" name="PROGRES_PUBLIK" value="TIDAK" ${tampil ? '' : 'checked'}> Disembunyikan (halaman depan hanya tombol login)</label>
        <label class="check"><input type="radio" name="PROGRES_PUBLIK" value="YA" ${tampil ? 'checked' : ''}> <b>Ditampilkan</b> (tanpa login, siapa pun yang mengetahui alamat aplikasi)</label></div>
        <div class="grid g2"><div><div class="lbl mb-s">Bidang yang ditampilkan</div>${daftar.length ? daftar.map((d) => cb('pg_bidang', d, pilih.indexOf(norm(d)) > -1, d, (() => { const n = S.t.subkeg.filter((x) => sameBidang(x.Bidang, d)).length; return n + ' sub kegiatan TA ' + S.tahun; })())).join('') : '<p class="mini">Daftar bidang kosong.</p>'}
          <p class="mini mt-s">Daftar diambil dari <b>Pengaturan → Umum → Daftar bidang</b>. Bila UPTD belum ada, tambahkan di sana, misalnya <code>UPTD PKB;UPTD Pengelolaan Parkir</code>.</p>
          ${luar.length ? `<div class="note warn mt-s">${ic('warn', 'sm')}<div>Ada Bidang di data Sub Kegiatan yang tidak tercantum di Daftar bidang, sehingga tidak akan tampil: <b>${luar.map(esc).join(', ')}</b>. Samakan ejaannya di Perencanaan atau tambahkan ke Daftar bidang.</div></div>` : ''}</div>
          <div><div class="lbl mb-s">Bagian yang ditampilkan</div>${this.BAGIAN.map((x) => cb('pg_bagian', x[0], bag.indexOf(x[0]) > -1, x[1], x[2])).join('')}
          <p class="mini mt-s">Bila "Daftar paket" dicentang, nama paket dan pagunya ikut terlihat oleh siapa pun yang membuka alamat aplikasi.</p></div></div>
        <div class="pg-prev mt" id="pgPrev"></div>
        <div class="row mt"><button class="btn pri" type="button" data-pg-simpan>${ic('save', 'sm')}Simpan</button><button class="btn" type="button" data-pg-lihat>${ic('eye', 'sm')}Lihat halaman progres</button><span class="mini">Alamat langsung: <code>${esc(this.url())}</code></span></div>
        <div class="note warn mt">${ic('shield', 'sm')}<div>Perubahan pengaturan ini dicatat di log audit (siapa, kapan, nilainya). Nama penyedia, nilai kontrak, nomor rekening, kendala, dan dokumen tidak pernah ditampilkan.</div></div></form></div>`;
    const nilai = () => { const f = $('#fPg'); return { PROGRES_PUBLIK: (f.querySelector('[name=PROGRES_PUBLIK]:checked') || {}).value || 'TIDAK',
      PROGRES_BIDANG: $$('[name=pg_bidang]:checked', f).map((x) => x.value).join(';'), PROGRES_BAGIAN: $$('[name=pg_bagian]:checked', f).map((x) => x.value).join(';') }; };
    const prev = () => { const v = nilai(), nb = v.PROGRES_BIDANG ? v.PROGRES_BIDANG.split(';') : [], ng = v.PROGRES_BAGIAN ? v.PROGRES_BAGIAN.split(';') : [];
      $('#pgPrev').innerHTML = `${ic('eye', 'sm')} Pratinjau: <b>${v.PROGRES_PUBLIK === 'YA' ? 'Ditampilkan' : 'Disembunyikan'}</b> · ${nb.length} bidang terpilih${nb.length ? ' (' + nb.map(esc).join(', ') + ')' : ''} · ${ng.length} bagian aktif`; };
    prev(); b.onchange = prev;
    b.onclick = (e) => {
      if (e.target.closest('[data-pg-lihat]')) { window.open(this.url(), '_blank', 'noopener'); return; }
      const t = e.target.closest('[data-pg-simpan]'); if (!t) return;
      const v = nilai();
      if (v.PROGRES_PUBLIK === 'YA' && !v.PROGRES_BIDANG) { toast('Pilih minimal satu bidang.', 'warn'); return; }
      if (v.PROGRES_PUBLIK === 'YA' && !v.PROGRES_BAGIAN) { toast('Pilih minimal satu bagian.', 'warn'); return; }
      const old = Object.assign({}, S.settings);
      mutate('pengaturan.simpan', v, { btn: t, optimistic: () => { Object.assign(S.settings, v); Store.bump(); Store.saveSoon(); return () => { S.settings = old; }; },
        onOk: (d) => { if (d.settings) { S.settings = d.settings; App.chrome(); } LS.del('sp_progres'); this.data = null; },
        okMsg: v.PROGRES_PUBLIK === 'YA' ? 'Halaman progres ditampilkan.' : 'Halaman progres disembunyikan.' });
    };
  }
};
