// Préparation automatique d'un brouillon de devis à partir d'une demande du site.
// Le brouillon est TOUJOURS à valider par Yann : rien n'est envoyé au client ici.
// Prix : grille pro (tarifs.prix) ou publique (tarifs.prix_public), TTC final, sans calcul de TVA.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type Produit = { id: string; nom: string; marque: string | null; ref: string | null; actif: boolean; prix: number | null; prix_public: number | null };
type Ligne = { produit_id: string | null; libelle: string; texte_origine: string | null; quantite: number; prix_unitaire: number | null; a_verifier: boolean; raison: string | null; ordre: number };

const arrondi = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (v == null || v === "" || !Number.isFinite(+v)) ? null : +v;

export async function chargerCatalogue(sb: SupabaseClient): Promise<Map<string, Produit>> {
  const { data, error } = await sb.from("produits").select("id,nom,marque,ref,actif,tarifs(prix,prix_public)").limit(2000);
  if (error) throw error;
  const m = new Map<string, Produit>();
  for (const p of data || []) {
    const t: any = Array.isArray((p as any).tarifs) ? (p as any).tarifs[0] : (p as any).tarifs;
    m.set(p.id, { id: p.id, nom: p.nom, marque: p.marque, ref: p.ref, actif: p.actif, prix: num(t?.prix), prix_public: num(t?.prix_public) });
  }
  return m;
}

export const prixSelon = (p: Produit | undefined, grille: string) => p ? (grille === "pro" ? p.prix : p.prix_public) : null;
export const libelleDe = (p: Produit) => [p.marque, p.nom].filter(Boolean).join(" ") + (p.ref ? ` (${p.ref})` : "");

// Lecture du message libre par Claude : renvoie des lignes reliées au catalogue, sans jamais inventer de prix.
async function lireMessage(message: string, panier: any[], cat: Map<string, Produit>) {
  const cle = Deno.env.get("ANTHROPIC_API_KEY");
  if (!cle || !message || message.trim().length < 8) return { lignes: [] as any[], lu: false };
  const liste = [...cat.values()].filter((p) => p.actif).map((p) => `${p.id} | ${p.marque || ""} | ${p.nom} | ${p.ref || ""}`).join("\n");
  const dejaPanier = panier.length ? panier.map((x) => `${x.q} × ${x.nom} [${x.id}]`).join("\n") : "(vide)";
  const systeme = `Tu prépares un brouillon de devis pour Cedyan Energy, grossiste solaire en Guadeloupe.
On te donne le catalogue (une ligne par produit : id | marque | nom | réf) et le message d'un client.
Extrais chaque produit demandé avec sa quantité et relie-le à l'id du catalogue le plus proche.
Règles :
- N'invente jamais de produit ni de prix. Si rien ne correspond, mets "produit_id": null.
- "sur": true seulement si la correspondance est évidente (même modèle, même puissance ou capacité). Sinon false.
- Si la quantité n'est pas précisée, mets 1 et "sur": false.
- Ignore ce qui est déjà dans le panier ci-dessous, sauf si le message demande d'en changer la quantité.
- Ne mets pas de ligne pour la pose, le transport ou les questions générales.
Réponds UNIQUEMENT avec un tableau JSON, sans texte autour :
[{"produit_id": "id ou null", "quantite": 2, "texte_origine": "extrait du message", "libelle": "ce que le client demande", "sur": true}]`;
  const contenu = `CATALOGUE :\n${liste}\n\nPANIER DÉJÀ ENVOYÉ :\n${dejaPanier}\n\nMESSAGE DU CLIENT :\n${message.slice(0, 4000)}`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": cle, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5", max_tokens: 2000, system: systeme, messages: [{ role: "user", content: contenu }] }),
  });
  if (!r.ok) { console.error("Claude", r.status, (await r.text()).slice(0, 300)); return { lignes: [], lu: false }; }
  const j = await r.json();
  const texte = (j.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const debut = texte.indexOf("["), fin = texte.lastIndexOf("]");
  if (debut < 0 || fin < debut) return { lignes: [], lu: true };
  try { const t = JSON.parse(texte.slice(debut, fin + 1)); return { lignes: Array.isArray(t) ? t.slice(0, 60) : [], lu: true }; }
  catch { return { lignes: [], lu: true }; }
}

