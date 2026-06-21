/* =========================================================
   Métabolyse — application logic v2
   Password: root
   Cloud sync: JSONBin.io (optional)
   ========================================================= */

const PASSWORD = 'root';
const STORAGE_KEY = 'metabolyse:data:v2';
const THEME_KEY   = 'metabolyse:theme';
const AUTH_KEY    = 'metabolyse:auth';

/* =========================================================
   STORE — local + optional cloud sync via JSONBin.io
   ========================================================= */
const Store = {
  load(){
    try{ const r=localStorage.getItem(STORAGE_KEY); return r?JSON.parse(r):null; }
    catch(e){ return null; }
  },
  save(data){ localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); },
  init(){
    return { profile:null, logs:{}, goals:{}, journal:[] };
  },
  async push(data){
    const p = data.profile;
    if(!p?.jsonbinKey || !p?.jsonbinId) return false;
    try{
      const r = await fetch(`https://api.jsonbin.io/v3/b/${p.jsonbinId}`,{
        method:'PUT',
        headers:{'Content-Type':'application/json','X-Master-Key':p.jsonbinKey},
        body: JSON.stringify(data)
      });
      return r.ok;
    }catch(e){ return false; }
  },
  async pull(key, id){
    try{
      const r = await fetch(`https://api.jsonbin.io/v3/b/${id}/latest`,{
        headers:{'X-Master-Key':key}
      });
      if(!r.ok) return null;
      const j = await r.json();
      return j.record || null;
    }catch(e){ return null; }
  }
};

let DB = Store.load() || Store.init();
function persist(){
  Store.save(DB);
  const p=DB.profile;
  if(!p?.jsonbinKey || !p?.jsonbinId) return;
  // Pull the latest remote state first and merge it in, so pushing never erases
  // entries that exist only on the other device but haven't been pulled here yet.
  Store.pull(p.jsonbinKey,p.jsonbinId).then(remote=>{
    if(remote?.logs) mergeRemoteLogs(remote.logs);
    Store.save(DB);
    return Store.push(DB);
  }).then(ok=>{
    if(ok) showToast('✓ Données synchronisées');
  });
}

// Merge remote logs into DB.logs, keeping whichever version of each day is most recent.
// Entries without an updatedAt timestamp are treated as old/legacy and lose to any timestamped entry.
function mergeRemoteLogs(remoteLogs){
  if(!remoteLogs) return false;
  let changed=false;
  Object.keys(remoteLogs).forEach(date=>{
    const remote=remoteLogs[date];
    const local=DB.logs[date];
    if(!local){ DB.logs[date]=remote; changed=true; return; }
    const localTs=local.updatedAt||0;
    const remoteTs=remote.updatedAt||0;
    if(remoteTs>localTs){ DB.logs[date]=remote; changed=true; }
  });
  return changed;
}

/* =========================================================
   DATE HELPERS
   ========================================================= */
const todayISO = () => new Date().toISOString().slice(0,10);
const addDays  = (iso,n) => { const d=new Date(iso); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
const daysBetween = (a,b) => Math.round((new Date(b)-new Date(a))/86400000);
const fmt1 = n => (n==null||isNaN(n)) ? '—' : n.toFixed(1);
const fmt0 = n => (n==null||isNaN(n)) ? '—' : Math.round(n).toString();
const fmtDate = iso => new Date(iso).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});

function age(birthdate){
  const b=new Date(birthdate), n=new Date();
  let a=n.getFullYear()-b.getFullYear();
  if(n.getMonth()<b.getMonth()||(n.getMonth()===b.getMonth()&&n.getDate()<b.getDate())) a--;
  return a;
}

/* =========================================================
   METABOLISM CALCULATIONS
   ========================================================= */
function mifflinStJeor({sex,weight,height,ageYears}){
  const base = 10*weight + 6.25*height - 5*ageYears;
  return sex==='male' ? base+5 : base-161;
}
function katchMcArdle({weight,bodyfatPct}){
  const lm = weight*(1-bodyfatPct/100);
  return 370 + 21.6*lm;
}

// Adjust BMR from manual base using weight/body-composition evolution
function computeCurrentBMR(profile, currentWeight, currentBodyfat){
  const baseBMR = profile.baseBMR || 1800;
  // scale by weight relative to start weight
  const startW = profile.startWeight || profile.weight || currentWeight;
  if(startW <= 0) return baseBMR;
  // Use Mifflin-St Jeor to derive scaling factor from weight change
  const mStart = mifflinStJeor({sex:profile.sex,weight:startW,height:profile.height,ageYears:age(profile.birthdate)});
  const mNow   = mifflinStJeor({sex:profile.sex,weight:currentWeight,height:profile.height,ageYears:age(profile.birthdate)});
  let bmr = baseBMR * (mNow / (mStart||1));
  // Refine with Katch-McArdle if we have body-fat
  if(currentBodyfat && currentBodyfat > 0 && currentBodyfat < 60){
    const katch = katchMcArdle({weight:currentWeight, bodyfatPct:currentBodyfat});
    bmr = bmr*0.4 + katch*0.6;
  }
  return Math.round(bmr);
}

function getLogsSorted(){
  return Object.values(DB.logs).sort((a,b)=>a.date<b.date?-1:1);
}
function getLatestField(field,before){
  const logs=getLogsSorted().filter(l=>l[field]!=null&&(!before||l.date<=before));
  return logs.length ? logs[logs.length-1][field] : null;
}
function estimateBodyfat(date){
  // linear interpolation between known values
  const all = getLogsSorted().filter(l=>l.bodyfat!=null);
  if(!all.length) return DB.profile?.bodyfat || null;
  const before = all.filter(l=>l.date<=date);
  const after  = all.filter(l=>l.date> date);
  if(!before.length) return after[0].bodyfat;
  if(!after.length)  return before[before.length-1].bodyfat;
  const b=before[before.length-1], a=after[0];
  const span = daysBetween(b.date,a.date)||1;
  const t    = daysBetween(b.date,date)/span;
  return b.bodyfat + t*(a.bodyfat - b.bodyfat);
}
function estimateMuscle(date){
  const all = getLogsSorted().filter(l=>l.muscle!=null);
  if(!all.length) return DB.profile?.muscle || null;
  const before = all.filter(l=>l.date<=date);
  const after  = all.filter(l=>l.date> date);
  if(!before.length) return after[0].muscle;
  if(!after.length)  return before[before.length-1].muscle;
  const b=before[before.length-1], a=after[0];
  const span=daysBetween(b.date,a.date)||1;
  const t=daysBetween(b.date,date)/span;
  return b.muscle + t*(a.muscle - b.muscle);
}

// Adaptive BMR: infer from weight change vs declared intake
function computeAdaptiveBMR(profile){
  const logs = getLogsSorted().filter(l=>l.calories!=null);
  const wNow  = getLatestField('weight') ?? profile.weight;
  const bfNow = getLatestField('bodyfat') ?? profile.bodyfat;
  const theoBMR = computeCurrentBMR(profile, wNow, bfNow);
  if(logs.length < 10) return {theoretical:theoBMR, adapted:theoBMR, gap:0};
  const win = logs.slice(-21);
  const firstW = getLatestField('weight',win[0].date) ?? profile.weight;
  const lastW  = getLatestField('weight',win[win.length-1].date) ?? firstW;
  const days   = daysBetween(win[0].date,win[win.length-1].date)||1;
  const wDelta = lastW-firstW;
  const impliedBalance = (wDelta*7700)/days;
  const avgIntake = win.reduce((s,l)=>s+l.calories,0)/win.length;
  const actualTDEE = avgIntake - impliedBalance;
  // TDEE = BMR * 1 (we store sport separately) — no activity factor needed
  const adaptedBMR = actualTDEE;
  const blended = theoBMR*0.45 + adaptedBMR*0.55;
  const clamped = Math.max(theoBMR*0.75, Math.min(theoBMR*1.1, blended));
  return {theoretical:Math.round(theoBMR), adapted:Math.round(clamped), gap:Math.round(clamped-theoBMR)};
}

