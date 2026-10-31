import {
  MeshRenderer,
  ScreenCapture,
  SyncedRoom,
  VideoPlayer,
  WebXR,
  XRRig,
  onStart,
} from "https://cdn.jsdelivr.net/npm/@needle-tools/engine@5.1.5/dist/needle-engine.min.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/@needle-tools/engine@5.1.5/dist/three.min.js";

const params = new URLSearchParams(window.location.search);
const roomId = params.get("room")?.trim() || `entropy-${crypto.randomUUID().slice(0, 8)}`;
if (!params.get("room")) {
  params.set("room", roomId);
  history.replaceState(null, "", `${location.pathname}?${params}${location.hash}`);
}

const ui = {
  room: document.querySelector("#room-id"),
  secure: document.querySelector("#secure-state"),
  status: document.querySelector("#status"),
  shareScreen: document.querySelector("#share-screen"),
  stopShare: document.querySelector("#stop-share"),
  copyLink: document.querySelector("#copy-link"),
  viewFront: document.querySelector("#view-front"),
  viewWide: document.querySelector("#view-wide"),
  viewStage: document.querySelector("#view-stage"),
  resetStage: document.querySelector("#reset-stage"),
  auxMode: document.querySelector("#aux-mode"),
  screenBrightness: document.querySelector("#screen-brightness"),
  brightnessValue: document.querySelector("#brightness-value"),
  resetBrightness: document.querySelector("#reset-brightness"),
  hud: document.querySelector("#hud"),
  toggleHud: document.querySelector("#toggle-hud"),
};

const DEFAULT_SCREEN_BRIGHTNESS = 125;
const AUX_MODES = ["FLOOR", "CEILING", "OFF"];

ui.room.textContent = roomId;
ui.secure.textContent = window.isSecureContext ? "yes" : "no — screen capture will be blocked";

const setHudCollapsed = (collapsed) => {
  ui.hud.classList.toggle("hud--collapsed", collapsed);
  ui.toggleHud.setAttribute("aria-expanded", String(!collapsed));
  ui.toggleHud.textContent = collapsed ? "Show controls" : "Hide controls";
  ui.toggleHud.title = collapsed ? "Show controls (H)" : "Hide controls (H)";
};

ui.toggleHud.addEventListener("click", () => {
  setHudCollapsed(!ui.hud.classList.contains("hud--collapsed"));
});

window.addEventListener("keydown", (event) => {
  const target = event.target;
  const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key.toLowerCase() === "h") {
    event.preventDefault();
    setHudCollapsed(!ui.hud.classList.contains("hud--collapsed"));
  }
});

function setStatus(message, level = "info") {
  ui.status.textContent = message;
  ui.status.dataset.level = level;
}

function createCurvedScreenGeometry({ chord = 26, arc = 31.8, height = 10, segments = 128 } = {}) {
  // Illustrative festival-scale arc, continuous UVs across the whole screen.
  const theta = 2.15;
  const radius = arc / theta;
  const half = theta / 2;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let y = 0; y <= 1; y += 1) {
    for (let i = 0; i <= segments; i += 1) {
      const u = i / segments;
      const a = THREE.MathUtils.lerp(-half, half, u);
      const x = radius * Math.sin(a);
      // Edges are forward, centre is recessed: concave toward audience (+Z).
      const z = radius * Math.cos(half) - radius * Math.cos(a);
      positions.push(x, (y - 0.5) * height, z);
      uvs.push(u, 1 - y);
    }
  }

  for (let i = 0; i < segments; i += 1) {
    const a = i;
    const b = i + 1;
    const c = segments + 1 + i;
    const d = segments + 2 + i;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.chord = chord;
  geometry.userData.arc = arc;
  geometry.userData.radius = radius;
  return geometry;
}

