import { GUI } from "dat.gui";
import { Debouncer } from "./helpers/debouncer";
import { computeGeometryStats } from "./helpers/geometry-stats";
import { Time } from "./helpers/time/time";
import { getUrlNumber } from "./helpers/url-param";
import { Postprocessing } from "./postprocessing/postprocessing";
import { VoxelMap } from "./terrain/generation/voxel-map";
import { PatchFactoryBase } from "./terrain/patch/factory/factory-base";
import { EDisplayMode } from "./terrain/patch/patch";
import { EFactoryType, Terrain } from "./terrain/terrain";
import { OrbitControls, Stats, THREE } from "./three-usage";

class Engine {
    private readonly renderer: THREE.WebGLRenderer;
    private readonly camera: THREE.PerspectiveCamera;
    private readonly cameraControl: OrbitControls;
    private readonly scene: THREE.Scene;
    private readonly terrain: Terrain;
    private readonly postProcessing: Postprocessing;

    private readonly stats: Stats;
    private readonly gui: GUI;

    private readonly parameters = {
        factoryType: EFactoryType.MERGED_SPLIT,
        postprocessing: {
            enabled: true,
            outline: {
                enabled: true,
            },
        },
    };

    public constructor() {
        this.stats = new Stats();
        document.body.appendChild(this.stats.dom);

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
            alpha: false,
            stencil: false,
            preserveDrawingBuffer: false,
        });
        console.debug(`Is WebGL2: ${this.renderer.capabilities.isWebGL2}`);

        this.renderer.setClearColor(0x888888);

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
        this.cameraControl.enableDamping = false;
        this.cameraControl.dampingFactor = 0.05;

        this.scene = new THREE.Scene();
        this.scene.add(new THREE.AxesHelper(20));

        const mapWidth = getUrlNumber("mapwidth", 256);
        const mapHeight = getUrlNumber("mapheight", 256);
        const map = new VoxelMap(mapWidth, mapHeight, 16);
        this.terrain = new Terrain(map);
        this.scene.add(this.terrain.container);

        this.postProcessing = new Postprocessing(this.renderer);

        const applyEngine = (): void => {
            this.terrain.clear();
            this.terrain.computePatches(this.parameters.factoryType);
            computeGeometryStats(this.scene);
        };

        this.gui = new GUI();
        {
            const folder = this.gui.addFolder("Postprocessing");
            folder.open();
            folder.add(this.parameters.postprocessing, "enabled");
        }
        {
            const folder = this.gui.addFolder("Engine");
            folder.open();
            folder.add(this.parameters, "factoryType", { merged: EFactoryType.MERGED, instanced: EFactoryType.INSTANCED, merged_split: EFactoryType.MERGED_SPLIT }).onChange(applyEngine);

        }
        {
            const folder = this.gui.addFolder("Voxels");
            folder.open();
            folder.add(this.terrain.parameters.voxels, "displayMode", { texture: EDisplayMode.TEXTURES, normals: EDisplayMode.NORMALS, grey: EDisplayMode.GREY });
            folder.add(this.terrain.parameters.voxels, "noiseStrength", 0, 0.1);
        }
        {
            const folder = this.gui.addFolder("Lighting");
            folder.open();
            folder.add(this.terrain.parameters.lighting, "ambient", 0, 3);
            folder.add(this.terrain.parameters.lighting, "diffuse", 0, 3);
        }
        {
            const folder = this.gui.addFolder("Ambient occlusion");
            folder.open();
            folder.add(this.terrain.parameters.ao, "enabled");
            folder.add(this.terrain.parameters.ao, "strength", 0, 3);
            folder.add(this.terrain.parameters.ao, "spread", 0, 1);
        }
        {
            const folder = this.gui.addFolder("Smooth edges");
            folder.open();
            folder.add(this.terrain.parameters.smoothEdges, "enabled");
            folder.add(this.terrain.parameters.smoothEdges, "radius", 0, PatchFactoryBase.maxSmoothEdgeRadius);
            folder.add(this.terrain.parameters.smoothEdges, "quality", [0, 1, 2]);
        }

        applyEngine();
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
        this.terrain.updateUniforms();

        if (this.parameters.postprocessing.enabled) {
            this.postProcessing.render(this.scene, this.camera);
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

export {
    Engine
};

