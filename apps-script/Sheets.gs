/**
 * Sheets.gs — generic Google Sheets data-access helpers.
 */

// Script Property key where a container-bound script records its own parent sheet ID
// (captured by setupSheets). Lets the web app reach the bound sheet even though
// getActiveSpreadsheet() returns null in the web-app execution context.
var BOUND_SPREADSHEET_PROP_ = 'PARENT_SPREADSHEET_ID';

function getSpreadsheet_() {
  // 1. Explicit override always wins (standalone / Option B deploys).
  if (CONFIG.SPREADSHEET_ID) return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  // 2. Bound context (editor run, custom menu, trigger): the parent sheet is "active".
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  // 3. Web-app context: getActiveSpreadsheet() is null, so use the parent ID that
  //    setupSheets stored when it ran from the bound sheet.
  var savedId = PropertiesService.getScriptProperties().getProperty(BOUND_SPREADSHEET_PROP_);
  if (savedId) return SpreadsheetApp.openById(savedId);
  throw new Error('No bound spreadsheet found. Set CONFIG.SPREADSHEET_ID, or run setupSheets ' +
    'once from the sheet this script is bound to so it can record its parent sheet.');
}

function getSheet_(name) {
  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet: ' + name + '. Run Setup (setupSheets) first.');
  return sheet;
}

function getHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h); });
}

function cellToValue_(header, value) {
  if (value instanceof Date) {
    // Date columns are formatted as text, but guard anyway.
    return Utilities.formatDate(value, getSpreadsheet_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  }
  return value;
}

/** Read every data row of a sheet as an array of plain objects keyed by header. */
function readObjects(name) {
  var sheet = getSheet_(name);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];
  var headers = getHeaders_(sheet);
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return values.map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = cellToValue_(h, row[i]); });
    return obj;
  });
}

/** Append one object as a new row, mapping by header order. */
function appendObject(name, obj) {
  var sheet = getSheet_(name);
  var headers = getHeaders_(sheet);
  var row = headers.map(function (h) {
    var v = obj[h];
    return v === undefined || v === null ? '' : v;
  });
  sheet.appendRow(row);
  return obj;
}

/**
 * Update the first row whose `keyCol` equals `keyVal`, applying the `patch` object.
 * Returns the merged object, or null if no row matched.
 */
function updateByKey(name, keyCol, keyVal, patch) {
  var sheet = getSheet_(name);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return null;
  var headers = getHeaders_(sheet);
  var keyIdx = headers.indexOf(keyCol);
  if (keyIdx < 0) throw new Error('Unknown column ' + keyCol + ' in ' + name);
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (var r = 0; r < values.length; r++) {
    if (String(values[r][keyIdx]) === String(keyVal)) {
      var merged = {};
      headers.forEach(function (h, i) { merged[h] = cellToValue_(h, values[r][i]); });
      headers.forEach(function (h, i) {
        if (patch.hasOwnProperty(h)) {
          merged[h] = patch[h];
          values[r][i] = patch[h] === undefined || patch[h] === null ? '' : patch[h];
        }
      });
      sheet.getRange(2 + r, 1, 1, lastCol).setValues([values[r]]);
      return merged;
    }
  }
  return null;
}

/** Run `fn` while holding the document lock (prevents ID/race collisions). */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function pad3_(n) { return ('00' + n).slice(-3); }

function nowTimestamp_() {
  return Utilities.formatDate(new Date(), getSpreadsheet_().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function todayISO_() {
  return Utilities.formatDate(new Date(), getSpreadsheet_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
}
