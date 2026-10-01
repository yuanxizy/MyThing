import{r as L,j as D}from"./index-BdkJqua6.js";import{T as q,s as W,R as X,W as Z,A as J,S as K,h as Q,i as U,D as H,a as O,k as Y,M as b,l as ee,b as V,m as te,n as ne}from"./three.module-D60gDYJk.js";const ie=`
  varying vec2 vRing;
  void main() {
    vRing = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,oe=`
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
`,se=`
  varying vec3 vNormal;
  varying vec3 vEye;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vEye = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`,re=`
  varying vec3 vNormal;
  varying vec3 vEye;
  void main() {
    float edge = pow(1.0 - max(dot(normalize(vNormal), normalize(vEye)), 0.0), 2.8);
    gl_FragColor = vec4(0.96, 0.76, 0.48, edge * 0.19);
  }
`;function ce(){const M=L.useRef(null);return L.useEffect(()=>{const s=M.current;if(!s)return;let R=!1,t=0,e,v,u;const m=[],j=window.matchMedia("(prefers-reduced-motion: reduce)").matches;return new q().loadAsync("/saturn/saturn_surface.png").then(n=>{if(R){n.dispose();return}m.push(n),n.encoding=W,n.anisotropy=8,n.wrapS=X,e=new Z({alpha:!0,antialias:!0,powerPreference:"high-performance"}),e.outputEncoding=W,e.toneMapping=J,e.toneMappingExposure=1.32,e.setClearColor(0,0),e.domElement.className="saturn-globe__canvas",s.appendChild(e.domElement);const i=new K,d=new Q(42,1,.1,12);d.position.set(0,0,3.5),i.add(new U(16113594,.92));const z=new H(16772560,2);z.position.set(-2.5,2.2,4),i.add(z);const A=new H(10267593,.36);A.position.set(2,-1,-2),i.add(A);const S=new O(1,192,128),G=new Y({map:n,color:16773082,specular:5326392,shininess:6}),c=new b(S,G);c.scale.y=.95,c.position.y=-.06,c.rotation.set(0,-.7,.12),i.add(c);const _=new ee(1.16,1.98,768,6),F=new V({vertexShader:ie,fragmentShader:oe,transparent:!0,depthWrite:!1,depthTest:!0,side:te}),l=new b(_,F);l.rotation.set(-1.32,.04,-.34),l.position.y=-.06,l.renderOrder=2,i.add(l);const N=new O(1.015,128,96),P=new V({vertexShader:se,fragmentShader:re,transparent:!0,depthWrite:!1,blending:ne}),g=new b(N,P);g.scale.y=.95,g.position.y=-.06,i.add(g),m.push(S,G,_,F,N,P);const h=()=>{if(!e)return;const o=s.clientWidth,r=s.clientHeight;if(!o||!r)return;const w=s.getBoundingClientRect(),y=w.width/o,a=Math.round(o*1.6),$=Math.round((o-a)/2),E=Math.max(0,Math.floor(-w.top/y)-3),k=Math.min(r+350,Math.ceil((window.innerHeight-w.top)/y)+3),x=Math.max(1,k-E),B=Math.min((window.devicePixelRatio||1)*y,4,e.capabilities.maxTextureSize/a);e.setPixelRatio(B),e.domElement.style.left=`${$}px`,e.domElement.style.top=`${E}px`,e.domElement.style.width=`${a}px`,e.domElement.style.height=`${x}px`,d.aspect=a/r,d.setViewOffset(a,r,0,E,a,x),e.setSize(a,x,!1),e.render(i,d)};v=new ResizeObserver(h),v.observe(s),window.addEventListener("resize",h),h();let p=!0;const I=performance.now(),C=o=>{if(t=0,!e||!p||document.hidden)return;const r=(o-I)/1e3;c.rotation.y=-.7+r*.0019,l.rotation.z=-.34+Math.sin(r*.08)*.006,e.render(i,d),t=requestAnimationFrame(C)},f=()=>{!j&&p&&!document.hidden&&!t&&(t=requestAnimationFrame(C))},T=()=>{document.hidden&&t?(cancelAnimationFrame(t),t=0):f()};u=new IntersectionObserver(([o])=>{p=o?.isIntersecting??!0,!p&&t?(cancelAnimationFrame(t),t=0):f()}),u.observe(s),document.addEventListener("visibilitychange",T),m.push({dispose:()=>{document.removeEventListener("visibilitychange",T),window.removeEventListener("resize",h)}}),f()}).catch(()=>{}),()=>{R=!0,cancelAnimationFrame(t),v?.disconnect(),u?.disconnect(),m.forEach(n=>n.dispose()),e?.dispose(),e?.domElement.remove()}},[]),D.jsx("div",{className:"earth-globe saturn-globe",ref:M,"aria-hidden":"true"})}export{ce as SaturnGlobe};
