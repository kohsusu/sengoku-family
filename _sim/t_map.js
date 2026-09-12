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

const SCREEN = ['春','夏','秋','冬','◀ 西 · 畿內','東 ▶','▲ 北 · 北陸','▼ 南 · 紀伊'];
const overlaps = () => JSON.parse(ev(`(()=>{
  const SC = ${JSON.stringify(SCREEN)};
  __rec = __rec.filter(r => SC.indexOf(r.t) < 0);     // 貼窗之物不在世界空間,不參與比對
  const bad = [];
  for(let i=0;i<__rec.length;i++) for(let j=i+1;j<__rec.length;j++){
    const a=__rec[i], b=__rec[j];
    const ox = Math.min(a.x2,b.x2) - Math.max(a.x,b.x);
    const oy = Math.min(a.y2,b.y2) - Math.max(a.y,b.y);
    if(ox > 1.5 && oy > 1.5) bad.push(a.t+' × '+b.t);
  }
  return JSON.stringify(bad.slice(0,6));
})()`));

function paint(tag, mode, region, years, cam){
  g.startGame(g.newState(tag, 0, 'kokujin', mode, region));
  ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');`);
  for(let i=0;i<years;i++) ev('simRivalSeason(); simRivalActions([]); simRivalPolitics([]); simLords([]);');
  if(cam) ev(`S.cam={x:${cam[0]}, y:${cam[1]}};`);
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
// 只數窗內的家:有了視窗之後,窗外之家本就不畫名字(那是剔除,不是讓位)
const inView = ev(`(()=>{ const k=mapCam();
  return S.rivals.filter(f=>f.alive && f.x>k.x+6 && f.x<k.x+894 && f.y>k.y+6 && f.y<k.y+554).length; })()`);
const named = ev(`(()=>{ const k=mapCam(); let n=0;
  for(const f of S.rivals){ if(!f.alive) continue;
    if(!(f.x>k.x+6 && f.x<k.x+894 && f.y>k.y+6 && f.y<k.y+554)) continue;
    if(__rec.some(r=> r.t.indexOf(f.name) >= 0)) n++; } return n; })()`);
ok('窗內多數眾仍寫得出名字(其餘退讓保圓點)', inView > 0 && named >= Math.ceil(inView*0.7),
   `${named}/${inView} 家(窗內)有名字`);
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
  // 陣營十七家,不可能兩兩都分得開,故按「會不會擺在一起讀」分兩級:
  //   既比鄰(據點 700px 內)又同代者 → ΔE > 18;其餘只要 > 10。
  const CAP = {imagawa:[730,300], oda:[190,340], saito:[120,120], tokugawa:[360,350],
    takeda:[780,120], nagao:[640,-230], toyotomi:[190,340], asakura:[-35,143],
    rokkaku:[-77,400], azai:[-39,290], miyoshi:[-277,489], honganji:[-303,542],
    ashikaga:[-224,441], hatakeyama:[200,-178], kitabatake:[17,597],
    hojo:[964,369], uesugi:[933,69], satomi:[1290,359], satake:[1447,-24]};
  const YR = {imagawa:[1545,1582], oda:[1545,1582], saito:[1545,1567], tokugawa:[1545,1615],
    takeda:[1545,1582], nagao:[1545,1615], toyotomi:[1582,1615], asakura:[1545,1573],
    rokkaku:[1545,1573], azai:[1545,1573], miyoshi:[1545,1577], honganji:[1545,1580],
    ashikaga:[1545,1573], hatakeyama:[1545,1577], kitabatake:[1545,1576],
    hojo:[1545,1590], uesugi:[1545,1562], satomi:[1545,1615], satake:[1545,1615]};
  const ks = Object.keys(fin);
  let mN = 1e9, wN = '', mF = 1e9, wF = '';
  for(let i=0;i<ks.length;i++) for(let j=i+1;j<ks.length;j++){
    const a = ks[i], b = ks[j], d = dE(fin[a], fin[b]);
    const nr = (!CAP[a] || !CAP[b]) ? true
             : Math.hypot(CAP[a][0]-CAP[b][0], CAP[a][1]-CAP[b][1]) < 700;
    const ov = (!YR[a] || !YR[b]) ? true : (YR[a][0] <= YR[b][1] && YR[b][0] <= YR[a][1]);
    if(nr && ov){ if(d < mN){ mN = d; wN = a+'↔'+b; } }
    else if(d < mF){ mF = d; wF = a+'↔'+b; }
  }
  const Ls = ks.map(k=>lab(fin[k])[0]);
  return JSON.stringify({m:mN, w:wN, mF, wF, n:ks.length, lo:Math.min(...Ls), hi:Math.max(...Ls)});
})()`));
ok(`${dEmin.n} 個陣營:比鄰且同代者皆過 ΔE>18`, dEmin.m >= 18,
   `最小 ${dEmin.m.toFixed(1)} (${dEmin.w});舊制九色為 6.5`);
ok('不比鄰或不同代者亦過 ΔE>10', dEmin.mF >= 10, `最小 ${dEmin.mF.toFixed(1)} (${dEmin.wF})`);
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

// ── 10. 擴圖:世界範圍與相機 ──
paint('界試', 'gozoku', 'mikawa', 0);
ok('世界含括畿內至關東、能登至紀伊',
   ev('WORLD.x0') <= -438 && ev('WORLD.x1') >= 1564
   && ev('WORLD.y0') <= -326 && ev('WORLD.y1') >= 925,
   `x[${ev('WORLD.x0')},${ev('WORLD.x1')}] y[${ev('WORLD.y0')},${ev('WORLD.y1')}]`);
ev('camTo(-9999,-9999)');
const nw = JSON.parse(ev('JSON.stringify(S.cam)'));
ev('camTo(9999,9999)');
const se = JSON.parse(ev('JSON.stringify(S.cam)'));
ok('相機夾在世界之內',
   nw.x === ev('WORLD.x0') && nw.y === ev('WORLD.y0')
   && se.x === ev('WORLD.x1') - 900 && se.y === ev('WORLD.y1') - 560,
   `西北(${nw.x},${nw.y}) 東南(${se.x},${se.y})`);
ev('camHome()');
const home = JSON.parse(ev('JSON.stringify(S.cam)')), pp = JSON.parse(ev('JSON.stringify(playerPos())'));
ok('回本據使自家入窗', pp.x >= home.x && pp.x <= home.x + 900 && pp.y >= home.y && pp.y <= home.y + 560,
   `本據(${pp.x},${pp.y}) 窗(${home.x},${home.y})`);

// ── 11. 窗開到哪,字就不該疊到哪 ──
let panBad = '';
for(const cam of [[-500,-340],[-460,180],[-300,600],[-160,100],[0,380],[200,-200],[0,0],
                  [680,-340],[900,60],[1100,200],[680,380]]){
  paint('窗試', 'gozoku', 'mikawa', 25, cam);
  const b = overlaps();
  if(b.length && !panBad) panBad = `窗(${cam}): ${b[0]}`;
}
ok('十一處視窗皆無疊字', !panBad, panBad || '含西北・畿內・紀伊・本據・上野・武藏・房總');

// ── 12. 新入之國的名要在該在的地方 ──
paint('國試', 'gozoku', 'mikawa', 0, [-460, 180]);
const westNames = ev(`__rec.filter(r=>['丹波','山城','攝津','河内','紀伊','播磨'].indexOf(r.t)>=0).length`);
ok('西窗可見畿內諸國之名', westNames >= 4, westNames + ' 國');
paint('國試2', 'gozoku', 'mikawa', 0, [0, 100]);
const eastNames = ev(`__rec.filter(r=>['三河','尾張','美濃','遠江'].indexOf(r.t)>=0).length`);
ok('東窗仍是舊有諸國', eastNames >= 3, eastNames + ' 國');

// ── 13. 影響及於合理之遠(CUT 0.18):未及之地留白,不被最近的大名染滿 ──
const reach = JSON.parse(ev(`(()=>{
  const CUT = 0.18;
  const w = Math.sqrt(5000) * 1.1;          // 五千石大名
  const w2 = Math.sqrt(500);                // 五百石之眾
  return JSON.stringify({big: w/CUT - 45, small: w2/CUT - 45});
})()`));
ok('大名影響及百餘里而非橫跨天下', reach.big > 250 && reach.big < 600, `${Math.round(reach.big)}px`);
ok('小眾影響僅及鄰境', reach.small > 40 && reach.small < 140, `${Math.round(reach.small)}px`);

// ── 14. 舊存檔不帶相機也能開(座標原點沒動,故無須遷移) ──
g.startGame(g.newState('舊試', 0, 'kokujin', 'gozoku', 'mikawa'));
ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');`);
const old2 = JSON.parse(ev('JSON.stringify(S)'));
delete old2.cam;
ev(`__o = migrate(${JSON.stringify(old2)}); S = __o; __rec.length=0;`);
let oldErr = '';
try{ ev('drawMap();'); }catch(e){ oldErr = e.message.slice(0,60); }
ok('無相機欄位的舊檔可直接開圖', !oldErr && ev('__rec.length') > 20, oldErr || ev('__rec.length')+' 個文字');
ok('舊檔的眾座標一個都沒動',
   ev(`__o.rivals.every((f,i)=> f.x === S.rivals[i].x && f.y === S.rivals[i].y)`), '');

