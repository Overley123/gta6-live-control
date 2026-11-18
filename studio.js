import {cloudReady, initCloud, normalizeCode, humanCode, createScene, sceneInfo, authorizeModerator, setLegacyModerator, watchScene, patchScene, stepCounter, getClockValues, replaceClock, israelToday, initialScene} from './cloud.js?v=20261118-configured';
import {makeHud} from './hud.js';
const $=id=>document.getElementById(id);
const home=$('homeView'), studio=$('studioView');
let code=null, scene=null, unsubscribe=()=>{}, hud=null, stageScale=1, drag=null, toastTimer, pendingStyleTimer;
let pendingStyles={};
const digits=(n,min,max)=>Math.min(max,Math.max(min,Math.floor(Number(n)||0)));
const codeFromUrl=normalizeCode(new URLSearchParams(location.search).get('scene'));
function status(message,ok){$('statusText').textContent=message;$('statusDot').classList.toggle('off',!ok);}
function toast(message,error=false){const el=$('toast');el.textContent=message;el.classList.toggle('error',error);el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3000);}
function fail(error){console.error(error);toast(error?.message||'Something went wrong. Check the cloud connection.',true);}
function obsURL(){return new URL(`overlay.html?scene=${encodeURIComponent(code)}`,location.href).href;}
function controlURL(){return new URL(`index.html?scene=${encodeURIComponent(code)}`,location.href).href;}
async function copy(value){try{await navigator.clipboard.writeText(value);toast('Copied to clipboard');}catch(e){const input=document.createElement('textarea');input.value=value;document.body.appendChild(input);input.select();document.execCommand('copy');input.remove();toast('Copied to clipboard');}}
function requireReady(){if(!cloudReady){toast('Connect Firebase Realtime Database first. See README.md.',true);return false;}return true;}
if(!cloudReady){status('Cloud setup needed',false);$('setupNotice').hidden=false;}else{try{initCloud();status('Cloud configured',true);}catch(e){status('Connection error',false);fail(e);}}
let modalMode='create',modalScene=null,modalBusy=false;
function openModModal(mode,sceneCode=null){
  modalMode=mode;modalScene=sceneCode;$('modForm').reset();$('modError').textContent='';$('accessModal').hidden=false;
  const creating=mode!=='join';
  $('modConfirmWrap').hidden=!creating;$('modConfirm').required=creating;
  $('modModalTitle').textContent=creating?'CREATE MOD CODE':'ENTER MOD CODE';
  $('modModalDescription').textContent=mode==='create'?'Choose your private mod code. Anyone joining the control panel must enter it.':mode==='legacy'?'Secure this older scene by choosing a private mod code now.':'Enter the mod code selected by the creator of this scene.';
  $('modSubmitBtn').textContent=mode==='create'?'CREATE SCENE & SAVE CODE ↗':mode==='legacy'?'SECURE SCENE ↗':'UNLOCK SCENE →';
  $('modPin').setAttribute('autocomplete',creating?'new-password':'current-password');
  $('modPin').placeholder=creating?'Choose a code (6–64 characters)':'Enter moderator code';
  setTimeout(()=>$('modPin').focus(),30);
}
function closeModModal(){if(modalBusy)return;$('accessModal').hidden=true;$('modForm').reset();$('modError').textContent='';}
$('accessClose').onclick=closeModModal;
$('accessBackdrop').onclick=closeModModal;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('accessModal').hidden)closeModModal();});
$('showModPin').onchange=()=>{$('modPin').type=$('showModPin').checked?'text':'password';$('modConfirm').type=$('showModPin').checked?'text':'password';};
$('createBtn').onclick=()=>{if(requireReady())openModModal('create');};
async function promptForScene(wanted){
  const info=await sceneInfo(wanted);
  if(!info.exists){toast('Scene not found. Check the code.',true);return;}
  openModModal(info.modProtected?'join':'legacy',wanted);
}
$('joinForm').onsubmit=async ev=>{ev.preventDefault();if(!requireReady())return;const wanted=normalizeCode($('joinCode').value);if(wanted.length!==12){toast('Please enter a valid 12-character scene code.',true);return;}try{await promptForScene(wanted);}catch(e){fail(e);}};
$('modForm').onsubmit=async ev=>{
 ev.preventDefault();if(modalBusy)return;
 const pin=$('modPin').value.trim(),creating=modalMode!=='join';
 if(pin.length<6||pin.length>64){$('modError').textContent='Use 6–64 characters for your mod code.';return;}
 if(creating&&pin!==$('modConfirm').value.trim()){$('modError').textContent='The codes do not match.';return;}
 modalBusy=true;const button=$('modSubmitBtn'),original=button.textContent;button.disabled=true;button.textContent='CONNECTING...';$('modError').textContent='';
 try {
   let nextCode=modalScene;
   if(modalMode==='create')nextCode=await createScene(pin);
   else if(modalMode==='legacy')await setLegacyModerator(nextCode,pin);
   else await authorizeModerator(nextCode,pin);
   await enterStudio(nextCode);history.replaceState(null,'',controlURL());
   const wasCreate=modalMode==='create';
   modalBusy=false;closeModModal();
   toast(wasCreate?'Scene created! Keep the mod code private.':'Moderator access unlocked!');
 }catch(e){console.error(e);$('modError').textContent=e.message||'Cannot unlock scene. Check your code and Firebase permissions.';}
 finally{modalBusy=false;button.disabled=false;button.textContent=original;}
};
$('homeBtn').onclick=()=>{unsubscribe();unsubscribe=()=>{};if(hud){hud.destroy();hud=null;}code=null;scene=null;studio.hidden=true;home.hidden=false;$('homeBtn').hidden=true;history.replaceState(null,'','./index.html');};
function syncStageScale(){const viewport=$('previewViewport');stageScale=viewport.clientWidth/1920;$('previewStage').style.transform=`scale(${stageScale})`;}
window.addEventListener('resize',syncStageScale);
async function enterStudio(nextCode){unsubscribe();code=nextCode;scene=null;home.hidden=true;studio.hidden=false;$('homeBtn').hidden=false;$('sceneCodeText').textContent=humanCode(code);syncStageScale();if(hud)hud.destroy();hud=makeHud($('previewStage'));hud.node.addEventListener('pointerdown',startDrag);
 unsubscribe=watchScene(code,(snapshot)=>{if(!snapshot){toast('This scene no longer exists.',true);return;}const initial=!scene;scene=snapshot;hud.update(scene);updateReadouts();if(initial)updateForm();},fail);
}
function updateReadouts(){if(!scene)return;const st=scene.stats||{};const layout=scene.layout||{};const time=getClockValues(scene);$('sceneNameText').textContent=scene.name||'GTA VI Stream';$('positionReadout').textContent=`X: ${Math.round(layout.x||0)}   Y: ${Math.round(layout.y||0)}`;$('timerLarge').textContent=fmt(time.total);$('timerStateText').textContent=time.running?'RUNNING':'PAUSED';$('timerToggleBtn').textContent=time.running?'Ⅱ PAUSE TIMER':'▶ START TIMER';$('quickToggle').textContent=time.running?'Ⅱ Pause':'▶ Timer';$('canvasStatus').textContent='Live changes synced';
 for(const k of ['day','missions','deaths']){const el=document.querySelector(`[data-stat="${k}"]`);if(document.activeElement!==el)el.value=st[k]??0;}
 if(document.activeElement!==$('xInput'))$('xInput').value=Math.round(layout.x??1240);
 if(document.activeElement!==$('yInput'))$('yInput').value=Math.round(layout.y??38);
 $('scaleRange').value=Math.round((layout.scale??1)*100);$('scaleValue').textContent=`${$('scaleRange').value}%`;
 $('opacityRange').value=Math.round((layout.opacity??1)*100);$('opacityValue').textContent=`${$('opacityRange').value}%`;
 for(const element of document.querySelectorAll('[data-visibility]'))element.checked=scene.visibility?.[element.dataset.visibility]!==false;
 for(const element of document.querySelectorAll('[data-color]')) if(document.activeElement!==element)element.value=scene.colors?.[element.dataset.color]??'#ffffff';
 for(const element of document.querySelectorAll('input[data-label]'))if(document.activeElement!==element)element.value=scene.labels?.[element.dataset.label]??'';
}
function updateForm(){if(!scene)return;const values=getClockValues(scene);$('totalInput').value=fmt(values.total);$('todayInput').value=fmt(values.today);}
function fmt(n){n=Math.max(0,Math.floor(n||0));return `${Math.floor(n/3600)}:${String(Math.floor(n%3600/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function parseTime(value){const parts=String(value).trim().split(':');if(parts.length>3||parts.length<2||parts.some(x=>!/^\d+$/.test(x)))throw new Error('Enter time as H:MM:SS');let h=0,m=0,s=0;if(parts.length===3)[h,m,s]=parts.map(Number);else [m,s]=parts.map(Number);if(m>=60||s>=60||h>100000)throw new Error('Time has invalid minutes or seconds.');return h*3600+m*60+s;}
$('copyCodeBtn').onclick=()=>code&&copy(humanCode(code));$('copyObsBtn').onclick=()=>code&&copy(obsURL());$('openObsBtn').onclick=()=>code&&window.open(obsURL(),'_blank','noopener');$('copyControlBtn').onclick=()=>code&&copy(controlURL());
$('renameBtn').onclick=async()=>{if(!scene)return;const value=prompt('Scene name',scene.name||'GTA VI Stream');if(value===null)return;const trimmed=value.trim().slice(0,60);if(trimmed)try{await patchScene(code,{name:trimmed});}catch(e){fail(e);}};
for(const btn of document.querySelectorAll('[data-tab]'))btn.onclick=()=>{for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b===btn);for(const tab of ['stats','clock','look'])$(tab==='stats'?'statsPanel':tab==='clock'?'clockPanel':'lookPanel').hidden=tab!==btn.dataset.tab;if(btn.dataset.tab==='clock')updateForm();};
async function changeCounter(key,delta){if(!scene)return;const cur=Number(scene.stats?.[key])||0;const bottom=key==='day'?1:0;const top=key==='day'?99999:999999;if(cur+delta<bottom||cur+delta>top)return;try{await stepCounter(code,key,delta);if(key==='day'&&delta>0)await resetToday();}catch(e){fail(e);}}
for(const btn of document.querySelectorAll('[data-step]'))btn.onclick=()=>{const [key,amount]=btn.dataset.step.split(':');changeCounter(key,Number(amount));};
for(const btn of document.querySelectorAll('[data-quick]'))btn.onclick=()=>{if(btn.dataset.quick==='clock')toggleTimer();else changeCounter(btn.dataset.quick,Number(btn.dataset.delta));};
for(const input of document.querySelectorAll('[data-stat]'))input.onchange=async()=>{if(!scene)return;const key=input.dataset.stat;const value=digits(input.value,key==='day'?1:0,key==='day'?99999:999999);try{await patchScene(code,{[`stats/${key}`]:value});}catch(e){fail(e);}};
$('resetStatsBtn').onclick=async()=>{if(!scene||!confirm('Reset day to 1, missions to 0 and deaths to 0?'))return;try{await patchScene(code,{'stats/day':1,'stats/missions':0,'stats/deaths':0});toast('Counters reset');}catch(e){fail(e);}};
function clockValues(){return getClockValues(scene);}
async function toggleTimer(){if(!scene)return;const c=clockValues();try{await replaceClock(code,{totalBase:c.total,todayBase:c.today,running:!c.running});}catch(e){fail(e);}}
$('timerToggleBtn').onclick=toggleTimer;
async function setClockPart(part){if(!scene)return;const input=part==='total'?'totalInput':'todayInput';try{const value=parseTime($(input).value),c=clockValues();await replaceClock(code,{totalBase:part==='total'?value:c.total,todayBase:part==='today'?value:c.today,running:c.running});toast('Timer updated');}catch(e){fail(e);}}
$('setTotalBtn').onclick=()=>setClockPart('total');$('setTodayBtn').onclick=()=>setClockPart('today');
async function resetToday(){if(!scene)return;const c=clockValues();await replaceClock(code,{totalBase:c.total,todayBase:0,running:c.running});}
$('resetTodayBtn').onclick=async()=>{if(!confirm("Reset today's timer?"))return;try{await resetToday();toast("Today's time reset");}catch(e){fail(e);}};
$('resetAllBtn').onclick=async()=>{if(!scene||!confirm('Reset all counters AND timers? This cannot be undone.'))return;try{await patchScene(code,{'stats/day':1,'stats/missions':0,'stats/deaths':0});await replaceClock(code,{totalBase:0,todayBase:0,running:false});toast('Everything reset');}catch(e){fail(e);}};
function updateStyle(path,value){if(!scene)return;const [group,key]=path.split('/');scene={...scene,[group]:{...(scene[group]||{}),[key]:value}};hud.update(scene);updateReadouts();pendingStyles[path]=value;clearTimeout(pendingStyleTimer);pendingStyleTimer=setTimeout(async()=>{const changes={...pendingStyles};pendingStyles={};try{await patchScene(code,changes);}catch(e){fail(e);}},180);}
for(const id of ['xInput','yInput'])$(id).addEventListener('change',ev=>{if(!scene)return;const path='layout/'+(id==='xInput'?'x':'y');updateStyle(path,digits(ev.target.value,0,id==='xInput'?1900:1040));});
$('scaleRange').oninput=ev=>updateStyle('layout/scale',Number(ev.target.value)/100);
$('opacityRange').oninput=ev=>updateStyle('layout/opacity',Number(ev.target.value)/100);
for(const el of document.querySelectorAll('[data-visibility]'))el.onchange=()=>updateStyle('visibility/'+el.dataset.visibility,el.checked);
for(const el of document.querySelectorAll('[data-color]'))el.oninput=()=>updateStyle('colors/'+el.dataset.color,el.value);
for(const el of document.querySelectorAll('input[data-label]'))el.onchange=()=>updateStyle('labels/'+el.dataset.label,el.value.trim().slice(0,24));
$('resetStyleBtn').onclick=async()=>{if(!scene||!confirm('Restore overlay appearance and position?'))return;const starter=initialScene();try{await patchScene(code,{layout:starter.layout,visibility:starter.visibility,colors:starter.colors,labels:starter.labels});toast('Appearance reset');}catch(e){fail(e);}};
function startDrag(e){if(!scene||e.button!==0)return;e.preventDefault();drag={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:scene.layout?.x||0,y:scene.layout?.y||0};hud.node.setPointerCapture(e.pointerId);hud.node.addEventListener('pointermove',moveDrag);hud.node.addEventListener('pointerup',endDrag,{once:true});hud.node.addEventListener('pointercancel',endDrag,{once:true});}
function moveDrag(e){if(!drag||e.pointerId!==drag.pointerId||!scene)return;const x=digits(drag.x+(e.clientX-drag.startX)/stageScale,0,1900),y=digits(drag.y+(e.clientY-drag.startY)/stageScale,0,1040);scene={...scene,layout:{...scene.layout,x,y}};hud.update(scene);$('positionReadout').textContent=`X: ${x}   Y: ${y}`;}
async function endDrag(e){if(!drag||e.pointerId!==drag.pointerId)return;hud.node.removeEventListener('pointermove',moveDrag);drag=null;try{await patchScene(code,{'layout/x':scene.layout.x,'layout/y':scene.layout.y});}catch(err){fail(err);}}
setInterval(()=>{if(scene){const c=getClockValues(scene);$('timerLarge').textContent=fmt(c.total);}},1000);
if(codeFromUrl.length===12 && cloudReady)promptForScene(codeFromUrl).catch(fail);