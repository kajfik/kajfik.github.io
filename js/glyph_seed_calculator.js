const glyph_amount_text = document.getElementById("glyph_amount");
const glyphs_textarea = document.getElementById("glyphs");
const pause_button = document.getElementById("pause_button");
const export_button = document.getElementById("export_button");
pause_button.style.visibility = "hidden";
export_button.style.visibility = "hidden";

const maxSeed = 4294967295;
const numWorkers = Math.max(1, navigator.hardwareConcurrency || 4);

let requiredTypes = [];
let requiredEffects = [];
let requiredEffectsExport = [];
let requiredSecondEffectsAdjusted = [];

// Merged simulation state — computed from all worker states, also used by exportData()
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
let worstMaxRaritySeedRarities = [];

// Per-worker tracking
let workers = new Array(numWorkers).fill(null);
let workerStates = new Array(numWorkers).fill(null);
let workerDone = new Array(numWorkers).fill(false);

let started = false;
let running = false;

// ── Chunk helpers ─────────────────────────────────────────────────────────────

function chunkStart(i) {
  return Math.floor(i / numWorkers * maxSeed);
}

function chunkEnd(i) {
  return i === numWorkers - 1 ? maxSeed : Math.floor((i + 1) / numWorkers * maxSeed);
}

// ── Worker management ─────────────────────────────────────────────────────────

function workerConfigFor(i) {
  const ws = workerStates[i];
  return {
    requiredTypes,
    requiredEffects,
    requiredSecondEffectsAdjusted,
    workerMaxSeed: chunkEnd(i),
    checked: ws ? ws.checked : chunkStart(i),
    foundSeeds: ws ? ws.foundSeeds : 0,
    bestMinRarity: ws ? ws.bestMinRarity : -1,
    bestMinRaritySeed: ws ? ws.bestMinRaritySeed : -1,
    bestMinRaritySeedRarities: ws ? ws.bestMinRaritySeedRarities : [],
    bestAverageRarity: ws ? ws.bestAverageRarity : -1,
    bestAverageRaritySeed: ws ? ws.bestAverageRaritySeed : -1,
    bestAverageRaritySeedRarities: ws ? ws.bestAverageRaritySeedRarities : [],
    bestMaxRarity: ws ? ws.bestMaxRarity : -1,
    bestMaxMinRarity: ws ? ws.bestMaxMinRarity : -1,
    bestMaxRaritySeed: ws ? ws.bestMaxRaritySeed : -1,
    bestMaxRaritySeedRarities: ws ? ws.bestMaxRaritySeedRarities : [],
    worstMaxRarity: ws ? ws.worstMaxRarity : 101,
    worstMaxRaritySeed: ws ? ws.worstMaxRaritySeed : -1,
    worstMaxRaritySeedRarities: ws ? ws.worstMaxRaritySeedRarities : [],
  };
}

function createWorker(i) {
  const w = new Worker('js/glyph_seed_calculator_worker.js');
  w.onmessage = function(e) {
    const { type, data } = e.data;
    workerStates[i] = data;
    mergeAndUpdateUI();
    if (type === 'done') {
      workers[i] = null;
      workerDone[i] = true;
      if (workerDone.every(d => d)) {
        started = false;
        running = false;
        pause_button.style.visibility = "hidden";
        export_button.style.visibility = "visible";
        export_button.innerHTML = "EXPORT";
      }
    }
  };
  w.postMessage({ type: 'start', config: workerConfigFor(i) });
  return w;
}

function startAllWorkers() {
  for (let i = 0; i < numWorkers; i++) {
    workers[i] = createWorker(i);
  }
}

// ── State merging ─────────────────────────────────────────────────────────────

