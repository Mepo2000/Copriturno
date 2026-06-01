/**
 * CopriTurno — Backend di raccolta (Google Apps Script + Google Sheet)
 * ------------------------------------------------------------------
 * Riceve i salvataggi dei DUE form e li instrada in due fogli:
 *   - "Leads"     → medici (page = "medici"): UPSERT per leadId con
 *                   cattura progressiva (step1_contatto → completo).
 *   - "Strutture" → richieste RSA/cliniche (page = "strutture").
 * doGet restituisce il conteggio dei medici (per il contatore "onesto").
 *
 * SETUP RAPIDO (vedi README.md):
 *  1. Crea un Google Sheet vuoto.
 *  2. Estensioni → Apps Script. Incolla questo file (sostituisce tutto). Salva.
 *  3. Deploy → Nuovo deployment → tipo "App web"
 *       - Esegui come: Me      - Chi ha accesso: Chiunque
 *  4. Copia l'URL /exec e incollalo in config.js → endpoint
 *       (counterEndpoint = lo stesso URL + "?count=1").
 */

var SHEETS = {
  medici: {
    name: 'Leads',
    headers: [
      'leadId', 'stage', 'ts', 'page', 'nome', 'whatsapp', 'tipo',
      'regione', 'provincia', 'zona_estensione', 'email', 'stato', 'branca',
      'tipi', 'disponibilita', 'durate', 'piva',
      'consenso_contatto', 'consenso_privacy', 'ua', 'updated'
    ]
  },
  strutture: {
    name: 'Strutture',
    headers: [
      'leadId', 'stage', 'ts', 'page', 'struttura', 'referente', 'telefono', 'email',
      'tipo_struttura', 'profilo', 'citta', 'quando', 'turni', 'urgenza',
      'compenso', 'note', 'consenso', 'ua', 'updated'
    ]
  }
};

function cfgFor_(page) {
  return (page === 'strutture') ? SHEETS.strutture : SHEETS.medici;
}

function getSheet_(cfg) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(cfg.name);
  if (!sh) {
    sh = ss.insertSheet(cfg.name);
    sh.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers]).setFontWeight('bold');
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
    var cfg = cfgFor_(d.page);
    var sh = getSheet_(cfg);
    var H = cfg.headers;
    var row = H.map(function (h) {
      if (h === 'updated') return new Date();
      return flat_(d[h]);
    });

    // UPSERT per leadId (colonna 1): una sola riga che si arricchisce mano a mano
    var n = Math.max(sh.getLastRow() - 1, 0);
    var found = -1;
    if (n > 0 && d.leadId) {
      var ids = sh.getRange(2, 1, n, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (ids[i][0] === d.leadId) { found = i + 2; break; }
      }
    }
    if (found > 0) {
      // non sovrascrivere con stringhe vuote campi già valorizzati
      var cur = sh.getRange(found, 1, 1, H.length).getValues()[0];
      for (var j = 0; j < row.length; j++) {
        if ((row[j] === '' || row[j] == null) && cur[j] !== '' && H[j] !== 'updated') row[j] = cur[j];
      }
      sh.getRange(found, 1, 1, H.length).setValues([row]);
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

// Conteggio medici iscritti (per il contatore "onesto" in pagina)
function doGet(e) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.medici.name);
  var count = sh ? Math.max(sh.getLastRow() - 1, 0) : 0;
  return json_({ count: count });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
