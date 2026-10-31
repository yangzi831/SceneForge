import * as THREE from "three";

// All LED surfaces sample the same world-space field. A packet crossing the
// rear, wings and front veil therefore keeps its position around the band.
export const spatialFlowGLSL = `
  uniform float flowTime;
  uniform float flowEnabled;
  uniform float flowEnergy;
  uniform float flowFlash;
  uniform float flowBurst;
  uniform float flowLift;
  uniform float flowGain;
  uniform vec3 flowColor;
  uniform mat3 flowImageTransform;
  varying vec3 stageWorldPosition;
  vec2 stagePanoramaUv(vec3 p) {
    // A shared frontal atlas preserves complete silhouettes on the main wall
    // and repeats the same movement on the upper tier. The orbit field below
    // provides circulation between surfaces without warping the motif.
    float horizontal = (p.x + 20.0) / 40.0 + sin(flowTime * 0.35) * 0.018;
    return vec2(fract(horizontal), fract((p.y - 0.9) / 11.0));
  }
  float stageFrost(vec3 p) {
    vec2 cell = floor(p.xy * 0.9), uv = fract(p.xy * 0.9);
    float nearest = 9.0, second = 9.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 offset = vec2(float(x), float(y));
        vec2 key = cell + offset;
        vec2 jitter = fract(sin(vec2(dot(key, vec2(127.1, 311.7)), dot(key, vec2(269.5, 183.3)))) * 43758.5453);
        float distanceToCell = length(offset + jitter - uv);
        if (distanceToCell < nearest) { second = nearest; nearest = distanceToCell; }
        else second = min(second, distanceToCell);
      }
    }
    float cracks = 1.0 - smoothstep(0.008, 0.045, second - nearest);
    float grain = fract(sin(dot(floor(p.xy * 95.0), vec2(12.9898, 78.233))) * 43758.5453);
    return 0.08 + cracks * 0.7 + pow(grain, 16.0) * 0.4;
  }
  vec4 stageFlow(vec3 p) {
    float angle = atan(p.x, (p.z + 2.5) * 1.35);
    float head = flowTime * 0.9 + flowLift * sin(flowTime * 1.5) * 0.35;
    float packets = 0.0;
    for (int i = 0; i < 3; i++) {
      float d = angle - head + float(i) * 2.094395;
      d = atan(sin(d), cos(d));
      packets += exp(-d * d * 3.8);
    }
    float elevation = 4.9 + 1.8 * sin(angle * 2.0 - flowTime * 0.7);
    float ribbon = exp(-pow((p.y - elevation) / 0.24, 2.0));
    float wake = exp(-pow((p.y - elevation + 0.55) / 0.65, 2.0)) * 0.24;
    float upper = 12.8 + 3.5 * sin(angle * 2.0 - flowTime * 0.55);
    float crown = exp(-pow((p.y - upper) / 0.32, 2.0));
    float dots = smoothstep(0.66, 0.95, sin(angle * 73.0 + p.y * 27.0 - flowTime * 12.0));
    float dust = exp(-pow((p.y - elevation) / 1.15, 2.0)) * dots * 0.48;
    float accentLines = pow(abs(sin(angle * 9.0 - flowTime * 11.0)), 24.0) * flowBurst;
    float light = clamp((ribbon + wake + crown * 0.9 + dust) * packets + accentLines * 0.28, 0.0, 1.0) * flowGain;
    return vec4(flowColor * (0.55 + flowEnergy * 0.2), light * flowEnabled);
  }
`;

export function createSpatialFlow() {
  const uniforms = {
    flowTime: { value: 0 }, flowEnabled: { value: 0 },
    flowFlash: { value: 0 }, flowBurst: { value: 0 }, flowLift: { value: 0 }, flowGain: { value: 1 },
    flowEnergy: { value: 0.4 }, flowImageTransform: { value: new THREE.Matrix3() }, flowColor: { value: new THREE.Color(0xd5f4ff) },
  };
  const attach = (material, frost = 0) => {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = `varying vec3 stageWorldPosition;\n${shader.vertexShader}`.replace(
        "#include <project_vertex>",
        "stageWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>",
      );
      shader.fragmentShader = `${spatialFlowGLSL}\n${shader.fragmentShader}`.replace(
        "#include <map_fragment>",
        `vec3 unmappedColor = diffuseColor.rgb;
        #include <map_fragment>
        #ifdef USE_MAP
        if (flowEnabled > 0.5) {
          vec2 panoramaUv = (flowImageTransform * vec3(stagePanoramaUv(stageWorldPosition), 1.0)).xy;
          diffuseColor.rgb = unmappedColor * texture2D(map, panoramaUv).rgb * (1.02 + flowBurst * 0.25 + flowLift * 0.12) * flowGain;
        }
        #endif
        vec4 spatial = stageFlow(stageWorldPosition);
        diffuseColor.rgb += spatial.rgb * spatial.a;
        diffuseColor.rgb *= mix(1.0, 0.78 + flowFlash * 0.22, flowEnabled);
        diffuseColor.rgb += flowColor * stageFrost(stageWorldPosition) * ${frost.toFixed(3)} * mix(1.0, 0.25, flowEnabled);`,
      );
    };
    material.customProgramCacheKey = () => `ice-spatial-flow-v8-${frost}`;
    material.needsUpdate = true;
  };
  return { uniforms, attach };
}
