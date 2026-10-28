// Notifications du QG : panneau d'activation, partagé par le QG et l'application terrain.
(() => {
  "use strict";
  const FN = "https://uotqqkhraqxtlssgavlm.supabase.co/functions/v1/notifs", ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdHFxa2hyYXF4dGxzc2dhdmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNDI1NTAsImV4cCI6MjEwNjgxODU1MH0.61NliFrPeWNilEmXPayAONTIVF49tmq3arjgdzSwPpM";
  const LIBELLES = {
    demande: "Nouvelle demande (devis, contact)",
    kbis: "Nouveau compte pro à valider",
    devis_accepte: "Un client accepte un devis",
    sav_urgent: "SAV urgent",
    mission: "Mes interventions et chantiers (nouveaux ou déplacés)",
  };
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installee = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const compatible = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const b64 = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };

  async function appel(sb, corps) {
    const { data: { session } } = await sb.auth.getSession();
    const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + (session ? session.access_token : "") }, body: JSON.stringify(corps) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erreur || "Erreur " + r.status); return j;
  }
  async function abonnementActuel() { if (!compatible) return null; const reg = await navigator.serviceWorker.getRegistration("/"); return reg ? reg.pushManager.getSubscription() : null; }

  async function ouvrir(sb) {
    let dlg = document.getElementById("dlg-notifs");
    if (!dlg) {
      dlg = document.createElement("dialog"); dlg.id = "dlg-notifs";
      dlg.style.cssText = "border:0;border-radius:22px;padding:22px;width:min(94vw,440px);font:15px/1.45 Inter,system-ui,sans-serif;color:#16241a";
      document.body.appendChild(dlg);
      const st = document.createElement("style");
      st.textContent = "#dlg-notifs::backdrop{background:rgba(8,23,13,.6)}#dlg-notifs h2{margin:0 0 6px;font-size:1.3rem}#dlg-notifs p{margin:6px 0;color:#56665b}#dlg-notifs label{display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid #dfe7e0;border-radius:14px;margin:6px 0;cursor:pointer}#dlg-notifs input{width:22px;height:22px;accent-color:#0E9C8F;flex:none}#dlg-notifs .bts{display:grid;gap:8px;margin-top:12px}#dlg-notifs button{min-height:48px;border-radius:14px;border:1.5px solid #dfe7e0;background:#fff;font:inherit;font-weight:800;cursor:pointer}#dlg-notifs .pri{background:#0E9C8F;border-color:#0E9C8F;color:#fff}#dlg-notifs .msg{font-weight:700;color:#0b7a70;min-height:1.2em}";
      document.head.appendChild(st);
    }
    dlg.innerHTML = `<h2>🔔 Notifications</h2><p>Chargement…</p>`; if (!dlg.open) dlg.showModal();
    const fermer = `<button type="button" id="nf-fermer">Fermer</button>`;
    if (!compatible) { dlg.innerHTML = `<h2>🔔 Notifications</h2><p>Ce navigateur ne gère pas les notifications. Utilisez Chrome ou Safari à jour.</p><div class="bts">${fermer}</div>`; }
    else if (ios && !installee) {
      dlg.innerHTML = `<h2>🔔 Notifications sur iPhone</h2><p>Sur iPhone, les notifications marchent quand le QG est installé sur l'écran d'accueil :</p>
        <p>1. Touchez le bouton <b>Partager</b> (le carré avec une flèche) en bas de Safari.<br>2. Choisissez <b>« Sur l'écran d'accueil »</b>.<br>3. Ouvrez le QG depuis sa nouvelle icône, puis revenez ici.</p><div class="bts">${fermer}</div>`;
    } else {
      let permis = [];
      try { permis = (await appel(sb, { action: "types" })).permis || []; } catch (e) { dlg.innerHTML = `<h2>🔔 Notifications</h2><p>${e.message}</p><div class="bts">${fermer}</div>`; }
      if (permis.length) {
        const sub = await abonnementActuel(), choisis = JSON.parse(localStorage.getItem("qg_notifs_types") || "null") || permis;
        const refuse = Notification.permission === "denied";
        dlg.innerHTML = `<h2>🔔 Notifications</h2><p>${sub ? "✅ Activées sur cet appareil." : "Recevez les infos importantes sur cet appareil, même quand le QG est fermé."}</p>
          ${permis.map((t) => `<label><input type="checkbox" value="${t}" ${choisis.includes(t) ? "checked" : ""}>${LIBELLES[t] || t}</label>`).join("")}
          ${refuse ? `<p><b>Les notifications sont bloquées pour ce site.</b> Autorisez-les dans les réglages du navigateur (le cadenas à côté de l'adresse), puis réessayez.</p>` : ""}
          <p class="msg" id="nf-msg"></p>
          <div class="bts"><button type="button" class="pri" id="nf-ok">${sub ? "Enregistrer mes choix" : "Activer les notifications"}</button>${sub ? `<button type="button" id="nf-test">Envoyer une notification de test</button><button type="button" id="nf-off">Désactiver sur cet appareil</button>` : ""}${fermer}</div>`;
        const msg = (t) => (document.getElementById("nf-msg").textContent = t);
        document.getElementById("nf-ok").onclick = async () => {
          try {
            const types = [...dlg.querySelectorAll("input:checked")].map((i) => i.value); localStorage.setItem("qg_notifs_types", JSON.stringify(types));
            if ((await Notification.requestPermission()) !== "granted") return msg("Notifications refusées par le navigateur.");
            const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" }); await navigator.serviceWorker.ready;
            let s = await reg.pushManager.getSubscription();
            if (!s) { const { cle } = await appel(sb, { action: "cle" }); s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(cle) }); }
            await appel(sb, { action: "abonner", abonnement: s.toJSON(), types, appareil: (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "" });
            msg("✅ C'est activé !"); setTimeout(() => ouvrir(sb), 900);
          } catch (e) { msg("Impossible : " + (e.message || e)); }
        };
        const t = document.getElementById("nf-test"); if (t) t.onclick = async () => { try { const r = await appel(sb, { action: "tester" }); msg(r.envoyees ? "Notification envoyée, regardez votre écran." : "Aucun appareil actif trouvé."); } catch (e) { msg(e.message); } };
        const o = document.getElementById("nf-off"); if (o) o.onclick = async () => { const s = await abonnementActuel(); if (s) { try { await appel(sb, { action: "desabonner", endpoint: s.endpoint }); } catch {} await s.unsubscribe(); } ouvrir(sb); };
      }
    }
    const f = document.getElementById("nf-fermer"); if (f) f.onclick = () => dlg.close();
  }
  window.QGNotifs = { ouvrir };
})();
