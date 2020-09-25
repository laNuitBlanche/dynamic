let requestId = null;
const scroller = {
  target: document.querySelector("#scroll-container"),
  endY: 0,
  y: 0,
  resizeRequest: 1,
  scrollRequest: 0,
  _on: false,
  update: () => {
    const SCROLLER_EASE = .05;
    if (!scroller._on) return;
    const isResize = scroller.resizeRequest > 0;
    if (isResize) {
      const clientHeight = scroller.target.clientHeight;
      document.body.style.height = `${clientHeight}px`;
      scrollerController.maxTop = clientHeight;
      scroller.resizeRequest = 0;
    }
    const offsetTop = document.body.scrollTop || window.pageYOffset || document.documentElement.scrollTop;
    scroller.endY = offsetTop;
    scroller.y += (offsetTop - scroller.y) * SCROLLER_EASE;
    if (Math.abs(offsetTop - scroller.y) < .05 || isResize) {
      scroller.y = offsetTop;
      scroller.scrollRequest = 0;
    }
    TweenMax.set(scroller.target, {
      y: -scroller.y,
      onUpdate: function () {
        scrollerController.updateScroll(-this.vars.y)
      }
    });
    requestId = scroller.scrollRequest > 0 ? requestAnimationFrame(scroller.update) : null;
  },
  on: () => {
    if (scroller._on) return;
    scroller._on = true;
    document.body.className = "assist-scroll";
    scroller.resizeRequest = 1;
    requestId = requestAnimationFrame(scroller.update);
  },
  off: () => {
    if (!scroller._on) return;
    scroller._on = false;
    TweenMax.killTweensOf(scroller.target);
    document.body.className = "";
    document.body.style.height = "";
    scroller.target.style.transform = "";
  }
};
const scrollerController = {
  _top: document.body.scrollTop || window.pageYOffset || document.documentElement.scrollTop,
  top: document.body.scrollTop || window.pageYOffset || document.documentElement.scrollTop,
  maxTop: document.documentElement.scrollHeight - (window.innerHeight || document.documentElement.clientHeight),
  delta: 0,
  _width: 0,
  _height: 0,
  width: window.innerWidth || document.documentElement.clientWidth,
  height: window.innerHeight || document.documentElement.clientHeight,
  updates: {},
  _update_id: 0,
  addUpdate: event => {
    scrollerController.updates[++scrollerController._update_id] = event;
    return scrollerController._update_id;
  },
  deleteUpdate: e => {
    delete scrollerController.updates[e]
  },
  updateScroll: (offsetTop = document.body.scrollTop || window.pageYOffset || document.documentElement.scrollTop) => {
    scrollerController._top = scrollerController.top;
    scrollerController.top = offsetTop;
    scrollerController.delta = scrollerController.top - scrollerController._top;
    if (Math.abs(scrollerController.delta) > 200) {
      scrollerController.delta = 0;
    }
    for (const e in scrollerController.updates) {
      if (scrollerController.updates.hasOwnProperty(e) && typeof scrollerController.updates[e] === "function") {
        scrollerController.updates[e]("scroll");
      }
    }
  },
  update: (event = "resize") => {
    if (scroller._on) {
      scroller.scrollRequest++;
      requestId = requestId || requestAnimationFrame(scroller.update);
    }
    if (event === "scroll") {
      if (scroller._on) return;
      scrollerController.updateScroll()
    } else {
      scrollerController._width = scrollerController.width;
      scrollerController._height = scrollerController.height;
      scrollerController.width = window.innerWidth || document.documentElement.clientWidth;
      scrollerController.height = window.innerHeight || document.documentElement.clientHeight;
      scroller._on
        ? scroller.resizeRequest = 1
        : scrollerController.maxTop = document.documentElement.scrollHeight - scrollerController.height;
      scrollerController.width < 1024
        ? scroller.off()
        : scroller.on();
    }
    for (const t in scrollerController.updates) {
      if (scrollerController.updates.hasOwnProperty(t) && typeof scrollerController.updates[t] === "function") {
        scrollerController.updates[t](event)
      }
    }
  },
  lerp: (_top, top, rate) => {
    return (1 - rate) * _top + rate * top
  },
  loadScript(url, cb) {
    const script = document.createElement("script");
    if (script.readyState) {
      script.onreadystatechange = function () {
        if (script.readyState === "loader" || script.readyState === "complete") {
          script.onreadystatechange = null;
          cb();
        }
      }
    } else {
      script.onload = function () { cb() };
      script.src = url;
      document.getElementsByTagName("head")[0].appendChild(script);
    }
  }
};

class Cube {
  constructor() {
    this.materials = {};
    this.mixers = [];
    this.head = document.getElementById("head");
    this.first_update = true;
    this.height = 1.4 * scrollerController.height;
    this.top = -.2 * scrollerController.height + "px";
  }

