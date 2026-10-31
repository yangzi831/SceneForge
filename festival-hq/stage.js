import * as THREE from "three";
import { createSpatialFlow, spatialFlowGLSL } from "./spatial-flow.js";

function createCurvedScreenGeometry({ height = 10, segments = 200 } = {}) {
  // From left audience-side wing, around the recessed stage back, to right wing.
  // The rounded corners and the back wall form one continuous screen mesh.
  const path = new THREE.CatmullRomCurve3([
    // Broad audience-facing side wings; their inner edges sweep back to the centre.
    [-15, 0, 7.0], [-13, 0, 7.5], [-11, 0, 7.5], [-9, 0, 6.9],
    [-8, 0, 5.9], [-7.2, 0, 3.4], [-6.5, 0, 0.5], [-5.7, 0, -1.9],
    [-4.7, 0, -3.0], [-2.5, 0, -3.5], [0, 0, -3.6],
    [2.5, 0, -3.5], [4.7, 0, -3.0], [5.7, 0, -1.9], [6.5, 0, 0.5],
    [7.2, 0, 3.4], [8, 0, 5.9], [9, 0, 6.9], [11, 0, 7.5],
    [13, 0, 7.5], [15, 0, 7.0],
  ].map(([x, y, z]) => new THREE.Vector3(x * 1.18, y, 2 + (z - 2) * 0.55)), false, "centripetal");
  const points = path.getSpacedPoints(segments);
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let y = 0; y <= 1; y += 1) {
    points.forEach((point, i) => {
      // The central rear screen is lower than the tall side wings, as in the reference.
      const centreDip = 1.1 * (1 - THREE.MathUtils.smoothstep(Math.abs(point.x), 5.3, 9.4));
      const vertical = y === 0 ? -height / 2 : height / 2 - centreDip;
      positions.push(point.x, vertical, point.z);
      uvs.push(i / segments, 1 - y);
    });
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
  return geometry;
}

