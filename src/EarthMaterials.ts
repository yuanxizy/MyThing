import * as THREE from "three";

const OPEN_SHADOWS = `
  vec3 openDaylightShadows(vec3 radiance, vec3 bounceColor) {
    float luminance = dot(max(radiance, vec3(0.0)), vec3(0.2126, 0.7152, 0.0722));
    return radiance + bounceColor * (1.0 - smoothstep(0.035, 0.38, luminance));
  }
  vec2 globeUv(vec3 direction) {
    direction = normalize(direction);
    return vec2(fract(atan(direction.z, -direction.x) / (2.0 * PI)), asin(clamp(direction.y, -1.0, 1.0)) / PI + 0.5);
  }
`;

const CLOUD_DENSITY = `
  uniform sampler2D cloudDensityMap;
  uniform float cloudTime;
  float cloudDensityAt(vec2 sampleUv) {
    // Sub-texel advection gently changes wisps while the satellite structure
    // stays recognizable. The map carries density, not black cloud color.
    vec2 flow = vec2(sin(sampleUv.y * 45.0 + cloudTime * 0.035), cos(sampleUv.x * 39.0 - cloudTime * 0.025)) * 0.00016;
    return texture2D(cloudDensityMap, sampleUv + flow).r;
  }
`;

export function createEarthMaterials(textures: THREE.Texture[]) {
  const [surfaceMap, normalMap, oceanMap, cloudMap, cloudNormalMap] = textures;
  surfaceMap.encoding = THREE.sRGBEncoding;
  const cloudTime = { value: 0 };
  const earthToCloud = { value: new THREE.Matrix3() };
  const sunDirectionEarth = { value: new THREE.Vector3() };
  const ground = new THREE.MeshPhysicalMaterial({
    map: surfaceMap,
    normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    metalness: 0,
    roughness: 0.8,
    ior: 1.4,
    clearcoat: 0.32,
    clearcoatRoughness: 0.23,
    envMapIntensity: 0.42,
  });
  ground.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      oceanMaskMap: { value: oceanMap },
      cloudDensityMap: { value: cloudMap },
      cloudTime,
      earthToCloud,
      sunDirectionEarth,
    });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSurfacePosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSurfacePosition = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vSurfacePosition;
        uniform sampler2D oceanMaskMap;
        uniform mat3 earthToCloud;
        uniform vec3 sunDirectionEarth;
        ${OPEN_SHADOWS}
        ${CLOUD_DENSITY}`)
      .replace("#include <map_fragment>", `#include <map_fragment>
        float oceanCoverage = texture2D(oceanMaskMap, vUv).r;
        vec3 surfaceDirection = normalize(vSurfacePosition);
        float sunHeight = dot(surfaceDirection, sunDirectionEarth);
        // Intersect the sunlight ray with the existing cloud shell. This keeps
        // moving shadows registered to the cloud rotation and actual sunlight.
        float travel = -sunHeight + sqrt(sunHeight * sunHeight + 1.016 * 1.016 - 1.0);
        vec2 shadowUv = globeUv(earthToCloud * normalize(surfaceDirection + sunDirectionEarth * travel));
        vec2 penumbra = vec2(1.5 / 8192.0, 1.5 / 4096.0);
        float cloudShadow = (cloudDensityAt(shadowUv) * 2.0 + cloudDensityAt(shadowUv + penumbra) + cloudDensityAt(shadowUv - penumbra)) * 0.25;
        diffuseColor.rgb *= 1.0 - cloudShadow * 0.26 * smoothstep(0.0, 0.22, sunHeight);`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.88, 0.23, oceanCoverage);`)
      .replace("#include <lights_physical_fragment>", `#include <lights_physical_fragment>
        material.clearcoat *= oceanCoverage;
        material.specularColor = mix(vec3(0.04), vec3(0.0204), oceanCoverage);`)
      .replace("#include <output_fragment>", `
        outgoingLight = openDaylightShadows(outgoingLight, mix(vec3(0.060, 0.105, 0.135), vec3(0.025, 0.090, 0.200), oceanCoverage));
        #include <output_fragment>`);
  };
  ground.customProgramCacheKey = () => "earth-8k-physical-daylight-v3";

  const makeCloud = (upper: boolean) => {
    const sunDirectionLocal = { value: new THREE.Vector3() };
    const material = new THREE.MeshPhysicalMaterial({
      color: upper ? 0xf4faff : 0xffffff,
      normalMap: cloudNormalMap,
      normalScale: new THREE.Vector2(upper ? 0.14 : 0.42, upper ? 0.14 : 0.42),
      metalness: 0,
      roughness: 1,
      specularIntensity: 0.12,
      envMapIntensity: 0.24,
      transparent: true,
      opacity: upper ? 0.12 : 0.96,
      depthWrite: false,
    });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, { cloudDensityMap: { value: cloudMap }, cloudTime, sunDirectionLocal });
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>
          varying vec3 vCloudPosition;
          varying vec3 vCloudSunView;
          uniform vec3 sunDirectionLocal;`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          vCloudPosition = position;
          vCloudSunView = normalize(mat3(modelViewMatrix) * sunDirectionLocal);`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>
          varying vec3 vCloudPosition;
          varying vec3 vCloudSunView;
          uniform vec3 sunDirectionLocal;
          ${OPEN_SHADOWS}
          ${CLOUD_DENSITY}`)
        .replace("#include <map_fragment>", `#include <map_fragment>
          float density = cloudDensityAt(vUv);
          float coverage = smoothstep(${upper ? "0.20, 0.88" : "0.035, 0.86"}, density);
          float grazing = 1.0 / max(0.28, abs(dot(normalize(vNormal), normalize(vViewPosition))));
          // Beer-Lambert coverage gives thin wisps translucence and thicker
          // cloud bodies a pearly white, including at grazing viewing angles.
          diffuseColor.a *= 1.0 - exp(-pow(coverage, 1.35) * ${upper ? "1.35" : "3.8"} * grazing);`)
        .replace("#include <output_fragment>", `
          vec3 cloudDirection = normalize(vCloudPosition);
          vec3 lightTangent = sunDirectionLocal - dot(cloudDirection, sunDirectionLocal) * cloudDirection;
          float nearDensity = cloudDensityAt(globeUv(cloudDirection + lightTangent * 0.0018));
          float farDensity = cloudDensityAt(globeUv(cloudDirection + lightTangent * 0.0036));
          float selfShade = clamp(max(nearDensity - density, 0.0) * 0.40 + max(farDensity - density, 0.0) * 0.24, 0.0, 0.28);
          outgoingLight *= 1.0 - selfShade;
          float silver = pow(1.0 - max(dot(normal, geometry.viewDir), 0.0), 3.0) * smoothstep(-0.1, 0.5, dot(normal, normalize(vCloudSunView))) * (1.0 - density);
          outgoingLight += vec3(0.34, 0.43, 0.55) * silver;
          outgoingLight = openDaylightShadows(outgoingLight, vec3(0.110, 0.160, 0.230));
          #include <output_fragment>`);
    };
    material.customProgramCacheKey = () => `earth-cloud-scattering-${upper ? "cirrus" : "body"}-v3`;
    return { material, sunDirectionLocal };
  };
  const body = makeCloud(false);
  const cirrus = makeCloud(true);
  const sun = new THREE.Vector3();
  const inverse = new THREE.Quaternion();
  const relative = new THREE.Matrix4();
  const rotation = new THREE.Matrix4();
  return {
    ground,
    clouds: body.material,
    cirrus: cirrus.material,
    update(earth: THREE.Mesh, clouds: THREE.Mesh, upperClouds: THREE.Mesh, sunlight: THREE.DirectionalLight, seconds: number) {
      cloudTime.value = seconds;
      sun.copy(sunlight.position).normalize();
      sunDirectionEarth.value.copy(sun).applyQuaternion(inverse.copy(earth.quaternion).invert());
      body.sunDirectionLocal.value.copy(sun).applyQuaternion(inverse.copy(clouds.quaternion).invert());
      cirrus.sunDirectionLocal.value.copy(sun).applyQuaternion(inverse.copy(upperClouds.quaternion).invert());
      relative.makeRotationFromQuaternion(clouds.quaternion).invert().multiply(rotation.makeRotationFromQuaternion(earth.quaternion));
      earthToCloud.value.setFromMatrix4(relative);
    },
  };
}

export function createDaylightEnvironment(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const scene = new THREE.Scene();
  const geometry = new THREE.SphereGeometry(8, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying vec3 vDirection; void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vDirection; void main() {
      vec3 direction = normalize(vDirection);
      vec3 sky = mix(vec3(0.10, 0.19, 0.34), vec3(0.60, 0.79, 1.02), smoothstep(-0.45, 0.85, direction.y));
      float softSun = pow(max(dot(direction, normalize(vec3(-3.0, -3.2, 4.0))), 0.0), 64.0);
      gl_FragColor = vec4(sky + vec3(1.3, 1.2, 1.05) * softSun, 1.0);
    }`,
    toneMapped: false,
  });
  scene.add(new THREE.Mesh(geometry, material));
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(scene, 0.035, 0.1, 12);
  generator.dispose();
  geometry.dispose();
  material.dispose();
  return environment;
}