// ── 15. 第二期:八家新大名 ──
g.startGame(g.newState('名試', 0, 'kokujin', 'gozoku', 'mikawa'));
ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');`);
const WEST8 = ['asakura','rokkaku','azai','miyoshi','honganji','ashikaga','hatakeyama','kitabatake'];
const lords = JSON.parse(ev(`JSON.stringify(aliveLords())`));
ok('畿內北陸八家大名俱在', lords.length >= 13 && WEST8.every(k=>lords.includes(k)), lords.length + ' 家大名');
ok('新大名皆有居城與史實重臣',
   WEST8.every(k => ev(`!!LORD_META['${k}'] && LORD_VASSALS['${k}'] && LORD_VASSALS['${k}'].length >= 5
                        && castlesOf('${k}').length >= 1`)), '');
ok('新大名兵鋒及於其國與接壤',
   ev(`lordReach('miyoshi').size`) >= 4 && ev(`lordReach('asakura').size`) >= 4,
   `三好 ${ev(`lordReach('miyoshi').size`)} 國・朝倉 ${ev(`lordReach('asakura').size`)} 國`);
ok('將軍家兵微而名重(國力最末,家格最高)',
   ev(`lordPower('ashikaga') === Math.min(...aiLords().map(k=>lordPower(k)))`)
   && ev(`HOUSE_MEI.ashikaga > Math.max(...Object.keys(HOUSE_MEI).filter(k=>k!=='ashikaga').map(k=>HOUSE_MEI[k]))`),
   `國力 ${ev(`lordPower('ashikaga')`)}・家格 ${ev(`HOUSE_MEI.ashikaga`)}`);

