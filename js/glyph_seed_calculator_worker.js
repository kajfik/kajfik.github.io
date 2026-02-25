// Glyph effects indexed by numeric type (0=power, 1=infinity, 2=replication, 3=time, 4=dilation)
const GLYPH_EFFECTS_BY_TYPE = [
  [16, 17, 18, 19], // power
  [12, 13, 14, 15], // infinity
  [8, 9, 10, 11],   // replication
  [0, 1, 2, 3],     // time
  [4, 5, 6, 7],     // dilation
];

const SECOND_GAUSSIAN_DEFAULT_VALUE = 1e6;
const maxSeed = 4294967295;
let workerMaxSeed = maxSeed;
const REALITIES_BEFORE_REDRAW = 1000000;

const factorials = [1, 1, 2, 6, 24, 120];

const permutations4 = new Array(120);
const permutations5 = new Array(120);

function getPermutation(index, n) {
  const perm = n === 5 ? [0, 1, 2, 3, 4] : [0, 1, 2, 3];
  const result = [];
  let fact = factorials[n - 1];
  for (let i = n; i > 0; i--) {
    const pos = Math.floor(index / fact);
    result.push(perm.splice(pos, 1)[0]);
    index %= fact;
    if (i > 1) fact /= i - 1;
  }
  return result;
}

// Initialise both permutation tables (120 entries each)
for (let p = 0; p < 120; p++) {
  permutations4[p] = getPermutation(p, 4);
  permutations5[p] = getPermutation(p, 5);
}

// Pre-compute: for each removedTypeIndex (0-4) and type (0-4),
// the index of 'type' in [0,1,2,3,4] after removing 'removedTypeIndex'.
// Value is -1 when type === removedTypeIndex (should never be used in that case).
const TYPE_INDEX_LOOKUP = [];
for (let removed = 0; removed < 5; removed++) {
  const arr = [0, 1, 2, 3, 4];
  arr.splice(removed, 1);
  const row = [-1, -1, -1, -1, -1];
  for (let type = 0; type < 5; type++) {
    if (type !== removed) row[type] = arr.indexOf(type);
  }
  TYPE_INDEX_LOOKUP.push(row);
}

// Pre-compute: for each permIndex (0-119) and groupIndex (0-4),
// the typePermIndex array — how many times each type was non-removed
// in realities 0 through groupIndex-1.
const PERM_TYPE_INDEX = [];
for (let p = 0; p < 120; p++) {
  const perm = permutations5[p];
  const rows = [];
  const counts = [0, 0, 0, 0, 0];
  for (let g = 0; g < 5; g++) {
    rows.push(counts.slice());
    for (let t = 0; t < 5; t++) {
      if (t !== perm[g]) counts[t]++;
    }
  }
  PERM_TYPE_INDEX.push(rows);
}

// Pre-compute [0,1,2,3,4] with each index removed
const TYPES_WITHOUT_REMOVED = [];
for (let i = 0; i < 5; i++) {
  TYPES_WITHOUT_REMOVED.push([0, 1, 2, 3, 4].filter(t => t !== i));
}

// ── RNG & glyph computation ───────────────────────────────────────────────────

let seed = 0;
let secondGaussian = SECOND_GAUSSIAN_DEFAULT_VALUE;
let initialSeed = 0;

function uniform() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed * 2.3283064365386963e-10 + 0.5;
}

function rarityToStrength(x) {
  return x * 2.5 / 100 + 1;
}

function strengthToRarity(x) {
  return (x - 1) * 100 / 2.5;
}

