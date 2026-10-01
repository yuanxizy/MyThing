import { useEffect, useRef } from "react";
import * as THREE from "three";

const MOON_TEXTURES = {
  surface: "/moon/surface-8k.jpg",
  normal: "/moon/normal-5760.png",
};

export function MoonGlobe() {
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

    const loader = new THREE.TextureLoader();
    Promise.all(Object.values(MOON_TEXTURES).map((url) => loader.loadAsync(url))).then(([surfaceMap, normalMap]) => {
      if (disposed) { surfaceMap.dispose(); normalMap.dispose(); return; }
      resources.push(surfaceMap, normalMap);
      surfaceMap.encoding = THREE.sRGBEncoding;
      normalMap.encoding = THREE.LinearEncoding;

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.physicallyCorrectLights = true;
      renderer.outputEncoding = THREE.sRGBEncoding;
      [surfaceMap, normalMap].forEach((texture) => {
        texture.anisotropy = Math.min(16, renderer!.capabilities.getMaxAnisotropy());
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
      });
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.className = "moon-globe__canvas";
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 10);
      camera.position.set(0, 0, 3.5);
      // Grazing sunlight puts the terminator inside the visible lower cap.
      // Keep fill low so the unlit hemisphere is visibly distinct.
      scene.add(new THREE.AmbientLight(0xffffff, 0.008));
      const sunlight = new THREE.DirectionalLight(0xfffaf3, 6.2);
      sunlight.position.set(-5, 0.15, 1.4);
      scene.add(sunlight);

      const globeGeometry = new THREE.SphereGeometry(1, 256, 192);
      const globeMaterial = new THREE.MeshStandardMaterial({
        map: surfaceMap,
        normalMap,
        normalScale: new THREE.Vector2(1.8, 1.8),
        color: 0xffffff,
        roughness: 1,
        metalness: 0,
      });
      const moon = new THREE.Mesh(globeGeometry, globeMaterial);
      moon.rotation.set(0.14, -1.15, -0.08);
      scene.add(moon);

      resources.push(globeGeometry, globeMaterial);

      const resize = () => {
        if (!renderer) return;
        const width = host.clientWidth;
        const height = host.clientHeight;
        if (!width || !height) return;
        const bounds = host.getBoundingClientRect();
        const scale = bounds.width / width;
        const top = Math.max(0, Math.floor(-bounds.top / scale) - 2);
        const bottom = Math.min(height, Math.ceil((window.innerHeight - bounds.top) / scale) + 2);
        const stripHeight = Math.max(1, bottom - top);
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
        moon.rotation.y = -1.15 + (now - start) * 0.000002;
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
      // Cards remain usable if textures or WebGL are unavailable.
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

  return <div className="earth-globe moon-globe" ref={hostRef} aria-hidden="true" />;
}
