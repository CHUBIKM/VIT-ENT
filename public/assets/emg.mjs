// Colors describe device-value ranges, not physiological risk.
export function signalColor(value){
 return value<0?'#738078':value<100?'#23834b':value<=1000?'#b58200':'#d3423f';
}
export function signalSegments(start,end){
 const cuts=[0,1];
 if(start!==end)for(const threshold of [0,100,1000]){
  const t=(threshold-start)/(end-start);if(t>0&&t<1)cuts.push(t);
 }
 cuts.sort((a,b)=>a-b);
 return cuts.slice(1).map((to,i)=>({from:cuts[i],to,color:signalColor(start+(end-start)*(cuts[i]+to)/2)}));
}
// CH1 text protocol from the legacy dashboard, with strict numeric framing.
const NUMBER='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
export function parseCh1(line){
 const raw=String(line).trim();
 const labeled=raw.match(new RegExp('(?:^|[\\s,;])(?:ch1|channel\\s*1)\\s*[:=]\\s*('+NUMBER+')(?=$|[\\s,;])','i'));
 const csv=new RegExp('^'+NUMBER+'(?:\\s*,\\s*'+NUMBER+')*$');
 const value=labeled?Number(labeled[1]):csv.test(raw)?Number(raw.split(',')[0]):NaN;
 return Number.isFinite(value)?value:null;
}
export class EmgLines{
 constructor(){this.buffer='';this.overflow=false;}
 feed(text){
  const result=[];
  for(const char of text){
   if(char==='\r'||char==='\n'){
    if(this.overflow)result.push({raw:'[Oversized line discarded]',value:null});
    else if(this.buffer.trim())result.push({raw:this.buffer.trim(),value:parseCh1(this.buffer)});
    this.buffer='';this.overflow=false;
   }else if(!this.overflow){this.buffer+=char;if(this.buffer.length>4096){this.buffer='';this.overflow=true;}}
  }
  return result;
 }
}
export class EmgSamples{
 constructor(){this.clear();}
 clear(){this.points=[];this.filtered=null;this.count=0;this.invalid=0;}
 add(value,at=Date.now()){
  if(!Number.isFinite(value))return;
  this.filtered=this.filtered===null?value:this.filtered+Math.max(-240,Math.min(240,value-this.filtered))*0.22;
  this.points.push({at,raw:value,filtered:this.filtered});if(this.points.length>512)this.points.shift();this.count++;
 }
}
export function mountEmg(){
 const $=id=>document.getElementById(id),samples=new EmgSamples();
 let parser=new EmgLines(),port=null,reader=null,readTask=null,mode='idle',timer=null,epoch=0,frame=0,lastAt=0,dataSource='none';
 const supported=Boolean(navigator.serial&&window.isSecureContext);
 const canvas=$('emgCanvas'),ctx=canvas.getContext('2d');
 function status(text){$('emgStatus').textContent=text;}
 function controls(){
  const busy=mode!=='idle';$('emgConnect').disabled=busy||!supported;$('emgDemo').disabled=busy;
  $('emgBaud').disabled=busy;$('emgStop').disabled=!['serial','demo'].includes(mode);
  $('emgParse').disabled=busy;$('emgClear').disabled=busy;
  $('emgSource').textContent={idle:({simulated:'SIMULATED · STOPPED',serial:'SERIAL · STOPPED',pasted:'PASTED DATA'}[dataSource]||'NO ACTIVE INPUT'),serial:'LIVE SERIAL',demo:'SIMULATED DATA',connecting:'SELECTING DEVICE',closing:'DISCONNECTING'}[mode];
 }
 function draw(){
  frame=0;const width=canvas.clientWidth||600,height=280,dpr=devicePixelRatio||1;
  canvas.width=width*dpr;canvas.height=height*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,height);
  const points=samples.points,pad=45,right=width-16,top=20,bottom=height-30;
  const all=points.flatMap(p=>[p.raw,p.filtered]);let min=all.length?Math.min(...all):0,max=all.length?Math.max(...all):1;
  const margin=Math.max((max-min)*.1,1);min-=margin;max+=margin;
  ctx.font='10px system-ui';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const y=top+(bottom-top)*i/4;ctx.strokeStyle='#e4e9e0';ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillStyle='#738078';ctx.fillText((max-(max-min)*i/4).toFixed(0),2,y+3);}
  const x=i=>pad+(right-pad)*i/Math.max(1,points.length-1);
  const y=value=>bottom-(value-min)/(max-min)*(bottom-top);
  // Keep the smoothing reference subdued; the raw signal carries the range colors.
  ctx.strokeStyle='#738078';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();
  points.forEach((p,i)=>{i?ctx.lineTo(x(i),y(p.filtered)):ctx.moveTo(x(i),y(p.filtered));});ctx.stroke();ctx.setLineDash([]);
  ctx.lineWidth=2.5;
  for(let i=1;i<points.length;i++){
   const a=points[i-1].raw,b=points[i].raw;
   for(const segment of signalSegments(a,b)){
    ctx.strokeStyle=segment.color;ctx.beginPath();
    ctx.moveTo(x(i-1+segment.from),y(a+(b-a)*segment.from));
    ctx.lineTo(x(i-1+segment.to),y(a+(b-a)*segment.to));ctx.stroke();
   }
  }
  if(points.length===1){ctx.fillStyle=signalColor(points[0].raw);ctx.beginPath();ctx.arc(x(0),y(points[0].raw),3,0,Math.PI*2);ctx.fill();}
  $('emgRaw').style.color=points.length?signalColor(points.at(-1).raw):'';
  if(!points.length){ctx.fillStyle='#738078';ctx.textAlign='center';ctx.fillText('Connect a device, start a demo, or paste samples below.',width/2,height/2);ctx.textAlign='left';}
  $('emgRaw').textContent=points.length?String(points.at(-1).raw):'—';$('emgCount').textContent=String(samples.count);
  $('emgInvalid').textContent=String(samples.invalid);$('emgExport').disabled=!points.length;
 }
 function update(){if(!frame)frame=requestAnimationFrame(draw);}
 function accept(text){
  const lines=parser.feed(text);
  for(const line of lines){if(line.value===null)samples.invalid++;else{samples.add(line.value);lastAt=Date.now();}}
  if(lines.length){$('emgLog').textContent=lines.slice(-5).map(l=>(l.value===null?'Ignored: ':'CH1 '+l.value+' ← ')+l.raw.slice(0,140)).join('\n');update();}
 }
 function reset(){samples.clear();parser=new EmgLines();lastAt=0;dataSource='none';$('emgLog').textContent='No incoming data.';update();}
 async function readLoop(active){
  const decoder=new TextDecoder();
  try{
   reader=active.readable.getReader();
   while(mode==='serial'){
    const {value,done}=await reader.read();if(done)break;
    if(mode==='serial')accept(decoder.decode(value,{stream:true}));
   }
   if(mode==='serial')status('Device stream ended. Buffered partial line discarded.');
  }catch{status('Serial connection lost or read failed. Reconnect to retry.');}
  finally{
   reader?.releaseLock();reader=null;
   try{await active.close();}catch{/* Device may already be unplugged. */}
   if(port===active)port=null;parser=new EmgLines();mode='idle';controls();
  }
 }
 async function stop(){
  epoch++;if(timer){clearInterval(timer);timer=null;}
  if(mode==='serial'){mode='closing';controls();await reader?.cancel().catch(()=>{});await readTask;}
  else if(mode!=='connecting'){mode='idle';controls();}
  status('Input stopped. The last received samples remain available.');
 }
 $('emgConnect').addEventListener('click',async()=>{
  if(mode!=='idle')return;mode='connecting';controls();const token=++epoch;let selected;
  try{
   selected=await navigator.serial.requestPort();if(token!==epoch)return;
   await selected.open({baudRate:Number($('emgBaud').value),dataBits:8,stopBits:1,parity:'none',flowControl:'none'});
   if(token!==epoch){await selected.close();return;}
   port=selected;reset();dataSource='serial';mode='serial';controls();status('Connected. Waiting for newline-terminated CH1 samples…');readTask=readLoop(selected);
  }catch(error){status(error.name==='NotFoundError'?'Device selection cancelled.':'Unable to open the port. Check the device, baud rate, driver and other apps using it.');mode='idle';controls();}
  finally{if(mode==='connecting'){mode='idle';controls();}}
 });
 $('emgStop').addEventListener('click',stop);
 $('emgDemo').addEventListener('click',()=>{
  if(mode!=='idle')return;reset();dataSource='simulated';mode='demo';controls();let tick=0,drift=0,amplitude=1000;status('Synthetic demo only — not a measurement from a sensor.');
  timer=setInterval(()=>{
   tick++;
   drift=drift*.97+(Math.random()-.5)*50;
   amplitude+=(850+Math.random()*300-amplitude)*.08;
   const noise=(Math.random()+Math.random()+Math.random()-1.5)*220;
   const value=1800+drift+amplitude*Math.sin(tick*.13)+180*Math.sin(tick*1.1)+noise;
   accept(`CH1:${Math.round(value)}\n`);
  },40);
 });
 $('emgParse').addEventListener('click',()=>{
  if(mode!=='idle')return;reset();dataSource='pasted';accept($('emgText').value+'\n');$('emgSource').textContent='PASTED DATA';status('Parsed pasted text locally. No device connection.');
 });
 $('emgClear').addEventListener('click',()=>{reset();$('emgSource').textContent='NO ACTIVE INPUT';status('Samples cleared.');});
 $('emgExport').addEventListener('click',()=>{
  const content='source,received_at_ms,ch1_raw,ch1_display_filtered\n'+samples.points.map(p=>`${dataSource},${p.at},${p.raw},${p.filtered}`).join('\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv'})),a=document.createElement('a');a.href=url;
  a.download=dataSource==='simulated'?'emg-simulated.csv':'emg-samples.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 const staleTimer=setInterval(()=>{if(mode==='serial'&&lastAt&&Date.now()-lastAt>2000)status('Connected, but no valid CH1 sample in the last 2 seconds.');else if(mode==='serial'&&lastAt)status('Receiving CH1 data locally.');},1000);
 const observer=new ResizeObserver(update);observer.observe(canvas);
 window.addEventListener('pagehide',()=>{stop();clearInterval(staleTimer);cancelAnimationFrame(frame);observer.disconnect();});
 controls();draw();if(!supported)status('Web Serial is unavailable here. Use desktop Chrome/Edge over HTTPS, or try pasted data and the demo.');
}
