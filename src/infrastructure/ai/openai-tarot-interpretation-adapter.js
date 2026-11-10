'use strict';
const ENDPOINT = 'https://api.openai.com/v1/responses';
const SCHEMA = { type:'object', additionalProperties:false, required:['overview','cards','combinedMessage','practicalReflection','nextStep','caution','disclaimer'], properties:{ overview:{type:'string'}, cards:{type:'array',minItems:3,maxItems:3,items:{type:'object',additionalProperties:false,required:['position','cardId','interpretation'],properties:{position:{type:'integer',minimum:1,maximum:3},cardId:{type:'string'},interpretation:{type:'string'}}}}, combinedMessage:{type:'string'}, practicalReflection:{type:'string'}, nextStep:{type:'string'}, caution:{type:'string'}, disclaimer:{type:'string'} } };
const INSTRUCTIONS = 'Synthesize only the supplied server-owned Tarot semantics. Do not add cards, astrology, guaranteed outcomes, factual accusations, medical/reproductive/legal/death claims, or investment certainty. Tarot is reflective guidance, not factual prediction. Return only the strict JSON schema.';
function extract(body) {
  if (!body || typeof body !== 'object' || body.status === 'incomplete' || body.refusal) throw new Error('TAROT_PROVIDER_INCOMPLETE');
  if (body.output_parsed && typeof body.output_parsed === 'object') return body.output_parsed;
  const messages = (body.output || []).filter((item) => item && item.type === 'message');
  if (messages.length !== 1) throw new Error('TAROT_PROVIDER_INVALID_OUTPUT');
  const texts = (messages[0].content || []).filter((item) => item && item.type === 'output_text' && typeof item.text === 'string');
  if (texts.length !== 1) throw new Error('TAROT_PROVIDER_INVALID_OUTPUT');
  const parsed = JSON.parse(texts[0].text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('TAROT_PROVIDER_INVALID_OUTPUT');
  return parsed;
}
class OpenAITarotInterpretationAdapter {
  constructor({apiKey,model,fetchImplementation=globalThis.fetch,timeoutMilliseconds=12000}={}) { if(typeof apiKey!=='string'||!apiKey||typeof model!=='string'||!model||typeof fetchImplementation!=='function') throw new TypeError('INVALID_OPENAI_TAROT_ADAPTER'); this.apiKey=apiKey;this.model=model;this.fetch=fetchImplementation;this.timeout=timeoutMilliseconds; }
  async interpret(input) { const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),this.timeout); try { const response=await this.fetch(ENDPOINT,{method:'POST',headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({model:this.model,instructions:INSTRUCTIONS,input:JSON.stringify(input),store:false,max_output_tokens:1400,text:{format:{type:'json_schema',name:'tarot_interpretation',strict:true,schema:SCHEMA}}})}); if(!response.ok) throw new Error('TAROT_PROVIDER_FAILURE'); return {...extract(await response.json()),version:'tarot-synthesis-v1'}; } finally { clearTimeout(timer); } }
}
module.exports={OpenAITarotInterpretationAdapter,TAROT_INTERPRETATION_SCHEMA:SCHEMA,extractTarotProviderOutput:extract};
