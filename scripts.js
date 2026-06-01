/* ===========================================================
   CopriTurno — scripts.js  (pagina medici)
   Multi-step form con CATTURA DEL CONTATTO ALLO STEP 1 e
   arricchimento progressivo. Regione→Provincia, specializzazione
   condizionale, salvataggio parziale + backend, contatore onesto.
   Vanilla JS, framework-free.
   =========================================================== */
(function () {
  "use strict";

  /* =========================================================
     ⚙️  CONFIG BACKEND — UNICO PUNTO DA MODIFICARE
     Incolla qui l'URL del tuo endpoint (Google Apps Script /
     Airtable / Formspree / webhook). Vedi backend/README.md.
     - endpoint:        riceve ogni salvataggio (parziale e completo)
     - counterEndpoint: GET che restituisce {count: N} di iscritti
     - counterManual:   numero aggiornabile a mano se non usi l'API
                        (lascia null per non mostrare numeri finti)
     ========================================================= */
  var CONFIG = window.CT_CONFIG || {
    endpoint: "",          // es. "https://script.google.com/macros/s/XXXX/exec"
    counterEndpoint: "",   // es. lo stesso URL + "?count=1"
    counterManual: null    // es. 120  (oppure null)
  };

  /* =========================================================
     DATI: Regioni → Province (Italia). E-R in cima.
     ========================================================= */
  var REGIONS = {
    "Emilia-Romagna": ["Bologna", "Modena", "Ferrara", "Ravenna", "Forlì-Cesena", "Rimini", "Reggio Emilia", "Parma", "Piacenza"],
    "Lombardia": ["Milano", "Bergamo", "Brescia", "Como", "Cremona", "Lecco", "Lodi", "Mantova", "Monza e Brianza", "Pavia", "Sondrio", "Varese"],
    "Veneto": ["Venezia", "Verona", "Padova", "Vicenza", "Treviso", "Rovigo", "Belluno"],
    "Piemonte": ["Torino", "Alessandria", "Asti", "Biella", "Cuneo", "Novara", "Verbano-Cusio-Ossola", "Vercelli"],
    "Toscana": ["Firenze", "Arezzo", "Grosseto", "Livorno", "Lucca", "Massa-Carrara", "Pisa", "Pistoia", "Prato", "Siena"],
    "Lazio": ["Roma", "Frosinone", "Latina", "Rieti", "Viterbo"],
    "Liguria": ["Genova", "Imperia", "La Spezia", "Savona"],
    "Marche": ["Ancona", "Ascoli Piceno", "Fermo", "Macerata", "Pesaro e Urbino"],
    "Friuli-Venezia Giulia": ["Trieste", "Gorizia", "Pordenone", "Udine"],
    "Trentino-Alto Adige": ["Trento", "Bolzano"],
    "Umbria": ["Perugia", "Terni"],
    "Abruzzo": ["L'Aquila", "Chieti", "Pescara", "Teramo"],
    "Campania": ["Napoli", "Avellino", "Benevento", "Caserta", "Salerno"],
    "Puglia": ["Bari", "Barletta-Andria-Trani", "Brindisi", "Foggia", "Lecce", "Taranto"],
    "Calabria": ["Catanzaro", "Cosenza", "Crotone", "Reggio Calabria", "Vibo Valentia"],
    "Sicilia": ["Palermo", "Catania", "Messina", "Agrigento", "Caltanissetta", "Enna", "Ragusa", "Siracusa", "Trapani"],
    "Sardegna": ["Cagliari", "Sassari", "Nuoro", "Oristano", "Sud Sardegna"],
    "Valle d'Aosta": ["Aosta"],
    "Molise": ["Campobasso", "Isernia"],
    "Basilicata": ["Potenza", "Matera"]
  };

  var BRANCHE = [
    "Medicina generale", "Geriatria", "Cardiologia", "Medicina d'urgenza (MEU)",
    "Medicina interna", "Pneumologia", "Anestesia e rianimazione", "Psichiatria",
    "Neurologia", "Pediatria", "Ortopedia", "Chirurgia generale", "Ginecologia",
    "Radiologia", "Oncologia", "Medicina del lavoro", "Altro / in definizione"
  ];

  /* chip groups (statici) */
  var CHIPS = {
    tipo: ["Medico", "Infermiere / OSS"],
    stato: ["Laureando/a", "Neolaureato/a", "Abilitato/a", "Iscritto/a all'Ordine", "Specializzando/a", "Corso MMG", "Medico già attivo"],
    tipi: ["Sostituzioni MMG", "RSA / CRA", "Guardie mediche private", "Ambulatori", "Eventi / sport", "Medicina del lavoro", "Valuto tutto"],
    disponibilita: ["Qualsiasi orario", "Mattina", "Pomeriggio", "Sera", "Notti", "Weekend", "Festivi", "Last-minute"],
    durate: ["Qualsiasi durata", "1 giorno", "Weekend", "2–7 giorni", "1–4 settimane", "Ricorrente", "Continuativo"],
    piva: ["Sì", "No", "La aprirò"]
  };
  /* stati che attivano la tendina branca */
  var STATI_CON_BRANCA = ["Specializzando/a", "Medico già attivo"];

  var TICK = '<span class="tick"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l4.5 4.5L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

  function makeChip(label) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.setAttribute("aria-pressed", "false"); b.dataset.value = label;
    b.innerHTML = '<span>' + label + '</span>' + TICK;
    return b;
  }
  function clearFieldError(el) { var f = el.closest(".field"); if (f) f.classList.remove("invalid"); }

  /* build static chip groups */
  Object.keys(CHIPS).forEach(function (group) {
    var container = document.querySelector('.chips[data-group="' + group + '"]');
    if (!container) return;
    var single = container.classList.contains("single");
    CHIPS[group].forEach(function (label) {
      var b = makeChip(label);
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-pressed") === "true";
        if (single) container.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", on ? "false" : "true");
        clearFieldError(b);
        if (group === "stato") syncBranca();
      });
      container.appendChild(b);
    });
  });

  /* =========================================================
     REGIONE → PROVINCIA (step 1)
     ========================================================= */
  var regSelect = document.getElementById("f-regione");
  var provWrap = document.getElementById("prov-wrap");
  var provChips = document.querySelector('.chips[data-group="provincia"]');

  if (regSelect) {
    var ph = document.createElement("option");
    ph.value = ""; ph.textContent = "Seleziona la regione…"; ph.disabled = true; ph.selected = true;
    regSelect.appendChild(ph);
    Object.keys(REGIONS).forEach(function (r) {
      var o = document.createElement("option"); o.value = r; o.textContent = r; regSelect.appendChild(o);
    });
    regSelect.addEventListener("change", function () {
      clearFieldError(regSelect);
      renderProvinces(regSelect.value);
      provWrap.style.display = regSelect.value ? "block" : "none";
      buildZoneExt(); // refresh dependent extension options
    });
  }

  function renderProvinces(region) {
    if (!provChips) return;
    provChips.innerHTML = "";
    (REGIONS[region] || []).forEach(function (p) {
      var b = makeChip(p);
      b.addEventListener("click", function () {
        provChips.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        clearFieldError(b);
        buildZoneExt();
      });
      provChips.appendChild(b);
    });
  }

  /* =========================================================
     SPECIALIZZAZIONE CONDIZIONALE (step 2)
     ========================================================= */
  var brancaField = document.getElementById("branca-field");
  var brancaSelect = document.getElementById("f-branca");
  if (brancaSelect) {
    var bph = document.createElement("option");
    bph.value = ""; bph.textContent = "Seleziona la branca…"; bph.disabled = true; bph.selected = true;
    brancaSelect.appendChild(bph);
    BRANCHE.forEach(function (b) { var o = document.createElement("option"); o.value = b; o.textContent = b; brancaSelect.appendChild(o); });
    brancaSelect.addEventListener("change", function () { clearFieldError(brancaSelect); });
  }
  function statoValue() {
    var c = document.querySelector('.chips[data-group="stato"] .chip[aria-pressed="true"]');
    return c ? c.dataset.value : "";
  }
  function syncBranca() {
    if (!brancaField) return;
    var show = STATI_CON_BRANCA.indexOf(statoValue()) !== -1;
    brancaField.style.display = show ? "block" : "none";
    if (!show) { brancaField.classList.remove("invalid"); if (brancaSelect) brancaSelect.selectedIndex = 0; }
  }

  /* =========================================================
     ZONA: ESTENSIONE DIPENDENTE (step 2)
     ========================================================= */
  var zoneExt = document.querySelector('.chips[data-group="zoneext"]');
  function provinciaValue() {
    var c = document.querySelector('.chips[data-group="provincia"] .chip[aria-pressed="true"]');
    return c ? c.dataset.value : "";
  }
  function buildZoneExt() {
    if (!zoneExt) return;
    var region = regSelect ? regSelect.value : "";
    var prov = provinciaValue();
    var prev = (zoneExt.querySelector('.chip[aria-pressed="true"]') || {}).dataset;
    var prevVal = prev ? prev.value : "";
    zoneExt.innerHTML = "";
    var opts = [];
    if (prov) opts.push("Solo " + prov);
    opts.push("Province confinanti");
    if (region) opts.push("Tutta " + region);
    opts.forEach(function (label) {
      var b = makeChip(label);
      if (label === prevVal) b.setAttribute("aria-pressed", "true");
      b.addEventListener("click", function () {
        zoneExt.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        clearFieldError(b);
      });
      zoneExt.appendChild(b);
    });
  }

  /* =========================================================
     STEP NAVIGATION
     ========================================================= */
  var form = document.getElementById("signup-form");
  var panels = Array.prototype.slice.call(document.querySelectorAll(".step-panel"));
  var TOTAL = panels.length;
  var current = 1;

  var bar = document.getElementById("progress-bar");
  var pct = document.getElementById("progress-pct");
  var label = document.getElementById("progress-label");
  var titleEl = document.getElementById("form-step-title");
  var btnNext = document.getElementById("btn-next");
  var btnBack = document.getElementById("btn-back");
  var TITLES = { 1: "I tuoi contatti", 2: "Chi sei e dove", 3: "Cosa cerchi" };

  function render() {
    panels.forEach(function (p) { p.classList.toggle("active", +p.dataset.step === current); });
    var p = Math.floor((current / TOTAL) * 100);
    bar.style.width = p + "%"; pct.textContent = p + "%";
    label.textContent = "Passo " + current + " di " + TOTAL;
    titleEl.textContent = TITLES[current];
    btnBack.style.display = current > 1 ? "block" : "none";
    btnNext.textContent = current === TOTAL ? "Entra nel pool →" : "Continua";
  }

  /* ---- validation ---- */
  function validatePanel(step) {
    var panel = panels[step - 1]; var ok = true;
    panel.querySelectorAll(".field[data-required]").forEach(function (field) {
      if (field.offsetParent === null) return; // skip hidden
      var input = field.querySelector(".input");
      var select = field.querySelector("select");
      if (select) {
        var sv = select.value && select.value.length > 0;
        field.classList.toggle("invalid", !sv); if (!sv) ok = false;
      } else if (input) {
        var v = input.value.trim(); var valid = v.length > 0;
        if (valid && field.dataset.type === "phone") valid = v.replace(/[^\d]/g, "").length >= 8;
        field.classList.toggle("invalid", !valid); if (!valid) ok = false;
      } else if (field.dataset.chips) {
        var any = field.querySelectorAll('.chip[aria-pressed="true"]').length > 0;
        field.classList.toggle("invalid", !any); if (!any) ok = false;
      }
    });
    // optional email format
    var email = panel.querySelector('#f-email');
    if (email && email.value.trim()) {
      var ef = email.closest(".field");
      var eok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
      ef.classList.toggle("invalid", !eok); if (!eok) ok = false;
    }
    // branca required when visible
    if (brancaField && brancaField.offsetParent !== null) {
      var bok = brancaSelect && brancaSelect.value;
      brancaField.classList.toggle("invalid", !bok); if (!bok) ok = false;
    }
    // consents on last step
    if (step === TOTAL) {
      panel.querySelectorAll(".consent[data-required-consent]").forEach(function (c) {
        var valid = c.querySelector("input").checked;
        c.classList.toggle("invalid", !valid); if (!valid) ok = false;
      });
    }
    return ok;
  }

  function scrollToCard() {
    var card = document.getElementById("form-card");
    var y = card.getBoundingClientRect().top + window.pageYOffset - 90;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  /* ---- gather data ---- */
  function selected(group) {
    var c = document.querySelector('.chips[data-group="' + group + '"]');
    return c ? Array.prototype.slice.call(c.querySelectorAll('.chip[aria-pressed="true"]')).map(function (b) { return b.dataset.value; }) : [];
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ""; }
  function firstName() { var n = val("f-nome"); return n ? n.split(/\s+/)[0] : "collega"; }

  function collect(stage) {
    return {
      leadId: leadId,
      stage: stage,
      page: "medici",
      ts: new Date().toISOString(),
      nome: val("f-nome"),
      whatsapp: "+39 " + val("f-wa"),
      tipo: selected("tipo")[0] || "",
      regione: regSelect ? regSelect.value : "",
      provincia: provinciaValue(),
      email: val("f-email"),
      stato: statoValue(),
      branca: (brancaSelect && brancaField && brancaField.offsetParent !== null) ? brancaSelect.value : "",
      zona_estensione: selected("zoneext")[0] || "",
      tipi: selected("tipi"),
      disponibilita: selected("disponibilita"),
      durate: selected("durate"),
      piva: selected("piva")[0] || "",
      consenso_contatto: !!(document.getElementById("c-contact") || {}).checked,
      consenso_privacy: !!(document.getElementById("c-privacy") || {}).checked,
      ua: navigator.userAgent
    };
  }

  /* =========================================================
     SALVATAGGIO: parziale (ogni step) + completo
     - sempre in localStorage (mai perdiamo un lead)
     - best-effort POST al backend (no-cors)
     ========================================================= */
  var leadId = localStorage.getItem("ct_leadId");
  if (!leadId) {
    leadId = "ct_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    localStorage.setItem("ct_leadId", leadId);
  }
  function sendLead(stage) {
    var payload = collect(stage);
    try { localStorage.setItem("ct_lead", JSON.stringify(payload)); } catch (e) {}
    if (CONFIG.endpoint) {
      try {
        fetch(CONFIG.endpoint, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload)
        }).catch(function () {});
      } catch (e) {}
    } else if (window.console) {
      console.warn("CopriTurno: endpoint backend non configurato — il lead resta solo in localStorage e NON arriva al foglio. Imposta window.CT_CONFIG.endpoint in config.js (vedi backend/README.md).");
    }
  }

  /* ---- nav handlers ---- */
  btnNext.addEventListener("click", function () {
    if (!validatePanel(current)) {
      var bad = panels[current - 1].querySelector(".field.invalid, .consent.invalid");
      if (bad) bad.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    // CATTURA / ARRICCHIMENTO ad ogni avanzamento
    if (current === 1) sendLead("step1_contatto");
    else if (current === 2) sendLead("step2_profilo");
    else if (current === 3) sendLead("step3_preferenze");

    if (current < TOTAL) { current++; render(); if (current === 2) { syncBranca(); buildZoneExt(); } scrollToCard(); }
    else submit();
  });
  btnBack.addEventListener("click", function () { if (current > 1) { current--; render(); scrollToCard(); } });

  form.querySelectorAll(".input").forEach(function (inp) { inp.addEventListener("input", function () { clearFieldError(inp); }); });
  form.querySelectorAll(".consent input").forEach(function (b) { b.addEventListener("change", function () { b.closest(".consent").classList.remove("invalid"); }); });

  /* messaggio WhatsApp condivisibile — leva: più medici nella tua zona = parte prima */
  function buildShareMsg(zoneShort, joined) {
    var url = location.href.split("#")[0] + "#registrati";
    var qui = zoneShort ? (" qui a " + zoneShort) : " nella nostra zona";
    return "\ud83e\ude7a *CopriTurno*: per non perdere pi\u00f9 sostituzioni e guardie" + qui + ".\n\n" +
      "Ti iscrivi una volta (zona + disponibilit\u00e0) e ricevi su WhatsApp solo le richieste compatibili: RSA, sostituzioni MMG, guardie private, ambulatori. Decidi tu se candidarti, l'accordo \u00e8 diretto con la struttura. \u00c8 gratis.\n\n" +
      "\u26a1\ufe0f Come parte: attivano per prime le zone con pi\u00f9 medici iscritti. Pi\u00f9 siamo" + qui + ", prima parte la nostra zona, e ci sono pi\u00f9 turni per tutti noi. " +
      (joined ? "Io mi sono appena iscritto/a, " : "") + "unisciti \ud83d\udc47\n\n\ud83d\udc49 " + url;
  }

  /* ---- final submit -> confirmation + share ---- */
  function submit() {
    sendLead("completo");
    var data = collect("completo");
    form.style.display = "none";
    var confirm = document.getElementById("confirm");
    confirm.classList.add("active");
    document.getElementById("confirm-name").textContent = firstName();

    var recap = document.getElementById("confirm-recap");
    function row(k, v) { return '<div class="row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
    var zonaTxt = data.zona_estensione || data.provincia || "-";
    recap.innerHTML =
      row("Profilo", (data.stato || "-") + (data.branca ? " \u00b7 " + data.branca : "")) +
      row("Zona", zonaTxt) +
      row("Cerchi", data.tipi.length ? data.tipi.join(", ") : "-") +
      row("Quando", data.disponibilita.length ? data.disponibilita.join(", ") : "-");

    var zoneShort = data.provincia || data.regione || "";
    var msg = buildShareMsg(zoneShort, true);
    document.getElementById("share-msg").textContent = msg;
    document.getElementById("share-wa").href = "https://wa.me/?text=" + encodeURIComponent(msg);
    document.getElementById("share-copy").addEventListener("click", function () {
      if (navigator.clipboard) navigator.clipboard.writeText(msg);
      var t = document.getElementById("copied-toast"); t.classList.add("show");
      setTimeout(function () { t.classList.remove("show"); }, 1800);
    });
    document.getElementById("share-box").style.display = "block";
    scrollToCard();
  }

  /* =========================================================
     PRIVACY MODAL
     ========================================================= */
  var modal = document.getElementById("privacy-modal");
  function openPrivacy(e) { if (e) e.preventDefault(); modal.classList.add("open"); document.body.style.overflow = "hidden"; }
  function closePrivacy() { modal.classList.remove("open"); document.body.style.overflow = ""; }
  document.querySelectorAll(".open-privacy, #open-privacy-2").forEach(function (a) { a.addEventListener("click", openPrivacy); });
  document.getElementById("privacy-close").addEventListener("click", closePrivacy);
  modal.addEventListener("click", function (e) { if (e.target === modal) closePrivacy(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePrivacy(); });

  var yr = document.getElementById("year"); if (yr) yr.textContent = new Date().getFullYear();

  /* ---- density "Invita i colleghi" -> apre WhatsApp con invito ---- */
  var shareJump = document.getElementById("share-jump");
  if (shareJump) {
    shareJump.addEventListener("click", function () {
      var zone = provinciaValue() || (regSelect ? regSelect.value : "") || "";
      var msg = buildShareMsg(zone, false);
      window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank", "noopener");
    });
  }

  /* =========================================================
     FEED — esempi (ridotto a 6 card)
     ========================================================= */
  var ICONS = {
    cal: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="16" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    role: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 4v5a4 4 0 008 0V4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M11 13.5v2a4 4 0 008 0v-1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="19" cy="11" r="2" stroke="currentColor" stroke-width="1.7"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2z"/></svg>'
  };
  var REQUESTS = [
    { zona: "Milano", tipo: "RSA / CRA", title: "RSA · Milano (Niguarda)", dist: "~5 km da te", when: "Sab 14 giu", shift: "Mattina 8–14", role: "Copertura medica di reparto", comp: "300–340 €", unit: "/turno" },
    { zona: "Roma", tipo: "Guardia privata", title: "Clinica privata · Roma", dist: "~7 km da te", when: "Ven 13 giu", shift: "Notte 20–8", role: "Guardia medica notturna", comp: "470–540 €", unit: "/turno" },
    { zona: "Torino", tipo: "Sostituzione MMG", title: "Studio MMG · Torino", dist: "~4 km da te", when: "1–2 settimane", shift: "Mattina", role: "Sostituzione medico di base", comp: "Da concordare", unit: "" },
    { zona: "Bologna", tipo: "Eventi / sport", title: "Evento sportivo · Bologna", dist: "~6 km da te", when: "Dom 15 giu", shift: "9–18", role: "Assistenza medica a bordo campo", comp: "200–260 €", unit: "/giornata" },
    { zona: "Firenze", tipo: "Ambulatorio", title: "Poliambulatorio · Firenze", dist: "~8 km da te", when: "Mar–Gio", shift: "Pomeriggio 15–19", role: "Visite mediche generali", comp: "35–45 €", unit: "/ora" },
    { zona: "Napoli", tipo: "RSA / CRA", title: "RSA · Napoli", dist: "~5 km da te", when: "Weekend", shift: "Sab–Dom diurno", role: "Copertura medica festiva", comp: "300–360 €", unit: "/turno" }
  ];
  var ZONE = ["Tutte", "Milano", "Roma", "Torino", "Bologna", "Firenze", "Napoli"];
  var zonaBar = document.getElementById("zona-bar");
  var reqList = document.getElementById("req-list");
  var activeZona = "Tutte";
  function reqCard(r) {
    var comp = r.unit ? '<span class="amt">' + r.comp + ' <small>' + r.unit + '</small></span>' : '<span class="amt" style="font-size:15px;">' + r.comp + '</span>';
    return '<article class="req-card">' +
      '<div class="req-top"><span class="req-tag">' + r.tipo + '</span><span class="req-dist">' + r.dist + '</span></div>' +
      '<div class="req-title">' + r.title + '</div>' +
      '<div class="req-rows">' +
        '<div class="req-row">' + ICONS.cal + '<span>' + r.when + '</span></div>' +
        '<div class="req-row">' + ICONS.clock + '<span>' + r.shift + '</span></div>' +
        '<div class="req-row">' + ICONS.role + '<span>' + r.role + '</span></div>' +
      '</div>' +
      '<div class="req-comp"><span>' + comp + '</span><span class="src">indicato dalla struttura</span></div>' +
      '<div class="req-foot">' + ICONS.wa + '<span>Ti arriverebbe su WhatsApp</span></div>' +
      '</article>';
  }
  function renderFeed() {
    if (!reqList) return;
    var list = activeZona === "Tutte" ? REQUESTS : REQUESTS.filter(function (r) { return r.zona === activeZona; });
    reqList.innerHTML = list.length ? list.map(reqCard).join("") : '<div class="feed-empty">Stiamo raccogliendo richieste per questa zona. Iscriviti per essere tra i primi.</div>';
  }
  if (zonaBar) {
    ZONE.forEach(function (z) {
      var b = document.createElement("button"); b.type = "button"; b.className = "zona-chip"; b.textContent = z;
      b.setAttribute("aria-pressed", z === activeZona ? "true" : "false");
      b.addEventListener("click", function () {
        activeZona = z;
        zonaBar.querySelectorAll(".zona-chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true"); renderFeed();
      });
      zonaBar.appendChild(b);
    });
    renderFeed();
  }

  /* =========================================================
     PROVA SOCIALE ONESTA — contatore da un solo punto
     ========================================================= */
  var countWrap = document.getElementById("proof-count");
  var proof = document.getElementById("proof-strip");
  function renderProofProvinces() {
    if (!proof) return;
    proof.innerHTML = "";
    // Messaggio inclusivo: niente regioni specifiche, così chi è fuori elenco non si sente escluso
    ["Adesioni aperte in tutta Italia", "Le zone con più iscritti partono prima"].forEach(function (p) {
      var s = document.createElement("span"); s.className = "proof-prov";
      s.innerHTML = '<span class="dot"></span>' + p;
      proof.appendChild(s);
    });
  }
  function showCount(n) {
    if (!countWrap || !n || n < 1) return;
    countWrap.innerHTML = '<span class="pc-num">' + n + '</span><span class="pc-lbl">medici e infermieri già raggiunti in Italia</span>';
    countWrap.style.display = "inline-flex";
  }
  renderProofProvinces();
  if (CONFIG.counterEndpoint) {
    fetch(CONFIG.counterEndpoint).then(function (r) { return r.json(); })
      .then(function (d) { showCount(typeof d === "number" ? d : (d && d.count)); })
      .catch(function () { if (typeof CONFIG.counterManual === "number") showCount(CONFIG.counterManual); });
  } else if (typeof CONFIG.counterManual === "number") {
    showCount(CONFIG.counterManual);
  }

  /* =========================================================
     STICKY MOBILE CTA
     ========================================================= */
  var sticky = document.getElementById("sticky-cta");
  var formSection = document.getElementById("registrati");
  var formVisible = false;
  if (sticky && formSection && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) { formVisible = entries[0].isIntersecting; updateSticky(); }, { rootMargin: "-40% 0px -30% 0px" }).observe(formSection);
  }
  function updateSticky() { if (sticky) sticky.classList.toggle("show", window.pageYOffset > 480 && !formVisible); }
  window.addEventListener("scroll", updateSticky, { passive: true });
  updateSticky();

  render();
})();
