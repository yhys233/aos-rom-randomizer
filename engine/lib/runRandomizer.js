'use strict';

/**
 * CN 随机化编排器：把 UI 参数映射为引擎配置 + CN 各功能模块，生成随机 ROM。
 */

const fs = require('fs');
const path = require('path');

const DebugLevels = require('../vendor/debug/DebugLevels');
const Logger = require('../vendor/debug/Logger');
const Random = require('../vendor/utils/Random');

const cnAreas = require('./cnAreas');

const ROM_PATH = path.join(__dirname, '..', 'rom', 'emcxyywq.gba');

// 在引擎 require 之前，把 vendor/progression/Areas（写死的 NA 静态数组）
// 替换为 CN 版解析结果。引擎在模块加载时执行
//   const getFreshAreas = require('../progression/Areas')
// 捕获的是 require 返回值，因此必须先把 cache 替换好再加载引擎。
const areasModule = require.resolve('../vendor/progression/Areas');
require(areasModule);
require.cache[areasModule].exports = function getFreshCNAreas() {
  return cnAreas.getFreshAreas(fs.readFileSync(ROM_PATH)).areas;
};

const RandomizerEngine = require('../vendor/engine/RandomizerEngine');

const enemyTables = require('./enemyTables');
const itemTables = require('./itemTables');
const misc = require('./misc');
const roomEntities = require('./roomEntities');
const shop = require('./shop');

/**
 * 互斥组：数组顺序即优先级（靠前的优先），同一组内同一时间只允许一个分支生效。
 * 规则：
 *   - 用户显式传入的参数（raw params 中非 0）优先于 effectiveParams 按 random_type 隐式加上的；
 *   - 仍有多个活跃时（含多个显式或全部隐式），取组内优先级最高的，其余置 0；
 *   - 被关闭的分支记入互斥说明，随 summary 输出。
 */
const MUTEX_GROUPS = [
  {
    name: '魂随机',
    priority: ['random_enemy_soul_all', 'random_enemy_soul_red', 'random_enemy_soul_blue', 'random_enemy_soul_yellow'],
  },
  {
    name: '怪物位置',
    priority: ['random_enemy', 'enemy_everything'],
  },
  {
    name: '开局赠魂',
    priority: ['mainsoul', 'soul_start'],
  },
  {
    name: '魂掉率',
    priority: ['soul_probability', 'soul_probability_scale'],
  },
  {
    name: '道具掉率',
    priority: ['item_probability', 'item_probability_scale'],
  },
];

const MUTEX_KEY_NAMES = {
  random_enemy_exp: '经验随机',
  mutil_exp: '随机2~5倍经验',
  exp_multiplier: '经验倍率',
  random_enemy_soul_all: '魂完全随机',
  random_enemy_soul_red: '红魂随机',
  random_enemy_soul_blue: '蓝魂随机',
  random_enemy_soul_yellow: '黄魂随机',
  random_enemy: '怪物种类随机',
  enemy_everything: '万物皆为怪',
  mainsoul: '获得剧情魂',
  soul_start: '开局赠魂',
  soul_probability: '魂掉率提高',
  soul_probability_scale: '魂掉率倍率',
  item_probability: '道具掉率提高',
  item_probability_scale: '道具掉率倍率',
};

// 数值型（0 表示关闭）的互斥成员
const MUTEX_NUMERIC_KEYS = new Set(['exp_multiplier', 'soul_probability_scale', 'item_probability_scale']);

function mutexActive(obj, key) {
  return MUTEX_NUMERIC_KEYS.has(key) ? Number(obj[key]) > 0 : !!obj[key];
}

/**
 * 解析互斥：就地修改 eff，把每组内低优先级的活跃分支置 0。
 * @param {Object} eff - effectiveParams 结果（会被修改）
 * @param {Object} raw - 归一化后的原始参数（判断显式指定用）
 * @returns {string[]} 互斥说明（用于 summary）
 */
function resolveMutex(eff, raw) {
  const notes = [];
  for (const group of MUTEX_GROUPS) {
    const active = group.priority.filter(k => mutexActive(eff, k));
    if (active.length <= 1) {
      continue;
    }
    const explicit = active.filter(k => mutexActive(raw, k));
    const winner = explicit.length ? explicit[0] : active[0];
    const losers = active.filter(k => k !== winner);
    for (const k of losers) {
      eff[k] = 0;
    }
    const winName = MUTEX_KEY_NAMES[winner] || winner;
    const loseNames = losers.map(k => MUTEX_KEY_NAMES[k] || k);
    notes.push(`【互斥】${winName} 已开启，自动关闭：${loseNames.join('、')}（同组功能不能同时开启）`);
  }
  return notes;
}

/**
 * 根据参数判断各类随机是否启用。
 */
