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

        // 성벽 객체들 보관
        this.wallSegments = [];
        this.wallCorners = [];

        // 배경색 보간
        this.currentColor = new THREE.Color(0x000000);
        this.targetColor = new THREE.Color(0x000000);
        this.lerpSpeed = 2.0;

        // 모드 정의 (전부 glb 기반)
        this.modes = {
            grassland: {
                bg: new THREE.Color(0x200010),
                modelPath: 'assets/textures/ground_grass.glb',
            },
            // below modes are not used now
            wasteland: {
                bg: new THREE.Color(0xffb266),
                modelPath: 'assets/textures/ground_grass.glb',
            },
            hell: {
                bg: new THREE.Color(0x200010),
                modelPath: 'assets/textures/ground_grass.glb',
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

                // 🔥 ground 바운드에 맞춰 성벽 + 코너 재구성
                this._rebuildWalls();
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

    // ============================
    // Wall System
    // ============================

    _clearWalls() {
        if (this.wallSegments) {
            this.wallSegments.forEach(w => {
                if (w.parent) this.scene.remove(w);
            });
        }
        if (this.wallCorners) {
            this.wallCorners.forEach(c => {
                if (c.parent) this.scene.remove(c);
            });
        }
        this.wallSegments = [];
        this.wallCorners  = [];
    }

    _rebuildWalls() {
        // 기존 것부터 제거
        this._clearWalls();

        if (!this.groundBounds) return;

        const { minX, maxX, minZ, maxZ } = this.groundBounds;
        const width = maxX - minX;
        const depth = maxZ - minZ;

        const wallPath   = 'assets/models/wall_origin.glb';         // 경로는 프로젝트 구조에 맞게 수정
        const cornerPath = 'assets/models/wall_corner_origin.glb';
        const frontDoorPath = 'assets/models/front_door_closed.glb';
        const backDoorPath  = 'assets/models/back_door_closed.glb';

        const loadGLB = (path) =>
            new Promise((resolve, reject) => {
                this.gltfLoader.load(
                    path,
                    (gltf) => resolve(gltf.scene),
                    undefined,
                    reject
                );
            });

        Promise.all([loadGLB(wallPath), loadGLB(cornerPath), loadGLB(frontDoorPath), loadGLB(backDoorPath)])
            .then(([wallBase, cornerBase, frontDoor, backDoor]) => {
                const wallScale = 5;

                wallBase.scale.set(wallScale, wallScale, wallScale);
                cornerBase.scale.set(wallScale, wallScale, wallScale);

                // 공통 그림자 옵션
                const enableShadows = (obj) => {
                    obj.traverse((c) => {
                        if (c.isMesh) {
                            c.castShadow = true;
                            c.receiveShadow = true;
                        }
                    });
                };
                enableShadows(wallBase);
                enableShadows(cornerBase);

                // 🔥 wall 한 조각의 "긴 축" 길이 측정
                const tmpBox = new THREE.Box3().setFromObject(wallBase);
                const size   = new THREE.Vector3();
                tmpBox.getSize(size);

                // 한 변을 몇 개 segment로 나눌지 (원하는 밀도로 조정)
                const targetSegCountX = 20;
                const targetSegCountZ = 20;

                const stepX = width / targetSegCountX;
                const stepZ = depth / targetSegCountZ;

                // Y 위치는 지면 바로 위, prevent z-fighting 위해 약간 올리기
                const y = 0.01;  // 지면 높이(필요하면 this.ground.position.y 사용)

                this.wallSegments = [];
                this.wallCorners  = [];

                // 🔹 남/북 방향 (x만 변하고 z 고정)
                // index : 1 ~ N-1 (코너 제외)
                for (let i = 1; i < targetSegCountX - 1; i++) {
                    const px = minX + (i + 0.5) * stepX;
                    
                    // 남쪽 (minZ)
                    const south = wallBase.clone(true);
                    south.position.set(px, y, minZ);
                    south.rotation.y = 0; // ✅ wall.glb가 X+ 방향으로 놓였다고 가정
                    this.scene.add(south);
                    this.wallSegments.push(south);

                    // 북쪽 (maxZ)
                    const north = wallBase.clone(true);
                    north.position.set(px, y, maxZ);
                    north.rotation.y = Math.PI; // 반대 방향
                    this.scene.add(north);
                    this.wallSegments.push(north);
                }

                // 🔹 서/동 방향 (z만 변하고 x 고정)
                // index : 1 ~ N-1 (코너 제외)
                for (let i = 1; i < targetSegCountZ - 1; i++) {
                    const pz = minZ + (i + 0.5) * stepZ;

                    // 서쪽 (minX)
                    const west = wallBase.clone(true);
                    west.position.set(minX, y, pz);
                    west.rotation.y = -Math.PI / 2;
                    this.scene.add(west);
                    this.wallSegments.push(west);

                    // 동쪽 (maxX)
                    const east = wallBase.clone(true);
                    east.position.set(maxX, y, pz);
                    east.rotation.y = Math.PI / 2;
                    this.scene.add(east);
                    this.wallSegments.push(east);
                }

                // 🔥 코너 4개
                const corners = [
                    { x: minX, z: minZ, rotY: 0 },            // 남서
                    { x: maxX, z: minZ, rotY: -Math.PI/2 },   // 남동
                    { x: maxX, z: maxZ, rotY: Math.PI },      // 북동
                    { x: minX, z: maxZ, rotY: Math.PI/2 },    // 북서
                ];

                console.log('Corners:', corners);

                for (const c of corners) {
                    const corner = cornerBase.clone(true);
                    corner.position.set(c.x, y, c.z);
                    corner.rotation.y = c.rotY;
                    this.scene.add(corner);
                    this.wallCorners.push(corner);
                }

                console.log('Walls + corners created:', this.wallSegments.length, this.wallCorners.length);
            })
            .catch((err) => {
                console.error('Failed to build walls:', err);
            });
    }



}
