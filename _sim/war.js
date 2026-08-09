// 1000 場戰爭模擬:掃描兵種編成 × 陣形 × 指令 × 地形天候 × 大將能力適性 × 兵力比
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { doc, localStorage } = require('./shim');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = [...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][0][1];
const sb = {document:doc, localStorage, console, Math, JSON, Date,
  performance:{now:()=>Date.now()}, setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame:()=>0, Image:class{}, navigator:{userAgent:'node'},
  alert:()=>{}, confirm:()=>true,
  matchMedia:()=>({matches:false, addListener(){}, addEventListener(){}}),
  location:{port:'5877', reload(){}, replace(){}}};
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext(src, sb, {filename:'game.js'});
vm.runInContext("render=function(){ if(S){armySync();aptSync();} }; drawMap=function(){}; save=function(){}; log=function(){};", sb);
const g = sb.window.__game, ev = c => vm.runInContext(c, sb);
const $ = id => doc.getElementById(id);
$('modalBack').classList.add('hidden');   // 真實 HTML 上 modalBack 預設就有 hidden
const hidden = () => $('modalBack').classList.contains('hidden');
const btns = () => $('modalChoices').querySelectorAll('button');

// ── 亂數(可重現) ──
let SEED = 20260802;
function rnd(){ SEED = (SEED * 1664525 + 1013904223) >>> 0; return SEED / 4294967296; }
const pick = a => a[Math.floor(rnd() * a.length)];
const ri = n => Math.round(n);
sb.Math = Object.create(Math);          // 讓遊戲內部也走可重現亂數
sb.Math.random = rnd;
vm.runInContext("Math = this.Math;", sb);

const U = ['ashigaru','yumi','kiba','teppo'];
const MIX = {
  '純槍':      {ashigaru:1,   yumi:0,   kiba:0,   teppo:0},
  '純弓':      {ashigaru:0,   yumi:1,   kiba:0,   teppo:0},
  '純騎':      {ashigaru:0,   yumi:0,   kiba:1,   teppo:0},
  '純砲':      {ashigaru:0,   yumi:0,   kiba:0,   teppo:1},
  '槍騎(武斷)': {ashigaru:.5,  yumi:.1,  kiba:.35, teppo:.05},
  '弓砲(遠戰)': {ashigaru:.25, yumi:.35, kiba:.05, teppo:.35},
  '均衡':      {ashigaru:.45, yumi:.25, kiba:.18, teppo:.12},
  '槍衾(拒馬)': {ashigaru:.75, yumi:.15, kiba:.05, teppo:.05}
};
function army(n, mixName){
  const p = MIX[mixName], a = {}; let acc = 0;
  U.forEach((k,i)=>{ if(i<3){ a[k] = ri(n*p[k]); acc += a[k]; } });
  a.teppo = Math.max(0, n - acc);
  return a;
}
const FORMS = ['gyorin','kakuyoku','hoen','gankou'];   // 魚鱗/鶴翼/方圓/雁行
const CMDS  = ['volley','charge','hold','flank'];      // 按鈕順序
const CMD_NAME = {volley:'遠戰', charge:'突擊', hold:'固守', flank:'迂迴'};
const FORM_NAME = {gyorin:'魚鱗', kakuyoku:'鶴翼', hoen:'方圓', gankou:'雁行'};

// 指令方針
const POLICIES = {
  '一律突擊':  () => 'charge',
  '一律遠戰':  () => 'volley',
  '一律固守':  () => 'hold',
  '一律迂迴':  () => 'flank',
  '隨機':      () => pick(CMDS),
  '因敵制宜':  (my, foe) => {           // 依雙方編成挑相剋的打法
    const t = a => (a.ashigaru||0)+(a.yumi||0)+(a.kiba||0)+(a.teppo||0) || 1;
    const myRng = ((my.yumi||0)+(my.teppo||0))/t(my), myMelee = ((my.ashigaru||0)+(my.kiba||0))/t(my);
    const foeKiba = (foe.kiba||0)/t(foe), foeRng = ((foe.yumi||0)+(foe.teppo||0))/t(foe);
    if(myRng > 0.5) return 'volley';
    if(foeRng > 0.45 && (my.kiba||0)/t(my) > 0.2) return 'charge';
    if(foeKiba > 0.3 && myMelee > 0.6) return 'hold';
    return myMelee > 0.55 ? 'charge' : 'volley';
  }
};

