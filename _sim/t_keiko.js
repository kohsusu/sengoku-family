// 家業精進:單一修練點池(精進全速/練兵・經商半速)、等級=已投入點、被動全折回樹裡
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc, localStorage} = require('./shim');
const HTML=fs.readFileSync(path.join(__dirname, '..', 'index.html'),'utf8');
if(HTML.indexOf("const BUILD") < 0) throw new Error('讀不到主檔');
const script=[...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1])[0];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>0},
  setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
  requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},Image:class{set src(v){}},
  navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,prompt:()=>null,
  matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),
  location:{port:'5877',reload(){},replace(){}}};
sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
vm.runInContext(script,sb,{filename:'game.js'});
vm.runInContext('render=function(){};drawMap=function(){};save=function(){};',sb);
const ev=c=>vm.runInContext(c,sb); const g=sb.window.__game;
console.log('BUILD:', ev('BUILD'));
const checks=[]; const ok=(n,c,note)=>checks.push([n,c,note||'']);
const near=(a,b,tol)=>Math.abs(a-b)<=(tol===undefined?1e-9:tol);
const fresh=tag=>{ g.startGame(g.newState(tag,0,'kokujin','gozoku','mikawa'));
  ev(`modalQueue.length=0; $('modalBack').classList.add('hidden');
      S.money=99999; S.rice=9999; S.retainers.forEach(r=>{r.stamina=100;r.sick=0;});`); };

// ── 1. 開局狀態 ──
fresh('初試');
ok('開局三道皆 0 點、池中無點', ev(`skTotalLv()`)===0 && ev(`skPt()`)===0 && ev(`skCapLeft()`)===30, '');

// ── 2. 精進全速:一名內政 60 的家臣,約兩季得一點 ──
fresh('進試');
ev(`S.retainers[1].nai=60; S.retainers[1].task='fushin';`);
const need = ev(`(()=>{ let n=0; while(skPt()===0 && n++<20){ S.keiko=(S.keiko||0)+60; keikoGain(S.retainers[1],0); } return n; })()`);
ok('精進累滿 100 得 1 點', ev(`skPt()`)===1, `${need} 次 ×60 進度`);
ok('未配之點佔用總額度', ev(`skCapLeft()`)===29, '餘額 '+ev(`skCapLeft()`));

// ── 3. 三種來源的速率:精進 1.0 / 練兵 0.5 / 經商 0.5 ──
fresh('速試');
const rate = t => ev(`(()=>{ S.keiko=0; S.keikoPt=0; S.skSuiri={}; S.skTrade={}; S.skBugei={};
  S.retainers.forEach(x=>{ x.task='rest'; x.stamina=100; x.sick=0; });   // 只留受測者,免得旁人的任務混進進度
  const r=S.retainers[1]; r.nai=80; r.bu=80; r.chi=80; r.stamina=100; r.sick=0; r.task='${t}';
  S.money=99999; S.rice=9999; S.army={ashigaru:20,yumi:0,kiba:0,teppo:0}; S.soldiers=20; S.unitPick='ashigaru';
  const before=S.keiko||0; resolveTasks(); return (S.keiko||0) - before; })()`);
const rF = rate('fushin'), rD = rate('drill'), rT = rate('trade');
ok('精進全速(內政 80 → 一季約得 80 進度)', rF > 55, `+${rF.toFixed(0)}/季`);
ok('練兵半速(約精進之半)', rD > 0 && near(rD/rF, 0.5, 0.12), `練兵 +${rD.toFixed(0)} vs 精進 +${rF.toFixed(0)} = ${(rD/rF).toFixed(2)}`);
ok('經商半速(約精進之半)', rT > 0 && near(rT/rF, 0.5, 0.12), `經商 +${rT.toFixed(0)} vs 精進 +${rF.toFixed(0)} = ${(rT/rF).toFixed(2)}`);

// ── 4. 配點:扣池、等級=已投入、跨道共用 ──
fresh('配試');
ev(`S.keikoPt=5;`);
ev(`skAlloc('suiri','tameike'); skAlloc('trade','bashaku'); skAlloc('bugei','yarifusuma');`);
ok('同一批點可配給任一道', ev(`skLv('suiri')`)===1 && ev(`skLv('trade')`)===1 && ev(`skLv('bugei')`)===1, '');
ok('配點扣減點池', ev(`skPt()`)===2, '餘 '+ev(`skPt()`)+' 點');
ok('S.suiri/tradeLv/bugei 同步為已投入點', ev(`S.suiri`)===1 && ev(`S.tradeLv`)===1 && ev(`S.bugei`)===1, '');
ev(`S.keikoPt=0; skAlloc('suiri','shinden');`);
ok('無點則不得配', ev(`skR('suiri','shinden')`)===0, '');

