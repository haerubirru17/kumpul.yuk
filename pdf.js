  // ════════════════════════════════════════════════════════════
//  pdf.js — Generate PDF Surat Pencairan & E-Statement
//  Dependensi: jsPDF (CDN), window.db (dari firebase.js)
//  Fungsi global: generatePDF(), downloadEStatement()
//  + helpers test dummy: loadDummyTemplate(), testPdfDummy(), dll
// ════════════════════════════════════════════════════════════

// ── Utility (duplikat kecil dari index agar pdf.js mandiri) ──
function _formatRp(n) {
  return 'Rp\u00a0' + Number(n || 0).toLocaleString('id-ID');
}
function _formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ════════════════════════════════════════════════════════════
//  SURAT PENCAIRAN PDF
// ════════════════════════════════════════════════════════════
window.generatePDF = function(nasabah, setoranList, setting, keterangan, catatan) {
  const { jsPDF } = window.jspdf;
  const setorans = [...setoranList].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
  const total = setorans.reduce((a, s) => a + Number(s.nominal), 0);
  const sisa  = Math.max(0, Number(nasabah.target) - total);
  const lunas = sisa === 0;
  const now   = new Date();
  const tglCetak    = _formatDate(now.toISOString().slice(0, 10));
  const tglPertama  = setorans.length ? _formatDate(setorans[0].tanggal) : '-';
  const tglTerakhir = setorans.length ? _formatDate(setorans[setorans.length - 1].tanggal) : '-';

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const PW = 210, L = 14, R = 14, CW = PW - L - R, PH = 297, T = 14;
  let y = T;
  const noSurat = 'SE' +
    String(now.getMonth()+1).padStart(2,'0') +
    String(now.getDate()).padStart(2,'0') + '/' +
    now.getFullYear() + '/' +
    String(now.getHours()).padStart(2,'0') +
    String(now.getMinutes()).padStart(2,'0');

  const f    = (style, size) => { doc.setFont('helvetica', style || 'normal'); doc.setFontSize(size || 9.5); };
  const col  = (r, g, b)     => doc.setTextColor(r, g, b);
  const reset = ()            => col(17, 17, 17);
  const gray  = ()            => col(100, 100, 100);
  const wrap  = (txt, w, sz)  => { doc.setFontSize(sz || 9.5); return doc.splitTextToSize(String(txt || ''), w); };

  const needPage = (need) => {
    if (y + (need || 20) > PH - 16) { doc.addPage(); y = T; drawKop(false); }
  };

  function drawKop(full) {
    f('bold', 13);
    doc.text((setting.lembaga || 'Kumpul.Yuk').toUpperCase(), PW / 2, y, { align: 'center' }); y += 5.5;
    if (setting.kontak) { f('normal', 8); gray(); doc.text(setting.kontak, PW / 2, y, { align: 'center' }); reset(); y += 4; }
    doc.setLineWidth(0.8); doc.setDrawColor(17, 17, 17);
    doc.line(L, y, PW - R, y); doc.setLineWidth(0.2); doc.line(L, y + 1.4, PW - R, y + 1.4);
    doc.setDrawColor(0); y += 6;
    if (full) {
      f('bold', 12); doc.text('SURAT KETERANGAN PENCAIRAN TABUNGAN', PW / 2, y, { align: 'center' }); y += 5;
      f('normal', 8.5); gray(); doc.text('No: ' + noSurat, PW / 2, y, { align: 'center' }); reset(); y += 7;
    } else {
      f('italic', 8); gray(); doc.text('(lanjutan) ' + noSurat + ' - ' + nasabah.nama, L, y); reset(); y += 5;
    }
  }

  drawKop(true);

  const lembagaNama = (setting.lembaga || 'Kumpul.Yuk').toUpperCase();
  const introText = lunas
    ? 'Yang bertanda tangan di bawah ini, pengelola tabungan ' + lembagaNama + ', menerangkan bahwa nasabah berikut telah menyelesaikan program tabungan. Seluruh target tabungan telah terpenuhi dan dana dinyatakan lunas. Dana telah dicairkan sesuai kesepakatan.'
    : 'Yang bertanda tangan di bawah ini, pengelola tabungan ' + lembagaNama + ', menerangkan bahwa nasabah berikut melakukan pencairan dana tabungan. Dana tersebut telah diserahkan kepada nasabah yang bersangkutan.';
  f('normal', 9.5);
  const pmLines = wrap(introText, CW);
  doc.text(pmLines, L, y, { lineHeightFactor: 1.55 }); y += pmLines.length * 5.5 + 3;

  f('bold', 9.5);
  if (lunas) col(5, 150, 105); else col(14, 116, 144);
  const emphLine = lunas
    ? 'Jumlah Lunas: ' + _formatRp(total) + ' dari target ' + _formatRp(nasabah.target)
    : 'Jumlah Dicairkan: ' + _formatRp(total) + ' dari target ' + _formatRp(nasabah.target) + '  |  Kekurangan: ' + _formatRp(sisa);
  doc.text(emphLine, L, y); reset(); y += 7;

  needPage(50);
  f('bold', 10); doc.text('Identitas Nasabah', L, y); y += 4;
  const idRows = [
    ['Nama Lengkap', nasabah.nama],
    ['No. HP', nasabah.hp],
    ...(nasabah.alamat ? [['Alamat', nasabah.alamat]] : []),
    ['Periode Menabung', tglPertama + ' - ' + tglTerakhir],
    ['Tanggal Cairkan', _formatDate(nasabah.cairkan)],
  ];
  const RH = 6.5, labelW = 52, idH = idRows.length * RH + 4;
  doc.setFillColor(250, 250, 252); doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
  doc.rect(L, y, CW, idH, 'FD'); doc.setDrawColor(0);
  idRows.forEach((row, i) => {
    const ry = y + 5 + i * RH;
    if (i > 0) { doc.setLineWidth(0.1); doc.setDrawColor(226, 232, 240); doc.line(L, ry - 2, L + CW, ry - 2); doc.setDrawColor(0); }
    f('normal', 9); gray(); doc.text(row[0], L + 3, ry); reset(); f('bold', 9.5);
    doc.text(wrap(String(row[1]), CW - labelW - 4)[0], L + labelW, ry);
  });
  y += idH + 6;

  needPage(22);
  f('bold', 10); doc.text('Rincian Setoran', L, y); y += 4;
  const cw = [10, 38, 46, 28, 60];
  const heads = ['No', 'Tanggal', 'Nominal', 'Metode', 'Catatan'];
  const aligns = ['center', 'left', 'right', 'center', 'left'];
  const THH = 9, TRH = 8, PAD = 3.5;

  function drawTblHead() {
    doc.setFillColor(14, 116, 144); doc.rect(L, y, CW, THH, 'F');
    let cx = L;
    heads.forEach((h, i) => {
      f('bold', 8.5); col(255, 255, 255);
      const tx = aligns[i] === 'right' ? cx + cw[i] - PAD : aligns[i] === 'center' ? cx + cw[i] / 2 : cx + PAD;
      doc.text(h, tx, y + THH / 2 + 1.5, { align: aligns[i] });
      if (i < heads.length - 1) { doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.2); doc.line(cx + cw[i], y + 1.5, cx + cw[i], y + THH - 1.5); }
      cx += cw[i];
    });
    reset(); doc.setDrawColor(0); y += THH;
  }
  drawTblHead();

  let prevPage = doc.internal.getCurrentPageInfo().pageNumber;
  setorans.forEach((s, i) => {
    needPage(TRH + 3);
    const curPage = doc.internal.getCurrentPageInfo().pageNumber;
    if (curPage !== prevPage) { drawTblHead(); prevPage = curPage; }
    if (i % 2 === 0) { doc.setFillColor(245, 250, 252); doc.rect(L, y, CW, TRH, 'F'); }
    doc.setDrawColor(214, 226, 230); doc.setLineWidth(0.15); doc.line(L, y + TRH, L + CW, y + TRH);
    let cx2 = L;
    for (let j = 0; j < cw.length - 1; j++) { cx2 += cw[j]; doc.setDrawColor(214, 226, 230); doc.setLineWidth(0.1); doc.line(cx2, y, cx2, y + TRH); }
    doc.setDrawColor(0);
    const cells = [String(i + 1), _formatDate(s.tanggal), _formatRp(s.nominal), s.metode.charAt(0).toUpperCase() + s.metode.slice(1), s.catatan || '-'];
    let cx = L;
    cells.forEach((v, j) => {
      f(j === 2 ? 'bold' : 'normal', j === 2 ? 9 : 8.5);
      if (j === 2) col(14, 116, 144); else reset();
      const tx = aligns[j] === 'right' ? cx + cw[j] - PAD : aligns[j] === 'center' ? cx + cw[j] / 2 : cx + PAD;
      doc.text(wrap(v, cw[j] - PAD * 2, j === 2 ? 9 : 8.5)[0], tx, y + TRH / 2 + 1.5, { align: aligns[j] });
      cx += cw[j];
    });
    reset(); y += TRH;
  });

  needPage(TRH + 3);
  doc.setFillColor(14, 116, 144); doc.rect(L, y, CW, TRH, 'F');
  f('bold', 9); col(255, 255, 255);
  doc.text('Total (' + setorans.length + ' setoran)', L + PAD, y + TRH / 2 + 1.5);
  doc.text(_formatRp(total), L + cw[0] + cw[1] + cw[2] - PAD, y + TRH / 2 + 1.5, { align: 'right' });
  reset(); y += TRH + 6;

  needPage(36);
  const sumRows = [
    { lbl: 'Target Tabungan',              val: _formatRp(nasabah.target), bold: false },
    { lbl: 'Total Setoran (' + setorans.length + 'x)', val: _formatRp(total), bold: false },
    ...(!lunas ? [{ lbl: 'Kekurangan', val: _formatRp(sisa), bold: true, red: true }] : []),
    { lbl: 'Dibayarkan via', val: keterangan || '-', bold: true, divider: true },
  ];
  const SRH = 6.5, boxH = sumRows.length * SRH + 10;
  doc.setFillColor(250, 250, 252); doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
  doc.rect(L, y, CW, boxH, 'FD'); doc.setDrawColor(0);
  let sy = y + 6;
  sumRows.forEach(item => {
    if (item.divider) { doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.2); doc.line(L + 4, sy - 2.5, L + CW - 4, sy - 2.5); doc.setDrawColor(0); }
    f('normal', 9); gray(); doc.text(item.lbl, L + 4, sy); reset();
    f(item.bold ? 'bold' : 'normal', 9.5);
    if (item.red) col(220, 38, 38);
    doc.text(wrap(String(item.val), CW / 2)[0], L + CW - 4, sy, { align: 'right' });
    reset(); sy += SRH;
  });
  y += boxH + 6;

  if (catatan && catatan.trim()) {
    needPage(16);
    f('normal', 9);
    gray(); doc.text('Catatan:', L, y); reset();
    f('italic', 9);
    const catLines = wrap(catatan.trim(), CW - 20, 9);
    doc.text(catLines, L + 20, y, { lineHeightFactor: 1.5 });
    reset(); y += catLines.length * 5 + 5;
  }

  needPage(18); f('normal', 9.5);
  const ptLines = wrap('Demikian surat keterangan ini dibuat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya.', CW);
  doc.text(ptLines, L, y, { lineHeightFactor: 1.55 }); y += ptLines.length * 5.5 + 5;
  doc.text((setting.kota ? setting.kota + ', ' : '') + tglCetak, L + CW, y, { align: 'right' }); y += 16;

  needPage(36);
  const c1 = L + CW * 0.22, c2 = L + CW * 0.78;
  f('normal', 9.5);
  doc.text('Nasabah,', c1, y, { align: 'center' });
  doc.text('Pengelola,', c2, y, { align: 'center' });
  y += 4;
  const signY = y;
  if (setting.ttd) {
    const iW = 38, iH = 20, iX = c2 - iW / 2;
    try { doc.addImage(setting.ttd, 'JPEG', iX, signY, iW, iH, '', 'FAST'); } catch (_) {}
    const lineY = signY + iH - 6;
    doc.setLineWidth(0.3); doc.setDrawColor(100, 100, 100);
    doc.line(c2 - 22, lineY, c2 + 22, lineY); doc.setDrawColor(0);
    y = lineY + 4;
  } else {
    y += 20;
    doc.setLineWidth(0.3); doc.setDrawColor(100, 100, 100);
    doc.line(c1 - 22, y, c1 + 22, y);
    doc.line(c2 - 22, y, c2 + 22, y);
    doc.setDrawColor(0); y += 4;
  }
  f('bold', 9.5);
  doc.text('(___________________)', c1, y, { align: 'center' });
  doc.text(setting.pengelola || '(___________________)', c2, y, { align: 'center' });
  if (setting.jabatan) { y += 4; f('normal', 8.5); gray(); doc.text(setting.jabatan, c2, y, { align: 'center' }); reset(); }

  const TP = doc.internal.getNumberOfPages();
  for (let p = 1; p <= TP; p++) {
    doc.setPage(p); f('normal', 7.5);
    doc.setDrawColor(14, 116, 144); doc.setLineWidth(0.4); doc.line(L, PH - 12, PW - R, PH - 12); doc.setDrawColor(0);
    gray();
    doc.text(setting.lembaga || 'Kumpul.Yuk', L, PH - 8);
    doc.text('Hal. ' + p + ' / ' + TP, PW / 2, PH - 8, { align: 'center' });
    doc.text('Dicetak: ' + tglCetak, PW - R, PH - 8, { align: 'right' });
    reset();
  }

  const fname = 'Pencairan-' + nasabah.nama.replace(/\s+/g, '-') + '-' +
    now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '.pdf';
  doc.save(fname);
  if (window.showToast) showToast('Surat Pencairan berhasil diunduh!');
};

