import * as THREE from "three";
import { getStageById } from "./stages.js";

const canvas = document.querySelector("#game-canvas");
const startScreen = document.querySelector("#start-screen");
const resultScreen = document.querySelector("#result-screen");
const hud = document.querySelector("#hud");
const crosshair = document.querySelector("#crosshair");
const promptEl = document.querySelector("#prompt");
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart-button");
const objectiveText = document.querySelector("#objective-text");
const itemsText = document.querySelector("#items-text");
const dangerText = document.querySelector("#danger-text");
const sanityText = document.querySelector("#sanity-text");
const staminaText = document.querySelector("#stamina-text");
const lightText = document.querySelector("#light-text");
const seedText = document.querySelector("#seed-text");
const resultKicker = document.querySelector("#result-kicker");
const resultTitle = document.querySelector("#result-title");
const resultMessage = document.querySelector("#result-message");
const touchControls = document.querySelector("#touch-controls");
const movePad = document.querySelector("#move-pad");
const touchInteract = document.querySelector("#touch-interact");
const touchSprint = document.querySelector("#touch-sprint");

const stage = getStageById("shinjuku-like");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 260);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
  preserveDrawingBuffer: true,
});
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);

let run = null;
let yaw = 0;
let pitch = 0;
let running = false;
let touchingLook = false;
let lastTouch = null;
let touchMove = new THREE.Vector2();
let sprintHeld = false;

const keys = new Set();
const colliders = [];
const interactables = [];
const tempBox = new THREE.Box3();
const tempVec = new THREE.Vector3();

const player = {
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  radius: 1.05,
  height: 2.1,
  stamina: 100,
  sanity: 100,
  light: 100,
  items: new Set(),
};

const audio = {
  context: null,
  drone: null,
  heartbeat: null,
};

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
scene.background = new THREE.Color(stage.theme.sky);
scene.fog = new THREE.FogExp2(stage.theme.fog, 0.025);

const ambient = new THREE.HemisphereLight(0x33415f, 0x07070a, 0.86);
scene.add(ambient);

const flashlight = new THREE.SpotLight(0xe8fbff, 5.2, 48, Math.PI / 5.5, 0.45, 1.25);
flashlight.position.set(0, 0, 0);
flashlight.target.position.set(0, 0, -1);
camera.add(flashlight);
camera.add(flashlight.target);
scene.add(camera);

function createRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function newSeed() {
  return Math.floor(Date.now() % 1000000);
}

function cellKey(x, z) {
  return `${x},${z}`;
}

function shuffle(items, rng) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function generateMaze(size, rng) {
  const visited = new Set([cellKey(0, 0)]);
  const openEdges = new Set();

  function carve(x, z) {
    const dirs = shuffle(
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ],
      rng,
    );
    for (const [dx, dz] of dirs) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= size || nz >= size || visited.has(cellKey(nx, nz))) {
        continue;
      }
      visited.add(cellKey(nx, nz));
      openEdges.add(edgeKey(x, z, nx, nz));
      carve(nx, nz);
    }
  }

  carve(0, 0);

  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      if (x < size - 1 && rng() > 0.78) openEdges.add(edgeKey(x, z, x + 1, z));
      if (z < size - 1 && rng() > 0.78) openEdges.add(edgeKey(x, z, x, z + 1));
    }
  }

  return openEdges;
}

