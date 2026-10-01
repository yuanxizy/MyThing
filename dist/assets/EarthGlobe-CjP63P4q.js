import{r as B,j as oe}from"./index-BdkJqua6.js";import{S as X,a as U,b as Y,B as ne,M as z,P as te,s as J,V,c as $,d as j,e as ie,f as N,Q as ae,T as re,W as ce,A as se,R as le,L as ue,g as de,h as me,i as ve,D as Q,j as pe}from"./three.module-D60gDYJk.js";const W=`
  vec3 openDaylightShadows(vec3 radiance, vec3 bounceColor) {
    float luminance = dot(max(radiance, vec3(0.0)), vec3(0.2126, 0.7152, 0.0722));
    return radiance + bounceColor * (1.0 - smoothstep(0.035, 0.38, luminance));
  }
  vec2 globeUv(vec3 direction) {
    direction = normalize(direction);
    return vec2(fract(atan(direction.z, -direction.x) / (2.0 * PI)), asin(clamp(direction.y, -1.0, 1.0)) / PI + 0.5);
  }
`,K=`
  uniform sampler2D cloudDensityMap;
  uniform float cloudTime;
  float cloudDensityAt(vec2 sampleUv) {
    // Sub-texel advection gently changes wisps while the satellite structure
    // stays recognizable. The map carries density, not black cloud color.
    vec2 flow = vec2(sin(sampleUv.y * 45.0 + cloudTime * 0.035), cos(sampleUv.x * 39.0 - cloudTime * 0.025)) * 0.00016;
    return texture2D(cloudDensityMap, sampleUv + flow).r;
  }
`;function ge(w){const[i,g,t,e,h]=w;i.encoding=J;const f={value:0},x={value:new ie},E={value:new V},M=new $({map:i,normalMap:g,normalScale:new j(1.15,1.15),metalness:0,roughness:.8,ior:1.4,clearcoat:.32,clearcoatRoughness:.23,envMapIntensity:.42});M.onBeforeCompile=o=>{Object.assign(o.uniforms,{oceanMaskMap:{value:t},cloudDensityMap:{value:e},cloudTime:f,earthToCloud:x,sunDirectionEarth:E}),o.vertexShader=o.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vSurfacePosition;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vSurfacePosition = position;`),o.fragmentShader=o.fragmentShader.replace("#include <common>",`#include <common>
        varying vec3 vSurfacePosition;
        uniform sampler2D oceanMaskMap;
        uniform mat3 earthToCloud;
        uniform vec3 sunDirectionEarth;
        ${W}
        ${K}`).replace("#include <map_fragment>",`#include <map_fragment>
        float oceanCoverage = texture2D(oceanMaskMap, vUv).r;
        vec3 surfaceDirection = normalize(vSurfacePosition);
        float sunHeight = dot(surfaceDirection, sunDirectionEarth);
        // Intersect the sunlight ray with the existing cloud shell. This keeps
        // moving shadows registered to the cloud rotation and actual sunlight.
        float travel = -sunHeight + sqrt(sunHeight * sunHeight + 1.016 * 1.016 - 1.0);
        vec2 shadowUv = globeUv(earthToCloud * normalize(surfaceDirection + sunDirectionEarth * travel));
        vec2 penumbra = vec2(1.5 / 8192.0, 1.5 / 4096.0);
        float cloudShadow = (cloudDensityAt(shadowUv) * 2.0 + cloudDensityAt(shadowUv + penumbra) + cloudDensityAt(shadowUv - penumbra)) * 0.25;
        diffuseColor.rgb *= 1.0 - cloudShadow * 0.26 * smoothstep(0.0, 0.22, sunHeight);`).replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
        roughnessFactor = mix(0.88, 0.23, oceanCoverage);`).replace("#include <lights_physical_fragment>",`#include <lights_physical_fragment>
        material.clearcoat *= oceanCoverage;
        material.specularColor = mix(vec3(0.04), vec3(0.0204), oceanCoverage);`).replace("#include <output_fragment>",`
        outgoingLight = openDaylightShadows(outgoingLight, mix(vec3(0.060, 0.105, 0.135), vec3(0.025, 0.090, 0.200), oceanCoverage));
        #include <output_fragment>`)},M.customProgramCacheKey=()=>"earth-8k-physical-daylight-v3";const r=o=>{const m={value:new V},c=new $({color:o?16055039:16777215,normalMap:h,normalScale:new j(o?.14:.42,o?.14:.42),metalness:0,roughness:1,specularIntensity:.12,envMapIntensity:.24,transparent:!0,opacity:o?.12:.96,depthWrite:!1});return c.onBeforeCompile=u=>{Object.assign(u.uniforms,{cloudDensityMap:{value:e},cloudTime:f,sunDirectionLocal:m}),u.vertexShader=u.vertexShader.replace("#include <common>",`#include <common>
          varying vec3 vCloudPosition;
          varying vec3 vCloudSunView;
          uniform vec3 sunDirectionLocal;`).replace("#include <begin_vertex>",`#include <begin_vertex>
          vCloudPosition = position;
          vCloudSunView = normalize(mat3(modelViewMatrix) * sunDirectionLocal);`),u.fragmentShader=u.fragmentShader.replace("#include <common>",`#include <common>
          varying vec3 vCloudPosition;
          varying vec3 vCloudSunView;
          uniform vec3 sunDirectionLocal;
          ${W}
          ${K}`).replace("#include <map_fragment>",`#include <map_fragment>
          float density = cloudDensityAt(vUv);
          float coverage = smoothstep(${o?"0.20, 0.88":"0.035, 0.86"}, density);
          float grazing = 1.0 / max(0.28, abs(dot(normalize(vNormal), normalize(vViewPosition))));
          // Beer-Lambert coverage gives thin wisps translucence and thicker
          // cloud bodies a pearly white, including at grazing viewing angles.
          diffuseColor.a *= 1.0 - exp(-pow(coverage, 1.35) * ${o?"1.35":"3.8"} * grazing);`).replace("#include <output_fragment>",`
          vec3 cloudDirection = normalize(vCloudPosition);
          vec3 lightTangent = sunDirectionLocal - dot(cloudDirection, sunDirectionLocal) * cloudDirection;
          float nearDensity = cloudDensityAt(globeUv(cloudDirection + lightTangent * 0.0018));
          float farDensity = cloudDensityAt(globeUv(cloudDirection + lightTangent * 0.0036));
          float selfShade = clamp(max(nearDensity - density, 0.0) * 0.40 + max(farDensity - density, 0.0) * 0.24, 0.0, 0.28);
          outgoingLight *= 1.0 - selfShade;
          float silver = pow(1.0 - max(dot(normal, geometry.viewDir), 0.0), 3.0) * smoothstep(-0.1, 0.5, dot(normal, normalize(vCloudSunView))) * (1.0 - density);
          outgoingLight += vec3(0.34, 0.43, 0.55) * silver;
          outgoingLight = openDaylightShadows(outgoingLight, vec3(0.110, 0.160, 0.230));
          #include <output_fragment>`)},c.customProgramCacheKey=()=>`earth-cloud-scattering-${o?"cirrus":"body"}-v3`,{material:c,sunDirectionLocal:m}},s=r(!1),S=r(!0),l=new V,d=new ae,D=new N,T=new N;return{ground:M,clouds:s.material,cirrus:S.material,update(o,m,c,u,b){f.value=b,l.copy(u.position).normalize(),E.value.copy(l).applyQuaternion(d.copy(o.quaternion).invert()),s.sunDirectionLocal.value.copy(l).applyQuaternion(d.copy(m.quaternion).invert()),S.sunDirectionLocal.value.copy(l).applyQuaternion(d.copy(c.quaternion).invert()),D.makeRotationFromQuaternion(m.quaternion).invert().multiply(T.makeRotationFromQuaternion(o.quaternion)),x.value.setFromMatrix4(D)}}}function he(w){const i=new X,g=new U(8,32,16),t=new Y({side:ne,vertexShader:"varying vec3 vDirection; void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`varying vec3 vDirection; void main() {
      vec3 direction = normalize(vDirection);
      vec3 sky = mix(vec3(0.10, 0.19, 0.34), vec3(0.60, 0.79, 1.02), smoothstep(-0.45, 0.85, direction.y));
      float softSun = pow(max(dot(direction, normalize(vec3(-3.0, -3.2, 4.0))), 0.0), 64.0);
      gl_FragColor = vec4(sky + vec3(1.3, 1.2, 1.05) * softSun, 1.0);
    }`,toneMapped:!1});i.add(new z(g,t));const e=new te(w),h=e.fromScene(i,.035,.1,12);return e.dispose(),g.dispose(),t.dispose(),h}const fe={surface:"/earth/surface-8192.jpg",normal:"/earth/terrain-normal-4096.png",ocean:"/earth/ocean-mask-4096.png",clouds:"/earth/cloud-density-8192.webp",cloudNormal:"/earth/cloud-normal-4096.png"},ye=`
  varying vec2 vScreenUv;
  void main() {
    vScreenUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`,we=`
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
`;function Se(){const w=B.useRef(null);return B.useEffect(()=>{const i=w.current;if(!i)return;let g=!1,t=0,e,h,f,x=[];const E=new re,M=window.matchMedia("(prefers-reduced-motion: reduce)").matches;return Promise.all(Object.values(fe).map(r=>E.loadAsync(r))).then(r=>{if(g){r.forEach(n=>n.dispose());return}e=new ce({alpha:!0,antialias:!0,powerPreference:"high-performance"}),e.outputEncoding=J,e.toneMapping=se,e.toneMappingExposure=1,e.setClearColor(0,0),e.domElement.className="earth-globe__canvas",i.appendChild(e.domElement),r.forEach(n=>{n.anisotropy=e.capabilities.getMaxAnisotropy(),n.wrapS=le,n.minFilter=ue,n.magFilter=de});const s=new X,S=he(e);s.environment=S.texture;const l=new me(42,1,.1,10);l.position.set(0,0,3.5),s.add(new ve(12179700,.38));const d=new Q(16775148,2.15);d.position.set(-3,-3.2,4),s.add(d);const D=new Q(11917823,.48);D.position.set(3,-1,2),s.add(D);const T=new U(1,256,192),o=new U(1.016,192,144),m=new U(1.027,96,72),c=ge(r),u=c.ground,b=c.clouds,A=c.cirrus,G=new pe(2,2),C=new Y({vertexShader:ye,fragmentShader:we,uniforms:{fullSize:{value:new j(1400,1400)},stripTop:{value:0},stripHeight:{value:1400},projectedRadius:{value:1.027/(Math.sqrt(3.5**2-1.027**2)*Math.tan(42*Math.PI/360))}},transparent:!0,depthTest:!1,depthWrite:!1}),F=new z(G,C);F.frustumCulled=!1,F.renderOrder=20;const y=new z(T,u),v=new z(o,b),p=new z(m,A);y.rotation.set(1.4,-1.2,-.08),v.rotation.x=p.rotation.x=y.rotation.x,v.rotation.z=p.rotation.z=y.rotation.z,v.rotation.y=-1.16,p.rotation.y=-1.145,v.renderOrder=2,p.renderOrder=3,c.update(y,v,p,d,0),s.add(y,v,p,F),x=[T,o,m,G,u,b,A,C,S,...r];const L=()=>{if(!e)return;const n=i.clientWidth,a=i.clientHeight;if(!n||!a)return;const O=i.getBoundingClientRect(),k=O.width/n,R=Math.max(0,Math.floor(-O.top/k)-2),ee=Math.min(a,Math.ceil((window.innerHeight-O.top)/k)+2),P=Math.max(1,ee-R);C.uniforms.fullSize.value.set(n,a),C.uniforms.stripTop.value=R,C.uniforms.stripHeight.value=P,e.setPixelRatio(Math.min((window.devicePixelRatio||1)*k,4)),e.domElement.style.top=`${R}px`,e.domElement.style.height=`${P}px`,l.aspect=n/a,l.setViewOffset(n,a,0,R,n,P),e.setSize(n,P,!1),e.render(s,l)};h=new ResizeObserver(L),h.observe(i),window.addEventListener("resize",L),L();let _=!0;const Z=performance.now(),I=n=>{if(t=0,!e||!_||document.hidden)return;const a=(n-Z)/1e3;y.rotation.y=-1.2+a*.0018,v.rotation.y=-1.16+a*.0048,p.rotation.y=-1.145+a*.0052,c.update(y,v,p,d,a),b.opacity=.94+.015*Math.sin(a*.31),A.opacity=.1+.015*Math.sin(a*.23+1.4),e.render(s,l),t=requestAnimationFrame(I)},H=()=>{!M&&_&&!document.hidden&&!t&&(t=requestAnimationFrame(I))},q=()=>{document.hidden&&t?(cancelAnimationFrame(t),t=0):H()};f=new IntersectionObserver(([n])=>{_=n?.isIntersecting??!0,!_&&t?(cancelAnimationFrame(t),t=0):H()}),f.observe(i),document.addEventListener("visibilitychange",q),H(),x.push({dispose:()=>{document.removeEventListener("visibilitychange",q),window.removeEventListener("resize",L)}})}).catch(()=>{}),()=>{g=!0,cancelAnimationFrame(t),h?.disconnect(),f?.disconnect(),x.forEach(r=>r.dispose()),e?.dispose(),e?.domElement.remove()}},[]),oe.jsx("div",{className:"earth-globe",ref:w,"aria-hidden":"true"})}export{Se as EarthGlobe};
