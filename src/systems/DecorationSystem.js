// src/systems/DecorationSystem.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class DecorationSystem {
    /**
     * @param {THREE.Scene} scene
     * @param {EnvironmentSystem} environmentSystem  // groundBounds 쓰려고
     */
    constructor(scene, environmentSystem) {
        this.scene = scene;
        this.environmentSystem = environmentSystem;

        this.loader = new GLTFLoader();

        this.rocks = [];   // 나중에 필요하면 들고 있고
        this.trees = [];

        this._spawned = false;  // groundBounds 생기면 한 번만 뿌릴 거라 플래그
    }

    update(delta) {
        // 아직 한 번도 안 뿌렸고, groundBounds 준비되었으면 실행
        if (!this._spawned) {
            const bounds = this.environmentSystem.getGroundBounds();
            if (bounds) {
                this._spawnAll(bounds);
                this._spawned = true;
            }
        }
    }

    _spawnAll(bounds) {
        // 원하면 개수 바꿔서 튜닝
        this._spawnRocks(bounds, 25);
        this._spawnTrees(bounds, 15);
    }

    _spawnRocks(bounds, count) {
        this.loader.load(
            'assets/models/rock.glb',
            (gltf) => {
                const base = gltf.scene;

                for (let i = 0; i < count; i++) {
                    const rock = base.clone(true);

                    // 위치 랜덤
                    const pos = this._randomPosInBounds(bounds, 1.0); // margin = 1.0
                    rock.position.set(pos.x, 0, pos.z);

                    // 회전/스케일 랜덤
                    rock.rotation.y = Math.random() * Math.PI * 2;
                    const s = THREE.MathUtils.randFloat(0.6, 1.4);
                    rock.scale.set(s, s, s);

                    rock.traverse((c) => {
                        if (c.isMesh) {
                            c.castShadow = true;
                            c.receiveShadow = true;
                        }
                    });

                    this.scene.add(rock);
                    this.rocks.push(rock);
                }
            }
        );
    }

    _spawnTrees(bounds, count) {
        this.loader.load(
            'assets/models/tree.glb',
            (gltf) => {
                const base = gltf.scene;

                for (let i = 0; i < count; i++) {
                    const tree = base.clone(true);

                    const pos = this._randomPosInBounds(bounds, 2.0); // 나무는 좀 더 margin
                    tree.position.set(pos.x, 0, pos.z);

                    tree.rotation.y = Math.random() * Math.PI * 2;
                    const s = THREE.MathUtils.randFloat(1.0, 2.0);
                    tree.scale.set(s, s, s);

                    tree.traverse((c) => {
                        if (c.isMesh) {
                            c.castShadow = true;
                            c.receiveShadow = true;
                        }
                    });

                    this.scene.add(tree);
                    this.trees.push(tree);
                }
            }
        );
    }

    _randomPosInBounds(bounds, margin = 0) {
        const minX = bounds.minX + margin;
        const maxX = bounds.maxX - margin;
        const minZ = bounds.minZ + margin;
        const maxZ = bounds.maxZ - margin;

        const x = THREE.MathUtils.randFloat(minX, maxX);
        const z = THREE.MathUtils.randFloat(minZ, maxZ);
        return new THREE.Vector3(x, 0, z);
    }
}
