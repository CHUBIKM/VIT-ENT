const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(process.env.LIVE_SITE!=='1')await page.route('https://chubikm.github.io/VIT-ENT/**',r=>{const file=path.join(__dirname,'../dist',new URL(r.request().url()).pathname.replace('/VIT-ENT/',''));return r.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html'});});
  const requests=[];
  await page.route('https://custom-api.example/**',r=>{requests.push({url:r.request().url(),headers:r.request().headers(),body:r.request().postDataJSON()});return r.fulfill({contentType:'text/event-stream',body:'data: {"choices":[{"delta":{"content":"Custom gateway OK"}}]}\n\ndata: [DONE]\n\n'});});
  await page.goto('https://chubikm.github.io/VIT-ENT/dashboard.html#assistant');
  await page.locator('#apiEndpoint').fill('https://custom-api.example/v1/');await page.locator('#model').fill('custom-model');await page.locator('#apiKey').fill('test-only-key');
  await page.locator('#chatInput').fill('hello');await page.locator('#sendChat').click();await page.waitForFunction(()=>document.querySelector('#aiBadge').textContent==='CONNECTED');
  assert.equal(requests[0].url,'https://custom-api.example/v1/chat/completions');assert.equal(requests[0].headers.authorization,'Bearer test-only-key');assert.equal(requests[0].body.model,'custom-model');
  await page.locator('#apiEndpoint').fill('https://custom-api.example/other/chat/completions');assert.equal(await page.locator('#apiKey').inputValue(),'');
  await page.locator('#apiKey').fill('another-test-key');await page.locator('#chatInput').fill('new provider');await page.locator('#sendChat').click();await page.waitForFunction(()=>document.querySelector('#aiBadge').textContent==='CONNECTED');
  assert.equal(requests[1].url,'https://custom-api.example/other/chat/completions');assert.equal(requests[1].body.messages.length,2);assert.equal(requests[1].body.messages[1].content,'new provider');
  await page.locator('#apiEndpoint').fill('http://custom-api.example/v1');await page.locator('#apiKey').fill('test-only-key');await page.locator('#testConnection').click();assert.match(await page.locator('#connectionStatus').textContent(),/HTTPS/);assert.equal(requests.length,2);
  await page.locator('#apiEndpoint').fill('https://custom-api.example/v1');await page.locator('#apiKey').fill('test-only-key');await page.unroute('https://custom-api.example/**');await page.route('https://custom-api.example/**',r=>r.abort('failed'));await page.locator('#testConnection').click();await page.waitForFunction(()=>document.querySelector('#connectionStatus').textContent.includes('CORS'));
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(require('node:os').tmpdir(),'vit-custom-api.png'),fullPage:true});await page.reload();assert.equal(await page.locator('#apiKey').inputValue(),'');assert.deepEqual(errors,[]);
  console.log('PASS custom base/full URL, Bearer/model, context reset, validation, network/CORS message, mobile and reload. Provider responses mocked; live arbitrary-provider CORS not asserted.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