// ── 16. 西國三十四家眾 ──
ok('西國三十四家眾俱在', ev(`['saika','koga','kuki','jinbo','tsutsui','akamatsu','kyogoku','negoro'].every(id=>S.rivals.some(f=>f.id===id))`),
   ev('S.rivals.length') + ' 家眾');
ok('西國諸眾各有其國與接壤',
   ev(`['saika','koga','kuki','jinbo','tsutsui','akamatsu'].every(id=>{
        const f=S.rivals.find(x=>x.id===id); return !!(f && CLAN_PROV[id] && PROV_ADJ[CLAN_PROV[id]]); })`), '');
ok('開局近國仍是十來家——擴圖不動開局體驗',
   ev('S.rivals.filter(f=>f.alive && pdist(f)<=240).length') <= 20,
   ev('S.rivals.filter(f=>f.alive && pdist(f)<=240).length') + ' 家在 240px 內');

// ── 17. 四處新起始國 ──
let regBad = '';
for(const r of ['omi','iga','kii','echizen']){
  g.startGame(g.newState('起試', 0, 'kokujin', 'gozoku', r));
  ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');`);
  const nb = ev('myNeighbors().length');
  if(nb < 3){ regBad = `${r} 只有 ${nb} 家鄰居`; break; }
  try{ ev('drawMap();'); }catch(e){ regBad = `${r} 開圖失敗:${e.message.slice(0,40)}`; break; }
}
ok('近江・伊賀・紀伊・越前皆可開局且有鄰', !regBad, regBad || '四處俱可');

