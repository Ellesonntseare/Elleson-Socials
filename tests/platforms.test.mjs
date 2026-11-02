import {test} from 'node:test';
import assert from 'node:assert/strict';
import {platforms,validatePost} from '../public/planner/platforms.js';
const post=(id,format,extra={})=>({caption:'A new story.',targets:[{id,format}],...extra});
test('empty targets and empty posts are rejected',()=>{
 assert.ok(validatePost({caption:'',targets:[]}).length>=2);
});
test('a text-only Facebook post is valid',()=>assert.deepEqual(validatePost(post('facebook','Text')),[]));
test('media-only Instagram posts are valid with an image',()=>assert.deepEqual(validatePost(post('instagram','Image',{caption:''}),[{type:'image/jpeg'}]),[]));
test('a multi-platform post applies caption limits per target',()=>{
 const p=post('facebook','Text',{caption:'a'.repeat(301),targets:[{id:'facebook',format:'Text'},{id:'bluesky',format:'Text'}]});
 assert.deepEqual(validatePost(p),['Bluesky: caption exceeds 300 characters.']);
 p.targets[1].caption='A shorter version.';assert.deepEqual(validatePost(p),[]);
});
test('YouTube requires a single video and title',()=>{
 assert.equal(validatePost(post('youtube','Short')).length,3);
 assert.deepEqual(validatePost(post('youtube','Short',{title:'Our new short'}),[{type:'video/mp4'}]),[]);
});
test('a Pinterest Pin requires a board',()=>assert.ok(validatePost(post('pinterest','Image Pin'),[{type:'image/jpeg'}]).some(e=>e.includes('board'))));
test('a TikTok carousel rejects video and a lone image',()=>{
 assert.ok(validatePost(post('tiktok','Photo carousel'),[{type:'video/mp4'}]).length);
 assert.ok(validatePost(post('tiktok','Photo carousel'),[{type:'image/jpeg'}]).length);
 assert.deepEqual(validatePost(post('tiktok','Photo carousel'),[{type:'image/jpeg'},{type:'image/jpeg'}]),[]);
});
test('documents are confined to a LinkedIn document post',()=>{
 const pdf={type:'application/pdf'};
 assert.deepEqual(validatePost(post('linkedin','Document'),[pdf]),[]);
 assert.ok(validatePost(post('instagram','Image'),[pdf]).length);
});
test('the baseline contains ten distinct publishing networks',()=>assert.equal(new Set(platforms.map(p=>p.id)).size,10));
test('unknown networks and unsupported formats cannot be planned',()=>{
 assert.ok(validatePost(post('twitch','Video')).length);
 assert.ok(validatePost(post('instagram','Text')).length);
});
test('GIF format requires an actual GIF',()=>{
 assert.ok(validatePost(post('x','GIF'),[{type:'image/jpeg'}]).length);
 assert.deepEqual(validatePost(post('x','GIF'),[{type:'image/gif'}]),[]);
});
test('Reels cannot contain multiple video files',()=>assert.ok(validatePost(post('instagram','Reel'),[{type:'video/mp4'},{type:'video/mp4'}]).some(e=>e.includes('exactly one video'))));
