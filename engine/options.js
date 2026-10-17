'use strict';

/**
 * 随机化选项定义。
 * 这份定义同时驱动：
 *   - 前端页面自动渲染（GET /options）
 *   - 后端把 HTTP 参数映射成引擎配置（POST /ajax.php）
 *
 * 字段说明：
 *   key       - 参数名（与 fbigames 原脚本保持一致，方便脚本兼容）
 *   group     - 页面分组
 *   name      - 中文名
 *   desc      - 悬停说明
 *   type      - bool | int | select
 *   default   - 默认值
 *   min/max   - int 类型的取值范围
 *   choices   - select 类型可选值 [{value,label}]
 *   supported - 引擎是否已实现（false 时页面显示"开发中"，参数仍会被接受）
 *   extra     - 高级参数（页面折叠显示）
 */

const Equipment = require('./vendor/items/Equipment');

const ELEMENT_WEAKNESS = [
  { value: 0x0000, label: '无' },
  { value: 0x0100, label: '斩' },
  { value: 0x0200, label: '火' },
  { value: 0x0400, label: '水' },
  { value: 0x0800, label: '雷' },
  { value: 0x1000, label: '暗' },
  { value: 0x2000, label: '圣' },
  { value: 0x4000, label: '毒' },
  { value: 0x8000, label: '咒' },
  { value: 0x0001, label: '石化' },
];

// 开局装备的选择项：value = Equipment.js 里的 id，0 表示按原版
// （武器 id 0 = 小刀、防具 id 0 = 校服 即为原版开局装备，故不重复列出）
const startWeaponChoices = [
  { value: 0, label: '原版（小刀）' },
  ...Equipment.Weapons.filter(w => w.id > 0).map(w => ({ value: w.id, label: w.name })),
];
const startArmorChoices = [
  { value: 0, label: '原版（校服）' },
  ...Equipment.Armor.filter(a => a.id > 0).map(a => ({ value: a.id, label: a.name })),
];
const startAccessoryChoices = [
  { value: 0, label: '原版（无）' },
  ...Equipment.Accessories.map(a => ({ value: a.id, label: a.name })),
];

