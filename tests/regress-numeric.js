'use strict';
const run = require('/home/Yhys/aos-rom-randomizer/engine/lib/runRandomizer').run;
const enemyTables = require('/home/Yhys/aos-rom-randomizer/engine/lib/enemyTables');
const itemTables = require('/home/Yhys/aos-rom-randomizer/engine/lib/itemTables');
const fs = require('fs');
const orig = fs.readFileSync('/home/Yhys/aos-rom-randomizer/engine/rom/emcxyywq.gba');

let problems = 0;
const check = (cond, msg) => { if (!cond) { problems++; console.log(`  FAIL: ${msg}`); } };

// 1) exp_multiplier 单独生效（不依赖 random_enemy_exp）
console.log('== 1) exp_multiplier=3 单独 ==');
{
  const r = run({ random_type: 0, exp_multiplier: 3 }, 1);
  check(r.summary.includes('经验 ×3'), `summary 缺经验倍率: ${r.summary}`);
  const a = enemyTables.parseAll(orig);
  const b = enemyTables.parseAll(r.data);
  let ok = true;
  for (let i = 0; i < 113; i++) {
    if (a[i].exp !== 0 && b[i].exp !== a[i].exp * 3) { ok = false; console.log(`  敌${i} exp ${a[i].exp}->${b[i].exp}`); break; }
    if (a[i].exp === 0 && b[i].exp !== 0) { ok = false; break; }
    if (a[i].HP !== b[i].HP || a[i].atk !== b[i].atk || a[i].def !== b[i].def || a[i].MP !== b[i].MP) { ok = false; }
  }
  check(ok, 'exp 应为原值×3，其它字段不动');
}

// 2) enemy_stat_min/max 覆盖洗牌行为
console.log('== 2) random_enemy_hp + enemy_stat_min=0.5 max=2 ==');
{
  const r = run({ random_type: 0, random_enemy_hp: 1, enemy_stat_min: 0.5, enemy_stat_max: 2 }, 2);
  check(r.summary.includes('敌人体力按 0.5~2 倍缩放'), `summary 缺缩放: ${r.summary}`);
  const a = enemyTables.parseAll(orig);
  const b = enemyTables.parseAll(r.data);
  let ok = true;
  for (let i = 0; i < 113; i++) {
    if (b[i].HP < Math.floor(a[i].HP * 0.5) || b[i].HP > Math.ceil(a[i].HP * 2)) { ok = false; console.log(`  敌${i} HP ${a[i].HP}->${b[i].HP} 越界`); break; }
    if (a[i].atk !== b[i].atk || a[i].def !== b[i].def || a[i].MP !== b[i].MP || a[i].exp !== b[i].exp) { ok = false; console.log(`  敌${i} 其它字段被改`); break; }
  }
  check(ok, 'HP 缩放范围 0.5~2，其它字段不动');
}

// 3) boss_hp_scale
console.log('== 3) boss_hp_scale=0.5 ==');
{
  const r = run({ random_type: 0, boss_hp_scale: 0.5 }, 3);
  check(r.summary.includes('Boss 体力 ×0.5'), `summary: ${r.summary}`);
  const a = enemyTables.parseAll(orig);
  const b = enemyTables.parseAll(r.data);
  for (const i of [106,107,108,109,110,111,112]) {
    check(b[i].HP === Math.round(a[i].HP * 0.5), `Boss ${i} HP ${a[i].HP}->${b[i].HP} 应 ${Math.round(a[i].HP*0.5)}`);
  }
  check(b[0].HP === a[0].HP, '普通怪 HP 不应被改');
}

// 4) soul_probability_scale
console.log('== 4) soul_probability_scale=2 ==');
{
  const r = run({ random_type: 0, soul_probability_scale: 2 }, 4);
  check(r.summary.includes('魂掉率 ×2'), `summary: ${r.summary}`);
  const a = enemyTables.parseAll(orig);
  const b = enemyTables.parseAll(r.data);
  let ok = true;
  for (let i = 0; i < 113; i++) {
    if (a[i].soul !== 0 && a[i].soulRarity > 0) {
      const want = Math.max(1, Math.round(a[i].soulRarity / 2));
      if (b[i].soulRarity !== want) { ok = false; console.log(`  敌${i} rarity ${a[i].soulRarity}->${b[i].soulRarity} 应 ${want}`); break; }
    }
  }
  check(ok, '魂稀有度应按 1/2 缩放');
}

// 5) weapon_atk_min/max + random_item_stats_atk
console.log('== 5) random_item_stats_atk + weapon_atk_min=5 max=50 ==');
{
  const r = run({ random_type: 0, random_item_stats_atk: 1, weapon_atk_min: 5, weapon_atk_max: 50 }, 5);
  check(r.summary.includes('武器攻击随机 5~50'), `summary: ${r.summary}`);
  let ok = true;
  for (let i = 0; i < itemTables.WEAPON_COUNT; i++) {
    const off = itemTables.WEAPON_TABLE + i * 28 + 10;
    const v = r.data.readUInt16LE(off);
    if (v < 5 || v > 50) { ok = false; console.log(`  武器${i} atk=${v} 越界`); break; }
  }
  check(ok, '所有武器 atk 应在 5~50');
}

// 6) 确定性 & 独立生成
console.log('== 6) 确定性 ==');
{
  const a = run({ random_type: 0, exp_multiplier: 2, enemy_stat_min: 0.5, enemy_stat_max: 2, boss_hp_scale: 1.5 }, 7);
  const b = run({ random_type: 0, exp_multiplier: 2, enemy_stat_min: 0.5, enemy_stat_max: 2, boss_hp_scale: 1.5 }, 7);
  check(a.data.equals(b.data), '同 seed 输出不一致');
}

// 7) 数值项互不越界（不破坏其它模块）
console.log('== 7) 与怪物位置组合 ==');
{
  const r = run({ random_type: 0, exp_multiplier: 2, boss_hp_scale: 1.5, magician_secret: 1 }, 99);
  check(r.summary.includes('经验 ×2') && r.summary.includes('Boss 体力 ×1.5') && r.summary.includes('时之试炼'), `summary 组合缺失`);
  const roomEntities = require('/home/Yhys/aos-rom-randomizer/engine/lib/roomEntities');
  const ents = roomEntities.readRoomEntityList(r.data, 322);
  check(ents.filter(e=>e.type===1&&e.subtype===40).length === 3, 'room322 兔子丢失');
}

console.log(problems === 0 ? 'ALL OK' : `FAILED: ${problems} 处`);
process.exit(problems === 0 ? 0 : 1);
