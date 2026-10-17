const AoSConstants = require('../vendor/utils/AoSConstants');

const ENEMY_TABLE = 0xE6E50;
const ENEMY_COUNT = 113;
const ENEMY_SIZE = 36;

const {
  ENEMY_NAMES,
} = AoSConstants;

// Field offsets within each 36-byte enemy DNA record
const F = {
  item1: 8,
  item2: 10,
  HP: 12,
  MP: 14,
  exp: 16,
  soulRarity: 18,
  atk: 19,
  def: 20,
  item1Rarity: 21,
  item2Rarity: 22,
  soulType: 23,
  soul: 24,
  weaknesses: 28,
  resistances: 30,
};

function read16(data, off) {
  return data[off] | (data[off + 1] << 8);
}

function write16(data, off, value) {
  data[off] = value & 0xFF;
  data[off + 1] = (value >> 8) & 0xFF;
}

function read8(data, off) {
  return data[off];
}

function write8(data, off, value) {
  data[off] = value & 0xFF;
}

function base(idx) {
  return ENEMY_TABLE + idx * ENEMY_SIZE;
}

/**
 * Reads all enemy DNA records into plain objects.
 */
function parseAll(data) {
  const enemies = [];
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const off = base(i);
    enemies.push({
      index: i,
      name: ENEMY_NAMES[i] || `Unknown${i}`,
      item1: read16(data, off + F.item1),
      item2: read16(data, off + F.item2),
      HP: read16(data, off + F.HP),
      MP: read16(data, off + F.MP),
      exp: read16(data, off + F.exp),
      soulRarity: read8(data, off + F.soulRarity),
      atk: read8(data, off + F.atk),
      def: read8(data, off + F.def),
      item1Rarity: read8(data, off + F.item1Rarity),
      item2Rarity: read8(data, off + F.item2Rarity),
      soulType: read8(data, off + F.soulType),
      soul: read8(data, off + F.soul),
      weaknesses: read16(data, off + F.weaknesses),
      resistances: read16(data, off + F.resistances),
    });
  }
  return enemies;
}

function writeField(data, idx, field, value) {
  const off = base(idx);
  switch (field) {
    case 'item1': case 'item2':
    case 'HP': case 'MP': case 'exp':
    case 'weaknesses': case 'resistances':
      write16(data, off + F[field], value);
      break;
    default:
      write8(data, off + F[field], value);
  }
}

function shuffleField(data, random, field) {
  const values = [];
  for (let i = 0; i < ENEMY_COUNT; i++) {
    values.push(field === 'soulRarity' || field === 'atk' || field === 'def'
      || field === 'item1Rarity' || field === 'item2Rarity' || field === 'soulType' || field === 'soul'
      ? read8(data, base(i) + F[field])
      : read16(data, base(i) + F[field]));
  }
  const shuffled = random.shuffle(values);
  for (let i = 0; i < ENEMY_COUNT; i++) {
    writeField(data, i, field, shuffled[i]);
  }
  return values;
}

/**
 * Shuffles enemy HP values amongst each other.
 */
function randomizeHP(data, random) {
  return shuffleField(data, random, 'HP');
}

function randomizeMP(data, random) {
  return shuffleField(data, random, 'MP');
}

function randomizeExp(data, random) {
  return shuffleField(data, random, 'exp');
}

function randomizeAtk(data, random) {
  return shuffleField(data, random, 'atk');
}

function randomizeDef(data, random) {
  return shuffleField(data, random, 'def');
}

/**
 * Shuffles (weakness, resistance) pairs between enemies.
 */
function randomizeAttr(data, random) {
  const pairs = [];
  for (let i = 0; i < ENEMY_COUNT; i++) {
    pairs.push({
      w: read16(data, base(i) + F.weaknesses),
      r: read16(data, base(i) + F.resistances),
    });
  }
  const shuffled = random.shuffle(pairs);
  for (let i = 0; i < ENEMY_COUNT; i++) {
    write16(data, base(i) + F.weaknesses, shuffled[i].w);
    write16(data, base(i) + F.resistances, shuffled[i].r);
  }
  return pairs;
}