// ── 建立一個受控的家 ──
function setup(opt){
  $('modalBack').classList.add('hidden');
  ev('modalQueue.length = 0');
  g.startGame(g.newState('試', 0, 'kokujin', 'gozoku'));
  let gd = 0;
  while(!hidden() && gd++ < 20){ const b = btns(); if(!b.length){ $('modalBack').classList.add('hidden'); break; } b[0].click(); }
  const S = g.S;
  S.kokudaka = 3000; S.money = 5000; S.rice = 9000; S.pop = 6000;
  S.fort = opt.myFort || 0;
  S.prestige = opt.prestige ?? 60;
  // 大將:指定武勇與適性
  const lead = S.retainers[1] || S.retainers[0];
  lead.bu = opt.bu; lead.chi = 60; lead.nai = 50;
  lead.apt = opt.apt; lead.apt2 = null; lead.wapt = opt.wapt || null;
  lead.sick = 0; lead.stamina = 100; lead.trait = null;
  S.retainers.forEach(r=>{ r.loyalty = opt.loyalty ?? 75; r.sick = 0; r.stamina = 100; });
  S.taishoId = lead.name;
  S.army = army(opt.myN, opt.myMix); S.soldiers = opt.myN;
  return {S, lead};
}

// ══════════ A. 眾之間的戰鬥(五陣引擎) ══════════
function runField(o){
  const {S, lead} = setup(o);
  let res = null;
  const foeArmy = army(o.foeN, o.foeMix);
  g.startBattle({
    title:'試', intro:'', sent:{...S.army}, terrain:o.terrain, weather:o.weather,
    isSiege:o.siege, defendSiege:o.defend,
    foe:{name:'敵', army:foeArmy, morale:o.foeMor, fort:o.foeFort||0,
         general:{bu:o.foeBu, chi:55}},
    onEnd:r=>{ res = r; }
  });
  // 布陣
  const fi = FORMS.indexOf(o.form);
  if(!hidden()) btns()[fi]?.click();
  // 逐陣下令
  let guard = 0, round = 0;
  while(!hidden() && guard++ < 30){
    const bs = btns();
    if(bs.length === 1){ bs[0].click(); continue; }        // 收兵
    if(bs.length !== 4) { bs[0].click(); continue; }
    if(o.siege){   // 攻城用寄せ手の四手:射掛 → 仕寄 → 登城(隨機摻雜火矢)
      const r = ++round;
      const idx = r===1 ? (rnd()<0.25?3:0) : r===2 ? 1 : (rnd()<0.15?0:2);
      bs[idx].click();
    }else{
      const cmd = POLICIES[o.policy](S.army, foeArmy);
      bs[CMDS.indexOf(cmd)].click();
    }
  }
  return res;
}

// ══════════ B. 大名國戰(七陣・備制) ══════════
function runKokusen(o){
  const {S} = setup(o);
  S.isDaimyo = true; S.allegiance = null;
  S.lords[o.target].demesne = o.foeDemesne;
  S.lords[o.target].alive = true;
  if(o.slain) sb.window.__game.S.slain = {[o.target]: o.slain};
  let done = null;
  const koku0 = S.kokudaka, sol0 = S.soldiers;
  g.kokusen(o.target, o.attack);
  if(hidden()) return null;
  // 軍議 → 布陣
  btns()[0].click();
  // 布陣:依方針指派位置
  const KS = g.KS;
  if(!KS) return null;
  const foeN = KS.foe.reduce((a,s)=>a+ev('armyTotal')(s.army), 0);
  const layouts = {
    '標準':   ['hon','sen','left','right'],
    '全軍突前':['hon','sen','sen','sen'],
    '龜甲':   ['hon','hon','dono','dono'],
    '兩翼':   ['hon','left','right','dono']
  };
  const L = layouts[o.layout];
  KS.my.forEach((s,i)=>{ s.pos = L[i % L.length]; });
  if(!KS.my.some(s=>s.pos === 'hon')) KS.my[0].pos = 'hon';
  btns()[0].click();   // 開戰
  let guard = 0, rounds = 0;
  while(!hidden() && guard++ < 40){
    const bs = btns();
    if(bs.length === 1){ bs[0].click(); continue; }
    if(bs.length === 2){ bs[0].click(); continue; }   // 最後の一城 → 受降
    if(bs.length !== 4){ bs[0].click(); continue; }
    // 采配
    if(o.sai !== 'none' && g.KS){
      const cands = g.KS.my.map((s,i)=>[s,i]).filter(([s])=>!s.broke && s.pos !== 'dono');
      if(cands.length){
        const [, idx] = cands[Math.floor(rnd()*cands.length)];
        $('ksSai').value = `${idx}:${o.sai}`;
      }
    } else $('ksSai').value = '';
    const cmd = POLICIES[o.policy](S.army, {ashigaru:1,yumi:0,kiba:0,teppo:0});
    bs[CMDS.indexOf(cmd)].click();
    rounds++;
  }
  return {win: S.kokudaka > koku0, dKoku: S.kokudaka - koku0, lost: sol0 - S.soldiers,
    rounds, foeN, slain: Object.values(S.slain||{}).reduce((a,x)=>a+x.length,0)};
}

