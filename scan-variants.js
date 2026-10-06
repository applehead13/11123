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
  { id: 'wire', title: '//Контур → тело', text: 'Сначала деталь не видна совсем, затем проявляется её каркас (рёбра), и он наполняется плотной поверхностью.' },
  { id: 'flicker', title: '//Подключение (мерцание)', text: 'Деталь полностью скрыта, затем появляется и пару раз мигает, набирая яркость — как подключение питания.' }
];

function buildCard(v) {
  var card = document.createElement('div'); card.className = 'card';
  card.innerHTML = '<h2>' + v.title + '</h2><p>' + v.text + '</p><div class="stage"></div>' +
    '<div class="row"><button type="button" class="replay">Запустить</button></div>';
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

  (function loop() {
    requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  })();

  return { scene: scene, camera: camera, pivot: pivot };
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
  var m = new THREE.MeshStandardMaterial({ map: src.map || null, color: src.color || 0xffffff, roughness: .55, metalness: .15, transparent: true, opacity: 0 });
  if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
  return m;
}
function easeOut(p) { return 1 - Math.pow(1 - p, 2); }

// --- каркас → тело -----------------------------------------------------
function effectWire(pivot, gltf) {
  var solidObj = gltf.scene.clone(true), wireObj = gltf.scene.clone(true);
  var solids = [], wires = [];
  solidObj.traverse(function (m) { if (!m.isMesh) return; if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals(); m.material = standardMat(m.material); solids.push(m); });
  wireObj.traverse(function (m) {
    if (!m.isMesh) return;
    var edges = new THREE.EdgesGeometry(m.geometry, 20);
    var line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff5e1a, transparent: true, opacity: 0 }));
    line.position.copy(m.position); line.rotation.copy(m.rotation); line.scale.copy(m.scale);
    m.parent.add(line); wires.push(line);
    m.visible = false;
  });
  centerAndAdd(pivot, solidObj);
  pivot.add(wireObj);
  wireObj.position.copy(solidObj.position);
  return function play(duration) {
    solids.forEach(function (m) { m.material.opacity = 0; });
    wires.forEach(function (l) { l.material.opacity = 0; });
    var t0 = performance.now();
    (function tick(now) {
      var p = Math.min(1, (now - t0) / duration), e = easeOut(p);
      solids.forEach(function (m) { m.material.opacity = e; });
      wires.forEach(function (l) { l.material.opacity = p < .15 ? p / .15 : Math.max(0, 1 - (p - .15) / .85 * 1.3); });
      if (p < 1) requestAnimationFrame(tick);
      else { solids.forEach(function (m) { m.material.opacity = 1; }); wires.forEach(function (l) { l.material.opacity = 0; }); }
    })(t0);
  };
}

// --- мерцание при подключении -------------------------------------------
function effectFlicker(pivot, gltf) {
  var obj = gltf.scene.clone(true), mats = [];
  obj.traverse(function (m) { if (!m.isMesh) return; if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals(); m.material = standardMat(m.material); mats.push(m.material); });
  centerAndAdd(pivot, obj);
  return function play(duration) {
    mats.forEach(function (m) { m.opacity = 0; });
    var t0 = performance.now();
    var flickers = [.12, .22, .3, .42, .55, .72, 1.0];   // моменты вспышек/спадов на шкале 0..1
    (function tick(now) {
      var p = Math.min(1, (now - t0) / duration);
      var k = 0; while (k < flickers.length - 1 && p > flickers[k]) k++;
      var on = (k % 2 === 0);
      var op = p >= 1 ? 1 : (on ? Math.min(1, (p / flickers[0]) * .9 + .1 * (k > 0 ? 1 : 0)) : .15);
      if (p >= flickers[flickers.length - 2]) op = Math.min(1, (p - flickers[flickers.length - 2]) / (1 - flickers[flickers.length - 2]));
      mats.forEach(function (m) { m.opacity = op; });
      if (p < 1) requestAnimationFrame(tick); else mats.forEach(function (m) { m.opacity = 1; });
    })(t0);
  };
}

var EFFECTS = { wire: effectWire, flicker: effectFlicker };

VARIANTS.forEach(function (v) {
  var card = buildCard(v);
  var stage = card.querySelector('.stage'), btn = card.querySelector('.replay');
  var ctx = setupScene(stage), play = null;
  loadModel().then(function (gltf) {
    play = EFFECTS[v.id](ctx.pivot, gltf);
  });
  btn.addEventListener('click', function () { if (play) play(1300); });
});
