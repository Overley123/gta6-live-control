import { getClockValues } from './cloud.js';
const dflt = { stats:{day:1,missions:0,deaths:0}, visibility:{day:true,timer:true,missions:true,deaths:true}, layout:{x:1240,y:38,scale:1,opacity:1}, colors:{pink:'#ff2a85',cyan:'#00f5d4',amber:'#ff9e00',red:'#ff4d6d'}, labels:{day:'יום',time:'זמן משחק',missions:'משימות',deaths:'מוות'} };
export function makeHud(host) {
  const node=document.createElement('div'); node.className='leonida-hud';
  node.innerHTML=`<div class="stats-row">
    <div class="day-badge" data-block="day"><span class="day-title" data-label="day">יום</span><span class="big-num day-num" data-value="day">1</span></div>
    <div class="timer-block" data-block="timer"><div class="time-head"><span class="top-label time-label"><i class="live-dot"></i><span data-label="time">זמן משחק</span></span><span class="today-pill">היום: <span data-value="today">0:00</span></span></div><div class="total-clock" data-value="total">0:00:00</div></div>
    <div class="sep" data-sep="1"></div>
    <div class="stat-block" data-block="missions"><span class="top-label">✔ <span data-label="missions">משימות</span></span><div class="stat-number"><span class="big-num" data-value="missions">0</span><span class="stat-sub">הושלמו</span></div></div>
    <div class="sep" data-sep="2"></div>
    <div class="stat-block" data-block="deaths"><span class="top-label death-label">☠ <span data-label="deaths">מוות</span></span><div class="stat-number"><span class="big-num" data-value="deaths">0</span><span class="stat-sub">פעמים</span></div></div>
  </div>`;
  host.appendChild(node);
  const one = sel => node.querySelector(sel);
  let last;
  function update(scene) {
    if (!scene) return;
    last=scene;
    const stats={...dflt.stats,...scene.stats};
    const layout={...dflt.layout,...scene.layout};
    const visibility={...dflt.visibility,...scene.visibility};
    const colors={...dflt.colors,...scene.colors};
    const labels={...dflt.labels,...scene.labels};
    node.style.left=`${Math.min(1900, Math.max(0, Number(layout.x)||0))}px`;
    node.style.top=`${Math.min(1040, Math.max(0, Number(layout.y)||0))}px`;
    node.style.setProperty('--hud-scale', Math.max(.25,Math.min(4,Number(layout.scale)||1)));
    node.style.setProperty('--hud-opacity', Math.max(.1,Math.min(1, Number(layout.opacity)||1)));
    for(const color of ['pink','cyan','amber','red']) if(/^#[0-9a-fA-F]{6}$/.test(colors[color])) node.style.setProperty('--'+color,colors[color]);
    for(const key of ['day','timer','missions','deaths']) one(`[data-block="${key}"]`).classList.toggle('is-hidden',visibility[key] === false);
    const active=['day','timer','missions','deaths'].filter(k=>visibility[k]!==false);
    one('[data-sep="1"]').classList.toggle('is-hidden',!(active.includes('timer') && active.some(x=>['missions','deaths'].includes(x))));
    one('[data-sep="2"]').classList.toggle('is-hidden',!(active.includes('missions') && active.includes('deaths')));
    for(const key of ['day','time','missions','deaths']) one(`[data-label="${key}"]`).textContent=labels[key];
    for(const key of ['day','missions','deaths']) one(`[data-value="${key}"]`).textContent=stats[key];
    tick();
  }
  function tick() {
    if (!last) return;
    const {total,today,running}=getClockValues(last);
    one('[data-value="today"]').textContent=`${Math.floor(today/3600)}:${pad(Math.floor(today%3600/60))}`;
    one('[data-value="total"]').textContent=`${Math.floor(total/3600)}:${pad(Math.floor(total%3600/60))}:${pad(total%60)}`;
    node.classList.toggle('is-paused',!running);
  }
  const timer=setInterval(tick,250);
  return {node,update,tick,destroy:()=>{clearInterval(timer);node.remove();}};
}
const pad=n=>String(n).padStart(2,'0');