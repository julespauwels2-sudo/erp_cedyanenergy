// Liste de contrôles d'une intervention : cocher, ajouter un point, masquer un point du rapport envoyé au client.
(() => {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  if (!document.getElementById("cl-style")) {
    const st = document.createElement("style"); st.id = "cl-style";
    st.textContent = `.cl{display:grid;gap:8px}
.cl-l{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #dfe7e0;border-radius:14px;background:#fff;min-height:52px}
.cl-l input[type=checkbox]{width:24px;height:24px;flex:none;accent-color:#0E9C8F}
.cl-l .t{flex:1;min-width:0;overflow-wrap:break-word;cursor:pointer}
.cl-l .t small{display:block;font-size:11px;font-weight:700;color:#8a968d;text-decoration:none}
.cl-l button{flex:none;border:0;background:#f3f6f2;border-radius:10px;min-width:40px;height:40px;padding:0 10px;cursor:pointer;font-size:13px;font-weight:700;color:#56665b}
.cl-l.masque{background:#f7f8f6}.cl-l.masque .t span{text-decoration:line-through;color:#8a968d}
.cl-l .badge-m{font-size:11px;font-weight:700;color:#8a968d;white-space:nowrap}
.cl-aj{display:flex;gap:8px;margin-top:4px}.cl-aj input{flex:1;min-width:0;min-height:46px;border:1.5px dashed #b9c8bc;border-radius:12px;padding:0 12px;font:inherit;background:#fff}
.cl-aj button{min-height:46px;padding:0 14px;border-radius:12px;border:0;background:#0E9C8F;color:#fff;font:inherit;font-weight:800;cursor:pointer}
.cl-aide{font-size:12px;color:#56665b;margin:6px 0 0}`;
    document.head.appendChild(st);
  }
  function monter(z, items) {
    const dessiner = () => {
      z.innerHTML = `<div class="cl">${items.map((c, k) => `<div class="cl-l ${c.masque ? "masque" : ""}">
          <input type="checkbox" data-f="${k}" ${c.fait ? "checked" : ""} aria-label="Fait : ${esc(c.texte)}">
          <span class="t" data-t="${k}"><span>${esc(c.texte)}</span>${c.masque ? `<small>Pas dans le rapport</small>` : ""}</span>
          <button type="button" data-m="${k}" title="${c.masque ? "Remettre dans le rapport" : "Ne pas mettre dans le rapport"}" aria-label="${c.masque ? "Remettre dans le rapport" : "Masquer du rapport"} : ${esc(c.texte)}">${c.masque ? "👁" : "🙈"}</button>
          ${c.ajoute ? `<button type="button" data-x="${k}" aria-label="Retirer : ${esc(c.texte)}">✕</button>` : ""}</div>`).join("")}</div>
        <div class="cl-aj"><input type="text" placeholder="Ajouter un point (ex. : remplacement du fusible DC)" aria-label="Nouveau point"><button type="button">Ajouter</button></div>
        <p class="cl-aide">🙈 masque un point inutile : il n'apparaîtra pas dans le rapport envoyé au client.</p>`;
      z.querySelectorAll("[data-f]").forEach((cb) => (cb.onchange = () => (items[+cb.dataset.f].fait = cb.checked)));
      z.querySelectorAll("[data-t]").forEach((t) => (t.onclick = () => { const cb = z.querySelector(`[data-f="${t.dataset.t}"]`); cb.checked = !cb.checked; cb.onchange(); }));
      z.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => { const c = items[+b.dataset.m]; c.masque = !c.masque; dessiner(); }));
      z.querySelectorAll("[data-x]").forEach((b) => (b.onclick = () => { items.splice(+b.dataset.x, 1); dessiner(); }));
      const inp = z.querySelector(".cl-aj input"), aj = () => { const v = inp.value.trim(); if (!v) return; items.push({ texte: v.slice(0, 200), fait: true, ajoute: true }); dessiner(); z.querySelector(".cl-aj input").focus(); };
      z.querySelector(".cl-aj button").onclick = aj; inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); aj(); } };
    };
    dessiner();
    return () => items.map((c) => ({ texte: c.texte, fait: !!c.fait, masque: !!c.masque, ajoute: !!c.ajoute }));
  }
  window.Checklist = { monter };
})();
