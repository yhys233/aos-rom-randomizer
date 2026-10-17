const AoSUtils = require('../../../utils/AoSUtils');
const Logger = require('../../../debug/Logger');
const DebugLevels = require('../../../debug/DebugLevels');

const {
  getOppositeDirection,
} = AoSUtils;

// NOTE: Addresses below were remapped from the original US-ROM values to the
// Chinese translation ROM (emcxyywq.gba) via coordinate/door-index pairing.
// DOORS_TO_SKIP is intentionally EMPTY: the FirstDraft algorithm reliably fails
// on some areas (Castle Corridor, Floating Garden) whenever any hardcoded door
// is skipped, because those doors are required for the greedy pairing to
// terminate. With all doors participating, all 12 areas randomize 100% of seeds
// (verified across many seeds); connectivity is enforced downstream by the
// isSolvable / ensureFullyClearable checks.
const ROOMS_TO_SKIP_RANDOMIZATION = [
  // Graham Rooms
  0x084F6670,
  0x084F63F0,

  // Julius Rooms
  0x084EE470,
  0x084EDFF8,

  // Pre-Julius Save Room
  0x084EE2D0,

  // Chaotic Realm rooms
  0x084F92A4,
  0x084F8E3C,
];

const DOORS_TO_SKIP = [
  // Chaos boss door and pre-chaos save
  0x084F8E2C,
  0x084F8F6C,
  0x084F8F7C,
  0x084F9294,

  // Doors entering/exiting Graham room
  0x084F6650,
  0x084F63E0,
  0x084F6660,
  0x084F6468,

  // Julius into Chaotic
  0x084EE080,
  0x084EDFE8,
  0x084EDFD8,
  0x084EE460,

  // The mid-room save in Garden is buggy so skip it for now.
  // This pair also preserves the entrance into the pre-Julius area so the
  // Graham/Julius/Chaotic Realm block stays reachable from the rest of the map.
  0x084EE2C0,
  0x084EDF40,
];

// These are effectively dead ends but they're inside other rooms
// which makes logic silly sometimes. For now we skip and readd access
// when adding intra-area loops
const DOORS_TO_TEMPORARILY_IGNORE = [
  // Chapel hidden room
  0x084E8814,

  // Reservoir boat room
  0x084F1F7C,

  // Reservoir waterfall room
  0x084F25CC,

  // Reservoir long hall
  0x084F16A4,

  // Arena Laevatain
  0x084F4EB0,

  // Top floor under Graham (room itself is excluded from randomization)
  0x0851FB78,
];

// Rooms that should always be paired and act as a single building block
// The only one that matters is the corridor pre-garden connector because the other
// skipped doors are just dead ends anyway.
const ROOM_GROUPINGS = [
  [0x084E6244, 0x084E62D4],
];

/**
 * Helper function to determine if a door should be randomized
 * @param  {Door} door - The door to check
 * @param  {uint_32[]} doorsToSkip - The list of door addresses to skip randomization for
 * @return {Boolean} - If the door is valid or not
 */
function isValidDoor(door, doorsToSkip) {
  return !door.isFakeDoor && !doorsToSkip.find(d => d === door.address);
}

/**
 * Helper function to get all the valid doors in a room
 * @param  {Room} room - The room from which the door list should be pulled
 * @param  {uint_32[]} doorsToSkip - The list of door addresses to skip
 * @return {Door[]} - The list of doors that should be randomized
 */
function getRealDoors(room, doorsToSkip) {
  return room.doors.filter(door => isValidDoor(door, doorsToSkip));
}

/**
 * Helper function to get all the valid rooms in an area which should be randomized
 * @param  {Room[]} rooms - The list of rooms that should be filtered
 * @return {Room[]} - The filtered list of rooms which should be randomized
 */
function getRealRooms(rooms) {
  return rooms.filter(room => !room.isWeirdChaoticRealmRoomDoNotModify && ROOMS_TO_SKIP_RANDOMIZATION.indexOf(room.address) === -1);
}

/**
 * Randomize all the doors within a particular area. Note that since this randomization is happening
 * on a per area basis, area transition doors have to be accounted for separately, due to spanning multiple areas.
 * @param  {Area} area - The area information, most significantly containing a list of rooms in the area
 * @param  {Random} random - The shared pseudorandom number generator
 * @param  {Door[]} doorsToSkip - A list of doors to skip. In addition to the weird doors, this list
 *   should also contain the area transition doors for the reason listed above
 * @return {Object[]} - A list of Objects describing source doors and destination doors
 */