// Get total sport calories for a log entry
function getSportKcal(log){
  if(!log?.sports?.length) return 0;
  return log.sports.reduce((s,a)=>s+(parseFloat(a.kcal)||0),0);
}

// TDEE = adaptive BMR + sport burned today
function getTDEE(adaptedBMR, sportKcal){
  return Math.round(adaptedBMR + sportKcal);
}

/* =========================================================
   SERIES BUILDERS
   ========================================================= */
function buildWeightSeries(){
  return getLogsSorted().filter(l=>l.weight!=null).map(l=>({date:l.date,value:l.weight}));
}
function buildSeries(field){
  return getLogsSorted().filter(l=>l[field]!=null).map(l=>({date:l.date,value:l[field]}));
}
function buildCompositionKg(){
  // return {date, fat, muscle, lean} series with estimation for missing days
  return getLogsSorted().filter(l=>l.weight!=null).map(l=>{
    const w  = l.weight;
    const bf = l.bodyfat ?? estimateBodyfat(l.date) ?? 0;
    const mm = l.muscle  ?? estimateMuscle(l.date)  ?? 0;
    return {
      date: l.date,
      fat:   parseFloat((w*bf/100).toFixed(2)),
      muscle:parseFloat((w*mm/100).toFixed(2)),
      lean:  parseFloat((w*(1-bf/100)).toFixed(2))
    };
  });
}
function movingAverage(series,w){
  return series.map((pt,i)=>{
    const sl=series.slice(Math.max(0,i-w+1),i+1).filter(p=>p.value!=null);
    return {date:pt.date, value:sl.length?sl.reduce((s,p)=>s+p.value,0)/sl.length:null};
  });
}

/* =========================================================
   DEFICIT / BALANCE
   ========================================================= */
function dailyBalance(log, adaptedBMR){
  if(!log||log.calories==null) return null;
  const sport = getSportKcal(log);
  const tdee  = getTDEE(adaptedBMR, sport);
  return log.calories - tdee;
}
function statusFromBalance(b){
  if(b===null) return 'unknown';
  if(b<=-400)  return 'deficit-strong';
  if(b<=-100)  return 'deficit-light';
  if(b<150)    return 'maintenance';
  if(b<500)    return 'surplus-light';
  return 'surplus-strong';
}
const STATUS_LABEL={
  'deficit-strong':'Déficit optimal','deficit-light':'Déficit léger',
  'maintenance':'Maintenance','surplus-light':'Surplus léger',
  'surplus-strong':'Surplus important','unknown':'Pas de donnée'
};

/* =========================================================
   SCORES
   ========================================================= */
function computeScores(){
  const bf=buildSeries('bodyfat'), mm=buildSeries('muscle'), w=buildWeightSeries();
  if(w.length<2) return {fle:null,mps:null};
  const wLoss=w[0].value-w[w.length-1].value;
  let fle=null, mps=null;
  if(bf.length>=2){
    const bfDrop=bf[0].value-bf[bf.length-1].value;
    fle=Math.max(0,Math.min(100,Math.round((bfDrop/(wLoss||1))*40+50)));
  }
  if(mm.length>=2){
    const mmD=mm[mm.length-1].value-mm[0].value;
    mps=Math.max(0,Math.min(100,Math.round(70+mmD*20)));
  }
  return {fle,mps};
}

/* =========================================================
   PREDICTIONS
   ========================================================= */
function predictWeight(daysAhead){
  const w=buildWeightSeries();
  if(w.length<4) return null;
  const days=daysBetween(w[0].date,w[w.length-1].date)||1;
  const perDay=(w[w.length-1].value-w[0].value)/days;
  return w[w.length-1].value+perDay*daysAhead;
}
function estimateGoalDate(targetWeight){
  const w=buildWeightSeries();
  if(w.length<4||!targetWeight) return null;
  const days=daysBetween(w[0].date,w[w.length-1].date)||1;
  const perDay=(w[w.length-1].value-w[0].value)/days;
  if(perDay>=0) return null; // gaining weight
  const remaining=w[w.length-1].value-targetWeight;
  if(remaining<=0) return 'Objectif atteint !';
  const daysNeeded=Math.ceil(remaining/Math.abs(perDay));
  return fmtDate(addDays(todayISO(),daysNeeded));
}

/* =========================================================
   INSIGHTS ENGINE
   ========================================================= */
function generateInsights(profile){
  const ins=[];
  const w=buildWeightSeries();
  const logs=getLogsSorted();
  const {adapted}=computeAdaptiveBMR(profile);
  if(w.length>=2){
    const days=daysBetween(w[0].date,w[w.length-1].date)||1;
    const perWk=(w[0].value-w[w.length-1].value)/days*7;
    if(Math.abs(perWk)>0.05)
      ins.push(`Tu ${perWk>0?'perds':'prends'} en moyenne ${Math.abs(perWk).toFixed(2)} kg/semaine.`);
  }
  const wCal=logs.filter(l=>l.calories!=null);
  if(wCal.length>=5){
    const tdeeBase=getTDEE(adapted,0);
    const avg14=wCal.slice(-14);
    const avgIntake=avg14.reduce((s,l)=>s+l.calories,0)/avg14.length;
    const avgSport=avg14.reduce((s,l)=>s+getSportKcal(l),0)/avg14.length;
    const avgDef=tdeeBase+avgSport-avgIntake;
    if(Math.abs(avgDef)>30)
      ins.push(`Ton ${avgDef>0?'déficit':'surplus'} moyen (14j) est de ${Math.abs(Math.round(avgDef))} kcal/j (sport inclus).`);
  }
  const {theoretical,adapted:adBMR}=computeAdaptiveBMR(profile);
  if(theoretical>0){
    const pct=Math.round(((adBMR-theoretical)/theoretical)*100);
    if(pct<=-3) ins.push(`Ton métabolisme semble avoir ralenti de ${Math.abs(pct)}% — envisage un repas de recharge.`);
    if(pct>=3)  ins.push(`Ton métabolisme semble s'être accéléré de ${pct}%.`);
  }
  // plateau
  if(w.length>=14){
    const r=w.slice(-14);
    const span=Math.max(...r.map(p=>p.value))-Math.min(...r.map(p=>p.value));
    if(span<0.4&&wCal.slice(-14).length>=10)
      ins.push('Ton poids stagne depuis 14 jours malgré un déficit déclaré : possible plateau ou rétention d\'eau.');
  }
  // sleep warning
  const recentSleep=logs.filter(l=>l.sleepDuration!=null).slice(-7);
  if(recentSleep.length>=3){
    const avg=recentSleep.reduce((s,l)=>s+l.sleepDuration,0)/recentSleep.length;
    if(avg<6.5) ins.push(`Ton sommeil moyen est de ${avg.toFixed(1)}h sur 7 jours — un manque de sommeil peut freiner la perte de graisse.`);
  }
  // goal ETA
  if(DB.goals.targetWeight&&w.length>=4){
    const eta=estimateGoalDate(DB.goals.targetWeight);
    if(eta&&eta!=='Objectif atteint !') ins.push(`À ton rythme actuel, tu atteindras ton objectif poids aux alentours du ${eta}.`);
    if(eta==='Objectif atteint !') ins.push('🎉 Objectif de poids atteint !');
  }
  if(!ins.length) ins.push('Continue à renseigner tes données quotidiennes pour débloquer des analyses personnalisées.');
  return ins;
}

/* =========================================================
   BADGES
   ========================================================= */
