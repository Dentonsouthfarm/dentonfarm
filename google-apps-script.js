// ============================================================
// dentonsouthfarm - Google Apps Script
// Paste this entire script into your Google Apps Script editor
// ============================================================
// SETUP INSTRUCTIONS:
// 1. Go to sheets.google.com — create a new blank spreadsheet
// 2. Rename the spreadsheet to:  dentonsouthfarm
// 3. Click Extensions > Apps Script
// 4. Delete all existing code in the editor
// 5. Paste this entire file
// 6. Click Save (the floppy disk icon)
// 7. Click Deploy > New deployment
// 8. Click the gear icon > choose "Web app"
// 9. Set "Execute as" to: Me
// 10. Set "Who has access" to: Anyone
// 11. Click Deploy
// 12. Click "Authorize access" and sign in with your Google account
// 13. Copy the Web app URL shown
// 14. In your farm app: Settings > Google Sheets Sync > paste URL > Save & Connect
// 15. Tap the Sync button in the app — your 3 tabs will populate automatically:
//       Expenses  |  Sales  |  Mileage
// ============================================================

const SHEET_NAME_EXPENSES = 'Expenses';
const SHEET_NAME_SALES    = 'Sales';
const SHEET_NAME_MILEAGE  = 'Mileage';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.expenses !== undefined && data.sales !== undefined) {
      writeExpenses(ss, data.expenses);
      writeSales(ss, data.sales);
      writeMileage(ss, data.expenses);
      return respond({ success: true, message: 'Full sync complete',
        expenseCount: data.expenses.length, saleCount: data.sales.length });
    }

    if (data.type === 'expense' && data.record) {
      appendExpense(ss, data.record);
      if (data.record.mileage) appendMileage(ss, data.record);
    } else if (data.type === 'sale' && data.record) {
      appendSale(ss, data.record);
    }

    return respond({ success: true });
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

function doGet(e) {
  return respond({ status: 'dentonsouthfarm API running', timestamp: new Date().toISOString() });
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) { sheet = ss.insertSheet(name); }
  const hr = sheet.getRange(1, 1, 1, headers.length);
  hr.setValues([headers]);
  hr.setFontWeight('bold');
  hr.setBackground('#2D5016');
  hr.setFontColor('#ffffff');
  hr.setFontSize(11);
  sheet.setFrozenRows(1);
  return sheet;
}