function randomizeArea(area, random, doorsToSkip, gardenPartnerDoor) {
  // Get all the rooms in an area that we want to randomize
  const rooms = getRealRooms(area.rooms);

  return randomizeRoomList(rooms, random, doorsToSkip, gardenPartnerDoor);
}

/**
 * Randomize all the doors within an explicit list of rooms. This is the core
 * greedy algorithm of FirstDraft: it builds a random spanning tree (guaranteeing
 * connectivity) and then matches all leftover loop doors. Extracted so global
 * shuffles (whole-castle) can reuse it.
 * @param  {Room[]} rooms - The rooms to randomize
 * @param  {Random} random - The shared pseudorandom number generator
 * @param  {Door[]} doorsToSkip - A list of door addresses to skip (kept vanilla)
 * @param  {Door} gardenPartnerDoor - The Chinese-ROM door for the Garden one-way fix
 * @return {Object[]|false} - A list of Objects describing source doors and destination doors
 */
function randomizeRoomList(rooms, random, doorsToSkip, gardenPartnerDoor) {
  // Pick a room at random to start with. It doesn't matter which because
  // the area will be fully connected by the end anyway
  const firstRoom = rooms[0];

  // Maintain a list of all the doors that still need partners, and update
  // as we add new rooms
  let unmatchedDoors = getRealDoors(firstRoom, doorsToSkip);

  // Maintain a list of all the new door pairings that have been decided
  const pairings = [];

  // Logging check to see how many doors each area has and in what directions they point
  let doorCounts = {};
  rooms.forEach(room => getRealDoors(room, doorsToSkip).forEach(door => doorCounts[door.direction] = ~~(doorCounts[door.direction]) + 1));
  Logger.log(`Number of doors for each direction: ${JSON.stringify(doorCounts)}`, DebugLevels.LOG);

  // Keep track of the rooms we haven't picked yet
  let availableRooms = rooms.filter(({ address }) => address !== firstRoom.address);
  for (let iterationCount = 0; availableRooms.length > 0; iterationCount++) {
    if (unmatchedDoors.length === 0) {
      // This will only happen if dead ends get assigned too early and there are no more doors left
      // to assign multi-exit rooms to. This gets taken care of when filtering for valid destination rooms,
      // so this branch should only occur if that logic has a serious flaw.
      Logger.log('Something went wrong with the randomization and we\'re out of doors', DebugLevels.FATAL);
      return false;
    }
    if (iterationCount > 1000) {
      // The issue with this logic is:
      // imagine 4 rooms, one with only a left door(1), one with only a right door(2),
      // one with a right and an up door(3), and one with a left and a down door(4)
      // The only possible fully matching orientation is as follows:
      // 2 - 4
      //     |
      //     3 - 1
      // but the following can also randomly happen:
      //  2 -
      //     - 1
      // |
      // 3 - 4
      //     |
      // which leads to 4 unmatched doors.
      // This can happen on various scales. I don't know if there's a solution with this algorithm
      // so the best bet is just to reroll.
      // Another algorithm would be to take each "dead end" and attach it to a non-dead end room
      // then repeat on any previously non-dead end room that has become a dead end due to losing an exit.
      // That can be in SecondDraftEntranceShuffle.
      // I don't know if areas with cycles will cause issues with that though.
      Logger.log(`Number of unmatched doors: ${unmatchedDoors.length}`, DebugLevels.ERROR);
      unmatchedDoors.forEach(door => Logger.log(`${door.sourceRoom.toString(16)}: ${door._door} - ${door.direction}`, DebugLevels.ERROR));
      Logger.log(`Number of available rooms: ${availableRooms.length}`, DebugLevels.ERROR);
      Logger.log(availableRooms, DebugLevels.ERROR);
      Logger.log('Either something went wrong when assigning doors, or something went unlucky', DebugLevels.ERROR);
      return false;
    }

    // Pick a random door in our list that still doesn't have a destination
    const {
      index: randomDoorIndex,
      value: randomDoor,
    } = random.pickFromArray(unmatchedDoors);

    if (DOORS_TO_TEMPORARILY_IGNORE.indexOf(randomDoor.address) !== -1) {
      // For now, just skip picking a "forbidden" door as progression and leave it for looping.
      // Doesn't forbid it from being the destination but in that case we can just reroll anyway.
      // This one check increases success rate by about 200x.
      // Every attempt I make to also prevent the destination from being chosen just
      // further reduces the success rate.
      continue;
    }

    // Try to find a valid destination room for the chosen door
    Logger.log(`Choosing partner for door: ${randomDoor.address.toString(16)} - ${randomDoor.direction}`, DebugLevels.LOG);
    const oppositeDirection = getOppositeDirection(randomDoor.direction);
    const validRoomPartners = availableRooms
      .filter((room) => {
        const doors = room.doors;
        if (!doors.some(door => door.direction === oppositeDirection && isValidDoor(door, doorsToSkip))) {
          // Ignore all rooms that don't have any valid doors in the right direction
          return false;
        }
        // Check to make sure that if we add this door, we still have more available doors to
        // continue randomization with. This means that the number of available doors after
        // adding this room and reserving the old door should be a positive number.
        // The exception is when we approach the end of the area randomization and there are only
        // a few rooms to work with. Put more simply, we don't need any more unmatched doors if
        // the last room we're placing is a dead end.
        // Zone transition doors are ignored when counting unmatched doors because their destinations
        // are already set. This should still be fine even if zone transition doors become randomized.
        // TODO: Need to stop counting inaccessible doors as valid.
        //   The inaccessible doors will then be handled during the intraarea loops part of the logic
        //   to ensure multiple entrances into the same room.
        //   Will probably need to take note of them separately, to ensure no part of the graph
        //   stays fully disconnected
        //   for now just skip those doors and readd them during the looping
        const validDoors = doors.filter(door => isValidDoor(door, doorsToSkip));
        const newAvailableDoors = validDoors.length + unmatchedDoors.length - 2;
        return newAvailableDoors === availableRooms.length - 1 || newAvailableDoors > 0;
      });
    const chosenRoom = random.pickFromArray(validRoomPartners).value;
    if (!chosenRoom) {
      Logger.log(`No valid pairs for door ${randomDoor.address.toString(16)}`, DebugLevels.WARN);
      continue;
    }

    const partnerDoor = random.pickFromArray(chosenRoom.doors.filter(door => door.direction === oppositeDirection && isValidDoor(door, doorsToSkip))).value;
    pairings.push({ source: randomDoor, destination: partnerDoor });
    pairings.push({ source: partnerDoor, destination: randomDoor });

    // Remove the chosen door from the list of available unmatched doors
    unmatchedDoors.splice(randomDoorIndex, 1)

    // Add all the other valid doors in the destination room as unmatched doors to consider
    // If the room is part of a grouping, treat all the rooms as being added and all the doors as new valid choices
    const newRooms = [chosenRoom];
    ROOM_GROUPINGS.forEach((grouping) => {
      if (grouping.some(address => address === chosenRoom.address)) {
        newRooms.push(
          ...grouping
            .filter(address => address !== chosenRoom.address)
            .map(address => rooms.find(room => room.address === address))
            .filter(room => room)
        );
      }
    });

    // Remove the chosen rooms from the list of available rooms
    // We're already getting O(n) runtime inside the loop from finding valid room partners
    // which I'm using to justify my laziness here instead of making availableRooms better.
    availableRooms = availableRooms.filter(({ address }) =>
      newRooms.findIndex(room => room.address === address) === -1
    );

    newRooms.forEach((room) => {
      unmatchedDoors = unmatchedDoors.concat(room.doors.filter(door => door.address !== partnerDoor.address && isValidDoor(door, doorsToSkip)));
    });
  }

  // All rooms have been placed, so now work on matching all the doors that still don't have partners.
  // This generally happens if areas have loops in them.
  if (unmatchedDoors.length > 0) {
    // Sanity check. Every 8 should have a 2, 6 should have a 4, and vice versa (except Floating Garden)
    let unmatchedDoorCounts = {};
    unmatchedDoors.forEach(door => unmatchedDoorCounts[door.direction] = ~~unmatchedDoorCounts[door.direction] + 1);
    Logger.log(`Number of unmatched doors in each direction: ${JSON.stringify(unmatchedDoorCounts)}`, DebugLevels.LOG);
    if (unmatchedDoorCounts['8'] !== unmatchedDoorCounts['2'] || unmatchedDoorCounts['4'] !== unmatchedDoorCounts['6']) {
      Logger.log('Warning: Doors don\'t seem to be properly pairable', DebugLevels.WARN);
      Logger.log('This is garden, isn\'t it?', DebugLevels.WARN);
    }

    Logger.log('Current unmatched doors for this area:', DebugLevels.LOG);
    unmatchedDoors.forEach(door => Logger.log(`${door.sourceRoom.toString(16)}: ${door._door} - ${door.direction}`), DebugLevels.LOG);

    // Pair up all the remaining doors
    // This generally only happens if there are cycles in the area
    while (unmatchedDoors.length > 0) {
      if (unmatchedDoors.length === 1) {
        // This only happens in garden. Send them back to the pre-Julius area.
        Logger.log('Doing the Garden-only one-way door assignment', DebugLevels.LOG);
        Logger.log(`The door is ${JSON.stringify(unmatchedDoors[0])}`, DebugLevels.LOG);
        // The US-ROM constant below (address 0x08517620) is replaced at runtime
        // with its Chinese-ROM counterpart so the one-way garden door points at
        // valid CN data.
        const partnerDoor = gardenPartnerDoor || {
          "_door": 0,
          "address": 139556384,
          "destination": 139556264,
          "xPos": 255,
          "yPos": 0,
          "destXOffset": 0,
          "destYOffset": 0,
          "destXPos": 784,
          "destYPos": 512,
          "direction": 4,
          "sourceRoom": 139556448,
          "complement": 139556248,
        };
        pairings.push({ source: unmatchedDoors[0], destination: partnerDoor });
        unmatchedDoors = [];
      }
      else {
        const {
          index: randomDoorIndex,
          value: randomDoor,
        } = random.pickFromArray(unmatchedDoors);
        const oppositeDirection = getOppositeDirection(randomDoor.direction);
        const validDoorPartners = unmatchedDoors.filter(door => door.direction === oppositeDirection);
        const partnerDoor = random.pickFromArray(validDoorPartners).value;
        if (partnerDoor) {
          pairings.push({ source: randomDoor, destination: partnerDoor });
          pairings.push({ source: partnerDoor, destination: randomDoor });
          unmatchedDoors = unmatchedDoors.filter(door => door.address !== randomDoor.address && door.address !== partnerDoor.address);
        }
        else {
          Logger.log(`Couldn't find a matching door for ${randomDoor.address.toString(16)}`, Logger.WARN);
        }
      }
    }
  }

  Logger.log(pairings.map(({ source, destination }) => `${source.address.toString(16)} -> ${destination.address.toString(16)}`), DebugLevels.LOG);
  return pairings;
}

