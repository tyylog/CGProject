// src/systems/EnvironmentSystem.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class EnvironmentSystem {
    /**
     * @param {THREE.Scene} scene
     * @param {THREE.WebGLRenderer} renderer
     * @param {THREE.Mesh} groundPlane  // 기존 Plane 바닥(있으면 제거하고 glb로 대체)
     */
    constructor(scene, renderer, groundPlane) {
        this.scene = scene;
        this.renderer = renderer;

        // 기존 plane 바닥(있으면 첫 glb 로딩 때 제거)
        this.baseGround = groundPlane || null;

        // 현재 활성 ground (어느 모드든 현재 씬에 올라가 있는 바닥)
        this.ground = groundPlane || null;

        // glb 로딩용
        this.gltfLoader = new GLTFLoader();
        this.groundModels = {};    // key: modeName -> Object3D (캐시)

        // 지면 바운드
        this.groundBounds = null;

        // 배경색 보간
        this.currentColor = new THREE.Color(0x000000);
        this.targetColor = new THREE.Color(0x000000);
        this.lerpSpeed = 2.0;

        // 모드 정의 (전부 glb 기반)
        this.modes = {
            grassland: {
                bg: new THREE.Color(0x87ceeb),
                modelPath: 'assets/textures/ground_grass.glb',
            },
            wasteland: {
                bg: new THREE.Color(0xffb266),
                modelPath: 'assets/textures/ground_dirt.jpg',
            },
            hell: {
                bg: new THREE.Color(0x200010),
                modelPath: 'assets/textures/ground_lava.glb',
            },
        };

        this.currentMode = 'grassland';

        // 초기 적용
        this.setMode(this.currentMode, true);
    }

    /** 모드 바꾸기 (즉시 또는 부드럽게) */
    setMode(name, instant = false) {
        const mode = this.modes[name];
        if (!mode) return;

        this.currentMode = name;
        this.targetColor.copy(mode.bg);

        // glb ground 전환
        this._setGLBGround(name, mode.modelPath);

        if (instant) {
            this.currentColor.copy(this.targetColor);
            this._applyColor();
        }
    }

    /**
     * modeName: 'grassland' | 'wasteland' | 'hell'
     * path: 해당 모드의 glb 파일 경로
     */
    _setGLBGround(modeName, path) {
        // 1) 기존 plane 바닥 있으면 제거 (한 번만)
        if (this.baseGround && this.baseGround.parent) {
            this.scene.remove(this.baseGround);
        }

        // 2) 현재 ground(glb/plane 무엇이든)가 씬에 있으면 제거
        if (this.ground && this.ground.parent) {
            this.scene.remove(this.ground);
        }

        // 3) 이미 로드된 glb가 캐시에 있으면 재사용
        const cached = this.groundModels[modeName];
        if (cached) {
            this.ground = cached;
            this.scene.add(this.ground);
            return;
        }

        // 4) 처음 로드하는 glb라면 GLTFLoader로 불러오기
        this.gltfLoader.load(
            path,
            (gltf) => {
                const model = gltf.scene;

                // 기본 그림자 + 텍스처 옵션
                model.traverse((c) => {
                    if (c.isMesh) {
                        c.castShadow = false;
                        c.receiveShadow = true;

                        const mat = c.material;
                        if (mat && mat.map) {
                            const tex = mat.map;
                            tex.wrapS = THREE.RepeatWrapping;
                            tex.wrapT = THREE.RepeatWrapping;

                            // 🔥 바닥 넓이에 비례해서 반복 횟수 늘리기
                            // (숫자는 직접 감으로 조절해보면 됨)
                            tex.repeat.set(10, 10);
                            tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
                            tex.needsUpdate = true;
                        }
                    }
                });

                // 🔥 바운딩 박스 계산
                const box = new THREE.Box3().setFromObject(model);
                const size = new THREE.Vector3();
                box.getSize(size);

                // 중앙이 y=0에 오도록 보정
                model.position.y = -box.max.y;

                // 🔥 여기서 스케일 다시 키우기 (맵 크기)
                const scaleXZ = 10;  // 20~50 사이 왔다갔다 하면서 맞춰보면 좋음
                model.scale.set(scaleXZ, 1, scaleXZ);

                model.position.x = 0;
                model.position.z = 0;

                // 기존 ground 제거
                if (this.ground && this.ground.parent) {
                    this.scene.remove(this.ground);
                }

                this.groundModels[modeName] = model;
                this.ground = model;
                this.scene.add(model);

                // 🔥 월드 기준 바운드 계산해서 저장
                model.updateWorldMatrix(true, true);
                const worldBox = new THREE.Box3().setFromObject(model);
                this.groundBounds = {
                    minX: worldBox.min.x,
                    maxX: worldBox.max.x,
                    minZ: worldBox.min.z,
                    maxZ: worldBox.max.z,
                };
            }
        );


    }

    /** 매 프레임 배경색 보간 */
    update(delta) {
        this.currentColor.lerp(this.targetColor, this.lerpSpeed * delta);
        this._applyColor();
    }

    _applyColor() {
        this.scene.background = this.currentColor;
        this.renderer.setClearColor(this.currentColor, 1.0);
    }

    getGroundBounds() {
        return this.groundBounds;
    }

}