function plan(params) {
  const type = Number(params.random_type);
  const any = (...keys) => keys.some(k => !!params[k]);
  const enemyFlags = ['random_enemy_hp', 'random_enemy_mp', 'random_enemy_exp',
    'random_enemy_atk', 'random_enemy_def', 'attr_enemy', 'random_enemy_soul_all',
    'random_enemy_soul_red', 'random_enemy_soul_blue', 'random_enemy_soul_yellow',
    'random_enemy_item', 'soul_probability', 'item_probability', 'mutil_exp',
    'exp_multiplier', 'soul_probability_scale', 'item_probability_scale',
    'enemy_stat_min', 'enemy_stat_max', 'boss_hp_scale'];
  const enemyPosFlags = ['random_enemy', 'boss_enemy', 'balore_enemy',
    'julius_enemy', 'chaos_enemy', 'magician_enemy', 'magician_secret',
    'enemy_boss_min', 'enemy_everything', 'double_chaos', 'light_chaos',
    'shortcut', 'random_item_soul', 'ringchaos', 'mainsoul',
    'soul_start'];
  // start_* 取值为装备 ID（非 0 即生效），不能套用 === 1 判断
  const startEquipFlags = ['start_weapon', 'start_armor', 'start_accessory'];
  const statsFlags = ['random_item_stats_atk', 'random_item_stats_def',
    'random_soul_stats_red', 'attr_weapon', 'attr_soul_red',
    'weapon_atk_min', 'weapon_atk_max', 'armor_def_min', 'armor_def_max',
    'soul_atk_min', 'soul_atk_max'];
  const itemFlags = ['random_item_weapon', 'random_item_armor',
    'random_item_accessory', 'random_item_item'];
  const p = {
    type,
    doors: type === 2 || type === 3 || params.random_map === 1,
    items: type === 3 || any(...itemFlags),
    enemy: type === 1 || type === 3 || any(...enemyFlags),
    enemyPos: any(...enemyPosFlags) || startEquipFlags.some(k => Number(params[k]) > 0),
    itemStats: type === 3 || any(...statsFlags),
    shop: params.random_shop === 1 || type === 3,
    misc: any('skipdialog', 'opendebug', 'main_soul_random', 'main_soul_pass'),
  };
  return p;
}

/**
 * 把 random_type 的“类别级”开关展开为具体子选项，交给各功能模块。
 */
function effectiveParams(params, planInfo) {
  const eff = { ...params };
  if (planInfo.type === 1 || planInfo.type === 3) {
    eff.random_enemy_hp = 1;
    eff.random_enemy_mp = 1;
    eff.random_enemy_exp = 1;
    eff.random_enemy_atk = 1;
    eff.random_enemy_def = 1;
    eff.attr_enemy = 1;
    eff.random_enemy_soul_all = 1;
    eff.random_enemy_item = 1;
    eff.soul_probability = 1;
    eff.item_probability = 1;
  }
  if (planInfo.type === 3) {
    eff.random_item_stats_atk = 1;
    eff.random_item_stats_def = 1;
    eff.random_soul_stats_red = 1;
    eff.attr_weapon = 1;
    eff.attr_soul_red = 1;
  }
  return eff;
}

/**
 * 把 UI 参数归一化：0/1 类开关与数字统一转成数值，避免字符串严格比较失效。
 */
function normalizeParams(params) {
  const NUMERIC = [
    'random_type', 'random_map', 'random_enemy',
    'random_map_type', 'boss_enemy', 'balore_enemy', 'julius_enemy',
    'chaos_enemy', 'magician_enemy', 'magician_secret', 'enemy_boss_min',
    'enemy_everything', 'double_chaos', 'light_chaos', 'shortcut',
    'random_map_no_chaos', 'random_map_no_use', 'random_map_no_bossrush',
    'random_item_weapon', 'random_item_armor', 'random_item_accessory',
    'random_item_item', 'random_item_soul', 'random_item_stats_atk',
    'random_item_stats_def', 'random_soul_stats_red', 'random_source_stats_red',
    'attr_weapon', 'attr_soul_red', 'attr_enemy',
    'random_enemy_hp', 'random_enemy_mp', 'random_enemy_exp',
    'random_enemy_atk', 'random_enemy_def', 'random_enemy_soul_all',
    'random_enemy_soul_red', 'random_enemy_soul_blue', 'random_enemy_soul_yellow',
    'random_enemy_item', 'soul_probability', 'item_probability',
    'ringchaos', 'mainsoul', 'soul_start', 'mutil_exp',
    'main_soul_random', 'main_soul_pass', 'skipdialog', 'opendebug',
    'random_shop',
    'enemy_stat_min', 'enemy_stat_max', 'exp_multiplier',
    'soul_probability_scale', 'item_probability_scale',
    'weapon_atk_min', 'weapon_atk_max', 'armor_def_min', 'armor_def_max',
    'soul_atk_min', 'soul_atk_max', 'boss_hp_scale',
  ];
  const out = {};
  for (const key of Object.keys(params)) {
    if (NUMERIC.includes(key)) {
      out[key] = Number(params[key]) || 0;
    } else {
      out[key] = params[key];
    }
  }
  // 兼容脚本里的历史拼写：random_source_stats_red → random_soul_stats_red
  if (out.random_source_stats_red) {
    out.random_soul_stats_red = out.random_source_stats_red;
    delete out.random_source_stats_red;
  }
  // 脚本把 magician_enemy 发成了 magican_enemy
  if (out.magican_enemy) {
    out.magician_enemy = out.magican_enemy;
    delete out.magican_enemy;
  }
  if (out.magican_secret) {
    out.magician_secret = out.magican_secret;
    delete out.magican_secret;
  }
  return out;
}