// ════════════════════════════════════════════════════════════
//  E-STATEMENT PDF
// ════════════════════════════════════════════════════════════
window.downloadEStatement = function(nasabahId) {
  const nasabah = window.db.getNasabah(nasabahId);
  if (!nasabah) return;
  const setting  = window.db.getSetting();
  const setorans = window.db.getSetoranList(nasabahId).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
  const total    = setorans.reduce((a, s) => a + Number(s.nominal), 0);
  const sisa     = Math.max(0, Number(nasabah.target) - total);
  const lunas    = sisa === 0;
  const now      = new Date();
  const tglCetak    = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const tglPertama  = setorans.length ? _formatDate(setorans[0].tanggal) : '-';
  const tglTerakhir = setorans.length ? _formatDate(setorans[setorans.length - 1].tanggal) : '-';

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297, L = 18, R = 18, T = 16;
  const CW = PW - L - R;
  let y = T;

  const f     = (style, sz) => { doc.setFont('helvetica', style); if (sz) doc.setFontSize(sz); };
  const gray  = ()          => doc.setTextColor(100, 116, 139);
  const reset = ()          => { doc.setTextColor(0); doc.setFont('helvetica', 'normal'); };
  const col   = (r, g, b)   => doc.setTextColor(r, g, b);
  const wrap  = (txt, w, sz) => { doc.setFontSize(sz || 9.5); return doc.splitTextToSize(String(txt || ''), w); };
  const needPage = (need) => {
    if (y + (need || 20) > PH - 16) { doc.addPage(); y = T; drawKop(false); }
  };

  function drawKop(full) {
    f('bold', 13);
    doc.text((setting.lembaga || 'Kumpul.Yuk').toUpperCase(), PW / 2, y, { align: 'center' }); y += 5.5;
    if (setting.kontak) { f('normal', 8); gray(); doc.text(setting.kontak, PW / 2, y, { align: 'center' }); reset(); y += 4; }
    doc.setLineWidth(0.8); doc.setDrawColor(17, 17, 17);
    doc.line(L, y, PW - R, y); doc.setLineWidth(0.2); doc.line(L, y + 1.4, PW - R, y + 1.4);
    doc.setDrawColor(0); y += 6;
    if (full) {
      f('bold', 12); doc.text('E-STATEMENT TABUNGAN', PW / 2, y, { align: 'center' }); y += 5;
      f('normal', 8.5); gray(); doc.text('Dicetak: ' + tglCetak, PW / 2, y, { align: 'center' }); reset(); y += 8;
    } else {
      f('italic', 8); gray(); doc.text('(lanjutan) ' + nasabah.nama, L, y); reset(); y += 5;
    }
  }

  drawKop(true);

  f('bold', 10); doc.text('Identitas Nasabah', L, y); y += 4;
  const idRows = [
    ['Nama Lengkap', nasabah.nama],
    ['No. HP', nasabah.hp],
    ...(nasabah.alamat ? [['Alamat', nasabah.alamat]] : []),
    ['Status', nasabah.status.charAt(0).toUpperCase() + nasabah.status.slice(1)],
    ['Tanggal Cairkan', _formatDate(nasabah.cairkan)],
  ];
  const RH = 6.5, labelW = 52, idH = idRows.length * RH + 4;
  doc.setFillColor(250, 250, 252); doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
  doc.rect(L, y, CW, idH, 'FD'); doc.setDrawColor(0);
  idRows.forEach((row, i) => {
    const ry = y + 5 + i * RH;
    if (i > 0) { doc.setLineWidth(0.1); doc.setDrawColor(226, 232, 240); doc.line(L, ry - 2, L + CW, ry - 2); doc.setDrawColor(0); }
    f('normal', 9); gray(); doc.text(row[0], L + 3, ry); reset(); f('bold', 9.5);
    doc.text(wrap(String(row[1]), CW - labelW - 4)[0], L + labelW, ry);
  });
  y += idH + 6;

  needPage(38);
  f('bold', 10); doc.text('Ringkasan Tabungan', L, y); y += 4;
  const pct = nasabah.target > 0 ? Math.min(100, Math.round(total / nasabah.target * 100)) : 0;
  const sumRows = [
    { lbl: 'Target Tabungan', val: _formatRp(nasabah.target) },
    { lbl: 'Total Setoran (' + setorans.length + 'x)', val: _formatRp(total), highlight: true },
    { lbl: lunas ? 'Kelebihan' : 'Kekurangan', val: _formatRp(sisa), red: !lunas, green: lunas },
    { lbl: 'Periode', val: tglPertama + (setorans.length > 1 ? ' - ' + tglTerakhir : '') },
  ];
  const SRH = 7, progRowH = 13;
  const boxH = sumRows.length * SRH + 8 + progRowH;
  doc.setFillColor(250, 250, 252); doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
  doc.rect(L, y, CW, boxH, 'FD'); doc.setDrawColor(0);
  let sy = y + 6;
  sumRows.forEach(item => {
    f('normal', 9); gray(); doc.text(item.lbl, L + 4, sy); reset();
    f(item.highlight ? 'bold' : 'normal', item.highlight ? 10 : 9.5);
    if (item.red) col(220, 38, 38);
    else if (item.green) col(5, 150, 105);
    else if (item.highlight) col(14, 116, 144);
    doc.text(String(item.val), L + CW - 4, sy, { align: 'right' });
    reset(); sy += SRH;
  });
  doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.3);
  doc.line(L, sy - 1, L + CW, sy - 1); doc.setDrawColor(0);
  const prY = sy + 4;
  f('normal', 8); gray(); doc.text('Progres Tabungan', L + 4, prY); reset();
  f('bold', 9);
  if (lunas) col(5, 150, 105); else col(14, 116, 144);
  doc.text(pct + '%', L + CW - 4, prY, { align: 'right' });
  reset();
  const barX = L + 4, barW = CW - 8, barH = 3, barY = prY + 2.5;
  doc.setFillColor(226, 232, 240); doc.rect(barX, barY, barW, barH, 'F');
  if (lunas) doc.setFillColor(5, 150, 105); else doc.setFillColor(14, 116, 144);
  doc.rect(barX, barY, barW * pct / 100, barH, 'F');
  y += boxH + 6;

  needPage(24);
  f('bold', 10); doc.text('Riwayat Setoran', L, y); y += 4;

  if (setorans.length === 0) {
    f('italic', 9); gray(); doc.text('Belum ada setoran tercatat.', L + 4, y + 6); reset(); y += 14;
  } else {
    const cw = [10, 38, 46, 28, 60];
    const heads = ['No', 'Tanggal', 'Nominal', 'Metode', 'Catatan'];
    const aligns = ['center', 'left', 'right', 'center', 'left'];
    const THH = 9, TRH = 8, PAD = 3.5;

    function drawHead() {
      doc.setFillColor(14, 116, 144); doc.rect(L, y, CW, THH, 'F');
      let cx = L;
      heads.forEach((h, i) => {
        f('bold', 8.5); col(255, 255, 255);
        const tx = aligns[i] === 'right' ? cx + cw[i] - PAD : aligns[i] === 'center' ? cx + cw[i] / 2 : cx + PAD;
        doc.text(h, tx, y + THH / 2 + 1.5, { align: aligns[i] });
        if (i < heads.length - 1) { doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.2); doc.line(cx + cw[i], y + 1.5, cx + cw[i], y + THH - 1.5); }
        cx += cw[i];
      });
      reset(); doc.setDrawColor(0); y += THH;
    }
    drawHead();

    let prevPageEs = doc.internal.getCurrentPageInfo().pageNumber;
    setorans.forEach((s, i) => {
      needPage(TRH + 3);
      const curPageEs = doc.internal.getCurrentPageInfo().pageNumber;
      if (curPageEs !== prevPageEs) { drawHead(); prevPageEs = curPageEs; }
      if (i % 2 === 0) { doc.setFillColor(245, 250, 252); doc.rect(L, y, CW, TRH, 'F'); }
      doc.setDrawColor(214, 226, 230); doc.setLineWidth(0.15); doc.line(L, y + TRH, L + CW, y + TRH);
      let cx2 = L;
      for (let j = 0; j < cw.length - 1; j++) { cx2 += cw[j]; doc.setLineWidth(0.1); doc.line(cx2, y, cx2, y + TRH); }
      doc.setDrawColor(0);
      const cells = [String(i+1), _formatDate(s.tanggal), _formatRp(s.nominal), s.metode.charAt(0).toUpperCase()+s.metode.slice(1), s.catatan||'-'];
      let cx = L;
      cells.forEach((v, j) => {
        f(j===2?'bold':'normal', j===2?9:8.5);
        if (j===2) col(14,116,144); else reset();
        const tx = aligns[j]==='right' ? cx+cw[j]-PAD : aligns[j]==='center' ? cx+cw[j]/2 : cx+PAD;
        doc.text(wrap(v, cw[j]-PAD*2, j===2?9:8.5)[0], tx, y+TRH/2+1.5, { align: aligns[j] });
        cx += cw[j];
      });
      reset(); y += TRH;
    });

    needPage(TRH + 3);
    doc.setFillColor(14,116,144); doc.rect(L, y, CW, TRH, 'F');
    f('bold', 9); col(255,255,255);
    doc.text('Total (' + setorans.length + ' setoran)', L + PAD, y + TRH/2 + 1.5);
    doc.text(_formatRp(total), L + cw[0]+cw[1]+cw[2]-PAD, y + TRH/2 + 1.5, { align: 'right' });
    reset(); y += TRH + 8;
  }

  needPage(14);
  f('italic', 8.5); gray();
  doc.text('Dokumen ini digenerate secara otomatis oleh sistem ' + (setting.lembaga || 'Kumpul.Yuk') + ' pada ' + tglCetak + '.', L, y, { maxWidth: CW });
  reset();

  const TP = doc.internal.getNumberOfPages();
  for (let p = 1; p <= TP; p++) {
    doc.setPage(p); f('normal', 7.5);
    doc.setDrawColor(14,116,144); doc.setLineWidth(0.4); doc.line(L, PH-12, PW-R, PH-12); doc.setDrawColor(0);
    gray();
    doc.text(setting.lembaga || 'Kumpul.Yuk', L, PH-8);
    doc.text('Hal. ' + p + ' / ' + TP, PW/2, PH-8, { align: 'center' });
    doc.text('Dicetak: ' + tglCetak, PW-R, PH-8, { align: 'right' });
    reset();
  }

  const fname = 'E-Statement-' + nasabah.nama.replace(/\s+/g, '-') + '-' +
    now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '.pdf';
  doc.save(fname);
  if (window.showToast) showToast('E-Statement berhasil diunduh!');
};

