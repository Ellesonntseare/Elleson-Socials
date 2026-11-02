// Planning baseline checked 2026-11-02. These are Metricool publishing constraints,
// not proof that our application has approved API access. Revalidate per provider at dispatch.
export const SOURCES = {
  formats:'https://help.metricool.com/scheduling-and-posting-options-by-social-network-cwmb3',
  media:'https://help.metricool.com/publishing-requirements-for-images-and-videos-from-metricool-vfc8n'
};
const p=(id,name,mark,color,limit,formats,tip)=>({id,name,mark,color,limit,formats,tip,connection:'not_configured'});
export const platforms = [
 p('instagram','Instagram','◎','#c8498c',2200,['Image','Carousel','Reel','Story'],'Feed: JPG/PNG, up to 10 carousel items. Reels and Stories: vertical 9:16 recommended. Professional account required for the intended integration.'),
 p('facebook','Facebook','f','#3976df',16192,['Text','Image','Video','GIF','Reel','Story'],'Facebook Pages. Feed images, video, GIF, Reels and Stories. No multi-link carousel in the baseline.'),
 p('tiktok','TikTok','♪','#252529',2000,['Video','Photo carousel'],'Video or up to 35 photos. Photo uploads use JPEG/WebP. Privacy, comments, duet and stitch options must come from the authorized creator account.'),
 p('youtube','YouTube','▶','#e64d4d',5000,['Video','Short'],'Long-form video or square/vertical Shorts up to 3 minutes. Add a title, audience setting, visibility and thumbnail.'),
 p('linkedin','LinkedIn','in','#2867a8',3000,['Text','Image','Video','GIF','Document','Carousel'],'Personal profiles and organization Pages. Documents: PDF, PPT/PPTX, DOC/DOCX. A document carousel differs from an image gallery.'),
 p('threads','Threads','@','#343438',500,['Text','Image','Video','GIF','Thread','Ghost post'],'Media posts, multi-post threads and Ghost posts in the Metricool baseline. Provider-specific availability needs verification.'),
 p('x','X','𝕏','#27272a',280,['Text','Image','Video','GIF','Thread'],'Up to 4 images. Baseline caption limit is 280; longer Premium posts require verified account capability.'),
 p('bluesky','Bluesky','🦋','#2485e4',300,['Text','Image','Video','GIF','Thread'],'Up to 4 images. Add alt text and post languages. GIF handling requires provider-specific conversion or embedding.'),
 p('pinterest','Pinterest','p','#c44950',500,['Image Pin','Video Pin'],'Single image or video Pin. Include board, title, destination link and alt text. Recommended image shape: 2:3.'),
 p('google','Google Business Profile','G','#428672',1500,['Update','Offer','Event'],'Business updates with text, image, link or video. Offer and event fields require a dedicated provider review before activation.')
];
export const otherIntegrations = [
 {name:'Twitch',mark:'▧',color:'#8854d0',kind:'Stream analytics',detail:'Views, followers and stream performance; no social-post composer.'},
 {name:'Meta Ads',mark:'∞',color:'#3976df',kind:'Paid campaigns',detail:'Separate ad accounts, campaign reporting and campaign management.'},
 {name:'Google Ads',mark:'△',color:'#bd9138',kind:'Paid campaigns',detail:'Campaigns, spend, conversions and performance reports.'},
 {name:'TikTok Ads',mark:'♪',color:'#252529',kind:'Paid campaigns',detail:'Advertiser accounts and campaign performance.'},
 {name:'Website & blog',mark:'↗',color:'#658768',kind:'Website analytics',detail:'Traffic measurement, referrals and a future RSS content importer.'}
];
export function validatePost(post, media=[]) {
 const errors=[];
 if(!post.targets?.length) errors.push('Choose at least one platform.');
 if(!post.caption?.trim() && !media.length) errors.push('Add a caption or media.');
 for(const target of post.targets || []) {
  const network=platforms.find(p=>p.id===target.id);
  if(!network) {errors.push('Unknown platform.');continue;}
  if(!network.formats.includes(target.format)) errors.push(`${network.name}: choose a supported format.`);
  const caption=target.caption ?? post.caption ?? '';
  if([...caption].length>network.limit) errors.push(`${network.name}: caption exceeds ${network.limit.toLocaleString()} characters.`);
  if(!['Text','Thread','Ghost post','Update','Offer','Event'].includes(target.format) && !media.length) errors.push(`${network.name}: ${target.format} needs media.`);
  const videos=media.filter(m=>m.type.startsWith('video/'));
  const images=media.filter(m=>m.type.startsWith('image/'));
  const documents=media.filter(m=>!m.type.startsWith('image/')&&!m.type.startsWith('video/'));
  if(['Video','Reel','Short','Video Pin'].includes(target.format) && (videos.length!==1||media.length!==1)) errors.push(`${network.name}: choose exactly one video for ${target.format}.`);
  if(['Image','Image Pin'].includes(target.format) && images.length!==media.length) errors.push(`${network.name}: this format requires images.`);
  if(target.format==='Photo carousel' && (images.length<2||images.length!==media.length)) errors.push('TikTok: a photo carousel needs at least two images.');
  if(target.format==='Carousel' && media.length<2) errors.push(`${network.name}: a carousel needs at least two items.`);
  if(target.format==='Document' && (documents.length!==1||media.length!==1)) errors.push('LinkedIn: choose exactly one document.');
  if(documents.length && !(network.id==='linkedin'&&target.format==='Document')) errors.push(`${network.name}: documents require the LinkedIn Document format.`);
  if(target.format==='Text'&&media.length) errors.push(`${network.name}: choose a media format for these attachments.`);
  const max={instagram:10,facebook:35,tiktok:35,linkedin:20,threads:20,x:4,bluesky:4,pinterest:1,youtube:1,google:1}[network.id];
  if(media.length>max) errors.push(`${network.name}: this baseline allows up to ${max} media items.`);
  if(['GIF'].includes(target.format) && (media.length!==1||media[0]?.type!=='image/gif')) errors.push(`${network.name}: choose one GIF.`);
  if(network.id==='youtube'&&!post.title?.trim()) errors.push('YouTube: add a video title.');
  if(network.id==='pinterest'&&!post.board?.trim()) errors.push('Pinterest: add a board reference.');
 }
 return [...new Set(errors)];
}
