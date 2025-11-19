// entities/Enemy.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Character } from './Character.js';

export class Enemy extends Character {
    /**
     * @param {THREE.Scene} scene
     * @param {THREE.Mesh} ground
     * @param {Object} options
     * @param {Function} onDeathCallback  // 🔹 추가: 죽을 때 호출할 콜백
     */
    constructor(scene, ground, options = {}, onDeathCallback = null) {
        super(scene);

        const {
            color = 0xff4444,
            radius = 0.7,
            maxHp = 50,
            moveSpeed = 3,
            chaseRange = 25,
            attackRange = 2,
            attackDamage = 5,
            attackCooldown = 1.0,
        } = options;

        this.maxHp = maxHp;
        this.hp = maxHp;

        this.moveSpeed = moveSpeed;
        this.chaseRange = chaseRange;
        this.attackRange = attackRange;
        this.attackDamage = attackDamage;
        this.attackCooldown = attackCooldown;

        // 적들은 y좌표 고정
        this.radius = radius;
        this.groundY = ground ? ground.position.y : 0;

        this.state = 'chase';

        // 애니메이션 관련
        this.mixer = null;
        this.actions = {};
        this.currentAction = null;
        this.model = null;
        this.isModelLoaded = false;

        // 임시 메쉬 (로딩 중)
        const geom = new THREE.SphereGeometry(radius, 16, 16);
        const mat = new THREE.MeshStandardMaterial({ color });
        this.mesh = new THREE.Mesh(geom, mat);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        const groundY = ground ? ground.position.y : 0;
        this.mesh.position.y = groundY + radius;

        scene.add(this.mesh);

        this._tmpDir = new THREE.Vector3();

        // 🔹 Character에 있는 콜백 필드에 연결
        this.onDeathCallback = onDeathCallback;

        // 모델 로드
        this._loadModel();
    }

    _loadModel() {
        const loader = new GLTFLoader();
        loader.load(
            './assets/models/Akaza.glb',
            (gltf) => {
                this.model = gltf.scene;

                // 기존 구체 제거
                this.scene.remove(this.mesh);

                // 모델 설정
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                // 모델 크기 조정 (필요시)
                this.model.scale.set(1, 1, 1);

                // 메쉬를 모델로 교체
                this.mesh = this.model;
                this.mesh.position.y = this.groundY + 0.5;
                this.scene.add(this.mesh);

                // 애니메이션 설정
                this.mixer = new THREE.AnimationMixer(this.model);

                // 애니메이션 액션 생성
                gltf.animations.forEach((clip) => {
                    const action = this.mixer.clipAction(clip);
                    this.actions[clip.name] = action;
                    console.log('Enemy animation loaded:', clip.name);
                });

                // 기본 애니메이션(Run) 재생
                if (this.actions['Run']) {
                    this.currentAction = this.actions['Run'];
                    this.currentAction.play();
                }

                this.isModelLoaded = true;
                console.log('Enemy model loaded successfully');
            },
            (progress) => {
                console.log('Enemy loading:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('Error loading enemy model:', error);
            }
        );
    }

    update(delta, player) {
        // 애니메이션 믹서 업데이트
        if (this.mixer) {
            this.mixer.update(delta);
        }

        if (!this.mesh || this.isDead()) {
            return;
        }

        const toPlayer = this._tmpDir;
        toPlayer.subVectors(player.mesh.position, this.mesh.position);

        // y좌표 무시
        toPlayer.y = 0;

        const distance = toPlayer.length();

        switch (this.state) {
            case 'chase':
                if (distance <= this.attackRange) {
                    this.state = 'attack';
                } else {
                    this._moveTowardsPlayer(delta, toPlayer);
                }
                break;

            case 'attack':
                if (distance > this.attackRange) {
                    this.state = 'chase';
                } 
                break;
        }
        // 🔥 이동 후에도 항상 지면 높이로 고정
        this.mesh.position.y = this.groundY + this.radius;

        this._lookAtPlayer(player);
        this.updateCollider();
    }

    _moveTowardsPlayer(delta, dir) {
        if (dir.lengthSq() === 0) return;
        dir.normalize();
        this.mesh.position.addScaledVector(dir, this.moveSpeed * delta);
    }

    _lookAtPlayer(player) {
        const pos = this.mesh.position;
        const target = player.mesh.position;
        const dx = target.x - pos.x;
        const dz = target.z - pos.z;
        const angle = Math.atan2(dx, dz);
        this.mesh.rotation.y = angle;
    }

    // 🔹 죽을 때 시각적인 처리 + 상위 콜백 호출
    die() {
        this.state = 'dead';
        if (this.mesh) {
            this.mesh.visible = false;
        }
        // Game으로 이벤트 전달
        super.die();
    }
}
