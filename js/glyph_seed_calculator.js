const glyph_amount_text = document.getElementById("glyph_amount");
const glyphs_textarea = document.getElementById("glyphs");
const pause_button = document.getElementById("pause_button");
const export_button = document.getElementById("export_button");
pause_button.style.visibility = "hidden";
export_button.style.visibility = "hidden";

const REALITIES_BEFORE_REDRAW = 1000000;
const maxSeed = 4294967295;
const SECOND_GAUSSIAN_DEFAULT_VALUE = 1e6;

let requiredTypes = []; //[0, 3];
let requiredEffects = []; //[327680, 9];
let requiredSecondEffectsAdjusted = [];
let requiredEffectsExport = [];
let simulationStartAbsolute;

let initialSeed = -1;
let seed = -1;
let secondGaussian = SECOND_GAUSSIAN_DEFAULT_VALUE;
let checked = 0;
let foundSeeds = 0;

let bestMinRarity = -1;
let bestMinRaritySeed = -1;
let bestMinRaritySeedRarities = [];

let bestAverageRarity = -1;
let bestAverageRaritySeed = -1;
let bestAverageRaritySeedRarities = [];

let bestMaxRarity = -1;
let bestMaxMinRarity = -1;
let bestMaxRaritySeed = -1;
let bestMaxRaritySeedRarities = [];

let worstMaxRarity = 101;
let worstMaxRaritySeed = -1;
let wortsMaxRaritySeedRarities = [];

let started = false;
let running = false;

BASIC_GLYPH_TYPES = [
  "power",
  "infinity",
  "replication",
  "time",
  "dilation"
]

GLYPH_EFFECTS = {
  "power": [16, 17, 18, 19],
  "infinity": [12, 13, 14, 15],
  "replication": [8, 9, 10, 11],
  "time": [0, 1, 2, 3],
  "dilation": [4, 5, 6, 7]
}



function pause() {
  if (started) {
    running = !running;
    pause_button.innerHTML = running ? "PAUSE" : "RESUME";
    if (running) setTimeout(calculateRealities, 0);
  }
}

function calculate() {
  initPermuations();

  checked = 0;
  foundSeeds = 0;

  bestMinRarity = -1;
  bestMinRaritySeed = -1;

  bestAverageRarity = -1;
  bestAverageRaritySeed = -1;

  bestMaxRarity = -1;
  bestMaxMinRarity = -1;
  bestMaxRaritySeed = -1;

  worstMaxRarity = 101;
  worstMaxRaritySeed = -1;

  simulationStartAbsolute = null;

  glyphs_textarea.innerHTML = "Seeds simulated: " + checked + "/" + maxSeed + ", 0.00%<br>" + "Simulation speed: 0.00 seeds/s";;

  const glyphAmount = parseInt(glyph_amount_text.value);

  requiredTypes = [];
  requiredEffects = [];
  requiredEffectsExport = [];
  requiredSecondEffectsAdjusted = [];
  const startID = [16, 12, 8, 0, 4];

  for (let g = 1; g <= glyphAmount; g++) {
    const typeSelect = document.getElementById(`glyph${g}_type`);
    const type = parseInt(typeSelect.value);
    requiredTypes.push(type);

    const secondSelect = document.getElementById(`glyph${g}_second`);
    const thirdSelect = document.getElementById(`glyph${g}_third`);
    requiredEffects.push((1 << parseInt(secondSelect.value)) + (1 << parseInt(thirdSelect.value)));
    requiredSecondEffectsAdjusted.push(parseInt(thirdSelect.value) - startID[type]);
    requiredEffectsExport.push([parseInt(secondSelect.value) - startID[type], parseInt(thirdSelect.value) - startID[type]]);
  }

  const header = exportHeader();
  if (header in stored) {
    glyphs_textarea.innerHTML = convertExportToText(header)
  } else {
    started = true;
    running = true;
    export_button.style.visibility = "hidden";
    pause_button.style.visibility = "visible";
    pause_button.innerHTML = "PAUSE";
    setTimeout(calculateRealities, 100);
  }
}

