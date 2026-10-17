'use strict';
const run = require('/home/Yhys/aos-rom-randomizer/engine/lib/runRandomizer').run;
const roomEntities = require('/home/Yhys/aos-rom-randomizer/engine/lib/roomEntities');
const fs = require('fs');

for (const seed of [99, 7, 12345]) {
  const r = run({
    random_type: 0, enemy_boss_min: 1, double_chaos: 1,
    start_weapon: 12, start_armor: 20, start_accessory: 40, ringchaos: 1,
  }, seed);
  const d = r.data;
  let problems = 0;
  const check = (cond, msg) => { if (!cond) { problems++; console.log(`  FAIL: ${msg}`); } };

  for (const ri of [124,141,157,222,242,268]) {
    const ents = roomEntities.readRoomEntityList(d, ri);
    check(ents.every(e => e.type!==1 || e.subtype<106), `room ${ri} 仍含 Boss`);
  }
  for (const ri of [322,324]) {
    const ents = roomEntities.readRoomEntityList(d, ri);
    check(ents.filter(e => e.type===1 && e.subtype===112).length===2, `room ${ri} 双混沌丢失`);
  }
  const start = roomEntities.readRoomEntityList(d, 0);
  const items = start.filter(e => e.type===4);
  check(items.length>=4, `起始房赠品 ${items.length} 应为 >=4`);

  const seen = new Set();
  for (let i = roomEntities.FREE_SPACE_ADDR; i < 0x800000; i++) if (d[i] !== 0xFF) seen.add(i);
  const used = [...seen].sort((a,b)=>a-b);
  let gapOverlap = false;
  for (let i = 1; i < used.length; i++) if (used[i] === used[i-1]) gapOverlap = true;
  check(!gapOverlap, '空闲区重复写入');
  console.log(`seed ${seed}: free bytes used=${seen.size}  ${problems===0?'ALL OK':problems+' PROBLEMS'}`);
}