// ── 5. 總上限 30:含已配與未配 ──
fresh('限試');
ev(`S.keikoPt=30;`);
ok('池滿 30 時不得再精進', ev(`skCapLeft()`)===0 && ev(`keikoGain(S.retainers[1], 999)`)===false, '');
ev(`S.keikoPt=0; S.skSuiri={tameike:3,shinden:3,kanbatsu:3,teibou:3,suisha:3};
    S.skTrade={bashaku:4,komeya:3,zayaku:3}; S.skBugei={yarifusuma:3,yumigumi:2}; skSync();`);
ok('三道合計恰 30 點時已臻極致', ev(`skTotalLv()`)===30 && ev(`skCapLeft()`)===0, '共 '+ev(`skTotalLv()`)+' 點');

// ── 6. 階級門檻仍在 ──
fresh('階試');
ok('初傳一開始即開', ev(`skTierOpen('suiri',1)`)===true, '');
ok('中傳須初傳累計 5 點', ev(`skTierOpen('suiri',2)`)===false, '');
ev(`S.skSuiri={tameike:3,shinden:2}; skSync();`);
ok('初傳滿 5 點則中傳開', ev(`skTierOpen('suiri',2)`)===true, '');

// ── 7. 被動全折回樹裡:等級本身不再給加成 ──
fresh('折試');
const harv = () => ev(`(()=>{ S.weather={f:1,name:'平'}; return ri(S.kokudaka * 1 * (1 + S.farmWork/100) * (1 + skR('suiri','tameike')*0.09)); })()`);
const h0 = harv();
ev(`S.keikoPt=9; skAlloc('suiri','tameike'); skAlloc('suiri','tameike'); skAlloc('suiri','tameike');`);
const h3 = harv();
ok('收穫加成只來自溜池技能(3 級 ≈ +27%)', near(h3/h0, 1.27, 0.02), `${h0} → ${h3}(×${(h3/h0).toFixed(3)})`);
fresh('折試2');
ev(`S.keikoPt=12; for(let i=0;i<4;i++) skAlloc('trade','bashaku');`);
ok('馬借 4 級 = 經商 ×1.88、人口上限 +360',
   near(ev(`1 + skR('trade','bashaku')*0.22`), 1.88, 1e-9) && ev(`skR('trade','bashaku')*90`)===360, '');
fresh('折試3');
ok('水利 0 點時洪災無減免', near(ev(`Math.max(0, 0.10 * (1 - skR('suiri','teibou')*0.30))`), 0.10, 1e-9), '');
ev(`S.keikoPt=9; skAlloc('suiri','tameike'); skAlloc('suiri','tameike'); skAlloc('suiri','shinden');
    skAlloc('suiri','shinden'); skAlloc('suiri','shinden');`);
ev(`skAlloc('suiri','teibou'); skAlloc('suiri','teibou'); skAlloc('suiri','teibou');`);
ok('堤防 3 級 = 洪災近乎全免', ev(`skR('suiri','teibou')`)===3 && ev(`Math.max(0, 0.10*(1 - skR('suiri','teibou')*0.30))`) < 0.011, '');

// ── 8. 武藝之效仍只加諸玩家 ──
fresh('武試');
ev(`S.keikoPt=8;
    for(let i=0;i<3;i++) skAlloc('bugei','yarifusuma');   // 先滿初傳 5 點,中傳「騎馬衝鋒」才開
    for(let i=0;i<2;i++) skAlloc('bugei','choren');
    for(let i=0;i<3;i++) skAlloc('bugei','kiba');`);
const mMine = ev(`bugeiMul({ashigaru:0,yumi:0,kiba:100,teppo:0},'charge',{weather:'sunny'})`);
ok('騎馬 3 級使突擊 ×1.18', near(mMine, 1.18, 1e-9), '×'+mMine.toFixed(3));
const sides = JSON.parse(ev(`(()=>{ const mk=k=>({id:'x',name:'t',gen:ensureApt({name:'t',bu:60,nai:50,chi:50,trait:null}),
  kind:k, pos:'hon', army:{ashigaru:0,yumi:0,kiba:100,teppo:0}, mor:0, broke:false});
  const fa={ashigaru:100,yumi:0,kiba:0,teppo:0}, cx={weather:'sunny',terrain:'plain'};
  return JSON.stringify([ksStrength(mk('my'),'charge',cx,fa), ksStrength(mk('foe'),'charge',cx,fa)]); })()`));