function calculateRealities() {
  let simulationStart = Date.now();
  if (simulationStartAbsolute == null) {
    simulationStartAbsolute = simulationStart;
  }

  const validInitSeeds = generateValidInitSeeds(requiredTypes, requiredSecondEffectsAdjusted, checked + 1, checked + REALITIES_BEFORE_REDRAW);

  for (let v = 0; v < validInitSeeds.length; v++) {
    initialSeed = validInitSeeds[v];
    seed = initialSeed;

    secondGaussian = SECOND_GAUSSIAN_DEFAULT_VALUE;
    let found = true;
    let rarities = [];

    for (let i = 1; i <= requiredEffects.length; i++) {
      const glyphs = uniformGlyphs(1, i);
      const glyph = glyphs.find(g => g.effects == requiredEffects[i - 1]);
      if (glyph == undefined) {
        found = false;
        break;
      }
      rarities.push(strengthToRarity(glyph.strength));
    }

    if (found) {
      foundSeeds++;

      const minRarity = Math.min(...rarities);
      const avgRarity = rarities.reduce((p,c,_,a) => p + c/a.length, 0);
      const maxRarity = Math.max(...rarities);

      if (minRarity > bestMinRarity) {
        bestMinRarity = minRarity;
        bestMinRaritySeed = initialSeed;
        bestMinRaritySeedRarities = rarities;
      }

      if (avgRarity > bestAverageRarity) {
        bestAverageRarity = avgRarity;
        bestAverageRaritySeed = initialSeed;
        bestAverageRaritySeedRarities = rarities;
      }

      if (maxRarity > bestMaxRarity || maxRarity >= bestMaxRarity && minRarity > bestMaxMinRarity) {
        bestMaxRarity = maxRarity;
        bestMaxMinRarity = minRarity;
        bestMaxRaritySeed = initialSeed;
        bestMaxRaritySeedRarities = rarities;
      }

      if (maxRarity < worstMaxRarity) {
        worstMaxRarity = maxRarity;
        worstMaxRaritySeed = initialSeed;
        worstMaxRaritySeedRarities = rarities;
      }

      worstMaxRarity
    }

    if (initialSeed >= maxSeed) {
      break;
    }
  }

  checked = Math.min(checked + REALITIES_BEFORE_REDRAW, maxSeed);
  const finished = checked >= maxSeed;

  let timeElapsed;
  let speed;

  if (finished) {
    timeElapsed = (Date.now() - simulationStartAbsolute) / 1000;
    speed = (checked / timeElapsed).toFixed(2);
  } else {
    timeElapsed = (Date.now() - simulationStart) / 1000;
    speed = (REALITIES_BEFORE_REDRAW / timeElapsed).toFixed(2);
  }

  let text = "";
  
  text += "Seeds simulated: " + checked + "/" + maxSeed + ", " + (100 * checked / maxSeed).toFixed(2) + "%<br>" + "Simulation speed: " + speed + " seeds/s<br><br>";

  if (foundSeeds > 0) {
    text += "Found seeds: " + foundSeeds + "<br><br>";

    text += "Best min rarity: " + bestMinRarity.toFixed(2) + "%" + "<br>";
    text += "Rarities: " + bestMinRaritySeedRarities.map(r => r.toFixed(2) + "%").join(", ") + "<br>";
    text += "player.reality.seed = " + bestMinRaritySeed + ";<br>"
    text += "player.reality.initialSeed = " + bestMinRaritySeed + ";<br><br>"

    text += "Best average rarity: " + bestAverageRarity.toFixed(2) + "%" + "<br>";
    text += "Rarities: " + bestAverageRaritySeedRarities.map(r => r.toFixed(2) + "%").join(", ") + "<br>";
    text += "player.reality.seed = " + bestAverageRaritySeed + ";<br>"
    text += "player.reality.initialSeed = " + bestAverageRaritySeed + ";<br><br>"

    text += "Best max rarity: " + bestMaxRarity.toFixed(2) + "%" + "<br>";
    text += "Rarities: " + bestMaxRaritySeedRarities.map(r => r.toFixed(2) + "%").join(", ") + "<br>";
    text += "player.reality.seed = " + bestMaxRaritySeed + ";<br>"
    text += "player.reality.initialSeed = " + bestMaxRaritySeed + ";<br><br>"

    text += "Worst max rarity: " + worstMaxRarity.toFixed(2) + "%" + "<br>";
    text += "Rarities: " + worstMaxRaritySeedRarities.map(r => r.toFixed(2) + "%").join(", ") + "<br>";
    text += "player.reality.seed = " + worstMaxRaritySeed + ";<br>"
    text += "player.reality.initialSeed = " + worstMaxRaritySeed + ";<br><br>"
  } else {
    text += "No found seeds yet."
  }

  glyphs_textarea.innerHTML = text;

  if (!finished) {
    if (running) setTimeout(calculateRealities, 0);
  } else {
    started = false;
    running = false;
    pause_button.style.visibility = "hidden";
    export_button.style.visibility = "visible";
    export_button.innerHTML = "EXPORT";
  }
}

