import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo non consentito." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Configurazione server incompleta." }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sessione non valida." }, 401);

  const callerClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
  if (callerError || !callerData.user) return json({ error: "Sessione non valida." }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: callerProfile, error: profileError } = await admin.from("pt_profiles").select("id,role").eq("id", callerData.user.id).maybeSingle();
  if (profileError || callerProfile?.role !== "admin") return json({ error: "Operazione riservata all'amministratore." }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Richiesta non valida." }, 400); }

  if (body.action === "create") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const displayName = String(body.display_name ?? "").trim();
    const height = body.height_cm === "" || body.height_cm == null ? null : Number(body.height_cm);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || displayName.length < 2 || displayName.length > 100) {
      return json({ error: "Inserisci un nome valido e un indirizzo email corretto." }, 400);
    }
    if (height !== null && (!Number.isFinite(height) || height < 50 || height > 250)) return json({ error: "L'altezza deve essere compresa tra 50 e 250 cm." }, 400);
    const origin = req.headers.get("origin") ?? "https://anestesia-o9y7pd03b-giov3452s-projects.vercel.app";
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName, personal_trainer_hub: true },
      redirectTo: `${origin}/personal-trainer/auth/callback`,
    });
    if (inviteError || !invited.user) return json({ error: inviteError?.message ?? "Impossibile inviare l'invito." }, 400);

    const { error: insertProfileError } = await admin.from("pt_profiles").insert({
      id: invited.user.id, email, display_name: displayName, role: "pt", height_cm: height,
    });
    if (insertProfileError) {
      await admin.auth.admin.deleteUser(invited.user.id);
      return json({ error: "Non è stato possibile creare il profilo PT. " + insertProfileError.message }, 500);
    }
    const { error: relationshipError } = await admin.from("pt_relationships").insert({
      admin_id: callerData.user.id, trainer_id: invited.user.id, status: "active",
    });
    if (relationshipError) {
      await admin.from("pt_profiles").delete().eq("id", invited.user.id);
      await admin.auth.admin.deleteUser(invited.user.id);
      return json({ error: "Non è stato possibile collegare il PT. " + relationshipError.message }, 500);
    }
    return json({ ok: true, message: "Invito inviato. Il PT dovrà aprire l'email e impostare la propria password." });
  }

  if (body.action === "set_status") {
    const trainerId = String(body.trainer_id ?? "");
    const status = body.status === "active" ? "active" : body.status === "disabled" ? "disabled" : null;
    if (!trainerId || !status) return json({ error: "Dati non validi." }, 400);
    const { data: relationship, error: relationshipError } = await admin.from("pt_relationships")
      .update({ status }).eq("admin_id", callerData.user.id).eq("trainer_id", trainerId)
      .select("id").maybeSingle();
    if (relationshipError || !relationship) return json({ error: "Associazione PT non trovata." }, 404);
    return json({ ok: true, status });
  }

  return json({ error: "Azione non riconosciuta." }, 400);
});