// ══════════ 掃描 ══════════
const N_FIELD = Number(process.argv[2] || 700);
const N_KOKU  = Number(process.argv[3] || 300);
const field = [], koku = [];

const mixNames = Object.keys(MIX);
const polNames = Object.keys(POLICIES);
for(let i = 0; i < N_FIELD; i++){
  const ratio = pick([0.5, 0.7, 0.85, 1.0, 1.2, 1.5, 2.0]);
  const foeN = pick([60, 120, 200, 350]);
  const o = {
    myN: Math.max(10, ri(foeN * ratio)), foeN,
    myMix: pick(mixNames), foeMix: pick(mixNames),
    form: pick(FORMS), policy: pick(polNames),
    terrain: pick(['plain','plain','mountain','river']),
    weather: pick(['clear','clear','clear','rain','fog']),
    bu: pick([30, 45, 60, 75, 88]),
    apt: pick(U), wapt: rnd() < 0.6 ? pick(U) : null,
    foeBu: pick([45, 60, 75]), foeMor: pick([70, 80, 90]),
    siege: rnd() < 0.2, defend: rnd() < 0.2,
    foeFort: 0, myFort: 0, loyalty: pick([40, 60, 80, 95]), prestige: pick([10, 60, 120])
  };
  if(o.siege){ o.foeFort = pick([1,2,3]); o.defend = false; }
  if(o.defend){ o.myFort = pick([1,2,3]); }
  let r = null;
  try{ r = runField(o); }catch(e){ field.push({...o, err:e.message}); continue; }
  if(!r) { field.push({...o, err:'no result'}); continue; }
  const aptShare = (o.myN ? (army(o.myN,o.myMix)[o.apt]||0)/o.myN : 0);
  field.push({...o, ratio, win:r.win, myLost:r.myLost, foeLoss:+r.foeLossRatio.toFixed(3),
    rounds:r.rounds, brokeMy:r.broke.my, brokeFoe:r.broke.foe, aptShare:+aptShare.toFixed(2)});
}

const layoutNames = ['標準','全軍突前','龜甲','兩翼'];
const saiNames = ['none','totsu','taiki','ukai'];
for(let i = 0; i < N_KOKU; i++){
  const o = {
    myN: pick([200, 400, 700, 1100]), myMix: pick(mixNames),
    foeDemesne: pick([1500, 3000, 5000, 8000]),
    target: pick(['imagawa','oda']), attack: rnd() < 0.6,
    layout: pick(layoutNames), sai: pick(saiNames), policy: pick(polNames),
    bu: pick([40, 60, 80]), apt: pick(U), wapt: null,
    myFort: pick([0, 2, 4]), loyalty: 75, prestige: 80,
    terrain:'plain', weather:'clear', foeBu:60, foeMor:80
  };
  let r = null;
  try{ r = runKokusen(o); }catch(e){ koku.push({...o, err:e.message}); continue; }
  if(!r){ koku.push({...o, err:'skip'}); continue; }
  koku.push({...o, ...r});
}

fs.writeFileSync(path.join(__dirname, 'wars.json'), JSON.stringify({field, koku}));
console.log(JSON.stringify({field:field.length, fieldErr:field.filter(x=>x.err).length,
  koku:koku.length, kokuErr:koku.filter(x=>x.err).length}));
