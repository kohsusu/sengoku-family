const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc,localStorage}=require('./shim');
const src=[...fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][0][1];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>Date.now()},
 setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:()=>0,Image:class{},
 navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,
 matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),location:{port:'5877',reload(){},replace(){}}};
sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
vm.runInContext(src,sb,{filename:'game.js'});
vm.runInContext("render=function(){if(S){armySync();aptSync();}};drawMap=function(){};save=function(){};log=function(){};",sb);
const g=sb.window.__game,ev=c=>vm.runInContext(c,sb),$=id=>doc.getElementById(id);
$('modalBack').classList.add('hidden');
const hid=()=>$('modalBack').classList.contains('hidden');
const bs=()=>$('modalChoices').querySelectorAll('button');
const drain=()=>{let n=0;while(!hid()&&n++<60){const b=bs();if(!b.length){$('modalBack').classList.add('hidden');break;}b[0].click();}};

g.startGame(g.newState('創',0,'kokujin','gozoku')); drain();
const S=g.S;
S.isDaimyo=true; S.allegiance=null; S.rice=9999; S.money=9999;
S.army={ashigaru:300,yumi:150,kiba:150,teppo:100}; S.soldiers=700;
S.lords.imagawa.demesne=5000;

function fight(){
  g.kokusen('imagawa', true);
  if(hid()) return null;
  bs()[0].click();               // 軍議→布陣
  bs()[0].click();               // 開戰
  let n=0;
  while(!hid()&&n++<40){ const b=bs();
    if(b.length===4){ $('ksSai').value=''; b[1].click(); } else b[0].click(); }
  return true;
}
console.log('第一戰前:今川 wounds =', S.lords.imagawa.wounds||0,
  '| 敵出兵 =', ev("Math.max(40, ri(lordPower('imagawa') * 3.4 * (1 - (S.lords.imagawa.wounds||0))))"));
fight();
const w1=S.lords.imagawa.wounds||0;
console.log('第一戰後:wounds =', +w1.toFixed(3),
  '| 下次敵出兵 =', ev("Math.max(40, ri(lordPower('imagawa') * 3.4 * (1 - (S.lords.imagawa.wounds||0))))"));
S.army={ashigaru:300,yumi:150,kiba:150,teppo:100}; S.soldiers=700; S.rice=9999;
fight();
const w2=S.lords.imagawa.wounds||0;
console.log('連戰第二場後:wounds =', +w2.toFixed(3), '(應累積)');
// 歲末痊癒
for(let i=0;i<4;i++){ g.endSeason(); drain(); }
console.log('過一年後:wounds =', +(S.lords.imagawa.wounds||0).toFixed(3), '(應 ×0.6 遞減)');
console.log('\n檢驗:負傷的我方大將', S.retainers.filter(r=>r.sick>0).map(r=>r.name+'(臥床'+r.sick+'季)').join('、')||'無');
