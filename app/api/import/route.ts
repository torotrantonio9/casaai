import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, source_url, csv_data, schedule } = body;

    if (!source) {
      return NextResponse.json(
        { error: "source è obbligatorio" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Create import job
    const { data: job, error } = await supabase
      .from("import_jobs")
      .insert({
        source,
        source_url: source_url ?? null,
        schedule: schedule ?? null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // In production, this would enqueue a BullMQ job
    // For now, we process inline (simplified)
    const jobId = job.id;

    // Fire-and-forget: start processing
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    if (source === "csv" && csv_data) {
      // Process CSV asynchronously
      fetch(`${baseUrl}/api/import/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process_csv", csv_data }),
      }).catch(() => {});
    } else if (source_url) {
      // Process URL scrape asynchronously
      fetch(`${baseUrl}/api/import/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process_url", source, source_url }),
      }).catch(() => {});
    }

    return NextResponse.json({
      job_id: jobId,
      status: "pending",
      estimated_duration_minutes: source === "csv" ? 1 : 5,
    });
  } catch {
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
