import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSRPass } from "three/addons/postprocessing/SSRPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { makeVenueGeometry } from "./stage.js";
import { createShowVisual } from "./show-visual.js";

const $ = (id) => document.getElementById(id);
const viewport = $("viewport");
const status = $("status");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111b20);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 250);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
viewport.appendChild(renderer.domElement);

const { setStagePalette, mainMaterial, roofMaterial, roofScreen, foregroundScreen, foregroundMaterial, footprint, previewTexture } = makeVenueGeometry({ scene });
const ground = scene.getObjectByName("ReflectiveGround");
const deck = scene.getObjectByName("ReflectiveStageDeck");
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 2;
controls.maxDistance = 180;
controls.maxPolarAngle = Math.PI / 2 - 0.025;

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const ssrPass = new SSRPass({ renderer, scene, camera, width: innerWidth, height: innerHeight, selects: [ground, deck] });
ssrPass.resolutionScale = 0.5;
ssrPass.opacity = 0.55;
ssrPass.maxDistance = 35;
ssrPass.thickness = 0.15;
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.45, 0.8);
composer.addPass(renderPass);
composer.addPass(ssrPass);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());
renderPass.enabled = false;

const palettes = {
  mint: { primary: "#b5fff0", halo: "#32d6ac", accent: "#ffe7b2", beam: "#f8fffc", background: "#101d1c", gradient: ["#032c2c", "#0b8a70", "#12244c", "#052425"] },
  blue: { primary: "#abcfff", halo: "#618cff", accent: "#e2efff", beam: "#eef5ff", background: "#101728", gradient: ["#07172e", "#285795", "#18274f", "#07131f"] },
  rose: { primary: "#f7b9cb", halo: "#da6d91", accent: "#ffe4c8", beam: "#fff3ee", background: "#25151c", gradient: ["#30121f", "#98445b", "#4d233f", "#23131d"] },
  amber: { primary: "#ffdaa0", halo: "#ec9743", accent: "#fff0ce", beam: "#fff8e9", background: "#241a13", gradient: ["#29170b", "#a25721", "#513024", "#1f160f"] },
  violet: { primary: "#d8c7ff", halo: "#9b7ad9", accent: "#f2eaff", beam: "#f8f4ff", background: "#191528", gradient: ["#1a1032", "#60468b", "#2c2557", "#131327"] },
  mono: { primary: "#e3f2ee", halo: "#88a9a5", accent: "#fff7e8", beam: "#ffffff", background: "#141c1d", gradient: ["#101c1c", "#506b68", "#25363f", "#111a1c"] },
};
let activePalette = "mint";
let currentPalette = palettes.mint;
function makeCustomPalette(hex) {
  const color = new THREE.Color(hex);
  const blend = (other, amount) => `#${color.clone().lerp(new THREE.Color(other), amount).getHexString()}`;
  return {
    primary: blend("#ffffff", 0.35), halo: hex, accent: blend("#fff4df", 0.70),
    beam: blend("#ffffff", 0.9), background: blend("#060b12", 0.92),
    gradient: [blend("#050d14", 0.9), blend("#06151a", 0.4), blend("#121530", 0.7), blend("#020910", 0.9)],
  };
}
function applyPalette(palette, selection) {
  currentPalette = palette;
  activePalette = selection;
  setStagePalette(palette);
  const tint = $("tintVideo").checked ? new THREE.Color(palette.primary).lerp(new THREE.Color(0xffffff), 0.35) : new THREE.Color(0xffffff);
  mainMaterial.color.copy(tint);
  roofMaterial.color.copy(tint);
  roofScreen.material.color.copy(tint);
  foregroundMaterial.uniforms.screenTint.value.copy(tint);
  for (const button of document.querySelectorAll("[data-palette]")) button.setAttribute("aria-pressed", String(button.dataset.palette === selection));
  try { localStorage.setItem("sceneforge-stage-palette", JSON.stringify({ selection, custom: $("customColor").value, tint: $("tintVideo").checked })); } catch { /* optional */ }
}
for (const button of document.querySelectorAll("[data-palette]")) {
  button.addEventListener("click", () => applyPalette(palettes[button.dataset.palette], button.dataset.palette));
}
$("customColor").addEventListener("input", () => applyPalette(makeCustomPalette($("customColor").value), "custom"));
$("tintVideo").addEventListener("change", () => applyPalette(currentPalette, activePalette));
try {
  const savedPalette = JSON.parse(localStorage.getItem("sceneforge-stage-palette") || "{}");
  if (/^#[0-9a-f]{6}$/i.test(savedPalette.custom || "")) $("customColor").value = savedPalette.custom;
  $("tintVideo").checked = savedPalette.tint === true;
  if (savedPalette.selection === "custom") { activePalette = "custom"; currentPalette = makeCustomPalette($("customColor").value); }
  else if (Object.hasOwn(palettes, savedPalette.selection)) { activePalette = savedPalette.selection; currentPalette = palettes[activePalette]; }
} catch { /* Storage may be unavailable. */ }
applyPalette(currentPalette, activePalette);

let texture = previewTexture;
let stream = null;
let video = null;
let objectUrl = null;
let show = null;
let showPlaying = false;
let showElapsed = 0;
let showLastFrame = 0;
let previousTime = 0;
const ids = ["scaleX", "scaleY", "offsetX", "offsetY"];
const defaults = { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
try {
  const saved = JSON.parse(localStorage.getItem("sceneforge-unified-uv") || "{}");
  for (const id of ids) if (Number.isFinite(saved[id])) $(id).value = String(saved[id]);
} catch { /* Storage may be unavailable in private browsing. */ }

function applyAlignment() {
  const values = Object.fromEntries(ids.map((id) => [id, Number($(id).value)]));
  // The two generated layers use the same UV adjustment and timeline.
  const foregroundTexture = show ? show.foregroundTexture : texture;
  for (const screenTexture of new Set([texture, foregroundTexture])) {
    screenTexture.wrapS = THREE.ClampToEdgeWrapping;
    screenTexture.wrapT = THREE.ClampToEdgeWrapping;
    screenTexture.repeat.set(values.scaleX, values.scaleY);
    screenTexture.offset.set((1 - values.scaleX) / 2 + values.offsetX, (1 - values.scaleY) / 2 + values.offsetY);
    screenTexture.updateMatrix();
    screenTexture.needsUpdate = true;
  }
  foregroundMaterial.uniforms.image.value = foregroundTexture;
  foregroundMaterial.uniforms.imageTransform.value = foregroundTexture.matrix;
  for (const id of ids) $(`${id}Out`).textContent = values[id].toFixed(2);
  try { localStorage.setItem("sceneforge-unified-uv", JSON.stringify(values)); } catch { /* optional */ }
}
for (const id of ids) $(id).addEventListener("input", applyAlignment);
$("resetUV").addEventListener("click", () => { for (const id of ids) $(id).value = String(defaults[id]); applyAlignment(); });

function stopMedia() {
  if (stream) { for (const track of stream.getTracks()) { track.onended = null; track.stop(); } stream = null; }
  if (video) { video.pause(); video.srcObject = null; video.removeAttribute("src"); video.load(); video = null; }
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  if (show) { show.dispose(); show = null; }
  else if (texture !== previewTexture) texture.dispose();
  showPlaying = false;
  $("pauseShow").disabled = true;
  $("pauseShow").textContent = "暂停";
  texture = previewTexture;
  mainMaterial.map = texture;
  roofMaterial.map = texture;
  roofScreen.material.map = texture;
  mainMaterial.needsUpdate = true;
  roofMaterial.needsUpdate = true;
  roofScreen.material.needsUpdate = true;
  applyAlignment();
}
function setVideoTexture(element) {
  video = element;
  texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  mainMaterial.map = texture;
  roofMaterial.map = texture;
  roofScreen.material.map = texture;
  mainMaterial.needsUpdate = true;
  roofMaterial.needsUpdate = true;
  roofScreen.material.needsUpdate = true;
  applyAlignment();
}
$("share").addEventListener("click", async () => {
  if (!navigator.mediaDevices?.getDisplayMedia) { status.textContent = "当前浏览器无法选择屏幕，请使用 HTTPS 页面和支持屏幕共享的浏览器。"; return; }
  let nextStream = null;
  try {
    nextStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    stopMedia();
    stream = nextStream;
    const element = document.createElement("video");
    element.muted = true; element.playsInline = true; element.srcObject = stream;
    await element.play();
    setVideoTexture(element);
    stream.getVideoTracks()[0].onended = () => { stopMedia(); status.textContent = "屏幕共享已结束，显示示意画面。"; };
    status.textContent = "屏幕共享中：所有屏幕使用同一组画面调整。";
  } catch (error) {
    if (nextStream) { for (const track of nextStream.getTracks()) track.stop(); stopMedia(); }
    status.textContent = `屏幕共享未启动：${error.message || error}`;
  }
});
$("file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  stopMedia();
  objectUrl = URL.createObjectURL(file);
  const element = document.createElement("video");
  element.muted = true; element.loop = true; element.playsInline = true; element.src = objectUrl;
  try { await element.play(); setVideoTexture(element); status.textContent = `正在预览：${file.name}`; }
  catch (error) { stopMedia(); status.textContent = `无法播放视频：${error.message || error}`; }
  event.target.value = "";
});
$("playShow").addEventListener("click", () => {
  stopMedia();
  show = createShowVisual();
  texture = show.texture;
  showElapsed = 0; showLastFrame = 0; previousTime = 0; showPlaying = true;
  show.render(0, Number($("showFlash").value));
  mainMaterial.map = texture; roofMaterial.map = texture; roofScreen.material.map = texture;
  mainMaterial.needsUpdate = true; roofMaterial.needsUpdate = true; roofScreen.material.needsUpdate = true;
  $("tintVideo").checked = false;
  applyPalette(palettes.mono, "mono");
  applyAlignment();
  $("pauseShow").disabled = false;
  status.textContent = "黑白演出视觉播放中：前纱幕与后屏同步，画面持续循环。";
});
$("pauseShow").addEventListener("click", () => {
  if (!show) return;
  showPlaying = !showPlaying; previousTime = 0;
  $("pauseShow").textContent = showPlaying ? "暂停" : "继续";
  status.textContent = showPlaying ? "黑白演出视觉播放中。" : "黑白演出视觉已暂停。";
});
$("showSpeed").addEventListener("input", () => { $("showSpeedOut").textContent = `${Number($("showSpeed").value).toFixed(1)}×`; });
$("showFlash").addEventListener("input", () => {
  $("showFlashOut").textContent = `${Math.round(Number($("showFlash").value) * 100)}%`;
  if (show && !showPlaying) show.render(showElapsed, Number($("showFlash").value));
});
$("stop").addEventListener("click", () => { stopMedia(); status.textContent = "已停止，显示示意画面。"; });
$("scrimVisible").addEventListener("change", () => { foregroundScreen.visible = $("scrimVisible").checked; });
for (const [id, uniform] of [["scrimOpacity", "opacity"], ["scrimKey", "keyLevel"]]) {
  $(id).addEventListener("input", () => {
    const value = Number($(id).value);
    foregroundMaterial.uniforms[uniform].value = value;
    $(`${id}Out`).textContent = value.toFixed(2);
  });
}
$("roofTransparency").addEventListener("input", () => {
  const transparency = Number($("roofTransparency").value);
  const material = roofScreen.material;
  const translucent = transparency > 0;
  if (material.transparent !== translucent) {
    material.transparent = translucent;
    material.depthWrite = !translucent;
    material.needsUpdate = true;
  }
  material.opacity = 1 - transparency / 100;
  $("roofTransparencyOut").textContent = `${transparency}%`;
});
$("ssr").addEventListener("change", () => { ssrPass.enabled = $("ssr").checked; renderPass.enabled = !ssrPass.enabled; });
$("bloom").addEventListener("change", () => { bloomPass.enabled = $("bloom").checked; });
$("bloomStrength").addEventListener("input", () => { bloomPass.strength = Number($("bloomStrength").value); $("bloomStrengthOut").textContent = bloomPass.strength.toFixed(2); });
$("collapse").addEventListener("click", () => { const collapsed = $("panel").classList.toggle("collapsed"); $("collapse").textContent = collapsed ? "打开控制" : "收起"; });

function view(position, target, top = false, fov = 42) {
  camera.fov = fov;
  camera.updateProjectionMatrix();
  roofScreen.visible = !top;
  footprint.visible = top;
  camera.position.set(...position);
  controls.target.set(...target);
  controls.update();
}
function front() {
  const aspect = Math.max(innerWidth / innerHeight, 0.3);
  view([0, 13, Math.max(58, 50 * 1.5 / aspect)], [0, 11, -3]);
}
$("front").addEventListener("click", front);
$("wide").addEventListener("click", () => view([38, 28, 58], [0, 10, -3]));
$("top").addEventListener("click", () => view([0, 78, -2.9], [0, 0, -3], true));
$("performer").addEventListener("click", () => view([1.2, 4.4, 20], [0, 2.1, -2.4], false, 55));
$("orbit").addEventListener("click", () => view([0, 19.2, 3.5], [0, 16.2, -2.3], false, 85));
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight); composer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); composer.setSize(innerWidth, innerHeight); });
addEventListener("pagehide", stopMedia, { once: true });
applyAlignment();
front();
renderer.setAnimationLoop((now) => {
  if (show && showPlaying) {
    if (previousTime) showElapsed += Math.min((now - previousTime) / 1000, 0.1) * Number($("showSpeed").value);
    previousTime = now;
    if (now - showLastFrame >= 1000 / 30) {
      show.render(showElapsed, Number($("showFlash").value));
      showLastFrame = now;
    }
  }
  controls.update(); composer.render();
});
