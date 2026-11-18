import { cloudReady, initCloud, normalizeCode, watchScene } from './cloud.js';
import { makeHud } from './hud.js';
const stage=document.getElementById('stage');
const diagnostic=document.getElementById('diagnostic');
const code=normalizeCode(new URLSearchParams(location.search).get('scene'));
function warning(msg){diagnostic.textContent=msg;diagnostic.classList.add('visible');}
function resize(){const s=Math.min(innerWidth/1920,innerHeight/1080);stage.style.transform=`scale(${s})`;}
window.addEventListener('resize',resize);resize();
if(!code || code.length!==12) warning('Scene code missing. Open the OBS link copied from the control studio.');
else if(!cloudReady) warning('Cloud database is not configured. See README.');
else { const hud=makeHud(stage); try{initCloud();watchScene(code,s=>{ if(!s)warning('Scene not found.');else { diagnostic.classList.remove('visible'); hud.update(s); }}, e=>warning('Cloud connection failed: '+e.message));}catch(e){warning(e.message);} }