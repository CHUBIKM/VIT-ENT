const JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const BODY = [11, 12, 23, 24, 25, 26, 27, 28];
const ANGLES = { leftElbow: [11, 13, 15], rightElbow: [12, 14, 16], leftKnee: [23, 25, 27], rightKnee: [24, 26, 28] };
const usable = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 0) >= 0.5;
export function angle(a, b, c, aspect = 1) {
  if (![a, b, c].every(usable)) return null;
  const ax = (a.x-b.x)*aspect, ay = a.y-b.y, cx = (c.x-b.x)*aspect, cy = c.y-b.y;
  const magnitude = Math.hypot(ax,ay)*Math.hypot(cx,cy);
  return magnitude > 1e-8 ? Math.acos(Math.max(-1, Math.min(1,(ax*cx+ay*cy)/magnitude)))*180/Math.PI : null;
}
export function measurePose(points, aspect = 1) {
  if (!points?.length) return { detected: false, fullBody: false, visibility: 0, angles: {} };
  return { detected: true, fullBody: BODY.every(i=>usable(points[i])),
    visibility: JOINTS.reduce((sum,i)=>sum+(points[i]?.visibility??0),0)/JOINTS.length,
    angles: Object.fromEntries(Object.entries(ANGLES).map(([key,ids])=>[key,angle(...ids.map(i=>points[i]),aspect)])) };
}
export class LocalSession {
  constructor(source, now = new Date()) {
    this.id = globalThis.crypto.randomUUID(); this.source = source; this.startedAt = now.toISOString();
    this.endedAt = null; this.samples = 0; this.detected = 0; this.fullBody = 0; this.visibilitySum = 0;
    this.elapsedMs = 0; this.angles = {}; this.differences = 0; this.lastCueAt = -Infinity; this.observations = [];
  }
  add(measurement, elapsedMs) {
    this.elapsedMs = Math.max(this.elapsedMs,elapsedMs); this.samples++;
    this.detected += Number(measurement.detected); this.fullBody += Number(measurement.fullBody);
    this.visibilitySum += measurement.visibility;
    for(const [key,value] of Object.entries(measurement.angles)) if(Number.isFinite(value)) {
      const a=this.angles[key]??{sum:0,count:0,min:180,max:0};
      a.sum+=value;a.count++;a.min=Math.min(a.min,value);a.max=Math.max(a.max,value);this.angles[key]=a;
    }
    if (measurement.fullBody && ['Elbow','Knee'].some(j=>{
      const l=measurement.angles['left'+j],r=measurement.angles['right'+j];
      return Number.isFinite(l)&&Number.isFinite(r)&&Math.abs(l-r)>50;
    })) {
      this.differences++;
      if(elapsedMs-this.lastCueAt>=3000) {
        this.lastCueAt=elapsedMs;
        this.observations.unshift({atMs:Math.round(elapsedMs),text:'Large left–right angle difference. This may be intentional or caused by the camera view.'});
        this.observations=this.observations.slice(0,20);
      }
    }
  }
  finish() {this.endedAt=new Date().toISOString();}
  summary() {
    return {schemaVersion:'static-1',id:this.id,source:this.source,startedAt:this.startedAt,endedAt:this.endedAt,
      durationSeconds:Math.round(this.elapsedMs/1000),samples:this.samples,
      detectedRate:this.samples?this.detected/this.samples:0,fullBodyRate:this.samples?this.fullBody/this.samples:0,
      meanVisibility:this.samples?this.visibilitySum/this.samples:0,
      angles:Object.fromEntries(Object.entries(this.angles).map(([k,v])=>[k,{mean:Math.round(v.sum/v.count),min:Math.round(v.min),max:Math.round(v.max)}])),
      angleDifferenceSamples:this.differences,observations:this.observations,
      limitations:'2D camera estimates; visibility is not accuracy. Left–right differences are descriptive, not a validated risk or fatigue assessment.'};
  }
}
