const field=(key,label,type='text',extra={})=>({key,label,type,...extra});
export function formatFields(id,format){
 const fields=[];
 if(format==='Poll')fields.push(field('pollQuestion','Poll question'),field('pollChoices','Answer choices','poll'),field('pollDuration','Voting duration','select',{choices:[['','Choose a duration'],...(id==='x'?[['5','5 minutes'],['60','1 hour'],['360','6 hours']]:[]),['1440','1 day'],['4320','3 days'],['10080','1 week'],...(id==='linkedin'?[['20160','2 weeks']]:[])]}));
 if(id==='youtube')fields.push(field('title','Video title'),field('visibility','Visibility','select',{choices:[['private','Private'],['unlisted','Unlisted'],['public','Public']]}),field('madeForKids','Audience','select',{choices:[['','Choose an audience'],['yes','Made for kids'],['no','Not made for kids']]}),field('tags','Tags (comma separated)'));
 if(id==='pinterest')fields.push(field('title','Pin title'),field('board','Pinterest board'),field('url','Destination link','url'));
 if(id==='google'){
  fields.push(field('url','Button or destination link','url'));
  if(['Offer','Event'].includes(format))fields.push(field('eventTitle',format+' title'),field('startsAt','Starts','datetime-local'),field('endsAt','Ends','datetime-local'));
  if(format==='Offer')fields.push(field('coupon','Coupon code'),field('terms','Offer terms','textarea'));
 }
 if(['instagram','facebook'].includes(id))fields.push(field('location','Location'));
 if(['facebook','instagram','linkedin','tiktok','youtube'].includes(id))fields.push(field('firstComment','First comment','textarea'));
 if(['Video','Reel','Short','Video Pin'].includes(format))fields.push(field('coverId','Cover or thumbnail','cover'));
 if(id==='tiktok')fields.push(field('allowComments','Allow comments','checkbox'),...(format==='Video'?[field('allowDuet','Allow duet','checkbox'),field('allowStitch','Allow stitch','checkbox')]:[]),field('commercialContent','Commercial content','checkbox'));
 if(['instagram','youtube','tiktok'].includes(id))fields.push(field('aiGenerated','AI-generated or altered content','checkbox'));
 if(id==='bluesky')fields.push(field('languages','Post languages (e.g. en, st)'));
 return fields;
}
const stringKeys=new Set(['title','visibility','madeForKids','tags','board','url','eventTitle','startsAt','endsAt','coupon','terms','location','firstComment','coverId','languages','manualCompletedAt','pollQuestion','pollDuration']);
const booleanKeys=new Set(['allowComments','allowDuet','allowStitch','commercialContent','aiGenerated']);
export function sanitizeOptions(raw={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid format options.');
 const options={};for(const [key,value] of Object.entries(raw)){
  if(stringKeys.has(key)){if(typeof value!=='string'||value.length>5000)throw Error('Invalid '+key+'.');options[key]=value;}
  if(booleanKeys.has(key)){if(typeof value!=='boolean')throw Error('Invalid '+key+'.');options[key]=value;}
  if(key==='segments'){if(!Array.isArray(value)||value.length>80||value.some(s=>typeof s!=='string'||s.length>100000))throw Error('Invalid thread posts.');options.segments=[...value];}
  if(key==='pollChoices'){if(!Array.isArray(value)||value.length>4||value.some(s=>typeof s!=='string'||s.length>1000))throw Error('Invalid poll choices.');options.pollChoices=[...value];}
 }
 if(options.url){let parsed;try{parsed=new URL(options.url);}catch{throw Error('Enter a full destination link.');}if(!['https:','http:'].includes(parsed.protocol))throw Error('Use an http or https destination link.');}
 if(options.coverId&&!/^[0-9a-f-]{36}$/i.test(options.coverId))throw Error('Choose a valid cover image.');
 if(options.visibility&&!['public','private','unlisted'].includes(options.visibility))throw Error('Choose a valid visibility setting.');
 if(options.madeForKids&&!['yes','no'].includes(options.madeForKids))throw Error('Choose an audience.');
 for(const key of ['startsAt','endsAt','manualCompletedAt'])if(options[key]&&!Number.isFinite(Date.parse(options[key])))throw Error('Enter a valid date.');
 return options;
}
export function validateFormat(target,post,limit){
 const errors=[];let options;try{options=sanitizeOptions(target.options);}catch(error){return [error.message];}
 if(target.format==='Poll'){
  const question=options.pollQuestion||target.caption||post.caption||'';if(!question.trim())errors.push('Poll: add your question.');
  const choices=(options.pollChoices||[]).filter(s=>s.trim());if(choices.length<2||choices.length>4)errors.push('Poll: add two to four answer choices.');
  if(target.id==='x'&&choices.some(s=>[...s].length>25))errors.push('X: keep each poll choice within 25 characters.');
  const duration=Number(options.pollDuration);if(target.id==='x'&&(!Number.isFinite(duration)||duration<5||duration>10080))errors.push('X: choose a poll duration from 5 minutes to 7 days.');
  if(target.id==='linkedin'&&![1440,4320,10080,20160].includes(duration))errors.push('LinkedIn: choose a poll duration.');
 }
 if(target.format==='Thread'&&options.segments?.length){
  options.segments.forEach((part,i)=>{if(!part.trim())errors.push(`Thread post ${i+1}: add some text.`);if([...part].length>limit)errors.push(`Thread post ${i+1}: exceeds ${limit} characters.`);});
 }
 if(target.id==='youtube'){
  if(!(options.title||post.title||'').trim())errors.push('YouTube: add a video title.');
  if((options.title||post.title||'').length>100)errors.push('YouTube: keep the title within 100 characters.');
  if(!options.madeForKids)errors.push('YouTube: choose whether the video is made for kids.');
 }
 if(target.id==='pinterest'&&!(options.board||post.board||'').trim())errors.push('Pinterest: add a board reference.');
 if(target.id==='google'&&['Offer','Event'].includes(target.format)){
  if(!options.eventTitle?.trim())errors.push(`Google Business: add an ${target.format.toLowerCase()} title.`);
  if(!options.startsAt||!options.endsAt)errors.push('Google Business: choose start and end dates.');
  else if(new Date(options.endsAt)<=new Date(options.startsAt))errors.push('Google Business: end time must be after start time.');
 }
 return errors;
}
