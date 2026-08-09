// P1+P2 驗證:家業打法/敵方與力心境離脫/內應調略
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

// 建局:玩家收四家業與力,攻今川(其下有戶田/鵜殿兩從屬)
function setup(terrain){
  ev('KS=null;BT=null;');
  $('modalBack').classList.add('hidden');
  ev(`S = newState('試', 0, 'kokujin', 'gozoku', 'mikawa');`);
  ev(`S.kokudaka=3000; S.pop=3000; S.rice=9999; S.money=500; S.prestige=80;
      S.army={ashigaru:260,yumi:80,kiba:70,teppo:40}; S.soldiers=450;
      S.retainers.forEach(r=>{r.stamina=100;r.sick=0;});
      ['honshoji','saji','suganuma','okudaira'].forEach(id=>{const f=S.rivals.find(x=>x.id===id); f.lord='player'; f.rel=70; f.sol=90;});
      S.rivals.find(x=>x.id==='toda').lord='imagawa';
      S.rivals.find(x=>x.id==='udono').lord='imagawa';`);
  sb.kokusen('imagawa', true);
  // 進到盤上指揮(軍議→布陣→盤上入口)
  let g = 0;
  while(!ev('KS && KS.hex') && g++ < 14){
    if(terrain) ev(`KS && (KS.ctx.terrain='${terrain}')`);
    const btns = [...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
    if(!btns.length) break;
    const by = re => btns.find(b=>re.test(b.textContent));
    (by(/盤上指揮/) || by(/^開戰|^出陣|^決戰/) || btns[0]).click();
  }
  return ev('KS && KS.hex ? 1 : 0');
}

// ── A. 敵方與力備存在且自總兵力析出 ──
{
  const okSetup = setup(null);
  ok('A0 可進入盤上指揮', !!okSetup, '');
  const list = ev(`KS.hex.units.filter(u=>u.s.kind==='foevassal').map(u=>u.s.name+'('+ksTotal(u.s)+')').join('、')`);
  ok('A1 敵陣含從屬眾備(最強兩家)', /戶田/.test(list)&&/井伊/.test(list), list);
  const foeTotal = ev(`KS.foe.reduce((a,x)=>a+ksTotal(x),0)`);
  ok('A2 敵總兵力仍在常態(析出未灌水)', foeTotal > 100 && foeTotal < 3000, '敵總'+foeTotal);
}

// ── B. 家業軍令:河地形驅動水軍/商人/忍/僧兵 ──
{
  setup('river');
  ev('ksHexResolve()');   // 一刻後各與力已擇令
  const ords = ev(`KS.hex.units.filter(u=>u.side==='my'&&u.s.kind==='vassal'&&!u.s.broke)
    .map(u=>{const g2=ksGyouOf(u.s);return g2+':'+u.ord+(u.tgt?'@'+u.tgt:'');}).join(' ')`);
  ok('B1 與力軍令依家業分化', /temple:(hold|adv)/.test(ords)&&/suigun:(feat|hold|adv|chg)/.test(ords), ords);
  // 推幾刻,忍應出現趁虛指名(atk@),水軍應曾 feat
  let sawAtk=/shinobi:atk@/.test(ords), sawFeat=/suigun:feat/.test(ords);
  for(let i=0;i<8;i++){
    if(ev('!KS||!KS.hex||KS.hexDone'))break;
    ev('ksHexResolve()');
    const o2 = ev(`KS&&KS.hex?KS.hex.units.filter(u=>u.side==='my'&&u.s.kind==='vassal'&&!u.s.broke)
      .map(u=>{const g2=ksGyouOf(u.s);return g2+':'+u.ord+(u.tgt?'@'+u.tgt:'');}).join(' '):''`);
    if(/shinobi:atk@/.test(o2)) sawAtk=true;
    if(/suigun:feat|suigun:hold/.test(o2)) sawFeat=true;
  }
  ok('B2 忍曾亂波趁虛(atk指名)', sawAtk, '');
  ok('B3 水軍曾搶據渡口(feat/hold)', sawFeat, '');
}

// ── C. 內應調略:round0限定/扣錢/成則抽身+寫回 ──
{
  setup(null);
  const money0 = ev('S.money');
  const fvId = ev(`KS.hex.units.find(u=>u.s.kind==='foevassal').s.id`);
  const relBefore = ev(`S.rivals.find(x=>'fv'+x.id==='${fvId}').rel`);
  ok('C0 控制列有內應調略鈕', /內應調略/.test(ev('ksHexCtrlHtml()')), '');
  ev('__rnd = Math.random; Math.random = ()=>0;');   // 強制成功
  ev(`ksChouryaku('${fvId}')`);
  ev('Math.random = __rnd;');
  const spent = money0 - ev('S.money');
  ok('C1 調略扣錢+單次旗', spent > 0 && ev('KS.chouUsed')===true, `費${spent}貫`);
  const chouIn = ev(`KS.hex.units.find(u=>u.s.id==='${fvId}').s._chouIn`);
  ok('C2 允諾抽身刻已定(2~4)', chouIn>=2 && chouIn<=4, '第'+chouIn+'刻');
  let leftMsg = false;
  for(let i=0;i<6;i++){
    if(ev('!KS||!KS.hex||KS.hexDone'))break;
    ev('ksHexResolve()');
    if(/內應發動/.test(ev('(KS&&KS.hist?KS.hist.join(" "):"")')) || ev(`(()=>{const u=KS&&KS.hex?KS.hex.units.find(x=>x.s.id==='${fvId}'):null;return u&&u.s.retired?1:0;})()`)){ leftMsg=true; break; }
  }
  ok('C3 戰中應約抽身(retired帶兵離場)', leftMsg, '');
  const relAfter = ev(`S.rivals.find(x=>'fv'+x.id==='${fvId}').rel`);
  ok('C4 寫回:該眾對我rel+3', relAfter === relBefore + 3, `${relBefore}→${relAfter}`);
  ok('C5 round>0後鈕消失', !/內應調略/.test(ev('ksHexCtrlHtml()')), '');
}

// ── D. 敵與力臨陣離脫(信心崩+劣勢) ──
{
  let fled = 0, N = 12;
  for(let t=0;t<N;t++){
    setup(null);
    ev(`['toda','udono'].forEach(id=>{const f=S.rivals.find(x=>x.id===id); f.ltrust=5; f.persona='商業';});
        KS.my.forEach(s=>{U_KEYS.forEach(k=>{s.army[k]=ri((s.army[k]||0)*3);});});`);   // 我方壓倒優勢→敵視角大寒
    for(let i=0;i<6;i++){
      if(ev('!KS||!KS.hex||KS.hexDone'))break;
      ev('ksHexResolve()');
      if(/自引兵離場/.test(ev('KS&&KS.hist?KS.hist.join(" "):""'))){ fled++; break; }
    }
  }
  ok('D1 敵與力劣勢下會臨陣離脫', fled >= 3, `${fled}/${N}局`);
}

// ── E. 劇本(關原)不受影響 ──
{
  ev('KS=null;BT=null;');$('modalBack').classList.add('hidden');
  ev('S=newState("試",0,"kokujin","gozoku","mikawa")');
  sb.kokusenSeki('west');
  let g=0;
  while(!ev('KS && KS.hex')&&g++<8){
    const btns=[...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
    if(!btns.length)break;
    (btns.find(b=>/^開戰/.test(b.textContent))||btns[0]).click();
  }
  ok('E1 劇本無敵與力備/無調略鈕', ev(`KS.hex.units.filter(u=>u.s.kind==='foevassal').length`)===0 && !/內應調略/.test(ev('ksHexCtrlHtml()')), '');
}

for(const [st,n,note] of R) console.log(st, n, note?(' — '+note):'');
console.log(R.some(r=>r[0]==='✗') ? '✗ 有未過' : '全部通過');
