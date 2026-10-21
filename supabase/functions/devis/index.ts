// Actions de l'équipe sur les devis (connexion obligatoire, réservé au staff).
// action "generer" : (re)prépare le brouillon d'une demande à partir du catalogue et de la grille.
import { createClient } from "npm:@supabase/supabase-js@2";
import { cors } from "./cors.ts";
import { genererBrouillon } from "./brouillon.ts";

Deno.serve(async (req) => {
  const CORS = cors(req);
  const rep = (corps: unknown, statut = 200) => new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return rep({ erreur: "Méthode non autorisée" }, 405);
  try {
    const auth = req.headers.get("authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const utilisateur = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: equipe } = await utilisateur.from("staff").select("email").limit(1);
    if (!equipe || !equipe.length) return rep({ erreur: "Réservé à l'équipe Cedyan" }, 403);
    const p = await req.json().catch(() => ({}));
    const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (p.action === "generer" && p.demande_id) return rep(await genererBrouillon(sb, String(p.demande_id), { forcer: !!p.forcer }));
    return rep({ erreur: "Action inconnue" }, 400);
  } catch (e) {
    console.error(e);
    return rep({ erreur: String((e as Error).message || e) }, 500);
  }
});
