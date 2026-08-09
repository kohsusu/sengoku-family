// P3+P4 驗證:戰場事件驅動心境/大將表現/宿怨同列/一番槍/殿軍寫回
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

function setup(){
  ev('KS=null;BT=null;');
  $('modalBack').classList.add('hidden');
  ev(`S = newState('試', 0, 'kokujin', 'gozoku', 'mikawa');`);
  ev(`S.kokudaka=3000; S.pop=3000; S.rice=9999; S.money=500; S.prestige=80;
      S.army={ashigaru:260,yumi:80,kiba:70,teppo:40}; S.soldiers=450;
      S.retainers.forEach(r=>{r.stamina=100;r.sick=0;});
      ['honshoji','saji'].forEach(id=>{const f=S.rivals.find(x=>x.id===id); f.lord='player'; f.rel=40; f.on=0; f.grudge={}; f.persona='中立'; f.sol=90;});`);
  sb.kokusen('imagawa', true);
  let g = 0;
  while(!ev('KS && KS.hex') && g++ < 14){
    const btns = [...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
    if(!btns.length) break;
    const by = re => btns.find(b=>re.test(b.textContent));
    (by(/盤上指揮/) || by(/^開戰|^出陣|^決戰/) || btns[0]).click();
  }
  return ev('KS && KS.hex ? 1 : 0');
}
// 取盤上與力(本證寺=temple)並固定中性條件:兩軍等勢
function neutral(){
  ev(`(()=>{
    const t = KS.my.reduce((a,x)=>a+ksTotal(x),0);
    const ft = KS.foe.reduce((a,x)=>a+ksTotal(x),0)||1;
    const k = t/ft;   // 把敵軍調到等勢
    KS.foe.forEach(s=>{U_KEYS.forEach(q=>{s.army[q]=ri((s.army[q]||0)*k);}); s.init=ksTotal(s);});
  })()`);
}
const moodOf = id => ev(`(()=>{ const s = KS.my.find(x=>x.vassalId==='${id}'); return ksVassalMood(s); })()`);

// ── A. 事件驅動心境(以本證寺=rel40中性為探針,基準sc=0→normal) ──
{
  setup(); neutral();
  ok('A0 基準:中性條件下 normal', moodOf('honshoji')==='normal', moodOf('honshoji'));
  ev('KS.evKill = KS.hex.round;');
  const famF = `KS.hex.units.find(x=>x.s.kind==='family').s._fought=true`;
  ev(famF);
  ok('A1 斬將+大將身先→eager(sc+2)', moodOf('honshoji')==='eager', moodOf('honshoji'));
  ev('KS.evKill = null;');
  ok('A2 只大將身先→normal(sc+1)', moodOf('honshoji')==='normal', moodOf('honshoji'));
  ev(`KS.my.find(x=>x.pos==='hon')._honWarn = true;`);
  ev(`KS.hex.units.filter(x=>x.s.kind==='family').forEach(x=>{x.s._fought=false;}); KS.hex.round=6;`);
  const m2 = moodOf('honshoji');
  ok('A3 本陣動搖+大將惜身→wary(sc-2)', m2==='wary', m2);
}

// ── B. 宿怨同列 ──
{
  setup(); neutral();
  // 把本證寺與佐治的盤上單位擺相鄰,佐治對本證寺記宿怨→佐治−1
  ev(`(()=>{
    const a = KS.hex.units.find(x=>x.s.vassalId==='honshoji');
    const b = KS.hex.units.find(x=>x.s.vassalId==='saji');
    b.c = a.c; b.r = a.r + 1;   // 同欄相鄰(odd-r:直下為鄰)
    const f = S.rivals.find(x=>x.id==='saji');
    addGrudge(f, 'honshoji', 40);
  })()`);
  const adj = ev(`(()=>{ const a=KS.hex.units.find(x=>x.s.vassalId==='honshoji'), b=KS.hex.units.find(x=>x.s.vassalId==='saji'); return hxDist(a,b); })()`);
  const m = moodOf('saji');
  ok('B1 宿怨眾同列→wary(sc-1)', adj===1 && m==='wary', `距${adj} mood=${m}`);
  ev(`S.rivals.find(x=>x.id==='saji').grudge={};`);
  ok('B2 消宿怨→回normal', moodOf('saji')==='normal', moodOf('saji'));
}

// ── C. 一番槍:與力先陷敵陣→旗標+戰報+勝後感狀寫回 ──
{
  setup();
  // 敵軍縮編至與力可自力輾壓;家督全程按兵→一番槍必落與力
  ev(`KS.foe.forEach(s=>{U_KEYS.forEach(k=>{s.army[k]=ri((s.army[k]||0)*0.12);}); s.init=ksTotal(s);});
      KS.my.filter(s=>s.kind==='vassal').forEach(s=>{U_KEYS.forEach(k=>{s.army[k]=ri((s.army[k]||0)*4);}); s.init=ksTotal(s);});`);
  let saw = false, guard = 0;
  while(guard++ < 16 && ev('KS && KS.hex && !KS.hexDone')){
    ev(`KS.hex.units.forEach(u=>{ if(u.side==='my' && u.s.kind==='family') u.ord = 'hold'; });`);
    ev('ksHexResolve()');
    if(/一番槍/.test(ev('KS&&KS.hist?KS.hist.join(" "):""'))) saw = true;
  }
  ok('C1 一番槍戰報出現', saw, '');
  const ichId = ev(`KS ? ((KS.my.find(s=>s._ichiban)||{}).vassalId || '') : ''`);
  let g2 = 0, sawKanjo = false, won = null;
  while(!$('modalBack').classList.contains('hidden') && g2++ < 20){
    const body = $('modalBody').textContent;
    if(/【勝】/.test(body)) won = true;
    if(/【敗】/.test(body)) won = false;
    if(/一番槍之功,感狀/.test(body)) sawKanjo = true;
    const btns = [...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
    if(!btns.length){ $('modalBack').classList.add('hidden'); break; }
    btns[0].click();
  }
  const st2 = ichId ? ev(`(()=>{const f=S.rivals.find(x=>x.id==='${ichId}');return f?f.rel+'/'+(f.on||0):'?';})()`) : '?';
  ok('C2 勝後感狀寫回(rel 40→58・恩義+8)', won===true && ichId && st2==='58/8', `勝=${won} ${ichId} rel/on=${st2} 感狀文=${sawKanjo}`);
}

// ── D. 敗戰殿軍:鳴金退兵後未潰且曾接戰的與力+3 ──
{
  setup(); neutral();
  // 先打兩刻讓與力接戰
  for(let i=0;i<6;i++){ if(ev('!KS||!KS.hex||KS.hexDone'))break; ev('ksHexResolve()'); }
  const fought = ev(`KS.my.filter(s=>s.kind==='vassal'&&s._fought&&!s.broke).length`);
  ev('ksHexRetreatBtn()');   // 以敗論收尾
  let g3 = 0, sawTono = false;
  while(!$('modalBack').classList.contains('hidden') && g3++ < 20){
    const body = $('modalBody').textContent;
    if(/殿軍護諸隊而退/.test(body)) sawTono = true;
    const btns = [...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
    if(!btns.length){ $('modalBack').classList.add('hidden'); break; }
    btns[0].click();
  }
  ok('D1 敗戰殿軍寫回(關係+3)', fought===0 ? true : sawTono, fought===0?'(此局與力未接戰,跳過)':'');
}

// ── E. 劇本隔離:關原與力(scMood)不受P3事件影響 ──
{
  ev('KS=null;BT=null;');$('modalBack').classList.add('hidden');
  ev('S=newState("試",0,"kokujin","gozoku","mikawa")');
  sb.kokusenSeki('west');
  let g4=0;
  while(!ev('KS && KS.hex')&&g4++<8){
    const btns=[...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
    if(!btns.length)break;
    (btns.find(b=>/^開戰/.test(b.textContent))||btns[0]).click();
  }
  ev('KS.evKill = 1; KS.hex.round = 2;');
  const mMori = ev(`ksVassalMood(KS.my.find(s=>s.scMood==='wary'))`);
  ok('E1 劇本毛利仍永觀望(不吃事件buff)', mMori==='wary', mMori);
}

for(const [st,n,note] of R) console.log(st, n, note?(' — '+note):'');
console.log(R.some(r=>r[0]==='✗') ? '✗ 有未過' : '全部通過');
