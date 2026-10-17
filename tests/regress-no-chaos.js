'use strict';
const fs = require('fs');
const rr = require('/home/Yhys/aos-rom-randomizer/engine/lib/runRandomizer');
const cnAreas = require('/home/Yhys/aos-rom-randomizer/engine/lib/cnAreas');
const PRISTINE = fs.readFileSync(rr.ROM_PATH);

const oldError = console.error;
console.error = () => {};

function parseDoorStates(data) {
  const { areas } = cnAreas.getFreshAreas(data);
  const rooms = areas.flatMap(a => a.rooms);
  const roomByAddr = new Map(rooms.map(r => [r.address, r]));
  const states = [];
  rooms.forEach(room => {
    room.doors.filter(d => !d.isFakeDoor).forEach(d => {
      states.push({ address: d.address, dest: d.destination, srcArea: room._area });
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

// 混沌区（area 11）的所有真实门地址
const vanillaStates = parseDoorStates(PRISTINE);
const chaosDoors = vanillaStates.filter(s => s.srcArea === 11);
const chaosAddrs = new Set(chaosDoors.map(d => d.address));

console.log(`== 混沌区概况 ==  混沌门数=${chaosDoors.length}`);
console.log('== 1) no_chaos=1：混沌区门零改动，其余区域仍洗牌 ==');
for (const t of [1, 2, 3]) {
  const r = rr.run({ seed: 11, random_type: 2, random_map_type: t, random_map_no_chaos: 1 });
  const cur = parseDoorStates(r.data);
  const vanillaByAddr = new Map(vanillaStates.map(d => [d.address, d]));
  let chaosChanged = 0;
  let otherChanged = 0;
  cur.forEach(d => {
    const old = vanillaByAddr.get(d.address);
    if (old.dest !== d.dest) {
      if (chaosAddrs.has(d.address)) chaosChanged++;
      else otherChanged++;
    }
  });
  check(`map_type=${t} 混沌区门零改动`, chaosChanged === 0, `混沌改写=${chaosChanged}`);
  check(`map_type=${t} 非混沌区仍洗牌`, otherChanged > 0, `非混沌改写=${otherChanged}`);
}

console.log('== 2) no_chaos=0：混沌区门照常参与（type1/3） ==');
for (const t of [1, 3]) {
  const r = rr.run({ seed: 11, random_type: 2, random_map_type: t });
  const cur = parseDoorStates(r.data);
  const vanillaByAddr = new Map(vanillaStates.map(d => [d.address, d]));
  let chaosChanged = 0;
  cur.forEach(d => {
    const old = vanillaByAddr.get(d.address);
    if (chaosAddrs.has(d.address) && old.dest !== d.dest) chaosChanged++;
  });
  check(`map_type=${t} 混沌区门有参与`, chaosChanged > 0, `混沌改写=${chaosChanged}`);
}

console.log('== 3) 多种子生成成功 ==');
const types = [1, 2, 3];
const seeds = [1, 2, 3, 42, 123, 777];
for (const t of types) {
  let ok = 0;
  for (const s of seeds) {
    try {
      rr.run({ seed: s, random_type: 2, random_map_type: t, random_map_no_chaos: 1 });
      ok++;
    } catch (e) {}
  }
  check(`map_type=${t} no_chaos ${seeds.length} 种子全成功`, ok === seeds.length, `${ok}/${seeds.length}`);
}

console.log('== 4) 确定性 ==');
for (const t of types) {
  const a = rr.run({ seed: 99, random_type: 2, random_map_type: t, random_map_no_chaos: 1 });
  const b = rr.run({ seed: 99, random_type: 2, random_map_type: t, random_map_no_chaos: 1 });
  check(`map_type=${t} 同种子两次输出一致`, a.data.equals(b.data));
}

console.log('== 5) 与 shortcut / magician_secret 组合 ==');
for (const t of types) {
  try {
    const r = rr.run({ seed: 11, random_type: 2, random_map_type: t, random_map_no_chaos: 1, shortcut: 1, magician_secret: 1 });
    check(`map_type=${t}+shortcut+magician_secret+no_chaos 成功`, r.bytesChanged > 0, `bytes=${r.bytesChanged}`);
  } catch (e) {
    check(`map_type=${t}+组合 失败`, false, e.message);
  }
}

console.log('== 6) no_use / no_bossrush：结构保证 + summary ==');
for (const t of [1, 2, 3]) {
  for (const opts of [
    { random_map_no_use: 1 },
    { random_map_no_bossrush: 1 },
    { random_map_no_use: 1, random_map_no_bossrush: 1 },
  ]) {
    try {
      const a = rr.run({ seed: 11, random_type: 2, random_map_type: t });
      const b = rr.run({ seed: 11, random_type: 2, random_map_type: t, ...opts });
      check(`map_type=${t} ${JSON.stringify(opts)} 输出与不开启完全一致`, a.data.equals(b.data));
    } catch (e) {
      check(`map_type=${t} ${JSON.stringify(opts)} 失败`, false, e.message);
    }
  }
  try {
    const r = rr.run({ seed: 11, random_type: 2, random_map_type: t, random_map_no_use: 1, random_map_no_bossrush: 1 });
    const s = r.summary;
    check(`map_type=${t} summary 含未开发+BossRush 说明`, s.includes('未开发区域保持原样') && s.includes('BossRush地图保持原样'), s);
  } catch (e) {
    check(`map_type=${t} summary 检查失败`, false, e.message);
  }
}

console.log('');
console.log(`结果：${failures === 0 ? 'ALL OK' : failures + ' 失败'}`);
console.error = oldError;
process.exit(failures ? 1 : 0);
