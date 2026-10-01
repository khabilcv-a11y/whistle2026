/* Report engine: one definition → Excel (ExcelJS) or PDF (jsPDF + autoTable).
 *
 *   report = { filename, orientation:'portrait'|'landscape', batch, programme,
 *              sheets:[{ name, title, meta:[['Interviewer',''],['Session','…']], note, columns:[{h,w,align}], rows:[[…]],
 *                        rowHeight, pageBreak }] }
 */
(function (w) {
  'use strict';
  var NAVY = 'FF14213D', LIGHT = 'FFF1F3F8', BORDER = 'FF8C94A5';

  function stamp() { var d = new Date(); return d.toISOString().slice(0, 10); }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function sheetName(s, used) {
    var n = String(s || 'Sheet').replace(/[\\/?*\[\]:]/g, ' ').slice(0, 28).trim() || 'Sheet', base = n, i = 2;
    while (used[n.toLowerCase()]) n = base.slice(0, 25) + ' ' + (i++);
    used[n.toLowerCase()] = 1; return n;
  }
  function pdfText(s) { return String(s == null ? '' : s).replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•]/g, '?'); }

  /* ------------------------------ Excel ------------------------------ */
  function toXlsx(rep) {
    var wb = new w.ExcelJS.Workbook(), used = {};
    wb.creator = 'DCIP Registration System'; wb.created = new Date();
    rep.sheets.forEach(function (sh) {
      var ncol = sh.columns.length;
      var ws = wb.addWorksheet(sheetName(sh.name || sh.title, used), {
        pageSetup: { paperSize: 9, orientation: rep.orientation || 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
          margins: { left: .4, right: .4, top: .5, bottom: .6, header: .25, footer: .25 } }
      });
      ws.columns = sh.columns.map(function (c) { return { width: c.w || 14 }; });
      var r = 1;
      function banner(text, size, bold, color) {
        ws.mergeCells(r, 1, r, ncol); var c = ws.getCell(r, 1); c.value = text;
        c.font = { name: 'Calibri', size: size, bold: bold, color: { argb: color || 'FF000000' } }; c.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(r).height = size + 10; r++;
      }
      banner(rep.programme, 11, true, NAVY);
      banner('DCIP · ' + rep.batch, 13, true, NAVY);
      banner(String(sh.title || '').toUpperCase(), 18, true);
      (sh.meta || []).forEach(function (m) {
        var half = Math.max(1, Math.floor(ncol / 2));
        ws.mergeCells(r, 1, r, half); ws.mergeCells(r, half + 1, r, Math.max(ncol, half + 1));
        var a = ws.getCell(r, 1), b = ws.getCell(r, half + 1);
        a.value = m[0] + ': ' + (m[1] == null ? '' : m[1]); a.font = { bold: true, size: 11 };
        if (m[2]) { b.value = m[2][0] + ': ' + m[2][1]; b.font = { bold: true, size: 11 }; b.alignment = { horizontal: 'right' }; }
        ws.getRow(r).height = 20; r++;
      });
      if (sh.note) { ws.mergeCells(r, 1, r, ncol); var nc = ws.getCell(r, 1); nc.value = sh.note; nc.font = { italic: true, size: 10, color: { argb: 'FF555555' } }; nc.alignment = { wrapText: true }; ws.getRow(r).height = 28; r++; }
      r++;
      var hdr = r, hr = ws.getRow(hdr);
      sh.columns.forEach(function (c, i) {
        var cell = hr.getCell(i + 1); cell.value = c.h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      hr.height = 30; r++;
      sh.rows.forEach(function (row, ri) {
        var xr = ws.getRow(r);
        sh.columns.forEach(function (c, i) {
          var cell = xr.getCell(i + 1), v = row[i];
          cell.value = v === undefined || v === null ? '' : v;
          cell.alignment = { vertical: 'middle', wrapText: true, horizontal: c.align || (typeof v === 'number' ? 'center' : 'left') };
          cell.border = { top: { style: 'thin', color: { argb: BORDER } }, left: { style: 'thin', color: { argb: BORDER } }, bottom: { style: 'thin', color: { argb: BORDER } }, right: { style: 'thin', color: { argb: BORDER } } };
          if (ri % 2 && !sh.noBands) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
        });
        xr.height = sh.rowHeight || 30; r++;
      });
      ws.views = [{ state: 'frozen', ySplit: hdr }];
      ws.pageSetup.printTitlesRow = hdr + ':' + hdr;
      ws.headerFooter.oddFooter = '&L&8DCIP ' + rep.batch + ' · ' + stamp() + '&R&8Page &P of &N';
    });
    return wb.xlsx.writeBuffer().then(function (buf) {
      download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), rep.filename + '.xlsx');
    });
  }

  /* ------------------------------- PDF ------------------------------- */
  function toPdf(rep) {
    var J = w.jspdf.jsPDF, doc = new J({ orientation: rep.orientation || 'landscape', unit: 'pt', format: 'a4' });
    var PW = doc.internal.pageSize.getWidth(), M = 28, avail = PW - M * 2, y = M;
    rep.sheets.forEach(function (sh, si) {
      if (si > 0 && (sh.pageBreak || (rep.pageBreaks))) { doc.addPage(); y = M; }
      else if (si > 0) { y += 18; if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = M; } }
      doc.setTextColor(20, 33, 61); doc.setFont('helvetica', 'bold');
      if (si === 0 || sh.pageBreak || rep.pageBreaks) {
        doc.setFontSize(9); doc.text(pdfText(rep.programme).toUpperCase(), PW / 2, y + 4, { align: 'center' });
        doc.setFontSize(13); doc.text(pdfText('DCIP · ' + rep.batch), PW / 2, y + 20, { align: 'center' });
        y += 30;
      }
      doc.setTextColor(0); doc.setFontSize(sh.big === false ? 12 : 17);
      doc.text(pdfText(String(sh.title || '').toUpperCase()), PW / 2, y + 14, { align: 'center' }); y += 28;
      doc.setFontSize(10.5);
      (sh.meta || []).forEach(function (m) {
        doc.setFont('helvetica', 'bold'); doc.text(pdfText(m[0] + ': ' + (m[1] == null ? '' : m[1])), M, y + 8);
        if (m[2]) doc.text(pdfText(m[2][0] + ': ' + m[2][1]), PW - M, y + 8, { align: 'right' });
        y += 16;
      });
      if (sh.note) { doc.setFont('helvetica', 'italic'); doc.setFontSize(9); var lines = doc.splitTextToSize(pdfText(sh.note), avail); doc.text(lines, M, y + 8); y += lines.length * 11 + 4; }
      var tw = sh.columns.reduce(function (s, c) { return s + (c.w || 14); }, 0), colStyles = {};
      sh.columns.forEach(function (c, i) { colStyles[i] = { cellWidth: avail * (c.w || 14) / tw, halign: c.align || 'left' }; });
      doc.autoTable({
        startY: y + 4, margin: { left: M, right: M, top: M + 4, bottom: 34 },
        head: [sh.columns.map(function (c) { return pdfText(c.h); })],
        body: sh.rows.map(function (r) { return r.map(function (v) { return pdfText(v); }); }),
        theme: 'grid', tableWidth: avail, columnStyles: colStyles,
        styles: { font: 'helvetica', fontSize: sh.fontSize || 8.5, cellPadding: 4, lineColor: [140, 148, 165], lineWidth: .5, valign: 'middle', minCellHeight: sh.rowHeight ? sh.rowHeight * .8 : 0, overflow: 'linebreak' },
        headStyles: { fillColor: [20, 33, 61], textColor: 255, halign: 'center', fontStyle: 'bold' },
        alternateRowStyles: sh.noBands ? {} : { fillColor: [241, 243, 248] }
      });
      y = doc.lastAutoTable.finalY;
    });
    var pages = doc.getNumberOfPages(), H = doc.internal.pageSize.getHeight();
    for (var p = 1; p <= pages; p++) {
      doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110);
      doc.text(pdfText('DCIP ' + rep.batch + ' · ' + stamp()), M, H - 16);
      doc.text('Page ' + p + ' of ' + pages, PW - M, H - 16, { align: 'right' });
    }
    doc.save(rep.filename + '.pdf');
    return Promise.resolve();
  }

  w.Reports = {
    download: function (rep, type) {
      rep.filename = String(rep.filename).replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_') + '_' + stamp();
      if (type === 'xlsx' && !w.ExcelJS) return Promise.reject(new Error('Excel library not loaded.'));
      if (type === 'pdf' && !(w.jspdf && w.jspdf.jsPDF)) return Promise.reject(new Error('PDF library not loaded.'));
      return type === 'xlsx' ? toXlsx(rep) : toPdf(rep);
    }
  };
})(window);
