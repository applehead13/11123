/* ==========================================================================
   Просмотр 3D-модели детали (GLB): крутится мышью и пальцем на 360°.
   three.js лежит локально в lib/three — сайт не зависит от внешних CDN.
   Использование: window.AxModel.mount(контейнер, 'путь/к/модели.glb', { rim: 0..1.1 }) -> { destroy() }
   ========================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/MeshoptDecoder.js';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';

var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
var cache = {};          // загруженные модели, чтобы не качать повторно

function load(url) {
  if (!cache[url]) cache[url] = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  return cache[url];
}

function mount(box, url, opts) {
  opts = opts || {};
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  box.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;   // мягкий студийный свет

  // тёплая оранжевая подсветка сзади — фирменный контровой свет
  var rim = new THREE.DirectionalLight(0xff5e1a, opts.rim === undefined ? 1.1 : opts.rim);   // для цветных деталей подсветку ослабляем, чтобы не искажать цвет rim.position.set(-3, 2, -4); scene.add(rim);
  var key = new THREE.DirectionalLight(0xeee5d5, 1.2); key.position.set(3, 4, 3); scene.add(key);

  var camera = new THREE.PerspectiveCamera(32, 1, .01, 100);
  camera.position.set(1.6, 1.0, 2.0);
  if (opts.still) camera.position.multiplyScalar(.82);

  box.addEventListener('dragstart', function (e) { e.preventDefault(); });      // картинку-заглушку не таскаем, деталь вращаем
  var controls = new OrbitControls(camera, box);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.enablePan = false; controls.enableZoom = false;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = opts.speed || 1.2;
  if (opts.still) { controls.enabled = false; controls.minPolarAngle = controls.maxPolarAngle = opts.tilt || 1.1; }   // летающие детали: только вращаются сами
  controls.minPolarAngle = .15; controls.maxPolarAngle = Math.PI * .62;
  controls.addEventListener('start', function () { controls.autoRotate = false; });
  var resumeTimer;
  controls.addEventListener('end', function () { clearTimeout(resumeTimer); resumeTimer = setTimeout(function () { controls.autoRotate = !reduce; }, 3000); });

  var pivot = new THREE.Group(); scene.add(pivot);
  var alive = true, raf = 0;

  load(url).then(function (gltf) {
    if (!alive) return;
    var obj = gltf.scene.clone(true);
    obj.traverse(function (m) {
      if (!m.isMesh) return;
      if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();     // в сгенерированных моделях нормалей может не быть
      var src = m.material;
      m.material = new THREE.MeshStandardMaterial({ map: src.map || null, color: src.color || 0xffffff, roughness: .55, metalness: .15 });
      if (m.material.map) m.material.map.colorSpace = THREE.SRGBColorSpace;
    });
    // по центру и в единичном размере
    var bb = new THREE.Box3().setFromObject(obj), size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    obj.position.sub(c);
    pivot.scale.setScalar(1.4 / K / Math.max(size.x, size.y, size.z));   // видимый размер прежний, но вокруг есть запас: деталь может заходить за границы блока
    pivot.add(obj);
    if (opts.spin) pivot.rotation.set(opts.spin[0], opts.spin[1], opts.spin[2]);
    box.classList.add('is-ready');
  }).catch(function () { box.classList.add('is-error'); });

  var K = 1.8;      // холст больше блока в K раз: деталь не обрезается его краями
  function size() {
    var bw = box.clientWidth, bh = box.clientHeight || bw * .74, w = bw * K, h = bh * K;
    renderer.setSize(w, h, false);
    var st = renderer.domElement.style, o = -(K - 1) / 2 * 100 + '%';
    st.position = 'absolute'; st.width = K * 100 + '%'; st.height = K * 100 + '%'; st.left = o; st.top = o; st.maxWidth = 'none'; st.pointerEvents = 'none';
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  var ro = new ResizeObserver(size); ro.observe(box); size();

  var visible = true;
  var io = new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }); io.observe(box);
  (function loop() {
    raf = requestAnimationFrame(loop);
    if (!visible) return;
    controls.update(); renderer.render(scene, camera);
  })();

  return {
    destroy: function () {
      alive = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose();
      renderer.dispose(); pmrem.dispose(); renderer.domElement.remove();
    }
  };
}

window.AxModel = { mount: mount };
window.dispatchEvent(new Event('axmodel-ready'));