function randomStrength(realityCount) {
  let normal;
  if (secondGaussian !== SECOND_GAUSSIAN_DEFAULT_VALUE) {
    normal = secondGaussian;
    secondGaussian = SECOND_GAUSSIAN_DEFAULT_VALUE;
  } else {
    let u = 0, v = 0, s = 0;
    do {
      u = uniform() * 2 - 1;
      v = uniform() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    s = Math.sqrt(-2 * Math.log(s) / s);
    secondGaussian = v * s;
    normal = u * s;
  }
  const x = Math.sqrt(Math.abs(normal) + 1);
  let result = -0.111749606737000 + x * (0.900603878243551 + x * (0.229108274476697 + x * -0.017962545983249));
  result *= (realityCount >= 5) ? 1.3 : 1.0;
  uniform();
  result = Math.ceil(result * 400) / 400;
  return Math.min(result, rarityToStrength(100));
}

// Generates a bitmask of effects for a glyph of the given numeric type index.
// Consumes exactly 7 uniform() calls to preserve RNG state parity with the
// original mapToObject-based implementation.
function generateEffects(typeIdx, count) {
  const effectIDs = GLYPH_EFFECTS_BY_TYPE[typeIdx];
  const s0 = uniform();
  const s1 = uniform();
  const s2 = uniform();
  const s3 = uniform();
  uniform(); uniform(); uniform();

  // Guaranteed effects (IDs 0, 12, 16) always win selection
  const scores = [
    (effectIDs[0] === 0 || effectIDs[0] === 12 || effectIDs[0] === 16) ? 2 : s0,
    (effectIDs[1] === 0 || effectIDs[1] === 12 || effectIDs[1] === 16) ? 2 : s1,
    (effectIDs[2] === 0 || effectIDs[2] === 12 || effectIDs[2] === 16) ? 2 : s2,
    (effectIDs[3] === 0 || effectIDs[3] === 12 || effectIDs[3] === 16) ? 2 : s3,
  ];

  const sorted = [0, 1, 2, 3].sort((a, b) => scores[b] - scores[a]);
  let result = 0;
  for (let i = 0; i < count; i++) {
    result |= 1 << effectIDs[sorted[i]];
  }
  return result;
}

function getBitIndexes(num) {
  const indexes = [];
  let index = 0;
  while (num > 0) {
    if (num & 1) indexes.push(index);
    num >>= 1;
    index++;
  }
  return indexes;
}

function uniformGlyphs(level, realityCount) {
  const groupIndex = (realityCount - 1) % 5;
  const permIndex = (initialSeed % 1123) % 120;
  const typePerm = permutations5[permIndex];
  const typePermIndex = PERM_TYPE_INDEX[permIndex][groupIndex];
  const startID = [16, 12, 8, 0, 4];
  const effectMod = initialSeed % 11;
  const typesThisReality = TYPES_WITHOUT_REMOVED[typePerm[groupIndex]];

  const uniformEffects = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const type = typesThisReality[i];
    const effectPerm = permutations4[(5 * type + effectMod) % 24];
    uniformEffects[i] = startID[type] + effectPerm[typePermIndex[type]];
  }

  const glyphs = [];
  for (let i = 0; i < 4; ++i) {
    const strength = randomStrength(realityCount);
    const typeIdx = typesThisReality[i];
    const random1 = uniform();
    uniform(); // random2 — advances RNG state, value unused
    const numEffects = Math.min(
      4,
      Math.floor(Math.pow(random1, 1 - (Math.pow(level * strength, 0.5)) / 100) * 1.5 + 1)
    );

    const effects = generateEffects(typeIdx, numEffects);
    const newGlyph = { typeIdx, strength, level, effects };

    const newMask = (initialSeed + realityCount + i) % 2 === 0
      ? (1 << uniformEffects[i])
      : newGlyph.effects | (1 << uniformEffects[i]);

    // Popcount via bit-twiddling
    let b = newMask;
    b = b - ((b >> 1) & 0x55555555);
    b = (b & 0x33333333) + ((b >> 2) & 0x33333333);
    b = (b + (b >> 4)) & 0x0f0f0f0f;
    b = b + (b >> 8);
    b = b + (b >> 16);
    const count = b & 0x3f;

    if (count > 2) {
      const replacable = getBitIndexes(newGlyph.effects)
        .filter(eff => eff !== 0 && eff !== 12 && eff !== 16);
      const toRemove = replacable[Math.abs(initialSeed + realityCount) % replacable.length];
      newGlyph.effects = newMask & ~(1 << toRemove);
    } else {
      newGlyph.effects = newMask;
    }

    // Ensure guaranteed effects per type
    if (typeIdx === 0)      newGlyph.effects |= 1 << 16; // power
    else if (typeIdx === 1) newGlyph.effects |= 1 << 12; // infinity
    else if (typeIdx === 3) newGlyph.effects |= 1 << 0;  // time

    glyphs.push(newGlyph);
  }

  const strengthThreshold = 1.5;
  const random = uniform();
  let newStrength;
  do {
    newStrength = randomStrength(realityCount);
  } while (newStrength < strengthThreshold);
  if (glyphs.every(e => e.strength < strengthThreshold)) {
    glyphs[Math.floor(random * glyphs.length)].strength = newStrength;
  }

  return glyphs;
}

