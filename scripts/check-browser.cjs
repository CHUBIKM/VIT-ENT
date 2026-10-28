const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
const output=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'vit-static-check-'));
console.log('Verification artifacts:',output);
const origin='https://peidong111.github.io',base=origin+'/ENT-Project-VIT-SMART/';
const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1100},permissions:['camera']});
  await context.route(origin+'/**',route=>{let name=new URL(route.request().url()).pathname.replace('/ENT-Project-VIT-SMART/','')||'index.html';const file=path.join(root,name);if(!file.startsWith(root)||!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});return route.fulfill({contentType:types[path.extname(file)],body:fs.readFileSync(file)});});
  const page=await context.newPage();const errors=[],backend=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin===origin&&/\/api\/|\/login|\/register/.test(r.url()))backend.push(r.url());});
  await page.goto(base);await page.screenshot({path:path.join(output,'vit-static-landing.png'),fullPage:true});
  await page.getByRole('link',{name:'Start as a guest'}).click();await page.waitForSelector('#startCamera');await page.waitForFunction(()=>document.querySelector('[data-view=studio]').getAttribute('aria-current')==='page');await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(output,'vit-static-studio.png'),fullPage:true});
  assert.equal(await page.locator('#summaryContent').isVisible(),false);
  console.log('PASS guest entry and repository subpath'); 
  const cors=[];
  for(const host of ['dashscope.aliyuncs.com','dashscope-intl.aliyuncs.com']) {
   cors.push(await page.evaluate(async host=>{try{const r=await fetch('https://'+host+'/compatible-mode/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer vit-smart-cors-probe-not-a-real-key'},body:JSON.stringify({model:'qwen-plus',messages:[{role:'user',content:'OK'}],max_tokens:1})});const data=await r.json();return {host,status:r.status,errorCode:data.error?.code,readable:true};}catch(e){return {host,readable:false,error:e.message};}},host));
  }
  fs.writeFileSync(path.join(output,'vit-cors-browser-results.json'),JSON.stringify({origin,results:cors},null,2));console.log('LIVE CORS',JSON.stringify(cors));
  await page.locator('[data-view="assistant"]').click();
  await page.locator('#chatInput').fill('hello');await page.locator('#sendChat').click();assert.match(await page.locator('#connectionStatus').textContent(),/API key/);
  await page.locator('#apiKey').fill('ui-test-key');
  await page.route('https://dashscope.aliyuncs.com/**',r=>r.fulfill({contentType:'text/event-stream',body:'data: {"choices":[{"delta":{"content":"Test response"}}]}\n\ndata: [DONE]\n\n'}));
  await page.locator('#sendChat').click();await page.waitForFunction(()=>document.querySelector('#chatStatus').textContent==='Response complete.');
  await page.locator('#region').selectOption('singapore');assert.equal(await page.locator('#apiKey').inputValue(),'');
  await page.locator('#apiKey').fill('ui-test-key');await page.locator('#clearKey').click();assert.equal(await page.locator('#apiKey').inputValue(),'');
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  await page.screenshot({path:path.join(output,'vit-static-assistant.png'),fullPage:true});
  await page.locator('[data-view="studio"]').click();await page.locator('#startCamera').click();
  console.log('Loading real MediaPipe model with synthetic camera…');
  await page.waitForFunction(()=>Number(document.querySelector('#sampleMetric').textContent)>=5,{},{timeout:90000});
  console.log('PASS real model + fake camera: samples',await page.locator('#sampleMetric').textContent());
  await page.locator('#stopCapture').click();await page.locator('[data-view="summary"]').click();await page.locator('#summaryContent').waitFor({state:'visible'});
  const downloadPromise=page.waitForEvent('download');await page.locator('#exportSummary').click();const download=await downloadPromise;await download.saveAs(path.join(output,'vit-browser-summary.json'));
  const summary=JSON.parse(fs.readFileSync(path.join(output,'vit-browser-summary.json')));assert.ok(summary.samples>=5);assert.equal(summary.source,'camera');
  console.log('PASS stop, summary, JSON export');
  await page.screenshot({path:path.join(output,'vit-static-summary.png'),fullPage:true});
  // Generate a local test video without downloading or exposing any private footage.
  const videoBytes=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=320;c.height=240;const ctx=c.getContext('2d');const stream=c.captureStream(10);const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});const chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();let i=0;const timer=setInterval(()=>{ctx.fillStyle=i++%2?'#467355':'#ddddaa';ctx.fillRect(0,0,320,240);},100);await new Promise(r=>setTimeout(r,2200));clearInterval(timer);recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));});
  await page.locator('[data-view="studio"]').click();await page.locator('#videoFile').setInputFiles({name:'synthetic.webm',mimeType:'video/webm',buffer:Buffer.from(videoBytes)});
  await page.waitForFunction(()=>document.querySelector('#poseStatus').textContent.includes('Video complete'),{},{timeout:30000});
  assert.ok(Number(await page.locator('#sampleMetric').textContent())>0);console.log('PASS local video analysis and automatic completion');
  await page.locator('[data-view="summary"]').click();assert.equal(await page.locator('#summarySource').textContent(),'LOCAL VIDEO');
  await page.locator('#clearSession').click();await page.locator('#summaryEmpty').waitFor({state:'visible'});
  await page.setViewportSize({width:390,height:844});await page.locator('[data-view="studio"]').click();await page.locator('#studioView').waitFor({state:'visible'});await page.screenshot({path:path.join(output,'vit-static-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('[data-view="assistant"]').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#apiKey').fill('refresh-test-key');await page.reload();assert.equal(await page.locator('#apiKey').inputValue(),'');
  assert.deepEqual(backend,[]);assert.deepEqual(errors,[]);
  console.log('PASS mobile layout, refresh, no backend requests, no page errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