function makeVenueGeometry(context) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 70),
    new THREE.MeshStandardMaterial({ color: 0x0a0c0f, roughness: 0.86, metalness: 0.24 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  context.scene.add(floor);

  const grid = new THREE.GridHelper(80, 80, 0x222c32, 0x12181c);
  grid.position.y = 0.006;
  context.scene.add(grid);

  // A visible placeholder keeps the scene useful before selecting a video source.
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#032c2c");
  gradient.addColorStop(0.35, "#0b8a70");
  gradient.addColorStop(0.7, "#12244c");
  gradient.addColorStop(1, "#052425");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 18; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-100, 300 + i * 45);
    ctx.bezierCurveTo(500, 100 + i * 50, 1300, 850 - i * 35, 2200, 150 + i * 45);
    ctx.strokeStyle = `rgba(122, 255, 205, ${0.035 + (i % 3) * 0.015})`;
    ctx.lineWidth = 7 + i % 5;
    ctx.stroke();
  }
  const previewTexture = new THREE.CanvasTexture(canvas);
  previewTexture.colorSpace = THREE.SRGBColorSpace;
  const mainMaterial = new THREE.MeshBasicMaterial({
    map: previewTexture,
    color: 0xffffff,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mainScreen = new THREE.Mesh(createCurvedScreenGeometry(), mainMaterial);
  mainScreen.name = "EntropyMainCurvedLED";
  mainScreen.position.set(0, 5.9, -7);
  context.scene.add(mainScreen);

  // Overhead LED is a permanent surface; the auxiliary floor control remains separate.
  const roofMaterial = new THREE.MeshBasicMaterial({ map: previewTexture, color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
  const roofScreen = new THREE.Mesh(new THREE.PlaneGeometry(24, 10), roofMaterial);
  roofScreen.name = "FestivalOverheadLED";
  roofScreen.rotation.x = Math.PI / 2;
  roofScreen.position.set(0, 11.4, -3);
  context.scene.add(roofScreen);

  // Optional auxiliary surface, kept for existing screen sharing controls.
  const ceilingWidth = Math.sqrt(35 * (960 / 1080));
  const ceilingDepth = 35 / ceilingWidth;
  const floorAuxGeometry = new THREE.PlaneGeometry(18, 5);
  const ceilingAuxGeometry = new THREE.PlaneGeometry(ceilingWidth, ceilingDepth);
  const auxMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    toneMapped: false,
    depthWrite: false,
  });
  const auxScreen = new THREE.Mesh(floorAuxGeometry, auxMaterial);
  auxScreen.name = "EntropyAuxiliaryLED";
  auxScreen.rotation.x = -Math.PI / 2;
  auxScreen.position.set(0, 0.94, -1.2);
  auxScreen.renderOrder = 2;
  context.scene.add(auxScreen);

  // Festival platform and rigging are visual estimates from the reference photographs.
  const stage = new THREE.Group();
  const deckMaterial = new THREE.MeshStandardMaterial({ color: 0x252b2d, roughness: 0.68, metalness: 0.25 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(29, 0.9, 15), deckMaterial);
  deck.position.set(0, 0.45, -4.2);
  stage.add(deck);
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(29, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0x8ae8c5 }));
  fascia.position.set(0, 0.92, 2.35);
  stage.add(fascia);
  const riser = new THREE.Mesh(new THREE.BoxGeometry(8, 0.55, 2.6), deckMaterial);
  riser.position.set(0, 1.175, -4.6);
  stage.add(riser);
  context.scene.add(stage);

  const rigMaterial = new THREE.MeshStandardMaterial({ color: 0x20272b, metalness: 0.7, roughness: 0.4 });
  const frame = (w, h, d, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rigMaterial);
    mesh.position.set(x, y, z);
    context.scene.add(mesh);
  };
  for (const x of [-14, 14]) frame(0.35, 12, 0.35, x, 6, 1.5);
  frame(28.4, 0.35, 0.35, 0, 11.7, 1.5);
  frame(28.4, 0.35, 0.35, 0, 11.7, -7.5);
  for (let x = -12; x <= 12; x += 2) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshBasicMaterial({ color: 0xb9ffe0 }));
    light.position.set(x, 11.45, 1.35);
    context.scene.add(light);
  }
  // Circular overhead light rings echo the photographed roof rig.
  for (const radius of [1.4, 2.8, 4.2]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.035, 8, 96), new THREE.MeshBasicMaterial({ color: 0x93efcb }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 11.25, -3);
    context.scene.add(ring);
  }

  context.scene.add(new THREE.HemisphereLight(0xa9b6c6, 0x07090b, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.25);
  key.position.set(2, 7, 5);
  context.scene.add(key);

  return {
    mainScreen,
    mainMaterial,
    roofMaterial,
    previewTexture,
    auxScreen,
    auxMaterial,
    floorAuxGeometry,
    ceilingAuxGeometry,
    grid,
    stage,
  };
}

function setCameraPose(context, position, target) {
  const camera = context.mainCamera;
  if (!camera) return;
  camera.position.set(...position);
  camera.lookAt(new THREE.Vector3(...target));
  camera.updateMatrixWorld(true);
}

