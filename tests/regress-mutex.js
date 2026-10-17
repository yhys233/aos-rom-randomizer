'use strict';
const assert = require('assert');
const run = require('/home/Yhys/aos-rom-randomizer/engine/lib/runRandomizer').run;

const S = { seed: '626994', random_type: '0' };
const eq = (a, b) => Buffer.compare(a.data, b.data) === 0;

let passed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('ok - ' + name); }
  else throw new Error('FAIL - ' + name);
}

// 1) 经验组：随机 与 2~5倍 互斥（随机优先），输出与仅开随机一致
const expOnly = run({ ...S, random_enemy_exp: '1' });
const both = run({ ...S, random_enemy_exp: '1', mutil_exp: '1' });
const multOnly = run({ ...S, mutil_exp: '1' });
check('经验: 冲突时随机胜出(字节一致)', eq(expOnly, both));
check('经验: 单独2~5倍与单独随机不同', !eq(multOnly, expOnly));
check('经验: summary 含互斥说明', /【互斥】经验随机 已开启，自动关闭：随机2~5倍经验/.test(both.summary));
check('经验: 单独开2~5倍无互斥说明', !/【互斥】/.test(multOnly.summary));

// 2) 经验组：显式 2~5倍 覆盖 隐式随机（来自预设），2~5倍优先
const multWithImplicitRandom = run({ ...S, random_type: '2', random_enemy_exp: '1', mutil_exp: '1' });
// random_type=2 不隐式加 random_enemy_exp，故两者皆显式：优先级 随机 > 2~5倍
const explicitBoth = run({ ...S, random_enemy_exp: '1', mutil_exp: '1' });
check('经验: 双显式时按优先级（随机）', eq(expOnly, explicitBoth));

// 3) 经验组：exp_multiplier 数值型参与互斥（mutil_exp > exp_multiplier）
const m5 = run({ ...S, mutil_exp: '1', exp_multiplier: '5' });
check('经验: 2~5倍 与 经验倍率互斥(字节一致)', eq(multOnly, m5));
check('经验: 倍率冲突时 summary 说明', /自动关闭：经验倍率/.test(m5.summary));

// 4) 魂随机组：完全随机 与 颜色互换 互斥（完全随机优先）
const soulAll = run({ ...S, random_enemy_soul_all: '1' });
const soulBoth = run({ ...S, random_enemy_soul_all: '1', random_enemy_soul_red: '1', random_enemy_soul_blue: '1', random_enemy_soul_yellow: '1' });
check('魂: 完全随机 + 颜色互换 互斥(字节一致)', eq(soulAll, soulBoth));
check('魂: summary 含互斥说明', /【互斥】魂完全随机 已开启，自动关闭：红魂随机、蓝魂随机、黄魂随机/.test(soulBoth.summary));

// 5) 赠魂组：mainsoul 与 soul_start 互斥（mainsoul 优先）
const mainOnly = run({ ...S, mainsoul: '1' });
const giftBoth = run({ ...S, mainsoul: '1', soul_start: '1' });
const startOnly = run({ ...S, soul_start: '1' });
check('赠魂: mainsoul+soul_start 互斥(字节一致)', eq(mainOnly, giftBoth));
check('赠魂: 单独 soul_start 与 mainsoul 不同', !eq(startOnly, mainOnly));

// 6) 怪物位置组：random_enemy 与 enemy_everything 互斥去重
const reOnly = run({ ...S, random_enemy: '1' });
const reBoth = run({ ...S, random_enemy: '1', enemy_everything: '1' });
check('怪物: random_enemy+enemy_everything 互斥(字节一致)', eq(reOnly, reBoth));
check('怪物: summary 含互斥说明', /【互斥】怪物种类随机 已开启，自动关闭：万物皆为怪/.test(reBoth.summary));

// 7) 预设 type=3：互斥自动解析，输出与等价手动集一致
const preset3 = run({ ...S, random_type: '3' });
check('预设3: summary 含互斥说明(经验随机胜出)', /【互斥】经验随机 已开启，自动关闭：随机2~5倍经验/.test(preset3.summary));
check('预设3: 经验随机生效', /敌人经验随机/.test(preset3.summary));
check('预设3: 2~5倍未生效', !/经验随机2~5倍/.test(preset3.summary));

console.log('\nall ' + passed + ' mutex checks passed');