/**
 * Shuffles soul IDs among enemies of the same soul type.
 * color: 'red' | 'blue' | 'yellow' -> DNA soulType 0 | 1 | 2
 */
function randomizeSoulColor(data, random, color) {
  const typeMap = { red: 0, blue: 1, yellow: 2 };
  const type = typeMap[color];
  const indices = [];
  for (let i = 0; i < ENEMY_COUNT; i++) {
    if (read8(data, base(i) + F.soulType) === type && read8(data, base(i) + F.soul) !== 0) {
      indices.push(i);
    }
  }
  const souls = indices.map(i => read8(data, base(i) + F.soul));
  const shuffled = random.shuffle(souls);
  indices.forEach((idx, j) => write8(data, base(idx) + F.soul, shuffled[j]));
  return { type, count: indices.length };
}

/**
 * Completely randomizes all soul assignments (type + id) from the full soul pool.
 * Enemies that currently have no soul stay soulless.
 */
function randomizeAllSouls(data, random) {
  const pool = [];
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const type = read8(data, base(i) + F.soulType);
    const soul = read8(data, base(i) + F.soul);
    if (soul !== 0 && type >= 0 && type <= 2) {
      pool.push({ type, soul });
    }
  }
  if (!pool.length) {
    return;
  }
  let assigned = 0;
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const off = base(i);
    if (read8(data, off + F.soul) === 0) {
      continue;
    }
    const pick = pool[random.random_int(pool.length)];
    write8(data, off + F.soulType, pick.type);
    write8(data, off + F.soul, pick.soul);
    assigned++;
  }
  return { assigned, poolSize: pool.length };
}

/**
 * Shuffles (item1, item2) drop pairs between enemies. Each pair travels with
 * its own rarity scores.
 */
function randomizeDrops(data, random) {
  const pairs = [];
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const off = base(i);
    pairs.push({
      item1: read16(data, off + F.item1),
      item2: read16(data, off + F.item2),
      item1Rarity: read8(data, off + F.item1Rarity),
      item2Rarity: read8(data, off + F.item2Rarity),
    });
  }
  const shuffled = random.shuffle(pairs);
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const off = base(i);
    write16(data, off + F.item1, shuffled[i].item1);
    write16(data, off + F.item2, shuffled[i].item2);
    write8(data, off + F.item1Rarity, shuffled[i].item1Rarity);
    write8(data, off + F.item2Rarity, shuffled[i].item2Rarity);
  }
  return pairs;
}

/**
 * Boosts soul drop rate by lowering the soul rarity score.
 * Note: rarity 0 means no soul drop at all, so we floor at 1.
 */
function boostSoulProbability(data, factor = 0.5) {
  let changed = 0;
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const off = base(i);
    const soul = read8(data, off + F.soul);
    if (soul === 0) {
      continue;
    }
    const rarity = read8(data, off + F.soulRarity);
    if (rarity > 0) {
      write8(data, off + F.soulRarity, Math.max(1, Math.round(rarity * factor)));
      changed++;
    }
  }
  return changed;
}

/**
 * Boosts item drop rate by lowering the item rarity scores.
 */
function boostItemProbability(data, factor = 0.5) {
  let changed = 0;
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const off = base(i);
    ['item1Rarity', 'item2Rarity'].forEach(f => {
      const rarity = read8(data, off + F[f]);
      if (rarity > 0) {
        write8(data, off + F[f], Math.max(1, Math.round(rarity * factor)));
        changed++;
      }
    });
  }
  return changed;
}

/**
 * 按 [min, max] 倍率随机缩放单个数值字段（自由度扩展 enemy_stat_min/max）。
 * atk/def 为 8bit，其余（HP/MP/exp）为 16bit。
 */
function scaleStatField(data, random, field, min, max) {
  const is8 = field === 'atk' || field === 'def';
  const clamp = is8 ? 0xFF : 0xFFFF;
  let changed = 0;
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const off = base(i);
    const cur = is8 ? read8(data, off + F[field]) : read16(data, off + F[field]);
    const factor = min + random.random() * (max - min);
    const next = Math.max(0, Math.min(clamp, Math.round(cur * factor)));
    if (next !== cur) {
      if (is8) {
        write8(data, off + F[field], next);
      } else {
        write16(data, off + F[field], next);
      }
      changed++;
    }
  }
  return changed;
}

