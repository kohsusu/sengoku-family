// 100 場模擬:隨機眾/大名 + 五種玩家性格,跑到 1615 或家名斷絕
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { doc, localStorage } = require('./shim');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if(scripts.length !== 1) throw new Error('unexpected script count: ' + scripts.length);

const sandbox = {
  document: doc, localStorage,
  console, Math, JSON, Date, performance: {now: () => Number(process.hrtime.bigint()/1000n)/1000},
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  Image: class { constructor(){ this.onload=null; } set src(v){} },
  navigator: {userAgent:'node'},
  alert: () => {}, confirm: () => true, prompt: () => null,
  matchMedia: () => ({matches:false, addListener(){}, addEventListener(){}}),
  location: {port:'5877', href:'http://localhost:5877/', reload(){ throw new Error('__RELOAD__'); },
             replace(){ throw new Error('__RELOAD__'); }},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
try{ vm.runInContext(scripts[0], sandbox, {filename:'game.js'}); }
catch(e){ console.error('BOOT FAIL:', e.message, '\n', (e.stack||'').split('\n').slice(0,6).join('\n')); process.exit(1); }

const g = sandbox.window.__game;
if(!g) throw new Error('__game hook missing');

// render() 在墊片下會炸(innerHTML 不生子節點),換成只保留「會改狀態」的部分
vm.runInContext(`
render = function(){
  if(!S) return;
  armySync(); aptSync();
  S.retainers.forEach(r=>{
    if(TASKS[r.task] && TASKS[r.task].clan && TASKS[r.task].clan !== S.clanType) r.task = 'rest';
    if(S.daimyoMode && r.task && r.task.indexOf('bugyo_') !== 0 && r.task !== 'educate' && r.task !== 'rest') r.task = 'rest';
  });
};
drawMap = function(){};
save = function(){};
(function(){ const orig = log;
  log = function(msg, kind){ if(__rec) __rec.logs.push(String(msg)); return orig(msg, kind); };
})();
`, sandbox, {filename:'shim-render.js'});

// ── 玩家性格 ──
const NUKE = /新的家史|重新開始/;
const PERSONAS = [
 {name:'農本', tasks:['tonden','farm','fushin','educate','farm'],
  like:/屯田|開墾|農|水利|救濟|開倉|不趁人之危|婉拒|辭謝|原禮|忍辱|求和|息事|受降|安堵|贈禮|說法|祈禱|坐視|據實|領命|承襲|休養|招民|固守/,
  hate:/根切|海賊|夜襲|謀反|抗命|斷然拒絕|舉兵|趁虛|隱田|逃散|自立/, tax:0},
 {name:'武斷', tasks:['drill','drill','tonden','hunt','drill'],
  like:/練兵|操練|出兵|討伐|進軍|迎擊|突擊|傾力|力攻|割地|根切|先鋒|突出|趁虛|舉兵|據城迎擊|開戰|魚鱗/,
  hate:/求和|息事|忍辱|退讓|婉拒|堅壁|開城降伏|撤圍|罷兵/, tax:1},
 {name:'商賈', tasks:['trade','trade','tonden','rakuichi','educate'],
  like:/經商|商|買田|樂市|廻船|借銀|御用金|如數|受之|贈禮|取引|海運|求和|納貢|遠戰/,
  hate:/根切|謀反|出兵|討伐|舉兵/, tax:1},
 {name:'忠臣', tasks:['tonden','drill','farm','toritsugi','fushin'],
  like:/傾力|領命|應召|臣從|請求臣從|獻|安堵|偏諱|據實|先鋒|斷後|協調|受降|援軍|迎擊|昇格|雁行/,
  hate:/謀反|自立|抗命|拒絕|通款|密約|隱田|抜け駆け|絕緣/, tax:1},
 {name:'野心', tasks:['drill','tonden','spy','trade','drill'],
  like:/謀反|自立|通款|密約|隱田|抜け駆け|絕緣|勧誘|壓迫|諜報|流言|出兵|討伐|趁虛|根切|昇格|迫使|迂迴/,
  hate:/忍辱|納貢|退讓|求和|婉拒/, tax:2}
];
const CLANS = ['kokujin'];   // 豪族立志:玩家僅國人眾

const ev = code => vm.runInContext(code, sandbox);
const $ = id => doc.getElementById(id);
function pick(P){
  const btns = $('modalChoices').querySelectorAll('button');
  if(!btns.length) return null;
  const ok = btns.filter(b => !NUKE.test(b.textContent));
  if(!ok.length) return 'BLOCK';
  let best = ok[0], bs = -1e9;
  for(const b of ok){
    const t = b.textContent;
    let s = (P.like.test(t) ? 2 : 0) - (P.hate.test(t) ? 3 : 0) + Math.random()*0.5;
    if(/返回|再議|罷兵|不下采配/.test(t)) s -= 1.2;   // 真人不會在同一畫面反覆橫跳
    if(b.disabled) s -= 1e6;
    if(s > bs){ bs = s; best = b; }
  }
  return best;
}
function drain(P, rec){
  let n = 0;
  while(!$('modalBack').classList.contains('hidden') && n++ < 500){
    rec.titles.push($('modalTitle').textContent);
    rec.bodies.push($('modalBody').textContent);
    const b = pick(P);
    if(!b || b === 'BLOCK'){ $('modalBack').classList.add('hidden'); break; }
    b.click();
  }
  if(n >= 500){ rec.storm = (rec.storm||0)+1; rec.stormAt = $('modalTitle').textContent; }
  return n;
}
function assign(P, S){
  S.retainers.forEach((r,i)=>{
    if((r.sick||0) > 0) return;
    if((r.stamina ?? 100) < 30){ r.task = 'rest'; return; }
    let t = S.daimyoMode ? ['bugyo_kori','bugyo_kanjo','bugyo_gun','bugyo_fushin','bugyo_minsei'][i%5]
                         : P.tasks[i % P.tasks.length];
    const T = g.TASKS[t];
    if(!T || (T.clan && T.clan !== S.clanType)) t = 'tonden';
    r.task = t;
  });
  S.taxRate = [0.3, 0.4, 0.5][P.tax];
}
// 真實玩家會顧的「家門經營」——續弦、納側室、女兒出仕、招浪人補家臣
function household(P, rec){
  const S = g.S;
  if(S.gameOver) return;
  const fem = sandbox.lordIsFemale && sandbox.lordIsFemale();
  if(!S.wife){
    if(fem && S.money >= 30){ sandbox.doMuko(); drain(P, rec); }
    else if(!fem && S.money >= 20) sandbox.doMarry();
  }
  // 側室:當主為男、有餘裕就納(續香火的主要手段)
  if(!fem && S.money >= 120 && S.prestige >= 25 && (S.consorts||[]).length < 3 && Math.random() < 0.5){
    S.money -= 40;
    if(!S.consorts) S.consorts = [];
    const cs = {name: sandbox.genGirlName(), age: 17 + Math.floor(Math.random()*8)};
    S.consorts.push(cs); sandbox.linWife(cs.name + '(側)');
  }
  // 女兒 15 歲:一半機率出仕(另一半留待縁談)——女當主是絕嗣的最後保險
  const di = S.children.findIndex(c => c.sex === 'f' && c.age >= 15);
  if(di >= 0 && Math.random() < 0.5){ sandbox.doServe(di); drain(P, rec); }
  // 家臣不足則招浪人(名將登門另由事件處理)
  if(ev('activeR().length') < 8 && S.money >= 80 && Math.random() < 0.4){ sandbox.doRonin(); drain(P, rec); }
  // ── 有錢就會花:官位 → 御用金 → 傭兵(真實玩家不會坐擁十萬貫) ──
  const kc = ev('kaniCost('+((S.kani||0)+1)+')');
  if((S.kani||0) < 2 && S.money >= kc*1.5){ S.money -= kc; sandbox.grantKani((S.kani||0)+1, '獻金於朝廷'); }
  const kug = ev('kugeCost()');
  if(S.money >= kug*2.5 && Math.random() < 0.6){ S.money -= kug; S.kuge = (S.kuge||0)+1; sandbox.gainPrestige(6); }
  const yc = ev('yatoiCost()'), yn = ev('yatoiN()');
  if(P.name !== '農本' && P.name !== '商賈' && S.money >= yc*3
     && S.soldiers < sandbox.solCap()*1.3 && Math.random() < 0.5){
    S.money -= yc; sandbox.armySync(); S.army.ashigaru += yn; S.soldiers += yn;
  }
  // 賣餘糧換錢(真實玩家不會讓米爛在倉裡;賣米視窗選最大檔)
  if(S.rice > S.kokudaka * 1.4 && Math.random() < 0.8){
    const btn = doc.getElementById('btnSell');
    if(btn && !btn.disabled){
      btn.click();
      let n2 = 0;
      while(!$('modalBack').classList.contains('hidden') && n2++ < 5){
        const sells = [...$('modalChoices').querySelectorAll('button')].filter(b=>/^賣 /.test(b.textContent));
        if(!sells.length){ $('modalBack').classList.add('hidden'); break; }
        sells[sells.length-1].click();   // 最大檔
      }
      drain(P, rec);
    }
  }
  // 招民(人口是石高的天花板)
  if(S.money >= 400 && Math.random() < 0.3){ sandbox.doBoshu(); drain(P, rec); }
  // 主動出兵討伐:武斷/野心玩家的核心循環——兵強糧足就打最弱的鄰家
  const warlike = P.name === '武斷' ? 0.55 : P.name === '野心' ? 0.3 : 0;
  if(warlike && !S.siege && !S.daimyoMode && Math.random() < warlike){
    sandbox.armySync();
    if(Math.random() < 0.04){ (rec.gate = rec.gate||[]).push({y:S.year, sol:S.soldiers, rice:Math.round(S.rice), money:Math.round(S.money)}); }
    const inRange = ev('inStrikeRange'), rSolF = ev('rSol');
    const targets = (S.rivals||[]).filter(f => f.alive && f.lord !== 'player'
      && inRange(f) && !(S.allies||[]).includes(f.name));
    if(targets.length && S.soldiers >= 40 && S.rice >= S.soldiers * 0.8){
      targets.sort((a,b) => (rSolF(a)+a.fort*30) - (rSolF(b)+b.fort*30));
      const t = targets[0];
      // 真實玩家的算盤:小城兩倍餘兵可下,堅城要三倍(攻城三倍法則)
      const fortLv = Math.min(5, 1 + Math.floor(t.koku/900) + (t.fort||0));
      if(S.soldiers * 0.8 >= rSolF(t) * (fortLv <= 2 ? 2.2 : 3.0)){
        rec.atkProbe = rec.atkProbe || [];
        const before = rec.logs.length;
        sandbox.conquestWar(t); drain(P, rec);
        const seg = rec.logs.slice(before).join('|') + '|' + rec.bodies.slice(-8).join('|');
        rec.atkProbe.push({
          y:S.year, mySol:S.soldiers, foeSol:rSolF(t), fortLv, fkoku:t.koku,
          kind:t.clanKind||'kokujin',
          out:/⚔ 大破|開城降伏,獻上誓紙|【根切り】/.test(seg) ? 'W' : /討伐失利/.test(seg) ? 'L' : '-'
        });
      }
    }
  }
}


// ── 不變量稽核:每季檢查一次,抓出「數值上不可能」的狀態 ──
function audit(S, rec, tag){
  const V = [];
  const num = (v,name,lo,hi)=>{
    if(typeof v !== 'number' || !isFinite(v)) V.push(name+'非數值:'+v);
    else if(lo!==undefined && v<lo) V.push(name+'過低:'+v);
    else if(hi!==undefined && v>hi) V.push(name+'過高:'+v);
  };
  num(S.kokudaka,'石高',0,200000); num(S.money,'錢',0,5e6); num(S.rice,'米',0,5e6);
  num(S.pop,'人口',0,1e6); num(S.soldiers,'兵',0,1e5); num(S.prestige,'威望',0,2000);
  num(S.minshin,'民心',0,100);
  if(S.army){ const t=['ashigaru','yumi','kiba','teppo'].reduce((a,k)=>a+(S.army[k]||0),0);
    for(const k of ['ashigaru','yumi','kiba','teppo']) if((S.army[k]||0)<0) V.push('編成負值:'+k+'='+S.army[k]);
    if(Math.abs(t - S.soldiers) > 1) V.push('編成總和'+t+'≠兵力'+S.soldiers);
  }
  const act = S.retainers.filter(r=>!r.spare).length;
  if(act > 12) V.push('在籍家臣超編:'+act);
  S.retainers.forEach(r=>{
    if(!isFinite(r.bu)||!isFinite(r.nai)||!isFinite(r.chi)) V.push('家臣能力非數值:'+r.name);
    if(r.bu>99||r.nai>99||r.chi>99) V.push('家臣能力破上限:'+r.name+' 武'+r.bu+'政'+r.nai+'智'+r.chi);
    if(r.age>100||r.age<0) V.push('家臣年齡異常:'+r.name+'='+r.age);
    if((r.loyalty??70)<0||(r.loyalty??70)>100) V.push('忠誠出界:'+r.name+'='+r.loyalty);
  });
  (S.rivals||[]).forEach(f=>{
    if(!f.alive) return;
    if(f.koku<0||!isFinite(f.koku)) V.push('眾石高異常:'+f.name+'='+f.koku);
    if((f.sol||0)<0) V.push('眾兵力負值:'+f.name+'='+f.sol);
    if((f.money||0)<0) V.push('眾家財負值:'+f.name+'='+f.money);
    if((f.fort||0)<0||(f.fort||0)>5) V.push('眾城砦出界:'+f.name+'='+f.fort);
    if(f.rel<-100||f.rel>100) V.push('關係出界:'+f.name+'='+f.rel);
    if(f.lord && f.lord!=='player' && S.lords && !S.lords[f.lord]) V.push('眾依附不存在的大名:'+f.name+'→'+f.lord);
  });
  if(S.lords) for(const k in S.lords){
    const L=S.lords[k]; if(!L||k==='player') continue;
    if(L.demesne<0||!isFinite(L.demesne)) V.push('大名直轄異常:'+k+'='+L.demesne);
    if(L.favor<-100||L.favor>100) V.push('大名好感出界:'+k+'='+L.favor);
    if((L.wounds||0)<0||(L.wounds||0)>0.66) V.push('戰創出界:'+k+'='+L.wounds);
  }
  (S.children||[]).forEach(c=>{ if((c.sex==='m'&&c.age>15)||c.age<0) V.push('男童逾齡未元服:'+c.name+'='+c.age); });
  if(S.hostage && (S.hostage.age>15)) V.push('人質逾齡未歸:'+S.hostage.age);
  if(S.taishoId && !S.retainers.some(r=>r.name===S.taishoId)) V.push('指名大將已不存在:'+S.taishoId);
  if(V.length){ (rec.audits=rec.audits||[]).push({at:tag, v:V.slice(0,6)}); }
}

// 確定性 RNG,讓每場的性格/家業/模式彼此獨立
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const runs = [];
const N = Number(process.argv[2] || 100);
for(let seed = 0; seed < N; seed++){
  const rnd = mulberry32(seed*2654435761 + 12345);
  const P = PERSONAS[Math.floor(rnd()*PERSONAS.length)];
  const clan = CLANS[Math.floor(rnd()*CLANS.length)];
  const mode = rnd() < 0.25 ? 'daimyo' : 'gozoku';
  const region = ['mikawa','owari','totomi','shinano'][Math.floor(rnd()*4)];
  const rec = {seed, persona:P.name, clan, mode, region, titles:[], bodies:[], logs:[], err:null, decisions:0};
  sandbox.__rec = rec;
  const t0 = Date.now();
  try{
    g.startGame(g.newState('試' + seed, seed % 12, clan, mode, region));
    drain(P, rec);
    for(let i = 0; i < 71*4; i++){
      assign(P, g.S);
      household(P, rec);
      g.endSeason();
      rec.decisions += drain(P, rec);
      if(i % 2 === 0) audit(g.S, rec, g.S.year+'-'+g.S.season);
      if(g.S.gameOver) break;
    }
  }catch(e){
    rec.err = (e && e.message) || String(e);
    rec.stack = (e && e.stack || '').split('\n').slice(0,4).join(' | ');
  }
  const S = g.S;
  Object.assign(rec, {
    ms: Date.now() - t0,
    year:S.year, over:!!S.gameOver, koku:S.kokudaka, prest:S.prestige, pop:S.pop,
    sol:S.soldiers, rice:Math.round(S.rice), money:Math.round(S.money), minshin:S.minshin,
    retainers:S.retainers.length, active:ev('activeR().length'),
    spare:S.retainers.filter(r=>r.spare).length, gens:(S.lineage||[]).length,
    vassals:S.rivals ? S.rivals.filter(f=>f.alive && f.lord==='player').length : 0,
    rivalsAlive:S.rivals ? S.rivals.filter(f=>f.alive).length : 0,
    atkWin: rec.logs.filter(l=>/⚔ 大破|開城降伏,獻上誓紙|【根切り】/.test(l)).length,
    atkLoss: rec.logs.filter(l=>/討伐失利/.test(l)).length,
    daimyo:!!S.isDaimyo, kani:S.kani||0, fort:S.fort||0, kakun:S.kakun,
    unified:!!(S.flags && S.flags.unified),
    slain:Object.values(S.slain||{}).reduce((a,x)=>a+x.length, 0),
    allegiance:S.allegiance, aggression:S.aggression||0,
    aiKoku:S.rivals?S.rivals.filter(f=>f.alive).map(f=>f.koku):[],
    aiSol:S.rivals?S.rivals.filter(f=>f.alive).map(f=>f.sol||0):[],
    aiFort:S.rivals?S.rivals.filter(f=>f.alive).map(f=>f.fort||0):[],
    aiTop:S.rivals?Math.max(0,...S.rivals.filter(f=>f.alive).map(f=>f.koku)):0,
    lordsAlive:S.lords?Object.keys(S.lords).filter(k=>k!=='player'&&S.lords[k].alive!==false).length:0,
    lordsSubmitted:S.lords?Object.keys(S.lords).filter(k=>k!=='player'&&S.lords[k].submitted).length:0,
    lordPow:S.lords?Object.keys(S.lords).filter(k=>k!=='player'&&S.lords[k].alive!==false).map(k=>S.lords[k].demesne):[],
    lordWounds:S.lords?Object.keys(S.lords).filter(k=>k!=='player'&&S.lords[k].alive!==false).map(k=>+((S.lords[k].wounds||0).toFixed(2))):[],
    myPow:S.isDaimyo?S.kokudaka:0,
    ichimon:S.retainers.filter(r=>r.kind==='一門').length,
    ronin:S.retainers.filter(r=>r.kind==='浪人').length,
    kinds:new Set(rec.titles).size, modals:rec.titles.length
  });
  rec.end = rec.titles.filter(t=>/終焉|斷絕|天下|偃武|駿府|絕嗣|滅亡|落城|處遇|結局/.test(t)).slice(-1)[0] || '';
  runs.push(rec);
  if((seed+1) % 10 === 0) process.stderr.write(`  ${seed+1}/${N} …\n`);
}
fs.writeFileSync(path.join(__dirname, 'runs.json'), JSON.stringify(runs.map(r=>{
  const {titles, logs, ...rest} = r;
  const {bodies, ...rest2} = rest;
  const all = [...logs, ...bodies].join(String.fromCharCode(10)).split(String.fromCharCode(10));
  return {...rest2, audits:(r.audits||[]).slice(0,10), titleSet:[...new Set(titles)], logSet:[...new Set(logs)],
    lineSet:[...new Set(all)].filter(x=>x.trim()), tailLogs:logs.slice(-14)};
}), null, 0));
console.log(JSON.stringify({n:runs.length, errs:runs.filter(r=>r.err).length,
  avgMs:Math.round(runs.reduce((a,r)=>a+r.ms,0)/runs.length)}));