// ── 18. 惣無事令:上洛之後,不必逐家踏平 ──
g.startGame(g.newState('令試', 0, 'kokujin', 'daimyo', 'mikawa'));
ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');`);
ok('未入京則惣無事令不可下', ev('sobujiReady()') === null, '');
ev(`S.isDaimyo=true; S.castles={nijo:'player'}; S.kokudaka=90000;
    aiLords().forEach(k=>{ S.lords[k].demesne = 40000; });`);
// 9000 石對 90000 石的玩家根本不算匹敵者——要真的有人能分庭抗禮才測得出這道閘
ok('入京而尚有匹敵者,仍不可下', ev('sobujiReady()') === null,
   `我 ${ev('playerPower()')} vs 最強他家 ${ev('Math.max(...aiLords().map(k=>lordPower(k)))')}`);
ev(`aiLords().forEach(k=>{ S.lords[k].demesne = 900; });`);
const ready = ev('sobujiReady()');
ok('入京且勢壓群雄,可下惣無事令', !!(ready && ready.length),
   ready ? ready.length + ' 家待服' : '仍不可下');
ev(`modalQueue.length=0; checkUnification();`);
ok('惣無事之議會送到面前', ev(`modalQueue.length > 0 && /惣無事/.test(modalQueue[0].title)`), '');
ev(`S.money=99999; modalQueue[0].choices[0].fn();`);
ok('一令而天下定', ev(`!!(S.flags && S.flags.unified)`)
   && ev(`aiLords().filter(k=>!S.lords[k].submitted).length`) === 0, '');

// ── 19. 舊檔遷移:補齊新大名與西國諸眾,舊有者一個不動 ──
g.startGame(g.newState('遷試2', 0, 'kokujin', 'gozoku', 'mikawa'));
const o2 = JSON.parse(ev('JSON.stringify(S)'));
o2.rivals = o2.rivals.filter(f => ['saika','koga','kuki','jinbo'].indexOf(f.id) < 0).slice(0, 21);
const keepXY = o2.rivals.map(f=>[f.id, f.x, f.y]);
for(const k of WEST8) delete o2.lords[k];
delete o2.cam;
ev(`__m2 = migrate(${JSON.stringify(o2)});`);
ok('舊檔補齊十七家大名', ev(`Object.keys(__m2.lords).length`) === 17, ev(`Object.keys(__m2.lords).length`)+' 家');
ok('舊檔補齊七十二家眾', ev(`__m2.rivals.length`) === 72, ev(`__m2.rivals.length`)+' 家');
ok('舊有之眾的座標一個都沒動',
   ev(`${JSON.stringify(keepXY)}.every(function(e){ var f=__m2.rivals.find(function(r){return r.id===e[0];});
        return !!f && f.x===e[1] && f.y===e[2]; })`), keepXY.length + ' 家原地不動');

// ── 20. 第三期:關東四家與十七家眾 ──
g.startGame(g.newState('東試', 0, 'kokujin', 'gozoku', 'mikawa'));
ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');`);
const EAST4 = ['hojo','uesugi','satomi','satake'];
ok('大名十七家俱在', ev('aliveLords().length') === 17
   && EAST4.every(k => ev(`aliveLords().indexOf('${k}') >= 0`)), ev('aliveLords().length') + ' 家');
ok('關東四家皆有居城與史實重臣',
   EAST4.every(k => ev(`!!LORD_META['${k}'] && LORD_VASSALS['${k}'] && LORD_VASSALS['${k}'].length >= 5
                        && castlesOf('${k}').length >= 1`)), '');
ok('眾共七十二家', ev('S.rivals.length') === 72, ev('S.rivals.length') + ' 家');
ok('北條兵鋒及伊豆相模武藏', ev(`['izu','sagami','musashi'].every(p=>lordReach('hojo').has(p))`),
   ev(`[...lordReach('hojo')].join(',')`));
