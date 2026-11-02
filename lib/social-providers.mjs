// Provider endpoints are fixed in source. Client configuration cannot select a host.
export const socialProviders={
 facebook:{app:'meta',name:'Facebook',auth:'https://www.facebook.com/{version}/dialog/oauth',token:'https://graph.facebook.com/{version}/oauth/access_token',scope:'pages_show_list,pages_read_engagement,pages_manage_posts',docs:'https://developers.facebook.com/apps/'},
 instagram:{app:'meta',name:'Instagram',auth:'https://www.facebook.com/{version}/dialog/oauth',token:'https://graph.facebook.com/{version}/oauth/access_token',scope:'pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish',docs:'https://developers.facebook.com/apps/'},
 youtube:{app:'google',name:'YouTube',auth:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',scope:'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload',pkce:true,docs:'https://console.cloud.google.com/apis/credentials'},
 google:{app:'google',name:'Google Business Profile',auth:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',scope:'https://www.googleapis.com/auth/business.manage',pkce:true,docs:'https://console.cloud.google.com/apis/credentials'},
 linkedin:{app:'linkedin',name:'LinkedIn',auth:'https://www.linkedin.com/oauth/v2/authorization',token:'https://www.linkedin.com/oauth/v2/accessToken',scope:'openid profile w_member_social',docs:'https://www.linkedin.com/developers/apps'},
 tiktok:{app:'tiktok',name:'TikTok',auth:'https://www.tiktok.com/v2/auth/authorize/',token:'https://open.tiktokapis.com/v2/oauth/token/',scope:'user.info.basic,video.publish,video.upload',docs:'https://developers.tiktok.com/'},
 pinterest:{app:'pinterest',name:'Pinterest',auth:'https://www.pinterest.com/oauth/',token:'https://api.pinterest.com/v5/oauth/token',scope:'user_accounts:read,boards:read,pins:read,pins:write',basic:true,docs:'https://developers.pinterest.com/apps/'},
 x:{app:'x',name:'X',auth:'https://x.com/i/oauth2/authorize',token:'https://api.x.com/2/oauth2/token',scope:'tweet.read tweet.write users.read offline.access',pkce:true,basic:true,docs:'https://developer.x.com/'},
 threads:{app:'threads',name:'Threads',auth:'https://threads.net/oauth/authorize',token:'https://graph.threads.net/oauth/access_token',scope:'threads_basic,threads_content_publish',docs:'https://developers.facebook.com/apps/'},
 bluesky:{app:null,name:'Bluesky',docs:'https://bsky.app/settings/app-passwords'}
};
export const socialAppNames={meta:'Facebook & Instagram',google:'Google',linkedin:'LinkedIn',tiktok:'TikTok',pinterest:'Pinterest',x:'X',threads:'Threads'};
export function providerURL(template,version){return template.replace('{version}',version);}
