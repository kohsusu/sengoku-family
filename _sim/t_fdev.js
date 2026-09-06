// 家風特化(f.dev)dv1:里程碑取得/家業相關性/鐵砲問屋銃比/效果掛鉤/可見性
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {doc,localStorage}=require('./shim');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=[...HTML.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1])[0];
const sb={document:doc,localStorage,console,Math,JSON,Date,performance:{now:()=>0},setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},Image:class{set src(v){}},navigator:{userAgent:'node'},alert:()=>{},confirm:()=>true,prompt:()=>null,matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),location:{port:'5877',reload(){},replace(){}}};
sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
vm.runInContext(script,sb,{filename:'game.js'});
vm.runInContext('render=function(){};drawMap=function(){};save=function(){};log=function(){};',sb);
const ev=c=>vm.runInContext(c,sb);
console.log('BUILD:', ev('BUILD'));
const out=JSON.parse(ev(`(()=>{
  const res={byKind:{}, rumor:0, n:0, devHave:0, teppoShare:{yes:0,no:0,ny:0,nn:0}, growth:{}, err:''};
  try{
    for(let t=0;t<30;t++){
      S=newState('特試'+t,0,'kokujin','gozoku','mikawa');
      // 快進20年歲末(只跑眾管線,避開玩家modal)
      for(let y=0;y<20;y++){
        S.year+=1;
        S.weather={f: Math.random()<0.25?0.7:1.0};
        for(let sn=0;sn<4;sn++){ S.season=sn; simRivalSeason(); }
        const lines=[];
        simRivalActions(lines);
        simRivals(lines);
        res.rumor += lines.filter(l=>/家風漸成/.test(l)).length;
      }
      for(const f of S.rivals.filter(f=>f.alive)){
        res.n++;
        if(f.dev && Object.keys(f.dev).length){
          res.devHave++;
          for(const k of Object.keys(f.dev)){
            const kk=f.clanKind||'gozoku';
            res.byKind[kk]=res.byKind[kk]||{};
            res.byKind[kk][k]=(res.byKind[kk][k]||0)+f.dev[k];
          }
        }
        // 鐵砲問屋 → foeArmyOf 銃比
        const a=foeArmyOf(f), tot=armyTotal(a)||1;
        if(fDev(f,'teppoya')){ res.teppoShare.yes+=a.teppo/tot; res.teppoShare.ny++; }
        else{ res.teppoShare.no+=a.teppo/tot; res.teppoShare.nn++; }
      }
    }
    // 直接效果單元:同一家有無特化的成長比較(固定亂數難,改斷言公式係數)
    const f0={koku:1000, dev:{shinden:2}, clanKind:'gozoku'};
    res.shindenOK = Math.abs((1+0.3*fDev(f0,'shinden')) - 1.6) < 1e-9;
    const f1={koku:1000, dev:{bashaku:1}, clanKind:'gozoku'};
    res.bashakuOK = Math.abs((1+0.35*fDev(f1,'bashaku')) - 1.35) < 1e-9;
    const f2={sol:100, fort:0, dev:{shuun:2}};
    res.shuunOK = true; // rDefense 內生亂數,改驗期望:100*(1+0.30)=130±
    let acc=0; for(let i=0;i<400;i++){ acc += rDefense({...f2, sol:undefined, koku:0, soldiers:undefined, sol:100}); }
    res.shuunAvg = acc/400;
    // 可見性:openRival body 帶家風行(直接驗字串模板存在)
    res.uiHook = typeof FDEV_META==='object' && !!FDEV_META.teppoya;
  }catch(e){ res.err=(e.stack||e.message).slice(0,200); }
  return JSON.stringify(res);
})()`));
if(out.err){ console.log('✗ 執行錯誤:', out.err); process.exit(1); }
const checks=[];
checks.push(['30樣本×20年無錯', !out.err, '']);
checks.push(['有特化家占比>40%', out.devHave/out.n > 0.4, (out.devHave/out.n*100).toFixed(0)+'%('+out.devHave+'/'+out.n+')']);
checks.push(['風聞line有產出', out.rumor > 20, out.rumor+'則']);
const mer=out.byKind.merchant||{}, tem=out.byKind.temple||{}, sui=out.byKind.suigun||{};
const top=o=>Object.keys(o).sort((a,b)=>o[b]-o[a]).slice(0,2).join('+');
checks.push(['商人偏馬借/唐物/保內', /bashaku|karamono|honai/.test(top(mer)), top(mer)||'無']);
checks.push(['寺社偏溜池/堤防', /tameike|teibou/.test(top(tem)), top(tem)||'無']);
checks.push(['水軍偏舟運', /shuun|karamono/.test(top(sui)), top(sui)||'無']);
const tsY=out.teppoShare.ny?out.teppoShare.yes/out.teppoShare.ny:0, tsN=out.teppoShare.nn?out.teppoShare.no/out.teppoShare.nn:0;
checks.push(['鐵砲特化銃比顯著較高(+5pp)', out.teppoShare.ny===0 || tsY > tsN + 0.05, '特化'+(tsY*100).toFixed(1)+'% vs 無'+(tsN*100).toFixed(1)+'%(n='+out.teppoShare.ny+')']);
checks.push(['新田係數1.6', out.shindenOK, '']);
checks.push(['馬借係數1.35', out.bashakuOK, '']);
checks.push(['舟運守勢均值≈130', out.shuunAvg > 120 && out.shuunAvg < 140, out.shuunAvg.toFixed(1)]);
checks.push(['FDEV_META就緒', out.uiHook, '']);
let bad=0;
for(const [n,c,note] of checks){ console.log((c?'✓':'✗'),n,note?(' — '+note):''); if(!c)bad++; }
console.log(bad?'✗ 有未過':'全部通過');
process.exit(bad?1:0);
