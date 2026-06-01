/* ===========================================================
   CopriTurno — config.js  ·  UNICO PUNTO DA MODIFICARE
   Caricato da index.html (medici) E da strutture.html (RSA).
   Incolla qui l'URL /exec del tuo Google Apps Script.
   Setup in backend/README.md (5 minuti, gratis).

   - endpoint:        riceve ogni salvataggio (medici parziali+completi e strutture)
   - counterEndpoint: GET che restituisce {count:N} medici iscritti
                      (di norma: lo stesso URL + "?count=1")
   - counterManual:   numero a mano se non usi l'API (null = nessun numero finto)
   =========================================================== */
window.CT_CONFIG = {
  endpoint: "https://script.google.com/macros/s/AKfycbx0iC9sfe3wyE5sXTC8J-BC7DEslZzhOQNdMS-jGVgE2Rq0puiQ_9FZc-kIbLfLSBJn/exec",
  counterEndpoint: "https://script.google.com/macros/s/AKfycbx0iC9sfe3wyE5sXTC8J-BC7DEslZzhOQNdMS-jGVgE2Rq0puiQ_9FZc-kIbLfLSBJn/exec?count=1",
  counterManual: null
};
