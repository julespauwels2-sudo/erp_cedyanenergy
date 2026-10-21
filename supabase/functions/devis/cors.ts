// CORS : seules les pages du site Cedyan Energy peuvent appeler ces fonctions depuis un navigateur.
const AUTORISES = new Set([
  "https://site-ceydanenergy.vercel.app",
  "https://cedyan-energy.net",
  "https://www.cedyan-energy.net",
  "https://cedyanenergytrade.com",
  "https://www.cedyanenergytrade.com",
]);
export function cors(req: Request) {
  const site = (Deno.env.get("SITE_URL") || "").replace(/\/$/, "");
  const origine = req.headers.get("origin") || "";
  const ok = AUTORISES.has(origine) || (site && origine === site);
  return {
    "Access-Control-Allow-Origin": ok ? origine : "https://site-ceydanenergy.vercel.app",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