function edgeKey(ax, az, bx, bz) {
  const a = cellKey(ax, az);
  const b = cellKey(bx, bz);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function cellToWorld(x, z) {
  const offset = ((stage.size - 1) * stage.cellSize) / 2;
  return new THREE.Vector3(x * stage.cellSize - offset, 0, z * stage.cellSize - offset);
}

function clearScene() {
  for (let i = scene.children.length - 1; i >= 0; i -= 1) {
    const child = scene.children[i];
    if (child.userData.runObject) scene.remove(child);
  }
  colliders.length = 0;
  interactables.length = 0;
}

function addCollider(mesh) {
  mesh.updateMatrixWorld();
  colliders.push(new THREE.Box3().setFromObject(mesh));
}

function addBox({ position, scale, color, emissive = 0x000000, name = "" }) {
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: emissive ? 0.24 : 0,
    roughness: 0.78,
    metalness: 0.08,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.position.copy(position);
  mesh.scale.copy(scale);
  mesh.name = name;
  mesh.userData.runObject = true;
  scene.add(mesh);
  return mesh;
}

function addNeonSign(position, rotationY, color, labelWidth = 3.4) {
  const sign = addBox({
    position,
    scale: new THREE.Vector3(labelWidth, 0.12, 1),
    color,
    emissive: color,
  });
  sign.rotation.y = rotationY;
  const light = new THREE.PointLight(color, 1.3, 15, 1.8);
  light.position.copy(position);
  light.userData.runObject = true;
  scene.add(light);
}

function addStreetShrine(position, rng) {
  const base = addBox({
    position: position.clone().add(new THREE.Vector3(0, 0.35, 0)),
    scale: new THREE.Vector3(1.2, 0.7, 0.8),
    color: 0x45251c,
    emissive: 0x220a08,
  });
  const roof = addBox({
    position: position.clone().add(new THREE.Vector3(0, 0.92, 0)),
    scale: new THREE.Vector3(1.5, 0.22, 1),
    color: 0x7f1d1d,
    emissive: 0x2a0606,
  });
  base.rotation.y = rng() * Math.PI;
  roof.rotation.y = base.rotation.y;
}

function buildCity(runState) {
  clearScene();
  const rng = runState.rng;
  const openEdges = generateMaze(stage.size, rng);
  runState.openEdges = openEdges;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(stage.size * stage.cellSize + 18, stage.size * stage.cellSize + 18),
    new THREE.MeshStandardMaterial({ color: stage.theme.asphalt, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.userData.runObject = true;
  scene.add(ground);

  const rail = addBox({
    position: cellToWorld(2, stage.size - 3).add(new THREE.Vector3(0, 6.4, 0)),
    scale: new THREE.Vector3(stage.size * stage.cellSize, 1, 3),
    color: 0x293241,
    emissive: 0x05080d,
  });
  rail.rotation.y = 0.05;

  for (let z = 0; z < stage.size; z += 1) {
    for (let x = 0; x < stage.size; x += 1) {
      const world = cellToWorld(x, z);
      const isStart = x < 2 && z < 2;
      const isExit = x > stage.size - 3 && z > stage.size - 3;
      if (!isStart && !isExit && rng() > 0.66) {
        const height = 8 + rng() * 18;
        const building = addBox({
          position: world.clone().add(new THREE.Vector3(0, height / 2, 0)),
          scale: new THREE.Vector3(3.1 + rng() * 2.2, height, 3.1 + rng() * 2.2),
          color: stage.theme.wall,
          emissive: rng() > 0.75 ? 0x151025 : 0x000000,
        });
        addCollider(building);
        if (rng() > 0.42) {
          addNeonSign(
            world
              .clone()
              .add(new THREE.Vector3((rng() - 0.5) * 4, 2.6 + rng() * 7, (rng() - 0.5) * 4)),
            rng() * Math.PI,
            stage.theme.signs[Math.floor(rng() * stage.theme.signs.length)],
            2 + rng() * 2.8,
          );
        }
      }

      if (rng() > 0.9) addStreetShrine(world.clone().add(new THREE.Vector3(0, 0, 2.5)), rng);

      if (x < stage.size - 1 && !openEdges.has(edgeKey(x, z, x + 1, z))) {
        const wall = addBox({
          position: world.clone().add(new THREE.Vector3(stage.cellSize / 2, 1.8, 0)),
          scale: new THREE.Vector3(0.4, 3.6, stage.cellSize + 0.4),
          color: 0x151a24,
          emissive: 0x03050a,
        });
        addCollider(wall);
      }
      if (z < stage.size - 1 && !openEdges.has(edgeKey(x, z, x, z + 1))) {
        const wall = addBox({
          position: world.clone().add(new THREE.Vector3(0, 1.8, stage.cellSize / 2)),
          scale: new THREE.Vector3(stage.cellSize + 0.4, 3.6, 0.4),
          color: 0x151a24,
          emissive: 0x03050a,
        });
        addCollider(wall);
      }
    }
  }

  const start = cellToWorld(0, 0);
  const exit = cellToWorld(stage.size - 1, stage.size - 1);
  player.position.copy(start).add(new THREE.Vector3(0, player.height, 0));
  runState.exitPosition = exit.clone();

  addNeonSign(start.clone().add(new THREE.Vector3(2.4, 3.2, 2.4)), -Math.PI / 4, 0x28e7ff, 3.8);
  const startLight = new THREE.PointLight(0x28e7ff, 2.4, 22, 1.5);
  startLight.position.copy(start).add(new THREE.Vector3(2, 3, 2));
  startLight.userData.runObject = true;
  scene.add(startLight);

  const exitGate = addBox({
    position: exit.clone().add(new THREE.Vector3(0, 2.6, 0)),
    scale: new THREE.Vector3(4.8, 5.2, 0.5),
    color: 0x10391f,
    emissive: stage.theme.exit,
    name: "Exit Gate",
  });
  exitGate.userData.type = "exit";
  interactables.push(exitGate);

  const exitLight = new THREE.PointLight(stage.theme.exit, 2.5, 24, 1.5);
  exitLight.position.copy(exit).add(new THREE.Vector3(0, 4.4, 0));
  exitLight.userData.runObject = true;
  scene.add(exitLight);

  placeItems(runState);
  createThreat(runState);
}

function farCells(rng, count) {
  const cells = [];
  for (let z = 2; z < stage.size - 1; z += 1) {
    for (let x = 2; x < stage.size - 1; x += 1) {
      if (x + z > 6) cells.push([x, z]);
    }
  }
  return shuffle(cells, rng).slice(0, count);
}

function placeItems(runState) {
  const cells = farCells(runState.rng, stage.requiredItems.length);
  stage.requiredItems.forEach((item, index) => {
    const [x, z] = cells[index];
    const position = cellToWorld(x, z).add(new THREE.Vector3(0, 1.2, 0));
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.72, 1),
      new THREE.MeshStandardMaterial({
        color: item.color,
        emissive: item.color,
        emissiveIntensity: 0.65,
        roughness: 0.32,
      }),
    );
    mesh.position.copy(position);
    mesh.userData = { runObject: true, type: "item", item };
    scene.add(mesh);
    interactables.push(mesh);

    const light = new THREE.PointLight(item.color, 1.4, 10, 1.8);
    light.position.copy(position);
    light.userData.runObject = true;
    scene.add(light);
  });
}

function createThreat(runState) {
  const position = cellToWorld(stage.size - 2, 2).add(new THREE.Vector3(0, 1.7, 0));
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.8, 2.2, 6, 12),
    new THREE.MeshStandardMaterial({
      color: 0x1a050b,
      emissive: stage.theme.threat,
      emissiveIntensity: 0.55,
      roughness: 0.5,
    }),
  );
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  eye.position.set(0, 0.72, -0.72);
  group.add(body, eye);
  group.position.copy(position);
  group.userData.runObject = true;
  scene.add(group);

  const light = new THREE.PointLight(stage.theme.threat, 2.1, 22, 1.1);
  light.position.copy(position);
  light.userData.runObject = true;
  scene.add(light);
  runState.threat = { group, light, speed: 3.4, alert: 0 };
}

