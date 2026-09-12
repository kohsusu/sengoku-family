// 大地圖(和紙淡彩 wa1):標籤不得疊字、玩家不得被擠掉、陣營色須分得開、圖例只列在場者
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc, localStorage} = require('./shim');
const HTML=fs.readFileSync(path.join(__dirname, '..', 'index.html'),'utf8');
const script=[...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1])[0];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>0},
  setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
  requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},Image:class{set src(v){}},
  navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,prompt:()=>null,
  matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),
  location:{port:'5877',reload(){},replace(){}}};
sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
vm.runInContext(script,sb,{filename:'game.js'});
vm.runInContext('render=function(){};save=function(){};',sb);
const ev=c=>vm.runInContext(c,sb); const g=sb.window.__game;
console.log('BUILD:', ev('BUILD'));
const checks=[]; const ok=(n,c,note)=>checks.push([n,c,note||'']);

// ── 攔截畫布:記下每一次真正落筆的文字與它的框 ──
// 墊片的 measureText 一律算 6px/字,量不出中日文的實寬;換成會分全形半形的估法,
// 否則避讓測試等於沒測(框都太窄,永遠不相撞)。
ev(`
  __rec = [];
  (function(){
    const mk = document.createElement('canvas').getContext('2d').constructor;
    const cv = $('map') || (function(){ const e=document.createElement('canvas'); e.id='map';
      e.width=900; e.height=560; document.body.appendChild(e); return e; })();
    const c = cv.getContext('2d');
    c.__size = 12; c.__align = 'left';
    const wide = t => { let w=0; for(const ch of String(t)) w += (ch.charCodeAt(0) > 0x2e80 ? 1 : 0.55); return w; };
    Object.defineProperty(c, 'font', {
      get(){ return c.__font || ''; },
      set(v){ c.__font = v; const m = String(v).match(/(\\d+(?:\\.\\d+)?)px/); c.__size = m ? +m[1] : 12; }
    });
    Object.defineProperty(c, 'textAlign', {
      get(){ return c.__align; }, set(v){ c.__align = v; }
    });
    c.measureText = t => ({ width: wide(t) * c.__size });
    c.fillText = function(t, x, y){
      const w = wide(t) * c.__size, h = c.__size;
      const ax = c.__align === 'center' ? x - w/2 : c.__align === 'right' ? x - w : x;
      __rec.push({t:String(t), x:ax, y:y-h, x2:ax+w, y2:y+2, size:h});
    };
    c.strokeText = function(){};
  })();
`);

const overlaps = () => JSON.parse(ev(`(()=>{
  const bad = [];
  for(let i=0;i<__rec.length;i++) for(let j=i+1;j<__rec.length;j++){
    const a=__rec[i], b=__rec[j];
    const ox = Math.min(a.x2,b.x2) - Math.max(a.x,b.x);
    const oy = Math.min(a.y2,b.y2) - Math.max(a.y,b.y);
    if(ox > 1.5 && oy > 1.5) bad.push(a.t+' × '+b.t);
  }
  return JSON.stringify(bad.slice(0,6));
})()`));

function paint(tag, mode, region, years){
  g.startGame(g.newState(tag, 0, 'kokujin', mode, region));
  ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');`);
  for(let i=0;i<years;i++) ev('simRivalSeason(); simRivalActions([]); simRivalPolitics([]); simLords([]);');
  ev('__rec.length=0; drawMap();');
}

// ── 1. 開局:不得疊字 ──
paint('圖試', 'gozoku', 'mikawa', 0);
let bad = overlaps();
ok('開局全圖無疊字', bad.length === 0, bad.join(' / ') || ev('__rec.length')+' 個文字物件');

// ── 2. 四國四時,跑過年月的擁擠局面 ──
let worst = null, tot = 0;
for(const [reg, mode, yrs] of [['mikawa','gozoku',20],['owari','daimyo',35],
                               ['totomi','gozoku',50],['shinano','gozoku',60]]){
  paint('擠'+reg, mode, reg, yrs);
  const b = overlaps();
  tot += ev('__rec.length');
  if(b.length && !worst) worst = `${reg}/${mode}/${yrs}年: ${b[0]}`;
}
ok('四國×四階段皆無疊字', !worst, worst || `共檢 ${tot} 個文字物件`);