  init() {
    this.initScene();
    this.initCamera();
    this.initRenderer();
    this.initBloomGlow();
    this.initLights();
    this.load();
    scrollerController.addUpdate(e => {
      this.update(e)
    })
  }

  initScene() {
    this.scene = new THREE.Scene;
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(45, scrollerController.width / this.height, 1, 1e3);
    this.camera.position.set(0, .5, 5)
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(scrollerController.width, this.height);
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.LinearToneMapping;
    this.renderer.toneMappingExposure = Math.pow(.94, 5);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.id = "cube";
    this.renderer.domElement.style.position = "fixed";
    this.renderer.domElement.style.top = 0;
    this.renderer.domElement.style.left = 0;
    document.body.appendChild(this.renderer.domElement);
  }
  initBloomGlow() {
    this.bloomLayer = new THREE.Layers;
    this.bloomLayer.set(1);
    const e = new THREE.RenderPass(this.scene, this.camera);
    new THREE.ShaderPass(THREE.CopyShader).renderToScreen = true;
    const t = new THREE.UnrealBloomPass(new THREE.Vector2(scrollerController.width, this.height), 2, 1, 0);
    this.bloomComposer = new THREE.EffectComposer(this.renderer);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(e);
    this.bloomComposer.addPass(t);
    const s = new THREE.ShaderPass(new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: this.bloomComposer.renderTarget2.texture }
      },
      vertexShader: document.getElementById("vertexshader").textContent,
      fragmentShader: document.getElementById("fragmentshader").textContent,
      defines: {}
    }), "baseTexture");
    s.needsSwap = true;
    this.finalComposer = new THREE.EffectComposer(this.renderer);
    this.finalComposer.addPass(e);
    this.finalComposer.addPass(s);
    this.darkMaterial = new THREE.MeshBasicMaterial({ color: "black" })
  }
  initControlls() {
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.rotateSpeed = .3;
    this.controls.zoomSpeed = .9;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 5;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = .05;
    this.controls.target.set(0, 1.2, 0);
    this.controls.target.set(0, 1.2, 0);
    this.controls.dispose();
    this.controls.update();
    this.onDocumentMouseMove = event => {
      const t = {
        clientX: (event.clientX - scrollerController.width / 2) / 5,
        clientY: (event.clientY - this.height / 2) / 5
      };
      this.controls.handleMouseMoveRotate(t)
    };
    document.addEventListener("mousemove", event => {
      this.onDocumentMouseMove(event)
    }, false)
  }
  initLights() {
    const directionalLight = new THREE.DirectionalLight(16777215, 1e3);
    directionalLight.position.set(-10, 10, 0);
    directionalLight.target.position.set(-5, 0, 0);
    this.scene.add(directionalLight);
    this.scene.add(directionalLight.target)
  }
  load() {
    const loader = new THREE.GLTFLoader;
    loader.crossOrigin = true;
    loader.load(
      "/assets/cube.glb",
      // called when the resource is loaded
      gltf => {
        const t = gltf.scene;
        t.children[13].material = new THREE.MeshBasicMaterial({ color: 0x49b1f5 }); // 设置中心实体材质及颜色
        t.children[13].layers.enable(1);
        t.remove(t.getObjectByName(t.children[5].name));
        t.remove(t.getObjectByName(t.children[4].name));
        t.remove(t.getObjectByName(t.children[0].name));
        this.scene.add(t);
        for (let i = 0, length = gltf.animations.length; i < length; i++) {
          const o = new THREE.AnimationMixer(t);
          this.mixers.push(o);
          o.clipAction(gltf.animations[i]).play();
        }
      },
      // called while loading is progressing
      xhr => {
        const t = xhr.total ? xhr.total : 78252;
        scrollerController.loaded()
        xhr.loaded === t && (this.initControlls(), this.render())
      },
      // called when loading has errors
      err => { console.log(`An error happened:${err}`) }
    )
  }

  render() {
    requestAnimationFrame(() => { this.render() });
    if (this.off_screen) return;
    this.scene.traverse(e => {
      if (e.isMesh && this.bloomLayer.test(e.layers) === false) {
        this.materials[e.uuid] = e.material;
        e.material = this.darkMaterial;
      }
    });
    this.bloomComposer.render();
    this.scene.traverse(e => {
      if (!this.materials[e.uuid]) return;
      e.material = this.materials[e.uuid];
      delete this.materials[e.uuid];
    });
    this.finalComposer.render();
    let top = scrollerController.top / (.66667 * this.head.clientHeight);
    top = top < 0 ? 0 : top > 1.4999 ? 1.4999 : top;
    const _rate = scrollerController.width < 1024 ? .5 : 0;
    let rate = _rate && top < .1 ? top * _rate * 10 : _rate;
    if (top > 0.5) {
      rate = 2 * (top - .5) + _rate;
    }
    if (rate < 2) {
      this.controls.target.set(0, 1.2 - 3 * rate, 0);
      this.controls.update();
    }
    for (let i = 0, length = this.mixers.length; i < length; ++i) {
      this.mixers[i].setTime(top);
    }
  }

  update(event) {
    if (event !== 'resize') {
      return this.off_screen = scrollerController.top > this.head.clientHeight
    }
    if (scrollerController.width < 1024 && scrollerController.width === scrollerController._width && scrollerController.height !== scrollerController._height) {
      return;
    }
    if (scrollerController.width < 1024) {
      this.height = 1.4 * scrollerController.height;
      this.camera.fov = 100;
    } else {
      this.height = scrollerController.height;
      this.camera.fov = 45;
      this.camera.aspect = scrollerController.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(scrollerController.width, this.height);
      this.bloomComposer.setSize(scrollerController.width, this.height);
      this.finalComposer.setSize(scrollerController.width, this.height);
    }
  }
}
scrollerController.loaded = () => {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  scrollerController._top = document.body.scrollTop || window.pageYOffset || document.documentElement.scrollTop;
  scrollerController.top = scrollerController._top;
  document.body.style.height = "auto";
  document.body.style.overflow = "auto";
  TweenMax.set(scroller.target, { rotation: .001, force3D: true });
  window.onresize = () => scrollerController.update();
  window.onscroll = () => scrollerController.update("scroll");
  scrollerController.update()
};
const cube = new Cube;
cube.init();
const pixi = {
  onloadedpixi: [],
  off: true,
  loaded: false,
  load: () => {
    if (scrollerController.width >= 1024) {
      scrollerController.deleteUpdate(pixi.id);
      scrollerController.loadScript("/src/pixi.min.js", pixi.init);
    }
  },
  init: () => {
    PIXI.utils.skipHello();
    pixi.app = new PIXI.Application({
      width: scrollerController.width,
      height: scrollerController.height,
      antialias: true,
      transparent: true,
      passiveWheel: true
    });
    pixi.app.view.style.position = "fixed";
    pixi.app.view.style.top = "0";
    pixi.app.view.style.left = "0";
    pixi.canvas = document.body.appendChild(pixi.app.view);
    pixi.canvas.style.pointerEvents = "none";
    pixi.container = new PIXI.Container;
    pixi.container.filterArea = pixi.app.screen;
    pixi.app.stage.interactive = true;
    pixi.app.stage.filterArea = pixi.app.screen;
    pixi.app.stage.addChild(pixi.container);
    pixi.distortion = 18;
    pixi.shader = document.querySelector("#shaderFrag").textContent;
    pixi.filter = new PIXI.Filter(null, pixi.shader);
    pixi.filter.uniforms.frequency = 100 / (1.05 * scrollerController.width / 100);
    pixi.filter.uniforms.amplitude = 0;
    pixi.filter.uniforms.amplitudeY = .05;
    pixi.filter.uniforms.amplitudeX = 1;
    pixi.filter.uniforms.speed = 1;
    pixi.filter.uniforms.time = 2;
    pixi.filter.padding = 50;
    pixi.container.filters = [pixi.filter];
    pixi.onloadedpixi.forEach(e => { e() });
    pixi.loaded = true;
    pixi.update("resize");
    scrollerController.addUpdate(pixi.update);
  }
};
pixi.id = scrollerController.addUpdate(pixi.load);
pixi.update = event => {
  if (event === "resize") {
    if (scrollerController.width < 1024) {
      if (pixi.off) return;
      pixi.off = true;
      pixi.app.view.style.display = "none";
      pixi.app.renderer.plugins.interaction.destroy();
      return;
    }
    if (pixi.off) {
      pixi.off = false;
      pixi.app.view.style.display = "block";
      pixi.app.renderer.plugins.interaction = new PIXI.interaction.InteractionManager(pixi.app.renderer)
    }
    pixi.app.renderer.resize(scrollerController.width, scrollerController.height);
    pixi.distortion = 100 / (1.05 * scrollerController.width / 100);
    pixi.filter.uniforms.frequency = pixi.distortion;
  } else {
    if (pixi.off) return;
    let t = scrollerController.lerp(scrollerController._top, scrollerController.top, .065);
    s = (t = Math.floor(100 * t) / 100, scrollerController.height, scrollerController.width);
    i = +(scrollerController.top - t) / s;
    TweenMax.to(pixi.filter.uniforms, 1, { amplitudeY: i * pixi.distortion / 42.5 * -3 })
  }
};