const OPTIONS = [
  // ============ 随机类型 ============
  {
    key: 'random_type',
    group: '随机类型',
    name: '随机类型',
    desc: '整体随机类型：0=不随机，1=仅怪物，2=仅房间，3=全部随机',
    type: 'select',
    choices: [
      { value: 0, label: '不随机' },
      { value: 1, label: '仅怪物' },
      { value: 2, label: '仅房间' },
      { value: 3, label: '全部随机' },
    ],
    default: 3,
    supported: true,
  },

  // ============ 怪物随机 ============
  {
    key: 'random_enemy',
    group: '怪物随机',
    name: '随机怪物位置',
    desc: '把怪物打乱/随机安放到各房间',
    type: 'bool',
    default: 0,
    supported: true,
    mutex: '怪物位置',
    extra: true,
  },
  {
    key: 'boss_enemy',
    group: '怪物随机',
    name: 'Boss 加入小怪',
    desc: 'Boss 作为小怪在普通房间出现',
    type: 'bool',
    default: 0,
    supported: true,
    extra: true,
  },
  {
    key: 'balore_enemy',
    group: '怪物随机',
    name: '巴洛尔加入小怪',
    desc: '巴洛尔作为小怪出现',
    type: 'bool',
    default: 0,
    supported: true,
    extra: true,
  },
  {
    key: 'julius_enemy',
    group: '怪物随机',
    name: '尤利乌斯加入小怪',
    desc: '尤利乌斯作为小怪出现',
    type: 'bool',
    default: 0,
    supported: true,
    extra: true,
  },
  {
    key: 'chaos_enemy',
    group: '怪物随机',
    name: '混沌加入小怪',
    desc: '混沌作为小怪出现',
    type: 'bool',
    default: 0,
    supported: true,
    extra: true,
  },
  {
    key: 'magician_enemy',
    group: '怪物随机',
    name: '时之法师加入小怪',
    desc: '时之法师作为小怪出现',
    type: 'bool',
    default: 0,
    supported: true,
    extra: true,
  },
  {
    key: 'magician_secret',
    group: '怪物随机',
    name: '时之试炼',
    desc: 'Boss 战追加时之法师（兔子）群，形成时间试炼',
    type: 'bool',
    default: 0,
    supported: true,
    extra: true,
  },
  {
    key: 'enemy_boss_min',
    group: '怪物随机',
    name: '原Boss随机成小怪',
    desc: '原本的 Boss 也随机为小怪',
    type: 'bool',
    default: 0,
    supported: true,
    extra: true,
  },
  {
    key: 'enemy_everything',
    group: '怪物随机',
    name: '万物皆为怪',
    desc: '所有实体都可能成为怪物',
    type: 'bool',
    default: 0,
    supported: true,
    mutex: '怪物位置',
    extra: true,
  },
  {
    key: 'double_chaos',
    group: '怪物随机',
    name: '挑战双混沌',
    desc: '混沌 Boss 出现两个',
    type: 'bool',
    default: 0,
    supported: true,
    extra: true,
  },
  {
    key: 'light_chaos',
    group: '怪物随机',
    name: '混沌地图变得明亮',
    desc: '调亮混沌地图',
    type: 'bool',
    default: 0,
    supported: true,
    extra: true,
  },
  {
    key: 'shortcut',
    group: '怪物随机',
    name: '存档点快捷道路',
    desc: '每个存档房与城堡另一端的区域房双向接通，形成快捷通道',
    type: 'bool',
    default: 0,
    supported: true,
    extra: true,
  },

  // ============ 房间随机 ============
  {
    key: 'random_map',
    group: '房间随机',
    name: '随机房间位置',
    desc: '开启房间随机',
    type: 'bool',
    default: 0,
    supported: true,
  },
  {
    key: 'random_map_type',
    group: '房间随机',
    name: '房间随机类型',
    desc: '1=全城堡跨区洗牌（全城堡门一次随机配对），2=区域内房间随机（跨区域连接不变），3=房间完全随机（全部门参与）',
    type: 'select',
    choices: [
      { value: 1, label: '全城堡跨区洗牌' },
      { value: 2, label: '区域内房间随机' },
      { value: 3, label: '房间完全随机' },
    ],
    default: 1,
    supported: true,
    extra: true,
  },
  {
    key: 'random_map_no_chaos',
    group: '房间随机',
    name: '混沌不随机',
    desc: '混沌区域保持原样',
    type: 'bool',
    default: 0,
    supported: true,
    extra: true,
  },
  {
    key: 'random_map_no_use',
    group: '房间随机',
    name: '未开发区域不随机',
    desc: '未开发区域保持原样（未开发房间不在房间表内，天然不参与洗牌，本选项为显式保证）',
    type: 'bool',
    default: 0,
    supported: true,
    extra: true,
  },
  {
    key: 'random_map_no_bossrush',
    group: '房间随机',
    name: 'BossRush地图不随机',
    desc: 'BossRush 地图保持原样（BossRush 为独立第 13 区，不在房间表内，天然不参与洗牌，本选项为显式保证）',
    type: 'bool',
    default: 0,
    supported: true,
    extra: true,
  },

  // ============ 道具随机 ============
  {
    key: 'random_item_weapon',
    group: '道具随机',
    name: '武器位置',
    desc: '随机武器在城堡中的位置',
    type: 'bool',
    default: 0,
    supported: true,
  },
  {
    key: 'random_item_armor',
    group: '道具随机',
    name: '防具位置',
    desc: '随机防具在城堡中的位置',
    type: 'bool',
    default: 0,
    supported: true,
  },
  {
    key: 'random_item_accessory',
    group: '道具随机',
    name: '饰品位置',
    desc: '随机饰品在城堡中的位置',
    type: 'bool',
    default: 0,
    supported: true,
  },
  {
    key: 'random_item_item',
    group: '道具随机',
    name: '道具位置',
    desc: '随机消耗品在城堡中的位置',
    type: 'bool',
    default: 0,
    supported: true,
  },
  {
    key: 'random_item_soul',
    group: '道具随机',
    name: '加入魂灯',
    desc: '把魂放入魂灯',
    type: 'bool',
    default: 0,
    supported: true,
  },
  {
    key: 'random_item_stats_atk',
    group: '道具随机',
    name: '武器攻击随机',
    desc: '随机所有武器的攻击力',
    type: 'bool',
    default: 0,
    supported: true,
  },
  {
    key: 'random_item_stats_def',
    group: '道具随机',
    name: '防具防御随机',
    desc: '随机所有防具的防御力',
    type: 'bool',
    default: 0,
    supported: true,
  },
  {
    key: 'random_soul_stats_red',
    group: '道具随机',
    name: '红魂攻击随机',
    desc: '随机所有红魂的攻击力',
    type: 'bool',
    default: 0,
    supported: true,
  },

  // ============ 道具属性 ============
  {
    key: 'attr_weapon',
    group: '道具属性',
    name: '武器属性随机',
    desc: '随机武器的攻击属性（斩/火/水/雷/暗/圣/毒/咒/石）',
    type: 'bool',
    default: 0,
    supported: true,
  },
  {
    key: 'attr_soul_red',
    group: '道具属性',
    name: '红魂属性随机',
    desc: '随机红魂的攻击属性',
    type: 'bool',
    default: 0,
    supported: true,
  },

  // ============ 怪物属性 ============
  {
    key: 'random_enemy_hp',
    group: '怪物属性',
    name: '体力随机',
    desc: '随机所有怪物的 HP',
    type: 'bool',
    default: 0,
    supported: true,
  },
  {
    key: 'random_enemy_mp',
    group: '怪物属性',
    name: '魔力随机',
    desc: '随机所有怪物的 MP',
    type: 'bool',
    default: 0,
    supported: true,
  },
  {
    key: 'random_enemy_exp',
    group: '怪物属性',
    name: '经验随机',
    desc: '随机所有怪物的经验值',
    type: 'bool',
    default: 0,
    supported: true,
    mutex: '经验',
  },
  {
    key: 'random_enemy_atk',
    group: '怪物属性',
    name: '攻击随机',
    desc: '随机所有怪物的攻击力',
    type: 'bool',
    default: 0,
    supported: true,
  },
  {
    key: 'random_enemy_def',
    group: '怪物属性',
    name: '防御随机',
    desc: '随机所有怪物的防御力',
    type: 'bool',
    default: 0,
    supported: true,
  },
  {
    key: 'attr_enemy',
    group: '怪物属性',
    name: '弱点抗性随机',
    desc: '随机所有怪物的弱点和抗性',
    type: 'bool',
    default: 0,
    supported: true,
  },

  // ============ 怪物掉落 ============
  {
    key: 'random_enemy_soul_all',
    group: '怪物掉落',
    name: '魂完全随机',
    desc: '所有怪物的魂完全随机（优先于下方三种）',
    type: 'bool',
    default: 0,
    supported: true,
    mutex: '魂随机',
  },
  {
    key: 'random_enemy_soul_red',
    group: '怪物掉落',
    name: '红魂随机',
    desc: '随机红魂的掉落归属',
    type: 'bool',
    default: 0,
    supported: true,
    mutex: '魂随机',
  },
  {
    key: 'random_enemy_soul_blue',
    group: '怪物掉落',
    name: '蓝魂随机',
    desc: '随机蓝魂的掉落归属',
    type: 'bool',
    default: 0,
    supported: true,
    mutex: '魂随机',
  },
  {
    key: 'random_enemy_soul_yellow',
    group: '怪物掉落',
    name: '黄魂随机',
    desc: '随机黄魂的掉落归属',
    type: 'bool',
    default: 0,
    supported: true,
    mutex: '魂随机',
  },
  {
    key: 'random_enemy_item',
    group: '怪物掉落',
    name: '道具掉落随机',
    desc: '随机怪物的道具掉落',
    type: 'bool',
    default: 0,
    supported: true,
  },

  // ============ 其他选项 ============
  {
    key: 'soul_probability',
    group: '其他选项',
    name: '魂掉率提高',
    desc: '提高魂的掉落概率',
    type: 'bool',
    default: 0,
    supported: true,
    mutex: '魂掉率',
  },
  {
    key: 'item_probability',
    group: '其他选项',
    name: '道具掉率提高',
    desc: '提高道具的掉落概率',
    type: 'bool',
    default: 0,
    supported: true,
    mutex: '道具掉率',
  },
  {
    key: 'ringchaos',
    group: '其他选项',
    name: '获得混沌戒指',
    desc: '开局获得混沌戒指',
    type: 'bool',
    default: 0,
    supported: true,
  },
  {
    key: 'soul_start',
    group: '其他选项',
    name: '剧情三魂',
    desc: '开局赠送剧情三魂 (Malphas/Skula/Giant Bat)',
    type: 'bool',
    default: 0,
    supported: true,
    mutex: '开局赠魂',
  },
  {
    key: 'main_soul_random',
    group: '其他选项',
    name: '古文书三魂随机',
    desc: '三本古文书对应的魂随机',
    type: 'bool',
    default: 0,
    supported: true,
  },
  {
    key: 'mutil_exp',
    group: '其他选项',
    name: '随机2~5倍经验',
    desc: '经验值随机变为 2~5 倍',
    type: 'bool',
    default: 0,
    supported: true,
    mutex: '经验',
  },
  {
    key: 'mainsoul',
    group: '其他选项',
    name: '获得剧情魂',
    desc: '开局赠送古文书所需三魂',
    type: 'bool',
    default: 0,
    supported: true,
    mutex: '开局赠魂',
  },
  {
    key: 'main_soul_pass',
    group: '其他选项',
    name: '取消三魂检测',
    desc: '跳过剧情三魂检查',
    type: 'bool',
    default: 0,
    supported: true,
  },

  // ============ 高级选项 ============
  {
    key: 'skipdialog',
    group: '高级选项',
    name: '一周目允许跳过对话',
    desc: '第一周目即可跳过对话/过场',
    type: 'bool',
    default: 0,
    supported: true,
  },
  {
    key: 'opendebug',
    group: '高级选项',
    name: '开启Debug模式',
    desc: '开启游戏内置调试菜单',
    type: 'bool',
    default: 0,
    supported: true,
  },

  // ============ 自由度扩展 ============
  {
    key: 'seed',
    group: '自由度扩展',
    name: '固定种子',
    desc: '填入数字+字母可复现同一个结果，留空则随机生成数字+字母种子',
    type: 'string',
    default: '',
    supported: true,
  },
  {
    key: 'enemy_stat_min',
    group: '自由度扩展',
    name: '敌人数值随机下限(倍)',
    desc: '怪物 HP/MP/攻/防 随机范围的下限倍数，如 0.5',
    type: 'float',
    default: 0.5,
    min: 0.1,
    max: 10,
    supported: true,
    extra: true,
  },
  {
    key: 'enemy_stat_max',
    group: '自由度扩展',
    name: '敌人数值随机上限(倍)',
    desc: '怪物 HP/MP/攻/防 随机范围的上限倍数，如 3',
    type: 'float',
    default: 3,
    min: 0.1,
    max: 100,
    supported: true,
    extra: true,
  },
  {
    key: 'exp_multiplier',
    group: '自由度扩展',
    name: '经验倍率',
    desc: '所有怪物经验统一乘以该倍率（0 表示不调整）',
    type: 'float',
    default: 0,
    min: 0,
    max: 100,
    supported: true,
    extra: true,
    mutex: '经验',
  },
  {
    key: 'soul_probability_scale',
    group: '自由度扩展',
    name: '魂掉率倍率',
    desc: '魂掉率整体放大倍数（0 表示不调整）',
    type: 'float',
    default: 0,
    min: 0,
    max: 100,
    supported: true,
    mutex: '魂掉率',
    extra: true,
  },
  {
    key: 'item_probability_scale',
    group: '自由度扩展',
    name: '道具掉率倍率',
    desc: '道具掉率整体放大倍数（0 表示不调整）',
    type: 'float',
    default: 0,
    min: 0,
    max: 100,
    supported: true,
    mutex: '道具掉率',
    extra: true,
  },
  {
    key: 'weapon_atk_min',
    group: '自由度扩展',
    name: '武器攻击随机下限',
    desc: '武器攻击随机的最小值',
    type: 'int',
    default: 1,
    min: 1,
    max: 999,
    supported: true,
    extra: true,
  },
  {
    key: 'weapon_atk_max',
    group: '自由度扩展',
    name: '武器攻击随机上限',
    desc: '武器攻击随机的最大值',
    type: 'int',
    default: 300,
    min: 1,
    max: 999,
    supported: true,
    extra: true,
  },
  {
    key: 'armor_def_min',
    group: '自由度扩展',
    name: '防具防御随机下限',
    desc: '防具防御随机的最小值',
    type: 'int',
    default: 1,
    min: 0,
    max: 999,
    supported: true,
    extra: true,
  },
  {
    key: 'armor_def_max',
    group: '自由度扩展',
    name: '防具防御随机上限',
    desc: '防具防御随机的最大值',
    type: 'int',
    default: 99,
    min: 0,
    max: 999,
    supported: true,
    extra: true,
  },
  {
    key: 'soul_atk_min',
    group: '自由度扩展',
    name: '红魂攻击随机下限',
    desc: '红魂攻击随机的最小值',
    type: 'int',
    default: 1,
    min: 1,
    max: 999,
    supported: true,
    extra: true,
  },
  {
    key: 'soul_atk_max',
    group: '自由度扩展',
    name: '红魂攻击随机上限',
    desc: '红魂攻击随机的最大值',
    type: 'int',
    default: 200,
    min: 1,
    max: 999,
    supported: true,
    extra: true,
  },
  {
    key: 'boss_hp_scale',
    group: '自由度扩展',
    name: 'Boss 体力倍率',
    desc: 'Boss 的 HP 整体乘以该倍率（0 表示不调整）',
    type: 'float',
    default: 0,
    min: 0,
    max: 100,
    supported: true,
    extra: true,
  },
  {
    key: 'start_weapon',
    group: '自由度扩展',
    name: '开局武器',
    desc: '开局直接获得指定武器（0=原版小刀）',
    type: 'select',
    choices: startWeaponChoices,
    default: 0,
    supported: true,
    extra: true,
  },
  {
    key: 'start_armor',
    group: '自由度扩展',
    name: '开局防具',
    desc: '开局直接获得指定防具（0=原版校服）',
    type: 'select',
    choices: startArmorChoices,
    default: 0,
    supported: true,
    extra: true,
  },
  {
    key: 'start_accessory',
    group: '自由度扩展',
    name: '开局饰品',
    desc: '开局直接获得指定饰品（0=无）',
    type: 'select',
    choices: startAccessoryChoices,
    default: 0,
    supported: true,
    extra: true,
  },
];

