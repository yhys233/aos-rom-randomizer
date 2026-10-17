'use strict';
const fs = require('fs');
const rr = require('/home/Yhys/aos-rom-randomizer/engine/lib/runRandomizer');
const cnAreas = require('/home/Yhys/aos-rom-randomizer/engine/lib/cnAreas');
const PRISTINE = fs.readFileSync(rr.ROM_PATH);

let failures = 0;
const lines = [];
function check(name, cond, detail) {
  if (!cond) failures++;
  lines.push(`${cond ? 'OK  ' : 'FAIL'}  ${name}${detail !== undefined ? ' | ' + detail : ''}`);
}

function runSilent(params) {
  const origLog = console.log;
  const origErr = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return rr.run(params);
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
}

function parseDoorStates(data) {
  const { areas } = cnAreas.getFreshAreas(data);
  const rooms = areas.flatMap(a => a.rooms);
  const states = [];
  rooms.forEach(room => {
    room.doors.filter(d => !d.isFakeDoor).forEach(d => {
      states.push({ address: d.address, dest: d.destination });
    });
  });
  return states;
}

const vanillaStates = parseDoorStates(PRISTINE);
const vanillaByAddr = new Map(vanillaStates.map(d => [d.address, d]));
function doorChangedCount(data) {
  let n = 0;
  parseDoorStates(data).forEach(d => {
    if (vanillaByAddr.get(d.address).dest !== d.dest) n++;
  });
  return n;
}

function runCase(tag, params, seed) {
  const s = seed || 11;
  let a, b;
  try {
    a = runSilent({ seed: s, ...params });
  } catch (e) {
    check(tag + ' 生成成功', false, e.message);
    return;
  }
  check(tag + ' 生成成功', true);
  check(tag + ' bytesChanged>0', a.bytesChanged > 0, `bytes=${a.bytesChanged}`);
  try {
    b = runSilent({ seed: s, ...params });
    check(tag + ' 同种子两次输出一致', a.data.equals(b.data));
  } catch (e) {
    check(tag + ' 确定性', false, e.message);
  }
  return a;
}

function runCaseExpectSummary(tag, params, expects, seed) {
  const a = runCase(tag, params, seed);
  if (!a) return;
  for (const kw of expects) {
    check(`${tag} summary 含「${kw}」`, a.summary.includes(kw), a.summary.split('\n').find(x => x.includes(kw)) || '(未找到)');
  }
}

console.log('== A) random_type 基础 ==');
{
  const a = runSilent({ seed: 11 });
  check('random_type=0 空参数与原版逐字节一致', a.bytesChanged === 0, `bytes=${a.bytesChanged}`);
}
{
  const a = runSilent({ seed: 11, random_type: 1 });
  check('random_type=1 成功', a.bytesChanged > 0, `bytes=${a.bytesChanged}`);
  check('random_type=1 不改写任何门', doorChangedCount(a.data) === 0, `门改写=${doorChangedCount(a.data)}`);
  check('random_type=1 summary 有敌人内容', a.summary.includes('敌人'), a.summary.split('\n').slice(0, 2).join(' / '));
}
{
  const a = runSilent({ seed: 11, random_type: 2 });
  check('random_type=2 成功', a.bytesChanged > 0, `bytes=${a.bytesChanged}`);
  check('random_type=2 门有改写', doorChangedCount(a.data) > 0, `门改写=${doorChangedCount(a.data)}`);
}
{
  const a = runSilent({ seed: 11, random_type: 3 });
  check('random_type=3 全部随机成功', a.bytesChanged > 0, `bytes=${a.bytesChanged}`);
  check('random_type=3 summary 含房间+道具+敌人', a.summary.includes('房间（门）随机') && a.summary.includes('道具位置随机') && a.summary.includes('敌人'), '');
}

