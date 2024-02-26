import { DepthTexture } from "three";
import { THREE } from "../three-usage";

class Postprocessing {
    private readonly renderer: THREE.WebGLRenderer;
    private readonly renderTarget: THREE.WebGLRenderTarget;

    private readonly material: THREE.RawShaderMaterial;
    private readonly fullscreenQuad: THREE.Mesh;

    public constructor(renderer: THREE.WebGLRenderer) {
        this.renderer = renderer;

        const defaultWidth = 1;
        const defaultHeight = 1.
        this.renderTarget = new THREE.WebGLRenderTarget(defaultWidth, defaultHeight, {
            magFilter: THREE.LinearFilter,
            minFilter: THREE.LinearFilter,
            generateMipmaps: false,
            stencilBuffer: false,
            depthBuffer: true,
            depthTexture: new DepthTexture(defaultWidth, defaultHeight),
            samples: renderer.capabilities.isWebGL2 ? 4 : 0,
            colorSpace: renderer.outputColorSpace,
        });

        this.material = new THREE.RawShaderMaterial({
            uniforms: {
                uTexture: { value: this.renderTarget.texture },
                uDepth: { value: this.renderTarget.depthTexture },
                uTexelSize: { value: new THREE.Vector2(1, 1) },
                uCameraNear: { value: 0 },
                uCameraFar: { value: 1 },
            },
            vertexShader: `attribute vec2 aCorner;

            varying vec2 vUv;
            
            void main(void) {
                gl_Position = vec4(aCorner, 0.0, 1.0);
                vUv = 0.5 * aCorner + 0.5;
            }`,
            fragmentShader: `precision mediump float;

            #include <packing>

            uniform sampler2D uTexture;
            uniform sampler2D uDepth;
            uniform vec2 uTexelSize;
            uniform float uCameraNear;
            uniform float uCameraFar;
            
            varying vec2 vUv;
            
            float readDepth(const vec2 shift) {
                vec2 coords = vUv + shift * uTexelSize * 0.5;

				float fragCoordZ = texture2D(uDepth, coords).x;
				float viewZ = perspectiveDepthToViewZ(fragCoordZ, uCameraNear, uCameraFar);
				return viewZToOrthographicDepth(viewZ, uCameraNear, uCameraFar);
			}

            float computeSobel(const float fragDepth) {
                // kernel definition (in glsl matrices are filled in column-major order)
                const mat3 Gx = mat3(-1, -2, -1, 0, 0, 0, 1, 2, 1);// x direction kernel
                const mat3 Gy = mat3(-1, 0, 1, -2, 0, 2, -1, 0, 1);// y direction kernel

                float depth_mm = readDepth(vec2(-1,-1));
                float depth_m0 = readDepth(vec2(-1,+0));
                float depth_mp = readDepth(vec2(-1,+1));
                
                float depth_0m = readDepth(vec2(+0,-1));
                float depth_00 = fragDepth;
                float depth_0p = readDepth(vec2(+0,+1));

                float depth_pm = readDepth(vec2(+1,-1));
                float depth_p0 = readDepth(vec2(+1,+0));
                float depth_pp = readDepth(vec2(+1,+1));

                // gradient value in x direction
                float valueGx = Gx[0][0] * depth_mm + Gx[1][0] * depth_0m + Gx[2][0] * depth_pm +
                    Gx[0][1] * depth_m0 + Gx[1][1] * depth_00 + Gx[2][1] * depth_p0 +
                    Gx[0][2] * depth_mp + Gx[1][2] * depth_0p + Gx[2][2] * depth_pp;
            
                // gradient value in y direction
                float valueGy = Gy[0][0] * depth_mm + Gy[1][0] * depth_0m + Gy[2][0] * depth_pm +
                    Gy[0][1] * depth_m0 + Gy[1][1] * depth_00 + Gy[2][1] * depth_p0 +
                    Gy[0][2] * depth_mp + Gy[1][2] * depth_0p + Gy[2][2] * depth_pp;
            
                // magnitude of the total gradient
                return (valueGx * valueGx) + (valueGy * valueGy);
            }

            vec3 linearToSrgb(vec3 color) {
                // code de THREE.JS
                // Approximation http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html
                vec3 linearColor = color.rgb;
                vec3 S1 = sqrt(linearColor);
                vec3 S2 = sqrt(S1);
                vec3 S3 = sqrt(S2);
                color.rgb = 0.662002687 * S1 + 0.684122060 * S2 - 0.323583601 * S3 - 0.0225411470 * linearColor;
                return color;
            }

            void main(void) {
                vec4 sampleScene = texture2D(uTexture, vUv);
                // sampleScene.rgb = linearToSrgb(sampleScene.rgb);

                float fragDepth = readDepth(vUv);

                float outline = abs(computeSobel(fragDepth));
                const float limit = 0.05;
                float distance = smoothstep(0.0, limit, fragDepth);
                // outline *= 1.0 - distance;
                const float maxThreshold = 100000.0;
                const float minThreshold = 10.0;
                float outlineThreshold = clamp(mix(maxThreshold, minThreshold, 4.0 * distance), minThreshold, maxThreshold);
                sampleScene.rgb -= outlineThreshold * outline;

                gl_FragColor = sampleScene;
            }`,
        });
        const quadGeometry = new THREE.BufferGeometry();
        quadGeometry.setAttribute("aCorner", new THREE.Float32BufferAttribute([-1, +1, +1, +1, -1, -1, +1, -1], 2));
        quadGeometry.setIndex(new THREE.Uint16BufferAttribute([0, 2, 1, 2, 3, 1], 1));
        this.fullscreenQuad = new THREE.Mesh(quadGeometry, this.material);
        this.fullscreenQuad.frustumCulled = false;
    }

    public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
        this.enforceSize();

        const previousRendertarget = this.renderer.getRenderTarget();

        this.material.uniforms.uCameraNear.value = camera.near;
        this.material.uniforms.uCameraFar.value = camera.far;

        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.render(scene, camera);

        this.renderer.setRenderTarget(previousRendertarget);
        this.renderer.render(this.fullscreenQuad, camera);
    }

    public dispose(): void {
        this.fullscreenQuad.geometry.dispose();
        this.material.dispose();
        this.renderTarget.dispose();
    }

    private enforceSize(): void {
        const currentSize = new THREE.Vector2();
        this.renderer.getDrawingBufferSize(currentSize);

        if (currentSize.width !== this.renderTarget.width || currentSize.height !== this.renderTarget.height) {
            this.renderTarget.setSize(currentSize.width, currentSize.height);
            this.material.uniforms.uTexelSize.value = new THREE.Vector2(1 / currentSize.width, 1 / currentSize.height);
        }
    }
}

export {
    Postprocessing
};