onStart((context) => {
  const {
    mainScreen,
    mainMaterial,
    roofMaterial,
    previewTexture,
    auxScreen,
    auxMaterial,
    floorAuxGeometry,
    ceilingAuxGeometry,
    grid,
    stage,
  } = makeVenueGeometry(context);

  context.scene.addComponent(SyncedRoom, {
    roomName: roomId,
    urlParameterName: "room",
    requireRoomParameter: false,
    autoRejoin: true,
    createJoinButton: false,
    createViewOnlyButton: false,
  });

  context.scene.addComponent(WebXR, {
    createVRButton: true,
    createARButton: false,
    createQRCode: true,
    showHandModels: true,
    useDefaultControls: true,
  });

  const rig = new THREE.Object3D();
  rig.name = "EntropyXRRig";
  rig.position.set(0, 0, 4.8);
  context.scene.add(rig);
  rig.addComponent(XRRig);

  const mainRenderer = mainScreen.addComponent(MeshRenderer);
  const player = mainScreen.addComponent(VideoPlayer, { playOnAwake: true });
  player.targetMaterialRenderer = mainRenderer;

  const capture = mainScreen.addComponent(ScreenCapture, {
    allowStartOnClick: false,
    autoConnect: false,
    device: "Screen",
  });

  let auxMode = "OFF";
  let raf = 0;
  let configuredSource = null;
  let floorTexture = null;
  let ceilingTexture = null;

  const getMainScreenMaterials = () => {
    const materials = Array.isArray(mainScreen.material) ? mainScreen.material : [mainScreen.material];
    return materials.filter(Boolean);
  };

  const isVideoTexture = (texture) => {
    const image = texture?.image;
    return Boolean(
      texture?.isVideoTexture ||
        (typeof HTMLVideoElement !== "undefined" && image instanceof HTMLVideoElement) ||
        image?.tagName === "VIDEO",
    );
  };

  const getSharedVideoTexture = () => {
    const activeTexture = getMainScreenMaterials()
      .map((material) => material.map)
      .find(isVideoTexture);
    return activeTexture || (isVideoTexture(mainMaterial.map) ? mainMaterial.map : null);
  };

  const setScreenBrightness = (percent) => {
    const brightness = THREE.MathUtils.clamp(Number(percent), 50, 200);
    const gain = brightness / 100;
    const mainMaterials = new Set([mainMaterial, ...getMainScreenMaterials()]);
    for (const material of mainMaterials) {
      material.color?.setRGB(gain, gain, gain);
    }
    auxMaterial.color.setRGB(gain, gain, gain);
    roofMaterial.color.setRGB(gain, gain, gain);
    ui.screenBrightness.value = String(brightness);
    ui.brightnessValue.textContent = `${Math.round(brightness)}%`;
  };

  const disposeAuxTextures = () => {
    auxMaterial.map = null;
    auxMaterial.needsUpdate = true;
    floorTexture?.dispose();
    ceilingTexture?.dispose();
    floorTexture = null;
    ceilingTexture = null;
  };

  const applyAuxMode = () => {
    let texture = null;
    if (auxMode === "FLOOR") {
      auxScreen.geometry = floorAuxGeometry;
      auxScreen.rotation.set(-Math.PI / 2, 0, 0);
      auxScreen.position.set(0, 0.94, -1.2);
      texture = floorTexture;
    } else if (auxMode === "CEILING") {
      auxScreen.geometry = ceilingAuxGeometry;
      auxScreen.rotation.set(Math.PI / 2, 0, 0);
      auxScreen.position.set(0, 11.3, -3);
      texture = ceilingTexture;
    }

    if (auxMaterial.map !== texture) {
      auxMaterial.map = texture;
      auxMaterial.needsUpdate = true;
    }

    const auxVisible = auxMode !== "OFF" && Boolean(texture);
    auxScreen.visible = auxVisible;
    const floorVisible = auxMode === "FLOOR" && auxVisible;
    stage.visible = true;
    grid.visible = !floorVisible;
    ui.auxMode.textContent = `AUX: ${auxMode}`;
  };

  const configureAuxTextures = (source) => {
    disposeAuxTextures();

    floorTexture = source.clone();
    floorTexture.colorSpace = THREE.SRGBColorSpace;
    floorTexture.wrapS = THREE.ClampToEdgeWrapping;
    floorTexture.wrapT = THREE.ClampToEdgeWrapping;
    floorTexture.repeat.set(1, -1);
    floorTexture.offset.set(0, 1);
    floorTexture.needsUpdate = true;

    ceilingTexture = source.clone();
    ceilingTexture.colorSpace = THREE.SRGBColorSpace;
    ceilingTexture.wrapS = THREE.ClampToEdgeWrapping;
    ceilingTexture.wrapT = THREE.ClampToEdgeWrapping;
    // Supplied mapping: 1920x1080 input -> 960x1080 output = centre half horizontally.
    ceilingTexture.repeat.set(0.5, 1);
    ceilingTexture.offset.set(0.25, 0);
    ceilingTexture.needsUpdate = true;

    roofMaterial.map = ceilingTexture;
    roofMaterial.needsUpdate = true;
    configuredSource = source;
    applyAuxMode();
  };

  // Follow Needle's active material because VideoPlayer may replace the original material map.
  const syncAuxTextures = () => {
    const source = getSharedVideoTexture();
    if (!source) {
      if (configuredSource || floorTexture || ceilingTexture) {
        disposeAuxTextures();
        configuredSource = null;
        roofMaterial.map = previewTexture;
        roofMaterial.needsUpdate = true;
      }
      applyAuxMode();
      raf = requestAnimationFrame(syncAuxTextures);
      return;
    }

    if (configuredSource !== source) {
      source.colorSpace = THREE.SRGBColorSpace;
      source.needsUpdate = true;
      configureAuxTextures(source);
      setScreenBrightness(ui.screenBrightness.value);
    }
    applyAuxMode();
    raf = requestAnimationFrame(syncAuxTextures);
  };
  auxScreen.visible = false;
  syncAuxTextures();

  const resetStage = () => {
    mainScreen.position.set(0, 5.9, -7);
    mainScreen.quaternion.identity();
    applyAuxMode();
    setCameraPose(context, [0, 8, 31], [0, 5.5, -3]);
    setStatus("Festival stage view reset.");
  };

  ui.shareScreen.addEventListener("click", async () => {
    if (!window.isSecureContext) {
      setStatus("Window/screen capture requires HTTPS or localhost.", "warn");
      return;
    }
    setStatus("Waiting for the browser window/screen picker…");
    try {
      await capture.share({ device: "Screen" });
      setStatus(`Live share started. Main LED uses the full source; auxiliary mode is ${auxMode}.`);
    } catch (error) {
      console.error(error);
      setStatus(`Capture did not start: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  });

  ui.stopShare.addEventListener("click", () => {
    capture.close();
    setStatus("Live share stopped.");
  });

  ui.copyLink.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setStatus("Room URL copied. Open the same URL on Vision Pro Safari.");
    } catch {
      setStatus("Clipboard permission failed. Copy the browser address manually.", "warn");
    }
  });

  ui.viewFront.addEventListener("click", () => {
    setCameraPose(context, [0, 8, 31], [0, 5.5, -3]);
    setStatus("Front-of-house camera.");
  });

  ui.viewWide.addEventListener("click", () => {
    setCameraPose(context, [24, 17, 30], [0, 5, -3]);
    setStatus("Wide venue overview.");
  });

  ui.viewStage.addEventListener("click", () => {
    setCameraPose(context, [-10, 3, 4], [3, 6, -7]);
    setStatus("Stage-side camera.");
  });

  ui.resetStage.addEventListener("click", resetStage);
  ui.auxMode.addEventListener("click", () => {
    const nextModeIndex = (AUX_MODES.indexOf(auxMode) + 1) % AUX_MODES.length;
    auxMode = AUX_MODES[nextModeIndex];
    applyAuxMode();
    if (auxMode !== "OFF" && !auxMaterial.map) {
      setStatus(`${auxMode} auxiliary LED will appear when the shared video texture is available.`);
    } else {
      setStatus(auxMode === "OFF" ? "Auxiliary LED hidden." : `${auxMode} auxiliary LED visible.`);
    }
  });
  ui.screenBrightness.addEventListener("input", () => {
    setScreenBrightness(ui.screenBrightness.value);
  });
  ui.resetBrightness.addEventListener("click", () => {
    setScreenBrightness(DEFAULT_SCREEN_BRIGHTNESS);
    setStatus("Screen brightness reset to 125%.");
  });

  window.addEventListener(
    "pagehide",
    () => {
      cancelAnimationFrame(raf);
      disposeAuxTextures();
    },
    { once: true },
  );

  setScreenBrightness(DEFAULT_SCREEN_BRIGHTNESS);
  resetStage();
  // Needle initializes orbit controls after onStart; restore the intended opening view.
  window.setTimeout(() => setCameraPose(context, [0, 8, 31], [0, 5.5, -3]), 800);
  applyAuxMode();
  setStatus(`Ready in room ${roomId}. Use Pick Window / Screen on the source computer.`);
});