function computeBadges(){
  const w=buildWeightSeries();
  const logs=getLogsSorted();
  const wLost=w.length>=2 ? w[0].value-w[w.length-1].value : 0;
  const nDays=logs.filter(l=>l.calories!=null).length;
  const bf=buildSeries('bodyfat');
  const bfLost=bf.length>=2 ? bf[0].value-bf[bf.length-1].value : 0;
  const mm=buildSeries('muscle');
  const mmGain=mm.length>=2 ? mm[mm.length-1].value-mm[0].value : 0;
  const streak=computeStreakDays();
  const sportDays=countSportDays();

  return [
    {group:'Constance', items:[
      {icon:'🏅',name:'Premier pas', desc:'1ère saisie',  earned:nDays>=1},
      {icon:'📅',name:'7 jours',     desc:'7 jours de suivi', earned:nDays>=7},
      {icon:'🗓️',name:'1 mois',      desc:'30 jours de suivi', earned:nDays>=30},
      {icon:'📈',name:'3 mois',      desc:'90 jours de suivi', earned:nDays>=90},
      {icon:'🧭',name:'6 mois',      desc:'180 jours de suivi', earned:nDays>=180},
    ]},
    {group:'Poids perdu', items:[
      {icon:'🔥',name:'-1 kg',  desc:'1 kg perdu',  earned:wLost>=1},
      {icon:'💪',name:'-5 kg',  desc:'5 kg perdus', earned:wLost>=5},
      {icon:'🏆',name:'-10 kg', desc:'10 kg perdus',earned:wLost>=10},
      {icon:'🚀',name:'-15 kg', desc:'15 kg perdus',earned:wLost>=15},
      {icon:'👑',name:'-20 kg', desc:'20 kg perdus',earned:wLost>=20},
    ]},
    {group:'Composition corporelle', items:[
      {icon:'📉',name:'Graisse -1%', desc:'1% de masse grasse perdue', earned:bfLost>=1},
      {icon:'📉',name:'Graisse -3%', desc:'3% de masse grasse perdue', earned:bfLost>=3},
      {icon:'📉',name:'Graisse -5%', desc:'5% de masse grasse perdue', earned:bfLost>=5},
      {icon:'🦾',name:'Muscle +1%',  desc:'1% de masse musculaire gagnée', earned:mmGain>=1},
      {icon:'🦾',name:'Muscle +2%',  desc:'2% de masse musculaire gagnée', earned:mmGain>=2},
    ]},
    {group:'Discipline', items:[
      {icon:'🎯',name:'Déficit 7j',  desc:'7 jours de déficit consécutifs',  earned:streak>=7},
      {icon:'🎯',name:'Déficit 14j', desc:'14 jours de déficit consécutifs', earned:streak>=14},
      {icon:'🎯',name:'Déficit 30j', desc:'30 jours de déficit consécutifs', earned:streak>=30},
    ]},
    {group:'Sport', items:[
      {icon:'⚡',name:'Sport ×5',  desc:'5 séances sportives',  earned:sportDays>=5},
      {icon:'⚡',name:'Sport ×20', desc:'20 séances sportives', earned:sportDays>=20},
      {icon:'⚡',name:'Sport ×50', desc:'50 séances sportives', earned:sportDays>=50},
    ]},
  ];
}
function computeStreakDays(){
  const {adapted}=computeAdaptiveBMR(DB.profile);
  const logs=getLogsSorted().filter(l=>l.calories!=null);
  let streak=0, max=0;
  logs.forEach(l=>{
    const b=dailyBalance(l,adapted);
    if(b!=null&&b<0){ streak++; max=Math.max(max,streak); }
    else streak=0;
  });
  return max;
}
function countSportDays(){
  return getLogsSorted().filter(l=>l.sports&&l.sports.length>0).length;
}

/* =========================================================
   RENDERING HELPERS
   ========================================================= */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function showToast(msg){
  let t=$('#sync-toast');
  if(!t){
    t=document.createElement('div');
    t.id='sync-toast';
    t.className='sync-toast';
    document.body.appendChild(t);
  }
  t.textContent=msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer=setTimeout(()=>t.classList.add('hidden'),2500);
}

/* =========================================================
   RENDER — DASHBOARD
   ========================================================= */
function renderWelcome(){
  const hour=new Date().getHours();
  const greet = hour<6?'Bonsoir':hour<12?'Bonjour':hour<18?'Bonjour':'Bonsoir';
  const wEl=$('#welcome-greeting');
  if(wEl) wEl.textContent=`${greet}, Mathéo 👋`;
  const subEl=$('#welcome-sub');
  if(subEl){
    const log=DB.logs[todayISO()];
    subEl.textContent = log?.calories!=null
      ? 'Ta saisie du jour est enregistrée — continue comme ça !'
      : "Pense à faire ta saisie du jour pour garder ton suivi à jour.";
  }
}

function renderDashboard(){
  const p=DB.profile;
  if(!p) return;
  renderWelcome();
  const today=todayISO();
  const log=DB.logs[today];
  const wNow  = getLatestField('weight')  ?? p.weight;
  const bfNow = getLatestField('bodyfat') ?? p.bodyfat;
  const {adapted}=computeAdaptiveBMR(p);
  const sportNow=getSportKcal(log);
  const tdee=getTDEE(adapted,sportNow);

  // BMR cards
  $('#bmr-manual').textContent = fmt0(p.baseBMR)+' kcal';
  $('#bmr-adapt').textContent  = fmt0(adapted)+' kcal';
  $('#tdee-total').textContent = fmt0(tdee)+' kcal';

  // Calories
  const consumed=log?.calories??0;
  $('#cal-consumed').textContent=fmt0(consumed);
  $('#cal-target').textContent=fmt0(tdee);
  const pct=tdee?Math.min(100,Math.round((consumed/tdee)*100)):0;
  $('#cal-progress').style.width=pct+'%';
  $('#cal-remaining').textContent=fmt0(tdee-consumed)+' kcal';
  $('#cal-sport-today').textContent=fmt0(sportNow);

  // Deficit
  const bal=dailyBalance(log,adapted);
  const status=statusFromBalance(bal);
  $('#deficit-day').textContent=bal!=null?(bal>0?'+':'')+fmt0(bal)+' kcal':'—';
  const chip=$('#deficit-status');
  chip.textContent=STATUS_LABEL[status];
  chip.className='status-chip '+(status.startsWith('deficit')?'ok':status==='maintenance'?'warn':status.startsWith('surplus')?'bad':'');

  const logs=getLogsSorted();
  const dNow=today;
  const wkLogs=logs.filter(l=>l.calories!=null&&daysBetween(l.date,dNow)<=7);
  const moLogs=logs.filter(l=>l.calories!=null&&daysBetween(l.date,dNow)<=30);
  const avgBal=arr=>arr.length?arr.reduce((s,l)=>s+(l.calories-getTDEE(adapted,getSportKcal(l))),0)/arr.length:null;
  const wb=avgBal(wkLogs), mb=avgBal(moLogs);
  $('#deficit-week').textContent=wb!=null?(wb>0?'+':'')+fmt0(wb)+' kcal':'—';
  $('#deficit-month').textContent=mb!=null?(mb>0?'+':'')+fmt0(mb)+' kcal':'—';

  // Weight
  $('#weight-current').textContent=fmt1(wNow);
  const w7=getLatestField('weight',addDays(today,-7));
  const w30=getLatestField('weight',addDays(today,-30));
  $('#weight-week').textContent=w7!=null?((wNow-w7)>=0?'+':'')+fmt1(wNow-w7)+' kg':'—';
  $('#weight-month').textContent=w30!=null?((wNow-w30)>=0?'+':'')+fmt1(wNow-w30)+' kg':'—';

  // Composition
  const mmNow=getLatestField('muscle')??p.muscle;
  const bfKg=bfNow!=null&&wNow?(wNow*bfNow/100):null;
  const mmKg=mmNow!=null&&wNow?(wNow*mmNow/100):null;
  const leanKg=bfKg!=null&&wNow?(wNow-bfKg):null;
  $('#bf-pct').textContent=fmt1(bfNow)+'%';
  $('#bf-kg').textContent=bfKg!=null?fmt1(bfKg)+' kg':'';
  $('#mm-pct').textContent=fmt1(mmNow)+'%';
  $('#mm-kg').textContent=mmKg!=null?fmt1(mmKg)+' kg':'';
  $('#lean-kg').textContent=leanKg!=null?fmt1(leanKg)+' kg':'—';
  // % of weight loss from fat
  const wSeries=buildWeightSeries();
  const bfSeries=buildSeries('bodyfat');
  if(wSeries.length>=2&&bfSeries.length>=2){
    const wDelta=wSeries[0].value-wSeries[wSeries.length-1].value;
    const bfKgStart=wSeries[0].value*bfSeries[0].value/100;
    const bfKgEnd  =wNow*(bfNow??bfSeries[bfSeries.length-1].value)/100;
    const fatLost  =bfKgStart-bfKgEnd;
    const pctFat   =wDelta>0?Math.round((fatLost/wDelta)*100):null;
    $('#fat-loss-pct').textContent=pctFat!=null?pctFat+'%':'—';
  } else { $('#fat-loss-pct').textContent='—'; }

  // Scores
  const sc=computeScores();
  $('#score-fle').textContent=sc.fle!=null?sc.fle+'/100':'—';
  $('#score-mps').textContent=sc.mps!=null?sc.mps+'/100':'—';

  // Sleep last night
  const slLog=getLogsSorted().filter(l=>l.sleepDuration!=null||l.sleepScore!=null).reverse()[0];
  if(slLog){
    const parts=[];
    if(slLog.sleepDuration) parts.push(slLog.sleepDuration+'h');
    if(slLog.sleepScore)    parts.push('score '+slLog.sleepScore);
    $('#sleep-dash').textContent=parts.join(' · ');
  }

  // Insights
  const insights=generateInsights(p);
  $('#top-insight').textContent=insights[0];
  $('#insights-list').innerHTML=insights.map(i=>`<li>${i}</li>`).join('');
}