export function makeVenueGeometry(context) {
  const spatialFlow = createSpatialFlow();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 70),
    new THREE.MeshStandardMaterial({ color: 0x0a0c0f, roughness: 0.86, metalness: 0.24 }),
  );
  floor.name = "ReflectiveGround";
  floor.material.metalness = 0.8;
  floor.material.roughness = 0.32;
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
  // Redraw only the built-in artwork. User-provided video is never recolored here.
  const previewTexture = new THREE.CanvasTexture(canvas);
  previewTexture.colorSpace = THREE.SRGBColorSpace;
  const drawPreviewPalette = (colors) => {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    colors.gradient.forEach((color, i) => { gradient.addColorStop(i / (colors.gradient.length - 1), color); });
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const light = new THREE.Color(colors.primary);
    const rgb = light.getRGB({}, THREE.SRGBColorSpace);
    for (let i = 0; i < 18; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-100, 300 + i * 45);
      ctx.bezierCurveTo(500, 100 + i * 50, 1300, 850 - i * 35, 2200, 150 + i * 45);
      ctx.strokeStyle = `rgba(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)}, ${0.035 + (i % 3) * 0.015})`;
      ctx.lineWidth = 7 + i % 5;
      ctx.stroke();
    }
    previewTexture.needsUpdate = true;
  };
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

  // A slim warm edge follows the continuous, stepped crown of the screens.
  const screenPosition = mainScreen.geometry.attributes.position;
  const crownPoints = [];
  const rowLength = screenPosition.count / 2;
  for (let i = 0; i < rowLength; i += 1) {
    crownPoints.push(new THREE.Vector3(
      screenPosition.getX(rowLength + i), screenPosition.getY(rowLength + i) + 0.06,
      screenPosition.getZ(rowLength + i),
    ));
  }
  const crownMaterial = new THREE.MeshBasicMaterial({ color: 0xffe7b2 });
  const crown = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(crownPoints), 200, 0.035, 6, false),
    crownMaterial,
  );
  mainScreen.add(crown);

  // Overhead LED is a permanent surface; the auxiliary floor control remains separate.
  const roofMaterial = new THREE.MeshBasicMaterial({ map: previewTexture, color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
  // A separate material lets the ceiling fade without changing the ice or orbital screens.
  const ceilingMaterial = roofMaterial.clone();
  const roofScreen = new THREE.Mesh(new THREE.PlaneGeometry(32, 8), ceilingMaterial);
  roofScreen.name = "FestivalOverheadLED";
  roofScreen.rotation.x = Math.PI / 2;
  roofScreen.position.set(0, 11.4, -3);
  context.scene.add(roofScreen);

  const lightCore = new THREE.MeshBasicMaterial({ color: 0xb5eaff, toneMapped: false });
  const iceBodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x95bad0, metalness: 0.25, roughness: 0.28,
    transparent: true, opacity: 0.62, clearcoat: 0.9, side: THREE.DoubleSide,
  });
  const iceFragments = new THREE.Group();
  iceFragments.name = "FracturedIceArchitecture";
  // Every polygon shares the stage UV canvas. Tall outer masses descend into
  // smaller fragments at the apron; the central opening preserves the band.
  const shards = [
    { p: [[-23,1],[-22,13],[-19,17],[-17,10],[-19,2]], z: -0.8, d: 0.45 },
    { p: [[-20,12],[-18.5,20],[-15,17.8],[-16.8,12.5]], z: -2.5, d: 0.4 },
    { p: [[-17,13.5],[-14,19],[-9,21],[-11,16]], z: -4.8, d: 0.35 },
    { p: [[-10,17],[-7.5,22],[-3.5,23],[-5,19]], z: -4, d: 0.3 },
    { p: [[-3.8,20],[-1.5,23.6],[0.2,22.4],[-1,20.3]], z: -5.8, d: 0.28 },
    { p: [[4.8,18.5],[5.6,22],[10,21],[12.8,16]], z: -4.5, d: 0.4 },
    { p: [[12.8,15],[13.8,19.3],[18.2,18],[17,12]], z: -2.3, d: 0.5 },
    { p: [[19,2],[17.8,11.5],[20.5,16],[23.5,12.8],[24,0.8]], z: 0.6, d: 0.55 },
    { p: [[22.2,14.5],[24.1,18],[26,17],[24.8,13]], z: -2.5, d: 0.3 },
    { p: [[-27,0.8],[-26,7.5],[-23.5,9],[-24,3]], z: 3.2, d: 0.45 },
    { p: [[-24,0.9],[-21.2,5],[-19,3],[-19.5,1]], z: 5.5, d: 0.35 },
    { p: [[20,1],[21.5,5.5],[24,7],[25.4,1]], z: 5, d: 0.4 },
    { p: [[26.3,1],[27,5.4],[29,7],[28,2]], z: 2, d: 0.3 },
    { p: [[-15.5,1],[-13.8,3.8],[-12.3,2.3],[-11.8,1]], z: 6.4, d: 0.25 },
    { p: [[11,1],[12,2.9],[14,4],[15,1]], z: 6.6, d: 0.25 },
    { p: [[-23,9.4],[-23.4,11.2],[-21.8,12],[-21,10.3]], z: 2, d: 0.22 },
    { p: [[-12,11.8],[-10.3,15.8],[-8.8,14.2],[-9.7,12]], z: -0.5, d: 0.22 },
    { p: [[9.3,11.5],[9.8,14.5],[11.5,15.8],[12.1,13]], z: 0.1, d: 0.25 },
  ];
  for (const [index, { p: points, z, d }] of shards.entries()) {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }), iceBodyMaterial);
    body.position.z = z - d;
    const faceGeometry = new THREE.ShapeGeometry(shape);
    const pos = faceGeometry.getAttribute("position");
    const uvs = [];
    for (let i = 0; i < pos.count; i++) uvs.push((pos.getX(i) + 29) / 58, pos.getY(i) / 24);
    faceGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    const face = new THREE.Mesh(faceGeometry, roofMaterial);
    face.position.z = z + 0.015; face.name = `IceShardLED-${index + 1}`;

    // Fine 2 cm luminous seams replace the broad triangular light rails.
    const edgePoints = [...points, points[0]].map(([x, y]) => new THREE.Vector3(x, y, z + 0.045));
    const edgePath = new THREE.CurvePath();
    for (let j = 1; j < edgePoints.length; j++) edgePath.add(new THREE.LineCurve3(edgePoints[j - 1], edgePoints[j]));
    const outline = new THREE.Mesh(new THREE.TubeGeometry(edgePath, points.length * 10, 0.022, 5, false), lightCore);

    // A few internal fracture lines provide detail without filling the stage.
    const [v0, v1, v2] = points;
    const fracture = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(v0[0], v0[1], z + 0.04),
      new THREE.Vector3((v0[0] + v2[0]) / 2, (v1[1] + v2[1]) / 2, z + 0.04),
      new THREE.Vector3(v2[0], v2[1], z + 0.04),
    ]), new THREE.LineBasicMaterial({ color: 0xc3e5f8, transparent: true, opacity: 0.28 }));
    const fragment = new THREE.Group();
    fragment.name = `IceFragment-${index + 1}`;
    const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    fragment.position.set(cx, cy, z);
    fragment.rotation.y = (index % 2 ? 1 : -1) * (0.06 + (index % 4) * 0.055);
    fragment.rotation.x = (index % 3 - 1) * 0.06;
    for (const object of [body, face, outline, fracture]) {
      object.position.x -= cx; object.position.y -= cy; object.position.z -= z;
      fragment.add(object);
    }
    iceFragments.add(fragment);
  }
  context.scene.add(iceFragments);
  const archLights = [];
  for (const x of [-22, 23]) {
    const glow = new THREE.PointLight(0x8ecaff, 12, 9, 2);
    glow.position.set(x, 3, 3); archLights.push(glow); context.scene.add(glow);
  }
  spatialFlow.attach(mainMaterial);
  spatialFlow.attach(roofMaterial, 0.2);
  spatialFlow.attach(ceilingMaterial);

  // Hanging orbital screens: each narrow cylindrical LED ribbon has its own UVs,
  // while all ribbons and the sphere use the same material/texture transform.
  const orbitalScreens = new THREE.Group();
  orbitalScreens.name = "HangingOrbitalScreens";
  orbitalScreens.position.set(0, 16.2, -2.3);
  const sphereScreen = new THREE.Mesh(new THREE.SphereGeometry(1.65, 64, 40), roofMaterial);
  sphereScreen.name = "OrbitalSphereLED";
  orbitalScreens.add(sphereScreen);
  const rimMaterial = new THREE.MeshBasicMaterial({ color: 0xb3ffe4, toneMapped: false });
  const orientations = [
    [Math.PI * 0.28, 0.18, -0.45],
    [Math.PI * 0.34, -0.3, 0.55],
    [Math.PI * 0.48, 0.2, 0.04],
  ];
  orientations.forEach(([x, y, z], i) => {
    const ring = new THREE.Group();
    ring.name = `OrbitalRibbonLED-${i + 1}`;
    ring.rotation.set(x, y, z);
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(4.25, 4.25, 0.38, 128, 1, true), roofMaterial);
    ring.add(ribbon);
    for (const edgeY of [-0.21, 0.21]) {
      const edge = new THREE.Mesh(new THREE.TorusGeometry(4.25, 0.018, 8, 128), rimMaterial);
      edge.rotation.x = Math.PI / 2;
      edge.position.y = edgeY;
      ring.add(edge);
    }
    orbitalScreens.add(ring);
  });
  context.scene.add(orbitalScreens);

  // Transparent foreground scrim: brightness-keyed, so black areas disappear.
  // It sits between the audience (+Z) and the performer on the stage.
  const foregroundMaterial = new THREE.ShaderMaterial({
    uniforms: {
      image: { value: previewTexture },
      imageTransform: { value: previewTexture.matrix },
      screenTint: { value: new THREE.Color(0xffffff) },
      opacity: { value: 0.54 },
      haze: { value: 0.035 },
      ...spatialFlow.uniforms,
      keyLevel: { value: 0.12 },
    },
    vertexShader: `
      varying vec2 screenUv;
      varying vec3 stageWorldPosition;
      uniform mat3 imageTransform;
      void main() {
        screenUv = (imageTransform * vec3(uv, 1.0)).xy;
        stageWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `${spatialFlowGLSL}
      uniform float haze;
      uniform mat3 imageTransform;
      uniform sampler2D image;
      uniform float opacity;
      uniform vec3 screenTint;
      uniform float keyLevel;
      varying vec2 screenUv;
      void main() {
        vec2 sharedUv = (imageTransform * vec3(stagePanoramaUv(stageWorldPosition), 1.0)).xy;
        vec4 sampleColor = texture2D(image, flowEnabled > 0.5 ? sharedUv : screenUv);
        vec4 flow = stageFlow(stageWorldPosition);
        vec3 imageColor = sampleColor.rgb * screenTint * mix(1.0, 0.55, flowEnabled);
        imageColor += flow.rgb * flow.a;
        float brightness = max(max(imageColor.r, imageColor.g), imageColor.b);
        float alpha = smoothstep(keyLevel, keyLevel + 0.12, brightness) * opacity;
        float veil = haze * (0.8 + 0.2 * sin(stageWorldPosition.x * 70.0) * sin(stageWorldPosition.y * 95.0));
        gl_FragColor = vec4(imageColor + vec3(0.16, 0.23, 0.27) * veil, max(alpha, veil));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // A gently faceted wrap follows the apron, with a fractured upper edge.
  const scrimGeometry = new THREE.BufferGeometry();
  const scrimPositions = [], scrimUvs = [], scrimIndices = [];
  const scrimSegments = 80;
  for (let i = 0; i <= scrimSegments; i++) {
    const u = i / scrimSegments, x = (u - 0.5) * 34;
    const z = 1.7 * (1 - (x / 17) ** 2);
    const top = 9.7 + 0.9 * Math.sin(u * Math.PI * 3 + 0.2) + 0.35 * Math.sin(u * Math.PI * 9);
    scrimPositions.push(x, 1.0, z, x, top, z);
    scrimUvs.push(u, 0, u, 1);
    if (i < scrimSegments) { const a = i * 2; scrimIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  scrimGeometry.setAttribute("position", new THREE.Float32BufferAttribute(scrimPositions, 3));
  scrimGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(scrimUvs, 2));
  scrimGeometry.setIndex(scrimIndices); scrimGeometry.computeVertexNormals();
  const foregroundScreen = new THREE.Mesh(scrimGeometry, foregroundMaterial);
  foregroundScreen.name = "TransparentForegroundScreen";
  foregroundScreen.position.z = 3.81;
  foregroundScreen.renderOrder = 4;
  context.scene.add(foregroundScreen);
  const scrimFrame = new THREE.LineSegments(
    new THREE.EdgesGeometry(scrimGeometry, 30),
    new THREE.LineBasicMaterial({ color: 0xa8d3e7, transparent: true, opacity: 0.09, depthWrite: false }),
  );
  foregroundScreen.add(scrimFrame);

  // Highlight the screen footprint from above while the roof is hidden.
  const outlinePositions = mainScreen.geometry.attributes.position.array;
  const footprintPoints = [];
  for (let i = 0; i < outlinePositions.length / 2; i += 3) {
    footprintPoints.push(new THREE.Vector3(outlinePositions[i], 11.05, outlinePositions[i + 2] - 7));
  }
  const footprint = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(footprintPoints),
    new THREE.LineBasicMaterial({ color: 0x9dffe2 }),
  );
  footprint.visible = false;
  context.scene.add(footprint);

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
  // No auxiliary input is active in this preview; do not cover the stage with an empty white plane.
  auxScreen.visible = false;
  auxScreen.rotation.x = -Math.PI / 2;
  auxScreen.position.set(0, 0.94, -1.2);
  auxScreen.renderOrder = 2;
  context.scene.add(auxScreen);

  // Festival platform and rigging are visual estimates from the reference photographs.
  const stage = new THREE.Group();
  const deckMaterial = new THREE.MeshStandardMaterial({ color: 0x252b2d, roughness: 0.68, metalness: 0.25 });
  // Broad, shallow apron with a gently curved audience-facing edge.
  const deckShape = new THREE.Shape();
  deckShape.moveTo(-18.5, 9.5);
  deckShape.lineTo(18.5, 9.5);
  deckShape.lineTo(18.5, -2);
  deckShape.quadraticCurveTo(18.5, -3.5, 16, -4.2);
  deckShape.quadraticCurveTo(0, -6.4, -16, -4.2);
  deckShape.quadraticCurveTo(-18.5, -3.5, -18.5, -2);
  deckShape.closePath();
  const deck = new THREE.Mesh(new THREE.ExtrudeGeometry(deckShape, { depth: 0.9, bevelEnabled: false, curveSegments: 32 }), deckMaterial);
  deck.name = "ReflectiveStageDeck";
  deck.material.metalness = 0.65;
  deck.material.roughness = 0.35;
  deck.rotation.x = -Math.PI / 2;
  stage.add(deck);

  // Parallel arcs make the front of the stage read as a long, luminous apron.
  const apronMaterials = [];
  for (let i = 0; i < 3; i += 1) {
    const points = [];
    for (let j = 0; j <= 80; j += 1) {
      const x = -17.3 + 34.6 * j / 80;
      const z = 4.1 + 1.1 * (1 - (x / 17.3) ** 2) - i * 0.5;
      points.push(new THREE.Vector3(x, 0.93 + i * 0.015, z));
    }
    const strip = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 100, i === 0 ? 0.07 : 0.035, 6, false),
      new THREE.MeshBasicMaterial({ color: i === 0 ? 0xbaffed : 0x38cfa4, toneMapped: false }),
    );
    apronMaterials.push(strip.material);
    stage.add(strip);
  }
  // Low, elongated rounded performance riser; it no longer reads as a box.
  const riserShape = new THREE.Shape();
  riserShape.moveTo(-9.5, -0.8);
  riserShape.lineTo(9.5, -0.8);
  riserShape.quadraticCurveTo(10.4, -0.8, 10.4, 0);
  riserShape.quadraticCurveTo(10.4, 0.8, 9.5, 0.8);
  riserShape.lineTo(-9.5, 0.8);
  riserShape.quadraticCurveTo(-10.4, 0.8, -10.4, 0);
  riserShape.quadraticCurveTo(-10.4, -0.8, -9.5, -0.8);
  const riser = new THREE.Mesh(new THREE.ExtrudeGeometry(riserShape, { depth: 0.28, bevelEnabled: false, curveSegments: 12 }), deckMaterial);
  riser.rotation.x = -Math.PI / 2;
  riser.position.set(0, 0.9, -3.5);
  stage.add(riser);

  // Five simplified 1.7 m scale references: two guitars, keys, bass and drums.
  // They remain behind the transparent scrim and can be replaced with models later.
  const outfit = new THREE.MeshStandardMaterial({ color: 0x82929e, roughness: 0.78, metalness: 0.05, emissive: 0x18242c, emissiveIntensity: 0.45 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe3bda4, roughness: 0.8, emissive: 0x3a2820, emissiveIntensity: 0.2 });
  const instrumentDark = new THREE.MeshStandardMaterial({ color: 0x151d24, roughness: 0.45, metalness: 0.35 });
  const hardware = new THREE.MeshStandardMaterial({ color: 0xa9c5bf, roughness: 0.28, metalness: 0.8 });
  const cymbalMaterial = new THREE.MeshStandardMaterial({ color: 0xd7ad63, metalness: 0.75, roughness: 0.27 });
  const addBox = (parent, size, position, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  };
  const addRod = (parent, from, to, radius, material) => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 10), material);
    rod.position.copy(a.add(b).multiplyScalar(0.5));
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    parent.add(rod);
    return rod;
  };
  const makePerson = (x, y, z, name, scale = 1) => {
    const person = new THREE.Group();
    person.name = name;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.42, 4, 12), outfit);
    torso.position.y = 1.05;
    person.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skin);
    head.position.y = 1.58;
    person.add(head);
    for (const side of [-1, 1]) {
      addRod(person, [side * 0.1, 0.68, 0], [side * 0.1, 0.04, 0], 0.065, outfit);
      addRod(person, [side * 0.2, 1.25, 0], [side * 0.25, 0.78, 0.16], 0.055, outfit);
    }
    person.scale.setScalar(scale);
    person.position.set(x, y, z);
    stage.add(person);
    return person;
  };
  const makeGuitar = (person, color, isBass = false) => {
    const instrument = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.35 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), bodyMaterial);
    body.scale.set(0.22, 0.31, 0.075);
    instrument.add(body);
    const waist = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), bodyMaterial);
    waist.scale.set(0.17, 0.20, 0.07);
    waist.position.y = 0.17;
    instrument.add(waist);
    const neckLength = isBass ? 0.88 : 0.7;
    addBox(instrument, [0.075, neckLength, 0.06], [0, 0.29 + neckLength / 2, 0], hardware);
    addBox(instrument, [0.11, 0.15, 0.07], [0, 0.34 + neckLength, 0], bodyMaterial);
    instrument.rotation.z = -0.72;
    instrument.position.set(0.03, 0.87, 0.27);
    person.add(instrument);
  };
  const guitar1 = makePerson(-6.4, 0.9, -0.8, "GuitaristLeft");
  const guitar2 = makePerson(-2.5, 0.9, -0.6, "GuitaristRight");
  makePerson(3.0, 0.9, -0.8, "Keyboardist");
  const bassist = makePerson(6.4, 0.9, -0.8, "Bassist");
  makeGuitar(guitar1, 0xe1a45d);
  makeGuitar(guitar2, 0x9bcfc4);
  makeGuitar(bassist, 0xa45d5e, true);

  const keyboard = new THREE.Group();
  keyboard.name = "KeyboardAndStand";
  keyboard.position.set(3.0, 0.9, -0.15);
  addBox(keyboard, [1.35, 0.12, 0.42], [0, 0.91, 0], instrumentDark);
  for (let i = 0; i < 16; i += 1) {
    addBox(keyboard, [0.069, 0.012, 0.19], [-0.56 + i * 0.074, 0.98, 0.10], hardware);
  }
  addRod(keyboard, [-0.46, 0.05, 0], [0.42, 0.84, 0], 0.035, hardware);
  addRod(keyboard, [0.46, 0.05, 0], [-0.42, 0.84, 0], 0.035, hardware);
  stage.add(keyboard);

  // A separate, visibly raised drum platform sits behind the front line.
  const drumPlatform = addBox(stage, [4.0, 0.55, 2.8], [0, 1.175, -5.2], deckMaterial);
  drumPlatform.name = "RaisedDrumPlatform";
  const drumArea = new THREE.Group();
  drumArea.name = "DrumKit";
  drumArea.position.set(0, 1.45, -5.2);
  const kick = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.43, 24), instrumentDark);
  kick.rotation.x = Math.PI / 2;
  kick.position.set(0, 0.40, 0.52);
  drumArea.add(kick);
  const kickHead = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), hardware);
  kickHead.position.set(0, 0.40, 0.74);
  drumArea.add(kickHead);
  for (const x of [-0.37, 0.37]) {
    const tom = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.23, 20), instrumentDark);
    tom.position.set(x, 0.78, 0.25);
    drumArea.add(tom);
    const cymbal = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.035, 24), cymbalMaterial);
    cymbal.position.set(x * 2.2, 1.03, 0.25);
    drumArea.add(cymbal);
    addRod(drumArea, [x * 2.2, 0.02, 0.25], [x * 2.2, 1.02, 0.25], 0.017, hardware);
  }
  stage.add(drumArea);
  makePerson(0, 1.45, -5.75, "Drummer", 0.78);
  context.scene.add(stage);

  // Soft front/top washes make the five musicians legible without drawing
  // visible light cones. A separate wash reaches the raised drummer.
  const addPerformerWash = (position, targetPosition, intensity, angle) => {
    const light = new THREE.SpotLight(0xfff3e7, intensity, 18, angle, 0.85, 2);
    light.position.set(...position);
    light.target.position.set(...targetPosition);
    context.scene.add(light, light.target);
  };
  for (const x of [-6.4, -2.5, 3.0, 6.4]) {
    addPerformerWash([x - 0.7, 5.7, 3.1], [x, 1.8, -0.7], 160, 0.38);
  }
  addPerformerWash([0, 5.4, -2], [0, 2.1, -5.2], 140, 0.5);
  for (const x of [-5, 5]) {
    const rim = new THREE.SpotLight(0xc4e8ff, 130, 17, 0.6, 0.9, 2);
    rim.position.set(x, 5.7, -7.8); rim.target.position.set(x * 0.7, 1.8, -0.6);
    context.scene.add(rim, rim.target);
  }

  const rigMaterial = new THREE.MeshStandardMaterial({ color: 0x20272b, metalness: 0.7, roughness: 0.4 });
  const frame = (w, h, d, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rigMaterial);
    mesh.position.set(x, y, z);
    context.scene.add(mesh);
  };
  for (const x of [-18, 18]) frame(0.35, 12, 0.35, x, 6, 1.5);
  frame(36.4, 0.35, 0.35, 0, 11.7, 1.5);
  frame(36.4, 0.35, 0.35, 0, 11.7, -7.5);
  const topDotMaterial = new THREE.MeshBasicMaterial({ color: 0xb9ffe0 });
  for (let x = -16; x <= 16; x += 2) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), topDotMaterial);
    light.position.set(x, 11.45, 1.35);
    context.scene.add(light);
  }
  // Lighting composition: alternating warm and cool fixtures on the top truss,
  // segmented vertical side towers, and slender white beams.
  const lightHousing = new THREE.MeshStandardMaterial({ color: 0x10171a, metalness: 0.65, roughness: 0.42 });
  const coolLens = new THREE.MeshBasicMaterial({ color: 0xb8ffed, toneMapped: false });
  const warmLens = new THREE.MeshBasicMaterial({ color: 0xffd18b, toneMapped: false });
  const fixtureBodyGeometry = new THREE.CylinderGeometry(0.21, 0.27, 0.38, 12);
  const lensGeometry = new THREE.SphereGeometry(0.14, 12, 8);
  for (let i = 0; i < 13; i += 1) {
    const x = (i - 6) * 2.55;
    const body = new THREE.Mesh(fixtureBodyGeometry, lightHousing);
    body.position.set(x, 11.15, 1.2);
    context.scene.add(body);
    const lens = new THREE.Mesh(lensGeometry, i % 3 === 0 ? warmLens : coolLens);
    lens.position.set(x, 10.91, 1.3);
    context.scene.add(lens);
  }
  // Side towers frame the screens without placing bars across the video surface.
  const verticalBarGeometry = new THREE.BoxGeometry(0.13, 0.85, 0.16);
  for (const side of [-1, 1]) {
    for (let col = 0; col < 2; col += 1) {
      for (let row = 0; row < 8; row += 1) {
        const bar = new THREE.Mesh(verticalBarGeometry, (row + col) % 4 === 0 ? warmLens : coolLens);
        bar.position.set(side * (18.4 + col * 0.45), 1.6 + row * 1.1, 1.25);
        context.scene.add(bar);
      }
    }
  }
  // Small footlights define the apron and make its width readable from the audience.
  for (let i = 0; i < 15; i += 1) {
    const x = (i - 7) * 2.25;
    const z = 4.1 + 1.1 * (1 - (x / 17.3) ** 2);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.24), lightHousing);
    body.position.set(x, 1.04, z - 0.3);
    stage.add(body);
    const lens = new THREE.Mesh(lensGeometry, i % 4 === 0 ? warmLens : coolLens);
    lens.scale.set(0.65, 0.65, 0.65);
    lens.position.set(x, 1.12, z - 0.14);
    stage.add(lens);
  }
  // Narrow white beams fan gently outward with a soft radial falloff.
  const makeBeamMaterial = (strength) => new THREE.ShaderMaterial({
    uniforms: { strength: { value: strength }, beamColor: { value: new THREE.Color(0xffffff) } },
    vertexShader: `
      varying vec3 viewNormal;
      varying vec3 viewDirection;
      varying float beamHeight;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        viewNormal = normalize(normalMatrix * normal);
        viewDirection = normalize(-viewPosition.xyz);
        beamHeight = uv.y;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float strength;
      uniform vec3 beamColor;
      varying vec3 viewNormal;
      varying vec3 viewDirection;
      varying float beamHeight;
      void main() {
        float center = pow(max(dot(normalize(viewNormal), normalize(viewDirection)), 0.0), 2.0);
        float ends = smoothstep(0.0, 0.035, beamHeight) * (1.0 - smoothstep(0.965, 1.0, beamHeight));
        gl_FragColor = vec4(beamColor, center * ends * strength);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const beamCoreMaterial = makeBeamMaterial(0.3);
  const beamHazeMaterial = makeBeamMaterial(0.12);
  const beamGlowMaterial = makeBeamMaterial(0.04);
  const beamCoreGeometry = new THREE.CylinderGeometry(0.065, 0.065, 9.7, 20, 1, true);
  const beamHazeGeometry = new THREE.CylinderGeometry(0.24, 0.24, 9.7, 24, 1, true);
  const beamGlowGeometry = new THREE.CylinderGeometry(0.65, 0.65, 9.7, 32, 1, true);
  const backBeamX = [-13.5, -9.4, -4.5, 0.7, 5.2, 10.4, 14.5];
  for (const [i, x] of backBeamX.entries()) {
    const top = new THREE.Vector3(x, 10.5 + Math.sin(i * 1.8) * 0.7, -6.8 + (i % 3) * 0.8);
    const bottom = new THREE.Vector3(x * 1.08, 1.0, 4.6 + (i % 3) * 1.2);
    const lens = new THREE.Mesh(lensGeometry, coolLens); lens.position.copy(top); context.scene.add(lens);
    const direction = top.clone().sub(bottom);
    const length = direction.length();
    const midpoint = top.clone().add(bottom).multiplyScalar(0.5);
    for (const [geometry, material] of [[beamGlowGeometry, beamGlowMaterial], [beamHazeGeometry, beamHazeMaterial], [beamCoreGeometry, beamCoreMaterial]]) {
      const beam = new THREE.Mesh(geometry, material);
      beam.position.copy(midpoint);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      beam.scale.y = length / 9.7;
      beam.renderOrder = 3;
      context.scene.add(beam);
    }
  }

  // Circular overhead light rings echo the photographed roof rig.
  const overheadRingMaterial = new THREE.MeshBasicMaterial({ color: 0x93efcb });
  for (const radius of [1.4, 2.8, 4.2]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.035, 8, 96), overheadRingMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 11.25, -3);
    context.scene.add(ring);
  }

  context.scene.add(new THREE.HemisphereLight(0xa9b6c6, 0x07090b, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.25);
  key.position.set(2, 7, 5);
  context.scene.add(key);

  const setStagePalette = (colors) => {
    lightCore.color.set(colors.primary);
    iceBodyMaterial.color.set(colors.primary).lerp(new THREE.Color(0x91b8ce), 0.6);
    spatialFlow.uniforms.flowColor.value.set(colors.primary).lerp(new THREE.Color(0xffffff), 0.65);
    rimMaterial.color.set(colors.primary);
    crownMaterial.color.set(colors.accent);
    coolLens.color.set(colors.primary);
    warmLens.color.set(colors.accent);
    topDotMaterial.color.set(colors.primary);
    overheadRingMaterial.color.set(colors.primary);
    apronMaterials.forEach((material, i) => { material.color.set(i === 0 ? colors.primary : colors.halo); });
    archLights.forEach((light) => { light.color.set(colors.halo); });
    for (const material of [beamCoreMaterial, beamHazeMaterial, beamGlowMaterial]) material.uniforms.beamColor.value.set(colors.beam);
    context.scene.background.set(colors.background);
    drawPreviewPalette(colors);
  };

  return {
    setStagePalette,
    spatialFlow,
    mainScreen,
    mainMaterial,
    roofMaterial,
    roofScreen,
    foregroundScreen,
    foregroundMaterial,
    footprint,
    previewTexture,
    auxScreen,
    auxMaterial,
    floorAuxGeometry,
    ceilingAuxGeometry,
    grid,
    stage,
  };
}

