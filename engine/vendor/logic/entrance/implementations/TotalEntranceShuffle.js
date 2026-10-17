const FirstDraft = require('./FirstDraftEntranceShuffle');

// 房间完全随机（全参与）：除少数引擎走查器无法放行的结构性门之外，
// 整个城堡所有房间与门（包括 Graham/Julius/混沌区入口房）全部参与洗牌。
//
// 以下门必须保持原样，否则引擎的 isSolvable 走查器永远无法 fullyClearable：
//   - 混沌访问门对（0x084F8E2C/0x084F8F6C）：0x084F8E3C 混沌房被排除在洗牌外，
//     其唯一门的原配对门一旦被洗走，该门就永久孤儿 → 100% 失败。
//   - 单向标志门对（Top Floor 0x084F7020/0x084F6C00、Forbidden Area
//     0x084F7E00/0x084F7E88）：走查器把带 isWeirdAnnoyingOneWay* 标志的门锁在
//     Locks.INACCESSIBLE 下（永不发放），只有保持原版配对才能被遍历清除。
// 实测该模式生成通过率 ~27%（Global 约 7%），配合引擎 1000 次重试稳定成功。
const DOORS_TO_KEEP_VANILLA = [
  // Chaos boss 房访问链
  0x084F8E2C,
  0x084F8F6C,

  // Top Floor 单向门对
  0x084F7020,
  0x084F6C00,

  // Forbidden Area 单向门对
  0x084F7E00,
  0x084F7E88,
];

function TotalEntranceShuffle(areas, random, startingRoom, keepFlags) {
  const allRooms = areas.flatMap(area => area.rooms);

  // Garden 单向门修复所需的反向门
  const gardenPartnerDoor = allRooms
    .flatMap(room => room.doors)
    .find(door => door.address === 0x084EDF20);

  // 全参与：不过滤 Graham/Julius/Chaos 等房间，只排除混沌区特殊房。
  let rooms = allRooms.filter(room => !room.isWeirdChaoticRealmRoomDoNotModify);
  let doorsToKeep = DOORS_TO_KEEP_VANILLA.slice();

  // random_map_no_*：受保护区域（混沌区等）整体保持原样，不参与洗牌
  if (keepFlags) {
    const protected = FirstDraft.getProtectedRegions(areas, keepFlags);
    const protectedAddrs = new Set(protected.rooms.map(room => room.address));
    rooms = rooms.filter(room => !protectedAddrs.has(room.address));
    doorsToKeep = doorsToKeep.concat(protected.doors);
  }

  return FirstDraft.randomizeRoomList(rooms, random, doorsToKeep, gardenPartnerDoor);
}

TotalEntranceShuffle.displayName = 'Total Entrance Shuffle';
TotalEntranceShuffle.desc = 'Shuffles nearly every door in the castle, including the doors around '
  + 'Graham, Julius, and the Chaotic Realm entrance. Only a handful of structurally required '
  + 'connectors (Chaos access chain and one-way rooms) are kept vanilla so the generated map '
  + 'stays fully clearable. Only direction matching is guaranteed.';

module.exports = TotalEntranceShuffle;