// Returns seeds in [minValue, maxValue] that pass the fast type/effect filter.
function generateValidInitSeeds(types, effects, minValue, maxValue) {
  const validSeeds = [];
  for (let s = minValue; s <= maxValue; s++) {
    const permIndex = (s % 1123) % 120;
    const perm = permutations5[permIndex];
    const effectMod = s % 11;
    let isValid = true;

    for (let r = 0; r < types.length; r++) {
      const type = types[r];
      const groupIndex = r % 5;
      const removedTypeIndex = perm[groupIndex];

      if (removedTypeIndex === type) { isValid = false; break; }

      const typeIndex = TYPE_INDEX_LOOKUP[removedTypeIndex][type];
      if ((s + r + 1 + typeIndex) % 2 !== 0) continue;

      if (type === 2 || type === 4) { isValid = false; break; }

      const effectPerm = permutations4[(5 * type + effectMod) % 24];
      const typePermIdx = PERM_TYPE_INDEX[permIndex][groupIndex][type];
      if (effects[r] !== effectPerm[typePermIdx]) { isValid = false; break; }
    }

    if (isValid) validSeeds.push(s);
  }
  return validSeeds;
}

// ── Worker simulation state ───────────────────────────────────────────────────

let requiredTypes = [];
let requiredEffects = [];
let requiredSecondEffectsAdjusted = [];

let checked = 0;
let foundSeeds = 0;
let bestMinRarity, bestMinRaritySeed, bestMinRaritySeedRarities;
let bestAverageRarity, bestAverageRaritySeed, bestAverageRaritySeedRarities;
let bestMaxRarity, bestMaxMinRarity, bestMaxRaritySeed, bestMaxRaritySeedRarities;
let worstMaxRarity, worstMaxRaritySeed, worstMaxRaritySeedRarities;
let running = false;

function buildProgressPayload(speed) {
  return {
    checked, foundSeeds, speed,
    bestMinRarity, bestMinRaritySeed, bestMinRaritySeedRarities,
    bestAverageRarity, bestAverageRaritySeed, bestAverageRaritySeedRarities,
    bestMaxRarity, bestMaxMinRarity, bestMaxRaritySeed, bestMaxRaritySeedRarities,
    worstMaxRarity, worstMaxRaritySeed, worstMaxRaritySeedRarities,
  };
}