function startRun() {
  initAudio();
  run = {
    seed: newSeed(),
    rng: null,
    state: "playing",
    elapsed: 0,
    messageTimer: 0,
    exitPosition: new THREE.Vector3(),
  };
  run.rng = createRng(run.seed);
  player.stamina = 100;
  player.sanity = 100;
  player.light = 100;
  player.items.clear();
  yaw = -Math.PI * 0.75;
  pitch = 0;
  keys.clear();
  buildCity(run);
  objectiveText.textContent = stage.objectiveText;
  seedText.textContent = String(run.seed);
  startScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  hud.classList.remove("hidden");
  crosshair.classList.remove("hidden");
  touchControls.classList.toggle("hidden", !isTouchDevice());
  running = true;
  showPrompt("Click to lock pointer. WASD moves, mouse looks, Shift runs, E uses items.", 4);
  if (!isTouchDevice()) canvas.requestPointerLock?.();
}

function initAudio() {
  if (audio.context) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audio.context = new AudioContext();
  const drone = audio.context.createOscillator();
  const gain = audio.context.createGain();
  drone.frequency.value = 54;
  drone.type = "sawtooth";
  gain.gain.value = 0.015;
  drone.connect(gain).connect(audio.context.destination);
  drone.start();
  audio.drone = { oscillator: drone, gain };
}

function isTouchDevice() {
  return matchMedia("(pointer: coarse)").matches;
}

function handleLook(dx, dy) {
  yaw -= dx * 0.0024;
  pitch -= dy * 0.002;
  pitch = THREE.MathUtils.clamp(pitch, -1.25, 1.2);
}

