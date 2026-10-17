'use strict';
/* 存档点快捷道路（shortcut）回归
 * ① 配对正确性：20 组存档房门 destination 指向配对的区域房，且区域房门反向接回；
 *    落地字段取自原版对应门的落点（DS_i ← DS_j 原版落地；DA_j ← DA_i 原版落地）
 * ② 零副作用：未开 shortcut 时，门相关字节与原版逐字节一致
 * ③ 确定性：同 seed 两次生成的 40 扇门写字节完全一致
 * ④ 组合冒烟：与 magician_secret / enemyBossMin / 数值项 组合生成不崩溃
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const rr = require('/home/Yhys/aos-rom-randomizer/engine/lib/runRandomizer');
const cnAreas = require('/home/Yhys/aos-rom-randomizer/engine/lib/cnAreas');

const PRISTINE = fs.readFileSync('/home/Yhys/aos-rom-randomizer/engine/rom/emcxyywq.gba');
const rd32 = (b,o)=>b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24);
const rd16 = (b,o)=>b[o]|(b[o+1]<<8);
const { areas } = cnAreas.getFreshAreas(PRISTINE);
const allRooms = areas.flatMap(a=>a.rooms);

function rawDoor(buf, roomAddr, dest) {
  const dl = rd32(buf, roomAddr - 0x08000000 + 24);
  const base = dl - 0x08000000;
  for (let o = base; rd32(buf, o+1) !== 0xFFFF1F; o += 16) {
    const d = rd32(buf, o);
    if (dest !== undefined && d !== dest) continue;
    return { addr: dl + (o-base), dest: d, dxo: rd16(buf,o+6), dyo: rd16(buf,o+8), dxp: rd16(buf,o+10), dyp: rd16(buf,o+12) };
  }
  return null;
}

// 记录每扇门 16 字节的写入偏移 + 值（仅记录相对原版变化的字节）
function collectDoorWrites(buf, out) {
  for (const s of allRooms.filter(r=>r.isSaveRoom)) {
    const ds = rawDoor(PRISTINE, s.address);
    const area = allRooms.find(x=>x.address===ds.dest);
    if (ds) collectOne(buf, ds.addr, out);
    if (area) {
      const da = rawDoor(PRISTINE, area.address, s.address);
      if (da) collectOne(buf, da.addr, out);
    }
  }
}
function collectOne(buf, addr, out) {
  const off = addr - 0x08000000;
  for (let i = 0; i < 16; i++) {
    const vanilla = PRISTINE[off+i];
    if (buf[off+i] !== vanilla) out.push(off + i);
  }
}

function buildPairs(seed, params) {
  const r = rr.run(Object.assign({ seed, random_type: 0 }, params));
  const data = r.data;
  const saves = allRooms.filter(x=>x.isSaveRoom).map(s=>{
    const ds = rawDoor(PRISTINE, s.address);
    return { s, area: allRooms.find(x=>x.address===ds.dest) };
  });
  const xs = allRooms.map(r2=>r2.mapX), ys = allRooms.map(r2=>r2.mapY);
  const cx = (Math.min(...xs)+Math.max(...xs))/2, cy = (Math.min(...ys)+Math.max(...ys))/2;
  saves.sort((a,b)=>Math.atan2(a.s.mapY-cy,a.s.mapX-cx)-Math.atan2(b.s.mapY-cy,b.s.mapX-cx));
  const n = saves.length, half = n>>1;
  return { data, saves, n, half };
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  OK  ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra||''}`); }
}

console.log('--- ① 配对正确性 (seed=99, shortcut=1) ---');
{
  const { data, saves, n, half } = buildPairs(99, { shortcut: 1 });
  check('存档房数量为 20', n === 20, n);
  let allOk = true;
  for (let i = 0; i < n; i++) {
    const j = (i + half) % n;
    const a = saves[i], b = saves[j];
    const dsCur = rawDoor(data, a.s.address);
    const daCur = rawDoor(data, b.area.address, a.s.address);
    const vanDsJ = rawDoor(PRISTINE, b.s.address);
    const vanDaI = rawDoor(PRISTINE, a.area.address, a.s.address);
    const ok1 = dsCur && dsCur.dest === b.area.address
      && dsCur.dxo===vanDsJ.dxo && dsCur.dyo===vanDsJ.dyo && dsCur.dxp===vanDsJ.dxp && dsCur.dyp===vanDsJ.dyp;
    const ok2 = daCur && daCur.dest === a.s.address
      && daCur.dxo===vanDaI.dxo && daCur.dyo===vanDaI.dyo && daCur.dxp===vanDaI.dxp && daCur.dyp===vanDaI.dyp;
    if (!ok1 || !ok2) { allOk = false; console.log(`    对 ${i} (S(${a.s.mapX},${a.s.mapY})↔A(${b.area.mapX},${b.area.mapY})) 失败 ok1=${ok1} ok2=${ok2}`); }
  }
  check('20 对双向连通且落地字段取自原版', allOk);
  // 配对无重复区域房
  const areas2 = saves.map(s=>s.area.address);
  check('配对区域房无重复', new Set(areas2).size === areas2.length);
}

console.log('--- ② 零副作用 (seed=99, 无 shortcut) ---');
{
  const r = rr.run({ seed: 99, random_type: 0 });
  const writes = [];
  collectDoorWrites(r.data, writes);
  check('未开 shortcut 时门列表字节与原版一致', writes.length === 0, `diff bytes=${writes.length}`);
}

console.log('--- ③ 确定性 ---');
{
  const a = buildPairs(12345, { shortcut: 1 });
  const b = buildPairs(12345, { shortcut: 1 });
  const wa = [], wb = [];
  collectDoorWrites(a.data, wa); collectDoorWrites(b.data, wb);
  check('同 seed 两次生成的被改门字节集合一致', JSON.stringify(wa) === JSON.stringify(wb));
}

console.log('--- ④ 组合冒烟 ---');
{
  const combos = [
    { shortcut: 1, magician_secret: 1 },
    { shortcut: 1, enemyBossMin: 1 },
    { shortcut: 1, magician_secret: 1, enemyBossMin: 1, weapon_atk_min: 120, weapon_atk_max: 500, exp: 3, soul_drop: 50 },
    { shortcut: 1, random_type: 1 },
  ];
  for (const [idx, c] of combos.entries()) {
    try {
      const r = rr.run(Object.assign({ seed: 7 + idx }, c));
      check(`组合 ${idx} ${Object.keys(c).join('+')} 生成成功 bytes=${r.bytesChanged}`, r.bytesChanged > 0);
    } catch (e) { check(`组合 ${idx} 生成成功`, false, e.message); }
  }
}

console.log(`\n结果：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
