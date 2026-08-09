// 關原體驗戰探針:兩陣營勝率/裏切り率/回合數/乾淨返回標題
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
ev('S=newState("試",0,"kokujin","gozoku","mikawa")');   // scenario 需要 S 存在(與力心境查 rivals)

function play(side, policy){
  ev('KS=null; BT=null;');
  $('modalBack').classList.add('hidden');
  sb.kokusenSeki(side);
  let guard = 0, outcome = null, rounds = 0, betrayed = false;
  while(!$('modalBack').classList.contains('hidden') && guard++ < 40){
    const title = $('modalTitle').textContent;
    if(/【勝】/.test(title)) outcome = true;
    if(/【敗】/.test(title)) outcome = false;
    if(/盤上指揮/.test(title) && ev('KS && KS.hex && !KS.hexDone')){
      if(policy === 'auto') ev('ksHexAutoBtn()');
      else{
        let gg = 0;
        while(gg++ < 22 && ev('KS && KS.hex && !KS.hexDone')){
          const KS2 = ev('KS');
          const mine = KS2.hex.units.filter(u=>u.side==='my' && !u.s.broke);
          mine.forEach(u=>{ if(u.s.kind!=='vassal') u.ord = policy; });
          ev('ksHexTick()');
        }
      }
      rounds = Math.max(rounds, ev('KS ? KS.round : 0') || rounds);
      continue;
    }
    const btns = [...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
    if(!btns.length){ $('modalBack').classList.add('hidden'); break; }
    const by = re => btns.find(b=>re.test(b.textContent));
    let pick = null;
    if(by(/^開戰/)) pick = by(/^開戰/);
    else if(outcome !== null){ betrayed = /裏切り向東|向西勤王/.test($('modalBody').textContent); pick = by(/回到標題/); }
    (pick || btns[0]).click();
  }
  const titleBack = !ev('document.getElementById("titleScreen").classList.contains("hidden")');
  return {outcome, rounds, betrayed, titleBack};
}

const N = 40;
for(const [tag, side, pol] of [
  ['西軍大谷・委任', 'west', 'auto'],
  ['西軍大谷・全軍突擊', 'west', 'chg'],
  ['東軍黑田・委任', 'east', 'auto'],
  ['東軍黑田・全軍突擊', 'east', 'chg'],
]){
  let w=0, n=0, rr=0, bt=0, back=0;
  for(let i=0;i<N;i++){
    const r = play(side, pol);
    if(r.outcome === null) continue;
    n++; if(r.outcome) w++;
    rr += r.rounds; if(r.betrayed) bt++;
    if(r.titleBack) back++;
  }
  console.log(tag.padEnd(14), '勝率', Math.round(w/Math.max(1,n)*100)+'%', ' 局數', n,
    ' 均回合', (rr/Math.max(1,n)).toFixed(1),
    ' 裏切り率', Math.round(bt/Math.max(1,n)*100)+'%',
    ' 乾淨返回', Math.round(back/Math.max(1,n)*100)+'%');
}