/**
 * 所有怪物经验统一乘以固定倍率（自由度扩展 exp_multiplier）。
 */
function multiplyExpUniform(data, factor) {
  let changed = 0;
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const off = base(i);
    const exp = read16(data, off + F.exp);
    if (exp === 0) {
      continue;
    }
    const next = Math.min(0xFFFF, Math.round(exp * factor));
    if (next !== exp) {
      write16(data, off + F.exp, next);
      changed++;
    }
  }
  return changed;
}

/**
 * 魂掉率整体缩放（自由度扩展 soul_probability_scale）。
 * A/B 试反：scale 为"稀有度倍率"，>1 更难掉（rarity 乘以 scale）。
 * 若反汇编/实测证实"稀有度越低越容易掉"则改回 rarity / scale。
 */
function scaleSoulProbability(data, scale) {
  let changed = 0;
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const off = base(i);
    if (read8(data, off + F.soul) === 0) {
      continue;
    }
    const rarity = read8(data, off + F.soulRarity);
    if (rarity === 0) {
      continue;
    }
    const next = Math.max(1, Math.min(0xFF, Math.round(rarity / scale)));
    if (next !== rarity) {
      write8(data, off + F.soulRarity, next);
      changed++;
    }
  }
  return changed;
}

/**
 * 道具掉率整体缩放（自由度扩展 item_probability_scale），作用于 item1/item2 两个稀有度。
 * A/B 试反：>1 更难掉（rarity 乘以 scale）。
 */
function scaleItemProbability(data, scale) {
  let changed = 0;
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const off = base(i);
    for (const f of ['item1Rarity', 'item2Rarity']) {
      const rarity = read8(data, off + F[f]);
      if (rarity === 0) {
        continue;
      }
      const next = Math.max(1, Math.min(0xFF, Math.round(rarity / scale)));
      if (next !== rarity) {
        write8(data, off + F[f], next);
        changed++;
      }
    }
  }
  return changed;
}

// 官方掉率补丁（与官方随机器一致）：
// 掉率公式 = r5 / threshold（r5=6/7/14/15），threshold = rarity×8+0x20−luck/16（魂）、
// rarity×4+0x10−luck/16（道具）。÷ 稀有度只能把 threshold 压到下限 1×8+32=40
// （魂 ≈15%、道具 ≈20%），到不了更高。
// 官方直接改代码：
//   - 魂 0x08066AA4 `subs r4,r1,r0` → `movs r4,#0`：threshold 钳到 0x10 →
//     掉率 = r5/16 ≈ 37.5%~43.75%（+8 分支 87.5%~93.75%）
//   - 道具 0x08066B8A `adds r4,r0,#0` → `movs r4,#0`：掉落结果恒 0 → 100% 必掉
const SOUL_DROP_CODE_ADDR = 0x08066AA4; // 原字节 0x1A0C (subs r4,r1,r0)
const ITEM_DROP_CODE_ADDR = 0x08066B8A; // 原字节 0x1C04 (adds r4,r0,#0)
const DROP_CODE_PATCH = 0x2400; // movs r4,#0

function patchDropCode(data, addr, orig) {
  const off = addr - 0x08000000;
  if (read16(data, off) !== orig) {
    return 0;
  }
  write16(data, off, DROP_CODE_PATCH);
  return 1;
}

/**
 * 魂掉率代码补丁：threshold 钳到 0x10（≈37.5%~93.75% 必掉）。
 */
function patchSoulDropCode(data) {
  return patchDropCode(data, SOUL_DROP_CODE_ADDR, 0x1A0C);
}

/**
 * 道具掉率代码补丁：掉落结果恒 0（100% 必掉）。
 */
function patchItemDropCode(data) {
  return patchDropCode(data, ITEM_DROP_CODE_ADDR, 0x1C04);
}