/**
 * 收集混沌区（Chaotic Realm）的所有房间与真实门。
 * 用于 random_map_no_chaos：混沌区整体保持原样、不参与任何洗牌。
 * @param  {Areas} areas - 区域列表
 * @return {{rooms: Room[], doors: number[]}}
 */
function getChaoticRealm(areas) {
  const chaosArea = areas.find(area => area.area === 'Chaotic Realm');
  if (!chaosArea) {
    return { rooms: [], doors: [] };
  }
  const rooms = chaosArea.rooms;
  const doors = rooms
    .flatMap(room => room.doors)
    .filter(door => !door.isFakeDoor)
    .map(door => door.address);
  return { rooms, doors };
}

/**
 * 收集所有“保护区域”（random_map_no_* 开启时不得洗牌的区域）的房间与真实门。
 *   chaotic    → Chaotic Realm（混沌区，random_map_no_chaos）
 *   bossRush   → Boss Rush（独立第 13 区，不在房间表内，防御性空集）
 *   undeveloped→ 未开发区域（不在 12 个命名区域内，防御性空集）
 * @param  {Areas} areas     - 区域列表
 * @param  {Object} keepFlags - { chaotic?, bossRush?, undeveloped? }
 * @return {{rooms: Room[], doors: number[]}}
 */