const factorials = [1, 1, 2, 6, 24, 120];

const permutations4 = [];
const permutations5 = [];

function initPermuations() {
  for (let p = 0; p < 120; p++) {
    permutations4.push(getPermutation(p, 4))
    permutations5.push(getPermutation(p, 5))
  }
}

function getPermutation(index, n) {
  const elements = (n == 5) ? [0, 1, 2, 3, 4] : [0, 1, 2, 3];
  const result = [];
  let perm = [...elements];
  let fact = factorials[n - 1];

  for (let i = n; i > 0; i--) {
    let pos = Math.floor(index / fact);
    result.push(perm.splice(pos, 1)[0]);
    index %= fact;
    if (i > 1) fact /= i - 1;
  }

  return result;
}

function generateValidInitSeeds(types, effects, minValue, maxValue) {
  const validSeeds = [];
  const numPerm = 120;
  const effectNumPerm = 24;

  for (let initSeed = minValue; initSeed <= maxValue; initSeed++) {
    const typeLexIndex = initSeed % 1123;
    let index = typeLexIndex % numPerm;
    const perm = permutations5[index];

    let isValid = true;

    for (let r = 0; r < types.length; r++) {
      const type = types[r];
      const groupIndex = r % 5;
      const removedTypeIndex = perm[groupIndex];

      if (removedTypeIndex == type) {
        isValid = false;
        break;
      }

      const typesThisReality = [0, 1, 2, 3, 4];
      typesThisReality.splice(removedTypeIndex, 1);
      const typeIndex = typesThisReality.findIndex(t => t == type);
      const checkEffect = (initSeed + r + 1 + typeIndex) % 2 == 0;

      if (!checkEffect) continue;
      if (type == 2 || type == 4) {
        isValid = false;
        break;
      }

      const effect = effects[r];

      const typePermIndex = [0, 0, 0, 0, 0];
      for (let i = 0; i < groupIndex; i++) {
        for (let t = 0; t < 5; t++) {
          if (t !== perm[i]) typePermIndex[t]++;
        }
      }

      const effectLexIndex = 5 * type + initSeed % 11;
      let effectIndex = effectLexIndex % effectNumPerm;
      const effectPerm = permutations4[effectIndex];

      if (effect != effectPerm[typePermIndex[type]]) {
        isValid = false;
        break;
      }
    }

    if (isValid) {
      validSeeds.push(initSeed);
    }
  }

  return validSeeds;
}

