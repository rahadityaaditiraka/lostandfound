// ============================================================
// Google Apps Script — Lost & Found BXRink Sync
// Paste kode ini di Extensions > Apps Script
// Ganti SPREADSHEET_ID dengan ID spreadsheet Anda
// ============================================================

const SPREADSHEET_ID = 'GANTI_DENGAN_SPREADSHEET_ID_ANDA';
const APP_URL = 'https://stirring-yeot-a170188.netlify.app';

function doPost(e) {
  try {
    const data   = JSON.parse(e.postData.contents);
    const action = data.action;
    const ss     = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (action === 'syncItems') {
      syncItemsToSheets(ss, data.items || []);
    } else if (action === 'syncClaims') {
      syncClaimsToSheet(ss, data.claims || []);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function syncItemsToSheets(ss, items) {
  const lostSheet     = getOrCreateSheet(ss, '🚨 Barang Hilang');
  const foundSheet    = getOrCreateSheet(ss, '✅ Barang Ditemukan');
  const resolvedSheet = getOrCreateSheet(ss, '📦 Sudah Diambil');

  const headers = ['ID', 'Nama Barang', 'Kategori', 'Deskripsi', 'Lokasi', 'Tanggal',
                   'Pelapor', 'Kontak', 'Status', 'Tanggal Lapor', 'Link Foto'];

  const lostRows     = [headers];
  const foundRows    = [headers];
  const resolvedRows = [['ID','Nama Barang','Kategori','Lokasi','Tanggal','Pelapor',
                          'Kontak','Status','Keterangan','Tanggal Selesai','Link Foto']];

  items.forEach(item => {
    const photoLink = item.hasPhoto
      ? `${APP_URL}/foto.html?id=${item.id}&type=item`
      : '(tidak ada foto)';

    const row = [
      item.id || '',
      item.name || '',
      item.category || '',
      item.desc || '',
      item.location || '',
      item.date || '',
      item.reporter || '',
      item.contact || '',
      translateStatus(item.status),
      item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID') : '',
      photoLink
    ];

    if (item.type === 'lost' && item.status === 'open') {
      lostRows.push(row);
    } else if (item.type === 'found' && item.status === 'open') {
      foundRows.push(row);
    } else if (item.status === 'resolved' || item.status === 'disposed') {
      resolvedRows.push([
        item.id || '',
        item.name || '',
        item.category || '',
        item.location || '',
        item.date || '',
        item.reporter || '',
        item.contact || '',
        translateStatus(item.status),
        item.disposalData ? (item.disposalData.reason || '') : '',
        item.resolveData
          ? new Date(item.resolveData.resolvedAt || Date.now()).toLocaleDateString('id-ID')
          : item.disposalData
          ? new Date(item.disposalData.disposedAt || Date.now()).toLocaleDateString('id-ID')
          : '',
        photoLink
      ]);
    }
  });

  writeSheet(lostSheet,     lostRows,     true);
  writeSheet(foundSheet,    foundRows,    true);
  writeSheet(resolvedSheet, resolvedRows, true);
}

function syncClaimsToSheet(ss, claims) {
  const sheet = getOrCreateSheet(ss, '🤝 Data Klaim');
  const rows  = [['ID Klaim', 'Nama Pengklaim', 'Kontak', 'ID Barang', 'Status',
                   'Petugas', 'Deskripsi Bukti', 'Tanggal Klaim', 'Tanggal Selesai',
                   'Link Foto Pengambil', 'Link Bukti Serah Terima']];

  claims.forEach(c => {
    const photoLink  = c.hasClaimPhoto
      ? `${APP_URL}/foto.html?id=${c.id}&type=claim`
      : '(tidak ada foto)';
    const buktiLink  = c.hasBuktiPhoto
      ? `${APP_URL}/foto.html?id=${c.id}&type=claim`
      : '(tidak ada foto)';

    rows.push([
      c.id || '',
      c.claimantName || '',
      c.claimantContact || '',
      c.itemId || '',
      translateClaimStatus(c.status),
      c.claimantOfficer || c.pickupOfficer || '',
      c.proofDesc || '',
      c.createdAt   ? new Date(c.createdAt).toLocaleDateString('id-ID')   : '',
      c.completedAt ? new Date(c.completedAt).toLocaleDateString('id-ID') : '',
      photoLink,
      buktiLink
    ]);
  });

  writeSheet(sheet, rows, true);
}

// ── Helpers ──────────────────────────────────────────────────
function getOrCreateSheet(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function writeSheet(sheet, rows, hasLinkCols) {
  sheet.clearContents();
  if (rows.length === 0) return;

  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  // Header styling
  const hdr = sheet.getRange(1, 1, 1, rows[0].length);
  hdr.setBackground('#4f46e5');
  hdr.setFontColor('#ffffff');
  hdr.setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Buat kolom Link sebagai hyperlink yang bisa diklik
  if (hasLinkCols && rows.length > 1) {
    const lastCol = rows[0].length;
    // Cari kolom yang berisi link (dimulai dengan https)
    rows[0].forEach((header, colIdx) => {
      if (header.toLowerCase().includes('link')) {
        for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
          const url = rows[rowIdx][colIdx];
          if (url && url.startsWith('http')) {
            const cell = sheet.getRange(rowIdx + 1, colIdx + 1);
            cell.setFormula(`=HYPERLINK("${url}","📷 Lihat Foto")`);
            cell.setFontColor('#2563eb');
          }
        }
      }
    });
  }

  sheet.autoResizeColumns(1, rows[0].length);
}

function translateStatus(s) {
  const m = { open: 'Aktif', resolved: 'Selesai', disposed: 'Dimusnahkan/Didonasikan' };
  return m[s] || s;
}

function translateClaimStatus(s) {
  const m = { pending: 'Menunggu', approved: 'Dijadwalkan', rejected: 'Ditolak', completed: 'Selesai' };
  return m[s] || s;
}
