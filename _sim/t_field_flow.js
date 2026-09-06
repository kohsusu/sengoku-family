// 軍評定P3:全流程——出陣→軍議三案(+奇策)→布陣調整→自動戰→檢討→結算回填
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc,localStorage}=require('./shim');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=[...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1])[0];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>0},setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},Image:class{set src(v){}},navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,prompt:()=>null,matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),location:{port:'5877',reload(){},replace(){}}};
sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
vm.runInContext(script,sb,{filename:'game.js'});
vm.runInContext('render=function(){};drawMap=function(){};save=function(){};__LL=[];log=function(m){__LL.push(String(m));};',sb);
const ev=c=>vm.runInContext(c,sb),$=id=>doc.getElementById(id);
const R=[];const ok=(n,c,note)=>R.push([c?'✓':'✗',n,note||'']);
console.log('BUILD:',ev('BUILD'));

function runFlow(chiHi, pickRe){
  ev('KS=null;BT=null;FB=null;');
  $('modalBack').classList.add('hidden');
  ev('modalQueue.length=0; __LL=[];');
  ev(`S=newState('流試',0,'kokujin','gozoku','mikawa');
     S.army={ashigaru:220,yumi:60,kiba:45,teppo:30}; S.soldiers=355; S.rice=999; S.money=300; S.prestige=80;
     S.retainers.forEach(r=>{r.stamina=100;r.sick=0;});
     S.retainers[1].chi=${chiHi};`);
  const army0=ev('armyTotal(S.army)');
  ev(`conquestWar(S.rivals.find(x=>x.id==='saji'));`);
  const titles=[];
  let g=0, sawKisaku=false, planN=0;
  while(!$('modalBack').classList.contains('hidden')&&g++<15){
    const ti=$('modalTitle').textContent;
    titles.push(ti);
    const btns=[...$('modalChoices').querySelectorAll('button')].filter(b=>!b.disabled);
    if(!btns.length){$('modalBack').classList.add('hidden');break;}
    const by=re=>btns.find(b=>re.test(b.textContent));
    if(/出兵討伐/.test(ti)) (by(/野戰決戰/)||btns[0]).click();
    else if(/軍評定/.test(ti)){ sawKisaku=btns.some(b=>/奇策/.test(b.textContent)); planN=btns.length; (by(pickRe)||btns[0]).click(); }
    else if(/布陣調整/.test(ti)) (by(/開戰/)||btns[0]).click();
    else if(/攻略——/.test(ti)&&!/軍議の選択/.test(ti)) (by(/跳至結果/)||btns[0]).click();
    else btns[0].click();
    ev('pumpModal()');
  }
  return {titles:titles.join('||'), sawKisaku, planN,
    army1:ev('armyTotal(S.army)'), army0,
    LL:ev('__LL.join(" | ")'), fbNull:ev('FB===null'),
    mq:ev('modalQueue.length'), hidden:$('modalBack').classList.contains('hidden')};
}

// 高智:奇策應浮現(4案)
const A=runFlow(88, /奇策/);
ok('F1 流程序(軍評定→布陣調整→軍議の選択)', /軍評定/.test(A.titles)&&/布陣調整/.test(A.titles)&&/軍議の選択/.test(A.titles), A.titles.slice(0,120));
ok('F2 智88奇策浮現(4案)', A.sawKisaku && A.planN>=4, '案數'+A.planN);
ok('F3 兵損回填', A.army1 < A.army0, A.army0+'→'+A.army1);
ok('F4 FB清理+modal清空', A.fbNull && A.mq===0 && A.hidden, '');
ok('F5 結算契約(勝:大敗/降伏/割地 或 敗:失利)', /野戰大敗|開城降伏|割地|討伐失利|臣從|從屬/.test(A.LL), A.LL.slice(-100));

// 低智:僅三案、無奇策
const B=runFlow(35, /穩健/);
ok('F6 低智無奇策(3案)', !B.sawKisaku && B.planN===3, '案數'+B.planN);
ok('F7 低智流程亦完整', /軍議の選択/.test(B.titles) && B.fbNull, '');

for(const [st,n,note] of R)console.log(st,n,note?(' — '+note):'');
console.log(R.some(r=>r[0]==='✗')?'✗ 有未過':'全部通過');