function updateCamera() {
  camera.position.copy(player.position);
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

function movePlayer(dt) {
  const forward = Number(keys.has("KeyW") || touchMove.y < -0.2) - Number(keys.has("KeyS") || touchMove.y > 0.2);
  const strafe = Number(keys.has("KeyD") || touchMove.x > 0.2) - Number(keys.has("KeyA") || touchMove.x < -0.2);
  const sprinting = (keys.has("ShiftLeft") || keys.has("ShiftRight") || sprintHeld) && player.stamina > 2 && forward > 0;
  const speed = sprinting ? 8.2 : 4.7;
  const direction = new THREE.Vector3(strafe, 0, -forward);

  if (direction.lengthSq() > 0) {
    direction.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    tempVec.copy(player.position);
    tempVec.addScaledVector(direction, speed * dt);
    if (!collides(tempVec)) player.position.copy(tempVec);
    player.stamina = THREE.MathUtils.clamp(player.stamina + (sprinting ? -26 : 14) * dt, 0, 100);
    player.light = THREE.MathUtils.clamp(player.light - (sprinting ? 2.4 : 1.2) * dt, 0, 100);
  } else {
    player.stamina = THREE.MathUtils.clamp(player.stamina + 18 * dt, 0, 100);
    player.light = THREE.MathUtils.clamp(player.light - 0.7 * dt, 0, 100);
  }
}

function collides(position) {
  tempBox.setFromCenterAndSize(
    new THREE.Vector3(position.x, player.height / 2, position.z),
    new THREE.Vector3(player.radius * 2, player.height, player.radius * 2),
  );
  return colliders.some((box) => box.intersectsBox(tempBox));
}

function updateThreat(dt) {
  const threat = run.threat;
  const toPlayer = player.position.clone().sub(threat.group.position);
  const distance = toPlayer.length();
  const lightPenalty = 1 - player.light / 100;
  threat.alert = THREE.MathUtils.clamp(1 - distance / 38 + lightPenalty * 0.25, 0, 1);

  if (distance < 48) {
    toPlayer.y = 0;
    toPlayer.normalize();
    const speed = threat.speed * (0.65 + threat.alert * 1.25);
    const next = threat.group.position.clone().addScaledVector(toPlayer, speed * dt);
    if (!collides(new THREE.Vector3(next.x, player.height, next.z))) {
      threat.group.position.copy(next);
      threat.light.position.copy(next);
    }
    threat.group.lookAt(player.position.x, threat.group.position.y, player.position.z);
  }

  const sanityDrain = (threat.alert * 7 + (player.light < 15 ? 5 : 0)) * dt;
  player.sanity = THREE.MathUtils.clamp(player.sanity - sanityDrain, 0, 100);

  if (distance < 2.35) endRun(false, "The watcher caught you in the alley static.");
  if (player.sanity <= 0) endRun(false, "Your map of the streets collapsed into noise.");
}

function findTarget() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(interactables, false);
  return hits.find((hit) => hit.distance < 4.2)?.object ?? null;
}

function interact() {
  if (!run || run.state !== "playing") return;
  const target = findTarget();
  if (!target) {
    showPrompt("Nothing useful is within reach.", 1.2);
    return;
  }

  if (target.userData.type === "item") {
    const item = target.userData.item;
    player.items.add(item.id);
    target.visible = false;
    interactables.splice(interactables.indexOf(target), 1);
    showPrompt(`${item.label} collected. ${item.hint}`, 2.6);
  } else if (target.userData.type === "exit") {
    if (player.items.size >= stage.requiredItems.length) {
      endRun(true, "You powered the gate and escaped into the first train glow.");
    } else {
      showPrompt("The exit gate is dark. It needs every target item.", 2);
    }
  }
}

function updatePrompt(dt) {
  if (run?.messageTimer > 0) {
    run.messageTimer -= dt;
    if (run.messageTimer <= 0) promptEl.classList.add("hidden");
    return;
  }
  const target = findTarget();
  if (target?.userData.type === "item") {
    promptEl.textContent = `Press E to take ${target.userData.item.label}`;
    promptEl.classList.remove("hidden");
  } else if (target?.userData.type === "exit") {
    promptEl.textContent = player.items.size >= stage.requiredItems.length ? "Press E to escape" : "Exit locked: collect every target item";
    promptEl.classList.remove("hidden");
  } else {
    promptEl.classList.add("hidden");
  }
}

function showPrompt(message, seconds = 2) {
  promptEl.textContent = message;
  promptEl.classList.remove("hidden");
  if (run) run.messageTimer = seconds;
}

