// P2 六角盤驗證:雙模式勝率對照、回合數、要地與討取戲份
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
const g = sb.window.__game, ev = c => vm.runInContext(c, sb);
vm.runInContext('render=function(){};drawMap=function(){};save=function(){};', sb);
const $ = id => doc.getElementById(id);
const ri0 = x => Math.round(x);

function playKokusen(mode, policy){
  // mode: 'hex'|'old';policy(u): 給 hex 我軍下令的函數(null=用預設select)
  ev('KS = null; BT = null;');
  $('modalBack').classList.add('hidden');
  ev(`S = newState('試', 0, 'kokujin', 'gozoku', 'mikawa');`);
  const S = g.S;
  // 給玩家一支像樣的軍隊(中期水準)
  S.kokudaka = 3000; S.pop = 3000;
  const MA = +(process.env.MYARMY||380);
  S.army = {ashigaru:ri0(MA*0.58), yumi:ri0(MA*0.18), kiba:ri0(MA*0.16), teppo:ri0(MA*0.08)};
  S.soldiers = S.army.ashigaru+S.army.yumi+S.army.kiba+S.army.teppo;
  S.rice = 9999; S.money = 9999; S.prestige = 80;
  S.retainers.forEach(r=>{ r.stamina=100; r.sick=0;
    if(process.env.FORCEBU) r.bu = +process.env.FORCEBU; });
  sb.kokusen('imagawa', true);
  let guard = 0, outcome = null, rounds = 0, feats = 0, kills = 0;
  while(!$('modalBack').classList.contains('hidden') && guard++ < 60){
    const title = $('modalTitle').textContent;
    const body2 = $('modalBody').textContent;
    if(/【勝】/.test(body2)) outcome = true;
    if(/【敗】/.test(body2)) outcome = false;
    if(/據(渡口|高地)/.test(body2)) feats++;
    if(/討取/.test(body2)) kills++;
    // 即時盤面:直驅核心
    if(mode==='hex' && /盤上指揮/.test(title) && ev('KS && KS.hex && !KS.hexDone')){
      if(policy === 'auto') ev('ksHexAutoBtn()');
      else{
        let gg = 0;
        while(gg++ < 20 && ev('KS && KS.hex && !KS.hexDone')){
          const KS2 = ev('KS');
          const mine = KS2.hex.units.filter(u=>u.side==='my' && !u.s.broke);
          mine.forEach(u=>{ if(u.s.kind!=='vassal' && policy) u.ord = (typeof policy==='function') ? policy(u, KS2) : policy; });
          ev('ksHexTick()');
        }
      }
      rounds = Math.max(rounds, ev('KS ? KS.round : 0') || rounds);
      continue;
    }
    const m = title.match(/第 (\d+)\/10 陣/);
    if(m) rounds = Math.max(rounds, +m[1]);
    const btns = [...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
    if(!btns.length){ $('modalBack').classList.add('hidden'); break; }
    const by = re => btns.find(b=>re.test(b.textContent));
    let pick = null;
    if(by(/布陣へ/)) pick = by(/布陣へ/);
    else if(by(/開戰——/)) pick = mode==='hex' ? by(/開戰——盤上/) : by(/開戰——軍配/);
    else if(by(/突擊|遠戰|固守|迂迴/)) pick = by(/突擊/);   // 舊模式全軍指令
    else if(by(/收兵|割地|受其降伏/)) pick = by(/割地/) || by(/收兵/) || btns[0];
    (pick || btns[0]).click();
  }
  return {outcome, rounds, feats, kills};
}

const N = 60;
function sweep(name, mode, policy){
  let w=0, n=0, rr=0, ff=0, kk=0, undec=0;
  for(let i=0;i<N;i++){
    const r = playKokusen(mode, policy);
    if(r.outcome === null){ undec++; continue; }
    n++; if(r.outcome) w++;
    rr += r.rounds; ff += r.feats; kk += r.kills;
  }
  console.log(name.padEnd(16), '勝率', Math.round(w/Math.max(1,n)*100)+'%', ' 局數', n, '未決', undec,
    ' 均回合', (rr/Math.max(1,n)).toFixed(1), ' 要地事件/局', (ff/Math.max(1,n)).toFixed(1),
    ' 討取/局', (kk/Math.max(1,n)).toFixed(2));
}
const balanced = (u, KS2)=>{   // 像樣的玩家:先鋒突擊、翼搶要地、本陣固守後壓上
  if(u.s.pos === 'hon') return KS2.hex.round >= 5 ? 'adv' : 'hold';
  if(u.s.pos === 'left' || u.s.pos === 'right') return KS2.hex.round < 3 ? 'feat' : 'adv';
  return 'chg';
};
sweep('舊軍配式(全突擊)', 'old', null);
sweep('盤上・全委任', 'hex', 'auto');
sweep('盤上・均衡指揮', 'hex', balanced);
sweep('盤上・全軍突擊', 'hex', ()=> 'chg');
sweep('盤上・龜縮固守', 'hex', ()=> 'hold');
