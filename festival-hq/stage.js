import * as THREE from "three";

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
  const crown = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(crownPoints), 200, 0.09, 6, false),
    new THREE.MeshBasicMaterial({ color: 0xffe7b2 }),
  );
  mainScreen.add(crown);

  // Overhead LED is a permanent surface; the auxiliary floor control remains separate.
  const roofMaterial = new THREE.MeshBasicMaterial({ map: previewTexture, color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
  const roofScreen = new THREE.Mesh(new THREE.PlaneGeometry(32, 8), roofMaterial);
  roofScreen.name = "FestivalOverheadLED";
  roofScreen.rotation.x = Math.PI / 2;
  roofScreen.position.set(0, 11.4, -3);
  context.scene.add(roofScreen);

  // Two LED ribbons form a tall triangular arch facing the audience (+Z).
  // It remains a separate surface so it can show video without obscuring the stage.
  const triangleGeometry = new THREE.BufferGeometry();
  triangleGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -20, 0.9, 3.8,  -17.8, 0.9, 3.8,
    0, 23.0, 3.8,    0, 20.4, 3.8,
    20, 0.9, 3.8,    17.8, 0.9, 3.8,
  ], 3));
  triangleGeometry.setAttribute("uv", new THREE.Float32BufferAttribute([
    0, 0, 0.06, 0, 0.5, 1, 0.5, 0.89, 1, 0, 0.94, 0,
  ], 2));
  triangleGeometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]);
  triangleGeometry.computeVertexNormals();
  const triangleScreen = new THREE.Mesh(triangleGeometry, roofMaterial);
  triangleScreen.name = "AudienceFacingTriangleLED";
  context.scene.add(triangleScreen);

  // The face remains video-mapped; this extruded backing gives the arch real depth.
  const archShape = new THREE.Shape();
  archShape.moveTo(-20, 0.9);
  archShape.lineTo(0, 23);
  archShape.lineTo(20, 0.9);
  archShape.lineTo(17.8, 0.9);
  archShape.lineTo(0, 20.4);
  archShape.lineTo(-17.8, 0.9);
  archShape.closePath();
  const archBody = new THREE.Mesh(
    new THREE.ExtrudeGeometry(archShape, { depth: 0.7, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: 0x152c2a, metalness: 0.75, roughness: 0.32 }),
  );
  archBody.name = "TriangleLEDBacking";
  archBody.position.z = 3.06;
  context.scene.add(archBody);

  // Bright cores and soft translucent halos outline both edges of the LED arch.
  const lightCore = new THREE.MeshBasicMaterial({ color: 0xb5fff0, toneMapped: false });
  const lightHalo = new THREE.MeshBasicMaterial({
    color: 0x32f7c2, transparent: true, opacity: 0.17,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const addStrip = (from, to) => {
    const start = new THREE.Vector3(from[0], from[1], 3.87);
    const end = new THREE.Vector3(to[0], to[1], 3.87);
    const direction = end.clone().sub(start);
    const length = direction.length();
    const center = start.clone().add(end).multiplyScalar(0.5);
    for (const [radius, material] of [[0.075, lightCore], [0.26, lightHalo]]) {
      const strip = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), material);
      strip.position.copy(center);
      strip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      context.scene.add(strip);
    }
  };
  const outline = [
    [[-20, 0.9], [0, 23]], [[0, 23], [20, 0.9]],
    [[-17.8, 0.9], [0, 20.4]], [[0, 20.4], [17.8, 0.9]],
    [[-20, 0.9], [-17.8, 0.9]], [[17.8, 0.9], [20, 0.9]],
  ];
  for (const [from, to] of outline) addStrip(from, to);
  for (const [x, y] of [[0, 22], [-18.8, 1.5], [18.8, 1.5]]) {
    const glow = new THREE.PointLight(0x4effc8, 18, 12, 2);
    glow.position.set(x, y, 5);
    context.scene.add(glow);
  }

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
      const edge = new THREE.Mesh(new THREE.TorusGeometry(4.25, 0.035, 8, 128), rimMaterial);
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
      opacity: { value: 0.42 },
      keyLevel: { value: 0.12 },
    },
    vertexShader: `
      varying vec2 screenUv;
      uniform mat3 imageTransform;
      void main() {
        screenUv = (imageTransform * vec3(uv, 1.0)).xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D image;
      uniform float opacity;
      uniform float keyLevel;
      varying vec2 screenUv;
      void main() {
        vec4 sampleColor = texture2D(image, screenUv);
        float brightness = max(max(sampleColor.r, sampleColor.g), sampleColor.b);
        float alpha = smoothstep(keyLevel, keyLevel + 0.12, brightness) * opacity * sampleColor.a;
        gl_FragColor = vec4(sampleColor.rgb, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // Match the inner vertices of the luminous triangular arch exactly.
  const scrimGeometry = new THREE.BufferGeometry();
  scrimGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -17.8, 0.9, 0,
     17.8, 0.9, 0,
     0, 20.4, 0,
  ], 3));
  // The image remains in a rectangular UV space, clipped by the triangular outline.
  scrimGeometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  scrimGeometry.setIndex([0, 1, 2]);
  scrimGeometry.computeVertexNormals();
  const foregroundScreen = new THREE.Mesh(scrimGeometry, foregroundMaterial);
  foregroundScreen.name = "TransparentForegroundScreen";
  foregroundScreen.position.z = 3.81;
  foregroundScreen.renderOrder = 4;
  context.scene.add(foregroundScreen);
  const scrimFrame = new THREE.LineSegments(
    new THREE.EdgesGeometry(scrimGeometry),
    new THREE.LineBasicMaterial({ color: 0x70b5a4, transparent: true, opacity: 0.22, depthWrite: false }),
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

  // A simple 1.7 m performer reference, behind the foreground scrim.
  const performer = new THREE.Group();
  performer.name = "PerformerScaleReference";
  const outfit = new THREE.MeshStandardMaterial({ color: 0x28383b, roughness: 0.65, metalness: 0.12 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe3bda4, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.42, 4, 12), outfit);
  torso.position.y = 1.05;
  performer.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skin);
  head.position.y = 1.58;
  performer.add(head);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.68, 10), outfit);
    leg.position.set(side * 0.1, 0.35, 0);
    performer.add(leg);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.59, 10), outfit);
    arm.position.set(side * 0.23, 1.02, 0);
    arm.rotation.z = side * 0.13;
    performer.add(arm);
  }
  performer.position.set(0, 0.9, -1.8);
  stage.add(performer);
  context.scene.add(stage);

  const rigMaterial = new THREE.MeshStandardMaterial({ color: 0x20272b, metalness: 0.7, roughness: 0.4 });
  const frame = (w, h, d, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rigMaterial);
    mesh.position.set(x, y, z);
    context.scene.add(mesh);
  };
  for (const x of [-18, 18]) frame(0.35, 12, 0.35, x, 6, 1.5);
  frame(36.4, 0.35, 0.35, 0, 11.7, 1.5);
  frame(36.4, 0.35, 0.35, 0, 11.7, -7.5);
  for (let x = -16; x <= 16; x += 2) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshBasicMaterial({ color: 0xb9ffe0 }));
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
    uniforms: { strength: { value: strength } },
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
      varying vec3 viewNormal;
      varying vec3 viewDirection;
      varying float beamHeight;
      void main() {
        float center = pow(max(dot(normalize(viewNormal), normalize(viewDirection)), 0.0), 2.0);
        float ends = smoothstep(0.0, 0.035, beamHeight) * (1.0 - smoothstep(0.965, 1.0, beamHeight));
        gl_FragColor = vec4(vec3(1.0), center * ends * strength);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const beamCoreMaterial = makeBeamMaterial(0.30);
  const beamHazeMaterial = makeBeamMaterial(0.06);
  const beamCoreGeometry = new THREE.CylinderGeometry(0.045, 0.045, 9.7, 20, 1, true);
  const beamHazeGeometry = new THREE.CylinderGeometry(0.19, 0.19, 9.7, 24, 1, true);
  for (let i = -4; i <= 4; i += 1) {
    const top = new THREE.Vector3(i * 2.9, 10.8, 1.1);
    const bottom = new THREE.Vector3(i * 3.25, 1.1, 1.1);
    const direction = top.clone().sub(bottom);
    const length = direction.length();
    const midpoint = top.clone().add(bottom).multiplyScalar(0.5);
    for (const [geometry, material] of [[beamHazeGeometry, beamHazeMaterial], [beamCoreGeometry, beamCoreMaterial]]) {
      const beam = new THREE.Mesh(geometry, material);
      beam.position.copy(midpoint);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      beam.scale.y = length / 9.7;
      beam.renderOrder = 3;
      context.scene.add(beam);
    }
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

