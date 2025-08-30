export function haversineKm(a:{lat:number,lng:number}, b:{lat:number,lng:number}) {
  const toRad=(x:number)=>x*Math.PI/180;
  const R=6371,dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng);
  const s=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}