/* =========================================================
   RENDER — CHARTS
   ========================================================= */
let charts={};
function destroyCharts(){ Object.values(charts).forEach(c=>c?.destroy()); charts={}; }
function chartTheme(){
  const dark=document.documentElement.dataset.theme==='dark';
  return {
    grid:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',
    text:dark?'#9AA8A0':'#5B6660',
    accent:dark?'#3FCB91':'#1F7A5C',
    bad:dark?'#E1645A':'#C0463B',
    warn:dark?'#E0A458':'#C97A2B'
  };
}
function baseOpts(theme){
  return {
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{labels:{color:theme.text,font:{size:11}}}},
    scales:{
      x:{ticks:{color:theme.text,maxTicksLimit:8},grid:{color:theme.grid}},
      y:{ticks:{color:theme.text},grid:{color:theme.grid}}
    }
  };
}

function renderCharts(){
  destroyCharts();
  const theme=chartTheme();

  // Weight
  const wS=buildWeightSeries();
  const ma7=movingAverage(wS,7), ma30=movingAverage(wS,30);
  if($('#chart-weight')){
    charts.weight=new Chart($('#chart-weight'),{
      type:'line',
      data:{labels:wS.map(p=>p.date),datasets:[
        {label:'Poids',data:wS.map(p=>p.value),borderColor:theme.text,pointRadius:2,tension:.2},
        {label:'Moy. 7j',data:ma7.map(p=>p.value),borderColor:theme.accent,borderWidth:2,pointRadius:0,tension:.3},
        {label:'Moy. 30j',data:ma30.map(p=>p.value),borderColor:theme.warn,borderWidth:2,pointRadius:0,tension:.3,borderDash:[4,3]},
      ]},options:baseOpts(theme)
    });
  }

  // Composition %
  const bf=buildSeries('bodyfat'), mm=buildSeries('muscle');
  if($('#chart-composition')){
    charts.composition=new Chart($('#chart-composition'),{
      type:'line',
      data:{labels:bf.map(p=>p.date),datasets:[
        {label:'Masse grasse %',data:bf.map(p=>p.value),borderColor:theme.bad,tension:.25,pointRadius:1},
        {label:'Masse musculaire %',data:mm.map(p=>p.value),borderColor:theme.accent,tension:.25,pointRadius:1},
      ]},options:baseOpts(theme)
    });
  }

  // Composition kg
  const compKg=buildCompositionKg();
  if($('#chart-composition-kg')&&compKg.length){
    charts.compKg=new Chart($('#chart-composition-kg'),{
      type:'line',
      data:{labels:compKg.map(p=>p.date),datasets:[
        {label:'Graisse (kg)',data:compKg.map(p=>p.fat),borderColor:theme.bad,tension:.25,pointRadius:1},
        {label:'Muscle (kg)',data:compKg.map(p=>p.muscle),borderColor:theme.accent,tension:.25,pointRadius:1},
        {label:'Masse maigre (kg)',data:compKg.map(p=>p.lean),borderColor:theme.warn,tension:.25,pointRadius:1,borderDash:[3,3]},
      ]},options:baseOpts(theme)
    });
  }

  // Metabolism
  const metaLabels=[], metaTheo=[], metaAdapt=[];
  const p=DB.profile;
  getLogsSorted().forEach(l=>{
    if(!l.weight) return;
    metaLabels.push(l.date);
    metaTheo.push(computeCurrentBMR(p,l.weight,l.bodyfat??p.bodyfat));
  });
  const {adapted}=computeAdaptiveBMR(p);
  metaLabels.forEach(()=>metaAdapt.push(adapted));
  if($('#chart-metabolism')){
    charts.metabolism=new Chart($('#chart-metabolism'),{
      type:'line',
      data:{labels:metaLabels,datasets:[
        {label:'BMR manuel ajusté',data:metaTheo,borderColor:theme.text,tension:.2,pointRadius:1},
        {label:'BMR adapté observé',data:metaAdapt,borderColor:theme.accent,tension:.2,pointRadius:1,borderDash:[4,3]},
      ]},options:baseOpts(theme)
    });
  }

  // Cumulative deficit
  let cum=0;
  const defLabels=[], defData=[];
  getLogsSorted().filter(l=>l.calories!=null).forEach(l=>{
    const sport=getSportKcal(l);
    cum += getTDEE(adapted,sport)-l.calories;
    defLabels.push(l.date); defData.push(cum);
  });
  if($('#chart-deficit')){
    charts.deficit=new Chart($('#chart-deficit'),{
      type:'line',
      data:{labels:defLabels,datasets:[{label:'Déficit cumulé (kcal)',data:defData,borderColor:theme.accent,backgroundColor:theme.accent+'33',fill:true,tension:.25,pointRadius:0}]},
      options:baseOpts(theme)
    });
  }

  // Sleep chart
  const sleepLogs=getLogsSorted().filter(l=>l.sleepDuration!=null||l.sleepScore!=null);
  if($('#chart-sleep')&&sleepLogs.length){
    charts.sleep=new Chart($('#chart-sleep'),{
      type:'bar',
      data:{labels:sleepLogs.map(l=>l.date),datasets:[
        {label:'Durée (h)',data:sleepLogs.map(l=>l.sleepDuration??null),backgroundColor:theme.accent+'99',yAxisID:'y'},
        {label:'Score',data:sleepLogs.map(l=>l.sleepScore??null),borderColor:theme.warn,type:'line',tension:.2,pointRadius:2,yAxisID:'y1'},
      ]},
      options:{...baseOpts(theme),scales:{
        x:{ticks:{color:theme.text,maxTicksLimit:10},grid:{color:theme.grid}},
        y:{ticks:{color:theme.text},grid:{color:theme.grid},title:{display:true,text:'Heures',color:theme.text}},
        y1:{position:'right',min:0,max:100,ticks:{color:theme.warn},grid:{drawOnChartArea:false},title:{display:true,text:'Score',color:theme.warn}},
      }}
    });
  }

  // Predictions
  $('#pred-30').textContent=fmt1(predictWeight(30))+' kg';
  $('#pred-60').textContent=fmt1(predictWeight(60))+' kg';
  $('#pred-90').textContent=fmt1(predictWeight(90))+' kg';
  const etaDate=estimateGoalDate(DB.goals.targetWeight);
  $('#pred-goal-date').textContent=etaDate||'—';

  // Today / recent days calories chart (ingested / spent / remaining)
  if($('#chart-today-calories')){
    const recent=getLogsSorted().filter(l=>l.calories!=null).slice(-14);
    const labels=recent.map(l=>fmtDate(l.date).replace(/ \d{4}$/,''));
    const ingested=recent.map(l=>l.calories);
    const spent=recent.map(l=>getTDEE(adapted,getSportKcal(l)));
    const remaining=recent.map((l,i)=>Math.max(0,spent[i]-ingested[i]));
    charts.todayCalories=new Chart($('#chart-today-calories'),{
      type:'bar',
      data:{labels,datasets:[
        {label:'Ingéré',data:ingested,backgroundColor:theme.accent,borderRadius:5,maxBarThickness:28},
        {label:'Dépensé (TDEE)',data:spent,type:'line',borderColor:theme.warn,backgroundColor:theme.warn,tension:.3,pointRadius:3,yAxisID:'y'},
        {label:'Restant',data:remaining,backgroundColor:theme.grid==='rgba(255,255,255,0.06)'?'#9AA8A055':'#5B666055',borderRadius:5,maxBarThickness:28},
      ]},
      options:baseOpts(theme)
    });
  }
}

