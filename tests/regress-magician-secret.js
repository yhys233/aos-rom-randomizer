'use strict';
const run = require('/home/Yhys/aos-rom-randomizer/engine/lib/runRandomizer').run;
const roomEntities = require('/home/Yhys/aos-rom-randomizer/engine/lib/roomEntities');
const { ROOM_TABLE, ROOM_COUNT, FREE_SPACE_ADDR, CHRONOMAGE_ID } = roomEntities;

const rd32 = (buf, o) => buf[o] | (buf[o+1]<<8) | (buf[o+2]<<16) | (buf[o+3]<<24);
let problems = 0;
const check = (cond, msg) => { if (!cond) { problems++; console.log(`  FAIL: ${msg}`); } };

function parseAll(buf) {
  const ranges = [];
  let enemies = 0, entities = 0;
  for (let i = 0; i < ROOM_COUNT; i++) {
    const rp = rd32(buf, ROOM_TABLE + i*4);
    if ((rp & 0xFF000000) !== 0x08000000) continue;
    const el = rd32(buf, rp - 0x08000000 + 20);
    if (el < 0x08000000 || el > 0x09000000) continue;
    const b = el - 0x08000000;
    let o = b, n = 0;
    for (;; o += 12) {
      const x = buf.readUInt16LE(o), y = buf.readUInt16LE(o+2);
      if (x === 0x7FFF && y === 0x7FFF) break;
      if (buf[o+5] === 1) enemies++;
      n++;
      if (o > 0x800000) throw new Error(`房间 ${i} 实体列表未终止`);
    }
    entities += n;
    ranges.push([b, o + 12]);
  }
  return { ranges, enemies, entities };
}

// 只检查空闲区内的列表：重定位的列表起点 >= FREE_SPACE_ADDR
function freeSpaceNoOverlap(ranges) {
  const fs = ranges.filter(r => r[0] >= FREE_SPACE_ADDR).sort((a,b) => a[0]-b[0]);
  for (let i = 1; i < fs.length; i++) {
    if (fs[i][0] < fs[i-1][1]) return [false, fs[i-1], fs[i]];
  }
  return [true, null, null];
}

function trialCheck(buf, seed) {
  const trialRooms = [124,141,157,222,242,268,322,324];
  for (const i of trialRooms) {
    const ents = roomEntities.readRoomEntityList(buf, i);
    const boss = ents.find(e => e.type === 1 && e.subtype >= 106 && e.subtype <= 112);
    if (!boss) { console.log(`  FAIL(seed ${seed}): room ${i} 无 Boss`); problems++; continue; }
    const rabbits = ents.filter(e => e.type === 1 && e.subtype === CHRONOMAGE_ID);
    if (rabbits.length !== 3) {
      console.log(`  FAIL(seed ${seed}): room ${i} 时之法师数=${rabbits.length} 应为 3`); problems++;
    }
    rabbits.forEach((r, k) => {
      const ex = boss.x + 24 + k*24, ey = boss.y + 8;
      if (r.x !== ex || r.y !== ey) {
        console.log(`  FAIL(seed ${seed}): room ${i} 兔[${k}] 位置 (${r.x},${r.y}) 应 (${ex},${ey})`); problems++;
      }
      if (r.varA !== 0 || r.varB !== 0 || r.byte8 !== 0) {
        console.log(`  FAIL(seed ${seed}): room ${i} 兔[${k}] varA/varB/byte8 非零`); problems++;
      }
    });
  }
}

console.log('== 1) 单独 magician_secret (seed 99) ==');
{
  const r = run({ random_type: 0, magician_secret: 1 }, 99);
  if (!r.summary.includes('时之试炼 (24 只时之法师加入 8 个 Boss/混沌房)')) {
    problems++; console.log(`  FAIL: summary 异常: ${r.summary}`);
  }
  trialCheck(r.data, 99);
  const { ranges, entities } = parseAll(r.data);
  check(entities > 1000, `全图实体数=${entities}`);
  const [ok, a, b] = freeSpaceNoOverlap(ranges);
  check(ok, `空闲区列表重叠: [${a}] vs [${b}]`);
  let free = 0;
  for (let o = FREE_SPACE_ADDR; o < 0x800000; o++) if (r.data[o] === 0xFF) free++;
  console.log(`  全图实体数=${entities}，空闲区剩余 ${free} 字节`);
}

console.log('== 2) 组合: enemy_boss_min + double_chaos + light_chaos + magician_secret (seed 7) ==');
{
  const r = run({ random_type: 0,
    magician_secret: 1, enemy_boss_min: 1, double_chaos: 1, light_chaos: 1 }, 7);
  const { ranges, entities } = parseAll(r.data);
  check(entities > 1000, `全图实体数=${entities}`);
  const [ok, a, b] = freeSpaceNoOverlap(ranges);
  check(ok, `空闲区列表重叠: [${a}] vs [${b}]`);
  // enemy_boss_min 移除 Boss 后，时之试炼应跳过 6 个 Boss 房、只处理 2 个混沌房
  const r322 = roomEntities.readRoomEntityList(r.data, 322);
  const r324 = roomEntities.readRoomEntityList(r.data, 324);
  check(r322.filter(e => e.type === 1 && e.subtype === CHRONOMAGE_ID).length === 3, `room322 兔子数 != 3`);
  check(r324.filter(e => e.type === 1 && e.subtype === CHRONOMAGE_ID).length === 3, `room324 兔子数 != 3`);
  // 双混沌：混沌房应各有 2 只混沌
  check(r322.filter(e => e.type === 1 && e.subtype === 112).length === 2, `room322 混沌数 != 2`);
  check(r324.filter(e => e.type === 1 && e.subtype === 112).length === 2, `room324 混沌数 != 2`);
  // 6 个 Boss 房不应再有 Boss 或兔子
  for (const i of [124,141,157,222,242,268]) {
    const ents = roomEntities.readRoomEntityList(r.data, i);
    check(!ents.some(e => e.type === 1 && e.subtype >= 106 && e.subtype <= 112), `room ${i} 仍有 Boss`);
    check(!ents.some(e => e.type === 1 && e.subtype === CHRONOMAGE_ID), `room ${i} 不应有兔子`);
  }
  check(r.summary.includes('时之试炼 (6 只时之法师加入 2 个 Boss/混沌房)'), `summary 缺时之试炼`);
  let free = 0;
  for (let o = FREE_SPACE_ADDR; o < 0x800000; o++) if (r.data[o] === 0xFF) free++;
  console.log(`  全图实体数=${entities}，空闲区剩余 ${free} 字节`);
}

console.log('== 3) 确定性 ==');
{
  const a = run({ random_type: 0, magician_secret: 1, random_enemy: 1 }, 12345);
  const b = run({ random_type: 0, magician_secret: 1, random_enemy: 1 }, 12345);
  check(a.data.equals(b.data), '同 seed 输出不一致');
  check(a.summary === b.summary, '同 seed summary 不一致');
}

console.log(problems === 0 ? 'ALL OK' : `FAILED: ${problems} 处`);
process.exit(problems === 0 ? 0 : 1);
