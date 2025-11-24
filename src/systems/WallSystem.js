// src/systems/WallSystem.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class WallSystem {
    /**
     * @param {THREE.Scene} scene
     * @param {EnvironmentSystem} envSystem  // envSystem.ground을 사용할 거임
     */
    constructor(scene, envSystem) {
        this.scene = scene;
        this.envSystem = envSystem;

        this.loader = new GLTFLoader();

        this.wallSegments = [];
        this.cornerSegments = [];

        this._spawned = false;
    }

    update(delta) {
        if (this._spawned) return;

        // 🔹 EnvironmentSystem이 glb ground를 올려놓은 뒤에만 실행
        const ground = this.envSystem.ground;
        if (!ground) return;

        // ground의 실제 월드 바운딩 박스
        ground.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(ground);

        const bounds = {
            minX: box.min.x,
            maxX: box.max.x,
            minZ: box.min.z,
            maxZ: box.max.z,
        };

        this._spawned = true;
        this._buildWallsOnBounds(bounds);
    }

    async _buildWallsOnBounds(bounds) {
        // 1) 원본 glb 로드
        const wallBase = await this._loadGLB('assets/models/wall.glb');
        const cornerBase = await this._loadGLB('assets/models/wall_corner.glb');

        // 2) wall 한 조각의 원래 길이 (X축 기준이라고 가정)
        let box = new THREE.Box3().setFromObject(wallBase);
        let size = new THREE.Vector3();
        box.getSize(size);
        const originalSegLen = size.x;       // 모델이 z축 기준이면 size.z 로 바꾸기

        // 3) ground 한 변 길이
        const width = bounds.maxX - bounds.minX;
        const depth = bounds.maxZ - bounds.minZ;

        // 한 변에 몇 조각 둘지 대략 정하기 (취향에 맞게 조절)
        const targetSegCount = 16;           // → 한 변을 대충 16조각으로
        const targetSegLen   = width / targetSegCount;

        // 4) wall을 얼마나 키울지
        const scaleFactor = targetSegLen / originalSegLen;

        wallBase.scale.set(scaleFactor, scaleFactor, scaleFactor);
        cornerBase.scale.set(scaleFactor, scaleFactor, scaleFactor);

        // 5) 스케일 적용 후 다시 실제 segLen 계산
        wallBase.updateWorldMatrix(true, true);
        box = new THREE.Box3().setFromObject(wallBase);
        box.getSize(size);
        const segLen = size.x;               // 이제 이 값으로 타일링

        // 6) 실제 배치
        this._tileStraight(wallBase, bounds, segLen);
        this._placeCorners(cornerBase, bounds);
    }

    _loadGLB(path) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                path,
                (gltf) => {
                    const model = gltf.scene;
                    model.traverse((c) => {
                        if (c.isMesh) {
                            c.castShadow = true;
                            c.receiveShadow = true;
                        }
                    });
                    resolve(model);
                },
                undefined,
                reject
            );
        });
    }

    _tileStraight(wallBase, b, segLen) {
        const y = 0; // 지면 높이 (필요하면 envSystem.ground.position.y 써도 됨)

        const width = b.maxX - b.minX;
        const depth = b.maxZ - b.minZ;

        const numX = Math.floor(width / segLen);
        const numZ = Math.floor(depth / segLen);

        // 남/북 (z 고정, x만 변화)
        for (let i = 0; i < numX; i++) {
            const t = i / numX;
            const x = THREE.MathUtils.lerp(
                b.minX + segLen * 0.5,
                b.maxX - segLen * 0.5,
                t
            );

            // 남쪽 (z = minZ)
            const south = wallBase.clone(true);
            south.position.set(x, y, b.minZ);
            south.rotation.y = 0; // wall.glb가 X+ 방향으로 놓여있다고 가정
            this.scene.add(south);
            this.wallSegments.push(south);

            // 북쪽 (z = maxZ)
            const north = wallBase.clone(true);
            north.position.set(x, y, b.maxZ);
            north.rotation.y = Math.PI; // 반대로 뒤집기
            this.scene.add(north);
            this.wallSegments.push(north);
        }

        // 서/동 (x 고정, z만 변화)
        for (let i = 0; i < numZ; i++) {
            const t = i / numZ;
            const z = THREE.MathUtils.lerp(
                b.minZ + segLen * 0.5,
                b.maxZ - segLen * 0.5,
                t
            );

            // 서쪽 (x = minX)
            const west = wallBase.clone(true);
            west.position.set(b.minX, y, z);
            west.rotation.y = -Math.PI / 2;
            this.scene.add(west);
            this.wallSegments.push(west);

            // 동쪽 (x = maxX)
            const east = wallBase.clone(true);
            east.position.set(b.maxX, y, z);
            east.rotation.y = Math.PI / 2;
            this.scene.add(east);
            this.wallSegments.push(east);
        }
    }

    _placeCorners(cornerBase, b) {
        const y = 0;
        const corners = [
            { x: b.minX, z: b.minZ, rotY: 0 },              // 남서
            { x: b.maxX, z: b.minZ, rotY: Math.PI / 2 },    // 남동
            { x: b.maxX, z: b.maxZ, rotY: Math.PI },        // 북동
            { x: b.minX, z: b.maxZ, rotY: -Math.PI / 2 },   // 북서
        ];

        for (const c of corners) {
            const corner = cornerBase.clone(true);
            corner.position.set(c.x, y, c.z);
            corner.rotation.y = c.rotY;
            this.scene.add(corner);
            this.cornerSegments.push(corner);
        }
    }
}