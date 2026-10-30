export function endpointUrl(endpoint){
 let url;try{url=new URL(endpoint?.trim());}catch{throw new Error('Enter a valid HTTPS API base URL or chat/completions URL.');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('Use an HTTPS API URL without credentials, query parameters or fragments.');
 url.pathname=url.pathname.replace(/\/+$/,'');
 if(!url.pathname.endsWith('/chat/completions'))url.pathname+='/chat/completions';
 return url.href;
}
export function credentials(key, endpoint, model) {
  if (!key?.trim() || /\s/.test(key.trim()) || key.trim().length>512) throw new Error('Enter a valid API key in Connection settings.');
  const url=endpointUrl(endpoint);
  if (!model?.trim() || model.trim().length>100) throw new Error('Enter a model name.');
  return {key:key.trim(),url,model:model.trim()};
}
export async function chat({key,endpoint,model,messages,onToken=()=>{},signal,fetchImpl=fetch,timeoutMs=120000,maxTokens=4096}) {
  const config=credentials(key,endpoint,model);
  if(!Number.isInteger(maxTokens)||maxTokens<256||maxTokens>32768)throw new Error('Output limit must be an integer between 256 and 32768 tokens.');
  const controller=new AbortController();
  const abort=()=>controller.abort();
  if(signal?.aborted) controller.abort(); else signal?.addEventListener('abort',abort,{once:true});
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
  let reader;
  try {
    const response=await fetchImpl(config.url,{
      method:'POST',mode:'cors',credentials:'omit',redirect:'error',cache:'no-store',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.key}`},
      body:JSON.stringify({model:config.model,messages,stream:true,max_tokens:maxTokens,temperature:0.4}),signal:controller.signal
    });
    if(!response.ok) {
      const errors={401:'API key was rejected. Check the key and API address.',403:'This key cannot access the selected model.',429:'Rate or quota limit reached. Check your provider account.'};
      throw new Error(errors[response.status]||`Provider returned HTTP ${response.status}. Check your model and provider status.`);
    }
    if(!response.body) throw new Error('The provider returned no response stream.');
    reader=response.body.getReader();const decoder=new TextDecoder();let buffer='',answer='',done=false,finishReason=null;
    const line=raw=>{
      const text=raw.trim();if(!text.startsWith('data:'))return;
      const data=text.slice(5).trim();if(data==='[DONE]'){done=true;return;}
      if(!data)return;
      let parsed;try{parsed=JSON.parse(data);}catch{throw new Error('The provider returned an invalid stream.');}
      if(parsed.error)throw new Error('The provider interrupted the response. Check your model and quota.');
      const choice=parsed.choices?.[0];
      if(choice?.finish_reason)finishReason=choice.finish_reason;
      const token=choice?.delta?.content;
      if(typeof token==='string'){answer+=token;onToken(token);}
    };
    while(!done){
      const chunk=await reader.read();
      buffer+=decoder.decode(chunk.value||new Uint8Array(),{stream:!chunk.done});
      let i;while((i=buffer.indexOf('\n'))>=0){line(buffer.slice(0,i));buffer=buffer.slice(i+1);if(done)break;}
      if(chunk.done){if(buffer.trim())line(buffer);break;}
    }
    if(finishReason==='length')throw new Error('Response reached the output limit and was truncated. Increase Max output tokens or request a shorter answer.');
    if(finishReason==='content_filter')throw new Error('The provider stopped this response due to its content filter.');
    if(finishReason&&finishReason!=='stop')throw new Error('The provider ended without a completed text answer. Try a compatible chat model.');
    if(!done)throw new Error('Connection ended before completion. The response may be incomplete.');
    if(!answer.trim())throw new Error('The model returned no text. Try a different model.');
    return answer;
  } catch(error) {
    if(controller.signal.aborted)throw new Error(timedOut?'Request timed out. Try again.':'Request cancelled.');
    if(error instanceof TypeError)throw new Error('Cannot reach the provider. Check network access and CORS support for this API address (POST, Authorization and Content-Type).');
    throw error;
  } finally {
    clearTimeout(timer);signal?.removeEventListener('abort',abort);
    if(reader){await reader.cancel().catch(()=>{});reader.releaseLock();}
  }
}
