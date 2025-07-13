// A simple global store
const mappingsByRace = {};

function saveMapping(raceId, map) {
  mappingsByRace[raceId] = map;
}

function getMapping(raceId) {
  return mappingsByRace[raceId] || {};
}

module.exports = { saveMapping, getMapping };
