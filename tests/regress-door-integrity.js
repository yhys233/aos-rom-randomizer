'use strict';
const fs = require('fs');
const run = require('/home/Yhys/aos-rom-randomizer/engine/lib/runRandomizer').run;
const readDataNumber = require('/home/Yhys/aos-rom-randomizer/engine/lib/cnAreas').readDataNumber;

const ROOM_TABLE_OFFSET = 0x4E52AC;
const ROOM_TABLE_COUNT = 355;

// 遍历房间表，收集所有真实门（步长 16，哨兵终止）
function collectDoors(buf) {
  const allDoors = [];
  for (let i = 0; i < ROOM_TABLE_COUNT; i++) {
    const p = readDataNumber(buf, ROOM_TABLE_OFFSET + i * 4, 4);
    if ((p & 0xFF000000) !== 0x08000000) continue;
    // 房间头：+0x18 处为 doorList 指针（见 parseRoom）
    const dl = buf.readUInt32LE(p - 0x08000000 + 0x18);
    if (dl < 0x08000000 || dl > 0x09000000) continue;
    const dlo = dl - 0x08000000;
    for (let off = 0; ; off += 16) {
      const addr = dl + off;
      // 终止条件同 parseRoom：byte[+1..+3] == FF FF 1F
      if (buf.readUInt32LE(dlo + off + 1) >>> 8 === 0xFFFF1F) break;
      if (dlo + off + 14 > buf.length) break;
      const dst = buf.readUInt32LE(dlo + off);
      if (dst === 0xFFFF1F00 || dst === 0xFFFF1F01) break;
      if (dst < 0x08000000 || dst > 0x09000000) break;
      allDoors.push({ address: addr, destination: dst });
    }
  }
  return allDoors;
}

const ROM = '/home/Yhys/aos-rom-randomizer/engine/rom/emcxyywq.gba';
const orig = fs.readFileSync(ROM);

// 直接按门结构读取 destination 指向的门，验证可达性
function doorStructValid(buf, destPtr) {
  const off = destPtr - 0x08000000;
  if (off < 0 || off + 14 > buf.length) return { ok: false, why: '越界' };
  const d2 = buf.readUInt32LE(off);
  if (d2 === 0xFFFF1F00 || d2 === 0xFFFF1F01) return { ok: false, why: '哨兵(door list 越界)' };
  if (d2 < 0x08000000 || d2 > 0x09000000) return { ok: false, why: `destination2 非法 0x${d2.toString(16)}` };
  const x = buf[off + 4], y = buf[off + 5];
  if (x === 0xFF && y === 0xFF && buf[off + 6] === 0xFF && buf[off + 7] === 0xFF) {
    return { ok: false, why: '门数据全 FF(空/被覆盖)' };
  }
  return { ok: true };
}

function check(buf, label) {
  const allDoors = collectDoors(buf);
  const byAddr = new Map(allDoors.map(d => [d.address, d]));
  let bad = 0, total = 0, oneWay = 0;
  const badSamples = [];
  for (const d of allDoors) {
    if (d.destination === 0xFFFF1F00 || d.destination === 0xFFFF1F01) continue;
    total++;
    const v = doorStructValid(buf, d.destination);
    if (!v.ok) {
      bad++;
      if (badSamples.length < 5) badSamples.push(`门 ${d.address.toString(16)} -> ${d.destination.toString(16)} [${v.why}]`);
      continue;
    }
    // 双向一致性：目标门 B 的 destination 应指回本门（单向门仅计数，不判坏）
    const d2off = d.destination - 0x08000000;
    const d2 = buf.readUInt32LE(d2off);
    if ((d2 !== 0xFFFF1F00 && d2 !== 0xFFFF1F01) && d2 !== d.address) {
      oneWay++;
    }
  }
  const status = bad === 0 ? 'OK' : `FAIL(${bad}/${total} 坏门)`;
  console.log(`[${label}] doors=${total} 坏门=${bad} 单向门=${oneWay} -> ${status}`);
  badSamples.forEach(s => console.log('    ' + s));
  return bad;
}

let failed = 0;
const S = { seed: '626994' };

failed += check(orig, '原版');

// 不开地图随机
failed += check(run({ ...S, random_type: '0' }).data, '无地图随机');

// 三种地图随机类型（含默认 type2）
for (const t of [2, 1, 3]) {
  const r = run({ ...S, random_type: '0', random_map: '1', random_map_type: String(t), random_item_weapon: '1', random_item_armor: '1', random_item_accessory: '1', random_item_item: '1' });
  failed += check(r.data, `地图随机 type${t} (${r.summary.split('\n')[1] || ''})`);
}

// 全功能组合（预设 type3）
const p3 = run({ ...S, random_type: '3' });
failed += check(p3.data, '预设全开 type3');

console.log(failed === 0 ? '\nALL DOOR INTEGRITY OK' : `\n${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
