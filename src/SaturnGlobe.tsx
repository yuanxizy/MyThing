import { useEffect, useRef } from "react";
import * as THREE from "three";

const RING_VERTEX = `
  varying vec2 vRing;
  void main() {
    vRing = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAGMENT = `
  varying vec2 vRing;
  void main() {
    float radius = length(vRing);
    float t = (radius - 1.16) / 0.82;
    float edges = smoothstep(0.0, 0.028, t) * (1.0 - smoothstep(0.95, 1.0, t));
    float cassini = 1.0 - 0.95 * (smoothstep(1.575, 1.588, radius) - smoothstep(1.626, 1.64, radius));
    float encke = 1.0 - 0.72 * (smoothstep(1.858, 1.863, radius) - smoothstep(1.872, 1.877, radius));
    float fine = 0.73 + 0.16 * sin(radius * 238.0) + 0.075 * sin(radius * 623.0) + 0.035 * sin(radius * 1327.0);
    float broad = 0.5 + 0.5 * sin(radius * 21.0 + 0.8);
    vec3 ice = mix(vec3(0.57, 0.54, 0.52), vec3(0.96, 0.86, 0.68), broad);
    ice *= 0.88 + 0.12 * fine;
    float alpha = edges * cassini * encke * clamp((0.27 + 0.20 * broad) * fine, 0.0, 0.58);
    gl_FragColor = vec4(ice, alpha);
  }
`;

const HAZE_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vEye;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vEye = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const HAZE_FRAGMENT = `
  varying vec3 vNormal;
  varying vec3 vEye;
  void main() {
    float edge = pow(1.0 - max(dot(normalize(vNormal), normalize(vEye)), 0.0), 2.8);
    gl_FragColor = vec4(0.96, 0.76, 0.48, edge * 0.19);
  }
`;

export function SaturnGlobe() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let disposed = false;
    let frame = 0;
    let renderer: THREE.WebGLRenderer | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let visibilityObserver: IntersectionObserver | undefined;
    const resources: Array<{ dispose: () => void }> = [];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    new THREE.TextureLoader().loadAsync("/saturn/saturn_surface.png").then((surfaceMap) => {
      if (disposed) { surfaceMap.dispose(); return; }
      resources.push(surfaceMap);
      surfaceMap.encoding = THREE.sRGBEncoding;
      surfaceMap.anisotropy = 8;
      surfaceMap.wrapS = THREE.RepeatWrapping;

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.32;
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.className = "saturn-globe__canvas";
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 12);
      camera.position.set(0, 0, 3.5);
      scene.add(new THREE.AmbientLight(0xf5dfba, 0.92));
      const sunlight = new THREE.DirectionalLight(0xffedd0, 2.0);
      sunlight.position.set(-2.5, 2.2, 4);
      scene.add(sunlight);
      const fill = new THREE.DirectionalLight(0x9cabc9, 0.36);
      fill.position.set(2, -1, -2);
      scene.add(fill);

      const planetGeometry = new THREE.SphereGeometry(1, 192, 128);
      const planetMaterial = new THREE.MeshPhongMaterial({
        map: surfaceMap,
        color: 0xffefda,
        specular: 0x514638,
        shininess: 6,
      });
      const saturn = new THREE.Mesh(planetGeometry, planetMaterial);
      saturn.scale.y = 0.95;
      saturn.position.y = -0.06;
      saturn.rotation.set(0, -0.7, 0.12);
      scene.add(saturn);

      const ringGeometry = new THREE.RingGeometry(1.16, 1.98, 768, 6);
      const ringMaterial = new THREE.ShaderMaterial({
        vertexShader: RING_VERTEX,
        fragmentShader: RING_FRAGMENT,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
      });
      const rings = new THREE.Mesh(ringGeometry, ringMaterial);
      rings.rotation.set(-1.32, 0.04, -0.34);
      rings.position.y = -0.06;
      rings.renderOrder = 2;
      scene.add(rings);

      const hazeGeometry = new THREE.SphereGeometry(1.015, 128, 96);
      const hazeMaterial = new THREE.ShaderMaterial({
        vertexShader: HAZE_VERTEX,
        fragmentShader: HAZE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const haze = new THREE.Mesh(hazeGeometry, hazeMaterial);
      haze.scale.y = 0.95;
      haze.position.y = -0.06;
      scene.add(haze);
      resources.push(planetGeometry, planetMaterial, ringGeometry, ringMaterial, hazeGeometry, hazeMaterial);

      const resize = () => {
        if (!renderer) return;
        const hostWidth = host.clientWidth;
        const hostHeight = host.clientHeight;
        if (!hostWidth || !hostHeight) return;
        const bounds = host.getBoundingClientRect();
        const scale = bounds.width / hostWidth;
        const fullWidth = Math.round(hostWidth * 1.6);
        const left = Math.round((hostWidth - fullWidth) / 2);
        const top = Math.max(0, Math.floor(-bounds.top / scale) - 3);
        const bottom = Math.min(hostHeight + 350, Math.ceil((window.innerHeight - bounds.top) / scale) + 3);
        const stripHeight = Math.max(1, bottom - top);
        const pixelRatio = Math.min((window.devicePixelRatio || 1) * scale, 4, renderer.capabilities.maxTextureSize / fullWidth);
        renderer.setPixelRatio(pixelRatio);
        renderer.domElement.style.left = `${left}px`;
        renderer.domElement.style.top = `${top}px`;
        renderer.domElement.style.width = `${fullWidth}px`;
        renderer.domElement.style.height = `${stripHeight}px`;
        camera.aspect = fullWidth / hostHeight;
        camera.setViewOffset(fullWidth, hostHeight, 0, top, fullWidth, stripHeight);
        renderer.setSize(fullWidth, stripHeight, false);
        renderer.render(scene, camera);
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      window.addEventListener("resize", resize);
      resize();

      let visible = true;
      const start = performance.now();
      const render = (now: number) => {
        frame = 0;
        if (!renderer || !visible || document.hidden) return;
        const seconds = (now - start) / 1000;
        saturn.rotation.y = -0.7 + seconds * 0.0019;
        rings.rotation.z = -0.34 + Math.sin(seconds * 0.08) * 0.006;
        renderer.render(scene, camera);
        frame = requestAnimationFrame(render);
      };
      const resume = () => {
        if (!reducedMotion && visible && !document.hidden && !frame) frame = requestAnimationFrame(render);
      };
      const onVisibilityChange = () => {
        if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
        else resume();
      };
      visibilityObserver = new IntersectionObserver(([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (!visible && frame) { cancelAnimationFrame(frame); frame = 0; }
        else resume();
      });
      visibilityObserver.observe(host);
      document.addEventListener("visibilitychange", onVisibilityChange);
      resources.push({ dispose: () => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("resize", resize);
      } });
      resume();
    }).catch(() => {
      // Notes and cards remain available when the texture or WebGL cannot load.
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      resources.forEach((resource) => resource.dispose());
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, []);

  return <div className="earth-globe saturn-globe" ref={hostRef} aria-hidden="true" />;
}
