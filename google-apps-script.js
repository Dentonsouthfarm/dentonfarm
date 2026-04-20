// ============================================================
// DENTON SOUTH FARM - Google Apps Script
// Paste this entire script into your Google Apps Script editor
// ============================================================
// SETUP INSTRUCTIONS:
// 1. Open your Google Sheet
// 2. Click Extensions > Apps Script
// 3. Delete all existing code
// 4. Paste this entire file
// 5. Click Save (disk icon)
// 6. Click Deploy > New deployment
// 7. Type: Web app
// 8. Execute as: Me
// 9. Who has access: Anyone
// 10. Click Deploy, copy the URL
// 11. Paste that URL in the app under Settings > Google Sheets Sync
// ============================================================

const SHEET_NAME_EXPENSES = 'Expenses';
const SHEET_NAME_SALES = 'Sales';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Handle full sync
    if (data.expenses && data.sales) {
      writeExpenses(ss, data.expenses);
      writeSales(ss, data.sales);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Full sync complete' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Handle single record
    if (data.type === 'expense' && data.record) {
      appendExpense(ss, data.record);
    } else if (data.type === 'sale' && data.record) {
      appendSale(ss, data.record);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'Denton South Farm API running' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.getRange(1, 1, 1, headers.length).setBackground('#2D5016');
    sheet.getRange(1, 1, 1, headers.length).setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function writeExpenses(ss, expenses) {
  const headers = ['ID', 'Date', 'Category', 'Description', 'Amount', 'Vendor', 'Mileage', 'Notes', 'Source', 'Synced At'];
  const sheet = getOrCreateSheet(ss, SHEET_NAME_EXPENSES, headers);
  
  // Clear existing data (keep header)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  
  if (expenses.length === 0) return;
  
  const rows = expenses.map(e => [
    e.id, e.date, e.category, e.description || '', 
    e.amount, e.vendor || '', e.mileage || '', 
    e.notes || '', e.source || 'manual',
    new Date().toISOString()
  ]);
  
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  
  // Format amount column
  sheet.getRange(2, 5, rows.length, 1).setNumberFormat('$#,##0.00');
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, headers.length);
}

function writeSales(ss, sales) {
  const headers = ['ID', 'Date', 'Buyer', 'Item', 'Unit', 'Qty', 'Price/Unit', 'Subtotal', 'Total Sale', 'Payment', 'Notes', 'Synced At'];
  const sheet = getOrCreateSheet(ss, SHEET_NAME_SALES, headers);
  
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  
  if (sales.length === 0) return;
  
  const rows = [];
  sales.forEach(s => {
    s.items.forEach(item => {
      rows.push([
        s.id, s.date, s.buyer || '',
        item.name, item.unit, item.qty,
        item.price, item.subtotal, s.total,
        s.payment || '', s.notes || '',
        new Date().toISOString()
      ]);
    });
  });
  
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(2, 7, rows.length, 3).setNumberFormat('$#,##0.00');
  sheet.autoResizeColumns(1, headers.length);
}

function appendExpense(ss, e) {
  const headers = ['ID', 'Date', 'Category', 'Description', 'Amount', 'Vendor', 'Mileage', 'Notes', 'Source', 'Synced At'];
  const sheet = getOrCreateSheet(ss, SHEET_NAME_EXPENSES, headers);
  sheet.appendRow([
    e.id, e.date, e.category, e.description || '',
    e.amount, e.vendor || '', e.mileage || '',
    e.notes || '', e.source || 'manual', new Date().toISOString()
  ]);
}

function appendSale(ss, s) {
  const headers = ['ID', 'Date', 'Buyer', 'Item', 'Unit', 'Qty', 'Price/Unit', 'Subtotal', 'Total Sale', 'Payment', 'Notes', 'Synced At'];
  const sheet = getOrCreateSheet(ss, SHEET_NAME_SALES, headers);
  s.items.forEach(item => {
    sheet.appendRow([
      s.id, s.date, s.buyer || '',
      item.name, item.unit, item.qty,
      item.price, item.subtotal, s.total,
      s.payment || '', s.notes || '', new Date().toISOString()
    ]);
  });
}