// ════════════════════════════════════════════════════════════
//  TEST PDF DENGAN DATA DUMMY
// ════════════════════════════════════════════════════════════
const DUMMY_TEMPLATES = {
  estatement: {
    nasabah: { id:'dummy-001', nama:'Dummy Nasabah Contoh', hp:'081200001111', alamat:'Jl. Contoh Dummy No.99, Kota Uji Coba', target:2000000, cairkan:'2026-12-31', daftar:'2026-01-01', catatan:'Data dummy untuk testing PDF', status:'aktif' },
    setoran: [
      { id:'d-s1', nasabah_id:'dummy-001', nominal:400000, metode:'tunai',    tanggal:'2026-01-10', catatan:'Setoran pertama' },
      { id:'d-s2', nasabah_id:'dummy-001', nominal:350000, metode:'transfer', tanggal:'2026-02-08', catatan:'via BCA' },
      { id:'d-s3', nasabah_id:'dummy-001', nominal:300000, metode:'tunai',    tanggal:'2026-03-05', catatan:'' },
      { id:'d-s4', nasabah_id:'dummy-001', nominal:450000, metode:'transfer', tanggal:'2026-04-12', catatan:'via Mandiri' },
      { id:'d-s5', nasabah_id:'dummy-001', nominal:500000, metode:'tunai',    tanggal:'2026-05-03', catatan:'Setoran pelunasan' },
    ],
  },
  pencairan: {
    nasabah: { id:'dummy-002', nama:'Dummy Pencairan Contoh', hp:'082200002222', alamat:'Jl. Test PDF No.7, Kota Dummy', target:1500000, cairkan:'2026-06-30', daftar:'2026-01-05', catatan:'Lunas sebelum jatuh tempo', status:'cair' },
    setoran: [
      { id:'d-p1', nasabah_id:'dummy-002', nominal:500000, metode:'tunai',    tanggal:'2026-01-20', catatan:'' },
      { id:'d-p2', nasabah_id:'dummy-002', nominal:500000, metode:'transfer', tanggal:'2026-03-15', catatan:'via BRI' },
      { id:'d-p3', nasabah_id:'dummy-002', nominal:500000, metode:'tunai',    tanggal:'2026-05-10', catatan:'Pelunasan' },
    ],
    pencairan: { keterangan:'Transfer BCA', tanggal:'2026-06-01', catatan:'Dicairkan lebih awal', nominal:1500000 },
  },
};

