export function bayes(mean=0,n=0,mu0=4.6,m0=10){ if(!n) return mu0; return (mu0*m0+mean*n)/(m0+n); }
export function reliability(on=0.9,comp=0.95,dispute=0.02){ const r=0.4*on+0.4*comp-0.2*dispute; return Math.max(0,Math.min(1,r)); }
export function repScore(mean:number,n:number,on:number,comp:number,dispute:number){ const r=bayes(mean,n); const rel=reliability(on,comp,dispute); return 0.6*((r-3)/2)+0.4*rel; }
export function cancelProb(cancelRate=0.05, rep=0.7){ return Math.max(0.02,0.30*cancelRate+0.10*(1-rep)); }