export async function genererBrouillon(sb: SupabaseClient, demandeId: string, opts: { forcer?: boolean } = {}) {
  const { data: d, error } = await sb.from("demandes").select("*").eq("id", demandeId).single();
  if (error || !d) throw new Error("Demande introuvable");

  const { data: exist } = await sb.from("devis").select("id,statut").eq("demande_id", demandeId);
  if ((exist || []).some((x) => x.statut !== "brouillon")) return { ignore: "Un devis validé ou envoyé existe déjà pour cette demande" };
  if ((exist || []).length && !opts.forcer) return { ignore: "Brouillon déjà prêt", devis_id: exist![0].id };
  if ((exist || []).length) await sb.from("devis").delete().eq("demande_id", demandeId).eq("statut", "brouillon");

  // Pro ou public : selon le compte pro (par lien direct, sinon par e-mail)
  const c = d.contact || {};
  const email = String(c.email || "").toLowerCase().trim();
  let compte: { id: string; statut: string } | null = null;
  if (d.compte_pro_id) compte = (await sb.from("comptes_pro").select("id,statut").eq("id", d.compte_pro_id).maybeSingle()).data;
  if (!compte && email) compte = (await sb.from("comptes_pro").select("id,statut").eq("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
  const grille = compte && compte.statut !== "refuse" ? "pro" : "public";
  const attenteKbis = compte?.statut === "en_attente";

  const cat = await chargerCatalogue(sb);
  const lignes: Ligne[] = [];
  const ajouter = (produit: Produit | undefined, quantite: number, libelle: string, origine: string | null, doute: string | null) => {
    const prix = prixSelon(produit, grille);
    let raison = doute;
    if (produit && prix == null) raison = raison || (grille === "pro" ? "Prix pro manquant" : "Prix public manquant : à saisir");
    if (produit && !produit.actif) raison = raison || "Produit retiré du site : vérifier qu'il est toujours disponible";
    lignes.push({
      produit_id: produit?.id || null, libelle: produit ? libelleDe(produit) : libelle, texte_origine: origine,
      quantite: Math.max(1, Math.min(9999, Math.round(quantite || 1))), prix_unitaire: prix,
      a_verifier: !!raison || !produit, raison: raison || (!produit ? "Produit non reconnu : choisir dans le catalogue" : null), ordre: lignes.length,
    });
  };

  // 1. Panier envoyé depuis le site (produits déjà identifiés)
  const panier = Array.isArray(d.panier) ? d.panier : [];
  for (const x of panier) ajouter(cat.get(String(x.id)), +x.q || 1, String(x.nom || x.id || "Produit"), null, null);

  // 2. Message libre lu par Claude
  const { lignes: lues, lu } = await lireMessage(String(d.message || ""), panier, cat);
  for (const x of lues) {
    const p = x.produit_id ? cat.get(String(x.produit_id)) : undefined;
    ajouter(p, +x.quantite || 1, String(x.libelle || x.texte_origine || "Produit demandé"), x.texte_origine ? String(x.texte_origine).slice(0, 300) : null,
      p && !x.sur ? "Correspondance à confirmer" : null);
  }

  const total = arrondi(lignes.reduce((s, l) => s + (l.prix_unitaire || 0) * l.quantite, 0));
  const validite = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const notes = [
    attenteKbis ? "Pro en attente de validation du Kbis : envoi bloqué tant que son compte n'est pas validé." : null,
    !panier.length && !lues.length && d.message ? (lu ? "Aucun produit reconnu dans le message : à compléter." : "Message à lire : ajoutez les produits à la main.") : null,
  ].filter(Boolean).join(" ") || null;

  const { data: dv, error: e1 } = await sb.from("devis").insert({
    demande_id: demandeId, grille, base_prix: "TTC", taux_tva: null, total_ttc: total, valide_jusqu: validite, note: notes, source: "auto",
  }).select("id").single();
  if (e1) throw e1;
  if (lignes.length) {
    const { error: e2 } = await sb.from("devis_lignes").insert(lignes.map((l) => ({ ...l, devis_id: dv.id })));
    if (e2) throw e2;
  }
  await sb.from("demandes").update({ statut: attenteKbis ? "attente_kbis" : "a_valider", compte_pro_id: compte?.id || null, updated_at: new Date().toISOString() }).eq("id", demandeId);
  return { devis_id: dv.id, grille, attenteKbis, nb_lignes: lignes.length, a_verifier: lignes.filter((l) => l.a_verifier).length, total };
}