function uniformGlyphs(level, realityCount) {
  const groupIndex = (realityCount - 1) % 5;

  const initSeed = initialSeed;

  const typeLexIndex = initSeed % 1123;
  const typeLen = 5;
  const numPerm = 120;
  let index = typeLexIndex % numPerm;
  let remOrder = numPerm / typeLen;
  const ordered = [0, 1, 2, 3, 4];
  const typePerm = [];
  while (ordered.length > 0) {
    const div = Math.floor(index / remOrder);
    const rem = index % remOrder;
    typePerm.push(ordered.splice(div, 1)[0]);
    index = rem;
    remOrder /= ordered.length;
  }

  const typePermIndex = [0, 0, 0, 0, 0];
  for (let i = 0; i < groupIndex; i++) {
    for (let type = 0; type < 5; type++) {
      if (type !== typePerm[i]) typePermIndex[type]++;
    }
  }

  const uniformEffects = [];
  const startID = [16, 12, 8, 0, 4];
  const typesThisReality = [0, 1, 2, 3, 4];
  typesThisReality.splice(typePerm[groupIndex], 1);
  for (let i = 0; i < 4; i++) {
    const type = typesThisReality[i]

    const effectLexIndex = 5 * type + initSeed % 11;
    const effectLen = 4;
    const numPerm = 24;
    let index = effectLexIndex % numPerm;
    let remOrder = numPerm / effectLen;
    const ordered = [0, 1, 2, 3];
    const effectPerm = [];
    while (ordered.length > 0) {
      const div = Math.floor(index / remOrder);
      const rem = index % remOrder;
      effectPerm.push(ordered.splice(div, 1)[0]);
      index = rem;
      remOrder /= ordered.length;
    }

    uniformEffects.push(startID[type] + effectPerm[typePermIndex[type]]);
  }

  const glyphs = [];
  for (let i = 0; i < 4; ++i) {
    const strength = randomStrength(realityCount);
    const type = BASIC_GLYPH_TYPES[typesThisReality[i]]

    const random1 = uniform();
    const random2 = uniform();
    const numEffects = Math.min(
      4,
      Math.floor(Math.pow(random1, 1 - (Math.pow(level * strength, 0.5)) / 100) * 1.5 + 1)
    );
    /*if (realityCount >= 5 && random2 < 0.5) {
      numEffects = Math.min(numEffects + 1, maxEffects);
    }*/
    const effects = generateEffects(type, numEffects);
    //const rarity = strengthToRarity(strength).toFixed(2);

    const newGlyph = {
      type,
      strength,
      level,
      effects,
    };

    const newMask = (initSeed + realityCount + i) % 2 === 0
      ? (1 << uniformEffects[i])
      : newGlyph.effects | (1 << uniformEffects[i]);
    //const maxEffects = realityCount >= 5 ? 3 : 2;

    let count = 0;
    let b = newMask;
    b = b - ((b >> 1) & 0x55555555);
    b = (b & 0x33333333) + ((b >> 2) & 0x33333333);
    b = (b + (b >> 4)) & 0x0f0f0f0f;
    b = b + (b >> 8);
    b = b + (b >> 16);
    count += b & 0x3f;

    if (count > 2) {
      const replacable = getBitIndexes(newGlyph.effects)
        .filter(eff => ![0, 12, 16].includes(eff));
      const toRemove = replacable[Math.abs(initSeed + realityCount) % replacable.length];
      newGlyph.effects = newMask & ~(1 << toRemove);
    } else {
      newGlyph.effects = newMask;
    }
    

    if (type == "power") {
      newGlyph.effects |= 1 << 16;
    } else if (type == "infinity") {
      newGlyph.effects |= 1 << 12;
    } else if (type == "time") {
      newGlyph.effects |= 1 << 0;
    }

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

function randomStrength(realityCount) {
  let normal;
  if (secondGaussian !== SECOND_GAUSSIAN_DEFAULT_VALUE) {
    const toReturn = secondGaussian;
    secondGaussian = SECOND_GAUSSIAN_DEFAULT_VALUE;
    normal = toReturn;
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

  const x = Math.sqrt(Math.abs(normal, 0) + 1);
  let result = -0.111749606737000 + x * (0.900603878243551 + x * (0.229108274476697 + x * -0.017962545983249));
  result = result * ((realityCount >= 5) ? 1.3 : 1.0);
  uniform();
  result = Math.ceil(result * 400) / 400;
  return Math.min(result, rarityToStrength(100));
}

function generateEffects(type, count) {
  const effectValues = GLYPH_EFFECTS[type].mapToObject(x => x, () => uniform());
  uniform();
  uniform();
  uniform();
  for (const i of [0, 12, 16]) {
    if (i in effectValues) {
      effectValues[i] = 2;
    }
  }
  const effects = Object.keys(effectValues).sort((a, b) => effectValues[b] - effectValues[a]).slice(0, count);
  return effects.map(Number).reduce((prev, val) => prev | (1 << val), 0);
}

function rarityToStrength(x) {
  return x * 2.5 / 100 + 1;
}

function strengthToRarity(x) {
  return (x - 1) * 100 / 2.5;
}

function uniform() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed * 2.3283064365386963e-10 + 0.5;
}

function normal() {
  if (secondGaussian !== SECOND_GAUSSIAN_DEFAULT_VALUE) {
    const toReturn = secondGaussian;
    secondGaussian = SECOND_GAUSSIAN_DEFAULT_VALUE;
    return toReturn;
  }
  let u = 0, v = 0, s = 0;
  do {
    u = uniform() * 2 - 1;
    v = uniform() * 2 - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);
  s = Math.sqrt(-2 * Math.log(s) / s);
  secondGaussian = v * s;
  return u * s;
}

Array.prototype.mapToObject = function(keyFun, valueFun) {
  if (typeof keyFun !== "function" || typeof valueFun !== "function")
    throw "keyFun and valueFun must be functions";
  let out = {}
  for (let idx = 0; idx < this.length; ++idx) {
    out[keyFun(this[idx], idx)] = valueFun(this[idx], idx);
  }
  return out;
}

function getBitIndexes(num) {
  let indexes = [];
  let index = 0;
  while (num > 0) {
      if (num & 1) {
          indexes.push(index);
      }
      num >>= 1;
      index++;
  }
  return indexes;
}

function exportHeader() {
  const glyphAmount = requiredTypes.length;

  let text = glyphAmount + ";";
  text += requiredEffectsExport.map((element, i) => 
    requiredTypes[i] + "," + element.join(",")
  ).join(";");
  text += "";
  return text;
}

function exportData() {
  if (checked >= maxSeed) {
    let text = "\"" + exportHeader() + "\"";
    text += ": \"";
    text += foundSeeds;
    if (foundSeeds > 0) {
      text += ";";

      text += bestMinRaritySeedRarities.map(r => r.toFixed(2)).join(",") + ";";
      text += bestMinRaritySeed + ";";

      text += bestAverageRaritySeedRarities.map(r => r.toFixed(2)).join(",") + ";";
      text += bestAverageRaritySeed + ";";

      text += bestMaxRaritySeedRarities.map(r => r.toFixed(2)).join(",") + ";";
      text += bestMaxRaritySeed + ";";

      text += worstMaxRaritySeedRarities.map(r => r.toFixed(2)).join(",") + ";";
      text += worstMaxRaritySeed;
    }
    text += "\"";
  
    navigator.clipboard.writeText(text);
    export_button.innerHTML = "EXPORTED";
  }
}

function convertExportToText(header) {
  const data = stored[header];
  const dataParts = data.split(";");
  const _foundSeeds = parseInt(dataParts[0]);
  let text = "";
  if (_foundSeeds > 0) {
    text += "Found seeds: " + _foundSeeds + "<br><br>";

    let rarities = dataParts[1].split(",").map(Number);
    let _seed = dataParts[2];
    text += "Best min rarity: " + Math.min(...rarities).toFixed(2) + "%" + "<br>";
    text += "Rarities: " + rarities.map(r => r.toFixed(2) + "%").join(", ") + "<br>";
    text += "player.reality.seed = " + _seed + ";<br>"
    text += "player.reality.initialSeed = " + _seed + ";<br><br>"

    rarities = dataParts[3].split(",").map(Number);
    _seed = dataParts[4];
    text += "Best average rarity: " + rarities.reduce((p,c,_,a) => p + c/a.length, 0).toFixed(2) + "%" + "<br>";
    text += "Rarities: " + rarities.map(r => r.toFixed(2) + "%").join(", ") + "<br>";
    text += "player.reality.seed = " + _seed + ";<br>"
    text += "player.reality.initialSeed = " + _seed + ";<br><br>"

    rarities = dataParts[5].split(",").map(Number);
    _seed = dataParts[6];
    text += "Best max rarity: " + Math.max(...rarities).toFixed(2) + "%" + "<br>";
    text += "Rarities: " + rarities.map(r => r.toFixed(2) + "%").join(", ") + "<br>";
    text += "player.reality.seed = " + _seed + ";<br>"
    text += "player.reality.initialSeed = " + _seed + ";<br><br>"

    rarities = dataParts[7].split(",").map(Number);
    _seed = dataParts[8];
    text += "Worst max rarity: " + Math.max(...rarities).toFixed(2) + "%" + "<br>";
    text += "Rarities: " + rarities.map(r => r.toFixed(2) + "%").join(", ") + "<br>";
    text += "player.reality.seed = " + _seed + ";<br>"
    text += "player.reality.initialSeed = " + _seed + ";<br><br>"
  } else {
    text += "No found seeds yet."
  }
  return text;
}

const stored = {
  "2;0,0,2;3,0,3": "32574060;80.80,70.40;184504334;80.80,70.40;184504334;100.00,18.00;1428455986;0.10,0.10;14551398",
  "4;0,0,2;3,0,3;2,0,2;4,0,1": "182922;48.50,45.60,43.60,49.90;2522996380;44.30,68.80,22.70,70.10;3674458196;15.30,19.40,45.60,88.40;3013597478;0.10,0.50,2.00,1.70;4027579492",
  "5;0,0,2;3,0,3;2,0,2;4,0,1;2,0,2": "4049;33.00,46.30,43.40,30.50,45.20;988103260;22.50,9.30,65.90,23.40,100.00;3893097748;22.50,9.30,65.90,23.40,100.00;3893097748;3.50,6.60,12.70,12.40,12.30;2966232424",
};