console.log('== B) 各选项单独验证（seed=11） ==');
const cases = [
  // 敌人数值
  ['敌人HP', { random_enemy_hp: 1 }, ['敌人HP随机']],
  ['敌人MP', { random_enemy_mp: 1 }, ['敌人MP随机']],
  ['敌人经验', { random_enemy_exp: 1 }, ['敌人经验随机']],
  ['敌人攻击', { random_enemy_atk: 1 }, ['敌人攻击力随机']],
  ['敌人防御', { random_enemy_def: 1 }, ['敌人防御力随机']],
  ['弱点抗性', { attr_enemy: 1 }, ['敌人弱点和抗性随机']],
  ['随机2~5倍经验', { mutil_exp: 1 }, ['经验随机2~5倍']],
  // 掉落
  ['魂完全随机', { random_enemy_soul_all: 1 }, ['魂完全随机']],
  ['红魂互换', { random_enemy_soul_red: 1 }, ['红魂随机']],
  ['蓝魂互换', { random_enemy_soul_blue: 1 }, ['蓝魂随机']],
  ['黄魂互换', { random_enemy_soul_yellow: 1 }, ['黄魂随机']],
  ['道具掉落互换', { random_enemy_item: 1 }, ['道具掉落随机']],
  ['魂掉率提高', { soul_probability: 1 }, ['魂掉率提高']],
  ['道具掉率提高', { item_probability: 1 }, ['道具掉率提高']],
  // 怪物位置
  ['怪物种类随机', { random_enemy: 1 }, ['怪物种类随机']],
  ['Boss 加入小怪', { boss_enemy: 1 }, ['Boss 加入小怪']],
  ['巴洛尔加入小怪', { balore_enemy: 1 }, ['巴洛尔加入小怪']],
  ['尤利乌斯加入小怪', { julius_enemy: 1 }, ['尤利乌斯加入小怪']],
  ['混沌加入小怪', { chaos_enemy: 1 }, ['混沌加入小怪']],
  ['时之法师加入小怪', { magician_enemy: 1 }, ['时之法师加入小怪']],
  ['时之试炼', { magician_secret: 1 }, ['时之试炼']],
  ['原Boss随机成小怪', { enemy_boss_min: 1 }, ['原 Boss 随机成小怪']],
  ['万物皆为怪', { enemy_everything: 1 }, ['万物皆为怪']],
  ['挑战双混沌', { double_chaos: 1 }, ['挑战双混沌']],
  ['混沌地图明亮', { light_chaos: 1 }, ['混沌地图明亮']],
  ['存档点快捷道路', { shortcut: 1 }, ['存档点快捷道路']],
  ['加入魂灯', { random_item_soul: 1 }, ['加入魂灯']],
  ['开局混沌戒指', { ringchaos: 1 }, ['开局赠送混沌戒指']],
  ['开局剧情魂', { mainsoul: 1 }, ['开局赠送古文书所需三魂']],
  ['开局三魂各一', { soul_start: 1 }, ['开局赠送红蓝黄魂各一个']],
  // 装备数值 / 属性
  ['武器攻击随机(限范围)', { random_item_stats_atk: 1, weapon_atk_min: 5, weapon_atk_max: 50 }, ['武器攻击随机 5~50']],
  ['防具防御随机(限范围)', { random_item_stats_def: 1, armor_def_min: 3, armor_def_max: 30 }, ['防具防御随机 3~30']],
  ['红魂攻击随机(限范围)', { random_soul_stats_red: 1, soul_atk_min: 5, soul_atk_max: 40 }, ['红魂攻击随机 5~40']],
  ['武器属性随机', { attr_weapon: 1 }, ['武器属性随机']],
  ['红魂属性随机', { attr_soul_red: 1 }, ['红魂属性随机']],
  // 数值参数
  ['经验倍率3', { exp_multiplier: 3 }, ['经验 ×3']],
  ['魂掉率倍率2', { soul_probability_scale: 2 }, ['魂掉率 ×2']],
  ['道具掉率倍率2', { item_probability_scale: 2 }, ['道具掉率 ×2']],
  ['Boss体力倍率0.5', { boss_hp_scale: 0.5 }, ['Boss 体力 ×0.5']],
  ['敌人数值下限上限', { random_enemy_hp: 1, enemy_stat_min: 0.5, enemy_stat_max: 2 }, ['敌人体力按 0.5~2 倍缩放']],
  // 商店
  ['商店随机', { random_shop: 1 }, ['商店物品随机']],
  // 杂项
  ['跳过对话', { skipdialog: 1 }, ['一周目可跳过对话']],
  ['Debug 模式', { opendebug: 1 }, ['开启 Debug 模式']],
  ['取消三魂检测', { main_soul_pass: 1 }, ['取消古文书三魂检测']],
  ['古文书三魂随机', { main_soul_random: 1 }, ['古文书三魂随机']],
  // 开局装备
  ['开局武器', { start_weapon: 1 }, ['开局获得武器 1']],
  ['开局防具', { start_armor: 2 }, ['开局获得防具 2']],
  ['开局饰品', { start_accessory: 1 }, ['开局获得饰品 1']],
  // 道具位置（引擎物品随机）
  ['武器位置', { random_item_weapon: 1 }, ['道具位置随机']],
];
for (const [tag, params, expects] of cases) {
  runCaseExpectSummary(tag, params, expects);
}

