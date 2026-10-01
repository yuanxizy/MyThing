import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createDaylightEnvironment, createEarthMaterials } from "./EarthMaterials";

const TEXTURES = {
  surface: "/earth/surface-8192.jpg",
  normal: "/earth/terrain-normal-4096.png",
  ocean: "/earth/ocean-mask-4096.png",
  clouds: "/earth/cloud-density-8192.webp",
  cloudNormal: "/earth/cloud-normal-4096.png",
};

// Analytic optical glow follows the exact perspective-projected globe circle.
// Reconstruct the full canvas coordinates when only a viewport strip is rendered.
const HALO_VERTEX = `
  varying vec2 vScreenUv;
  void main() {
    vScreenUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
const HALO_FRAGMENT = `
  uniform vec2 fullSize;
  uniform float stripTop;
  uniform float stripHeight;
  uniform float projectedRadius;
  varying vec2 vScreenUv;
  void main() {
    vec2 fullUv = vec2(vScreenUv.x, 1.0 - (stripTop + (1.0 - vScreenUv.y) * stripHeight) / fullSize.y);
    vec2 p = fullUv * 2.0 - 1.0;
    p.x *= fullSize.x / fullSize.y;
    float distanceToRim = length(p) - projectedRadius;
    vec2 direction = normalize(p + vec2(0.00001));
    float sunrise = pow(max(dot(direction, normalize(vec2(-0.12, -1.0))), 0.0), 22.0);
    // Two distinct lobes: a narrow pearly core and a broad blue optical falloff.
    float core = exp(-pow(distanceToRim / 0.0032, 2.0));
    float innerHaze = exp(-abs(distanceToRim) / 0.018);
    float outerBloom = exp(-max(distanceToRim, 0.0) / 0.052) * smoothstep(-0.02, 0.002, distanceToRim);
    float flare = exp(-pow(distanceToRim / 0.032, 2.0)) * sunrise;
    float alpha = clamp(core * 0.93 + innerHaze * 0.20 + outerBloom * 0.30 + flare * 0.13, 0.0, 0.98);
    if (alpha < 0.002) discard;
    vec3 blue = vec3(0.045, 0.38, 1.15);
    vec3 white = vec3(1.75, 2.2, 2.4);
    vec3 color = mix(blue, white, clamp(core + sunrise * innerHaze * 0.28, 0.0, 1.0));
    color *= 0.85 + sunrise * 0.85;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }
