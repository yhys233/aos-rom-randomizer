'use strict';
const run = require('/home/Yhys/aos-rom-randomizer/engine/lib/runRandomizer').run;
const roomEntities = require('/home/Yhys/aos-rom-randomizer/engine/lib/roomEntities');
const fs = require('fs');
const orig = fs.readFileSync('/home/Yhys/aos-rom-randomizer/engine/rom/emcxyywq.gba');

const rd32 = (buf, o) => buf[o] | (buf[o+1]<<8) | (buf[o+2]<<16) | (buf[o+3]<<24);
const ROOM_TABLE = roomEntities.ROOM_TABLE;
const isChaos = (mx,my) => ((mx>=128&&mx<=141)||(mx>=1&&mx<=14)) && my>=18 && my<=22;
const isDataPage = (p) => p >= 0x080E0000 && p < 0x08100000;

function roomPages(buf, i) {
  const rp = rd32(buf, ROOM_TABLE + i*4);
  if ((rp & 0xFF000000) !== 0x08000000) return null;
  const m = rp - 0x08000000;
  const pal = rd32(buf, m+16);
  if (pal < 0x08000000 || pal > 0x09000000) return null;
  const po = pal - 0x08000000;
  return { mx: buf[m+34], my: buf[m+35], pal, pages: [0,2].map(k => rd32(buf, po+k*4)) };
}

for (const seed of [99, 7]) {
  const r = run({ random_type: 0, light_chaos: 1 }, seed);
  const d = r.data;
  let problems = 0;
  const check = (cond, msg) => { if (!cond) { problems++; console.log(`  FAIL: ${msg}`); } };

  const origPages = {};
  const newMap = {};
  let chaosRooms = 0;
  for (let i = 0; i < roomEntities.ROOM_COUNT; i++) {
    const a = roomPages(orig, i);
    const b = roomPages(d, i);
    if (!a || !b) continue;
    if (isChaos(a.mx, a.my)) {
      chaosRooms++;
      for (let k = 0; k < 2; k++) {
        const ap = a.pages[k];
        const bp = b.pages[k];
        if (ap === 0) continue;
        if (!isDataPage(ap)) continue;
        check(bp !== ap, `room ${i} 页[${k}] 指针未改`);
        const aOff = ap - 0x08000000;
        const bOff = bp - 0x08000000;
        check(d.readUInt16LE(bOff) === 0x0400, `room ${i} 页[${k}] 头部损坏`);
        check(d.readUInt16LE(bOff + 2) === orig.readUInt16LE(aOff + 2), `room ${i} 页[${k}] count 损坏`);
        origPages[ap] = aOff;
        if (newMap[ap] === undefined) newMap[ap] = bOff;
      }
    } else {
      check(a.pal === b.pal && a.pages[0] === b.pages[0] && a.pages[1] === b.pages[1],
        `非混沌房间 ${i} 调色板被改`);
    }
  }
  check(chaosRooms >= 40, `混沌房间数=${chaosRooms}`);
  check(Object.keys(origPages).length === 17, `不同调色板页=${Object.keys(origPages).length} 应为 17`);

  // 验证提亮：新副本逐通道 >= 原页，且绝大多数通道确实变亮
  let sampled = 0, brightened = 0, dimmed = 0;
  for (const apKey of Object.keys(origPages)) {
    const ap = parseInt(apKey);
    const aOff = origPages[apKey];
    const count = orig.readUInt16LE(aOff + 2);
    const bOff = newMap[ap];
    if (bOff === undefined) { check(false, `页 0x${ap.toString(16)} 找不到新副本`); continue; }
    for (let k = 0; k < count * 32; k += 2) {
      const ca = orig.readUInt16LE(aOff + 4 + k);
      const cb = d.readUInt16LE(bOff + 4 + k);
      for (let ch = 0; ch < 3; ch++) {
        const shift = ch * 5;
        const va = (ca >> shift) & 31;
        const vb = (cb >> shift) & 31;
        sampled++;
        if (vb > va) brightened++;
        if (vb < va) dimmed++;
      }
    }
  }
  check(dimmed === 0, `有 ${dimmed} 个通道被调暗`);
  check(brightened > sampled * 0.5, `提亮通道比例 ${brightened}/${sampled} 过低`);

  const seen = new Set();
  for (let i = roomEntities.FREE_SPACE_ADDR; i < 0x800000; i++) if (d[i] !== 0xFF) seen.add(i);
  console.log(`seed ${seed}: chaos rooms=${chaosRooms} pages=${Object.keys(origPages).length} brightened=${brightened}/${sampled} free bytes=${seen.size}  ${problems===0 ? 'ALL OK' : problems + ' PROBLEMS'}`);
}
