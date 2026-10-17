'use strict';
const run = require('/home/Yhys/aos-rom-randomizer/engine/lib/runRandomizer').run;
const roomEntities = require('/home/Yhys/aos-rom-randomizer/engine/lib/roomEntities');

for (const seed of [99, 7, 12345]) {
  const r = run({
    random_type: 0, light_chaos: 1, enemy_boss_min: 1, double_chaos: 1,
    start_weapon: 12, start_armor: 20, start_accessory: 40, ringchaos: 1,
  }, seed);
  const d = r.data;
  let problems = 0;
  const check = (cond, msg) => { if (!cond) { problems++; console.log(`  FAIL: ${msg}`); } };

  for (const ri of [322, 324]) {
    const ents = roomEntities.readRoomEntityList(d, ri);
    check(ents.filter(e => e.type===1 && e.subtype===112).length===2, `room ${ri} 双混沌丢失`);
  }
  for (const ri of [124,141,157,222,242,268]) {
    const ents = roomEntities.readRoomEntityList(d, ri);
    check(ents.every(e => e.type!==1 || e.subtype<106), `room ${ri} 仍含 Boss`);
  }
  const start = roomEntities.readRoomEntityList(d, 0);
  check(start.filter(e => e.type===4).length>=4, `起始房赠品 ${start.filter(e=>e.type===4).length}`);

  let used = 0;
  for (let i = roomEntities.FREE_SPACE_ADDR; i < 0x800000; i++) if (d[i] !== 0xFF) used++;
  const total = 0x800000 - roomEntities.FREE_SPACE_ADDR;
  check(used < total, `空闲区用尽 ${used}/${total}`);
  check(r.summary.includes('混沌地图明亮'), 'summary 缺 light_chaos 行');
  console.log(`seed ${seed}: free bytes(non-FF)=${used} of ${total}  ${problems===0 ? 'ALL OK' : problems + ' PROBLEMS'}`);
}