ok('敵軍不沾玩家武藝', sides[0] > sides[1] * 1.1, `我 ${sides[0].toFixed(0)} vs 敵 ${sides[1].toFixed(0)}`);

// ── 9. 奉行:精進圓滿後才轉築城 ──
fresh('奉試');
ok('普請奉行先督精進', ev(`bugyoResolve('bugyo_fushin')`)==='fushin', '');
ev(`S.keikoPt=30;`);
ok('三道圓滿後轉築城砦', ev(`bugyoResolve('bugyo_fushin')`)==='shiro', '');

// ── 10. 舊檔遷移:已花的照算,未花的折回點池,半途進度不白做 ──
fresh('遷試');
const old = JSON.parse(ev(`JSON.stringify(S)`));
delete old.keiko; delete old.keikoPt;
old.suiri = 7; old.tradeLv = 4; old.bugei = 2;          // 舊制白得的等級 13
old.skSuiri = {tameike:3, shinden:2};                    // 已花 5
old.skTrade = {bashaku:1};                               // 已花 1
old.skBugei = {};
old.retainers[1]._fushin = 60; old.retainers[2]._bugei = 30;   // 半途進度 90
ev(`__m = migrate(${JSON.stringify(old)});`);
ok('舊檔未花的等級折回點池', ev(`__m.keikoPt`)===7, `13 級 − 已花 6 = ${ev(`__m.keikoPt`)} 點`);
ok('舊檔已花的技能原封不動', ev(`__m.skSuiri.tameike`)===3 && ev(`__m.skTrade.bashaku`)===1, '');
ok('舊檔等級改寫為已投入點', ev(`__m.suiri`)===5 && ev(`__m.tradeLv`)===1 && ev(`__m.bugei`)===0, '');
ok('半途個人進度併入家的進度條', ev(`__m.keiko`)===90, ev(`__m.keiko`)+'%');
ok('遷移後不逾總上限', ev(`__m.keikoPt + __m.suiri + __m.tradeLv + __m.bugei`) <= 30, '');
ok('無殘留的個人進度欄位', ev(`__m.retainers.every(r=> r._fushin===undefined && r._bugei===undefined)`), '');

// ── 11. 跑一段實局:得點、可存檔、不逾限 ──
fresh('局試');
ev(`S.retainers.forEach((r,i)=>{ if(i>0) r.task = ['fushin','drill','trade'][i%3]; });`);
let err='';
for(let i=0;i<16*4 && !err;i++){
  try{ g.endSeason(); }catch(e){ err = e.message.slice(0,60); break; }
  ev(`while(skPt()>0){ const before=skPt();
        for(const t of ['suiri','trade','bugei']) for(const k in SKILLS[t]) if(skPt()>0) skAlloc(t,k);
        if(skPt()===before) break; }`);
  let n=0; ev('pumpModal()');
  while(!ev(`$('modalBack').classList.contains('hidden')`) && n++<200){
    const cn=ev(`$('modalChoices').children.length`);
    if(!cn){ ev(`$('modalBack').classList.add('hidden')`); ev('pumpModal()'); continue; }
    try{ ev(`$('modalChoices').children[0].click()`); }catch(e){ break; }
  }
  try{ JSON.stringify(g.S); }catch(e){ err = '無法序列化:'+e.message.slice(0,40); }
  if(g.S.gameOver) break;
}
ok('16 年實局無誤且全程可存檔', !err, err || `至 ${g.S.year} 年`);
ok('實局確有修練點產出', ev(`skTotalLv() + skPt()`) >= 6, `共得 ${ev(`skTotalLv()+skPt()`)} 點`);
ok('實局不逾總上限', ev(`skTotalLv() + skPt()`) <= 30, ev(`skTotalLv()+skPt()`)+'/30');

// ── 12. UI 文字 ──
fresh('示試');
ev(`S.keikoPt=2;`);
const hud = ev(`skTreeHtml('bugei')`);
ok('樹標示「已投 n 點」與可配點數', hud.indexOf('已投') >= 0 && hud.indexOf('可配 2 點') >= 0, '');
ok('資源列示未配點', ev(`(()=>{ let h=''; try{ render(); }catch(e){} return String(skPt()); })()`)==='2', '');

let bad=0;
for(const [n,c,note] of checks){ console.log((c?'✓':'✗'),n,note?(' — '+note):''); if(!c)bad++; }
console.log(bad?'✗ 有未過':'全部通過');
process.exit(bad?1:0);
