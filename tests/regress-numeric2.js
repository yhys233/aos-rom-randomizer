'use strict';
const run = require('/home/Yhys/aos-rom-randomizer/engine/lib/runRandomizer').run;
const enemyTables = require('/home/Yhys/aos-rom-randomizer/engine/lib/enemyTables');
const itemTables = require('/home/Yhys/aos-rom-randomizer/engine/lib/itemTables');
const fs = require('fs');
const orig = fs.readFileSync('/home/Yhys/aos-rom-randomizer/engine/rom/emcxyywq.gba');

let problems = 0;
const check = (cond, msg) => { if (!cond) { problems++; console.log(`  FAIL: ${msg}`); } };

// 1) item_probability_scale=2
console.log('== 1) item_probability_scale=2 ==');
{
  const r = run({ random_type: 0, item_probability_scale: 2 }, 1);
  check(r.summary.includes('道具掉率 ×2'), `summary: ${r.summary}`);
  const a = enemyTables.parseAll(orig);
  const b = enemyTables.parseAll(r.data);
  let ok = true;
  for (let i = 0; i < 113; i++) {
    if (a[i].item1Rarity > 0) {
      const want = Math.max(1, Math.round(a[i].item1Rarity / 2));
      if (b[i].item1Rarity !== want) { ok = false; console.log(`  敌${i} item1 rarity ${a[i].item1Rarity}->${b[i].item1Rarity} 应 ${want}`); break; }
    }
  }
  check(ok, 'item1 稀有度应按 1/2 缩放');
}

// 2) armor_def_min/max
console.log('== 2) random_item_stats_def + armor_def_min=3 max=30 ==');
{
  const r = run({ random_type: 0, random_item_stats_def: 1, armor_def_min: 3, armor_def_max: 30 }, 2);
  check(r.summary.includes('防具防御随机 3~30'), `summary: ${r.summary}`);
  let ok = true;
  for (let i = 0; i < itemTables.ARMOR_COUNT; i++) {
    const off = itemTables.ARMOR_TABLE + i * 20 + 11;
    const v = r.data.readUInt16LE(off);
    if (v < 3 || v > 30) { ok = false; console.log(`  防具${i} def=${v} 越界`); break; }
  }
  check(ok, '所有防具 def 应在 3~30');
}

// 3) soul_atk_min/max
console.log('== 3) random_soul_stats_red + soul_atk_min=5 max=40 ==');
{
  const r = run({ random_type: 0, random_soul_stats_red: 1, soul_atk_min: 5, soul_atk_max: 40 }, 3);
  check(r.summary.includes('红魂攻击随机 5~40'), `summary: ${r.summary}`);
  let ok = true;
  for (let i = 0; i < itemTables.RED_SOUL_COUNT; i++) {
    const off = itemTables.RED_SOUL_TABLE + i * 16 + 10;
    const v = r.data.readUInt16LE(off);
    if (v < 5 || v > 40) { ok = false; console.log(`  红魂${i} atk=${v} 越界`); break; }
  }
  check(ok, '所有红魂 atk 应在 5~40');
}

// 4) 确定性
console.log('== 4) 确定性 ==');
{
  const a = run({ random_type: 0, item_probability_scale: 2, random_item_stats_def: 1, armor_def_min: 3, armor_def_max: 30, random_soul_stats_red: 1, soul_atk_min: 5, soul_atk_max: 40 }, 7);
  const b = run({ random_type: 0, item_probability_scale: 2, random_item_stats_def: 1, armor_def_min: 3, armor_def_max: 30, random_soul_stats_red: 1, soul_atk_min: 5, soul_atk_max: 40 }, 7);
  check(a.data.equals(b.data), '同 seed 输出不一致');
}

console.log(problems === 0 ? 'ALL OK' : `FAILED: ${problems} 处`);
process.exit(problems === 0 ? 0 : 1);
