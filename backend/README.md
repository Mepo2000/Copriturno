# CopriTurno — Backend di raccolta lead

Il form (`index.html` + `scripts.js`) salva **ogni passo** del wizard:
- **Step 1** → appena hai nome + WhatsApp + tipo + regione/provincia, parte il primo salvataggio (`stage: step1_contatto`). Anche se l'utente abbandona, hai già il contatto.
- **Step 2 / 3 / 4** → arricchiscono **la stessa riga** (UPSERT per `leadId`).
- Tutto viene **sempre** salvato anche in `localStorage` del browser, come rete di sicurezza.

Anche il form **strutture** (`strutture.html` + `clinic.js`) salva la richiesta nel backend, nel foglio **Strutture**.

Devi solo collegare un endpoint, in **un solo punto** (`config.js`) valido per entrambe le pagine. Sotto la via consigliata (gratis, dati consultabili in un foglio).

---

## Opzione consigliata — Google Sheet + Apps Script (gratis)

1. Crea un **Google Sheet** vuoto (sarà il tuo database, consultabile e esportabile).
2. **Estensioni → Apps Script**. Cancella il contenuto e incolla il file **`Code.gs`** di questa cartella. Salva.
3. **Deploy → Nuovo deployment**:
   - Tipo: **App web**
   - *Esegui come*: **Me**
   - *Chi ha accesso*: **Chiunque**
   - Deploy → autorizza con il tuo account.
4. Copia l'**URL** che finisce con `/exec`.
5. Apri **`config.js`** (un solo file, vale per medici **e** strutture) e incolla:
   ```js
   window.CT_CONFIG = {
     endpoint:        "https://script.google.com/macros/s/XXXXX/exec",
     counterEndpoint: "https://script.google.com/macros/s/XXXXX/exec?count=1",
     counterManual:   null
   };
   ```
6. Fatto. Ogni iscrizione compare come riga nel foglio `Leads`; il contatore in pagina mostra il numero reale di iscritti.

> Dove vedo i dati? Nel Google Sheet trovi due fogli: **Leads** (medici, una riga per persona che si arricchisce per step) e **Strutture** (richieste RSA/cliniche). Colonne complete: contatti, zona, profilo, disponibilità, consensi, stage, timestamp.

---

## Come verificare che funziona (test in 2 minuti)

1. Apri `index.html` nel browser e apri la **Console** (F12 → scheda Console).
   - Se compare l'avviso *"endpoint backend non configurato"*, `config.js` non è ancora collegato: incolla l'URL `/exec`.
   - Se non compaiono avvisi, l'endpoint è impostato.
2. Compila il form medici fino in fondo e invia. Apri il Google Sheet → foglio **Leads**: deve comparire una riga (che si arricchisce a ogni step grazie all'UPSERT su `leadId`).
3. Ripeti su `strutture.html` → la richiesta deve comparire nel foglio **Strutture**.
4. Ricarica la landing medici: il contatore mostra il numero reale di righe in **Leads**.

> La POST è "best-effort" (`no-cors`): la pagina **non** legge la risposta del server, quindi il test vero è **vedere la riga comparire nel foglio**. Se non compare: ricontrolla che il deployment abbia accesso *"Chiunque"*, che l'URL finisca in `/exec` e che tu abbia autorizzato lo script col tuo account. Il `localStorage` del browser è solo una copia sul device di chi compila: **non** è una copia per te.

---

## Il contatore "onesto"

Il blocco social-proof mostra un numero **solo se reale**:
- con `counterEndpoint` impostato → legge il conteggio vivo dal foglio e lo mostra ("N medici e infermieri già raggiunti in Italia");
- senza endpoint, puoi mettere a mano `counterManual: 120` (un solo punto da aggiornare);
- se entrambi sono vuoti/`null` → **nessun numero inventato**: resta solo "province in raccolta adesioni".

---

## Alternative (se non vuoi Google)

Qualsiasi servizio che accetti una POST JSON va bene — basta incollare l'URL in `CONFIG.endpoint`:

- **Formspree** — crei un form, ottieni un URL `https://formspree.io/f/xxxx`. Riceve i lead via email/dashboard. (Il contatore live non è disponibile: usa `counterManual`.)
- **Airtable** — via Web API o un'automazione webhook. Database visuale.
- **Make / Zapier webhook** — inoltra i dati dove vuoi (Sheet, Notion, CRM…).

Il payload inviato è un JSON con questi campi:
`leadId, stage, page, ts, nome, whatsapp, tipo, regione, provincia, email, stato, branca, zona_estensione, tipi[], disponibilita[], durate[], piva, consenso_contatto, consenso_privacy, ua`.

`stage` vale `step1_contatto`, `step2_profilo`, `step3_preferenze` o `completo`, così distingui i contatti parziali da quelli completi.

---

## Note privacy
- Non raccogliamo dati dei pazienti.
- I consensi (contatto + privacy GDPR) viaggiano nel payload e finiscono nel foglio: utile come prova del consenso.
- Tieni il Google Sheet su un account aziendale e limita gli accessi.