/* =========================================================
   RENDER — CALENDAR
   ========================================================= */
let calendarMonth=new Date();
function renderCalendar(){
  const {adapted}=computeAdaptiveBMR(DB.profile);
  const year=calendarMonth.getFullYear(), month=calendarMonth.getMonth();
  $('#calendar-title').textContent=calendarMonth.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  const first=new Date(year,month,1);
  const offset=(first.getDay()+6)%7;
  const days=new Date(year,month+1,0).getDate();
  const grid=$('#calendar-grid');
  grid.innerHTML='';
  for(let i=0;i<offset;i++){ const c=document.createElement('div'); c.className='cal-cell empty'; grid.appendChild(c); }
  for(let d=1;d<=days;d++){
    const iso=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const log=DB.logs[iso];
    const bal=log?dailyBalance(log,adapted):null;
    const status=statusFromBalance(bal);
    const cell=document.createElement('div');
    cell.className='cal-cell '+(status!=='unknown'?status:'');
    if(iso===todayISO()) cell.classList.add('today');
    cell.textContent=d;
    cell.title=STATUS_LABEL[status];
    cell.addEventListener('click',()=>showDayDetail(iso));
    grid.appendChild(cell);
  }
}
function showDayDetail(iso){
  const log=DB.logs[iso];
  const box=$('#day-detail');
  box.classList.remove('hidden');
  if(charts.dayDetail){ charts.dayDetail.destroy(); delete charts.dayDetail; }
  if(!log){
    box.innerHTML=`
      <div class="day-detail-head"><span>${fmtDate(iso)}</span>
        <button class="btn-mini" id="day-edit-btn">+ Ajouter une saisie</button>
      </div>
      <p class="hint">Aucune donnée enregistrée pour ce jour.</p>`;
    $('#day-edit-btn').addEventListener('click',()=>window.openLogForDate(iso));
    return;
  }
  const {adapted}=computeAdaptiveBMR(DB.profile);
  const sport=getSportKcal(log);
  const tdee=getTDEE(adapted,sport);
  const bal=dailyBalance(log,adapted);
  const consumed=log.calories??0;
  const remaining=Math.max(0,tdee-consumed);
  const sportHtml=log.sports?.length?`<div class="day-sport-list">${log.sports.map(a=>`<div class="day-sport-item"><span>${a.name}</span><span>${a.kcal} kcal</span></div>`).join('')}</div>`:'';
  box.innerHTML=`
    <div class="day-detail-head">
      <span>${fmtDate(iso)}</span>
      <button class="btn-mini" id="day-edit-btn">✎ Modifier ce jour</button>
    </div>
    <dl>
      <dt>Calories</dt><dd>${fmt0(log.calories)} kcal</dd>
      <dt>Sport</dt><dd>${fmt0(sport)} kcal</dd>
      <dt>TDEE</dt><dd>${fmt0(tdee)} kcal</dd>
      <dt>Bilan</dt><dd>${bal!=null?(bal>0?'+':'')+fmt0(bal):'—'} kcal</dd>
      <dt>Poids</dt><dd>${fmt1(log.weight)} kg</dd>
      <dt>Masse grasse</dt><dd>${fmt1(log.bodyfat)} %</dd>
      <dt>Masse musculaire</dt><dd>${fmt1(log.muscle)} %</dd>
      <dt>Sommeil</dt><dd>${log.sleepDuration??'—'}h · score ${log.sleepScore??'—'}</dd>
      <dt>Notes</dt><dd>${log.notes||'—'}</dd>
    </dl>
    ${sportHtml}
    <div class="chart-wrap"><canvas id="chart-day-detail" height="90"></canvas></div>`;
  $('#day-edit-btn').addEventListener('click',()=>window.openLogForDate(iso));

  if(log.calories!=null){
    const theme=chartTheme();
    charts.dayDetail=new Chart($('#chart-day-detail'),{
      type:'bar',
      data:{labels:['Bilan du jour'],datasets:[
        {label:'Ingéré',data:[consumed],backgroundColor:theme.accent,borderRadius:6},
        {label:'Dépensé (TDEE)',data:[tdee],backgroundColor:theme.warn,borderRadius:6},
        {label:'Restant',data:[remaining],backgroundColor:theme.grid==='rgba(255,255,255,0.06)'?'#9AA8A0':'#5B6660',borderRadius:6},
      ]},
      options:{...baseOpts(theme),indexAxis:'y',scales:{
        x:{ticks:{color:theme.text},grid:{color:theme.grid}},
        y:{ticks:{color:theme.text},grid:{display:false}}
      }}
    });
  }
}

/* =========================================================
   RENDER — SINCE START
   ========================================================= */
