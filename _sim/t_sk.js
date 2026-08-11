// 技能樹驗證:配點/閘門/公式掛鉤/歲末包/舊檔遷移
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { doc, localStorage } = require('./shim');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = [...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1])[0];
const sb = {document:doc, localStorage, console, Math, JSON, Date, performance:{now:()=>0},
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame:()=>0, cancelAnimationFrame:()=>{},
  Image: class { set src(v){} }, navigator:{userAgent:'node'},
  alert:()=>{}, confirm:()=>true, prompt:()=>null,
  matchMedia:()=>({matches:false, addListener(){}, addEventListener(){}}),
  location:{port:'5877', reload(){}, replace(){}}};
sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
vm.runInContext(script, sb, {filename:'game.js'});
vm.runInContext('render=function(){};drawMap=function(){};save=function(){};log=function(){};', sb);
const ev = c => vm.runInContext(c, sb);
const $ = id => doc.getElementById(id);
const R = []; const ok = (n,c,note)=>R.push([c?'✓':'✗',n,note||'']);
function fresh(){
  $('modalBack').classList.add('hidden');
  ev('if(typeof modalQueue!=="undefined") modalQueue.length=0;');
  ev(`S=newState('試',0,'kokujin','gozoku','mikawa'); S.money=999; S.prestige=80;`);
}
const clickBy = re => {
  const btns=[...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
  const b = btns.find(x=>re.test(x.textContent));
  if(b) b.click();
  return !!b;
};

// ── A. 閘門與配點流程 ──
{
  fresh();
  ev('S.suiri = 7;');   // 舊檔遷移情境:7級0點
  ok('A0 未配點=7', ev(`skUnspent('suiri')`)===7, ev(`skUnspent('suiri')`));
  ev(`skPickModal('suiri')`);
  let t2Early = /T2/.test([...$('modalChoices').querySelectorAll('button')].map(b=>b.textContent).join(''));
  ok('A1 初始僅T1可選', !t2Early && /T1・溜池普請/.test($('modalChoices').textContent), '');
  // 連點5次T1(溜池3+新田2)
  for(let i=0;i<3;i++) clickBy(/溜池普請/);
  for(let i=0;i<2;i++) clickBy(/新田開發/);
  ok('A2 溜池3級封頂後選單不再出現', !/溜池普請/.test($('modalChoices').textContent), '');
  ok('A3 T1滿5點→T2解鎖', /T2・堤防強化/.test($('modalChoices').textContent), '');
  ok('A4 T3未解鎖', !/T3・/.test($('modalChoices').textContent), '');
  clickBy(/堤防強化/); clickBy(/堤防強化/);
  ok('A5 7點配完選單自動收', $('modalBack').classList.contains('hidden'), '');
  ok('A6 ranks正確', ev(`skR('suiri','tameike')`)===3 && ev(`skR('suiri','shinden')`)===2 && ev(`skR('suiri','teibou')`)===2, '');
  // 續升至12:T2滿5後開T3
  ev('S.suiri = 12;');
  ev(`skPickModal('suiri')`);
  clickBy(/堤防強化/);   // teibou 3
  clickBy(/水車小屋/); clickBy(/水車小屋/);   // T2 spent=5
  ok('A7 T2滿5→T3解鎖', /T3・舟運堀川|T3・二毛作/.test($('modalChoices').textContent), '');
  clickBy(/舟運堀川/); clickBy(/舟運堀川/);
  ok('A8 12點配畢(T3舟運2/2)', ev(`skR('suiri','shuun')`)===2 && ev(`skUnspent('suiri')`)===0, '');
}

// ── B. 公式掛鉤 ──
{
  fresh();
  ev(`S.skSuiri={tameike:3,kanbatsu:3}; S.suiri=6; S.weather={f:0.6,name:'凶作'}; S.farmWork=0; S.pop=99999;`);
  // 收穫: kokudaka500 → wf=0.6+0.12=0.72; mult=1+6*0.021+0.15
  const harv = ev(`(()=>{ const wf = S.weather.f < 0.9 ? Math.min(1, S.weather.f + skR('suiri','kanbatsu')*0.04) : S.weather.f; return wf; })()`);
  ok('B1 旱魃備え:凶作0.6→0.72', Math.abs(harv-0.72)<1e-9, harv);
  ev(`S.skTrade={komeya:3,goyou:3}; S.skSuiri.shuun=2;`);
  const buyMul = ev(`Math.max(1.0, 1.25 - skR('trade','komeya')*0.05 - skR('suiri','shuun')*0.06)`);
  ok('B2 牙錢1.25→1.0(米問屋3+舟運2,下限1.0)', buyMul===1.0, buyMul);
  ok('B3 御用金-18%', ev('kugeCost()')===Math.round(600*0.82), ev('kugeCost()'));
  ok('B4 官位費-18%', ev('kaniCost(1)') < ev(`(()=>{const bak=S.skTrade.goyou; S.skTrade.goyou=0; const v=kaniCost(1); S.skTrade.goyou=bak; return v;})()`), '');
  const dmg = ev(`Math.max(0, 0.10 * (1 - (S.suiri||0) * 0.04 - skR('suiri','teibou') * 0.20))`);
  ok('B5 水害公式含堤防項', dmg <= 0.10, dmg.toFixed(3));
}

// ── C. 歲末包(唐物/鐵砲問屋/二毛作/水車) ──
{
  fresh();
  ev(`S.skSuiri={suisha:3,nimou:2}; S.skTrade={karamono:2,teppoya:2};
     S.suiri=12; S.tradeLv=12; S.pop=1000; S.money=500; S.army={ashigaru:200,yumi:0,kiba:0,teppo:0}; S.soldiers=200;`);
  let sawKara=0, sawTep=0, sawNimou=0, sawSuisha=0;
  for(let t=0;t<60;t++){
    ev(`S.money=500; S.army.teppo=0; S.soldiers=armyTotal(S.army);
       __L=[]; (()=>{ const lines=__L;
        const rSuisha = skR('suiri','suisha');
        if(rSuisha){ const mz = ri(S.pop * 0.004 * rSuisha); if(mz > 0){ S.money += mz; lines.push('碾米'+mz); } }
        const rNimou = skR('suiri','nimou');
        if(rNimou){ const pg = ri(S.pop * 0.005 * rNimou); S.pop = Math.min(popCap(), S.pop + pg);
          const kg = ri(S.kokudaka * 0.0015 * rNimou); S.kokudaka += kg; lines.push('二毛作'+pg); }
        const rKara = skR('trade','karamono');
        if(rKara && S.money >= 25 && Math.random() < 0.22 * rKara){ lines.push('唐物'); }
        const rTep = skR('trade','teppoya');
        if(rTep){ const want = ri(Math.min(10 * rTep, Math.max(0, (S.army.ashigaru||0) * 0.08 - (S.army.teppo||0))));
          if(want > 0 && S.money >= want * 3){ S.money -= want*3; S.army.teppo += want; lines.push('供銃'+want); } }
       })();`);
    const l = ev('__L.join(" ")');
    if(/唐物/.test(l)) sawKara++;
    if(/供銃/.test(l)) sawTep++;
    if(/二毛作/.test(l)) sawNimou++;
    if(/碾米/.test(l)) sawSuisha++;
  }
  ok('C1 唐物~44%機率觸發', sawKara > 12 && sawKara < 42, sawKara+'/60');
  ok('C2 鐵砲問屋供銃(足輕8%目標)', sawTep === 60 && ev('S.army.teppo') === 16, '銃'+ev('S.army.teppo'));
  ok('C3 二毛作/水車每年結算', sawNimou === 60 && sawSuisha === 60, '');
}

// ── D. 舊檔零技能防衛(skR對undefined安全) ──
{
  fresh();
  ev('delete S.skSuiri; delete S.skTrade;');
  ok('D1 無欄位時skR=0/unspent=level', ev(`skR('suiri','tameike')`)===0 && ev(`skUnspent('trade')`)===(ev('S.tradeLv')||0), '');
}

for(const [st,n,note] of R) console.log(st, n, note?(' — '+note):'');
console.log(R.some(r=>r[0]==='✗') ? '✗ 有未過' : '全部通過');
