import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const env = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", present: !!process.env.NEXT_PUBLIC_SUPABASE_URL },
    { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", present: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    { name: "SUPABASE_SERVICE_ROLE_KEY", present: !!process.env.SUPABASE_SERVICE_ROLE_KEY },
    { name: "ANTHROPIC_API_KEY", present: !!process.env.ANTHROPIC_API_KEY },
    { name: "OPENAI_API_KEY", present: !!process.env.OPENAI_API_KEY },
    { name: "STRIPE_SECRET_KEY", present: !!process.env.STRIPE_SECRET_KEY },
    { name: "NEXT_PUBLIC_APP_URL", present: !!process.env.NEXT_PUBLIC_APP_URL },
  ];

  const tests: { name: string; status: string; message: string }[] = [];

  // Test Supabase connection
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("listings").select("id", { count: "exact", head: true });
    if (error) {
      tests.push({ name: "Supabase", status: "error", message: error.message });
    } else {
      tests.push({ name: "Supabase", status: "ok", message: "Connesso" });
    }
  } catch (err) {
    tests.push({
      name: "Supabase",
      status: "error",
      message: err instanceof Error ? err.message : "Connessione fallita",
    });
  }

  // Test Anthropic API
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await client.messages.create({
        model: "claude-sonnet-4-5-20251022",
        max_tokens: 5,
        messages: [{ role: "user", content: "Rispondi solo: ok" }],
      });
      const text = response.content[0].type === "text" ? response.content[0].text : "";
      tests.push({ name: "Anthropic API", status: "ok", message: `Risposta: "${text.trim()}"` });
    } catch (err) {
      tests.push({
        name: "Anthropic API",
        status: "error",
        message: err instanceof Error ? err.message : "Test fallito",
      });
    }
  } else {
    tests.push({ name: "Anthropic API", status: "error", message: "API key mancante" });
  }

  // Test OpenAI embeddings
  if (process.env.OPENAI_API_KEY) {
    try {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: "test",
        dimensions: 1536,
      });
      tests.push({
        name: "OpenAI Embeddings",
        status: "ok",
        message: `Vettore: ${response.data[0].embedding.length} dimensioni`,
      });
    } catch (err) {
      tests.push({
        name: "OpenAI Embeddings",
        status: "error",
        message: err instanceof Error ? err.message : "Test fallito",
      });
    }
  } else {
    tests.push({ name: "OpenAI Embeddings", status: "error", message: "API key mancante" });
  }

  // DB stats
  let stats = { listings: 0, users: 0 };
  try {
    const supabase = createAdminClient();
    const { count: listingsCount } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true });
    const { count: usersCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    stats = {
      listings: listingsCount ?? 0,
      users: usersCount ?? 0,
    };
  } catch {
    // ignore
  }

  return NextResponse.json({ env, tests, stats });
}
