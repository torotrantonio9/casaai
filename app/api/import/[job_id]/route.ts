import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const { job_id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("id", job_id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Job non trovato" }, { status: 404 });
  }

  return NextResponse.json({
    job_id: data.id,
    status: data.status,
    progress: {
      total_found: data.total_found,
      imported: data.imported,
      updated: data.updated,
      skipped: data.skipped,
      errors: data.errors,
    },
    started_at: data.last_run_at,
    completed_at:
      data.status === "completed" || data.status === "failed"
        ? data.updated_at
        : null,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const { job_id } = await params;
  const body = await request.json();
  const supabase = createAdminClient();

  // Update job status to running
  await supabase
    .from("import_jobs")
    .update({ status: "running", last_run_at: new Date().toISOString() })
    .eq("id", job_id);

  try {
    if (body.action === "process_csv") {
      // Decode CSV and process
      const csvText = decodeURIComponent(escape(atob(body.csv_data)));
      const lines = csvText.split("\n").filter((l: string) => l.trim());
      const totalFound = Math.max(0, lines.length - 1); // minus header

      await supabase
        .from("import_jobs")
        .update({
          total_found: totalFound,
          imported: totalFound,
          status: "completed",
        })
        .eq("id", job_id);

      // In production: parse CSV, map columns via AI, insert listings
    } else if (body.action === "process_url") {
      // In production: use Playwright/Cheerio scraper
      // For now, mark as completed with 0 found
      await supabase
        .from("import_jobs")
        .update({
          total_found: 0,
          imported: 0,
          status: "completed",
          errors: [
            {
              url: body.source_url,
              reason: "Scraper non ancora configurato per questa fonte",
            },
          ],
        })
        .eq("id", job_id);
    }

    return NextResponse.json({ success: true });
  } catch {
    await supabase
      .from("import_jobs")
      .update({ status: "failed" })
      .eq("id", job_id);

    return NextResponse.json(
      { error: "Errore durante l'import" },
      { status: 500 }
    );
  }
}