function mergeAndUpdateUI() {
  let totalChecked = 0;
  let totalFoundSeeds = 0;
  let totalSpeed = 0;
  let mBestMinRarity = -1, mBestMinRaritySeed = -1, mBestMinRaritySeedRarities = [];
  let mBestAverageRarity = -1, mBestAverageRaritySeed = -1, mBestAverageRaritySeedRarities = [];
  let mBestMaxRarity = -1, mBestMaxMinRarity = -1, mBestMaxRaritySeed = -1, mBestMaxRaritySeedRarities = [];
  let mWorstMaxRarity = 101, mWorstMaxRaritySeed = -1, mWorstMaxRaritySeedRarities = [];

  for (let i = 0; i < numWorkers; i++) {
    const ws = workerStates[i];
    if (!ws) continue;

    totalChecked += ws.checked - chunkStart(i);
    totalFoundSeeds += ws.foundSeeds;
    totalSpeed += parseFloat(ws.speed) || 0;

    if (ws.foundSeeds > 0) {
      if (ws.bestMinRarity > mBestMinRarity) {
        mBestMinRarity = ws.bestMinRarity;
        mBestMinRaritySeed = ws.bestMinRaritySeed;
        mBestMinRaritySeedRarities = ws.bestMinRaritySeedRarities;
      }
      if (ws.bestAverageRarity > mBestAverageRarity) {
        mBestAverageRarity = ws.bestAverageRarity;
        mBestAverageRaritySeed = ws.bestAverageRaritySeed;
        mBestAverageRaritySeedRarities = ws.bestAverageRaritySeedRarities;
      }
      if (ws.bestMaxRarity > mBestMaxRarity ||
          (ws.bestMaxRarity === mBestMaxRarity && ws.bestMaxMinRarity > mBestMaxMinRarity)) {
        mBestMaxRarity = ws.bestMaxRarity;
        mBestMaxMinRarity = ws.bestMaxMinRarity;
        mBestMaxRaritySeed = ws.bestMaxRaritySeed;
        mBestMaxRaritySeedRarities = ws.bestMaxRaritySeedRarities;
      }
      if (ws.worstMaxRarity < mWorstMaxRarity) {
        mWorstMaxRarity = ws.worstMaxRarity;
        mWorstMaxRaritySeed = ws.worstMaxRaritySeed;
        mWorstMaxRaritySeedRarities = ws.worstMaxRaritySeedRarities;
      }
    }
  }

  // Update global merged state (used by exportData)
  checked = totalChecked;
  foundSeeds = totalFoundSeeds;
  bestMinRarity = mBestMinRarity;
  bestMinRaritySeed = mBestMinRaritySeed;
  bestMinRaritySeedRarities = mBestMinRaritySeedRarities;
  bestAverageRarity = mBestAverageRarity;
  bestAverageRaritySeed = mBestAverageRaritySeed;
  bestAverageRaritySeedRarities = mBestAverageRaritySeedRarities;
  bestMaxRarity = mBestMaxRarity;
  bestMaxMinRarity = mBestMaxMinRarity;
  bestMaxRaritySeed = mBestMaxRaritySeed;
  bestMaxRaritySeedRarities = mBestMaxRaritySeedRarities;
  worstMaxRarity = mWorstMaxRarity;
  worstMaxRaritySeed = mWorstMaxRaritySeed;
  worstMaxRaritySeedRarities = mWorstMaxRaritySeedRarities;

  updateUI(totalSpeed.toFixed(2));
}

// ── UI ────────────────────────────────────────────────────────────────────────

function updateUI(speed) {
  let text = "Seeds simulated: " + checked + "/" + maxSeed + ", " +
    (100 * checked / maxSeed).toFixed(2) + "%<br>" +
    "Simulation speed: " + speed + " seeds/s (" + numWorkers + " workers)<br><br>";

  if (foundSeeds > 0) {
    text += "Found seeds: " + foundSeeds + "<br><br>";

    text += "Best min rarity: " + bestMinRarity.toFixed(2) + "%<br>";
    text += "Rarities: " + bestMinRaritySeedRarities.map(r => r.toFixed(2) + "%").join(", ") + "<br>";
    text += "player.reality.seed = " + bestMinRaritySeed + ";<br>";
    text += "player.reality.initialSeed = " + bestMinRaritySeed + ";<br><br>";

    text += "Best average rarity: " + bestAverageRarity.toFixed(2) + "%<br>";
    text += "Rarities: " + bestAverageRaritySeedRarities.map(r => r.toFixed(2) + "%").join(", ") + "<br>";
    text += "player.reality.seed = " + bestAverageRaritySeed + ";<br>";
    text += "player.reality.initialSeed = " + bestAverageRaritySeed + ";<br><br>";

    text += "Best max rarity: " + bestMaxRarity.toFixed(2) + "%<br>";
    text += "Rarities: " + bestMaxRaritySeedRarities.map(r => r.toFixed(2) + "%").join(", ") + "<br>";
    text += "player.reality.seed = " + bestMaxRaritySeed + ";<br>";
    text += "player.reality.initialSeed = " + bestMaxRaritySeed + ";<br><br>";

    text += "Worst max rarity: " + worstMaxRarity.toFixed(2) + "%<br>";
    text += "Rarities: " + worstMaxRaritySeedRarities.map(r => r.toFixed(2) + "%").join(", ") + "<br>";
    text += "player.reality.seed = " + worstMaxRaritySeed + ";<br>";
    text += "player.reality.initialSeed = " + worstMaxRaritySeed + ";<br><br>";
  } else {
    text += "No found seeds yet.";
  }

  glyphs_textarea.innerHTML = text;
}

