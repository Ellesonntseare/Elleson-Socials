export function setupNavigation(){
 document.querySelector('nav').innerHTML=`<a href="#planner" data-nav="planner"><span>▦</span>Planner</a><a href="#drafts" data-nav="drafts" class="desktop-drafts"><span>▤</span>Drafts <b id="draft-count">0</b></a><button class="mobile-create" data-action="create" aria-label="Create post"><span>＋</span>Create</button><a href="#library" data-nav="library"><span>▧</span>Media</a><a href="#channels" data-nav="channels"><span>◉</span>Channels</a><a href="#storage" data-nav="storage"><span>☰</span>More</a>`;
 const navTitle=document.querySelector('.nav-label');if(navTitle)navTitle.textContent='YOUR CONTENT';
 const brand=document.querySelector('.brand');if(brand)brand.setAttribute('aria-label','Elleson Socials home');
}