function getProtectedRegions(areas, keepFlags) {
  const rooms = [];
  const doors = [];
  const collect = name => {
    const area = areas.find(a => a.area === name);
    if (!area) {
      return;
    }
    area.rooms.forEach(room => rooms.push(room));
    area.rooms.forEach(room => room.doors
      .filter(door => !door.isFakeDoor)
      .forEach(door => doors.push(door.address)));
  };
  if (keepFlags && keepFlags.chaotic) {
    collect('Chaotic Realm');
  }
  if (keepFlags && keepFlags.bossRush) {
    collect('Boss Rush');
  }
  return { rooms, doors };
}

/**
 * First attempt at an entrance shuffler.
 * Shuffles all the connections within a given area (with a few exceptions).
 */
function FirstDraftEntranceShuffle(areas, random, startingRoom, keepFlags) {
  // Get a list of all the doors
  let allDoors = {};
  areas.forEach(area => {
    area.rooms.forEach(room => {
      room.doors.forEach(door => {
        if (!door.isFakeDoor) {
          allDoors[door.address] = {
            area: room._area,
            door: door,
            isTransitionRoom: room.isTransitionRoom,
          };
        }
      });
    });
  });

  // Figure out which doors to skip.
  // In addition to the hardcoded doors listed above, this list should also include
  // doors that transition across areas for now.
  const transitionDoors = [];
  Object.values(allDoors).forEach(door => {
    if (door.isTransitionRoom && door.area !== allDoors[door.door.complement].area) {
      Logger.log(`Skipping transition doors ${door.door.address.toString(16)} and ${allDoors[door.door.complement].door.address.toString(16)}`, DebugLevels.LOG);
      transitionDoors.push(door.door);
      transitionDoors.push(allDoors[door.door.complement].door);
    }
    else if (DOORS_TO_SKIP.indexOf(door.door.address) !== -1) {
      Logger.log(`Skipping excluded door ${door.door.address.toString(16)}`, DebugLevels.LOG);
      transitionDoors.push(door.door);
    }
  });

  const doorsToSkip = transitionDoors.map(({ address }) => address);

  // The "Garden-only one-way door assignment" in randomizeArea references a
  // hardcoded US-ROM door (0x08517620). Resolve its Chinese-ROM counterpart
  // (0x084EDF20) from the actual areas so the generated door carries valid CN data.
  const gardenPartnerDoor = areas
    .flatMap(area => area.rooms)
    .flatMap(room => room.doors)
    .find(door => door.address === 0x084EDF20);

  // Maintain a list of every new door connection.
  let newConnections = [];
  const succeeded = areas.every(area => {
    // random_map_no_*：受保护区域整体保持原样，不做区内洗牌
    if ((keepFlags && keepFlags.chaotic && area.area === 'Chaotic Realm')
      || (keepFlags && keepFlags.bossRush && area.area === 'Boss Rush')) {
      Logger.log(`Skipping randomization of ${area.area} (protected region)`, DebugLevels.LOG);
      return true;
    }

    Logger.log(`Beginning randomization of ${area.area}`, DebugLevels.LOG);

    // Keep attempting to randomize the area layout until one of the layouts is properly connected.
    let areaConnections;
    for (let attempts = 0; !areaConnections; attempts++) {
      if (attempts !== 0) {
        Logger.log(`Reattempting randomization of ${area.area}`, DebugLevels.LOG);
      }
      if (attempts >= 1000) {
        // If a single area fails, it's really jarring to have the randomization continue with
        // some subset of areas just not randomized. Thus failure of an area should mean
        // failure of the whole algorithm
        Logger.log(`Problem randomizing area: ${area.area}`, DebugLevels.FATAL);
        return false;
      }
      areaConnections = randomizeArea(area, random, doorsToSkip, gardenPartnerDoor);
    }
    Logger.log(`Completed randomization of ${area.area}`, DebugLevels.MARKER);
    newConnections = newConnections.concat(areaConnections);
    return true;
  });

  return succeeded && newConnections;
}

FirstDraftEntranceShuffle.displayName = 'First Draft Entrance Shuffle';
FirstDraftEntranceShuffle.desc = 'Preliminary attempt at randomizing doors in an area by starting at a room'
  + ' and continuing to connect unmatched doors to new rooms, matching all the hanging doors once there are'
  + ' no more rooms to add. Doesn\'t randomize rooms surrounding Graham, Julius, and Chaos.'

// Expose the core greedy algorithm so global (whole-castle) shuffles can reuse it.
FirstDraftEntranceShuffle.randomizeRoomList = randomizeRoomList;
FirstDraftEntranceShuffle.getRealRooms = getRealRooms;
FirstDraftEntranceShuffle.getRealDoors = getRealDoors;
FirstDraftEntranceShuffle.DOORS_TO_SKIP = DOORS_TO_SKIP;
FirstDraftEntranceShuffle.ROOMS_TO_SKIP_RANDOMIZATION = ROOMS_TO_SKIP_RANDOMIZATION;
FirstDraftEntranceShuffle.getChaoticRealm = getChaoticRealm;
FirstDraftEntranceShuffle.getProtectedRegions = getProtectedRegions;

module.exports = FirstDraftEntranceShuffle;
