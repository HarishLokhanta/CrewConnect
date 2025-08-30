import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as sb } from '../../../../lib/supabaseAdmin';
import { feasible, pairCost } from '../../../../lib/matcher';

// ---- Types for strong typing (avoid `any`) ----
export type Task = {
  name: string;
  skill: string;
  duration_h: number;
  order_idx: number;
};

export type JobPayload = {
  title?: string;
  lat: number;
  lng: number;
  urgency?: 'scheduled' | 'urgent' | string;
  window_start: string; // ISO
  window_end: string;   // ISO
  budget_max?: number;
  tasks: Task[];
};

export type Worker = {
  user_id: string;
  name: string;
  skills: string[];
  licences: string[];
  rate_hour: number;
  lat: number;
  lng: number;
  radius_km: number;
  transport: string;
  rating_mean: number;
  rating_count: number;
  on_time_rate: number;
  completion_rate: number;
  cancel_rate: number;
  dispute_rate: number;
  hours_last28d: number;
  availability: unknown; // if you have a schema, replace with a proper type
};

export async function POST(req: NextRequest) {
  try {
    const job = (await req.json()) as JobPayload;

    // Fetch workers with explicit return type
    const { data: workers, error } = await sb
      .from('workers')
      .select(
        [
          'user_id',
          'name',
          'skills',
          'licences',
          'rate_hour',
          'lat',
          'lng',
          'radius_km',
          'transport',
          'rating_mean',
          'rating_count',
          'on_time_rate',
          'completion_rate',
          'cancel_rate',
          'dispute_rate',
          'hours_last28d',
          'availability',
        ].join(', ')
      )
      .returns<Worker[]>();

    if (error) return NextResponse.json({ error }, { status: 500 });

    const site = { lat: Number(job.lat), lng: Number(job.lng) };
    const tasks: Task[] = [...job.tasks].sort((a, b) => a.order_idx - b.order_idx);

    const picks: Record<string, Worker> = {};
    const backups: Record<string, Worker[]> = {};
    const reasons: Record<string, Array<{ worker: string; cost: number; rate: number }>> = {};

    for (const t of tasks) {
      const feas = (workers || []).filter((w) => feasible(w, t, job, site));
      if (!feas.length) return NextResponse.json({ status: 'no_match', task: t.name });

      const scored = feas
        .map((w) => ({ w, cost: pairCost(w, t, job, site) }))
        .sort((a, b) => a.cost - b.cost);

      picks[t.name] = scored[0].w;
      backups[t.name] = scored.slice(1, 4).map((s) => s.w);
      reasons[t.name] = scored.slice(0, 4).map((s) => ({
        worker: s.w.name,
        cost: +s.cost.toFixed(2),
        rate: s.w.rate_hour,
      }));
    }

    // Insert job and tasks; type Supabase returns
    const { data: jobRow, error: jErr } = await sb
      .from('jobs')
      .insert({
        title: job.title || 'Job',
        lat: job.lat,
        lng: job.lng,
        urgency: job.urgency || 'scheduled',
        window_start: job.window_start,
        window_end: job.window_end,
        budget_max: job.budget_max || 10000,
      })
      .select('id')
      .single()
      .returns<{ id: number }>();

    if (jErr || !jobRow) return NextResponse.json({ error: jErr || 'job_insert_failed' }, { status: 500 });

    const { data: insertedTasks, error: tErr } = await sb
      .from('tasks')
      .insert(
        tasks.map((t) => ({
          job_id: jobRow.id,
          name: t.name,
          skill: t.skill,
          duration_h: t.duration_h,
          order_idx: t.order_idx,
        }))
      )
      .select('id,name')
      .returns<Array<{ id: number; name: string }>>();

    if (tErr || !insertedTasks) return NextResponse.json({ error: tErr || 'task_insert_failed' }, { status: 500 });

    const nameToId: Record<string, number> = Object.fromEntries(
      insertedTasks.map((r) => [r.name, r.id])
    );

    const offersPayload: Array<{ job_id: number; task_id: number; worker_id: string }> = tasks.map((t) => ({
      job_id: jobRow.id,
      task_id: nameToId[t.name],
      worker_id: picks[t.name].user_id,
    }));

    const { error: oErr } = await sb.from('offers').insert(offersPayload);
    if (oErr) return NextResponse.json({ error: oErr }, { status: 500 });

    return NextResponse.json({ status: 'ok', job_id: jobRow.id, picks, backups, reasons });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}