// ── Public button handlers ────────────────────────────────────────────────────

function pause() {
  if (!started) return;
  running = !running;
  pause_button.innerHTML = running ? "PAUSE" : "RESUME";
  if (running) {
    // Resume: restart only workers that haven't finished their range
    for (let i = 0; i < numWorkers; i++) {
      if (!workerDone[i]) {
        workers[i] = createWorker(i);
      }
    }
  } else {
    // Pause: terminate all running workers
    for (let i = 0; i < numWorkers; i++) {
      if (workers[i]) {
        workers[i].terminate();
        workers[i] = null;
      }
    }
  }
}

function calculate() {
  for (let i = 0; i < numWorkers; i++) {
    if (workers[i]) { workers[i].terminate(); workers[i] = null; }
  }
  workerStates = new Array(numWorkers).fill(null);
  workerDone = new Array(numWorkers).fill(false);

  checked = 0;
  foundSeeds = 0;
  bestMinRarity = -1;
  bestMinRaritySeed = -1;
  bestMinRaritySeedRarities = [];
  bestAverageRarity = -1;
  bestAverageRaritySeed = -1;
  bestAverageRaritySeedRarities = [];
  bestMaxRarity = -1;
  bestMaxMinRarity = -1;
  bestMaxRaritySeed = -1;
  bestMaxRaritySeedRarities = [];
  worstMaxRarity = 101;
  worstMaxRaritySeed = -1;
  worstMaxRaritySeedRarities = [];

  glyphs_textarea.innerHTML =
    "Seeds simulated: 0/" + maxSeed + ", 0.00%<br>Simulation speed: 0.00 seeds/s (" + numWorkers + " workers)";

  const glyphAmount = parseInt(glyph_amount_text.value);
  const startID = [16, 12, 8, 0, 4];

  requiredTypes = [];
  requiredEffects = [];
  requiredEffectsExport = [];
  requiredSecondEffectsAdjusted = [];

  for (let g = 1; g <= glyphAmount; g++) {
    const typeSelect = document.getElementById(`glyph${g}_type`);
    const type = parseInt(typeSelect.value);
    requiredTypes.push(type);

    const secondSelect = document.getElementById(`glyph${g}_second`);
    const thirdSelect = document.getElementById(`glyph${g}_third`);
    requiredEffects.push((1 << parseInt(secondSelect.value)) + (1 << parseInt(thirdSelect.value)));
    requiredSecondEffectsAdjusted.push(parseInt(thirdSelect.value) - startID[type]);
    requiredEffectsExport.push([
      parseInt(secondSelect.value) - startID[type],
      parseInt(thirdSelect.value) - startID[type],
    ]);
  }

  const header = exportHeader();
  if (header in stored) {
    glyphs_textarea.innerHTML = convertExportToText(header);
  } else {
    started = true;
    running = true;
    export_button.style.visibility = "hidden";
    pause_button.style.visibility = "visible";
    pause_button.innerHTML = "PAUSE";
    startAllWorkers();
  }
}

