import * as THREE from "three128";

export type GlassParticleOptions = {
  count: number;
  thickness: number;
  dispersion: number;
  specular: number;
  rim: number;
  drift: number;
  titles: string[];
  notes: Array<{ title: string; text: string }>;
  onNoteSelect?: (note: { title: string; text: string }) => void;
  bubbleCounts: BubbleCounts;
  bubbleStyle: BubbleStyle;
};

export type BubbleCounts = { large: number; medium: number; small: number; micro: number };
export type BubbleStyle = "glass" | "card" | "star" | "cookie";

const DEFAULT_BUBBLE_COUNTS: BubbleCounts = { large: 4, medium: 5, small: 5, micro: 5 };

export const GLASS_PARTICLE_DEFAULTS: GlassParticleOptions = {
  count: 19,
  thickness: 0.115,
  dispersion: 0.05,
  specular: 0.85,
  rim: 0.5,
  drift: 1,
  titles: [],
  notes: [],
  bubbleCounts: DEFAULT_BUBBLE_COUNTS,
  bubbleStyle: "glass",
};

function makeBeadGeometry(style: BubbleStyle) {
  if (style === "glass") return new THREE.SphereGeometry(1, 44, 30);
  const shape = new THREE.Shape();
  if (style === "star") {
    for (let point = 0; point < 10; point += 1) {
      const angle = Math.PI / 2 + point * Math.PI / 5;
      const radius = point % 2 === 0 ? 1 : 0.46;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (point === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
  } else if (style === "cookie") {
    for (let point = 0; point < 40; point += 1) {
      const angle = point / 40 * Math.PI * 2;
      const radius = point % 5 === 0 ? 0.88 : 1;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (point === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
  } else {
    const w = 0.91; const h = 1; const r = 0.16;
    shape.moveTo(-w + r, -h); shape.lineTo(w - r, -h); shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r); shape.quadraticCurveTo(w, h, w - r, h); shape.lineTo(-w + r, h);
    shape.quadraticCurveTo(-w, h, -w, h - r); shape.lineTo(-w, -h + r); shape.quadraticCurveTo(-w, -h, -w + r, -h);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.055, bevelThickness: 0.055, curveSegments: 8 });
  geometry.translate(0, 0, -0.08);
  geometry.computeVertexNormals();
  return geometry;
}

const MAX_COUNT = 34;

function normalizeBubbleCounts(counts: BubbleCounts): BubbleCounts {
  let remaining = MAX_COUNT;
  const result = { large: 0, medium: 0, small: 0, micro: 0 };
  for (const category of ["large", "medium", "small", "micro"] as const) {
    const amount = Math.max(0, Math.floor(Number(counts[category]) || 0));
    result[category] = Math.min(amount, remaining);
    remaining -= result[category];
  }
  return result;
}

const QUAD_VERTEX = "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }";

/* the backdrop is drawn twice each frame: once into the refraction target the
   glass samples, once straight to the canvas — one cheap fullscreen pass is far
   less work than a second material that blits the target back */
const BACKDROP_FRAGMENT = `precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;

vec3 bloom(vec2 uv, vec2 centre, float radius, vec3 tint){
  float aspect = uRes.x / max(uRes.y, 1.0);
  float d = length((uv - centre) * vec2(aspect, 1.0));
  float falloff = smoothstep(radius, 0.0, d);
  return tint * falloff * falloff;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float t = uTime * 0.17;
  /* the base tone matters more than the blooms: refraction samples the whole
     frame, so a backdrop with black regions makes beads read as dark holes */
  vec3 col = vec3(0.085, 0.095, 0.125);
  col += mix(vec3(0.0), vec3(0.05, 0.06, 0.10), uv.y);
  col += bloom(uv, vec2(0.23 + 0.055 * sin(t * 0.9), 0.76 + 0.045 * cos(t * 0.7)), 0.86, vec3(0.24, 0.42, 0.96)) * 0.92;
  col += bloom(uv, vec2(0.82 + 0.05 * cos(t * 0.8), 0.34 + 0.055 * sin(t * 1.1)), 0.80, vec3(0.66, 0.30, 0.88)) * 0.80;
  col += bloom(uv, vec2(0.50 + 0.07 * sin(t * 0.6 + 1.7), 0.10 + 0.04 * cos(t * 0.9)), 0.74, vec3(0.14, 0.68, 0.70)) * 0.60;
  col += bloom(uv, vec2(0.10 + 0.04 * cos(t * 1.2), 0.16 + 0.05 * sin(t * 0.8)), 0.58, vec3(0.98, 0.60, 0.40)) * 0.34;
  col += bloom(uv, vec2(0.5 + uPointer.x * 0.20, 0.56 + uPointer.y * 0.16), 0.46, vec3(0.74, 0.78, 0.96)) * 0.30;
  float vignette = smoothstep(1.34, 0.30, length((uv - 0.5) * vec2(1.05, 1.0)));
  col *= mix(0.62, 1.0, vignette);
  gl_FragColor = vec4(col, 1.0);
}`;

const GLASS_VERTEX = `varying vec3 vNormalView;
varying vec3 vViewPos;
varying vec4 vScreen;

void main(){
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vNormalView = normalize(normalMatrix * normal);
  vViewPos = mvPosition.xyz;
  vScreen = projectionMatrix * mvPosition;
  gl_Position = vScreen;
}`;

/* screen-space refraction: the surface normal bends the view ray, the offset is
   applied to this fragment's own screen coordinate, and the three channels use
   three slightly different indices so the bead edges split into colour the way
   real glass does */
const GLASS_FRAGMENT = `precision highp float;
uniform sampler2D uBackdrop;
uniform float uThickness;
uniform float uDispersion;
uniform float uSpecular;
uniform float uRim;
uniform vec3 uTint;
uniform vec3 uLight;
varying vec3 vNormalView;
varying vec3 vViewPos;
varying vec4 vScreen;

void main(){
  vec2 screenUV = (vScreen.xy / vScreen.w) * 0.5 + 0.5;
  vec3 N = normalize(vNormalView);
  vec3 V = normalize(-vViewPos);
  vec3 I = -V;
  float fresnel = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.4);

  vec2 offsetR = refract(I, N, 1.0 / (1.44 - uDispersion)).xy * uThickness;
  vec2 offsetG = refract(I, N, 1.0 / 1.44).xy * uThickness;
  vec2 offsetB = refract(I, N, 1.0 / (1.44 + uDispersion)).xy * uThickness;

  vec3 col;
  col.r = texture2D(uBackdrop, clamp(screenUV + offsetR, 0.002, 0.998)).r;
  col.g = texture2D(uBackdrop, clamp(screenUV + offsetG, 0.002, 0.998)).g;
  col.b = texture2D(uBackdrop, clamp(screenUV + offsetB, 0.002, 0.998)).b;
  col *= uTint;

  vec3 L = normalize(uLight);
  vec3 H = normalize(L + V);
  float ndoth = max(dot(N, H), 0.0);
  col += pow(ndoth, 150.0) * uSpecular;
  col += pow(ndoth, 16.0) * uSpecular * 0.11;
  /* a second, dimmer key from below keeps the underside of every bead alive */
  vec3 H2 = normalize(normalize(vec3(0.55, -0.7, 0.45)) + V);
  col += pow(max(dot(N, H2), 0.0), 44.0) * uSpecular * 0.22;
  col += fresnel * uRim * vec3(0.86, 0.90, 1.0);

  /* aerial perspective: the small far beads dissolve into the plate they float
     over instead of reading as hard specks */
  float haze = smoothstep(7.4, 11.4, -vViewPos.z);
  col = mix(col, texture2D(uBackdrop, screenUV).rgb, haze * 0.7);
  gl_FragColor = vec4(col, 1.0);
}`;

type Bead = {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  origin: THREE.Vector3;
  bob: number;
  phase: number;
  spin: THREE.Vector3;
  radius: number;
};

/* one deterministic sequence so the arrangement is identical on every load and a
   recorded preview matches what a visitor sees */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export function createGlassParticleField(canvas: HTMLCanvasElement, getOptions: () => GlassParticleOptions) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a0b0f, 1);

  const backdropScene = new THREE.Scene();
  const backdropCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const backdropUniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uPointer: { value: new THREE.Vector2() },
  };
  const backdropMaterial = new THREE.ShaderMaterial({
    uniforms: backdropUniforms,
    vertexShader: QUAD_VERTEX,
    fragmentShader: BACKDROP_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const backdropGeometry = new THREE.PlaneGeometry(2, 2);
  backdropScene.add(new THREE.Mesh(backdropGeometry, backdropMaterial));

  const target = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
  });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 7.4);
  const group = new THREE.Group();
  scene.add(group);

  const beadGeometry = makeBeadGeometry(getOptions().bubbleStyle);
  const tints = [
    new THREE.Color(1.04, 1.0, 1.02),
    new THREE.Color(0.97, 1.0, 1.06),
    new THREE.Color(1.05, 0.99, 0.97),
  ];

  const random = seeded(20260826);
  const beads: Bead[] = [];
  const bubbleCounts = normalizeBubbleCounts(getOptions().bubbleCounts);
  const largeEnd = bubbleCounts.large;
  const mediumEnd = largeEnd + bubbleCounts.medium;
  const smallEnd = mediumEnd + bubbleCounts.small;
  const totalBubbles = smallEnd + bubbleCounts.micro;
  for (let index = 0; index < totalBubbles; index += 1) {
    const major = index < mediumEnd;
    const radius = index < largeEnd
      ? 0.52 + random() * 0.22
      : index < mediumEnd
        ? 0.34 + random() * 0.12
        : index < smallEnd
          ? 0.20 + random() * 0.10
          : 0.09 + random() * 0.07;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uBackdrop: { value: target.texture },
        uThickness: { value: 0.1 },
        uDispersion: { value: 0.05 },
        uSpecular: { value: 0.85 },
        uRim: { value: 0.5 },
        uTint: { value: tints[index % tints.length] },
        uLight: { value: new THREE.Vector3(-0.45, 0.86, 0.62) },
      },
      vertexShader: GLASS_VERTEX,
      fragmentShader: GLASS_FRAGMENT,
    });
    const mesh = new THREE.Mesh(beadGeometry, material);
    mesh.scale.setScalar(radius);
    /* keep the large and medium bubbles from merging into one shape */
    const origin = new THREE.Vector3();
    for (let attempt = 0; attempt < 48; attempt += 1) {
      origin.set(
        (random() - 0.5) * 8.4,
        (random() - 0.5) * 5.0 - 0.25,
        major ? -1.4 + random() * 2.6 : -3.6 + random() * 2.4,
      );
      if (!major) break;
      const clear = beads.every((placed) => {
        const dx = placed.origin.x - origin.x;
        const dy = placed.origin.y - origin.y;
        return Math.hypot(dx, dy) > (placed.radius + radius) * 1.25 + 0.3;
      });
      if (clear) break;
    }
    mesh.position.copy(origin);
    if (getOptions().bubbleStyle === "glass") mesh.rotation.set(random() * 6.28, random() * 6.28, random() * 6.28);
    group.add(mesh);
    beads.push({
      mesh,
      material,
      origin,
      radius,
      bob: 0.14 + random() * 0.34,
      phase: random() * 6.28,
      spin: new THREE.Vector3((random() - 0.5) * 0.28, (random() - 0.5) * 0.34, (random() - 0.5) * 0.2),
    });
  }

  const titleSprites = beads
    .map((bead, index) => ({ bead, index }))
    .sort((a, b) => b.bead.radius - a.bead.radius)
    .slice(0, 3)
    .map(({ bead }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 192;
      const texture = new THREE.CanvasTexture(canvas);
      const isGlass = getOptions().bubbleStyle === "glass";
      const plane = isGlass ? null : new THREE.PlaneGeometry(1, 0.375);
      const material = isGlass
        ? new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false })
        : new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
      const sprite = isGlass ? new THREE.Sprite(material as THREE.SpriteMaterial) : new THREE.Mesh(plane!, material as THREE.MeshBasicMaterial);
      if (isGlass) sprite.scale.set(bead.radius * 1.62, bead.radius * 0.61, 1);
      else {
        const widthFactor = getOptions().bubbleStyle === "star" ? 0.92 : getOptions().bubbleStyle === "cookie" ? 1.18 : 1.52;
        sprite.scale.setScalar(bead.radius * widthFactor);
        sprite.position.z = 0.15;
      }
      sprite.renderOrder = 3;
      if (isGlass) group.add(sprite); else bead.mesh.add(sprite);
      return { bead, canvas, texture, sprite, geometry: plane, title: "" };
    });
  const raycaster = new THREE.Raycaster();
  const raycastPointer = new THREE.Vector2();
  const beadMeshes = titleSprites.map(({ bead }) => bead.mesh);
  const hitNoteAt = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    raycastPointer.set(((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1, -(((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1));
    group.updateMatrixWorld(true);
    raycaster.setFromCamera(raycastPointer, camera);
    const hit = raycaster.intersectObjects(beadMeshes, false)[0];
    return hit ? titleSprites.findIndex(({ bead }) => bead.mesh === hit.object) : -1;
  };
  const onCanvasPointerMove = (event: PointerEvent) => {
    const index = hitNoteAt(event.clientX, event.clientY);
    canvas.style.cursor = index >= 0 && Boolean(getOptions().notes[index]) ? "pointer" : "default";
  };
  const onCanvasClick = (event: MouseEvent) => {
    const index = hitNoteAt(event.clientX, event.clientY);
    const note = index >= 0 ? getOptions().notes[index] : undefined;
    if (note) getOptions().onNoteSelect?.(note);
  };
  canvas.addEventListener("pointermove", onCanvasPointerMove);
  canvas.addEventListener("click", onCanvasClick);
  const updateTitles = (titles: string[]) => {
    titleSprites.forEach((label, index) => {
      const title = titles[index] ?? "";
      if (title === label.title) return;
      label.title = title;
      const context = label.canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, label.canvas.width, label.canvas.height);
      if (title) {
        const glyphs = Array.from(title);
        const lines = glyphs.length > 7 ? [glyphs.slice(0, Math.ceil(glyphs.length / 2)).join(""), glyphs.slice(Math.ceil(glyphs.length / 2)).join("")] : [title];
        const gradient = context.createLinearGradient(0, 48, 0, 144);
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(1, "#dce8ff");
        context.fillStyle = gradient;
        context.font = `600 ${lines.length === 1 ? 54 : 42}px 'Microsoft YaHei', sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.shadowColor = "rgba(16,27,55,.42)";
        context.shadowBlur = 8;
        lines.forEach((line, index) => context.fillText(line, 256, lines.length === 1 ? 96 : 66 + index * 60, 460));
      }
      label.texture.needsUpdate = true;
    });
  };

  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  const cameraWorldPosition = new THREE.Vector3();
  const cameraLocalPosition = new THREE.Vector3();
  const labelOffset = new THREE.Vector3();
  let width = 1;
  let height = 1;
  let clock = 0;
  let lastAt = performance.now();

  const resize = (cssWidth: number, cssHeight: number) => {
    const nextWidth = Math.max(1, Math.round(cssWidth));
    const nextHeight = Math.max(1, Math.round(cssHeight));
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    const ratio = Math.min(window.devicePixelRatio, 2);
    renderer.setSize(width, height, false);
    target.setSize(Math.round(width * ratio), Math.round(height * ratio));
    backdropUniforms.uRes.value.set(width * ratio, height * ratio);
    camera.aspect = width / height;
    /* a wide catalog frame should widen the field of view rather than crop it, so
       the bead spread stays the same composition at every aspect */
    camera.fov = camera.aspect > 1 ? 42 : 42 / Math.max(0.62, camera.aspect);
    camera.updateProjectionMatrix();
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    for (const bead of beads) {
      const nearestDepth = Math.max(0.1, camera.position.z - bead.origin.z - bead.bob * 0.5);
      const halfHeight = nearestDepth * tanHalfFov;
      const halfWidth = halfHeight * camera.aspect;
      const rotationMargin = Math.abs(bead.origin.z) * 0.15 + 0.08;
      const xMargin = bead.radius * 1.1 + bead.bob * 0.9 + 0.28 + rotationMargin;
      const yMargin = bead.radius * 1.1 + bead.bob + 0.2 + rotationMargin;
      const safeX = Math.max(0, halfWidth - xMargin);
      const safeY = Math.max(0, halfHeight - yMargin);
      bead.origin.x = THREE.MathUtils.clamp(bead.origin.x, -safeX, safeX);
      bead.origin.y = THREE.MathUtils.clamp(bead.origin.y, -safeY, safeY);
    }
    for (const bead of beads) bead.material.uniforms.uBackdrop.value = target.texture;
  };

  const setPointer = (x: number, y: number) => pointerTarget.set(x, y);

  const render = (now = performance.now()) => {
    const options = getOptions();
    updateTitles(options.titles);
    clock += Math.min(96, now - lastAt) * 0.001;
    lastAt = now;
    pointer.lerp(pointerTarget, 0.045);
    group.rotation.y = pointer.x * 0.14;
    group.rotation.x = -pointer.y * 0.1;
    group.position.x = pointer.x * 0.28;
    group.position.y = pointer.y * 0.2;
    group.updateMatrixWorld(true);
    camera.getWorldPosition(cameraWorldPosition);
    cameraLocalPosition.copy(cameraWorldPosition);
    group.worldToLocal(cameraLocalPosition);

    const visible = Math.max(0, Math.min(MAX_COUNT, Math.round(options.count)));
    for (let index = 0; index < beads.length; index += 1) {
      const bead = beads[index];
      bead.mesh.visible = index < visible;
      if (!bead.mesh.visible) continue;
      const uniforms = bead.material.uniforms;
      uniforms.uThickness.value = options.thickness * (0.55 + bead.radius * 0.9);
      uniforms.uDispersion.value = options.dispersion;
      uniforms.uSpecular.value = options.specular;
      uniforms.uRim.value = options.rim;
      const t = clock * options.drift;
      bead.mesh.position.set(
        bead.origin.x + Math.sin(t * 0.21 + bead.phase) * bead.bob * 0.9,
        bead.origin.y + Math.cos(t * 0.27 + bead.phase * 1.3) * bead.bob,
        bead.origin.z + Math.sin(t * 0.17 + bead.phase * 0.7) * bead.bob * 0.5,
      );
      const label = titleSprites.find((entry) => entry.bead === bead);
      if (label) {
        label.sprite.visible = Boolean(label.title);
        if (getOptions().bubbleStyle === "glass") {
          labelOffset.copy(cameraLocalPosition).sub(bead.mesh.position).normalize().multiplyScalar(bead.radius * 1.04);
          label.sprite.position.copy(bead.mesh.position).add(labelOffset);
          label.sprite.quaternion.copy(group.quaternion).invert().multiply(camera.quaternion);
        }
      }
      if (getOptions().bubbleStyle === "glass") {
        bead.mesh.rotation.x += bead.spin.x * 0.0075 * options.drift;
        bead.mesh.rotation.y += bead.spin.y * 0.0075 * options.drift;
        bead.mesh.rotation.z += bead.spin.z * 0.0075 * options.drift;
      }
    }

    backdropUniforms.uTime.value = clock;
    backdropUniforms.uPointer.value.set(pointer.x, pointer.y);

    renderer.setRenderTarget(target);
    renderer.render(backdropScene, backdropCamera);
    renderer.setRenderTarget(null);
    renderer.render(backdropScene, backdropCamera);
    renderer.autoClear = false;
    renderer.render(scene, camera);
    renderer.autoClear = true;
  };

  const dispose = () => {
    canvas.removeEventListener("pointermove", onCanvasPointerMove);
    canvas.removeEventListener("click", onCanvasClick);
    canvas.style.cursor = "";
    for (const label of titleSprites) {
      label.sprite.material.dispose();
      label.geometry?.dispose();
      label.texture.dispose();
    }
    for (const bead of beads) bead.material.dispose();
  beadGeometry.dispose();
    backdropGeometry.dispose();
    backdropMaterial.dispose();
    target.dispose();
    renderer.dispose();
  };

  return { resize, render, setPointer, dispose };
}