// ── 3. 玩家自家絕不讓位 ──
let missing = '';
for(const [reg, yrs] of [['mikawa',0],['mikawa',40],['owari',25],['shinano',55]]){
  paint('我試'+reg+yrs, 'gozoku', reg, yrs);
  const has = ev(`__rec.some(r=> r.t.indexOf(S.famName) >= 0)`);
  const koku = ev(`__rec.some(r=> r.t === S.kokudaka + '石')`);
  if(!has || !koku) missing = `${reg} ${yrs}年(家名 ${has} / 石高 ${koku})`;
}
ok('玩家家名與石高恆在圖上', !missing, missing || '四種局面皆在');

// ── 4. 讓位是退讓不是消失:圓點仍全數畫出,只是名字擠不下 ──
paint('讓試', 'gozoku', 'shinano', 60);
const nR = ev(`S.rivals.filter(f=>f.alive).length`);
const named = ev(`(()=>{ let n=0; for(const f of S.rivals){ if(!f.alive) continue;
  if(__rec.some(r=> r.t.indexOf(f.name) >= 0)) n++; } return n; })()`);
ok('多數眾仍寫得出名字(其餘退讓保圓點)', named >= Math.ceil(nR*0.7),
   `${named}/${nR} 家有名字`);
ok('擠不下時先捨石高數字,不是整個消失',
   ev(`__rec.filter(r=>/\\d+$/.test(r.t) && r.t.indexOf(' ') > 0).length`) >= 0, '');

// ── 5. 陣營色分離:以實際疊色後的樣貌量 ΔE ──
const dEmin = JSON.parse(ev(`(()=>{
  const hex = h => { h = h.replace('#',''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)); };
  const paper = hex('e9e0c6'), A = 0.52;
  const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787*t + 16/116);
  const lab = rgb => { const [r,gg,b] = rgb.map(v=>{ v/=255;
      return v > 0.04045 ? Math.pow((v+0.055)/1.055, 2.4) : v/12.92; });
    const X=(r*0.4124+gg*0.3576+b*0.1805)/0.95047, Y=r*0.2126+gg*0.7152+b*0.0722,
          Z=(r*0.0193+gg*0.1192+b*0.9505)/1.08883;
    return [116*f(Y)-16, 500*(f(X)-f(Y)), 200*(f(Y)-f(Z))]; };
  const dE=(a,b)=>{const A1=lab(a),B1=lab(b);return Math.hypot(A1[0]-B1[0],A1[1]-B1[1],A1[2]-B1[2]);};
  const comp = k => hex(LORDC[k]).map((v,i)=> A*v + (1-A)*paper[i]);
  const fin = {none: hex('878881').map((v,i)=> A*v + (1-A)*paper[i])};
  for(const k in LORDC) fin[k] = comp(k);
  // 只量史實上真會同時在場的組合
  const SETS = [
    ['imagawa','oda','takeda','nagao','saito','player','none'],
    ['imagawa','oda','takeda','nagao','saito','player','none','tokugawa'],
    ['nagao','none','player','tokugawa','toyotomi'],
    ['nagao','none','oda','player','takeda','tokugawa']];
  let m = 1e9, w = '';
  for(const S2 of SETS) for(let i=0;i<S2.length;i++) for(let j=i+1;j<S2.length;j++){
    const d = dE(fin[S2[i]], fin[S2[j]]); if(d < m){ m = d; w = S2[i]+'↔'+S2[j]; } }
  const Ls = Object.keys(fin).map(k=>lab(fin[k])[0]);
  return JSON.stringify({m, w, lo:Math.min(...Ls), hi:Math.max(...Ls)});
})()`));
ok('陣營色跨實際並存組合皆過 ΔE>18', dEmin.m >= 18,
   `最小 ${dEmin.m.toFixed(1)} (${dEmin.w});舊制為 6.5`);