// 随机2~5倍经验（代码补丁，不改敌人表格）：保留怪物原始经验值，在击杀发放经验处
// 把 exp 值(r4)累加进玩家经验前 ×random(2..5)，即“结算时 2~5 倍”。
// 发放经验代码 0x08066A20 原字节 0x4649 0x6B08（mov r1,sb / ldr r0,[r1,#0x30]），
// 被 4 字节 bl 覆盖，hook 内部恢复这两条指令；hook 位于空闲区 0x080F6A1C
// （0xFF 填充，避开房间实体搬迁动态区 0x7F8B6C）。
// 该函数以 pop {r0}; bx r0 返回（栈存返回地址），故 hook 用 push {lr}/pop {pc} 安全往返。
const EXP_AWARD_CODE_ADDR = 0x08066A20;
const EXP_AWARD_CODE_ORIG = [0x4649, 0x6B08];
const EXP_HOOK_ADDR = 0x080F6A1C;
const EXP_RNG_ADDR = 0x08000A8C;

function encodeBL(from, to) {
  let off = (to - (from + 4)) & 0xFFFFFFFF;
  if (off & 0x80000000) {
    off -= 0x100000000;
  }
  return [(0xF000 | ((off >> 12) & 0x7FF)) & 0xFFFF, (0xF800 | ((off >> 1) & 0x7FF)) & 0xFFFF];
}

/**
 * 击杀结算经验 ×random(2..5)。返回 0 表示原字节不符未打补丁，1 表示成功。
 */
function patchExpMultiplierCode(data) {
  const patchOff = EXP_AWARD_CODE_ADDR - 0x08000000;
  if (
    read16(data, patchOff) !== EXP_AWARD_CODE_ORIG[0] ||
    read16(data, patchOff + 2) !== EXP_AWARD_CODE_ORIG[1]
  ) {
    return 0;
  }
  const [h1, h2] = encodeBL(EXP_AWARD_CODE_ADDR, EXP_HOOK_ADDR);
  write16(data, patchOff, h1);
  write16(data, patchOff + 2, h2);

  const hookOff = EXP_HOOK_ADDR - 0x08000000;
  const [b1, b2] = encodeBL(EXP_HOOK_ADDR + 2, EXP_RNG_ADDR);
  const hook = [
    0xB500, // push {lr}
    b1, b2, // bl 0x08000A8C  (RNG → r0，仅破坏 r0/r1/r2)
    0x2103, // movs r1, #3
    0x4008, // ands r0, r1       r0 = rng & 3
    0x3002, // adds r0, #2       factor 2..5
    0x4344, // muls r4, r0       r4 *= factor
    0x4649, // mov r1, sb        恢复被覆盖指令
    0x6B08, // ldr r0, [r1, #0x30] 恢复被覆盖指令（玩家经验）
    0xBD00, // pop {pc}          跳回 0x08066A24
  ];
  hook.forEach((w, i) => write16(data, hookOff + i * 2, w));
  return 1;
}

/**
 * Boss 体力整体缩放（自由度扩展 boss_hp_scale）。
 */
function scaleBossHP(data, factor) {
  let changed = 0;
  for (const idx of [106, 107, 108, 109, 110, 111, 112]) {
    const off = base(idx);
    const hp = read16(data, off + F.HP);
    const next = Math.max(1, Math.min(0xFFFF, Math.round(hp * factor)));
    if (next !== hp) {
      write16(data, off + F.HP, next);
      changed++;
    }
  }
  return changed;
}

/**
 * Multiplies all enemy exp values by a random factor between min and max.
 */
function multiplyExp(data, random, min = 2, max = 5) {
  let changed = 0;
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const off = base(i);
    const exp = read16(data, off + F.exp);
    if (exp === 0) {
      continue;
    }
    const factor = min + random.random_int(max - min + 1);
    write16(data, off + F.exp, Math.min(0xFFFF, exp * factor));
    changed++;
  }
  return changed;
}

/**
 * Master function: applies all enabled enemy-related options.
 * Returns a summary string for the info file.
 */
