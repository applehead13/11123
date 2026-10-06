/* Сравнение вариантов «появления» детали. Отдельная демо-страница, на сайт не влияет. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/MeshoptDecoder.js';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';

var MODEL = 'assets/models/case-1.glb';
var gltfCache = null;
function loadModel() {
  if (!gltfCache) gltfCache = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(MODEL);
  return gltfCache;
}

var VARIANTS = [
  { id: 'line', title: '//Тонкая линия-сканер', text: 'Деталь скрыта. По ней один раз проходит тонкая яркая линия сверху вниз, без заливки цветом — просто чёткая полоса света.' },
  { id: 'grow', title: '//Просто проявление', text: 'Деталь «вырастает» снизу вверх без всякой подсветки и линий — тихо и просто, как будто её печатают.' },
  { id: 'wire', title: '//Контур → тело', text: 'Сначала виден только каркас (рёбра) детали, затем он наполняется плотной поверхностью.' },
  { id: 'flicker', title: '//Подключение (мерцание)', text: 'Деталь видна сразу, но пару раз мигает, набирая яркость — как подключение питания.' },
  { id: 'pulse', title: '//Пробегающий блик', text: 'Деталь видна сразу и никогда не прячется — по ней один раз пробегает светлая полоса-блик.' }
];

function buildCard(v) {
  var card = document.createElement('div'); card.className = 'card';
  card.innerHTML = '<h2>' + v.title + '</h2><p>' + v.text + '</p><div class="stage"></div>' +
    '<div class="row"><button type="button" class="replay">Повторить</button></div>';
  document.getElementById('grid').appendChild(card);
  return card;
}

function setupScene(stage) {
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  stage.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  var rim = new THREE.DirectionalLight(0xff5e1a, 1.1); rim.position.set(-3, 2, -4); scene.add(rim);
  var key = new THREE.DirectionalLight(0xeee5d5, 1.2); key.position.set(3, 4, 3); scene.add(key);

  var camera = new THREE.PerspectiveCamera(32, 1, .01, 100);
  camera.position.set(1.6, 1.0, 2.0);

  var controls = new OrbitControls(camera, stage);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.enablePan = false; controls.enableZoom = false;
  controls.autoRotate = true; controls.autoRotateSpeed = 1.2;
  controls.minPolarAngle = .15; controls.maxPolarAngle = Math.PI * .62;
  controls.addEventListener('start', function () { controls.autoRotate = false; });
  var resumeTimer;
  controls.addEventListener('end', function () { clearTimeout(resumeTimer); resumeTimer = setTimeout(function () { controls.autoRotate = true; }, 3000); });

  var pivot = new THREE.Group(); scene.add(pivot);

  function size() {
    var w = stage.clientWidth || 1, h = stage.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(stage); size();

  var raf = 0, extra = null;
  (function loop() {
    raf = requestAnimationFrame(loop);
    controls.update();
    if (extra) extra();
    renderer.render(scene, camera);
  })();

  return {
    scene: scene, camera: camera, pivot: pivot,
    setExtra: function (fn) { extra = fn; }
  };
}

// --- помощники -------------------------------------------------------------
function centerAndAdd(pivot, obj) {
  var bb = new THREE.Box3().setFromObject(obj), size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  obj.position.sub(c);
  pivot.clear();
  pivot.scale.setScalar(1.4 / 1.8 / Math.max(size.x, size.y, size.z));
  pivot.add(obj);
}
function standardMat(src) {
  var m = new THREE.MeshStandardMaterial({ map: src.map || null, color: src.color || 0xffffff, roughness: .55, metalness: .15 });
  if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
  return m;
}
function easeOut(p) { return 1 - Math.pow(1 - p, 2); }

// --- A: тонкая линия-сканер, без заливки -----------------------------------
function effectLine(pivot, gltf) {
  var obj = gltf.scene.clone(true), meshes = [];
  obj.traverse(function (m) {
    if (!m.isMesh) return;
    if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
    m.material = standardMat(m.material);
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    meshes.push(m);
  });
  centerAndAdd(pivot, obj);
  var scanCode = '\nfloat scanT = (vScanY - uMinY) / max(1e-4, uMaxY - uMinY);\n' +
    'if (scanT > uScan) discard;\n' +
    'float d = abs(scanT - uScan);\n' +
    'float line = 1.0 - smoothstep(0.0, 0.035, d);\n' +
    'gl_FragColor.rgb += vec3(1.0, 0.98, 0.9) * line * 2.2;\n';
  meshes.forEach(function (m) {
    var minY = m.geometry.boundingBox.min.y, maxY = m.geometry.boundingBox.max.y, mat = m.material;
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uScan = { value: 0 }; shader.uniforms.uMinY = { value: minY }; shader.uniforms.uMaxY = { value: maxY };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vScanY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvScanY = transformed.y;');
      var fs = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vScanY;\nuniform float uScan;\nuniform float uMinY;\nuniform float uMaxY;');
      var idx = fs.lastIndexOf('}'); shader.fragmentShader = fs.slice(0, idx) + scanCode + fs.slice(idx);
      mat.userData.sh = shader;
    };
    mat.needsUpdate = true;
  });
  return function play(duration) {
    var t0 = performance.now();
    (function tick(now) {
      var p = Math.min(1, (now - t0) / duration), v = easeOut(p) * 1.08;
      meshes.forEach(function (m) { if (m.material.userData.sh) m.material.userData.sh.uniforms.uScan.value = v; });
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  };
}

// --- B: просто проявление снизу вверх, без подсветки -----------------------
function effectGrow(pivot, gltf) {
  var obj = gltf.scene.clone(true), meshes = [];
  obj.traverse(function (m) {
    if (!m.isMesh) return;
    if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
    m.material = standardMat(m.material);
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    meshes.push(m);
  });
  centerAndAdd(pivot, obj);
  var scanCode = '\nfloat scanT = (vScanY - uMinY) / max(1e-4, uMaxY - uMinY);\nif (scanT > uScan) discard;\n';
  meshes.forEach(function (m) {
    var minY = m.geometry.boundingBox.min.y, maxY = m.geometry.boundingBox.max.y, mat = m.material;
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uScan = { value: 0 }; shader.uniforms.uMinY = { value: minY }; shader.uniforms.uMaxY = { value: maxY };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vScanY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvScanY = transformed.y;');
      var fs = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vScanY;\nuniform float uScan;\nuniform float uMinY;\nuniform float uMaxY;');
      var idx = fs.lastIndexOf('}'); shader.fragmentShader = fs.slice(0, idx) + scanCode + fs.slice(idx);
      mat.userData.sh = shader;
    };
    mat.needsUpdate = true;
  });
  return function play(duration) {
    var t0 = performance.now();
    (function tick(now) {
      var p = Math.min(1, (now - t0) / duration), v = easeOut(p) * 1.05;
      meshes.forEach(function (m) { if (m.material.userData.sh) m.material.userData.sh.uniforms.uScan.value = v; });
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  };
}

// --- C: каркас → тело --------------------------------------------------
function effectWire(pivot, gltf) {
  var solidObj = gltf.scene.clone(true), wireObj = gltf.scene.clone(true);
  var solids = [], wires = [];
  solidObj.traverse(function (m) { if (!m.isMesh) return; if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals(); m.material = standardMat(m.material); m.material.transparent = true; m.material.opacity = 0; solids.push(m); });
  wireObj.traverse(function (m) {
    if (!m.isMesh) return;
    var edges = new THREE.EdgesGeometry(m.geometry, 20);
    var line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff5e1a, transparent: true, opacity: 1 }));
    line.position.copy(m.position); line.rotation.copy(m.rotation); line.scale.copy(m.scale);
    m.parent.add(line); wires.push(line);
    m.visible = false;
  });
  centerAndAdd(pivot, solidObj);
  pivot.add(wireObj);
  // центрируем второй объект так же, как первый (та же геометрия/бокс)
  wireObj.position.copy(solidObj.position);
  return function play(duration) {
    var t0 = performance.now();
    (function tick(now) {
      var p = Math.min(1, (now - t0) / duration), e = easeOut(p);
      solids.forEach(function (m) { m.material.opacity = e; });
      wires.forEach(function (l) { l.material.opacity = Math.max(0, 1 - p * 1.3); });
      if (p < 1) requestAnimationFrame(tick);
      else { solids.forEach(function (m) { m.material.transparent = false; m.material.opacity = 1; }); wires.forEach(function (l) { l.material.opacity = 0; }); }
    })(t0);
  };
}

// --- D: мерцание при подключении -------------------------------------------
function effectFlicker(pivot, gltf) {
  var obj = gltf.scene.clone(true), mats = [];
  obj.traverse(function (m) { if (!m.isMesh) return; if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals(); m.material = standardMat(m.material); m.material.transparent = true; m.material.opacity = 0; mats.push(m.material); });
  centerAndAdd(pivot, obj);
  return function play(duration) {
    var t0 = performance.now();
    var flickers = [.12, .22, .3, .42, .55, .72, 1.0];   // моменты вспышек/спадов на шкале 0..1
    (function tick(now) {
      var p = Math.min(1, (now - t0) / duration);
      var k = 0; while (k < flickers.length - 1 && p > flickers[k]) k++;
      var on = (k % 2 === 0);
      var op = p >= 1 ? 1 : (on ? Math.min(1, (p / flickers[0]) * .9 + .1 * (k > 0 ? 1 : 0)) : .15);
      if (p >= flickers[flickers.length - 2]) op = Math.min(1, (p - flickers[flickers.length - 2]) / (1 - flickers[flickers.length - 2]));
      mats.forEach(function (m) { m.opacity = op; });
      if (p < 1) requestAnimationFrame(tick); else mats.forEach(function (m) { m.transparent = false; m.opacity = 1; });
    })(t0);
  };
}

// --- E: деталь видна сразу, пробегает один блик -----------------------------
function effectPulse(pivot, gltf) {
  var obj = gltf.scene.clone(true), meshes = [];
  obj.traverse(function (m) {
    if (!m.isMesh) return;
    if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
    m.material = standardMat(m.material);
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    meshes.push(m);
  });
  centerAndAdd(pivot, obj);
  var scanCode = '\nfloat scanT = (vScanY - uMinY) / max(1e-4, uMaxY - uMinY);\n' +
    'float d = abs(scanT - uScan);\n' +
    'float line = 1.0 - smoothstep(0.0, 0.1, d);\n' +
    'gl_FragColor.rgb += vec3(1.0, 0.98, 0.9) * line * 1.1;\n';
  meshes.forEach(function (m) {
    var minY = m.geometry.boundingBox.min.y, maxY = m.geometry.boundingBox.max.y, mat = m.material;
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uScan = { value: -1 }; shader.uniforms.uMinY = { value: minY }; shader.uniforms.uMaxY = { value: maxY };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vScanY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvScanY = transformed.y;');
      var fs = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vScanY;\nuniform float uScan;\nuniform float uMinY;\nuniform float uMaxY;');
      var idx = fs.lastIndexOf('}'); shader.fragmentShader = fs.slice(0, idx) + scanCode + fs.slice(idx);
      mat.userData.sh = shader;
    };
    mat.needsUpdate = true;
  });
  return function play(duration) {
    var t0 = performance.now();
    (function tick(now) {
      var p = Math.min(1, (now - t0) / duration), v = -.15 + p * 1.3;
      meshes.forEach(function (m) { if (m.material.userData.sh) m.material.userData.sh.uniforms.uScan.value = v; });
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  };
}

var EFFECTS = { line: effectLine, grow: effectGrow, wire: effectWire, flicker: effectFlicker, pulse: effectPulse };

VARIANTS.forEach(function (v) {
  var card = buildCard(v);
  var stage = card.querySelector('.stage'), btn = card.querySelector('.replay');
  var ctx = setupScene(stage), play = null;
  loadModel().then(function (gltf) {
    play = EFFECTS[v.id](ctx.pivot, gltf);
    play(1100);
  });
  btn.addEventListener('click', function () { if (play) play(1100); });
});