window.loadDummyTemplate = function(type) {
  const el = document.getElementById('dummy-json-input');
  if (!el) return;
  el.value = JSON.stringify(DUMMY_TEMPLATES[type], null, 2);
  document.getElementById('err-dummy-json').textContent = '';
  if (window.showToast) showToast('Template ' + (type === 'estatement' ? 'E-Statement' : 'Pencairan') + ' dimuat!');
};

window.loadDummyFromFile = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const el = document.getElementById('dummy-json-input');
    if (el) { el.value = ev.target.result; document.getElementById('err-dummy-json').textContent = ''; if (window.showToast) showToast('File JSON berhasil dimuat!'); }
  };
  reader.readAsText(file);
  e.target.value = '';
};

window.clearDummyJson = function() {
  const el = document.getElementById('dummy-json-input');
  if (el) el.value = '';
  document.getElementById('err-dummy-json').textContent = '';
};

window.testPdfDummy = function(type) {
  const el = document.getElementById('dummy-json-input');
  const errEl = document.getElementById('err-dummy-json');
  if (!el || !el.value.trim()) { if (errEl) errEl.textContent = 'JSON kosong.'; return; }
  let data;
  try {
    data = JSON.parse(el.value);
    if (!data.nasabah || !Array.isArray(data.setoran)) throw new Error('Format tidak valid.');
    if (errEl) errEl.textContent = '';
  } catch (err) { if (errEl) errEl.textContent = '⚠ ' + err.message; return; }

  const setting    = window.db.getSetting();
  const nasabah    = { id: data.nasabah.id || 'dummy-test', ...data.nasabah };
  const setoranList = (data.setoran || []).map((s, i) => ({
    id: s.id || ('d-' + i), nasabah_id: nasabah.id,
    nominal: Number(s.nominal) || 0, metode: s.metode || 'tunai',
    tanggal: s.tanggal || new Date().toISOString().slice(0, 10),
    catatan: s.catatan || '',
  }));

  try {
    if (type === 'estatement') {
      const origGet = window.db.getNasabah.bind(window.db);
      const origList = window.db.getSetoranList.bind(window.db);
      window.db.getNasabah    = (id) => id === nasabah.id ? nasabah : origGet(id);
      window.db.getSetoranList = (nid) => nid === nasabah.id ? setoranList : origList(nid);
      try { downloadEStatement(nasabah.id); } finally { window.db.getNasabah = origGet; window.db.getSetoranList = origList; }
    } else {
      const p = data.pencairan || {};
      generatePDF(nasabah, setoranList, setting, p.keterangan || 'Transfer (Dummy)', p.catatan || '');
    }
  } catch (err) {
    if (window.showToast) showToast('PDF gagal: ' + err.message, 'error');
    console.error(err);
  }
};