function apply(data, params, random) {
  const lines = [];
  const changes = [];

  // 自由度扩展：enemy_stat_min/max 提供数值缩放范围，开启时覆盖对应字段的"洗牌"行为
  const statMin = Number(params.enemy_stat_min);
  const statMax = Number(params.enemy_stat_max);
  const useStatRange = statMin > 0 && statMax > 0;
  const statMap = [
    ['random_enemy_hp', 'HP', '体力'],
    ['random_enemy_mp', 'MP', '魔力'],
    ['random_enemy_atk', 'atk', '攻击力'],
    ['random_enemy_def', 'def', '防御力'],
  ];
  const fieldCn = { HP: '体力', MP: '魔力', atk: '攻击力', def: '防御力' };
  if (useStatRange) {
    for (const [flag, field] of statMap) {
      if (params[flag]) {
        const n = scaleStatField(data, random, field, statMin, statMax);
        changes.push(`敌人${fieldCn[field]}按 ${statMin}~${statMax} 倍缩放 (${n} 个)`);
      }
    }
  } else {
    if (params.random_enemy_hp) {
      randomizeHP(data, random);
      changes.push('敌人HP随机');
    }
    if (params.random_enemy_mp) {
      randomizeMP(data, random);
      changes.push('敌人MP随机');
    }
    if (params.random_enemy_atk) {
      randomizeAtk(data, random);
      changes.push('敌人攻击力随机');
    }
    if (params.random_enemy_def) {
      randomizeDef(data, random);
      changes.push('敌人防御力随机');
    }
  }
  if (params.random_enemy_exp) {
    randomizeExp(data, random);
    changes.push('敌人经验随机');
  }
  if (params.attr_enemy) {
    randomizeAttr(data, random);
    changes.push('敌人弱点和抗性随机');
  }

  if (params.random_enemy_soul_all) {
    const r = randomizeAllSouls(data, random);
    if (r) {
      changes.push(`魂完全随机 (${r.assigned} 个敌人)`);
    }
  } else {
    if (params.random_enemy_soul_red) {
      const r = randomizeSoulColor(data, random, 'red');
      changes.push(`红魂随机 (${r.count} 个敌人)`);
    }
    if (params.random_enemy_soul_blue) {
      const r = randomizeSoulColor(data, random, 'blue');
      changes.push(`蓝魂随机 (${r.count} 个敌人)`);
    }
    if (params.random_enemy_soul_yellow) {
      const r = randomizeSoulColor(data, random, 'yellow');
      changes.push(`黄魂随机 (${r.count} 个敌人)`);
    }
  }

  if (params.random_enemy_item) {
    randomizeDrops(data, random);
    changes.push('道具掉落随机');
  }

  if (params.soul_probability) {
    const n = patchSoulDropCode(data);
    changes.push(`魂掉率提高 (代码补丁: 阈值钳到 0x10, ${n} 处)`);
  }
  const soulScale = Number(params.soul_probability_scale);
  if (soulScale > 0) {
    const n = scaleSoulProbability(data, soulScale);
    changes.push(`魂掉率 ×${soulScale} (${n} 个敌人)`);
  }
  if (params.item_probability) {
    const n = patchItemDropCode(data);
    changes.push(`道具掉率提高 (代码补丁: 掉落结果恒 0, ${n} 处)`);
  }
  const itemScale = Number(params.item_probability_scale);
  if (itemScale > 0) {
    const n = scaleItemProbability(data, itemScale);
    changes.push(`道具掉率 ×${itemScale} (${n} 个掉落)`);
  }

  const expMult = Number(params.exp_multiplier);
  if (expMult > 0) {
    const n = multiplyExpUniform(data, expMult);
    changes.push(`经验 ×${expMult} (${n} 个敌人)`);
  }

  const bossHpScale = Number(params.boss_hp_scale);
  if (bossHpScale > 0) {
    const n = scaleBossHP(data, bossHpScale);
    changes.push(`Boss 体力 ×${bossHpScale} (${n} 个 Boss)`);
  }

  if (params.mutil_exp) {
    const n = patchExpMultiplierCode(data);
    changes.push(`经验随机2~5倍 (代码补丁: 击杀结算 ×2~5, ${n} 处)`);
  }

  return {
    summary: changes.join('\n'),
    enemies: parseAll(data),
  };
}

module.exports = {
  ENEMY_TABLE,
  ENEMY_COUNT,
  parseAll,
  scaleStatField,
  multiplyExpUniform,
  scaleSoulProbability,
  scaleItemProbability,
  patchSoulDropCode,
  patchItemDropCode,
  patchExpMultiplierCode,
  scaleBossHP,
  apply,
};
