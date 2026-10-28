export const ENDPOINTS = {
  beijing: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  singapore: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
};
export function credentials(key, region, model) {
  if (!key?.trim() || /\s/.test(key.trim()) || key.trim().length>512) throw new Error('Enter a valid API key in Connection settings.');
  if (!ENDPOINTS[region]) throw new Error('Select a supported region.');
  if (!model?.trim() || model.trim().length>100) throw new Error('Enter a model name.');
  return {key:key.trim(),base:ENDPOINTS[region],model:model.trim()};
}
export async function chat({key,region,model,messages,onToken=()=>{},signal,fetchImpl=fetch,timeoutMs=60000}) {
  const config=credentials(key,region,model);
  const controller=new AbortController();
  const abort=()=>controller.abort();
  if(signal?.aborted) controller.abort(); else signal?.addEventListener('abort',abort,{once:true});
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
  let reader;
  try {
    const response=await fetchImpl(config.base+'/chat/completions',{
      method:'POST',mode:'cors',credentials:'omit',redirect:'error',cache:'no-store',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.key}`},
      body:JSON.stringify({model:config.model,messages,stream:true,max_tokens:1500,temperature:0.4}),signal:controller.signal
    });
    if(!response.ok) {
      const errors={401:'API key was rejected. Check the key and its region.',403:'This key cannot access the selected model.',429:'Rate or quota limit reached. Check your provider account.'};
      throw new Error(errors[response.status]||`Provider returned HTTP ${response.status}. Check your model and provider status.`);
    }
    if(!response.body) throw new Error('The provider returned no response stream.');
    reader=response.body.getReader();const decoder=new TextDecoder();let buffer='',answer='',done=false;
    const line=raw=>{
      const text=raw.trim();if(!text.startsWith('data:'))return;
      const data=text.slice(5).trim();if(data==='[DONE]'){done=true;return;}
      if(!data)return;
      let parsed;try{parsed=JSON.parse(data);}catch{throw new Error('The provider returned an invalid stream.');}
      if(parsed.error)throw new Error('The provider interrupted the response. Check your model and quota.');
      const token=parsed.choices?.[0]?.delta?.content;
      if(typeof token==='string'){answer+=token;onToken(token);}
    };
    while(!done){
      const chunk=await reader.read();
      buffer+=decoder.decode(chunk.value||new Uint8Array(),{stream:!chunk.done});
      let i;while((i=buffer.indexOf('\n'))>=0){line(buffer.slice(0,i));buffer=buffer.slice(i+1);if(done)break;}
      if(chunk.done){if(buffer.trim())line(buffer);break;}
    }
    if(!done)throw new Error('Connection ended before completion. The response may be incomplete.');
    if(!answer.trim())throw new Error('The model returned no text. Try a different model.');
    return answer;
  } catch(error) {
    if(controller.signal.aborted)throw new Error(timedOut?'Request timed out. Try again.':'Request cancelled.');
    if(error instanceof TypeError)throw new Error('Cannot reach the provider. Check network access and CORS support for this region.');
    throw error;
  } finally {
    clearTimeout(timer);signal?.removeEventListener('abort',abort);
    if(reader){await reader.cancel().catch(()=>{});reader.releaseLock();}
  }
}
