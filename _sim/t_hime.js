const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc,localStorage}=require('./shim');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const src=[...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][0][1];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>Date.now()},
 setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:()=>0,
 Image:class{},navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,
 matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),
 location:{port:'5877',reload(){},replace(){}}};
sb.window=sb; sb.globalThis=sb; vm.createContext(sb);
vm.runInContext(src,sb,{filename:'game.js'});
vm.runInContext("render=function(){ if(S){armySync();aptSync();} }; drawMap=function(){}; save=function(){};",sb);
const g=sb.window.__game, ev=c=>vm.runInContext(c,sb);

// 情境:當主身故,一門無男子、無男童,只剩 3 歲女童
g.startGame(g.newState('姫試',0,'kokujin','gozoku'));
const S=g.S;
S.retainers = [S.retainers[0]];                 // 只留當主
S.children = [{name:'阿鶴',sex:'f',age:3,eduBu:0,eduNai:0,eduChi:0}];
S.hostage = null;
const lines=[];
ev('succession')(lines,'病歿');
console.log('繼位後:', S.retainers.map(r=>`${r.name}(${r.role}・${r.age}歲・sex=${r.sex})`).join(', '));
console.log('gameOver =', !!S.gameOver);
console.log(lines.join('\n'));
console.log('lordIsFemale =', ev('lordIsFemale()'));

// 及笄後可招婿養子嗎
S.retainers[0].age = 16; S.money = 100;
doc.getElementById('modalBack').classList.add('hidden');
ev('doMuko')();
const btns=doc.getElementById('modalChoices').querySelectorAll('button');
console.log('招婿選項:', btns.map(b=>b.textContent.slice(0,26)));
if(btns.length){ btns[0].click(); console.log('招婿後:', S.retainers.map(r=>r.name+'/'+r.role).join(', '), '| wife=', JSON.stringify(S.wife)); }

// 席次:12 人上限與部屋住
g.startGame(g.newState('席試',0,'kokujin','gozoku'));
const S2=g.S;
for(let i=0;i<20;i++) ev('rosterAdd')({name:'甲'+i,role:'部屋住',kind:'一門',age:20,bu:40,nai:40,chi:40,task:'rest',merit:0,salary:10,loyalty:80,rank:0,stamina:100});
console.log('\n加入 20 人後 → 總計', S2.retainers.length, '在籍', ev('activeR().length'), '部屋住', S2.retainers.filter(r=>r.spare).length);
S2.retainers[1].spare = true;    // 騰一席
ev('rosterPromote')(null);
console.log('騰一席並遞補後 → 在籍', ev('activeR().length'));