function writeExpenses(ss, expenses) {
  const headers = ['Date','Category','Description','Vendor','Miles','Rate ($/mi)','Mileage $','Amount','Notes','Source','Record ID','Synced At'];
  const sheet = getOrCreateSheet(ss, SHEET_NAME_EXPENSES, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  if (expenses.length === 0) return;
  const now = new Date().toLocaleString();
  const rows = expenses.map(e => [
    e.date, categoryLabel(e.category), e.description || '', e.vendor || '',
    e.mileage || '', e.mileageRate || '',
    e.mileage ? Number((e.mileage * (e.mileageRate || 0.67)).toFixed(2)) : '',
    e.amount, e.notes || '', e.source || 'manual', e.id, now
  ]);
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(2, 7, rows.length, 2).setNumberFormat('$#,##0.00');
  sheet.getRange(2, 6, rows.length, 1).setNumberFormat('$0.000');
  const t = rows.length + 2;
  sheet.getRange(t, 1).setValue('TOTALS');
  sheet.getRange(t, 5).setFormula('=SUM(E2:E' + (rows.length+1) + ')');
  sheet.getRange(t, 7).setFormula('=SUM(G2:G' + (rows.length+1) + ')');
  sheet.getRange(t, 8).setFormula('=SUM(H2:H' + (rows.length+1) + ')');
  sheet.getRange(t, 7, 1, 2).setNumberFormat('$#,##0.00');
  sheet.getRange(t, 1, 1, headers.length).setBackground('#d4eab8').setFontWeight('bold');
  sheet.autoResizeColumns(1, headers.length);
}

function writeSales(ss, sales) {
  const headers = ['Date','Buyer','Item','Unit','Qty','Price/Unit','Subtotal','Sale Total','Payment','Notes','Record ID','Synced At'];
  const sheet = getOrCreateSheet(ss, SHEET_NAME_SALES, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  if (sales.length === 0) return;
  const now = new Date().toLocaleString();
  const rows = [];
  sales.forEach(s => {
    (s.items || []).forEach(item => {
      rows.push([s.date, s.buyer||'', item.name, item.unit, item.qty,
        item.price, item.subtotal, s.total, s.payment||'', s.notes||'', s.id, now]);
    });
  });
  if (rows.length === 0) return;
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(2, 6, rows.length, 3).setNumberFormat('$#,##0.00');
  const t = rows.length + 2;
  sheet.getRange(t, 1).setValue('TOTALS');
  sheet.getRange(t, 7).setFormula('=SUM(G2:G' + (rows.length+1) + ')');
  sheet.getRange(t, 8).setFormula('=SUM(H2:H' + (rows.length+1) + ')');
  sheet.getRange(t, 7, 1, 2).setNumberFormat('$#,##0.00');
  sheet.getRange(t, 1, 1, headers.length).setBackground('#d4eab8').setFontWeight('bold');
  sheet.autoResizeColumns(1, headers.length);
}

function writeMileage(ss, expenses) {
  const headers = ['Date','Description','Miles','Rate ($/mi)','Amount','Notes','Record ID','Synced At'];
  const sheet = getOrCreateSheet(ss, SHEET_NAME_MILEAGE, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  const entries = expenses.filter(e => e.mileage && e.mileage > 0);
  if (entries.length === 0) return;
  const now = new Date().toLocaleString();
  const rows = entries.map(e => [
    e.date, e.description||'', e.mileage, e.mileageRate||0.67,
    Number((e.mileage * (e.mileageRate||0.67)).toFixed(2)),
    e.notes||'', e.id, now
  ]);
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(2, 4, rows.length, 1).setNumberFormat('$0.000');
  sheet.getRange(2, 5, rows.length, 1).setNumberFormat('$#,##0.00');
  const t = rows.length + 2;
  sheet.getRange(t, 1).setValue('TOTALS');
  sheet.getRange(t, 3).setFormula('=SUM(C2:C' + (rows.length+1) + ')');
  sheet.getRange(t, 5).setFormula('=SUM(E2:E' + (rows.length+1) + ')');
  sheet.getRange(t, 5).setNumberFormat('$#,##0.00');
  sheet.getRange(t, 1, 1, headers.length).setBackground('#d4eab8').setFontWeight('bold');
  const n = t + 1;
  sheet.getRange(n, 1).setValue('Current IRS Rate');
  sheet.getRange(n, 4).setValue(entries[0].mileageRate || 0.67);
  sheet.getRange(n, 4).setNumberFormat('$0.000');
  sheet.autoResizeColumns(1, headers.length);
}

function appendExpense(ss, e) {
  const headers = ['Date','Category','Description','Vendor','Miles','Rate ($/mi)','Mileage $','Amount','Notes','Source','Record ID','Synced At'];
  const sheet = getOrCreateSheet(ss, SHEET_NAME_EXPENSES, headers);
  sheet.appendRow([
    e.date, categoryLabel(e.category), e.description||'', e.vendor||'',
    e.mileage||'', e.mileageRate||'',
    e.mileage ? Number((e.mileage*(e.mileageRate||0.67)).toFixed(2)) : '',
    e.amount, e.notes||'', e.source||'manual', e.id, new Date().toLocaleString()
  ]);
}

function appendMileage(ss, e) {
  const headers = ['Date','Description','Miles','Rate ($/mi)','Amount','Notes','Record ID','Synced At'];
  const sheet = getOrCreateSheet(ss, SHEET_NAME_MILEAGE, headers);
  sheet.appendRow([
    e.date, e.description||'', e.mileage, e.mileageRate||0.67,
    Number((e.mileage*(e.mileageRate||0.67)).toFixed(2)),
    e.notes||'', e.id, new Date().toLocaleString()
  ]);
}

function appendSale(ss, s) {
  const headers = ['Date','Buyer','Item','Unit','Qty','Price/Unit','Subtotal','Sale Total','Payment','Notes','Record ID','Synced At'];
  const sheet = getOrCreateSheet(ss, SHEET_NAME_SALES, headers);
  (s.items||[]).forEach(item => {
    sheet.appendRow([
      s.date, s.buyer||'', item.name, item.unit,
      item.qty, item.price, item.subtotal, s.total,
      s.payment||'', s.notes||'', s.id, new Date().toLocaleString()
    ]);
  });
}

function categoryLabel(id) {
  const map = { feed:'Feed', supplies:'Supplies', mileage:'Mileage', materials:'Materials',
    vet:'Veterinary', equipment:'Equipment', utilities:'Utilities', other:'Other' };
  return map[id] || id || 'Other';
}
