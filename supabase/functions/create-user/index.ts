import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Faltan variables de entorno en Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      email,
      full_name,
      jurisdiccion,
      institucion,
      cargo,
      telefono,
      role
    } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Falta el correo electrónico." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: createdUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: "12345678",
        email_confirm: true,
        user_metadata: {
          full_name,
          role: role || "user"
        }
      });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = createdUser.user.id;

    const { error: contactError } = await supabaseAdmin
      .from("contacts")
      .upsert({
        id: userId,
        email,
        full_name,
        jurisdiccion,
        institucion,
        cargo,
        telefono,
        role: role || "user"
      });

    if (contactError) {
      return new Response(
        JSON.stringify({ error: contactError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Usuario creado correctamente.",
        user: createdUser.user
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Error interno en la función." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
