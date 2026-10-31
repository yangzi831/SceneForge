import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSRPass } from "three/addons/postprocessing/SSRPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { makeVenueGeometry } from "./stage.js";

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

const { mainMaterial, roofMaterial, roofScreen, foregroundScreen, foregroundMaterial, footprint, previewTexture } = makeVenueGeometry({ scene });
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

let texture = previewTexture;
let stream = null;
let video = null;
let objectUrl = null;
const ids = ["scaleX", "scaleY", "offsetX", "offsetY"];
const defaults = { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
try {
  const saved = JSON.parse(localStorage.getItem("sceneforge-unified-uv") || "{}");
  for (const id of ids) if (Number.isFinite(saved[id])) $(id).value = String(saved[id]);
} catch { /* Storage may be unavailable in private browsing. */ }

function applyAlignment() {
  const values = Object.fromEntries(ids.map((id) => [id, Number($(id).value)]));
  // The same texture object and transform are shared by all three surfaces.
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(values.scaleX, values.scaleY);
  texture.offset.set((1 - values.scaleX) / 2 + values.offsetX, (1 - values.scaleY) / 2 + values.offsetY);
  texture.updateMatrix();
  foregroundMaterial.uniforms.image.value = texture;
  foregroundMaterial.uniforms.imageTransform.value = texture.matrix;
  texture.needsUpdate = true;
  for (const id of ids) $(`${id}Out`).textContent = values[id].toFixed(2);
  try { localStorage.setItem("sceneforge-unified-uv", JSON.stringify(values)); } catch { /* optional */ }
}
for (const id of ids) $(id).addEventListener("input", applyAlignment);
$("resetUV").addEventListener("click", () => { for (const id of ids) $(id).value = String(defaults[id]); applyAlignment(); });

function stopMedia() {
  if (stream) { for (const track of stream.getTracks()) { track.onended = null; track.stop(); } stream = null; }
  if (video) { video.pause(); video.srcObject = null; video.removeAttribute("src"); video.load(); video = null; }
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  if (texture !== previewTexture) texture.dispose();
  texture = previewTexture;
  mainMaterial.map = texture;
  roofMaterial.map = texture;
  mainMaterial.needsUpdate = true;
  roofMaterial.needsUpdate = true;
  applyAlignment();
}
function setVideoTexture(element) {
  video = element;
  texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  mainMaterial.map = texture;
  roofMaterial.map = texture;
  mainMaterial.needsUpdate = true;
  roofMaterial.needsUpdate = true;
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
$("stop").addEventListener("click", () => { stopMedia(); status.textContent = "已停止，显示示意画面。"; });
$("scrimVisible").addEventListener("change", () => { foregroundScreen.visible = $("scrimVisible").checked; });
for (const [id, uniform] of [["scrimOpacity", "opacity"], ["scrimKey", "keyLevel"]]) {
  $(id).addEventListener("input", () => {
    const value = Number($(id).value);
    foregroundMaterial.uniforms[uniform].value = value;
    $(`${id}Out`).textContent = value.toFixed(2);
  });
}
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
$("performer").addEventListener("click", () => view([1.6, 2.5, 3.3], [0, 1.8, -1.8], false, 60));
$("orbit").addEventListener("click", () => view([0, 19.2, 3.5], [0, 16.2, -2.3], false, 85));
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight); composer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); composer.setSize(innerWidth, innerHeight); });
addEventListener("pagehide", stopMedia, { once: true });
applyAlignment();
front();
renderer.setAnimationLoop(() => { controls.update(); composer.render(); });
