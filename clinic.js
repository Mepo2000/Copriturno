/* ===========================================================
   CopriTurno — clinic.js (lato strutture)
   Chip groups, validation, submit -> confirmation, privacy modal,
   sticky CTA. Vanilla JS.
   =========================================================== */
(function () {
  "use strict";

  /* CONFIG backend condiviso (vedi config.js → window.CT_CONFIG e backend/README.md) */
  var CONFIG = window.CT_CONFIG || { endpoint: "" };
  function val_(id) { var e = document.getElementById(id); return e ? e.value.trim() : ""; }

  /* Sorgente della richiesta: ?src=<canale> + referrer (per capire da dove arriva). */
  var SRC = (function () {
    try { var c = JSON.parse(localStorage.getItem("ct_src") || "null"); if (c && (c.source || c.referrer)) return c; } catch (e) {}
    var p; try { p = new URLSearchParams(location.search); } catch (e) { p = null; }
    var g = function (k) { return p ? (p.get(k) || "") : ""; };
    var c = { source: g("src") || g("utm_source") || g("ref") || "", referrer: document.referrer || "" };
    try { localStorage.setItem("ct_src", JSON.stringify(c)); } catch (e) {}
    return c;
  })();

  /* Ogni richiesta è una riga NUOVA nel foglio: una struttura può pubblicare più
     turni diversi nel tempo, quindi a ogni invio generiamo un id-richiesta fresco
     (niente UPSERT, che sovrascriverebbe la richiesta precedente). */
  function newRequestId() {
    return "ct_str_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* salvataggio: localStorage (rete di sicurezza) + POST best-effort al backend */
  function sendClinicLead(payload) {
    try { localStorage.setItem("ct_clinic_lead", JSON.stringify(payload)); } catch (e) {}
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
      console.warn("CopriTurno: endpoint backend non configurato — la richiesta resta solo in localStorage e NON arriva al foglio. Imposta window.CT_CONFIG.endpoint in config.js (vedi backend/README.md).");
    }
  }

  var CHIPS = {
    "tipo-struttura": ["RSA / CRA", "Clinica privata", "Casa di cura", "Studio MMG", "Poliambulatorio", "Evento / sport", "Medicina del lavoro", "Altro"],
    "profilo": ["Medico di reparto", "Guardia medica", "Sostituto MMG", "Medico ambulatoriale", "Medicina del lavoro", "Specializzando ok", "Neolaureato ok"],
    "turni": ["Mattina", "Pomeriggio", "Sera", "Notte", "Weekend", "Festivi"],
    "urgenza": ["Last-minute", "Questa settimana", "Entro il mese", "Programmato"]
  };

  var TICK = '<span class="tick"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l4.5 4.5L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

  Object.keys(CHIPS).forEach(function (group) {
    var container = document.querySelector('.chips[data-group="' + group + '"]');
    if (!container) return;
    var single = container.classList.contains("single");
    CHIPS[group].forEach(function (label) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.setAttribute("aria-pressed", "false"); b.dataset.value = label;
      b.innerHTML = '<span>' + label + '</span>' + TICK;
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-pressed") === "true";
        if (single) container.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", on ? "false" : "true");
        var field = b.closest(".field"); if (field) field.classList.remove("invalid");
      });
      container.appendChild(b);
    });
  });

  var form = document.getElementById("clinic-form");

  function validate() {
    var ok = true;
    form.querySelectorAll(".field[data-required]").forEach(function (field) {
      var input = field.querySelector(".input");
      if (input) {
        var v = input.value.trim();
        var valid = v.length > 0;
        if (valid && field.dataset.type === "phone") valid = v.replace(/[^\d]/g, "").length >= 6;
        if (valid && input.type === "email") valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        field.classList.toggle("invalid", !valid); if (!valid) ok = false;
      } else if (field.dataset.chips) {
        var any = field.querySelectorAll('.chip[aria-pressed="true"]').length > 0;
        field.classList.toggle("invalid", !any); if (!any) ok = false;
      }
    });
    var emailField = document.getElementById("c-email").closest(".field");
    var ev = document.getElementById("c-email").value.trim();
    if (ev && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ev)) { emailField.classList.add("invalid"); ok = false; }

    form.querySelectorAll(".consent[data-required-consent]").forEach(function (c) {
      var valid = c.querySelector("input").checked;
      c.classList.toggle("invalid", !valid); if (!valid) ok = false;
    });
    return ok;
  }

  form.querySelectorAll(".input").forEach(function (inp) {
    inp.addEventListener("input", function () { var f = inp.closest(".field"); if (f) f.classList.remove("invalid"); });
  });
  form.querySelectorAll(".consent input").forEach(function (b) {
    b.addEventListener("change", function () { b.closest(".consent").classList.remove("invalid"); });
  });

  function selected(group) {
    var c = document.querySelector('.chips[data-group="' + group + '"]');
    return c ? Array.prototype.slice.call(c.querySelectorAll('.chip[aria-pressed="true"]')).map(function (b) { return b.dataset.value; }) : [];
  }

  document.getElementById("clinic-submit").addEventListener("click", function () {
    if (!validate()) {
      var bad = form.querySelector(".field.invalid, .consent.invalid");
      if (bad) bad.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    var data = {
      tipo: selected("tipo-struttura")[0] || "-",
      profilo: selected("profilo"),
      citta: document.getElementById("c-citta").value.trim(),
      quando: document.getElementById("c-quando").value.trim(),
      turni: selected("turni"),
      compenso: document.getElementById("c-compenso").value.trim()
    };
    sendClinicLead({
      leadId: newRequestId(), stage: "completo", page: "strutture", ts: new Date().toISOString(),
      struttura: val_("c-struttura"), referente: val_("c-ref"), telefono: val_("c-tel"), email: val_("c-email"),
      tipo_struttura: data.tipo, profilo: data.profilo, citta: data.citta, quando: data.quando,
      turni: data.turni, urgenza: selected("urgenza")[0] || "", compenso: data.compenso, note: val_("c-note"),
      consenso: !!(document.getElementById("cc-terms") || {}).checked,
      source: SRC.source, referrer: SRC.referrer, ua: navigator.userAgent
    });
    form.style.display = "none";
    var confirm = document.getElementById("clinic-confirm");
    confirm.classList.add("active");
    function row(k, v) { return '<div class="row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
    document.getElementById("clinic-recap").innerHTML =
      row("Struttura", data.tipo) +
      row("Cerchi", data.profilo.length ? data.profilo.join(", ") : "-") +
      row("Dove", (data.citta || "-")) +
      row("Quando", (data.quando || "-") + (data.turni.length ? " \u00b7 " + data.turni.join(", ") : "")) +
      row("Compenso", data.compenso || "-");
    var card = document.getElementById("clinic-card");
    var y = card.getBoundingClientRect().top + window.pageYOffset - 90;
    window.scrollTo({ top: y, behavior: "smooth" });
  });

  /* privacy modal */
  var modal = document.getElementById("privacy-modal");
  function openP(e) { if (e) e.preventDefault(); modal.classList.add("open"); document.body.style.overflow = "hidden"; }
  function closeP() { modal.classList.remove("open"); document.body.style.overflow = ""; }
  document.querySelectorAll(".open-privacy").forEach(function (a) { a.addEventListener("click", openP); });
  document.getElementById("privacy-close").addEventListener("click", closeP);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeP(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeP(); });

  var yr = document.getElementById("year"); if (yr) yr.textContent = new Date().getFullYear();

  /* sticky CTA */
  var sticky = document.getElementById("sticky-cta");
  var section = document.getElementById("pubblica");
  var visible = false;
  if (sticky && section && "IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; upd(); }, { rootMargin: "-40% 0px -30% 0px" }).observe(section);
  }
  function upd() { if (sticky) sticky.classList.toggle("show", window.pageYOffset > 480 && !visible); }
  window.addEventListener("scroll", upd, { passive: true });
  upd();
})();
