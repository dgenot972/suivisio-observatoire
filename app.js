const $=s=>document.querySelector(s);
let bulletin={},edition=new URLSearchParams(location.search).get('edition')==='morning'?'morning':'latest';
let roles=[],briefing={},zone='all',topic='all',selectedAgent='redacteur',listening=false,recognition=null,speaking=false,busy=false,speechGeneration=0;
function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
function link(url,title){try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))return null;const a=el('a',title||parsed.hostname);a.href=parsed.href;a.target='_blank';a.rel='noopener noreferrer';return a;}catch{return null;}}
async function json(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('Chargement impossible : '+url);return r.json();}
function status(text){$('#voice-status').textContent=text;}
function output(text){$('#answer').hidden=false;$('#answer').textContent=text;$('#answer-sources').replaceChildren();}
function show(view){for(const v of ['brief','team','sources'])$('#'+v+'-view').hidden=v!==view;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));}
function matches(i){return (zone==='all'||i.zone===zone)&&(topic==='all'||i.topic===topic);}
function renderItems(){
 const items=(briefing.items||[]).filter(matches);$('#items').replaceChildren();
 if(!items.length){const d=el('div','','empty');d.append(el('strong','Aucune actualité dans cette sélection.'),el('p',briefing.date?'Le bulletin ne contient pas d’élément correspondant à ces filtres.':'Le premier bulletin apparaîtra ici après sa production. Aucun prix ni appel d’offres fictif.'));$('#items').append(d);return;}
 items.forEach((i,index)=>{const c=el('article','','card');c.append(el('small',(i.zone||'Zone à préciser')+' / '+(roles.find(r=>r.id===i.topic)?.name||i.topic||'Veille')),el('h3',i.title),el('p',i.summary));if(i.action)c.append(el('p','À faire : '+i.action,'action'));if(i.deadline)c.append(el('p','Échéance : '+i.deadline));c.append(el('p','Publication : '+(i.published||'non précisée')+' · Consultation : '+(i.checked||'non précisée')));for(const s of i.sources||[]){const a=link(s.url,s.title);if(a)c.append(a,document.createTextNode(' '));}const listen=el('button','▶ Écouter','text-button');listen.onclick=()=>speak(i.title+'. '+i.summary+'. '+(i.action||''));c.append(document.createElement('br'),listen);$('#items').append(c);});
}
function setFilter(type,value){if(type==='zone')zone=value;else topic=value;document.querySelectorAll('[data-'+type+']').forEach(b=>{const active=b.dataset[type]===value;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});show('brief');renderItems();}
function readBrief(){const items=(briefing.items||[]).filter(matches);let text=zone==='all'&&topic==='all'?briefing.summary||'Aucun briefing disponible.':items.length?items.map(i=>i.title+'. '+i.summary+'. '+(i.action||'')).join('\n'):'Aucune actualité disponible dans cette sélection.';speak(text);}
function resumeListening(){if(listening&&!speaking&&!busy&&recognition){try{recognition.start();}catch{}}}
function stopAudio(){speechGeneration++;speaking=false;if('speechSynthesis'in window)speechSynthesis.cancel();}
function speak(text){
 stopAudio();if(!('speechSynthesis'in window)){status('Lecture vocale indisponible dans ce navigateur. Le texte reste accessible.');return;}
 if(recognition){try{recognition.abort();}catch{}}
 const generation=speechGeneration;speaking=true;
 const clean=String(text).replace(/https?:\/\/\S+/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*#]/g,'');
 const chunks=clean.match(/[^.!?\n]+[.!?\n]?/g)||[clean];let n=0;
 const next=()=>{if(generation!==speechGeneration)return;if(n>=chunks.length){speaking=false;status(listening?'À votre écoute.':'Lecture terminée.');resumeListening();return;}const u=new SpeechSynthesisUtterance(chunks[n++]);u.lang='fr-FR';u.rate=1;const v=speechSynthesis.getVoices().find(v=>v.lang.startsWith('fr'));if(v)u.voice=v;u.onend=next;u.onerror=e=>{if(generation!==speechGeneration)return;speaking=false;status('Lecture interrompue : '+e.error);resumeListening();};speechSynthesis.speak(u);};
 status('Lecture en cours · bouton Arrêter pour interrompre.');next();
}
async function command(text){
 const q=text.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
 if(/^(stop|arrete|arreter|silence)[.! ]*$/.test(q)){stopAudio();status('Lecture arrêtée.');resumeListening();return;}
 if(/^(?:lis |lire |ecoute |montre |affiche )?(?:le )?briefing (?:de ce matin|du matin|de 7 ?h(?:eures)?)$/.test(q)){selectEdition('morning');readBrief();return;}
 if(/^(lis|ecoute|lire|resume|briefing|lis mon|lis le|ecouter le)[\s\S]*(briefing|synthese)$/.test(q)||q==='briefing'){readBrief();return;}
 if(/^(montre |affiche |ouvre |les |le )?(agents|specialistes)([.! ]*)$/.test(q)){show('team');speak('Treize spécialités sont présentées. Choisissez une rubrique à consulter.');return;}
 if(/^(montre |affiche |ouvre |les )?sources([.! ]*)$/.test(q)){show('sources');speak('Voici le catalogue des sources.');return;}
 if(/^(tout|tous|montre tout)$/.test(q)){setFilter('zone','all');setFilter('topic','all');speak('Tous les territoires et tous les métiers.');return;}
 const commands=[['caraibes','zone','Caraïbes'],['dom','zone','DOM'],['martinique','zone','DOM'],['national','zone','France'],['france','zone','France'],['appels d.offres','topic','ao'],['achats','topic','achats'],['destockages?','topic','achats'],['liquidations?','topic','achats'],['outillage','topic','achats'],['cours','topic','cours'],['technologies','topic','innovation'],['btp','topic','btp'],['electricite','topic','electricite'],['eclairage','topic','lumiere'],['mode','topic','mode'],['design','topic','design']];
 for(const [word,type,value]of commands){if(new RegExp('^(?:(?:montre|affiche|ouvre)(?: les| le| la)? |les |le |la )?'+word+'[.! ]*$').test(q)){setFilter(type,value);const count=(briefing.items||[]).filter(matches).length;speak(count+' élément'+(count>1?'s':'')+' dans cette sélection.');return;}}
 if(q==='actualise'||q==='actualiser'){await loadBrief();speak('Le dernier bulletin enregistré est affiché.');return;}
 const help='Cette version en ligne permet de lire le bulletin et de le filtrer à la voix. Dites : Lis le briefing, Déstockages, Appels d’offres, Caraïbes ou Sources. La conversation IA libre nécessite un serveur connecté.'; output(help);speak(help);

}
function setupVoice(){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){$('#micro').disabled=true;$('#micro').textContent='Vocal non pris en charge';status('Reconnaissance vocale indisponible ici. Utilisez un navigateur compatible ou le champ texte.');return;}
 recognition=new SR();recognition.lang='fr-FR';recognition.continuous=false;recognition.interimResults=false;
 recognition.onstart=()=>status('À votre écoute…');
 recognition.onresult=e=>{const text=e.results[0][0].transcript;$('#question').value=text;command(text);};
 recognition.onerror=e=>{if(e.error==='aborted')return;if(e.error==='no-speech'){status('Aucune parole détectée.');return;}listening=false;$('#micro').setAttribute('aria-pressed','false');$('#micro').textContent='◎ Activer le vocal';status(e.error==='not-allowed'?'Microphone refusé. Autorisez-le dans les réglages du navigateur.':'Reconnaissance interrompue : '+e.error);};
 recognition.onend=()=>{if(listening&&!speaking&&!busy)setTimeout(resumeListening,500);};
 $('#micro').onclick=()=>{listening=!listening;$('#micro').setAttribute('aria-pressed',String(listening));$('#micro').textContent=listening?'◉ Vocal activé':'◎ Activer le vocal';if(listening){stopAudio();resumeListening();}else{recognition.abort();status('Microphone désactivé.');}};
}
function selectEdition(value){
 stopAudio();edition=value==='morning'&&bulletin.morningEdition?'morning':'latest';
 briefing=edition==='morning'?bulletin.morningEdition:bulletin;
 $('#morning-edition').hidden=!bulletin.morningEdition;
 if(bulletin.morningEdition)$('#morning-edition').textContent=bulletin.morningEdition.date+' · 7 h (reconstitué)';
 document.querySelectorAll('[data-edition]').forEach(b=>{const active=b.dataset.edition===edition;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 $('#brief-title').textContent=briefing.title||'Le briefing du jour';$('#summary').textContent=briefing.summary||'';
 $('#coverage').textContent=(briefing.date?'Édition du '+briefing.date+' · ':'')+(briefing.coverage||'');
 setFilter('zone','all');setFilter('topic','all');
 const url=new URL(location.href);if(edition==='morning')url.searchParams.set('edition','morning');else url.searchParams.delete('edition');history.replaceState(null,'',url);
}
async function loadBrief(){bulletin=await json('./briefing.json');selectEdition(edition);}

async function init(){
 $('#today').textContent=new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeZone:'America/Martinique'}).format(new Date());
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));
 document.querySelectorAll('[data-zone]').forEach(b=>b.onclick=()=>setFilter('zone',b.dataset.zone));
 document.querySelectorAll('[data-edition]').forEach(b=>b.onclick=()=>selectEdition(b.dataset.edition));
 $('#read').onclick=readBrief;$('#stop').onclick=()=>{stopAudio();status('Lecture arrêtée.');resumeListening();};
 $('#reload').onclick=()=>loadBrief().catch(e=>output(e.message));
 $('#ask-form').onsubmit=e=>{e.preventDefault();const q=$('#question').value.trim();if(q)command(q);};
 setupVoice();
 const [r,s,connection]=await Promise.all([json('./agents.json'),json('./sources.json'),Promise.resolve({aiConfigured:false})]);roles=r;
 $('#connection').textContent='Lecture & commandes vocales';
 const all=el('button','Tous les métiers','chip selected');all.dataset.topic='all';all.onclick=()=>setFilter('topic','all');$('#topic-filters').append(all);
 roles.forEach((r,index)=>{
  if(r.id!=='redacteur'){const b=el('button',r.name,'chip');b.dataset.topic=r.id;b.onclick=()=>setFilter('topic',r.id);$('#topic-filters').append(b);}
  const b=el('button','', 'agent'+(r.id===selectedAgent?' selected':''));b.append(el('span',String(index+1).padStart(2,'0')+' / SPÉCIALISTE'),el('strong',r.name),el('p',r.mission),el('small','Voir la rubrique ↗'));b.onclick=()=>{selectedAgent=r.id;document.querySelectorAll('.agent').forEach(n=>n.classList.remove('selected'));b.classList.add('selected');setFilter('topic',r.id==='redacteur'?'all':r.id);output('Rubrique sélectionnée : '+r.name+'. Dites : Lis le briefing.');$('#question').focus();};$('#team').append(b);
 });
 for(const s0 of s){const c=el('article','','card');c.append(el('small',s0.zone),el('h3',s0.title),el('p',s0.usage),el('p',s0.limit));const a=link(s0.url,'Consulter la source ↗');if(a)c.append(a);$('#sources').append(c);}
 await loadBrief();
}
window.addEventListener('beforeunload',()=>{listening=false;recognition?.abort();stopAudio();});
init().catch(e=>{output(e.message);status('Certaines données n’ont pas pu être chargées.');});
