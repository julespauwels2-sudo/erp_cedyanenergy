// Première connexion par lien e-mail : on propose tout de suite de choisir son mot de passe.
// À charger AVANT le client Supabase, car Supabase efface le lien de la barre d'adresse en le lisant.
(() => {
  "use strict";
  const viaLien = /type=(magiclink|signup|invite|recovery)/.test(location.hash) || /[?&]code=/.test(location.search);
  function proposer(sb) {
    let d = document.getElementById("dlg-premier-mdp");
    if (!d) {
      d = document.createElement("dialog"); d.id = "dlg-premier-mdp";
      d.style.cssText = "border:0;border-radius:22px;padding:22px;width:min(94vw,420px);font:15px/1.45 Inter,system-ui,sans-serif;color:#16241a";
      d.innerHTML = `<form method="dialog" id="pm-f"><h2 style="margin:0 0 6px;font-size:1.3rem">Bienvenue ! Choisissez votre mot de passe</h2>
        <p style="margin:0 0 10px;color:#56665b">8 caractères minimum. La prochaine fois, vous vous connecterez avec votre e-mail et ce mot de passe, sans lien.</p>
        <input type="password" id="pm-1" placeholder="Nouveau mot de passe" autocomplete="new-password" style="width:100%;min-height:48px;border:1.5px solid #dfe7e0;border-radius:12px;padding:10px 12px;margin-bottom:8px;font:inherit">
        <input type="password" id="pm-2" placeholder="Retapez-le" autocomplete="new-password" style="width:100%;min-height:48px;border:1.5px solid #dfe7e0;border-radius:12px;padding:10px 12px;font:inherit">
        <p id="pm-msg" style="min-height:1.2em;color:#b42318;font-weight:600;margin:8px 0"></p>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" id="pm-plus" style="min-height:46px;padding:0 16px;border-radius:12px;border:1.5px solid #dfe7e0;background:#fff;font:inherit;font-weight:700">Plus tard</button><button id="pm-ok" style="min-height:46px;padding:0 18px;border-radius:12px;border:0;background:#0E9C8F;color:#fff;font:inherit;font-weight:800">Enregistrer</button></div></form>`;
      document.body.appendChild(d);
      const st = document.createElement("style"); st.textContent = "#dlg-premier-mdp::backdrop{background:rgba(8,23,13,.6)}"; document.head.appendChild(st);
      d.querySelector("#pm-plus").onclick = () => d.close();
      d.querySelector("#pm-f").onsubmit = async (e) => {
        e.preventDefault(); const a = d.querySelector("#pm-1").value, b = d.querySelector("#pm-2").value, m = d.querySelector("#pm-msg");
        if (a.length < 8) return (m.textContent = "8 caractères minimum.");
        if (a !== b) return (m.textContent = "Les deux mots de passe ne sont pas identiques.");
        const { error } = await sb.auth.updateUser({ password: a });
        if (error) return (m.textContent = "Impossible : " + error.message);
        m.style.color = "#0b7a70"; m.textContent = "Mot de passe enregistré ✓"; setTimeout(() => d.close(), 900);
      };
    }
    if (!d.open) d.showModal();
  }
  window.QGMotDePasse = { viaLien, proposer, siBesoin: (sb) => { if (viaLien) proposer(sb); } };
})();