/**
 * 根据 random_map_type 选择入口随机器实现：
 *   1 = 全城堡跨区洗牌  → GlobalEntranceShuffle（id 2）
 *   2 = 区域内房间随机  → FirstDraftEntranceShuffle（id 1，现行行为）
 *   3 = 房间完全随机    → TotalEntranceShuffle（id 3）
 * 未显式指定时（legacy random_map=1 或 random_type 2/3）回落为 FirstDraft。
 */
function pickEntranceChoice(params) {
  const mapType = Number(params.random_map_type);
  if (mapType === 1) {
    return 2;
  }
  if (mapType === 3) {
    return 3;
  }
  return 1;
}

function entranceTypeName(params) {
  const mapType = Number(params.random_map_type);
  if (mapType === 1) {
    return '全城堡跨区洗牌';
  }
  if (mapType === 3) {
    return '完全随机（全参与）';
  }
  return '区域内房间随机';
}

/**
 * 主入口。
 * @param {Object} params - 解析后的参数对象（含 seed）
 * @returns {Object} { data, filename, summary, seed, bytesChanged }
 */
function run(params) {
  Logger._level = DebugLevels.ERROR;

  params = normalizeParams(params);

  // 种子支持数字+字母混合字符串（可复现）；留空/0 回落为 0
  const seed = String(params.seed !== undefined ? params.seed : '').trim() || 0;

  const data = fs.readFileSync(ROM_PATH);

  const planInfo = plan(params);
  const eff = effectiveParams(params, planInfo);
  const summary = [];

  const mutexNotes = resolveMutex(eff, params);
  summary.push(...mutexNotes);

  const engineConfig = {
    seed,
    randomizeDoors: planInfo.doors,
    randomizeItems: planInfo.items,
    ensureFullyClearable: true,
    entranceRandomizerChoice: planInfo.doors ? pickEntranceChoice(params) : -1,
    itemRandomizerChoice: planInfo.items ? 1 : 0,
    keepChaoticRealmVanilla: planInfo.doors && Number(params.random_map_no_chaos) === 1,
    keepBossRushVanilla: planInfo.doors && Number(params.random_map_no_bossrush) === 1,
    keepUndevelopedVanilla: planInfo.doors && Number(params.random_map_no_use) === 1,
    originalFilename: 'emcxyywq.gba',
    runEnemyRandomization: false,
    runShopRandomization: false,
    runPostProcessing: false,
  };

  const engine = new RandomizerEngine();
  const result = engine.execute(data, engineConfig);
  if (!result) {
    throw new Error('引擎未能生成可用的随机地图/物品分布（1000 次尝试失败）');
  }

  if (planInfo.doors) {
    const keepNotes = [];
    if (Number(params.random_map_no_chaos) === 1) {
      keepNotes.push('混沌区保持原样');
    }
    if (Number(params.random_map_no_use) === 1) {
      keepNotes.push('未开发区域保持原样');
    }
    if (Number(params.random_map_no_bossrush) === 1) {
      keepNotes.push('BossRush地图保持原样');
    }
    summary.push(`房间（门）随机：${entranceTypeName(params)}${keepNotes.length ? `（${keepNotes.join('、')}）` : ''}`);
  }
  if (planInfo.items) {
    summary.push('道具位置随机');
  }

  const random = new Random();
  random.init_seed(seed);

  if (planInfo.enemy) {
    const r = enemyTables.apply(result.data, eff, random);
    if (r.summary) {
      summary.push(r.summary);
    }
  }

  // 杂项（先跑，roomEntities 的 mainsoul 赠品需要 main_soul_random 的结果）
  let draculaSouls = null;
  if (planInfo.misc) {
    const r = misc.apply(result.data, eff, random);
    if (r.summary) {
      summary.push(r.summary);
    }
    draculaSouls = r.draculaSouls;
  }

  if (planInfo.enemyPos) {
    const r = roomEntities.apply(result.data, eff, random, draculaSouls);
    if (r.summary) {
      summary.push(r.summary);
    }
  }

  if (planInfo.itemStats) {
    const r = itemTables.apply(result.data, eff, random);
    if (r.summary) {
      summary.push(r.summary);
    }
  }

  if (planInfo.shop) {
    const r = shop.apply(result.data, eff, random);
    if (r.summary) {
      summary.push(r.summary);
    }
  }

  const pristine = fs.readFileSync(ROM_PATH);
  let bytesChanged = 0;
  for (let i = 0; i < pristine.length; i++) {
    if (pristine[i] !== result.data[i]) {
      bytesChanged++;
    }
  }

  return {
    data: result.data,
    filename: `emcxyywq-${seed}.gba`,
    seed,
    summary: summary.join('\n'),
    bytesChanged,
  };
}

module.exports = {
  run,
  plan,
  ROM_PATH,
};