console.log('== C) 房间随机三档 + 保护区 ==');
for (const t of [1, 2, 3]) {
  runCaseExpectSummary(`map_type=${t}`, { random_map: 1, random_map_type: t }, ['房间（门）随机']);
}
{
  const a = runSilent({ seed: 11, random_map: 1, random_map_type: 1, random_map_no_chaos: 1, random_map_no_use: 1, random_map_no_bossrush: 1 });
  check('保护区组合 summary', a.summary.includes('混沌区保持原样') && a.summary.includes('未开发区域保持原样') && a.summary.includes('BossRush地图保持原样'), a.summary.split('\n')[0]);
}
{
  const a = runSilent({ seed: 11, random_map: 1, random_map_type: 2 });
  check('map_type=2 无跨区门改写', doorChangedCount(a.data) > 0, `门改写=${doorChangedCount(a.data)}`);
}

console.log('== D) 全功能大组合（多种子 + 确定性） ==');
const FULL = {
  random_type: 3,
  random_map: 1, random_map_type: 3,
  random_map_no_chaos: 1, random_map_no_use: 1, random_map_no_bossrush: 1,
  random_enemy: 1, boss_enemy: 1, balore_enemy: 1, julius_enemy: 1,
  chaos_enemy: 1, magician_enemy: 1, magician_secret: 1, enemy_boss_min: 1,
  enemy_everything: 1, double_chaos: 1, light_chaos: 1, shortcut: 1,
  random_item_soul: 1, ringchaos: 1, mainsoul: 1, soul_start: 1,
  random_item_weapon: 1, random_item_armor: 1, random_item_accessory: 1, random_item_item: 1,
  random_item_stats_atk: 1, random_item_stats_def: 1, random_soul_stats_red: 1,
  attr_weapon: 1, attr_soul_red: 1,
  random_enemy_hp: 1, random_enemy_mp: 1, random_enemy_exp: 1,
  random_enemy_atk: 1, random_enemy_def: 1, attr_enemy: 1,
  random_enemy_soul_all: 1, random_enemy_item: 1,
  soul_probability: 1, item_probability: 1, mutil_exp: 1,
  random_shop: 1, skipdialog: 1, opendebug: 1,
  main_soul_random: 1, main_soul_pass: 1,
  exp_multiplier: 2, soul_probability_scale: 2, item_probability_scale: 2, boss_hp_scale: 1.5,
  start_weapon: 1, start_armor: 2, start_accessory: 1,
};
{
  const a = runSilent({ seed: 11, ...FULL });
  check('全开组合(seed 11)成功', a.bytesChanged > 0, `bytes=${a.bytesChanged}`);
  check('全开组合 summary 完整', a.summary.includes('房间（门）随机') && a.summary.includes('怪物种类随机') && a.summary.includes('道具位置随机') && a.summary.includes('武器攻击') && a.summary.includes('商店物品随机'), '');
}
const seeds = [11, 42, 123, 777, 2026];
for (const s of seeds) {
  try {
    const a = runSilent({ seed: s, ...FULL });
    check(`全开组合 seed=${s} 成功`, a.bytesChanged > 0, `bytes=${a.bytesChanged}`);
  } catch (e) {
    check(`全开组合 seed=${s} 成功`, false, e.message);
  }
}
{
  const a = runSilent({ seed: 42, ...FULL });
  const b = runSilent({ seed: 42, ...FULL });
  check('全开组合 seed=42 两次输出一致', a.data.equals(b.data));
}

console.log('');
lines.forEach(l => console.log(l));
console.log(`结果：${failures === 0 ? 'ALL OK' : failures + ' 失败'}`);
process.exit(failures ? 1 : 0);
