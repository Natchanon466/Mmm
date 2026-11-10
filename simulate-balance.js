// จำลองการเล่นซ้ำหลายพันเกม เพื่อเทียบคะแนนของกลุ่มที่ซื้อของใช้ซ้ำมากน้อยต่างกัน
// ใช้ตอนปรับสูตรคะแนนหรือเหตุการณ์: npm run simulate
const M = require('../js/game.js');
const order=['cleaner','umbrella','cup','bin','box','bag'];
const cost={cleaner:100,umbrella:100,cup:100,bin:120,box:150,bag:60};
const cum=[0];order.forEach(o=>cum.push(cum[cum.length-1]+cost[o]));
function game(N,levels){
  M.init(); M.startGame();
  levels.forEach((lv,g)=>{for(let i=0;i<lv;i++)M.buyProduct(g,order[i]);});
  for(let i=0;i<N;i++){
    M.S.pending=null; if(!M.drawEvent().ok)break;
    const ev=M.EVENTS.find(e=>e.id===M.S.pending.eventId);
    if(ev.choice) M.S.groups.forEach(g=>{const id=ev.id;let yes=(id==='market'&&(g.inv.bag||g.money>=300))||((id==='cleanup'||id==='donate')&&g.money>=500)||(id==='beach');M.setChoice(g.id,yes?'yes':'no');});
    if(ev.lottery){for(let k=0;k<5;k++)M.lockTickets(k);M.drawWinning();}
    M.confirmEvent();
  }
  return M.S.groups.map(g=>({m:g.money,e:g.env}));
}
const forms={
 'เดิม cap1000':(m,e)=>Math.min(m,1000)/20+e/2,
 'cap800':(m,e)=>Math.min(m,800)/16+e/2,
 'cap700':(m,e)=>Math.min(m,700)/14+e/2,
 'cap600':(m,e)=>Math.min(m,600)/12+e/2,
};
const Ns=[6,8,10,12,14];
const res={};
for(const N of Ns){
  const acc=Array.from({length:7},()=>({m:0,e:0,n:0}));
  const sets=[[0,1,2,3,4],[2,3,4,5,6],[5,6,0,1,3],[4,2,6,0,5]];
  for(let t=0;t<1500;t++){
    const lv=sets[t%4].slice().sort(()=>Math.random()-.5);
    const r=game(N,lv);
    r.forEach((x,g)=>{const a=acc[lv[g]];a.m+=x.m;a.e+=x.e;a.n++;});
  }
  res[N]=acc.map(a=>({m:a.m/a.n,e:a.e/a.n}));
}
console.log('ระดับการซื้อ (ชิ้น/ค่าใช้จ่าย):',cum.map((c,i)=>i+'/'+c).join('  '));
for(const [fn,f] of Object.entries(forms)){
  console.log('\n== '+fn);
  console.log('N'.padEnd(4)+cum.map((c,i)=>('ซื้อ'+c).padStart(8)).join(''));
  for(const N of Ns){
    const sc=res[N].map(x=>f(x.m,x.e));
    const best=sc.indexOf(Math.max(...sc));
    console.log(String(N).padEnd(4)+sc.map((v,i)=>(v.toFixed(1)+(i===best?'*':' ')).padStart(8)).join(''));
  }
}
console.log('\nเงิน/env เฉลี่ยที่ N=10:',res[10].map((x,i)=>cum[i]+': '+x.m.toFixed(0)+'/'+x.e.toFixed(1)).join('  '));