function renderSinceStart(){
  const p=DB.profile;
  const w=buildWeightSeries();
  const bf=buildSeries('bodyfat');
  const mm=buildSeries('muscle');
  const logs=getLogsSorted();
  const {adapted}=computeAdaptiveBMR(p);

  // Use profile start weight if set, else first log
  const startW = p.startWeight ?? w[0]?.value ?? p.weight;
  const startBf= p.startBodyfat ?? bf[0]?.value ?? p.bodyfat;
  const nowW   = getLatestField('weight') ?? p.weight;
  const nowBf  = getLatestField('bodyfat') ?? p.bodyfat;
  const nowMm  = getLatestField('muscle')  ?? p.muscle;

  const wLost = startW - nowW;
  const bfKgStart = startW*(startBf??0)/100;
  const bfKgNow   = nowW*(nowBf??0)/100;
  const fatLostKg = bfKgStart - bfKgNow;
  const mmKgStart = startW*(p.startMuscle??mm[0]?.value??0)/100;
  const mmKgNow   = nowW*(nowMm??0)/100;
  const muscleDelta = mmKgNow - mmKgStart;

  const startDate = p.startDate || w[0]?.date || todayISO();
  const nDays = daysBetween(startDate, todayISO());

  // cumulative deficit
  let cumDeficit=0;
  logs.filter(l=>l.calories!=null).forEach(l=>{
    const sp=getSportKcal(l);
    cumDeficit+=getTDEE(adapted,sp)-l.calories;
  });
  const fatEquiv = cumDeficit/7700;

  // weekly speed
  const weeklySpeed = nDays>0 ? (wLost/nDays*7) : 0;

  // success probability
  const target=p.targetWeight??DB.goals.targetWeight;
  let successPct='—';
  if(target&&wLost>0){
    const needed=startW-target;
    const pct=Math.min(100,Math.round((wLost/needed)*100));
    successPct=pct+'%';
  }

  $('#ss-weight-lost').textContent = wLost>0 ? fmt1(wLost) : '0';
  $('#ss-fat-lost').textContent    = fatLostKg>0 ? fmt1(fatLostKg) : '0';
  $('#ss-muscle-delta').textContent= (muscleDelta>=0?'+':'')+fmt1(muscleDelta)+' kg';
  $('#ss-days').textContent        = nDays;
  $('#ss-success-pct').textContent = successPct;
  $('#ss-deficit-total').textContent= fmt0(cumDeficit);
  $('#ss-fat-equiv').textContent   = fmt1(fatEquiv);
  $('#ss-weekly-speed').textContent= fmt1(weeklySpeed);

  // Progress bars
  const ssBox=$('#ss-progress-bars');
  ssBox.innerHTML='';
  const pRows=[
    {label:'Poids',  start:startW,   now:nowW,  target:target||DB.goals.targetWeight, unit:'kg', dir:-1},
    {label:'Graisse',start:startBf,  now:nowBf, target:DB.goals.targetBodyfat,         unit:'%',  dir:-1},
    {label:'Muscle', start:nowMm,    now:nowMm, target:DB.goals.targetMuscle,           unit:'%',  dir:1},
  ];
  pRows.forEach(r=>{
    if(!r.target) return;
    const total=Math.abs(r.start-r.target)||1;
    const done=r.dir>0?Math.max(0,r.now-r.start):Math.max(0,r.start-r.now);
    const pct=Math.max(0,Math.min(100,Math.round((done/total)*100)));
    const d=document.createElement('div'); d.className='goal-row';
    d.innerHTML=`<span class="trio-label">${r.label} — ${fmt1(r.start)} → ${fmt1(r.target)} ${r.unit} <strong>(actuel: ${fmt1(r.now)} ${r.unit})</strong></span>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span class="trio-label">${pct}% atteint</span>`;
    ssBox.appendChild(d);
  });

  // Since-start chart
  destroySinceChart();
  const theme=chartTheme();
  if($('#chart-since-weight')&&w.length){
    const startPoint={date:startDate,value:startW};
    const fullSeries=[startPoint,...w.filter(p=>p.date>startDate)];
    const ma=movingAverage(fullSeries,7);
    charts.sinceWeight=new Chart($('#chart-since-weight'),{
      type:'line',
      data:{labels:fullSeries.map(p=>p.date),datasets:[
        {label:'Poids réel',data:fullSeries.map(p=>p.value),borderColor:theme.text,pointRadius:2,tension:.2},
        {label:'Tendance 7j',data:ma.map(p=>p.value),borderColor:theme.accent,borderWidth:2,pointRadius:0,tension:.3},
        target?{label:`Objectif (${target}kg)`,data:fullSeries.map(()=>target),borderColor:theme.bad,borderDash:[6,3],borderWidth:1,pointRadius:0}:null,
      ].filter(Boolean)},
      options:{...baseOpts(theme),maintainAspectRatio:false}
    });
  }

  // Badges
  const badgeGroups=computeBadges();
  $('#badges-grid').innerHTML=badgeGroups.map(g=>`
    <div class="badge-group">
      <div class="badge-group-title">${g.group}</div>
      <div class="badges-grid">
        ${g.items.map(b=>`
          <div class="badge ${b.earned?'earned':'locked'}" title="${b.desc}">
            <div class="badge-icon">${b.icon}</div>
            <div class="badge-name">${b.name}</div>
          </div>`).join('')}
      </div>
    </div>`).join('');

  // Success calendar (last 90 days)
  renderSuccessCalendar();
}
function destroySinceChart(){ if(charts.sinceWeight){ charts.sinceWeight.destroy(); delete charts.sinceWeight; } }

function renderSuccessCalendar(){
  const {adapted}=computeAdaptiveBMR(DB.profile);
  const sc=$('#success-calendar');
  sc.innerHTML='';
  const today=todayISO();
  for(let i=89;i>=0;i--){
    const iso=addDays(today,-i);
    const log=DB.logs[iso];
    const cell=document.createElement('div');
    cell.className='sc-cell';
    cell.title=iso;
    if(log?.calories!=null){
      const b=dailyBalance(log,adapted);
      cell.classList.add(b!=null&&b<0?'success':'fail');
    }
    sc.appendChild(cell);
  }
}

/* =========================================================
   RENDER — GOALS
   ========================================================= */
function renderGoals(){
  const f=$('#goals-form');
  f.targetWeight.value   = DB.goals.targetWeight??'';
  f.targetBodyfat.value  = DB.goals.targetBodyfat??'';
  f.targetMuscle.value   = DB.goals.targetMuscle??'';
  f.startWeightRef.value = DB.goals.startWeightRef??'';

  const p=DB.profile;
  const wNow  = getLatestField('weight')  ?? p.weight;
  const bfNow = getLatestField('bodyfat') ?? p.bodyfat;
  const mmNow = getLatestField('muscle')  ?? p.muscle;
  const startRef = DB.goals.startWeightRef || buildWeightSeries()[0]?.value || wNow;

  const box=$('#goals-progress'); box.innerHTML='';
  const rows=[
    {label:'Poids',    now:wNow,  start:startRef, target:DB.goals.targetWeight,  unit:'kg'},
    {label:'Masse grasse', now:bfNow, start:buildSeries('bodyfat')[0]?.value??bfNow, target:DB.goals.targetBodyfat, unit:'%'},
    {label:'Masse musculaire', now:mmNow, start:buildSeries('muscle')[0]?.value??mmNow, target:DB.goals.targetMuscle, unit:'%'},
  ];
  rows.forEach(r=>{
    if(!r.target) return;
    const total=Math.abs(r.start-r.target)||1;
    const done=Math.abs(r.start-r.now);
    const pct=Math.max(0,Math.min(100,Math.round((done/total)*100)));
    const d=document.createElement('div'); d.className='goal-row';
    d.innerHTML=`<span class="trio-label">${r.label} — ${fmt1(r.now)} → ${fmt1(r.target)} ${r.unit}</span>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span class="trio-label">${pct}% atteint</span>`;
    box.appendChild(d);
  });
  if(!box.children.length) box.innerHTML='<p class="hint">Définis un objectif pour suivre ta progression.</p>';

  // ETA
  const etaBox=$('#goals-eta'); etaBox.innerHTML='';
  if(DB.goals.targetWeight){
    const eta=estimateGoalDate(DB.goals.targetWeight);
    const row=document.createElement('div'); row.className='eta-row';
    row.innerHTML=`<span>Poids cible (${DB.goals.targetWeight} kg)</span><span class="eta-date">${eta||'—'}</span>`;
    etaBox.appendChild(row);
  }
  if(!etaBox.children.length) etaBox.innerHTML='<p class="hint">Ajoute un objectif de poids pour estimer la date d\'atteinte.</p>';
}

/* =========================================================
   RENDER — JOURNAL
   ========================================================= */
function renderJournal(){
  const box=$('#journal-list');
  const entries=getLogsSorted().filter(l=>l.notes||l.mood||l.energy||l.sleepDuration||l.sleepScore||l.photo).reverse();
  if(!entries.length){ box.innerHTML='<p class="hint">Aucune entrée pour le moment.</p>'; return; }
  box.innerHTML=entries.map(l=>`
    <div class="journal-entry">
      <div class="j-date">${fmtDate(l.date)}</div>
      ${l.notes?`<div>${l.notes}</div>`:''}
      <div class="hint">${l.mood?`Humeur: ${l.mood}/5 &nbsp;`:''}${l.energy?`Énergie: ${l.energy}/5`:''}</div>
      ${(l.sleepDuration||l.sleepScore)?`<div class="j-sleep">😴 ${l.sleepDuration?l.sleepDuration+'h':''}${l.sleepDuration&&l.sleepScore?' · ':''}${l.sleepScore?'Score '+l.sleepScore:''}</div>`:''}
      ${l.photo?`<img src="${l.photo}" alt="progression" />`:''}
    </div>`).join('');
}

/* =========================================================
   RENDER ALL
   ========================================================= */
function renderAll(){
  renderDashboard();
  // renderCharts() intentionally omitted here — charts are only rendered when
  // the Tendances tab is actually visible, to avoid Chart.js receiving a 0×0 canvas.
  renderCalendar();
  // renderSinceStart() also deferred to tab click to avoid hidden-canvas issues
  renderGoals();
  renderJournal();
}