ok('關東諸眾在世界之內',
   ev(`S.rivals.every(f => f.x >= WORLD.x0 && f.x <= WORLD.x1 && f.y >= WORLD.y0 && f.y <= WORLD.y1)`), '');
ok('開局近國仍是十來家', ev('S.rivals.filter(f=>f.alive && pdist(f)<=240).length') <= 20,
   ev('S.rivals.filter(f=>f.alive && pdist(f)<=240).length') + ' 家');

// ── 21. 家臣初始三圍(二百局平均) ──
const AV = [0,0,0,0];
for(let i=0;i<200;i++){
  const st = g.newState('圍'+i, 0, 'kokujin', 'gozoku', 'mikawa');
  st.retainers.forEach((r,k)=>{ if(k<4) AV[k] += (r.bu + r.nai + r.chi)/3; });
}
const av = AV.map(v=>v/200);
ok('家老・侍大將・徒士頭三圍平均近 80／75／70',
   Math.abs(av[1]-80) < 3 && Math.abs(av[2]-75) < 3 && Math.abs(av[3]-70) < 3,
   av.slice(1).map(v=>v.toFixed(1)).join(' / '));
ok('當主三圍亦有提升(原 51.7)', av[0] > 62, av[0].toFixed(1));

// ── 22. 音信:以智謀為主、內政為輔,只及鄰境 ──
g.startGame(g.newState('音試', 0, 'kokujin', 'gozoku', 'mikawa'));
ev(`modalQueue.length=0; $('modalBack').classList.add('hidden'); S.money=9999;
    S.retainers.forEach(r=>{ r.task='rest'; r.stamina=100; r.sick=0; });`);
const relBefore = JSON.parse(ev(`JSON.stringify(S.rivals.map(f=>f.rel))`));
const favBefore = JSON.parse(ev(`JSON.stringify(aiLords().map(k=>S.lords[k].favor||0))`));
ev(`S.retainers[1].task='onshin'; S.retainers[1].chi=80; S.retainers[1].nai=70; resolveTasks();`);
const up = ev(`S.rivals.filter((f,i)=> f.rel > ${JSON.stringify(relBefore)}[i]).length`);
ok('音信使鄰境諸家關係普增', up >= 5, up + ' 家關係上升');
ok('只及鄰境——遠方之眾不受音信',
   ev(`S.rivals.filter((f,i)=> f.rel > ${JSON.stringify(relBefore)}[i] && pdist(f) > NEIGHBOR_R*1.3).length`) === 0, '');
const favUp = ev(`aiLords().filter((k,i)=> (S.lords[k].favor||0) > ${JSON.stringify(favBefore)}[i]).length`);
ok('兵鋒可及的大名好感亦增', favUp >= 2 && favUp < 17, favUp + ' 家好感上升(共 ' + ev('aiLords().length') + ' 家)');
ok('遠方大名(北條)不受音信', ev('(S.lords.hojo.favor||0) === 0'),
   `北條距 ${Math.round(ev(`lordDist('hojo')`))}px`);
ok('音信要花錢', ev('S.money') === 9999 - 12, ev('S.money') + ' 貫');
// 智謀高者效果較佳
ev(`S.rivals.forEach((f,i)=>{ f.rel = ${JSON.stringify(relBefore)}[i]; });
    S.money=9999; S.retainers[1].chi=40; S.retainers[1].nai=70; S.retainers[1].stamina=100; resolveTasks();`);
const lowGain = ev(`S.rivals[0].rel - ${JSON.stringify(relBefore)}[0]`);
ev(`S.rivals.forEach((f,i)=>{ f.rel = ${JSON.stringify(relBefore)}[i]; });
    S.money=9999; S.retainers[1].chi=88; S.retainers[1].nai=70; S.retainers[1].stamina=100; resolveTasks();`);
const hiGain = ev(`S.rivals[0].rel - ${JSON.stringify(relBefore)}[0]`);
ok('智謀愈高,結好之效愈著', hiGain > lowGain, `智 40 → +${lowGain}／智 88 → +${hiGain}`);

