import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as sb } from '../../../../lib/supabaseAdmin';
import { feasible, pairCost } from '@/src/lib/matcher';

export async function POST(req: NextRequest){
  const job = await req.json();
  const { data: workers, error } = await sb
    .from('workers')
    .select('user_id, name, skills, licences, rate_hour, lat, lng, radius_km, transport, rating_mean, rating_count, on_time_rate, completion_rate, cancel_rate, dispute_rate, hours_last28d, availability');
  if(error) return NextResponse.json({error}, {status:500});

  const site={lat:Number(job.lat), lng:Number(job.lng)};
  const tasks=[...job.tasks].sort((a:any,b:any)=>a.order_idx-b.order_idx);

  const picks:any={}, backups:any={}, reasons:any={};
  for(const t of tasks){
    const feas=(workers||[]).filter(w=>feasible(w,t,job,site));
    if(!feas.length) return NextResponse.json({status:'no_match', task:t.name});
    const scored=feas.map(w=>({w, cost:pairCost(w,t,job,site)})).sort((a,b)=>a.cost-b.cost);
    picks[t.name]=scored[0].w;
    backups[t.name]=scored.slice(1,4).map(s=>s.w);
    reasons[t.name]=scored.slice(0,4).map(s=>({worker:s.w.name, cost:+s.cost.toFixed(2), rate:s.w.rate_hour}));
  }

  const { data: jobRow, error: jErr } = await sb.from('jobs').insert({
    title: job.title||'Job',
    lat: job.lat, lng: job.lng,
    urgency: job.urgency||'scheduled',
    window_start: job.window_start, window_end: job.window_end,
    budget_max: job.budget_max||10000
  }).select('id').single();
  if(jErr) return NextResponse.json({jErr}, {status:500});

  const insertedTasks = await sb.from('tasks').insert(
    tasks.map((t:any)=>({ job_id: jobRow.id, name:t.name, skill:t.skill, duration_h:t.duration_h, order_idx:t.order_idx }))
  ).select('id,name').then(r=>r.data||[]);

  const nameToId = Object.fromEntries(insertedTasks.map((r:any)=>[r.name,r.id]));
  const offersPayload = tasks.map((t:any)=>({ job_id: jobRow.id, task_id: nameToId[t.name], worker_id: picks[t.name].user_id }));
  await sb.from('offers').insert(offersPayload);

  return NextResponse.json({status:'ok', job_id:jobRow.id, picks, backups, reasons});
}