import { Debouncer } from "./helpers/debouncer";
import { OrbitControls, Stats, THREE } from "./three-usage";
import { Time } from "./helpers/time/time";
// import { GUI } from "dat.gui";
import { Terrain } from "./terrain/terrain";
import { computeGeometryStats } from "./helpers/geometry-stats";


class Engine {
    private readonly renderer: THREE.WebGLRenderer;
    private readonly camera: THREE.PerspectiveCamera;
    private readonly cameraControl: OrbitControls;
    private readonly scene: THREE.Scene;
    private readonly terrain: Terrain;

    private readonly stats: Stats;
    // private readonly gui: GUI;

    public constructor() {
        this.stats = new Stats();
        document.body.appendChild(this.stats.dom);

        // this.gui = new GUI();

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
            alpha: false,
            stencil: false,
            preserveDrawingBuffer: false,
        });
        console.debug(`Is WebGL2: ${this.renderer.capabilities.isWebGL2}`);

        this.renderer.setClearColor(0x000000);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.x = 100;
        this.camera.position.y = 50;
        this.camera.position.z = 100;
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));

        const udpateRendererSize = new Debouncer(() => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            this.renderer.setSize(width, height);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }, 50);
        window.addEventListener("resize", () => udpateRendererSize.run());
        udpateRendererSize.run();

        document.body.appendChild(this.renderer.domElement);

        this.cameraControl = new OrbitControls(this.camera, this.renderer.domElement);
        this.cameraControl.enablePan = true;
        this.cameraControl.enableDamping = true;
        this.cameraControl.dampingFactor = 0.05;

        this.scene = new THREE.Scene();
        this.terrain = new Terrain();
        this.scene.add(this.terrain.group);
        computeGeometryStats(this.scene);
    }

    public start(): void {
        Time.initialize(performance.now());
        this.scheduleNextUpdate();
    }

    private scheduleNextUpdate(): void {
        requestAnimationFrame(() => this.mainLoop());
    }

    private mainLoop(): void {
        this.stats.update();
        const deltaTime = Time.clock.setNow(performance.now());

        this.cameraControl.update(deltaTime);
        this.render();

        this.scheduleNextUpdate();
    }

    private render(): void {
        this.renderer.render(this.scene, this.camera);
    }
}

export {
    Engine
};

