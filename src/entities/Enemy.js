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

        // 히트박스 참조
        this.hitBox = null;
        this.hitBoxCollider = new THREE.Box3();

        // 임시 메쉬 (로딩 중)
        const geom = new THREE.SphereGeometry(radius, 16, 16);
        const mat = new THREE.MeshStandardMaterial({ color });
        this.mesh = new THREE.Mesh(geom, mat);
        this.mesh.visible = false; // 모델 로드 전까지는 숨김
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

                // 기존 구체의 transform을 보존한 뒤 제거
                const prevPos = this.mesh.position.clone();
                const prevRot = this.mesh.rotation.clone();
                const prevScale = this.mesh.scale.clone();
                this.scene.remove(this.mesh);

                // 모델 설정
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }

                    // hitBox 찾아서 참조 저장 및 숨기기
                    if (child.name === 'hitBox') {
                        this.hitBox = child;
                        child.visible = false;
                        console.log('hitBox found and hidden');
                    }
                });

                // 모델에 원래 위치/회전/스케일 적용 (필요시 추가 조정)
                this.model.position.copy(prevPos);
                this.model.rotation.copy(prevRot);
                // 보통 GLTF에 이미 스케일이 있으므로 곱셈으로 유지
                this.model.scale.multiply(prevScale);
                // y 고정: 원래 구체는 groundY + radius로 세팅되어 있으므로 동일하게 유지
                this.model.position.y = this.groundY + this.radius;

                // 메쉬를 모델로 교체
                this.mesh = this.model;
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
        // 애니메이션 믹서는 항상 업데이트
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
        this.mesh.position.y = this.groundY;

        this._lookAtPlayer(player);
        this.updateCollider();
        this.updateHitBoxCollider();
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

    playAnimation(name, loop = true) {
        if (!this.isModelLoaded || !this.actions[name]) {
            return;
        }

        const newAction = this.actions[name];

        if (this.currentAction === newAction) {
            return;
        }

        // 이전 애니메이션 페이드아웃
        if (this.currentAction) {
            this.currentAction.fadeOut(0.2);
        }

        // 새 애니메이션 페이드인
        newAction.reset();
        newAction.fadeIn(0.2);
        newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);

        if (!loop) {
            newAction.clampWhenFinished = true;
        }

        newAction.play();
        this.currentAction = newAction;
    }

    updateHitBoxCollider() {
        if (this.hitBox) {
            this.hitBoxCollider.setFromObject(this.hitBox);
        }
    }
}
