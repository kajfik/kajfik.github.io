const min_rarity_text = document.getElementById("min_rarity");
const glyph_amount_text = document.getElementById("glyph_amount");
const glyphs_textarea = document.getElementById("glyphs");

const types = ["power", "time"];
let requiredEffects = [327680, 9];
let minStrength;
let simulationStartAbsolute;

const SECOND_GAUSSIAN_DEFAULT_VALUE = 1e6;

const REALITIES_BEFORE_REDRAW = 1000000;

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

let initialSeed = -1;
let seed = -1;
let secondGaussian = SECOND_GAUSSIAN_DEFAULT_VALUE;
let checked = 0;

function calculate() {
  checked = 0;
  glyphs_textarea.innerHTML = "Seeds simulated: " + checked + "<br>" + "Simulation speed: 0.00 seeds/s";;

  minStrength = rarityToStrength(parseInt(min_rarity_text.value));
  const glyphAmount = parseInt(glyph_amount_text.value);

  requiredEffects = [];
  for (let g = 1; g <= glyphAmount; g++) {
    const secondSelect = document.getElementById(`glyph${g}_second`);
    const thirdSelect = document.getElementById(`glyph${g}_third`);
    requiredEffects.push((1 << parseInt(secondSelect.value)) + (1 << parseInt(thirdSelect.value)));
  }

  simulationStartAbsolute = null;

  setTimeout(calculateRealities, 100);
}

function calculateRealities() {
  let simulationStart = Date.now();
  if (simulationStartAbsolute == null) {
    simulationStartAbsolute = simulationStart;
  }
  initialSeed = Math.floor(Date.now() * Math.random() + 1);
  let found;

  for (let r = 0; r < REALITIES_BEFORE_REDRAW; r++) {
    seed = initialSeed;
    secondGaussian = SECOND_GAUSSIAN_DEFAULT_VALUE;
    found = true;

    for (let i = 1; i <= requiredEffects.length; i++) {
      const glyphs = uniformGlyphs(1, i);
      const glyph = glyphs.find(g => g.strength >= minStrength && g.effects == requiredEffects[i - 1]);
      if (glyph == undefined) {
        found = false;
        break;
      }
    }

    if (found) {
      break;
    }

    initialSeed++;
    checked++;
  }

  if (found) {
    let text = "";
    let timeElapsed = (Date.now() - simulationStartAbsolute) / 1000;
    let speed = (checked / timeElapsed).toFixed(2);
    text += "Seeds simulated: " + checked + "<br>" + "Simulation speed: " + speed + " seeds/s<br><br>";

    text += "Rarities: "
    seed = initialSeed;
    secondGaussian = SECOND_GAUSSIAN_DEFAULT_VALUE;
    for (let i = 1; i <= requiredEffects.length; i++) {
      const glyphs = uniformGlyphs(1, i);
      const glyph = glyphs.find(g => g.strength >= minStrength && g.effects == requiredEffects[i - 1]);
      text += strengthToRarity(glyph.strength).toFixed(2) + "%";
      if (i < requiredEffects.length) text += ", ";
    }
    text += "<br><br>"; 

    text += "player.reality.seed = " + initialSeed + ";<br>"
    text += "player.reality.initialSeed = " + initialSeed + ";"

    glyphs_textarea.innerHTML = text;
  } else {
    let timeElapsed = (Date.now() - simulationStart) / 1000;
    let speed = (REALITIES_BEFORE_REDRAW / timeElapsed).toFixed(2);
    glyphs_textarea.innerHTML = "Seeds simulated: " + checked + "<br>" + "Simulation speed: " + speed + " seeds/s";
    setTimeout(calculateRealities, 0);
  }
}

function uniformGlyphs(level, realityCount) {
  const groupNum = Math.floor((realityCount - 1) / 5);
  const groupIndex = (realityCount - 1) % 5;

  const initSeed = initialSeed;

  const typeLexIndex = (31 + initSeed % 7) * groupNum + initSeed % 1123;
  const typeLen = 5;
  let numPerm = 1;
  for (let n = 1; n <= typeLen; n++) numPerm *= n;
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

    const effectLexIndex = 5 * type + (7 + initSeed % 5) * groupNum + initSeed % 11;
    const effectLen = 4;
    let numPerm = 1;
    for (let n = 1; n <= effectLen; n++) numPerm *= n;
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