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
};

const DEFAULT_SCREEN_BRIGHTNESS = 125;
const AUX_MODES = ["FLOOR", "CEILING", "OFF"];

ui.room.textContent = roomId;
ui.secure.textContent = window.isSecureContext ? "yes" : "no — screen capture will be blocked";

function setStatus(message, level = "info") {
  ui.status.textContent = message;
  ui.status.dataset.level = level;
}

function createCurvedScreenGeometry({ chord = 12.4, arc = 15.2, height = 5.5, segments = 96 } = {}) {
  // Solve the supplied arc/chord proportions approximately: 123.2° / R ≈ 7.06 m.
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
    new THREE.PlaneGeometry(20, 16),
    new THREE.MeshStandardMaterial({ color: 0x0a0c0f, roughness: 0.86, metalness: 0.24 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  context.scene.add(floor);

  const grid = new THREE.GridHelper(20, 40, 0x313740, 0x171b21);
  grid.position.y = 0.006;
  context.scene.add(grid);

  const mainMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mainScreen = new THREE.Mesh(createCurvedScreenGeometry(), mainMaterial);
  mainScreen.name = "EntropyMainCurvedLED";
  mainScreen.position.set(0, 3.25, -4.7);
  context.scene.add(mainScreen);

  // 35 m² and supplied 960:1080 centre-crop ratio -> approx 5.58 × 6.27 m.
  const ceilingWidth = Math.sqrt(35 * (960 / 1080));
  const ceilingDepth = 35 / ceilingWidth;
  const floorAuxGeometry = new THREE.PlaneGeometry(12.4, 7);
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
  auxScreen.position.set(0, 0.025, -1.2);
  auxScreen.renderOrder = 2;
  context.scene.add(auxScreen);

  // Stage reference slab, not claimed as measured geometry.
  const stage = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.16, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x171a1f, roughness: 0.78 }),
  );
  stage.position.set(0, 0.08, -1.3);
  context.scene.add(stage);

  context.scene.add(new THREE.HemisphereLight(0xa9b6c6, 0x07090b, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.25);
  key.position.set(2, 7, 5);
  context.scene.add(key);

  return {
    mainScreen,
    mainMaterial,
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

  let auxMode = "FLOOR";
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
      auxScreen.position.set(0, 0.025, -1.2);
      texture = floorTexture;
    } else if (auxMode === "CEILING") {
      auxScreen.geometry = ceilingAuxGeometry;
      auxScreen.rotation.set(Math.PI / 2, 0, 0);
      auxScreen.position.set(0, 5.55, -1.15);
      texture = ceilingTexture;
    }

    if (auxMaterial.map !== texture) {
      auxMaterial.map = texture;
      auxMaterial.needsUpdate = true;
    }

    const auxVisible = auxMode !== "OFF" && Boolean(texture);
    auxScreen.visible = auxVisible;
    const floorVisible = auxMode === "FLOOR" && auxVisible;
    stage.visible = !floorVisible;
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
    mainScreen.position.set(0, 3.25, -4.7);
    mainScreen.quaternion.identity();
    applyAuxMode();
    setCameraPose(context, [0, 3.1, 7.8], [0, 2.7, -3.0]);
    setStatus("Stage reset to the ENTROPY preview origin.");
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
    setCameraPose(context, [0, 3.1, 7.8], [0, 2.7, -3.0]);
    setStatus("Front-of-house camera.");
  });

  ui.viewWide.addEventListener("click", () => {
    setCameraPose(context, [8.5, 6.6, 9.5], [0, 2.7, -2.3]);
    setStatus("Wide venue overview.");
  });

  ui.viewStage.addEventListener("click", () => {
    setCameraPose(context, [-2.8, 1.8, -0.1], [2.0, 3.0, -4.4]);
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
  applyAuxMode();
  setStatus(`Ready in room ${roomId}. Use Pick Window / Screen on the source computer.`);
});