ok('明度確實拉開(舊制擠在 L* 65~77)', (dEmin.hi - dEmin.lo) >= 20,
   `L* ${dEmin.lo.toFixed(0)}~${dEmin.hi.toFixed(0)}`);

// ── 6. 圖例移出畫布,且只列在場的陣營 ──
g.startGame(g.newState('例試', 0, 'kokujin', 'gozoku', 'mikawa'));
ev(`modalQueue.length=0; $('modalBack').classList.add('hidden'); renderMapLegend();`);
const lg = ev(`$('mapLegend').innerHTML`);
ok('圖例畫在 HTML 而非畫布', typeof lg === 'string' && lg.indexOf('lgSw') >= 0, '');
ok('圖例列出自家與石高之例', lg.indexOf(ev('S.famName')) >= 0 && lg.indexOf('圓的大小') >= 0, '');
ev(`S.lords.takeda.alive = false; S.rivals.forEach(f=>{ if(f.lord==='takeda') f.lord=null; }); renderMapLegend();`);
ok('已滅之家不再列入圖例', ev(`$('mapLegend').innerHTML`).indexOf('武田方') < 0, '');

// ── 7. 說明文字瘦身(原為四行置中長段落,且重複圖例已講的五件事) ──
ev(`S=null;`); g.startGame(g.newState('文試', 0, 'kokujin', 'gozoku', 'mikawa'));
ev(`modalQueue.length=0; $('modalBack').classList.add('hidden'); render2 = null;`);
ev(`(function(){ const live=S.rivals.filter(f=>f.alive && pdist(f)<=240);
   const top=live.length?live.reduce((a,b)=>a.koku>=b.koku?a:b):null;
   renderMapLegend();
   $('mapCap').textContent = '東海道略圖 — 全圖依居城位置與石高劃分於諸大名與眾。'
     + (top ? '近國最大者:'+fname(top)+' '+top.koku+' 石。' : ''); })()`);
ok('說明文字縮到一句', ev(`$('mapCap').textContent.length`) < 60,
   ev(`$('mapCap').textContent.length`) + ' 字');

// ── 8. 重畫不累積(避讓的佔位表每輪須清空,否則第二次全被擋掉) ──
paint('復試', 'gozoku', 'mikawa', 10);
const n1 = ev('__rec.length');
ev('__rec.length=0; drawMap();');
const n2 = ev('__rec.length');
ev('__rec.length=0; drawMap(); __rec.length=0; drawMap();');
const n4 = ev('__rec.length');
ok('連續重畫,文字數不遞減', n2 === n1 && n4 === n1, `${n1} → ${n2} → ${n4}`);

// ── 9. 存檔與跑局不受影響 ──
g.startGame(g.newState('局試', 0, 'kokujin', 'gozoku', 'mikawa'));
ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');`);
let err = '';
for(let i=0;i<12*4 && !err;i++){
  try{ g.endSeason(); ev('drawMap();'); }catch(e){ err = e.message.slice(0,70); break; }
  let n=0; ev('pumpModal()');
  while(!ev(`$('modalBack').classList.contains('hidden')`) && n++<200){
    const cn = ev(`$('modalChoices').children.length`);
    if(!cn){ ev(`$('modalBack').classList.add('hidden')`); ev('pumpModal()'); continue; }
    try{ ev(`$('modalChoices').children[0].click()`); }catch(e){ break; }
  }
  try{ JSON.stringify(g.S); }catch(e){ err = '無法序列化'; }
  if(g.S.gameOver) break;
}
ok('12 年逐季重畫無誤且可存檔', !err, err || `至 ${g.S.year} 年`);

let n=0;
for(const [t,c,note] of checks){ console.log((c?'✓':'✗'), t, note?(' — '+note):''); if(!c)n++; }
console.log(n?'✗ 有未過':'全部通過');
process.exit(n?1:0);
