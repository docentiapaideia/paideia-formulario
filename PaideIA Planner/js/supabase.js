// =======================================================
// PAIDEIA PLANNER - CONEXIÓN SUPABASE
// =======================================================

// Reemplazar estos datos por los de tu proyecto Supabase
const SUPABASE_URL = "https://mhwcnlkrwylloyxpmmqu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1od2NubGtyd3lsbG95eHBtbXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDU0MDIsImV4cCI6MjA5MjUyMTQwMn0.gKVGu5aLGQFp2g_GyC-9n-h9pdNULcenw50DsGm6qaU";

// Cliente Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("Conexión Supabase preparada.");