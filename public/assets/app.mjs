import { mountEmg } from './emg.mjs';
import { LocalSession, measurePose } from './pose.mjs';
import { chat, credentials, endpointUrl } from './ai.mjs';
const $=id=>document.getElementById(id);
const percent=n=>Math.round(n*100)+'%';
const time=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const labels={leftElbow:'Left elbow',rightElbow:'Right elbow',leftKnee:'Left knee',rightKnee:'Right knee'};
let session=null, model=null, modelPromise=null, drawing=null, visionModule=null;
let stream=null,objectURL=null,frameId=0,running=false,starting=false,generation=0;
let source='camera',started=0,lastVideoTime=-1,lastSampleTime=-Infinity;
let aiController=null,aiBusy=false;const history=[];
const video=$('poseVideo'),canvas=$('poseCanvas'),ctx=canvas.getContext('2d');
function setStatus(message,error=false){$('poseStatus').textContent=message;$('poseStatus').classList.toggle('error',error);}
function navigate(){
 const view=['studio','summary','assistant','emg'].includes(location.hash.slice(1))?location.hash.slice(1):'studio';
 for(const name of ['studio','summary','assistant','emg']) $(name+'View').hidden=name!==view;
 document.querySelectorAll('[data-view]').forEach(a=>{a.classList.toggle('active',a.dataset.view===view);if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 if(view==='summary')renderSummary();
}
window.addEventListener('hashchange',navigate);navigate();
function controls(){
 $('startCamera').disabled=running||starting;$('uploadVideo').disabled=running||starting;
 $('stopCapture').disabled=!running&&!starting;$('clearSession').disabled=running||starting;
 $('captureBadge').textContent=starting?'PREPARING':running?'ANALYZING LOCALLY':'NOT RECORDING';
}
async function loadModel(){
 if(model)return model;
 if(!modelPromise)modelPromise=(async()=>{
  setStatus('Loading the pose model. This may take a moment on the first visit…');
  visionModule=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
  const vision=await visionModule.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  const options={baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'GPU'},runningMode:'VIDEO',numPoses:1};
  try{model=await visionModule.PoseLandmarker.createFromOptions(vision,options);}
  catch{options.baseOptions.delegate='CPU';model=await visionModule.PoseLandmarker.createFromOptions(vision,options);}
  drawing=new visionModule.DrawingUtils(ctx);return model;
 })().finally(()=>{modelPromise=null;});
 return modelPromise;
}
function stopCapture(message='Session paused. Your summary is ready.',error=false){
 generation++;running=false;starting=false;cancelAnimationFrame(frameId);
 stream?.getTracks().forEach(track=>track.stop());stream=null;
 video.pause();video.srcObject=null;video.removeAttribute('src');video.load();
 if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}
 if(session&&!session.endedAt)session.finish();
 $('videoStage').classList.remove('active');$('cameraPlaceholder').hidden=false;
 ctx.clearRect(0,0,canvas.width,canvas.height);controls();renderSummary();setStatus(message,error);
}
async function startCapture(file){
 if(running||starting)return;
 const token=++generation;starting=true;controls();
 try{
  await loadModel();if(token!==generation)return;
  if(file){
   if(file.type&&!file.type.startsWith('video/'))throw new Error('Choose a video file.');
   source='video';objectURL=URL.createObjectURL(file);video.src=objectURL;
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>finish(new Error('Video load timed out. Try an MP4 or WebM file.')),15000);
    const finish=error=>{clearTimeout(timer);video.removeEventListener('loadedmetadata',ready);video.removeEventListener('error',failed);error?reject(error):resolve();};
    const ready=()=>finish();const failed=()=>finish(new Error('This video cannot be decoded. Try an MP4 or WebM file.'));
    video.addEventListener('loadedmetadata',ready,{once:true});video.addEventListener('error',failed,{once:true});
   });
  }else{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access requires HTTPS or localhost and a supported browser.');
   source='camera';setStatus('Allow camera access to begin.');
   const incoming=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false});
   if(token!==generation){incoming.getTracks().forEach(t=>t.stop());return;}
   stream=incoming;video.srcObject=stream;
  }
  if(token!==generation)return;
  await video.play();if(token!==generation)return;
  session=new LocalSession(source);started=performance.now();lastVideoTime=-1;lastSampleTime=-Infinity;
  starting=false;running=true;$('videoStage').classList.add('active');$('cameraPlaceholder').hidden=true;
  controls();renderMetrics();setStatus(file?'Analyzing your video locally. Nothing is uploaded.':'Camera active. Video is analyzed locally, not recorded.');
  frameId=requestAnimationFrame(predict);
 }catch(error){if(token===generation)stopCapture(error.name==='NotAllowedError'?'Camera permission was not granted. Allow access or open a video.':error.message||'Unable to start analysis. Check model downloads and browser support.',true);}
 finally{if(token===generation){starting=false;controls();}$('videoFile').value='';}
}
function predict(){
 if(!running)return;
 try{
  if(video.readyState>=2 && video.currentTime!==lastVideoTime){
   lastVideoTime=video.currentTime;
   const now=performance.now();
   if(now-lastSampleTime>=100){
    lastSampleTime=now;canvas.width=video.videoWidth||640;canvas.height=video.videoHeight||480;
    const result=model.detectForVideo(video,now),points=result.landmarks?.[0];
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(points){drawing.drawConnectors(points,visionModule.PoseLandmarker.POSE_CONNECTIONS,{color:'#d9f5ab',lineWidth:3});drawing.drawLandmarks(points,{color:'#f9ffe9',radius:3});}
    const measurement=measurePose(points,canvas.width/canvas.height);
    session.add(measurement,source==='video'?video.currentTime*1000:now-started);
    renderMetrics(measurement);
   }
  }
  frameId=requestAnimationFrame(predict);
 }catch{stopCapture('Analysis stopped after a processing error. Your collected summary is still available. Try another video or browser.',true);}
}
function renderMetrics(measurement){
 const data=session?.summary();
 $('sampleMetric').textContent=data?.samples??0;$('elapsed').textContent=time(data?.durationSeconds??0);
 $('fullBodyMetric').replaceChildren(document.createTextNode(data?.samples?percent(data.fullBodyRate):'—'));
 const small=document.createElement('small');small.textContent=data?.samples?'Of analyzed samples':'No samples yet';$('fullBodyMetric').append(small);
 $('visibilityBar').style.width=percent(data?.fullBodyRate??0);$('detectedMetric').textContent=data?.samples?percent(data.detectedRate):'—';
 for(const key of Object.keys(labels))$(key).textContent=Number.isFinite(measurement?.angles[key])?Math.round(measurement.angles[key])+'°':'—';
 if(measurement){
  $('trackingCue').textContent=!measurement.detected?'Step into the picture.':!measurement.fullBody?'A little more room.':'You’re in the picture.';
  $('trackingDetail').textContent=!measurement.detected?'No pose detected. Keep one person in frame with even lighting.':!measurement.fullBody?'Move back until your shoulders, hips, knees and ankles are visible.':'Whole-body landmarks are visible. Move naturally; these are descriptive observations.';
 }
}
function renderSummary(){
 const data=session?.summary(),has=Boolean(data?.samples);
 $('summaryEmpty').hidden=has;$('summaryContent').hidden=!has;if(!has)return;
 $('summaryDuration').textContent=time(data.durationSeconds);$('summaryVisibility').textContent=percent(data.fullBodyRate);$('summarySamples').textContent=data.samples;
 $('summarySource').textContent=data.source==='video'?'LOCAL VIDEO':'CAMERA';
 $('summaryDescription').textContent=`${running?'In progress':'Completed'} · ${new Date(data.startedAt).toLocaleString()} · Pose detected in ${percent(data.detectedRate)} of samples.`;
 $('angleTable').replaceChildren();
 for(const [key,name] of Object.entries(labels)){
  const row=document.createElement('tr'),a=data.angles[key];
  for(const value of [name,a?`${a.mean}°`:'—',a?`${a.min}° – ${a.max}°`:'No visible samples']){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
  $('angleTable').append(row);
 }
 $('observations').replaceChildren();
 const notes=data.observations.length?data.observations.map(n=>`${time(n.atMs/1000)} — ${n.text}`):['No large left–right angle differences were flagged. This does not confirm correct technique.'];
 if(data.fullBodyRate<0.7)notes.unshift('Whole-body visibility was limited. Try a wider view before interpreting joint measurements.');
 for(const note of notes){const li=document.createElement('li');li.textContent=note;$('observations').append(li);}
}
$('startCamera').addEventListener('click',()=>startCapture());
$('uploadVideo').addEventListener('click',()=>$('videoFile').click());
$('videoFile').addEventListener('change',()=>startCapture($('videoFile').files[0]));
$('stopCapture').addEventListener('click',()=>stopCapture());
video.addEventListener('ended',()=>{if(running)stopCapture('Video complete. Your local summary is ready.');});
video.addEventListener('error',()=>{if(running)stopCapture('Video playback failed. Collected observations remain available.',true);});
$('clearSession').addEventListener('click',()=>{if(running||starting)return;session=null;renderSummary();renderMetrics();setStatus('Session cleared. Ready for your next movement.');$('trackingCue').textContent='Give yourself some room.';$('trackingDetail').textContent='Keep shoulders, hips, knees and ankles in frame for a more useful session.';});
$('exportSummary').addEventListener('click',()=>{
 if(!session?.samples)return;
 const blob=new Blob([JSON.stringify(session.summary(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='vit-smart-session.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('explainSummary').addEventListener('click',()=>{location.hash='assistant';$('includeSummary').checked=true;$('chatInput').value='Help me understand this session. Describe what the observations can and cannot tell me, and suggest how to improve the camera setup.';$('chatInput').focus();});
function configuration(){credentials($('apiKey').value,$('apiEndpoint').value,$('model').value);return {key:$('apiKey').value,endpoint:$('apiEndpoint').value,model:$('model').value,maxTokens:Number($('maxTokens').value)};}
function aiControls(busy){aiBusy=busy;$('sendChat').disabled=busy;$('testConnection').disabled=busy;$('cancelChat').hidden=!busy;}
function addMessage(role,text){const div=document.createElement('div');div.className='message '+role;const title=document.createElement('span');title.className='message-author';title.textContent=role==='user'?'YOU':'VIT COMPANION';const p=document.createElement('p');p.textContent=text;div.append(title,p);$('chatLog').append(div);$('chatLog').scrollTop=$('chatLog').scrollHeight;return p;}
$('apiKey').value='';
function clearKey(){aiController?.abort();$('apiKey').value='';$('connectionStatus').textContent='Key cleared. It was not saved.';$('aiBadge').textContent='NOT CONNECTED';}
$('clearKey').addEventListener('click',clearKey);
$('apiEndpoint').addEventListener('input',()=>{
 clearKey();history.length=0;
 try{$('providerHost').textContent='Requests go to: '+new URL(endpointUrl($('apiEndpoint').value)).host;}
 catch{$('providerHost').textContent='Enter an HTTPS API address.';}
 $('connectionStatus').textContent='API address changed. Enter a key for this provider.';
});
for(const id of ['apiKey','model'])$(id).addEventListener('input',()=>{$('aiBadge').textContent='NOT VERIFIED';});
$('cancelChat').addEventListener('click',()=>aiController?.abort());
async function send(test=false){
 if(aiBusy)return;
 let config;try{config=configuration();}catch(error){$('connectionStatus').textContent=error.message;$('apiKey').focus();return;}
 const message=test?'Reply with OK only.':$('chatInput').value.trim();if(!message)return;
 const include=!test&&$('includeSummary').checked;
 if(include&&!session?.samples){$('chatStatus').textContent='No session samples to share. Start a session or uncheck the summary option.';return;}
 const summary=include?session.summary():null;
 const instruction='You are a careful movement-observation assistant for a student research prototype. Reply in the language of the user. Use only the provided observations. Camera angles are 2D estimates, not medical or fatigue measures. Do not diagnose injury, assess physiological fatigue, invent missing data, or treat left-right differences as proof of incorrect form. Distinguish observations from suggestions. Be concise.';
 const content=message+(summary?'\n\nUser-selected local session summary:\n'+JSON.stringify(summary):'');
 const messages=test?[{role:'user',content:message}]:[{role:'system',content:instruction},...history.slice(-8),{role:'user',content}];
 let output;
 if(!test){addMessage('user',message+(summary?'\n[Session summary included]':''));output=addMessage('assistant','Thinking…');$('chatInput').value='';}
 aiControls(true);aiController=new AbortController();$('chatStatus').textContent='Connecting directly to '+new URL(endpointUrl(config.endpoint)).host+'…';
 if(test)$('connectionStatus').textContent='Testing your key and model…';
 let text='';
 try{
  const answer=await chat({...config,messages,signal:aiController.signal,onToken:token=>{text+=token;if(output)output.textContent=text;$('chatLog').scrollTop=$('chatLog').scrollHeight;}});
  $('aiBadge').textContent='CONNECTED';$('connectionStatus').textContent='Connection verified. The provider returned a response.';
  $('chatStatus').textContent='Response complete.';
  if(!test){history.push({role:'user',content:message},{role:'assistant',content:answer});while(history.length>8)history.shift();}
 }catch(error){
  $('chatStatus').textContent=error.message;$('connectionStatus').textContent=error.message;$('aiBadge').textContent='CHECK CONNECTION';
  if(output){output.textContent=(text?text+'\n\n':'')+'[Response incomplete] '+error.message;output.parentElement.classList.add('error');}
 }finally{aiController=null;aiControls(false);}
}
$('chatForm').addEventListener('submit',event=>{event.preventDefault();send();});
$('testConnection').addEventListener('click',()=>send(true));
window.addEventListener('pagehide',()=>{clearKey();stopCapture('Session ended.');});

mountEmg();
