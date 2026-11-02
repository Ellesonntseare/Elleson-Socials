export function setupNavigation(){
 document.querySelector('nav').innerHTML=`<a href="#planner" data-nav="planner"><span>▦</span>Schedule</a><a href="#drafts" data-nav="drafts" class="desktop-drafts"><span>▤</span>Drafts <b id="draft-count">0</b></a><button class="mobile-create" data-action="create" aria-label="New post"><span>＋</span>Create</button><a href="#library" data-nav="library"><span>▧</span>Files</a><a href="#channels" data-nav="channels"><span>◉</span>Accounts</a><a href="#storage" data-nav="storage"><span>☰</span>Settings</a>`;
 const navTitle=document.querySelector('.nav-label');if(navTitle)navTitle.textContent='MENU';
 const brand=document.querySelector('.brand');if(brand)brand.setAttribute('aria-label','Elleson Socials home');
}
