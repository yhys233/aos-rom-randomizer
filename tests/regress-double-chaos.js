'use strict';
const run = require('/home/Yhys/aos-rom-randomizer/engine/lib/runRandomizer').run;
const roomEntities = require('/home/Yhys/aos-rom-randomizer/engine/lib/roomEntities');
const fs = require('fs');
const orig = fs.readFileSync('/home/Yhys/aos-rom-randomizer/engine/rom/emcxyywq.gba');

// 1) 对比原始房间 322/324 实体（含门）
for (const ri of [322, 324]) {
  const a = roomEntities.readRoomEntityList(orig, ri);
  console.log(`orig room ${ri}:`, a.map(e => `[t${e.type} s${e.subtype} x${e.x} y${e.y} vA${e.varA} vB${e.varB} u${e.uid}]`).join(' '));
}

// 2) 跑两遍确认可重复/空闲区不冲突
for (const seed of [99, 7]) {
  const r = run({ random_type: 0, double_chaos: 1, start_weapon: 12, ringchaos: 1 }, seed);
  const d = r.data;
  // 校验空闲区分配位置是否重叠：统计被写入的空闲区块
  const seen = new Set();
  let overlap = 0;
  for (let i = roomEntities.FREE_SPACE_ADDR; i < 0x800000; i++) {
    if (d[i] !== 0xFF) seen.add(i);
  }
  // 检查 start room 与 chaos 房搬迁位置
  console.log(`seed ${seed}: summary=${r.summary.split('\n').length} lines; free bytes used=${seen.size}`);
  for (const ri of [0, 322, 324]) {
    const ents = roomEntities.readRoomEntityList(d, ri);
    const chaos = ents.filter(e => e.type===1 && e.subtype===112).length;
    const doors = ents.filter(e => e.type===2 && e.subtype===2).length;
    console.log(`  room ${ri}: entities=${ents.length} chaos=${chaos} doors=${doors}`);
  }
}