/* =========================================================
   SPORT ACTIVITIES IN MODAL
   ========================================================= */
function addSportRow(name='', kcal=''){
  const tpl=$('#sport-activity-tpl');
  const clone=tpl.content.cloneNode(true);
  const row=clone.querySelector('.sport-activity-row');
  row.querySelector('.sport-name').value=name;
  row.querySelector('.sport-kcal').value=kcal;
  row.querySelector('.sport-remove').addEventListener('click',()=>row.remove());
  $('#sport-activities-list').appendChild(clone);
}
function getSportActivitiesFromForm(){
  const rows=$$('.sport-activity-row');
  const result=[];
  rows.forEach(row=>{
    const name=row.querySelector('.sport-name').value.trim();
    const kcal=parseFloat(row.querySelector('.sport-kcal').value)||0;
    if(name||kcal) result.push({name:name||'Activité',kcal});
  });
  return result;
}

/* =========================================================
   ONBOARDING
   ========================================================= */
let obStep=1;
const OB_STEPS=4;
function setupOnboarding(){
  // Do NOT call remove('hidden') here — showAppScreen() decides what to show
  $('#ob-next').addEventListener('click',()=>{ if(obStep<OB_STEPS){obStep++;updateObStep();} });
  $('#ob-back').addEventListener('click',()=>{ if(obStep>1){obStep--;updateObStep();} });
  $('#profile-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const jsonbinKey=fd.get('jsonbinKey')||null;
    const jsonbinId=fd.get('jsonbinId')||null;

    // If cloud credentials provided, try to pull existing data first
    if(jsonbinKey && jsonbinId){
      showToast('⏳ Récupération des données cloud…');
      const remote = await Store.pull(jsonbinKey, jsonbinId);
      if(remote?.profile){
        // Found existing data in cloud — use it directly, no need to re-enter profile
        DB = remote;
        DB.profile.jsonbinKey = jsonbinKey;
        DB.profile.jsonbinId  = jsonbinId;
        Store.save(DB);
        showToast('✓ Profil récupéré depuis le cloud !');
        showAppScreen();
        return;
      }
    }

    // No cloud data found (or no credentials) — create a new profile from the form
    const profile={
      sex:fd.get('sex'), birthdate:fd.get('birthdate'),
      height:parseFloat(fd.get('height')),
      weight:parseFloat(fd.get('weight')),
      baseBMR:parseFloat(fd.get('baseBMR'))||1800,
      startDate:fd.get('startDate')||todayISO(),
      startWeight:parseFloat(fd.get('startWeight'))||parseFloat(fd.get('weight')),
      startBodyfat:parseFloat(fd.get('startBodyfat'))||null,
      bodyfat:parseFloat(fd.get('bodyfat'))||null,
      muscle:parseFloat(fd.get('muscle'))||null,
      targetWeight:parseFloat(fd.get('targetWeight'))||null,
      targetBodyfat:parseFloat(fd.get('targetBodyfat'))||null,
      jsonbinKey,
      jsonbinId,
    };
    DB.profile=profile;
    DB.goals={
      targetWeight:profile.targetWeight,
      targetBodyfat:profile.targetBodyfat,
    };
    DB.logs[todayISO()]=DB.logs[todayISO()]||{date:todayISO(),weight:profile.weight,bodyfat:profile.bodyfat,muscle:profile.muscle};
    persist();
    showAppScreen();
  });
}
function updateObStep(){
  $$('.step').forEach(s=>s.classList.toggle('active',parseInt(s.dataset.step)===obStep));
  $$('.dot').forEach((d,i)=>d.classList.toggle('active',i===obStep-1));
  $('#ob-back').classList.toggle('hidden',obStep===1);
  $('#ob-next').classList.toggle('hidden',obStep===OB_STEPS);
  $('#ob-submit').classList.toggle('hidden',obStep!==OB_STEPS);
}

/* =========================================================
   APP INTERACTIONS
   ========================================================= */
function setupTabs(){
  $$('.tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      $$('.tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      $$('.view').forEach(v=>v.classList.remove('active'));
      const view=$('#view-'+tab.dataset.view);
      view.classList.add('active');
      // Use setTimeout(0) after display change so the browser has fully
      // computed layout before Chart.js measures canvas dimensions.
      if(tab.dataset.view==='trends'){
        setTimeout(()=>renderCharts(), 0);
      }
      if(tab.dataset.view==='since-start'){
        setTimeout(()=>renderSinceStart(), 0);
      }
    });
  });
}

function setupTheme(){
  const saved=localStorage.getItem(THEME_KEY)||'dark';
  document.documentElement.dataset.theme=saved;
  $('#theme-toggle').textContent=saved==='dark'?'🌙':'☀️';
  $('#theme-toggle').addEventListener('click',()=>{
    const cur=document.documentElement.dataset.theme;
    const next=cur==='dark'?'light':'dark';
    document.documentElement.dataset.theme=next;
    localStorage.setItem(THEME_KEY,next);
    $('#theme-toggle').textContent=next==='dark'?'🌙':'☀️';
    // Only re-render charts if the trends tab is currently visible
    if(DB.profile && document.querySelector('.tab[data-view="trends"]')?.classList.contains('active')){
      requestAnimationFrame(()=>requestAnimationFrame(()=>renderCharts()));
    }
  });
}

function setupLogModal(){
  // Open
  const openLogForDate=(dateISO)=>{
    const ex=DB.logs[dateISO]||{};
    const form=$('#log-form');
    form.date.value=dateISO;
    form.calories.value=ex.calories??'';
    form.weight.value=ex.weight??'';
    form.bodyfat.value=ex.bodyfat??'';
    form.muscle.value=ex.muscle??'';
    form.mood.value=ex.mood??'';
    form.energy.value=ex.energy??'';
    form.sleepDuration.value=ex.sleepDuration??'';
    form.sleepScore.value=ex.sleepScore??'';
    form.notes.value=ex.notes??'';
    // Populate sports
    $('#sport-activities-list').innerHTML='';
    (ex.sports||[]).forEach(a=>addSportRow(a.name,a.kcal));
    $('#log-modal').classList.remove('hidden');
  };
  window.openLogForDate=openLogForDate;
  $('#open-log').addEventListener('click',()=>openLogForDate(todayISO()));
  $('#close-log').addEventListener('click',()=>$('#log-modal').classList.add('hidden'));
  $('#log-modal').addEventListener('click',e=>{if(e.target.id==='log-modal')$('#log-modal').classList.add('hidden');});
  $('#add-sport-btn').addEventListener('click',()=>addSportRow());

  // Submit
  $('#log-form').addEventListener('submit',e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const date=fd.get('date');
    const entry=DB.logs[date]||{date};
    entry.calories=parseFloat(fd.get('calories'))||null;
    entry.weight=parseFloat(fd.get('weight'))||entry.weight||null;
    entry.bodyfat=parseFloat(fd.get('bodyfat'))||entry.bodyfat||null;
    entry.muscle=parseFloat(fd.get('muscle'))||entry.muscle||null;
    entry.mood=fd.get('mood')||null;
    entry.energy=fd.get('energy')||null;
    entry.sleepDuration=parseFloat(fd.get('sleepDuration'))||null;
    entry.sleepScore=parseFloat(fd.get('sleepScore'))||null;
    entry.notes=fd.get('notes')||null;
    entry.sports=getSportActivitiesFromForm();
    entry.updatedAt=Date.now();
    const photo=fd.get('photo');
    const finish=()=>{
      DB.logs[date]=entry;
      persist();
      $('#log-modal').classList.add('hidden');
      renderAll();
    };
    if(photo&&photo.size){
      const r=new FileReader();
      r.onload=()=>{ entry.photo=r.result; finish(); };
      r.readAsDataURL(photo);
    } else finish();
  });
}

