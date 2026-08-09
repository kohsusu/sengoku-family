// 國戰組合掃描:模式 × 兵力 × 從屬眾數 × 軍役檔——回合數統計與從屬眾影響
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
vm.runInContext('render=function(){};drawMap=function(){};save=function(){};', sb);
const g = sb.window.__game, ev = c => vm.runInContext(c, sb);
const $ = id => doc.getElementById(id);

function playKokusen(cfg){
  // cfg: {mode:'old'|'hex', myArmy, nVassal, levy(0/1/2)}
  ev('KS=null; BT=null;');
  $('modalBack').classList.add('hidden');
  ev('S=newState("試",0,"kokujin","gozoku","mikawa")');
  const S = g.S;
  S.kokudaka = 3000; S.pop = 3000;
  const MA = cfg.myArmy;
  S.army = {ashigaru:Math.round(MA*0.58), yumi:Math.round(MA*0.18), kiba:Math.round(MA*0.16), teppo:Math.round(MA*0.08)};
  S.soldiers = S.army.ashigaru + S.army.yumi + S.army.kiba + S.army.teppo;
  S.rice = 99999; S.money = 99999; S.prestige = 80;
  S.retainers.forEach(r=>{ r.stamina = 100; r.sick = 0; });
  // 從屬眾:各 100 兵
  S.rivals.slice(0, cfg.nVassal).forEach(f=>{ f.lord = 'player'; f.sol = 100; f.rel = 40; });
  sb.kokusen('imagawa', true);
  // 軍議頁:設軍役檔
  ev('if(KS) KS.my.filter(s=>s.kind==="vassal").forEach(s=>{ s.levy = ' + cfg.levy + '; }); if(KS) ksLevySync(KS.my);');
  const famBefore = S.soldiers;
  let guard = 0, outcome = null, rounds = 0, vasLost = 0, defect = 0, relPlus = 0;
  while(!$('modalBack').classList.contains('hidden') && guard++ < 70){
    const title = $('modalTitle').textContent;
    const body2 = $('modalBody').textContent;
    if(/【勝】/.test(body2)) outcome = true;
    if(/【敗】/.test(body2)) outcome = false;
    if(outcome !== null){
      (body2.match(/折兵 (\d+)/g)||[]).forEach(mm=>{ vasLost += +mm.replace('折兵 ',''); });
      defect += (body2.match(/脫離.*從屬/g)||[]).length;
      relPlus += (body2.match(/無所怨言/g)||[]).length;
    }
    const m = title.match(/第 (\d+)\/(9|10) 陣/);
    if(m) rounds = Math.max(rounds, +m[1]);
    const btns = [...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
    if(!btns.length){ $('modalBack').classList.add('hidden'); break; }
    const by = re => btns.find(b=>re.test(b.textContent));
    let pick = null;
    if(by(/布陣へ/)) pick = by(/布陣へ/);
    else if(by(/開戰——/)) pick = cfg.mode==='hex' ? by(/開戰——盤上/) : by(/開戰——軍配/);
    else if(cfg.mode==='hex' && by(/^下令/)) pick = by(/全軍委任/);
    else if(by(/突擊|遠戰|固守|迂迴/)) pick = by(/突擊/);
    else if(by(/收兵|割地|受其降伏/)) pick = by(/割地/) || by(/收兵/) || btns[0];
    (pick || btns[0]).click();
  }
  const famLost = Math.max(0, famBefore - S.soldiers);
  return {outcome, rounds, vasLost, defect, relPlus, famLost};
}

const N = 50;
function sweep(tag, cfg){
  let w=0, n=0, R=[], vl=0, df=0, rp=0, fl=0;
  for(let i=0;i<N;i++){
    const r = playKokusen(cfg);
    if(r.outcome === null) continue;
    n++; if(r.outcome) w++;
    R.push(r.rounds); vl += r.vasLost; df += r.defect; rp += r.relPlus; fl += r.famLost;
  }
  R.sort((a,b)=>a-b);
  const p = q => R[Math.floor(R.length*q/100)] || 0;
  console.log(tag.padEnd(26),
    '勝率', String(Math.round(w/Math.max(1,n)*100)+'%').padStart(4),
    '回合p50/p90', p(50)+'/'+p(90),
    ' 自家折損/局', Math.round(fl/Math.max(1,n)),
    ' 從屬折兵/局', Math.round(vl/Math.max(1,n)),
    ' 離反/局', (df/Math.max(1,n)).toFixed(2));
}

console.log('════ 軍配式 ════');
sweep('劣勢380・無從屬',        {mode:'old', myArmy:380, nVassal:0, levy:1});
sweep('劣勢380・從屬2(半數)',   {mode:'old', myArmy:380, nVassal:2, levy:1});
sweep('劣勢380・從屬5(半數)',   {mode:'old', myArmy:380, nVassal:5, levy:1});
sweep('劣勢380・從屬5(傾力)',   {mode:'old', myArmy:380, nVassal:5, levy:2});
sweep('勢均650・無從屬',        {mode:'old', myArmy:650, nVassal:0, levy:1});
sweep('勢均650・從屬5(傾力)',   {mode:'old', myArmy:650, nVassal:5, levy:2});
console.log('════ 盤上指揮(委任) ════');
sweep('劣勢380・無從屬',        {mode:'hex', myArmy:380, nVassal:0, levy:1});
sweep('劣勢380・從屬2(半數)',   {mode:'hex', myArmy:380, nVassal:2, levy:1});
sweep('劣勢380・從屬5(半數)',   {mode:'hex', myArmy:380, nVassal:5, levy:1});
sweep('劣勢380・從屬5(傾力)',   {mode:'hex', myArmy:380, nVassal:5, levy:2});
sweep('勢均650・無從屬',        {mode:'hex', myArmy:650, nVassal:0, levy:1});
sweep('勢均650・從屬5(傾力)',   {mode:'hex', myArmy:650, nVassal:5, levy:2});
