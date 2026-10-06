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
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
var cache = {};          // загруженные модели, чтобы не качать повторно

function load(url) {
  if (!cache[url]) cache[url] = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  return cache[url];
}

/* ===== Материализация: деталь «собирается» снизу вверх светящейся линией-сканером =====
   Один раз при появлении модели — как в старой фантастике про сканирование/телепортацию.
   Работает через onBeforeCompile: часть поверхности ниже линии ещё не нарисована (discard),
   у самой линии — яркая оранжевая кромка. */
function scanReveal(mesh, duration) {
  var geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  var minY = geo.boundingBox.min.y, maxY = geo.boundingBox.max.y;
  var mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  var scanCode = '\nfloat scanT = (vScanY - uMinY) / max(1e-4, uMaxY - uMinY);\n' +
    'if (scanT > uScan) discard;\n' +
    'float scanEdge = 1.0 - smoothstep(uScan - .1, uScan, scanT);\n' +
    'gl_FragColor.rgb += uGlow * scanEdge * 1.3;\n';
  mats.forEach(function (m) {
    m.onBeforeCompile = function (shader) {
      shader.uniforms.uScan = { value: reduce ? 2 : 0 };
      shader.uniforms.uMinY = { value: minY };
      shader.uniforms.uMaxY = { value: maxY };
      shader.uniforms.uGlow = { value: new THREE.Color(0xff5e1a) };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vScanY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvScanY = transformed.y;');
      // Фрагмент: вставляем код сканирования перед самой последней закрывающей скобкой main() —
      // так не зависим от того, какие именно include-чанки конкретная сборка шейдера уже развернула.
      var fs = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vScanY;\nuniform float uScan;\nuniform float uMinY;\nuniform float uMaxY;\nuniform vec3 uGlow;');
      var idx = fs.lastIndexOf('}');
      shader.fragmentShader = fs.slice(0, idx) + scanCode + fs.slice(idx);
      m.userData.scanShader = shader;
    };
    m.needsUpdate = true;
  });
  if (reduce) return;
  var t0 = performance.now();
  (function tick(now) {
    var p = Math.min(1, (now - t0) / duration), e = 1 - Math.pow(1 - p, 2), v = e * 1.14;
    mats.forEach(function (m) { if (m.userData.scanShader) m.userData.scanShader.uniforms.uScan.value = v; });
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
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
      if (!opts.still) scanReveal(m, 1100);   // материализация: для летающих декоративных деталей не включаем, чтобы не мельтешило
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


/* Габаритная заготовка для калькулятора: тот же свет и материал, что у деталей в блоке «Работы»
   (стандартный материал, студийное окружение, оранжевая подсветка), по поверхности — слоистая фактура печати.
   Крутится мышью и пальцем, сама медленно поворачивается. set(L, W, H) меняет размеры. */
function mountBox(box, opts) {
  opts = opts || {};
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
  box.appendChild(renderer.domElement);
  var scene = new THREE.Scene(), pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  var rim = new THREE.DirectionalLight(0xff5e1a, 1.1); rim.position.set(-3, 2, -4); scene.add(rim);
  var key = new THREE.DirectionalLight(0xeee5d5, 1.2); key.position.set(3, 4, 3); scene.add(key);
  var camera = new THREE.PerspectiveCamera(32, 1, .01, 100); camera.position.set(0, 1.2, 4.3); camera.lookAt(0, 0, 0);

  // фактура слоёв печати: тонкие горизонтальные полосы (карта неровности)
  var cv = document.createElement('canvas'); cv.width = 8; cv.height = 64; var cx = cv.getContext('2d');
  cx.fillStyle = '#808080'; cx.fillRect(0, 0, 8, 64); cx.fillStyle = '#c4c4c4'; cx.fillRect(0, 0, 8, 22); cx.fillStyle = '#505050'; cx.fillRect(0, 44, 8, 20);
  var bump = new THREE.CanvasTexture(cv); bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  var mat = new THREE.MeshStandardMaterial({ color: 0x9da1a4, roughness: .6, metalness: .15, bumpMap: bump, bumpScale: .5 });
  var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); scene.add(mesh);
  var yaw = -.6, pitch = .32, drag = null, spin = !reduce, resume = 0, dims = [50, 50, 30];

  function set(L, W, H) {
    dims = [L, W, H];
    var d = Math.sqrt(L * L + W * W + H * H), k = Math.min(1.95 / d, 1.65 / Math.max(L, W, H)), w = L * k, h = H * k, dd = W * k;
    mesh.geometry.dispose();
    mesh.geometry = new RoundedBoxGeometry(w, h, dd, 3, Math.min(w, h, dd) * .08);
    partDims = [w, h, dd];
    updateCaps();
    bump.repeat.set(1, Math.max(6, Math.round(H * 1.6)));
    bump.needsUpdate = true;
  }
  var partDims = [1, 1, 1], capKey = '';
  // вертикальный полуразмер детали в пикселях при высоте области hpx и ширине wpx (максимум по поворотам)
  function partHalf(hpx, wpx) {
    var tf = Math.tan(16 * Math.PI / 180), zc = Math.max(4.3, 1.2 / (tf * (wpx / hpx))), alpha = Math.atan2(1.2, zc);
    var ca = Math.cos(alpha), sa = Math.sin(alpha), best = 0, hx = partDims[0] / 2, hy = partDims[1] / 2, hz = partDims[2] / 2;
    [0, .32, .7].forEach(function (p) {
      var cp = Math.cos(p), sp = Math.sin(p);
      for (var k = 0; k < 24; k++) {
        var t = k * Math.PI / 12, ct = Math.cos(t), st = Math.sin(t);
        [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sy) { [-1, 1].forEach(function (sz) {
          var x = sx * hx, y = sy * hy, z = sz * hz;
          var y1 = y * cp - z * sp, z1 = y * sp + z * cp;
          var x2 = x * ct + z1 * st, z2 = -x * st + z1 * ct;
          var yv = y1 * ca - z2 * sa, dv = zc - (z2 * ca + y1 * sa);
          best = Math.max(best, Math.abs(yv) / dv * (hpx / 2) / tf);
        }); }); });
      }
    });
    return best;
  }
  // подписи у детали: на 20 px от самой дальней по вертикали точки детали; сама деталь не уменьшается.
  // Минимальная высота области считается только по ширине и размерам детали (без обратной связи), поэтому не дёргается.
  function updateCaps() {
    var wpx = box.clientWidth || 1, hpx = box.clientHeight || 1;
    box.style.setProperty('--part-r', Math.round(partHalf(hpx, wpx)) + 'px');
    var t = box.querySelector('.dossier__dim--t'), c = box.querySelector('.cc__cap');
    var K = 40 + (t ? t.offsetHeight : 0) + (c ? c.offsetHeight : 0) + 24;
    // у верхней подписи одна строка, у нижней может быть две: сдвигаем область на пол-разницы, чтобы отступы сверху и снизу были равны
    var d = (c ? c.offsetHeight : 0) - (t ? t.offsetHeight : 0), par = box.parentNode;
    if (par && par.classList && par.classList.contains('cc__stage-box')) { var one = innerWidth <= 699; par.style.marginTop = one ? (-d / 2) + 'px' : ''; par.style.marginBottom = one ? (d / 2) + 'px' : ''; }
    var key = [wpx, K, partDims.map(function (x) { return x.toFixed(2); }).join('/')].join('|');
    if (key === capKey) return;
    capKey = key;
    var need = 0;
    for (var h = 240; h <= 1600; h += 8) { if (K + 2 * partHalf(h, wpx) <= h) { need = h; break; } }
    box.style.minHeight = need + 'px';
  }
  function size() {
    var w = box.clientWidth || 1, h = box.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    camera.position.z = Math.max(4.3, 1.2 / (Math.tan(16 * Math.PI / 180) * (w / h))); camera.lookAt(0, 0, 0);   // в узкой области камера отодвигается — деталь не обрезается по краям
    updateCaps();
  }
  var ro = new ResizeObserver(size); ro.observe(box); size(); set(50, 50, 30);
  scanReveal(mesh, 900);   // материализация: один раз при появлении калькулятора

  box.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, yaw: yaw, pitch: pitch }; spin = false; box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', function (e) { if (!drag) return; yaw = drag.yaw + (e.clientX - drag.x) * .012; pitch = Math.max(-.2, Math.min(1.2, drag.pitch + (e.clientY - drag.y) * .008)); });
  var end = function () { if (!drag) return; drag = null; clearTimeout(resume); resume = setTimeout(function () { spin = !reduce; }, 2500); };
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  var visible = true, raf = 0, io = new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }); io.observe(box);
  (function loop() {
    raf = requestAnimationFrame(loop);
    if (!visible) return;
    if (spin) yaw += .006;
    mesh.rotation.set(pitch, yaw, 0, 'YXZ');
    renderer.render(scene, camera);
  })();
  return { set: set, destroy: function () { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); pmrem.dispose(); renderer.domElement.remove(); } };
}

window.AxModel = { mount: mount, mountBox: mountBox };
window.dispatchEvent(new Event('axmodel-ready'));
