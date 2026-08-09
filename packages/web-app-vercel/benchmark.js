const { performance } = require('perf_hooks');

const ITEMS_COUNT = 100000;
const LOOKUP_COUNT = 1000;

const items = [];
for (let i = 0; i < ITEMS_COUNT; i++) {
  items.push({ id: `item_${i}` });
}

// Generate some random ids to look up
const lookups = [];
for (let i = 0; i < LOOKUP_COUNT; i++) {
  lookups.push(`item_${Math.floor(Math.random() * ITEMS_COUNT)}`);
}

// Baseline: findIndex
const startBaseline = performance.now();
for (const id of lookups) {
  const index = items.findIndex((item) => item.id === id);
}
const endBaseline = performance.now();
const baselineTime = endBaseline - startBaseline;

// Optimization: Map
// Include map building time if we want to be fair, or maybe not since it happens on render once.
const startMapBuild = performance.now();
const map = new Map();
for (let i = 0; i < items.length; i++) {
  map.set(items[i].id, i);
}
const endMapBuild = performance.now();
const mapBuildTime = endMapBuild - startMapBuild;

const startOpt = performance.now();
for (const id of lookups) {
  const index = map.get(id) ?? -1;
}
const endOpt = performance.now();
const optTime = endOpt - startOpt;

console.log(`Baseline (findIndex) for ${LOOKUP_COUNT} lookups in ${ITEMS_COUNT} items: ${baselineTime.toFixed(4)} ms`);
console.log(`Map build time: ${mapBuildTime.toFixed(4)} ms`);
console.log(`Optimization (Map.get) for ${LOOKUP_COUNT} lookups: ${optTime.toFixed(4)} ms`);
console.log(`Total time for Map (build + lookup): ${(mapBuildTime + optTime).toFixed(4)} ms`);
