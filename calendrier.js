// Petit calendrier en français, à la place du sélecteur de date du navigateur.
// Usage : Calendrier.amenager(conteneur) transforme chaque <input type="date"> du conteneur.
(() => {
  "use strict";
  const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const JOURS = ["L", "M", "M", "J", "V", "S", "D"];
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const lire = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const joli = (d) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
  if (!document.getElementById("cal-style")) {
    const st = document.createElement("style"); st.id = "cal-style";
    st.textContent = `.cal-btn{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:46px;padding:0 14px;border:1.5px solid #dfe7e0;border-radius:12px;background:#fff;font:inherit;font-size:15px;color:#16241a;cursor:pointer;text-align:left}
.cal-btn:hover{border-color:#9fcda1}.cal-btn .vide{color:#8a968d}.cal-btn::after{content:"📅";font-size:16px}
.cal-pop{position:fixed;z-index:60;background:#fff;border-radius:20px;box-shadow:0 30px 70px -20px rgba(8,23,13,.45);padding:14px;width:300px;font:14px/1.3 Inter,system-ui,sans-serif;color:#16241a}
.cal-pop .t{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.cal-pop .t b{font-size:15px;text-transform:capitalize}
.cal-pop .t button{width:38px;height:38px;border-radius:12px;border:0;background:#f3f6f2;font-size:18px;cursor:pointer}
.cal-pop .g{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center}
.cal-pop .g span{font-size:11px;font-weight:700;color:#8a968d;padding:4px 0}
.cal-pop .g button{aspect-ratio:1;border:0;border-radius:10px;background:none;font:inherit;font-weight:600;cursor:pointer;color:#16241a}
.cal-pop .g button:hover{background:#e7f3e7}.cal-pop .g button.auj{box-shadow:inset 0 0 0 1.5px #218034}.cal-pop .g button.sel{background:#14551f;color:#fff}.cal-pop .g button.we{color:#8a968d}
.cal-pop .r{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.cal-pop .r button{border:0;border-radius:999px;background:#f3f6f2;padding:8px 12px;font:inherit;font-weight:700;font-size:13px;cursor:pointer}
@media (max-width:600px){.cal-pop{left:8px!important;right:8px!important;bottom:calc(8px + env(safe-area-inset-bottom,0px))!important;top:auto!important;width:auto}.cal-pop .g button{font-size:15px}}
.cal-fond{position:fixed;inset:0;z-index:59;background:rgba(8,23,13,.25)}`;
    document.head.appendChild(st);
  }
  let ouvert = null;
  function fermer() { if (ouvert) { ouvert.pop.remove(); ouvert.fond.remove(); ouvert = null; } }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermer(); });
  function ouvrir(input, btn) {
    fermer();
    let vue = lire(input.value) || new Date(); vue = new Date(vue.getFullYear(), vue.getMonth(), 1);
    const fond = document.createElement("div"); fond.className = "cal-fond"; fond.onclick = fermer;
    const pop = document.createElement("div"); pop.className = "cal-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Choisir une date");
    (input.closest("dialog") || document.body).append(fond, pop); ouvert = { pop, fond };   // dans une fenêtre modale, le calendrier doit être dedans pour rester cliquable
    const choisir = (d) => { input.value = d ? iso(d) : ""; input.dispatchEvent(new Event("change", { bubbles: true })); maj(input, btn); fermer(); btn.focus(); };
    const dessiner = () => {
      const auj = iso(new Date()), sel = input.value, premier = (vue.getDay() + 6) % 7, nb = new Date(vue.getFullYear(), vue.getMonth() + 1, 0).getDate();
      let cases = ""; for (let i = 0; i < premier; i++) cases += "<i></i>";
      for (let j = 1; j <= nb; j++) { const d = new Date(vue.getFullYear(), vue.getMonth(), j), k = iso(d), we = d.getDay() === 0 || d.getDay() === 6;
        cases += `<button type="button" data-j="${k}" class="${k === auj ? "auj" : ""} ${k === sel ? "sel" : ""} ${we ? "we" : ""}" aria-label="${joli(d)}">${j}</button>`; }
      const demain = new Date(); demain.setDate(demain.getDate() + 1);
      const lundi = new Date(); lundi.setDate(lundi.getDate() + ((8 - lundi.getDay()) % 7 || 7));
      pop.innerHTML = `<div class="t"><button type="button" data-n="-1" aria-label="Mois précédent">‹</button><b>${MOIS[vue.getMonth()]} ${vue.getFullYear()}</b><button type="button" data-n="1" aria-label="Mois suivant">›</button></div>
        <div class="g">${JOURS.map((j) => `<span>${j}</span>`).join("")}${cases}</div>
        <div class="r"><button type="button" data-r="${iso(new Date())}">Aujourd'hui</button><button type="button" data-r="${iso(demain)}">Demain</button><button type="button" data-r="${iso(lundi)}">Lundi prochain</button>${input.required ? "" : `<button type="button" data-r="">Effacer</button>`}</div>`;
      pop.querySelectorAll("[data-n]").forEach((b) => (b.onclick = () => { vue = new Date(vue.getFullYear(), vue.getMonth() + +b.dataset.n, 1); dessiner(); }));
      pop.querySelectorAll("[data-j]").forEach((b) => (b.onclick = () => choisir(lire(b.dataset.j))));
      pop.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => choisir(lire(b.dataset.r))));
    };
    dessiner();
    if (innerWidth > 600) { const r = btn.getBoundingClientRect(); const h = pop.offsetHeight; pop.style.left = Math.min(r.left, innerWidth - 310) + "px"; pop.style.top = (r.bottom + h + 8 < innerHeight ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + "px"; }
    (pop.querySelector(".sel") || pop.querySelector(".auj") || pop.querySelector("[data-j]")).focus();
  }
  function maj(input, btn) { const d = lire(input.value); btn.innerHTML = d ? `<span>${joli(d).replace(/^./, (c) => c.toUpperCase())}</span>` : `<span class="vide">Choisir une date</span>`; }
  function amenager(racine) {
    (racine || document).querySelectorAll('input[type="date"]:not([data-cal])').forEach((input) => {
      input.dataset.cal = "1"; input.type = "hidden";
      const btn = document.createElement("button"); btn.type = "button"; btn.className = "cal-btn"; btn.id = input.id ? input.id + "-btn" : "";
      input.insertAdjacentElement("afterend", btn); maj(input, btn);
      btn.onclick = () => ouvrir(input, btn);
    });
  }
  window.Calendrier = { amenager };
})();
