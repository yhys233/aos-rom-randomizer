const rr = require('/home/Yhys/aos-rom-randomizer/engine/lib/runRandomizer');
const oldError = console.error;
console.error = () => {};
function read16(d, off){return d[off]|d[off+1]<<8;}
function read32(d, off){return d[off]|d[off+1]<<8|d[off+2]<<16|d[off+3]<<24;}
const combos = [
  {random_type:0, seed:5, ringchaos:1},
  {random_type:0, seed:5, soul_start:1},
  {random_type:0, seed:5, mainsoul:1},
  {random_type:0, seed:5, ringchaos:1, soul_start:1, mainsoul:1},
  {random_type:0, seed:5, ringchaos:1, soul_start:1, mainsoul:1, main_soul_random:1},
  {random_type:1, seed:5, ringchaos:1, soul_start:1, mainsoul:1},
  {random_type:3, seed:5, ringchaos:1, mainsoul:1},
];
for (const c of combos){
  try {
    const r = rr.run(c);
    const d = r.data;
    const elPtr = read32(d, read32(d,0x4E52AC)-0x08000000+20);
    let gifts = [];
    for(let off=elPtr-0x08000000;;off+=12){
      const x=read16(d,off),y=read16(d,off+2);
      if(x===0x7FFF&&y===0x7FFF)break;
      const uid=d[off+4];
      if(uid===3||uid===5||uid===6||uid===7) gifts.push({sub:d[off+6],va:read16(d,off+8),vb:read16(d,off+10)});
    }
    const flags = gifts.map(g=>g.va).join(',');
    console.log('type'+c.random_type,'seed'+c.seed,'gifts:',gifts.length,'| flags:',flags,'| changed:',r.bytesChanged);
  } catch(e){
    console.log('type'+c.random_type,'seed'+c.seed,'ERROR:',e.message);
  }
}
console.error = oldError;