function exportData() {
  if (checked < maxSeed) return;

  let text = '"' + exportHeader() + '"';
  text += ': "';
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
  text += '"';

  navigator.clipboard.writeText(text);
  export_button.innerHTML = "EXPORTED";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function exportHeader() {
  const glyphAmount = requiredTypes.length;
  let text = glyphAmount + ";";
  text += requiredEffectsExport.map((element, i) =>
    requiredTypes[i] + "," + element.join(",")
  ).join(";");
  return text;
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
    text += "Best min rarity: " + Math.min(...rarities).toFixed(2) + "%<br>";
    text += "Rarities: " + rarities.map(r => r.toFixed(2) + "%").join(", ") + "<br>";
    text += "player.reality.seed = " + _seed + ";<br>";
    text += "player.reality.initialSeed = " + _seed + ";<br><br>";

    rarities = dataParts[3].split(",").map(Number);
    _seed = dataParts[4];
    text += "Best average rarity: " + rarities.reduce((p, c, _, a) => p + c / a.length, 0).toFixed(2) + "%<br>";
    text += "Rarities: " + rarities.map(r => r.toFixed(2) + "%").join(", ") + "<br>";
    text += "player.reality.seed = " + _seed + ";<br>";
    text += "player.reality.initialSeed = " + _seed + ";<br><br>";

    rarities = dataParts[5].split(",").map(Number);
    _seed = dataParts[6];
    text += "Best max rarity: " + Math.max(...rarities).toFixed(2) + "%<br>";
    text += "Rarities: " + rarities.map(r => r.toFixed(2) + "%").join(", ") + "<br>";
    text += "player.reality.seed = " + _seed + ";<br>";
    text += "player.reality.initialSeed = " + _seed + ";<br><br>";

    rarities = dataParts[7].split(",").map(Number);
    _seed = dataParts[8];
    text += "Worst max rarity: " + Math.max(...rarities).toFixed(2) + "%<br>";
    text += "Rarities: " + rarities.map(r => r.toFixed(2) + "%").join(", ") + "<br>";
    text += "player.reality.seed = " + _seed + ";<br>";
    text += "player.reality.initialSeed = " + _seed + ";<br><br>";
  } else {
    text += "No found seeds.";
  }
  return text;
}

// ── Stored results ────────────────────────────────────────────────────────────

const stored = {
  "1;0,0,2": "103294189;100.00;1428455986;100.00;1428455986;100.00;1428455986;0.10;15900",
  "1;2,0,2": "260526452;99.90;2875899154;99.90;2875899154;99.90;2875899154;0.10;10859",
  "1;3,0,3": "1927490563;100.00;742690924;100.00;742690924;100.00;742690924;0.10;1973",
  "2;3,0,3;0,0,2": "390232419;74.10,75.80;2810574808;85.30,66.90;458250196;18.70,100.00;686374180;0.10,0.10;580984",
  "2;0,0,2;3,0,3": "32574060;80.80,70.40;184504334;80.80,70.40;184504334;100.00,18.00;1428455986;0.10,0.10;14551398",
  "3;0,0,2;3,0,3;2,0,2": "1730977;58.30,60.30,53.90;1283848856;56.60,72.70,45.90;3543498102;100.00,18.00,50.80;1428455986;0.40,0.50,0.10;312654816",
  "4;0,0,2;3,0,3;2,0,2;4,0,1": "182922;48.50,45.60,43.60,49.90;2522996380;44.30,68.80,22.70,70.10;3674458196;15.30,19.40,45.60,88.40;3013597478;0.10,0.50,2.00,1.70;4027579492",
  "5;0,0,2;3,0,3;2,0,2;4,0,1;2,0,2": "4049;33.00,46.30,43.40,30.50,45.20;988103260;22.50,9.30,65.90,23.40,100.00;3893097748;22.50,9.30,65.90,23.40,100.00;3893097748;3.50,6.60,12.70,12.40,12.30;2966232424",
  "5;0,0,2;3,0,3;2,0,3;4,0,1;2,0,2": "11250;43.70,33.80,53.70,34.80,46.20;2348694250;33.00,51.60,55.90,44.20,59.80;2276851688;32.00,19.20,30.70,9.40,100.00;539159688;11.00,2.10,4.90,2.10,12.50;1219724166",
  "5;0,0,2;3,0,3;2,0,3;2,0,2;4,0,1": "0",
  "5;0,0,2;3,0,3;2,0,2;2,0,3;4,0,1": "0",
  "5;0,0,2;3,0,3;2,0,2;4,0,1;2,0,3": "25724;46.80,43.50,47.00,37.90,41.00;3963723128;49.10,32.40,35.20,52.80,92.50;1633549996;7.80,12.90,31.30,24.00,100.00;3700025474;6.60,4.60,0.70,3.70,12.30;1801742098",
  "5;0,0,2;3,0,3;2,0,3;4,0,1;2,0,3": "26806;45.30,35.90,38.00,40.30,76.20;1173358320;49.20,34.70,38.20,38.50,92.00;640554740;36.50,50.10,37.70,20.20,100.00;2822301670;12.30,7.80,4.50,11.80,12.30;1431135774",
};
