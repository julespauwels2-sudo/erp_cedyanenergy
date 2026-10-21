// Alertes au patron : e-mail (Resend) et WhatsApp (CallMeBot).
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const LIBELLES: Record<string, string> = { questionnaire: "Questionnaire « Trouver mon kit »", devis: "Demande de devis", contact: "Message de contact", "pack-cyclone": "Pack Détresse Cyclone", "compte-pro": "Demande de compte pro (Kbis à valider)" };
const euro = (n: number) => (n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export async function envoyerEmail(a: string, sujet: string, html: string) {
  const cle = Deno.env.get("RESEND_API_KEY");
  if (!cle || !a) return { ok: false, raison: "RESEND_API_KEY ou destinataire manquant" };
  const de = Deno.env.get("EMAIL_FROM") || "Cedyan Energy <onboarding@resend.dev>";
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: de, to: [a], subject: sujet, html }) });
  const t = await r.text(); if (!r.ok) console.error("Resend", r.status, t);
  return { ok: r.ok, statut: r.status, detail: r.ok ? undefined : t.slice(0, 300) };
}

export async function envoyerWhatsApp(texte: string) {
  const tel = Deno.env.get("CALLMEBOT_PHONE"), cle = Deno.env.get("CALLMEBOT_APIKEY");
  if (!tel || !cle) return { ok: false, raison: "CALLMEBOT_PHONE ou CALLMEBOT_APIKEY manquant" };
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(tel)}&text=${encodeURIComponent(texte)}&apikey=${encodeURIComponent(cle)}`;
  const r = await fetch(url); const t = await r.text(); if (!r.ok) console.error("CallMeBot", r.status, t);
  return { ok: r.ok, statut: r.status, detail: r.ok ? undefined : t.slice(0, 300) };
}

export async function alerter(d: Record<string, any>) {
  const site = Deno.env.get("SITE_URL") || "https://site-ceydanenergy.vercel.app";
  const c = d.contact || {};
  const prio = d.priorite === "haute" ? "🔴 Au plus vite" : d.priorite === "moyenne" ? "🟠 D'ici 3 mois" : "⚪ Se renseigne";
  const titre = LIBELLES[d.type] || "Nouvelle demande";
  const lignes = [["Nom", c.nom], ["Entreprise", c.entreprise], ["Téléphone", c.telephone], ["E-mail", c.email], ["Commune", c.commune], ["SIREN", c.siren], ["Métier", c.metier], ["Pour quand", d.pourQuand]].filter(([, v]) => v);
  const panier = Array.isArray(d.panier) && d.panier.length ? `<p><b>Produits :</b><br>${d.panier.map((x: any) => `${esc(x.q)} × ${esc(x.nom)}`).join("<br>")}</p>` : "";
  const reps = d.reponses ? `<p><b>Réponses :</b><br>${Object.entries(d.reponses).map(([k, v]) => `${esc(k)} : ${esc(v)}`).join("<br>")}</p>` : "";
  const b = d.brouillon && d.brouillon.devis_id ? d.brouillon : null;
  const lienDevis = b ? `${site}/devis.html?d=${b.devis_id}` : null;
  const blocDevis = b ? `<div style="background:#fff8e1;border:1px solid #fbbb10;border-radius:10px;padding:12px 14px;margin:14px 0"><b>Brouillon de devis prêt</b> (${b.grille === "pro" ? "prix pros" : "prix publics"}) : ${b.nb_lignes} ligne${b.nb_lignes > 1 ? "s" : ""}, total ${euro(b.total)}.${b.a_verifier ? `<br>⚠️ ${b.a_verifier} ligne${b.a_verifier > 1 ? "s" : ""} à vérifier.` : ""}${b.attenteKbis ? "<br>⚠️ Kbis du pro à valider avant l'envoi." : ""}<br><a href="${lienDevis}" style="display:inline-block;margin-top:8px;background:#0d3a16;color:#fff;padding:9px 16px;border-radius:999px;text-decoration:none;font-weight:bold">Relire et valider le devis</a></div>` : "";
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px"><div style="background:#0d3a16;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0"><b style="font-size:18px">${esc(titre)}</b><br><span style="color:#fbbb10">${prio}</span></div><div style="border:1px solid #d9e3da;border-top:0;padding:18px 22px;border-radius:0 0 12px 12px"><table style="border-collapse:collapse">${lignes.map(([k, v]) => `<tr><td style="padding:4px 14px 4px 0;color:#56665b">${esc(k)}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`).join("")}</table>${blocDevis}${panier}${reps}${d.message ? `<p><b>Message :</b><br>${esc(d.message).replace(/\n/g, "<br>")}</p>` : ""}${d.compte ? `<p>${d.compte.kbis ? "Kbis reçu." : "⚠️ Kbis non joint."}</p>` : ""}<p><a href="${site}/dashboard.html" style="display:inline-block;background:#fbbb10;color:#16241a;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Ouvrir le dashboard</a></p></div></div>`;
  const sujet = `${d.priorite === "haute" ? "[Au plus vite] " : ""}${titre} : ${c.nom || c.entreprise || c.telephone || ""}`;
  const taches: Promise<unknown>[] = [envoyerEmail(Deno.env.get("PATRON_EMAIL") || "", sujet, html)];
  if (d.priorite === "haute" || d.type === "compte-pro") {
    const wa = `Cedyan : ${titre}\n${prio}\n${c.nom || ""} ${c.telephone || ""}\n${c.commune || ""}\n${lienDevis || site + "/dashboard.html"}`;
    taches.push(envoyerWhatsApp(wa));
  }
  const res = await Promise.allSettled(taches);
  return res;
}
