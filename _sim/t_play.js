// 親自遊玩東西軍:六種打法對照(主角單隊軍令),含代表局年表
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

function play(side, ord){
  ev('KS=null; BT=null;');
  $('modalBack').classList.add('hidden');
  sb.kokusenSeki(side);
  let guard = 0, outcome = null, betrayed = false, chron = null, hero = null, kills = '';
  while(!$('modalBack').classList.contains('hidden') && guard++ < 40){
    const title = $('modalTitle').textContent;
    if(/【勝】/.test(title)) outcome = true;
    if(/【敗】/.test(title)) outcome = false;
    if(/盤上指揮/.test(title) && ev('KS && KS.hex && !KS.hexDone')){
      if(ord === 'auto') ev('ksHexAutoBtn()');
      else{
        let gg = 0;
        while(gg++ < 22 && ev('KS && KS.hex && !KS.hexDone')){
          const KS2 = ev('KS');
          KS2.hex.units.filter(u=>u.side==='my' && !u.s.broke && u.s.kind==='family')
            .forEach(u=>{ u.ord = ord; });
          ev('ksHexTick()');
        }
      }
      continue;
    }
    const btns = [...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
    if(!btns.length){ $('modalBack').classList.add('hidden'); break; }
    const by = re => btns.find(b=>re.test(b.textContent));
    if(outcome !== null){
      const body = $('modalBody').textContent;
      betrayed = /裏切り向東|向西勤王/.test(body);
      chron = (body.match(/[辰巳午未申]の刻 [\d:]+ ─ [^\n]+/g)||[]);
      const hm = body.match(/(大谷|黑田) (\d+)→(\d+)\((.+?)\)/);
      if(hm) hero = {from:+hm[2], to:+hm[3], state:hm[4]};
      const km = body.match(/討取:([^\n]+)/);
      if(km) kills = km[1];
      const b = by(/回到標題/);
      if(b){ b.click(); continue; }
    }
    const b2 = by(/^開戰/) || btns[0];
    b2.click();
  }
  const endT = ev('typeof ksHexTimeStr==="function" ? "" : ""');
  return {outcome, betrayed, chron, hero, kills};
}

const ORDS = [['auto','全軍委任'],['chg','全軍突擊(自隊猛攻)'],['hold','自隊死守'],['feat','自隊搶要地'],['hon','直取敵本陣'],['back','自隊保身後撤']];
const N = 30;
for(const side of ['west','east']){
  console.log('════════ ' + (side==='west' ? '西軍・大谷吉継' : '東軍・黑田長政') + ' ════════');
  for(const [ord, label] of ORDS){
    let w=0, n=0, bt=0, heroDead=0, heroLoss=0, killCt=0, sample=null;
    for(let i=0;i<N;i++){
      const r = play(side, ord);
      if(r.outcome === null) continue;
      n++; if(r.outcome) w++;
      if(r.betrayed) bt++;
      if(r.hero){ if(r.hero.state.includes('潰走')) heroDead++; heroLoss += (r.hero.from - r.hero.to); }
      if(r.kills) killCt++;
      if(!sample && r.chron && r.chron.length >= 3) sample = {win:r.outcome, chron:r.chron.slice(0,6), kills:r.kills};
    }
    console.log(label.padEnd(14), '勝率', Math.round(w/Math.max(1,n)*100)+'%',
      ' 裏切り', Math.round(bt/Math.max(1,n)*100)+'%',
      ' 自隊潰走', Math.round(heroDead/Math.max(1,n)*100)+'%',
      ' 自隊均損', Math.round(heroLoss/Math.max(1,n)),
      ' 有討取', Math.round(killCt/Math.max(1,n)*100)+'%');
    if(sample && (ord==='hon' || ord==='feat' || ord==='auto')){
      console.log('   ┌代表局(' + (sample.win?'勝':'敗') + ')' + (sample.kills?' 討取:'+sample.kills:''));
      sample.chron.forEach(l=>console.log('   │ ' + l));
    }
  }
}
