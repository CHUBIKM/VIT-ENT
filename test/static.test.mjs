import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {angle, measurePose, LocalSession} from '../public/assets/pose.mjs';
import {chat, credentials, endpointUrl} from '../public/assets/ai.mjs';
const key='test-only-key',endpoint='https://dashscope.aliyuncs.com/compatible-mode/v1',model='qwen-plus',messages=[{role:'user',content:'hello'}];
const config={key,endpoint,model,messages};
const encoded=new TextEncoder();
function response(chunks){return new Response(new ReadableStream({start(c){for(const s of chunks)c.enqueue(typeof s==='string'?encoded.encode(s):s);c.close();}}));}
test('angles account for video aspect ratio and reject invisible or degenerate joints',()=>{
 const p=(x,y,visibility=1)=>({x,y,visibility});
 assert.ok(Math.abs(angle(p(0,1),p(0,0),p(1,1),2)-63.4349488)<0.001);
 assert.equal(angle(p(0,1,0.1),p(0,0),p(1,1)),null);
 assert.equal(angle(p(0,0),p(0,0),p(1,1)),null);
});
test('one sampled frame is counted once, including missing and partial poses',()=>{
 const session=new LocalSession('video');
 session.add(measurePose(null),100);
 const points=Array.from({length:33},(_,i)=>({x:i%4/4,y:i/33,visibility:1}));
 session.add(measurePose(points),200);
 points[27].visibility=0;session.add(measurePose(points),300);session.finish();
 const data=session.summary();assert.equal(data.samples,3);assert.equal(data.detectedRate,2/3);assert.equal(data.fullBodyRate,1/3);assert.ok(data.endedAt);assert.equal(data.angles.leftKnee.mean>=0,true);
 assert.equal(JSON.stringify(data).includes('key'),false);
});
test('missing key and unsafe endpoint URLs are rejected before sending',async()=>{
 let sent=false;
 await assert.rejects(chat({...config,key:'',fetchImpl:()=>{sent=true;}}),/API key/);assert.equal(sent,false);
 for(const address of ['http://example.com/v1','https://user:secret@example.com/v1','https://example.com/v1?key=secret','https://example.com/#fragment','not a url'])assert.throws(()=>credentials(key,address,model),/HTTPS/);
 assert.equal(endpointUrl(' https://custom.example/api/v1/ '),'https://custom.example/api/v1/chat/completions');
 assert.equal(endpointUrl('https://custom.example/v1/chat/completions/'),'https://custom.example/v1/chat/completions');
});
test('SSE parser handles split UTF-8, CRLF and final unterminated DONE; sends direct Bearer request',async()=>{
 const payload=encoded.encode('data: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\ndata: [DONE]');
 let content='';
 const answer=await chat({...config,onToken:t=>content+=t,fetchImpl:async(url,options)=>{
  assert.equal(url,'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
  assert.equal(options.headers.Authorization,'Bearer '+key);assert.equal(options.credentials,'omit');assert.equal(options.mode,'cors');assert.equal(options.redirect,'error');
  return response([...payload].map(byte=>new Uint8Array([byte])));
 }});
 assert.equal(answer,'你好');assert.equal(content,'你好');
});
test('authentication, quota, network and incomplete streams are distinct and do not echo secrets',async()=>{
 for(const [status,pattern] of [[401,/key was rejected/],[429,/quota/],[500,/HTTP 500/]])
  await assert.rejects(chat({...config,fetchImpl:async()=>new Response(key,{status})}),pattern);
 await assert.rejects(chat({...config,fetchImpl:async()=>{throw new TypeError(key);}}),/network access and CORS/);
 await assert.rejects(chat({...config,fetchImpl:async()=>response(['data: {"choices":[{"delta":{"content":"partial"}}]}\n'])}),/incomplete/);
 await assert.rejects(chat({...config,fetchImpl:async()=>response(['data: {"error":{"message":"'+key+'"}}\n'])}),/interrupted/);
});
test('timeout and user cancellation abort the provider request',async()=>{
 const fetchImpl=(_url,{signal})=>new Promise((resolve,reject)=>{if(signal.aborted)return reject(new Error('abort'));signal.addEventListener('abort',()=>reject(new Error('abort')));});
 await assert.rejects(chat({...config,fetchImpl,timeoutMs:10}),/timed out/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(chat({...config,fetchImpl,signal:controller.signal}),/cancelled/);
});
test('static app does not call the old backend or persist credentials',()=>{
 const app=readFileSync(new URL('../public/assets/app.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(app,/fetch\(["'`]\/?api|localStorage|sessionStorage|\/register|\/login/);
 for(const file of ['index.html','dashboard.html']){
  const html=readFileSync(new URL('../public/'+file,import.meta.url),'utf8');assert.doesNotMatch(html,/(?:src|href)="\/(?!\/)/);
 }
});

test('provider length and content-filter endings are not mistaken for successful completion',async()=>{
 for(const [reason,pattern] of [['length',/truncated/],['content_filter',/content filter/]]){
  let visible='';
  await assert.rejects(chat({...config,onToken:t=>visible+=t,fetchImpl:async()=>response([
   'data: {"choices":[{"delta":{"content":"Partial answer"}}]}\n',
   'data: '+JSON.stringify({choices:[{delta:{},finish_reason:reason}]})+'\n',
   'data: [DONE]\n'
  ])}),pattern);
  assert.equal(visible,'Partial answer');
 }
});
test('custom output budget is sent and invalid budgets never trigger a request',async()=>{
 await chat({...config,maxTokens:8192,fetchImpl:async(_url,options)=>{
  assert.equal(JSON.parse(options.body).max_tokens,8192);
  return response(['data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}]}\ndata: [DONE]\n']);
 }});
 let sent=false;await assert.rejects(chat({...config,maxTokens:NaN,fetchImpl:()=>{sent=true;}}),/Output limit/);assert.equal(sent,false);
});
