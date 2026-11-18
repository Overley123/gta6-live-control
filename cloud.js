import { firebaseConfig } from './firebase-config.js?v=20261118-configured';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getDatabase, ref, get, set, update, onValue, serverTimestamp, increment } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

export const cloudReady = Boolean(firebaseConfig.databaseURL && firebaseConfig.projectId && firebaseConfig.apiKey);
let app, db, auth, loginPromise;
let offset = 0;

export function initCloud() {
  if (!cloudReady) throw new Error('Cloud database has not been configured. See Firebase setup instructions.');
  if (!db) {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
    onValue(ref(db, '.info/serverTimeOffset'), snap => { offset = Number(snap.val()) || 0; });
  }
  return db;
}
export async function ensureModeratorIdentity() {
  initCloud();
  if (auth.currentUser) return auth.currentUser;
  if (!loginPromise) {
    loginPromise = signInAnonymously(auth).then(result => result.user).catch(err => {
      loginPromise = null;
      if (err.code === 'auth/operation-not-allowed') throw new Error('Enable Anonymous sign-in in Firebase Authentication → Sign-in method.');
      throw err;
    });
  }
  return loginPromise;
}

export const cloudNow = () => Date.now() + offset;
export function normalizeCode(code) { return String(code || '').toUpperCase().replace(/[^A-Z2-9]/g, '').replace(/[IO01]/g, ''); }
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  const array = new Uint32Array(12);
  crypto.getRandomValues(array);
  return Array.from(array, n => CHARS[n % CHARS.length]).join('');
}
export function humanCode(code) { return `${code.slice(0, 6)}-${code.slice(6)}`; }
export function israelToday(ms = cloudNow()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
export function todaySecondsElapsed(ms = cloudNow()) {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Jerusalem', hour:'2-digit', minute:'2-digit',second:'2-digit', hourCycle:'h23'}).formatToParts(new Date(ms));
  const map = Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
  return (map.hour || 0)*3600 + (map.minute || 0)*60 + (map.second || 0);
}
export function initialScene() {
  return {
    name: 'GTA VI Stream',
    modProtected: true,
    stats: { day: 1, missions: 0, deaths: 0 },
    clock: { totalBase: 0, todayBase: 0, running: false, todayDate: israelToday(), startedAt: 0 },
    layout: { x: 1240, y: 38, scale: 1, opacity: 1 },
    visibility: { day: true, timer: true, missions: true, deaths: true },
    colors: { pink: '#ff2a85', cyan: '#00f5d4', amber: '#ff9e00', red: '#ff4d6d' },
    labels: { day: 'יום', time: 'זמן משחק', missions: 'משימות', deaths: 'מוות' },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}
export function getClockValues(scene, now = cloudNow()) {
  const clock = scene?.clock || {};
  const start = Number(clock.startedAt) || now;
  const elapsed = clock.running ? Math.max(0, Math.floor((now - start) / 1000)) : 0;
  const total = Math.max(0, Math.floor(Number(clock.totalBase) || 0) + elapsed);
  let today = 0;
  if (clock.todayDate === israelToday(now)) {
    today = Math.max(0, Math.floor(Number(clock.todayBase) || 0) + elapsed);
  } else if (clock.running) {
    today = Math.min(elapsed, todaySecondsElapsed(now));
  }
  return { total, today, running: Boolean(clock.running) };
}
async function modDigest(code, modCode) {
  const pin = String(modCode || '').trim();
  if (pin.length < 6 || pin.length > 64) throw new Error('Mod code must contain 6–64 characters.');
  const bytes = new TextEncoder().encode(`LEONIDA-MOD-V1:${normalizeCode(code)}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b=>b.toString(16).padStart(2,'0')).join('');
}
async function grantModeratorAccess(code, digest, user) {
  await set(ref(initCloud(), `modAccess/${code}/${user.uid}`), digest);
}
export async function authorizeModerator(code, modCode) {
  const sceneCode = normalizeCode(code);
  const user = await ensureModeratorIdentity();
  const digest = await modDigest(sceneCode, modCode);
  try {
    await grantModeratorAccess(sceneCode, digest, user);
  } catch (error) {
    if (error.code === 'PERMISSION_DENIED' || error.message?.includes('PERMISSION_DENIED')) {
      throw new Error('Incorrect mod code, or Firebase Database Rules are not updated.');
    }
    throw error;
  }
  return true;
}
export async function sceneInfo(code) {
  const snapshot = await get(ref(initCloud(), `scenes/${normalizeCode(code)}`));
  return snapshot.exists() ? { exists: true, modProtected: snapshot.child('modProtected').val() === true } : { exists: false };
}
export async function setLegacyModerator(code, modCode) {
  const sceneCode = normalizeCode(code), database = initCloud();
  const user = await ensureModeratorIdentity();
  const digest = await modDigest(sceneCode, modCode);
  // Older scenes had no private mod code. This one-time step protects them.
  await set(ref(database, `modCodes/${sceneCode}`), digest);
  await grantModeratorAccess(sceneCode, digest, user);
  await update(ref(database, `scenes/${sceneCode}`), { modProtected: true, updatedAt: serverTimestamp() });
}
export async function createScene(modCode) {
  const database = initCloud(), user = await ensureModeratorIdentity();
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = newCode();
    const loc = ref(database, `scenes/${code}`);
    if ((await get(loc)).exists()) continue;
    const digest = await modDigest(code, modCode);
    try { await set(ref(database, `modCodes/${code}`), digest); }
    catch (err) { if (err.code === 'PERMISSION_DENIED') continue; throw err; }
    await grantModeratorAccess(code, digest, user);
    await set(loc, initialScene());
    return code;
  }
  throw new Error('Could not create the scene. Check Firebase Authentication and Database Rules.');
}
export async function sceneExists(code) {
  const value = await get(ref(initCloud(), `scenes/${normalizeCode(code)}`));
  return value.exists();
}
export function watchScene(code, onData, onError) {
  return onValue(ref(initCloud(), `scenes/${normalizeCode(code)}`), snapshot => onData(snapshot.val()), onError);
}
export async function patchScene(code, updates) {
  const map = {...updates, updatedAt: serverTimestamp()};
  await update(ref(initCloud(), `scenes/${normalizeCode(code)}`), map);
}
export async function stepCounter(code, field, change) {
  await patchScene(code, { [`stats/${field}`]: increment(change) });
}
export async function replaceClock(code, clock) {
  await patchScene(code, {clock: {...clock, todayDate: israelToday(), startedAt: clock.running ? serverTimestamp() : 0 }});
}