`;

export function EarthGlobe() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let disposed = false;
    let frame = 0;
    let renderer: THREE.WebGLRenderer | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let visibilityObserver: IntersectionObserver | undefined;
    let sceneResources: Array<{ dispose: () => void }> = [];
    const loader = new THREE.TextureLoader();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    Promise.all(Object.values(TEXTURES).map((url) => loader.loadAsync(url))).then((textures) => {
      if (disposed) {
        textures.forEach((texture) => texture.dispose());
        return;
      }
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.className = "earth-globe__canvas";
      host.appendChild(renderer.domElement);

      textures.forEach((texture) => {
        texture.anisotropy = renderer!.capabilities.getMaxAnisotropy();
        texture.wrapS = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
      });
      const scene = new THREE.Scene();
      const environment = createDaylightEnvironment(renderer);
      scene.environment = environment.texture;
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 10);
      camera.position.set(0, 0, 3.5);
      scene.add(new THREE.AmbientLight(0xb9d8f4, 0.38));
      const sunlight = new THREE.DirectionalLight(0xfff7ec, 2.15);
      sunlight.position.set(-3, -3.2, 4);
      scene.add(sunlight);
      const skyFill = new THREE.DirectionalLight(0xb5d9ff, 0.48);
      skyFill.position.set(3, -1, 2);
      scene.add(skyFill);
      const earthGeometry = new THREE.SphereGeometry(1, 256, 192);
      const cloudGeometry = new THREE.SphereGeometry(1.016, 192, 144);
      const outerCloudGeometry = new THREE.SphereGeometry(1.027, 96, 72);
      const materials = createEarthMaterials(textures);
      const earthMaterial = materials.ground;
      const cloudMaterial = materials.clouds;
      const upperCloudMaterial = materials.cirrus;
      const haloGeometry = new THREE.PlaneGeometry(2, 2);
      const haloMaterial = new THREE.ShaderMaterial({
        vertexShader: HALO_VERTEX,
        fragmentShader: HALO_FRAGMENT,
        uniforms: {
          fullSize: { value: new THREE.Vector2(1400, 1400) },
          stripTop: { value: 0 }, stripHeight: { value: 1400 },
          projectedRadius: { value: 1.027 / (Math.sqrt(3.5 ** 2 - 1.027 ** 2) * Math.tan(42 * Math.PI / 360)) },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeometry, haloMaterial);
      halo.frustumCulled = false;
      halo.renderOrder = 20;
      const earth = new THREE.Mesh(earthGeometry, earthMaterial);
      const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
      const upperClouds = new THREE.Mesh(outerCloudGeometry, upperCloudMaterial);
      earth.rotation.set(1.4, -1.2, -0.08);
      clouds.rotation.x = upperClouds.rotation.x = earth.rotation.x;
      clouds.rotation.z = upperClouds.rotation.z = earth.rotation.z;
      clouds.rotation.y = -1.16;
      upperClouds.rotation.y = -1.145;
      clouds.renderOrder = 2;
      upperClouds.renderOrder = 3;
      materials.update(earth, clouds, upperClouds, sunlight, 0);
      scene.add(earth, clouds, upperClouds, halo);
      sceneResources = [earthGeometry, cloudGeometry, outerCloudGeometry, haloGeometry, earthMaterial, cloudMaterial, upperCloudMaterial, haloMaterial, environment, ...textures];

      const resize = () => {
        if (!renderer) return;
        const width = host.clientWidth;
        const height = host.clientHeight;
        if (!width || !height) return;
        const bounds = host.getBoundingClientRect();
        const scale = bounds.width / width;
        // The globe is mostly above the viewport. Render only the visible
        // strip at native screen density, using the same full-size projection.
        const top = Math.max(0, Math.floor(-bounds.top / scale) - 2);
        const bottom = Math.min(height, Math.ceil((window.innerHeight - bounds.top) / scale) + 2);
        const stripHeight = Math.max(1, bottom - top);
        haloMaterial.uniforms.fullSize.value.set(width, height);
        haloMaterial.uniforms.stripTop.value = top;
        haloMaterial.uniforms.stripHeight.value = stripHeight;
        renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * scale, 4));
        renderer.domElement.style.top = `${top}px`;
        renderer.domElement.style.height = `${stripHeight}px`;
        camera.aspect = width / height;
        camera.setViewOffset(width, height, 0, top, width, stripHeight);
        renderer.setSize(width, stripHeight, false);
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
        earth.rotation.y = -1.2 + seconds * 0.0018;
        clouds.rotation.y = -1.16 + seconds * 0.0048;
        upperClouds.rotation.y = -1.145 + seconds * 0.0052;
        materials.update(earth, clouds, upperClouds, sunlight, seconds);
        cloudMaterial.opacity = 0.94 + 0.015 * Math.sin(seconds * 0.31);
        upperCloudMaterial.opacity = 0.10 + 0.015 * Math.sin(seconds * 0.23 + 1.4);
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
      resume();

      // Keep the listener with the scene so its cleanup runs with the WebGL resources.
      sceneResources.push({ dispose: () => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("resize", resize);
      } });
    }).catch(() => {
      // The rest of the card page remains usable when a texture or WebGL fails.
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      sceneResources.forEach((resource) => resource.dispose());
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, []);

  return <div className="earth-globe" ref={hostRef} aria-hidden="true" />;
}