function updateHud() {
  const missing = stage.requiredItems.filter((item) => !player.items.has(item.id));
  objectiveText.textContent = missing.length
    ? `Find ${missing[0].label}. ${missing[0].hint}`
    : "All items found. Reach the green exit lantern.";
  itemsText.textContent = `${player.items.size} / ${stage.requiredItems.length}`;
  const danger = run.threat.alert;
  dangerText.textContent = danger > 0.7 ? "Extreme" : danger > 0.42 ? "Near" : danger > 0.2 ? "Rising" : "Low";
  dangerText.style.color = danger > 0.7 ? "#fb7185" : danger > 0.42 ? "#facc15" : "#f9fbff";
  sanityText.textContent = Math.ceil(player.sanity);
  staminaText.textContent = Math.ceil(player.stamina);
  lightText.textContent = Math.ceil(player.light);
  flashlight.intensity = 1.8 + (player.light / 100) * 5;
  scene.fog.density = 0.023 + (1 - player.light / 100) * 0.03;
}

function animateObjects(dt) {
  const elapsed = run.elapsed;
  for (const object of interactables) {
    if (object.userData.type === "item" && object.visible) {
      object.rotation.y += dt * 1.8;
      object.position.y += Math.sin(elapsed * 3 + object.position.x) * 0.004;
    }
  }
}

function endRun(success, message) {
  if (!run || run.state !== "playing") return;
  run.state = success ? "escaped" : "failed";
  running = false;
  document.exitPointerLock?.();
  resultKicker.textContent = success ? "Escape successful" : "Game over";
  resultTitle.textContent = success ? "You Escaped" : "You Were Lost";
  resultMessage.textContent = message;
  resultScreen.classList.remove("hidden");
  hud.classList.add("hidden");
  crosshair.classList.add("hidden");
  touchControls.classList.add("hidden");
}

window.__NEON_EXIT_TEST__ = {
  state() {
    return {
      runState: run?.state ?? "idle",
      seed: run?.seed ?? null,
      items: player.items.size,
      requiredItems: stage.requiredItems.length,
      sanity: player.sanity,
      light: player.light,
      position: player.position.toArray(),
      exit: run?.exitPosition?.toArray() ?? null,
    };
  },
  collectAllItems() {
    if (!run) return;
    stage.requiredItems.forEach((item) => player.items.add(item.id));
    for (const object of [...interactables]) {
      if (object.userData.type === "item") object.visible = false;
    }
  },
  moveToExit() {
    if (!run) return;
    player.position.copy(run.exitPosition).add(new THREE.Vector3(0, player.height, 2));
    updateCamera();
  },
  triggerFailure() {
    endRun(false, "Automated verification triggered the failure condition.");
  },
  triggerSuccess() {
    endRun(true, "Automated verification triggered the escape condition.");
  },
};

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (run?.state === "playing") {
    run.elapsed += dt;
    movePlayer(dt);
    updateThreat(dt);
    animateObjects(dt);
    updateCamera();
    updatePrompt(dt);
    updateHud();
  }
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

startButton.addEventListener("click", startRun);
restartButton.addEventListener("click", startRun);
window.addEventListener("resize", onResize);
window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "KeyE") interact();
  if (event.code === "KeyR" && run?.state !== "playing") startRun();
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement === canvas && running) handleLook(event.movementX, event.movementY);
});
canvas.addEventListener("click", () => {
  if (running && !isTouchDevice()) canvas.requestPointerLock?.();
});
canvas.addEventListener("touchstart", (event) => {
  if (!running || event.target === movePad || movePad.contains(event.target)) return;
  touchingLook = true;
  lastTouch = event.changedTouches[0];
});
canvas.addEventListener("touchmove", (event) => {
  if (!touchingLook || !lastTouch) return;
  const touch = event.changedTouches[0];
  handleLook(touch.clientX - lastTouch.clientX, touch.clientY - lastTouch.clientY);
  lastTouch = touch;
});
canvas.addEventListener("touchend", () => {
  touchingLook = false;
  lastTouch = null;
});

movePad.addEventListener("touchmove", (event) => {
  event.preventDefault();
  const rect = movePad.getBoundingClientRect();
  const touch = event.changedTouches[0];
  touchMove.set(
    THREE.MathUtils.clamp((touch.clientX - rect.left - rect.width / 2) / (rect.width / 2), -1, 1),
    THREE.MathUtils.clamp((touch.clientY - rect.top - rect.height / 2) / (rect.height / 2), -1, 1),
  );
});
movePad.addEventListener("touchend", () => touchMove.set(0, 0));
touchInteract.addEventListener("click", interact);
touchSprint.addEventListener("pointerdown", () => {
  sprintHeld = true;
});
touchSprint.addEventListener("pointerup", () => {
  sprintHeld = false;
});
touchSprint.addEventListener("pointercancel", () => {
  sprintHeld = false;
});

updateCamera();
tick();