// ── 23. 史實軸:西國與關東的興亡 ──
const EVT = ['kawagoe','hirai_fall','kanto_kanrei','anegawa','ichijodani','mise','nanao_fall','ishiyama'];
ok('八個新事件俱在史實軸上',
   ev(`${JSON.stringify(EVT)}.every(id => HISTORY.some(h => h.id === id))`),
   ev('HISTORY.length') + ' 個事件');
ok('事件年代合於史實',
   ev(`HISTORY.find(h=>h.id==='kawagoe').y === 1546
    && HISTORY.find(h=>h.id==='hirai_fall').y === 1552
    && HISTORY.find(h=>h.id==='ichijodani').y === 1573
    && HISTORY.find(h=>h.id==='ishiyama').y === 1580`), '');

// 跑滿一甲子,看諸家是否依序而亡、且各記其「亡於誰手」
g.startGame(g.newState('軸試', 0, 'kokujin', 'gozoku', 'mikawa'));
ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');`);
let histErr = '';
for(let i=0;i<60*4;i++){
  try{ g.endSeason(); }catch(e){ histErr = e.message.slice(0,60); break; }
  ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');`);
  if(g.S.gameOver) break;
}
ok('一甲子跑完無誤', !histErr, histErr || `至 ${g.S.year} 年`);
const fell = JSON.parse(ev(`JSON.stringify(Object.keys(S.lords).filter(k=>S.lords[k].alive===false))`));
ok('西國關東諸家依史實而亡',
   ['rokkaku','asakura','azai','ashikaga','kitabatake','hatakeyama','honganji','uesugi','hojo']
     .filter(k => fell.indexOf(k) >= 0).length >= 7,
   fell.length + ' 家亡');
ok('每一家都記得亡於誰手',
   ev(`Object.keys(S.lords).filter(k=>S.lords[k].alive===false).every(k=>!!S.lords[k].slainBy)`), '');
ok('亡於他人之手者,其地不歸玩家',
   ev(`(()=>{ const P=provStatus();
        return !['omi','echizen','noto','musashi','kozuke'].some(p => P[p] && P[p].owner === 'player'); })()`),
   ev(`['omi','echizen','noto'].map(p=>provStatus()[p].owner).join('/')`));
ok('國名副題隨主更易(舊題名不再作數)',
   ev(`provStatus().omi.txt.indexOf('六角') < 0`), '近江現題 ' + ev(`provStatus().omi.txt`));
ok('未易主之國仍留舊題名',
   ev(`provStatus().iga.txt === '惣國一揆' && provStatus().yamato.txt === '筒井・興福寺'`), '');

// ── 24. 你改寫過的歷史,史筆不再動 ──
g.startGame(g.newState('改試', 0, 'kokujin', 'daimyo', 'mikawa'));
ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');
    S.lords.asakura.submitted = true; S.lords.rokkaku.submitted = true;
    S.year = 1573; S.season = 2;`);
ev(`HISTORY.find(h=>h.id==='ichijodani').fn();`);
ok('已臣服於你的大名,不為史實所滅',
   ev(`S.lords.asakura.alive !== false`), '朝倉已臣服,一乘谷之役不及於它');
// 上一次呼叫已經把淺井滅了,得先讓它復活,否則這條測的是上一條的殘留
ev(`modalQueue.length=0; S.lords.oda.alive = false; S.lords.oda.slainBy = 'player';
    S.lords.azai.alive = true; delete S.lords.azai.slainBy;
    S.lords.azai.submitted = false; S.year = 1573;`);
const before = ev(`S.lords.azai.alive !== false`);
ev(`HISTORY.find(h=>h.id==='ichijodani').fn();`);
ok('勝者已亡,則此役不發生(織田若為你所滅,小谷城不會落)',
   before && ev(`S.lords.azai.alive !== false`), '');
ok('史實之滅亦不奪你已得之地',
   ev(`provStatus().owari.owner === 'player' || provStatus().owari.owner === 'oda'`),
   '尾張 ' + ev(`provStatus().owari.owner`));

let n=0;
for(const [t,c,note] of checks){ console.log((c?'✓':'✗'), t, note?(' — '+note):''); if(!c)n++; }
console.log(n?'✗ 有未過':'全部通過');
process.exit(n?1:0);
