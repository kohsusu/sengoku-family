const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc,localStorage}=require('./shim');
const src=[...fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][0][1];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>Date.now()},
 setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:()=>0,Image:class{},
 navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,
 matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),location:{port:'5877',reload(){},replace(){}}};
sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
vm.runInContext(src,sb,{filename:'game.js'});
vm.runInContext("render=function(){if(S){armySync();aptSync();}};drawMap=function(){};save=function(){};",sb);
const g=sb.window.__game,ev=c=>vm.runInContext(c,sb),$=id=>doc.getElementById(id);
$('modalBack').classList.add('hidden');
const hid=()=>$('modalBack').classList.contains('hidden');
const drain=()=>{let n=0;while(!hid()&&n++<40){const b=$('modalChoices').querySelectorAll('button');if(!b.length){$('modalBack').classList.add('hidden');break;}b[0].click();}};

function boot(){ $('modalBack').classList.add('hidden'); ev('modalQueue.length=0');
  g.startGame(g.newState('育',0,'kokujin','gozoku')); drain(); return g.S; }

console.log('══ ① 幼主在攝政期間受傅育 vs 完全不教 ══');
[['有教育',true],['不教育',false]].forEach(([label,teach])=>{
  const S=boot();
  // 造出五歲幼主
  S.retainers = [S.retainers[0]];
  S.children = [{name:'竹千代',sex:'m',age:5,eduBu:0,eduNai:0,eduChi:0}];
  const lines=[]; ev('succession')(lines,'病歿');
  drain();
  const lord=S.retainers[0];
  console.log('  '+label+' 繼位時:', lord.name, lord.age+'歲', '武'+lord.bu, '政'+lord.nai, '智'+lord.chi, '('+lord.role+')');
  // 補幾個家臣來教
  for(let i=0;i<1;i++) ev('rosterAdd')({name:'傅役'+i,role:'傅役',kind:'譜代',age:40,bu:70,nai:70,chi:70,
    task:teach?'educate':'rest',merit:0,salary:10,loyalty:80,rank:0,stamina:100});
  S.money=9999; S.rice=99999;
  for(let y=0;y<11;y++){ for(let s=0;s<4;s++){
    S.retainers.forEach((r,i)=>{ if(i>0){ r.task = teach?'educate':'rest'; r.stamina=100; } });
    g.endSeason(); drain(); if(S.gameOver) break; } if(S.gameOver) break; }
  const l2=S.retainers[0];
  console.log('  '+label+' 親政後:', l2.name, l2.age+'歲', '武'+l2.bu, '政'+l2.nai, '智'+l2.chi, '('+l2.role+')  合計 '+(l2.bu+l2.nai+l2.chi));
});

console.log('\n══ ② 人質在大名家受傅育 ══');
{
  const S=boot();
  S.allegiance='imagawa';
  S.hostage={name:'竹千代',age:6,lord:'imagawa',eduBu:0,eduNai:0,eduChi:0};
  console.log('  今川家重臣:', ev('lordRoster')('imagawa').map(v=>v.n+'(智'+v.chi+')').join('、'));
  S.money=9999; S.rice=99999;
  for(let y=0;y<10;y++){ for(let s=0;s<4;s++){ g.endSeason(); drain(); if(S.gameOver) break; }
    if(S.gameOver||!S.hostage) break; }
  const back=S.retainers.find(r=>r.kind==='一門'&&r.age>=15&&r!==S.retainers[0]);
  if(back) console.log('  歸家後:', back.name, back.age+'歲', '武'+back.bu, '政'+back.nai, '智'+back.chi, '合計 '+(back.bu+back.nai+back.chi));
  else console.log('  (尚未歸家 / hostage=', JSON.stringify(S.hostage), ')');
}