function step() {
  if (!running) return;

  const stepStart = Date.now();
  const batchEnd = Math.min(checked + REALITIES_BEFORE_REDRAW, workerMaxSeed);

  const validInitSeeds = generateValidInitSeeds(
    requiredTypes, requiredSecondEffectsAdjusted, checked + 1, batchEnd
  );

  for (let v = 0; v < validInitSeeds.length; v++) {
    initialSeed = validInitSeeds[v];
    seed = initialSeed;
    secondGaussian = SECOND_GAUSSIAN_DEFAULT_VALUE;

    let found = true;
    const rarities = [];
    const permIndex = (initialSeed % 1123) % 120;

    for (let i = 1; i <= requiredEffects.length; i++) {
      const glyphs = uniformGlyphs(1, i);
      const groupIndex = (i - 1) % 5;
      const removedTypeIdx = permutations5[permIndex][groupIndex];
      const typeInRealityIdx = TYPE_INDEX_LOOKUP[removedTypeIdx][requiredTypes[i - 1]];
      const glyph = glyphs[typeInRealityIdx];

      if (glyph === undefined || glyph.effects !== requiredEffects[i - 1]) {
        found = false;
        break;
      }
      rarities.push(strengthToRarity(glyph.strength));
    }

    if (found) {
      foundSeeds++;
      const minRarity = Math.min(...rarities);
      const avgRarity = rarities.reduce((p, c, _, a) => p + c / a.length, 0);
      const maxRarity = Math.max(...rarities);

      if (minRarity > bestMinRarity) {
        bestMinRarity = minRarity;
        bestMinRaritySeed = initialSeed;
        bestMinRaritySeedRarities = rarities.slice();
      }
      if (avgRarity > bestAverageRarity) {
        bestAverageRarity = avgRarity;
        bestAverageRaritySeed = initialSeed;
        bestAverageRaritySeedRarities = rarities.slice();
      }
      if (maxRarity > bestMaxRarity || (maxRarity >= bestMaxRarity && minRarity > bestMaxMinRarity)) {
        bestMaxRarity = maxRarity;
        bestMaxMinRarity = minRarity;
        bestMaxRaritySeed = initialSeed;
        bestMaxRaritySeedRarities = rarities.slice();
      }
      if (maxRarity < worstMaxRarity) {
        worstMaxRarity = maxRarity;
        worstMaxRaritySeed = initialSeed;
        worstMaxRaritySeedRarities = rarities.slice();
      }
    }
  }

  checked = batchEnd;
  const elapsed = (Date.now() - stepStart) / 1000;
  const speed = (REALITIES_BEFORE_REDRAW / elapsed).toFixed(2);

  if (checked >= workerMaxSeed) {
    running = false;
    postMessage({ type: 'done', data: buildProgressPayload(speed) });
  } else {
    postMessage({ type: 'progress', data: buildProgressPayload(speed) });
    setTimeout(step, 0);
  }
}

onmessage = function(e) {
  if (e.data.type !== 'start') return;
  const c = e.data.config;

  requiredTypes = c.requiredTypes;
  requiredEffects = c.requiredEffects;
  requiredSecondEffectsAdjusted = c.requiredSecondEffectsAdjusted;
  checked = c.checked;
  foundSeeds = c.foundSeeds;
  bestMinRarity = c.bestMinRarity;
  bestMinRaritySeed = c.bestMinRaritySeed;
  bestMinRaritySeedRarities = c.bestMinRaritySeedRarities;
  bestAverageRarity = c.bestAverageRarity;
  bestAverageRaritySeed = c.bestAverageRaritySeed;
  bestAverageRaritySeedRarities = c.bestAverageRaritySeedRarities;
  bestMaxRarity = c.bestMaxRarity;
  bestMaxMinRarity = c.bestMaxMinRarity;
  bestMaxRaritySeed = c.bestMaxRaritySeed;
  bestMaxRaritySeedRarities = c.bestMaxRaritySeedRarities;
  worstMaxRarity = c.worstMaxRarity;
  worstMaxRaritySeed = c.worstMaxRaritySeed;
  worstMaxRaritySeedRarities = c.worstMaxRaritySeedRarities;

  workerMaxSeed = c.workerMaxSeed !== undefined ? c.workerMaxSeed : maxSeed;
  running = true;
  step();
};