function setupBMRModal(){
  $('#edit-bmr-btn').addEventListener('click',()=>{
    $('#bmr-input').value=DB.profile?.baseBMR||'';
    $('#bmr-modal').classList.remove('hidden');
  });
  $('#close-bmr').addEventListener('click',()=>$('#bmr-modal').classList.add('hidden'));
  $('#bmr-form').addEventListener('submit',e=>{
    e.preventDefault();
    const v=parseFloat($('#bmr-input').value);
    if(v>=800&&v<=4000){
      DB.profile.baseBMR=v;
      persist();
      renderAll();
    }
    $('#bmr-modal').classList.add('hidden');
  });
}

function setupGoals(){
  $('#goals-form').addEventListener('submit',e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    DB.goals={
      targetWeight:parseFloat(fd.get('targetWeight'))||null,
      targetBodyfat:parseFloat(fd.get('targetBodyfat'))||null,
      targetMuscle:parseFloat(fd.get('targetMuscle'))||null,
      startWeightRef:parseFloat(fd.get('startWeightRef'))||null,
    };
    persist();
    renderGoals();
  });
}

function setupCalendarNav(){
  $('#cal-prev').addEventListener('click',()=>{ calendarMonth.setMonth(calendarMonth.getMonth()-1); renderCalendar(); });
  $('#cal-next').addEventListener('click',()=>{ calendarMonth.setMonth(calendarMonth.getMonth()+1); renderCalendar(); });
}

function setupSyncSettings(){
  const openBtn=$('#sync-settings-btn');
  const modal=$('#sync-settings-modal');
  if(!openBtn||!modal) return;
  openBtn.addEventListener('click',()=>{
    $('#sync-jsonbin-key').value=DB.profile?.jsonbinKey||'';
    $('#sync-jsonbin-id').value=DB.profile?.jsonbinId||'';
    modal.classList.remove('hidden');
  });
  $('#close-sync-settings').addEventListener('click',()=>modal.classList.add('hidden'));
  modal.addEventListener('click',e=>{ if(e.target.id==='sync-settings-modal') modal.classList.add('hidden'); });

  $('#sync-settings-form').addEventListener('submit', async e=>{
    e.preventDefault();
    const key=$('#sync-jsonbin-key').value.trim()||null;
    const id =$('#sync-jsonbin-id').value.trim()||null;
    if(!DB.profile){ showToast('⚠️ Crée d\'abord ton profil'); return; }
    DB.profile.jsonbinKey=key;
    DB.profile.jsonbinId=id;
    Store.save(DB);
    modal.classList.add('hidden');
    if(!key||!id){ showToast('ℹ️ Synchronisation désactivée (champs vides)'); return; }
    showToast('⏳ Synchronisation en cours…');
    // Pull remote first, merge, then push so both devices end up aligned
    const remote=await Store.pull(key,id);
    if(remote?.logs){
      mergeRemoteLogs(remote.logs);
    }
    if(remote?.goals && !Object.keys(DB.goals||{}).length) DB.goals=remote.goals;
    // If the remote profile differs from the local one (separate onboarding on each device),
    // offer to adopt the remote profile so both devices share the same reference data.
    if(remote?.profile && DB.profile && JSON.stringify(remote.profile)!==JSON.stringify(DB.profile)){
      const adopt=confirm(
        "Le profil enregistré sur l'autre appareil est différent du tien (poids/BMR/objectifs de départ).\n\n"+
        "Veux-tu remplacer ton profil local par celui de l'autre appareil pour que les deux soient identiques ?\n\n"+
        "OK = utiliser le profil distant   /   Annuler = garder mon profil actuel"
      );
      if(adopt) DB.profile=remote.profile;
    }
    Store.save(DB);
    const ok=await Store.push(DB);
    showToast(ok?'✓ Synchronisé avec succès':'⚠️ Identifiants invalides ou erreur réseau');
    if(ok) renderAll();
  });
}

function setupSync(){
  $('#sync-btn').addEventListener('click',async()=>{
    const p=DB.profile;
    if(!p?.jsonbinKey||!p?.jsonbinId){
      showToast('ℹ️ Configure d\'abord la sync via ⚙️ Réglages');
      return;
    }
    $('#sync-btn').classList.add('syncing');
    // Pull from cloud first
    const remote=await Store.pull(p.jsonbinKey,p.jsonbinId);
    if(remote){
      mergeRemoteLogs(remote.logs);
      Store.save(DB);
    }
    // Push current
    const ok=await Store.push(DB);
    $('#sync-btn').classList.remove('syncing');
    showToast(ok?'✓ Synchronisé':'⚠️ Erreur de synchronisation');
    if(ok) renderAll();
  });
}

function setupExport(){
  $('#export-btn').addEventListener('click',()=>{
    const p=DB.profile;
    const {theoretical,adapted}=computeAdaptiveBMR(p);
    const ins=generateInsights(p);
    const w=window.open('','_blank');
    w.document.write(`<html><head><title>Rapport Métabolyse</title>
      <style>body{font-family:sans-serif;padding:40px;color:#15201B;}h1{color:#1F7A5C;}li{margin-bottom:8px;}</style>
      </head><body>
      <h1>Rapport Métabolyse — ${todayISO()}</h1>
      <p><b>BMR manuel:</b> ${p.baseBMR} kcal &nbsp; <b>BMR adapté:</b> ${adapted} kcal &nbsp; <b>BMR théorique ajusté:</b> ${theoretical} kcal</p>
      <h2>Analyse</h2><ul>${ins.map(i=>`<li>${i}</li>`).join('')}</ul>
      </body></html>`);
    w.document.close(); w.print();
  });
}

/* =========================================================
   PASSWORD / AUTH
   ========================================================= */
function setupPassword(){
  const tryLogin=()=>{
    const v=$('#pw-input').value;
    if(v===PASSWORD){
      localStorage.setItem(AUTH_KEY,'1');
      $('#screen-password').classList.add('hidden');
      showAppScreen();
    } else {
      $('#pw-error').classList.remove('hidden');
      $('#pw-input').value='';
      $('#pw-input').focus();
    }
  };
  $('#pw-submit').addEventListener('click',tryLogin);
  $('#pw-input').addEventListener('keydown',e=>{ if(e.key==='Enter') tryLogin(); });
}

function showAppScreen(){
  if(!DB.profile){
    // No profile yet — show onboarding, hide everything else
    $('#screen-password').classList.add('hidden');
    $('#onboarding').classList.remove('hidden');
    $('#app').classList.add('hidden');
  } else {
    // Profile exists — go straight to app
    $('#screen-password').classList.add('hidden');
    $('#onboarding').classList.add('hidden');
    $('#app').classList.remove('hidden');
    renderAll();
  }
}

/* =========================================================
   BOOT
   ========================================================= */
document.addEventListener('DOMContentLoaded',()=>{
  setupOnboarding();
  setupTabs();
  setupTheme();
  setupLogModal();
  setupBMRModal();
  setupGoals();
  setupCalendarNav();
  setupSync();
  setupSyncSettings();
  setupExport();

  // Determine start state:
  // 1. Already authenticated (localStorage) + profile exists → go to app directly
  // 2. Already authenticated but no profile → show onboarding
  // 3. Not authenticated → show password screen
  const authed = localStorage.getItem(AUTH_KEY) === '1';
  if(authed){
    showAppScreen();
  } else {
    // Show password screen only
    $('#screen-password').classList.remove('hidden');
    $('#onboarding').classList.add('hidden');
    $('#app').classList.add('hidden');
    setupPassword();
  }

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }

  // Auto-sync on load if credentials available
  setTimeout(async()=>{
    const p=DB.profile;
    if(p?.jsonbinKey&&p?.jsonbinId){
      const remote=await Store.pull(p.jsonbinKey,p.jsonbinId);
      if(remote?.logs){
        const changed=mergeRemoteLogs(remote.logs);
        if(changed){ Store.save(DB); renderAll(); showToast('✓ Données récupérées depuis le cloud'); }
      }
    }
  }, 1000);
});