/**
 * 解析来自 HTTP 的原始参数（均为字符串）为标准选项对象。
 * 未知参数会被忽略；已支持/未支持参数都保留并原样传回前端。
 */
function parseParams(raw) {
  const out = {};
  for (const opt of OPTIONS) {
    const key = opt.key;
    if (!(key in raw)) {
      out[key] = opt.default;
      continue;
    }
    let v = raw[key];
    if (v === '' || v === undefined || v === null) {
      out[key] = opt.default;
      continue;
    }
    if (Array.isArray(v)) {
      v = v[v.length - 1];
    }
    if (opt.type === 'bool') {
      out[key] = (v === '1' || v === 'true' || v === 'on') ? 1 : 0;
    } else if (opt.type === 'int') {
      const n = parseInt(v, 10);
      out[key] = Number.isNaN(n) ? opt.default : n;
    } else if (opt.type === 'float') {
      const n = parseFloat(v);
      out[key] = Number.isNaN(n) ? opt.default : n;
    } else {
      out[key] = v;
    }
  }
  return out;
}

/** 返回供前端渲染用的选项定义（过滤掉 choices 为空的占位选项） */
function getOptionDefinitions() {
  return OPTIONS
    .filter(o => o.type !== 'select' || (o.choices && o.choices.length > 0))
    .map(o => ({ ...o }));
}

function getGroups() {
  const groups = [];
  const seen = new Set();
  for (const opt of OPTIONS) {
    if (!seen.has(opt.group)) {
      seen.add(opt.group);
      groups.push(opt.group);
    }
  }
  return groups;
}

module.exports = {
  OPTIONS,
  parseParams,
  getOptionDefinitions,
  getGroups,
  ELEMENT_WEAKNESS,
};
