'use strict';
const run = require('/home/Yhys/aos-rom-randomizer/engine/lib/runRandomizer').run;
const roomEntities = require('/home/Yhys/aos-rom-randomizer/engine/lib/roomEntities');
const fs = require('fs');
const orig = fs.readFileSync('/home/Yhys/aos-rom-randomizer/engine/rom/emcxyywq.gba');

const CONVERT_ROOMS = [124, 141, 157, 222, 242, 268];
const NEIGHBORS = { 124:[119,127], 141:[149,142], 157:[167,169], 222:[221,237], 242:[241,246], 268:[264,265] };
const DOOR_ROOMS = new Set();
for (const br of CONVERT_ROOMS) { DOOR_ROOMS.add(br); NEIGHBORS[br].forEach(n => DOOR_ROOMS.add(n)); }
const MINI_BOSS_DOOR_ROOMS = [9,10,35,47,50,51,55,77,78,99,103];
const CHAOS_DOOR_ROOM = 315;

// 1) 原始 6 Boss 房实体
for (const ri of CONVERT_ROOMS) {
  const a = roomEntities.readRoomEntityList(orig, ri);
  console.log(`orig room ${ri}:`, a.map(e => `[t${e.type} s${e.subtype} x${e.x} vB${e.varB}]`).join(' '));
}

// 2) 跑两遍确认可重复
for (const seed of [99, 7]) {
  const r = run({ random_type: 0, enemy_boss_min: 1 }, seed);
  const d = r.data;
  let problems = 0;
  const check = (cond, msg) => { if (!cond) { problems++; console.log(`  FAIL: ${msg}`); } };

  // 2a) 6 Boss 房：无 subtype 106-112，且存在替换后的小怪实体
  for (const ri of CONVERT_ROOMS) {
    const ents = roomEntities.readRoomEntityList(d, ri);
    const boss = ents.filter(e => e.type===1 && e.subtype>=106 && e.subtype<=112).length;
    const small = ents.filter(e => e.type===1 && e.subtype<106).length;
    check(boss===0, `room ${ri} 仍有 Boss 实体`);
    check(small>=1, `room ${ri} 缺少替换小怪`);
  }

  // 2b) 12 个目标房间：无 Boss 门（type2/subtype 2/4/10 + flag 0/1/2/4/5/6）
  for (const ri of DOOR_ROOMS) {
    const ents = roomEntities.readRoomEntityList(d, ri);
    const doors = ents.filter(e => e.type===2 && [2,4,10].includes(e.subtype) && [0,1,2,4,5,6].includes(e.varB)).length;
    check(doors===0, `room ${ri} 残留 Boss 门 ${doors}`);
  }

  // 2c) 混沌房 322/324 未被改：仍有最终混沌，门实体保留
  for (const ri of [322, 324]) {
    const ents = roomEntities.readRoomEntityList(d, ri);
    check(ents.some(e => e.type===1 && e.subtype===112), `room ${ri} 混沌被移除`);
  }

  // 2d) 小 Boss 门（vB 10/11/12/15）不受影响
  for (const ri of MINI_BOSS_DOOR_ROOMS) {
    const ents = roomEntities.readRoomEntityList(d, ri);
    const doors = ents.filter(e => e.type===2 && [10,11,12,15].includes(e.varB)).length;
    check(doors>=1, `room ${ri} 小 Boss 门被误删`);
  }

  // 2e) 混沌门（room 315 vB7）保留
  {
    const ents = roomEntities.readRoomEntityList(d, 315);
    check(ents.some(e => e.type===2 && e.varB===7), 'room 315 混沌门被误删');
  }

  // 2f) 仅目标房间（6 Boss 房 + 6 扇门的邻居房）的实体列表指针被搬迁；其余房间指针不变
  {
    const changedRooms = [];
    const changedOutside = [];
    for (let i = 0; i < roomEntities.ROOM_COUNT; i++) {
      const getPtr = (buf) => {
        const roomPtr = buf.readUInt32LE(roomEntities.ROOM_TABLE + i*4);
        if ((roomPtr & 0xFF000000) !== 0x08000000) return -1;
        return buf.readUInt32LE(roomPtr - 0x08000000 + 20);
      };
      const a = getPtr(orig);
      const b = getPtr(d);
      if (a !== b) {
        changedRooms.push(i);
        if (!DOOR_ROOMS.has(i)) changedOutside.push(i);
      }
    }
    check(changedOutside.length===0, `非目标房间指针被改: ${changedOutside.join(',')}`);
    check(changedRooms.length===12, `搬迁房间数=${changedRooms.length} 应为 12: ${changedRooms.join(',')}`);
  }

  // 2g) 目标房间的实体列表可正常读取（允许为空，如 room 119 原本只有一扇门）
  for (const ri of DOOR_ROOMS) {
    roomEntities.readRoomEntityList(d, ri);
  }

  // 2h) 空闲区统计
  const seen = new Set();
  for (let i = roomEntities.FREE_SPACE_ADDR; i < 0x800000; i++) {
    if (d[i] !== 0xFF) seen.add(i);
  }
  console.log(`seed ${seed}: free bytes used=${seen.size}`);
  console.log(`  summary: ${r.summary}`);
  console.log(problems===0 ? `seed ${seed}: ALL OK` : `seed ${seed}: ${problems} PROBLEMS`);
}
