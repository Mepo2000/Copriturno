/**
 * CopriTurno — Backend di raccolta (Google Apps Script + Google Sheet)
 * ------------------------------------------------------------------
 * Riceve ogni salvataggio del form (parziale step-1 e completo),
 * fa UPSERT per leadId (così lo stesso medico = una sola riga che si
 * arricchisce mano a mano) e restituisce il conteggio iscritti.
 *
 * SETUP RAPIDO (vedi README.md per i dettagli):
 *  1. Crea un Google Sheet vuoto.
 *  2. Estensioni → Apps Script. Incolla questo file (sostituisce tutto).
 *  3. Deploy → Nuovo deployment → tipo "App web".
 *       - Esegui come: Me
 *       - Chi ha accesso: Chiunque
 *  4. Copia l'URL /exec e incollalo in scripts.js → CONFIG.endpoint
 *       e CONFIG.counterEndpoint (lo stesso URL + "?count=1").
 */

var SHEET_NAME = 'Leads';

var HEADERS = [
  'leadId', 'stage', 'ts', 'page', 'nome', 'whatsapp', 'tipo',
  'regione', 'provincia', 'zona_estensione', 'email', 'stato', 'branca',
  'tipi', 'disponibilita', 'durate', 'piva',
  'consenso_contatto', 'consenso_privacy', 'ua', 'updated'
];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function flat_(v) { return Array.isArray(v) ? v.join(', ') : (v == null ? '' : v); }

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(20000);
  try {
    var d = JSON.parse(e.postData.contents || '{}');
    var sh = getSheet_();
    var row = HEADERS.map(function (h) {
      if (h === 'updated') return new Date();
      return flat_(d[h]);
    });

    // UPSERT per leadId (colonna 1)
    var ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 0), 1).getValues();
    var found = -1;
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === d.leadId) { found = i + 2; break; }
    }
    if (found > 0) {
      // non sovrascrivere campi già valorizzati con stringhe vuote
      var cur = sh.getRange(found, 1, 1, HEADERS.length).getValues()[0];
      for (var j = 0; j < row.length; j++) {
        if ((row[j] === '' || row[j] == null) && cur[j] !== '' && HEADERS[j] !== 'updated') row[j] = cur[j];
      }
      sh.getRange(found, 1, 1, HEADERS.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var sh = getSheet_();
  var count = Math.max(sh.getLastRow() - 1, 0);
  return json_({ count: count });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
