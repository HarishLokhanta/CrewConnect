import { haversineKm } from './geo';
import { repScore, cancelProb } from './reputation';

export function weights(urgency:'immediate'|'scheduled'|'flex'){
  if(urgency==='immediate') return {lambda:0.5,gamma:0.2,rho:6,mu:1.0,nu:3};
  if(urgency==='scheduled') return {lambda:0.25,gamma:0.1,rho:4.5,mu:1.0,nu:4};
  return {lambda:0.15,gamma:0.0,rho:4,mu:1.2,nu:4};
}

export function pairCost(w:any,t:any,job:any,site:{lat:number,lng:number}){
  const h=Number(t.duration_h||0);
  const k=weights(job.urgency);
  const km=haversineKm({lat:w.lat,lng:w.lng},site);
  const v=w.transport==='walk'?4:w.transport==='car'?28:18;
  const eta=(km/v)*60;
  const late=Math.max(0,eta-15)*0.5;
  const rep=repScore(w.rating_mean,w.rating_count,w.on_time_rate,w.completion_rate,w.dispute_rate);
  const p=cancelProb(w.cancel_rate,rep);
  const fairness=Math.max(0,(w.hours_last28d||0)-60);
  return w.rate_hour*h + k.lambda*km + k.gamma*late + k.rho*p*h + k.mu*fairness - k.nu*rep*h;
}

export function feasible(w:any,t:any,job:any,site:{lat:number,lng:number}){
  if(!(w.skills||[]).includes(t.skill)) return false;
  if(t.skill==='plumber' && !(w.licences||[]).includes('plumbing_lic')) return false;
  if(t.skill==='electrician' && !(w.licences||[]).includes('electrical_lic')) return false;
  if(t.skill==='waterproof' && !(w.licences||[]).includes('waterproof_cert')) return false;
  const d=haversineKm({lat:w.lat,lng:w.lng},site);
  if(d>Math.min(w.radius_km||8,15)) return false;
  if(job.urgency==='immediate'){ const v=w.transport==='walk'?4:w.transport==='car'?28:18; if((d/v)*60>15) return false; }
  return true;
}