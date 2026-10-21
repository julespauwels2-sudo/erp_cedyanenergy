// Réception des demandes du site Cedyan Energy (public, sans connexion).
// Enregistre la demande, le Kbis éventuel, prépare le brouillon de devis, puis alerte le patron.
// Protections : champ piège anti-robots, limite d'envois par contact et par heure, tailles et types de fichiers contrôlés.
import { createClient } from "npm:@supabase/supabase-js@2";
import { alerter } from "./alertes.ts";
import { cors } from "./cors.ts";
import { genererBrouillon } from "./brouillon.ts";

const TYPES = ["questionnaire", "devis", "contact", "pack-cyclone", "compte-pro"];
const KBIS_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
const txt = (v: unknown, max = 500) => (v == null ? null : String(v).slice(0, max));
const q = (v: unknown) => '"' + String(v).replace(/["\\]/g, "") + '"';
// Objets libres (réponses, utm) : aplatis, clés et valeurs bornées
const borne = (o: unknown, n = 40) => (o && typeof o === "object" && !Array.isArray(o)) ? Object.fromEntries(Object.entries(o as Record<string, unknown>).slice(0, n).map(([k, v]) => [String(k).slice(0, 60), txt(typeof v === "object" ? JSON.stringify(v) : v, 300)])) : null;
// Lance une tâche après la réponse au visiteur (le formulaire répond tout de suite)
const enFond = (t: Promise<unknown>) => { const er = (globalThis as any).EdgeRuntime; if (er?.waitUntil) er.waitUntil(t); else return t; };

Deno.serve(async (req) => {
  const CORS = cors(req);
  const rep = (corps: unknown, statut = 200) => new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return rep({ erreur: "Méthode non autorisée" }, 405);
  try {
    if (+(req.headers.get("content-length") || 0) > 9 * 1024 * 1024) return rep({ erreur: "Demande trop volumineuse" }, 413);
    let p: Record<string, any> = {};
    let fichier: File | null = null;
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const f = await req.formData();
      const brut = String(f.get("payload") || "{}");
      if (brut.length > 60000) return rep({ erreur: "Demande trop volumineuse" }, 413);
      p = JSON.parse(brut);
      const k = f.get("kbis");
      if (k && k instanceof File && k.size > 0) fichier = k;
    } else {
      const brut = await req.text();
      if (brut.length > 60000) return rep({ erreur: "Demande trop volumineuse" }, 413);
      p = JSON.parse(brut || "{}");
    }
    if (p.site_web) return rep({ ok: true }); // pot de miel anti-robots
    if (!TYPES.includes(p.type)) return rep({ erreur: "Type de demande inconnu" }, 400);
    const c = p.contact || {};
    if (!c.telephone && !c.email) return rep({ erreur: "Téléphone ou e-mail requis" }, 400);
    const contact = Object.fromEntries(Object.entries(c).slice(0, 20).map(([k, v]) => [String(k).slice(0, 40), txt(v, 200)]));
    const pourQuand = txt(p.pour_quand, 40) || "Non précisé";
    const priorite = pourQuand === "Au plus vite" ? "haute" : pourQuand === "D'ici 3 mois" ? "moyenne" : "basse";

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let avalanche = false;
    try {
      const il10 = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const il60 = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const filtres = [contact.telephone ? `contact->>telephone.eq.${q(contact.telephone)}` : null, contact.email ? `contact->>email.eq.${q(contact.email)}` : null].filter(Boolean).join(",");
      if (filtres) {
        const { count } = await sb.from("demandes").select("id", { count: "exact", head: true }).gte("created_at", il10).or(filtres);
        if ((count || 0) >= 3) return rep({ erreur: "Demande déjà reçue, nous vous recontactons très vite." }, 429);
      }
      const { count: total } = await sb.from("demandes").select("id", { count: "exact", head: true }).gte("created_at", il60);
      avalanche = (total || 0) >= 60;
      if ((total || 0) >= 200) return rep({ erreur: "Service momentanément saturé, appelez-nous au 0590 32 15 20." }, 429);
    } catch (e) { console.error("limite", e); }

    const panier = Array.isArray(p.panier) ? p.panier.slice(0, 80).map((x: any) => ({ id: txt(x?.id, 80), nom: txt(x?.nom, 200), q: Math.max(1, Math.min(9999, Math.round(+x?.q || 1))) })) : null;
    const profil = p.profil === "pro" || p.profil === "particulier" ? p.profil : null;
    const installateur = ["materiel_seul", "pose_enr", "ne_sait_pas"].includes(p.installateur) ? p.installateur : null;
    const { data: d, error } = await sb.from("demandes").insert({
      type: p.type, sujet: txt(p.sujet, 200), pour_quand: pourQuand, priorite,
      score: Number.isFinite(+p.score) ? Math.max(0, Math.min(100, Math.round(+p.score))) : null,
      contact, reponses: borne(p.reponses), panier,
      message: txt(p.message, 4000), page: txt(p.page, 200), utm: borne(p.utm, 10),
      profil, installateur, livraison: borne(p.livraison, 10),
    }).select("id").single();
    if (error) throw error;

    let compte: Record<string, any> | null = null;
    if (p.type === "compte-pro") {
      let chemin: string | null = null;
      if (fichier) {
        if (fichier.size > 8 * 1024 * 1024) return rep({ erreur: "Kbis trop lourd (8 Mo maximum)" }, 413);
        const ext = KBIS_TYPES[fichier.type];
        if (!ext) return rep({ erreur: "Format de Kbis non accepté (PDF ou photo)" }, 415);
        chemin = `${new Date().toISOString().slice(0, 10)}/${d.id}.${ext}`;
        const up = await sb.storage.from("kbis").upload(chemin, fichier, { contentType: fichier.type });
        if (up.error) { console.error(up.error); chemin = null; }
      }
      const ins = await sb.from("comptes_pro").insert({
        demande_id: d.id, siren: String(contact.siren || "").replace(/\D/g, "").slice(0, 14), entreprise: contact.entreprise,
        nom: contact.nom, email: String(contact.email || "").toLowerCase(), telephone: contact.telephone, metier: contact.metier,
        verification: borne(p.verification), kbis_path: chemin,
      }).select("id").single();
      if (ins.error) throw ins.error;
      compte = { id: ins.data.id, kbis: !!chemin };
    }

    // Après la réponse : brouillon de devis (demandes de devis, ou toute demande avec des produits), puis alerte
    const aChiffrer = p.type === "devis" || (panier && panier.length > 0 && p.type !== "compte-pro");
    const suite = (async () => {
      let brouillon: Record<string, any> | null = null;
      if (aChiffrer) { try { brouillon = await genererBrouillon(sb, d.id); } catch (e) { console.error("brouillon", e); } }
      if (!avalanche) await alerter({ type: p.type, sujet: p.sujet, priorite, pourQuand, contact, message: p.message, panier, reponses: borne(p.reponses), compte, id: d.id, brouillon });
    })();
    await enFond(suite);
    return rep({ ok: true, id: d.id, kbis: compte ? compte.kbis : undefined });
  } catch (e) {
    console.error(e);
    return rep({ erreur: "Erreur serveur" }, 500);
  }
});
