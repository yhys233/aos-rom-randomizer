'use strict';
const fs = require('fs');
const rr = require('/home/Yhys/aos-rom-randomizer/engine/lib/runRandomizer');
const cnAreas = require('/home/Yhys/aos-rom-randomizer/engine/lib/cnAreas');
const PRISTINE = fs.readFileSync(rr.ROM_PATH);

const oldError = console.error;
console.error = () => {};

function read16(d, off) { return d[off] | d[off + 1] << 8; }
function read32(d, off) { return d[off] | d[off + 1] << 8 | d[off + 2] << 16 | d[off + 3] << 24; }

function parseDoorStates(data) {
  const { areas } = cnAreas.getFreshAreas(data);
  const rooms = areas.flatMap(a => a.rooms);
  const roomByAddr = new Map(rooms.map(r => [r.address, r]));
  const states = [];
  rooms.forEach(room => {
    room.doors.filter(d => !d.isFakeDoor).forEach(d => {
      const destRoom = roomByAddr.get(d.destination);
      states.push({
        address: d.address,
        dest: d.destination,
        srcArea: room._area,
        destArea: destRoom ? destRoom._area : -1,
        crossArea: destRoom ? destRoom._area !== room._area : false,
      });
    });
  });
  return states;
}

let failures = 0;
function check(name, cond, detail) {
  const status = cond ? 'OK' : 'FAIL';
  if (!cond) failures++;
  console.log(`  ${status}  ${name}${detail ? ' | ' + detail : ''}`);
}

console.log('== 1) 三档确定性 ==');
const seeds = [7, 99];
for (const seed of seeds) {
  for (const t of [1, 2, 3]) {
    const a = rr.run({ seed, random_type: 2, random_map_type: t }).data;
    const b = rr.run({ seed, random_type: 2, random_map_type: t }).data;
    let diff = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
    check(`map_type=${t} seed=${seed} 同种子两次输出一致`, diff === 0, `diff=${diff}`);
  }
}

console.log('== 2) 门改写范围（type2 只区域内 / type1、3 跨区域） ==');
{
  const pristineDoors = parseDoorStates(PRISTINE);
  const pristineByAddr = new Map(pristineDoors.map(d => [d.address, d]));
  for (const t of [1, 2, 3]) {
    const r = rr.run({ seed: 99, random_type: 2, random_map_type: t });
    const cur = parseDoorStates(r.data);
    let changed = 0;
    let crossChanged = 0;
    let intraChanged = 0;
    cur.forEach(d => {
      const old = pristineByAddr.get(d.address);
      if (old.dest !== d.dest) {
        changed++;
        if (d.crossArea) crossChanged++;
        else intraChanged++;
      }
    });
    check(`map_type=${t} 改写门数>0`, changed > 0, `改写=${changed} (跨区=${crossChanged} 区内=${intraChanged})`);
    if (t === 2) {
      check('map_type=2 无跨区改写（区域边界保持）', crossChanged === 0, `跨区改写=${crossChanged}`);
    } else {
      check(`map_type=${t} 存在跨区改写`, crossChanged > 0, `跨区改写=${crossChanged}`);
    }
  }
}

console.log('== 3) 与原版零副作用（未启用地图随机时门数据与原版一致） ==');
{
  const r = rr.run({ seed: 99, random_type: 0 });
  const cur = parseDoorStates(r.data);
  const pristineDoors = parseDoorStates(PRISTINE);
  const pristineByAddr = new Map(pristineDoors.map(d => [d.address, d]));
  let changed = 0;
  cur.forEach(d => { if (pristineByAddr.get(d.address).dest !== d.dest) changed++; });
  check('random_type=0 不改写任何门', changed === 0, `改写=${changed}`);
}

console.log('== 4) 与 shortcut / magician_secret 组合冒烟 ==');
{
  const combos = [
    { seed: 11, random_type: 2, random_map_type: 1, shortcut: 1 },
    { seed: 11, random_type: 2, random_map_type: 2, shortcut: 1, magician_secret: 1 },
    { seed: 11, random_type: 2, random_map_type: 3, shortcut: 1, magician_secret: 1 },
  ];
  for (const c of combos) {
    try {
      const r = rr.run(c);
      check(`map_type=${c.random_map_type}+shortcut${c.magician_secret ? '+magician_secret' : ''} 生成成功`, r.bytesChanged > 0, `bytes=${r.bytesChanged}`);
    } catch (e) {
      check(`map_type=${c.random_map_type}+组合 生成失败`, false, e.message);
    }
  }
}

console.log('');
console.log(`结果：${failures === 0 ? 'ALL OK' : failures + ' 失败'}`);
console.error = oldError;
process.exit(failures ? 1 : 0);
