// entities/Player.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Character } from './Character.js';

export class Player extends Character {
    constructor(scene, ground) {
        super(scene);
        this.ground = ground;
        // 임시 메쉬 높이 때문에 기본 offset을 0.5로 둠; 모델 로드 후 보정함
        this.modelBaseOffset = 0.5;

        // 임시 메쉬 (로딩 중)
        const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
        const playerMaterial = new THREE.MeshLambertMaterial({ color: 0x0099ff });
        this.mesh = new THREE.Mesh(playerGeometry, playerMaterial);
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);

        // 애니메이션 관련
        this.mixer = null;
        this.actions = {};
        this.currentAction = null;
        this.model = null;
        this.isModelLoaded = false;

        this.speed = 5;        // m/s
        this.runMultiplier = 2;
        this.jumpSpeed = 8;
        this.velocityY = 0;
        this.isGrounded = true;

        this.cameraOffset = new THREE.Vector3(0, 2, 10);

        // 캐릭터 회전 관련
        this.targetRotation = 0;  // 목표 회전각
        this.rotationSpeed = 10;  // 회전 속도 (높을수록 빠름)

        // 모델 로드
        this._loadModel();
    }

    _loadModel() {
        const loader = new GLTFLoader();
        loader.load(
            './assets/models/rengokuAction.glb',
            (gltf) => {
                this.model = gltf.scene;

                // 기존 박스 제거
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
                this.scene.add(this.mesh);

                // 모델 하단을 y=0(발이 바닥)에 맞추기
                const bbox = new THREE.Box3().setFromObject(this.model);
                const minY = bbox.min.y;
                if (minY !== 0) {
                    this.model.position.y -= minY;
                }
                // 보정했으니 base offset 제거
                this.modelBaseOffset = 0;

                // 애니메이션 설정
                this.mixer = new THREE.AnimationMixer(this.model);

                // 애니메이션 액션 생성
                gltf.animations.forEach((clip) => {
                    const action = this.mixer.clipAction(clip);
                    this.actions[clip.name] = action;
                    console.log('Animation loaded:', clip.name);
                });

                // 기본 애니메이션(Idle) 재생
                if (this.actions['Idle']) {
                    this.currentAction = this.actions['Idle'];
                    this.currentAction.play();
                }

                this.isModelLoaded = true;
                console.log('Player model loaded successfully');
            },
            (progress) => {
                console.log('Loading:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('Error loading player model:', error);
            }
        );
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

    getForwardVector() {
        const forward = new THREE.Vector3(
            -Math.sin(this.yaw),
            0,
            -Math.cos(this.yaw)
        );
        forward.normalize();
        return forward;
    }

    getRightVector() {
        const right = new THREE.Vector3(
            Math.cos(this.yaw),
            0,
            -Math.sin(this.yaw)
        );
        right.normalize();
        return right;
    }

    update(delta, input) {
        // 애니메이션 믹서 업데이트
        if (this.mixer) {
            this.mixer.update(delta);
        }

        // yaw/pitch는 input 쪽에서 업데이트됨
        this.yaw = input.yaw;
        this.pitch = input.pitch;

        const forward = this.getForwardVector();
        const right = this.getRightVector();

        let moveSpeed = this.speed;
        if (input.keys.shift) moveSpeed *= this.runMultiplier;

        const move = new THREE.Vector3();

        if (input.keys.w) move.add(forward);
        if (input.keys.s) move.addScaledVector(forward, -1);
        if (input.keys.a) move.addScaledVector(right, -1);
        if (input.keys.d) move.add(right);

        const isMoving = move.lengthSq() > 0;

        if (isMoving) {
            move.normalize();
            move.multiplyScalar(moveSpeed * delta);
            this.mesh.position.add(move);
        }

        // 점프 (아주 간단한 버전, 나중에 물리로 바꿀 수 있음)
        if (input.keys.space && this.isGrounded) {
            this.velocityY = this.jumpSpeed;
            this.isGrounded = false;
        }

        this.velocityY -= 9.8 * delta; // 중력
        this.mesh.position.y += this.velocityY * delta;

        // 바닥에 붙이기
        const groundY = this.ground.position.y + (this.modelBaseOffset || 0);
        if (this.mesh.position.y <= groundY) {
            this.mesh.position.y = groundY;
            this.velocityY = 0;
            this.isGrounded = true;
        }

        // 캐릭터 회전 처리
        this._updateRotation(delta, input, isMoving);

        // 애니메이션 전환 로직
        this._updateAnimation(input, isMoving);

        this.updateCollider();
    }

    _updateRotation(delta, input, isMoving) {
        // 이동 중일 때 이동 방향에 따라 목표 회전각 설정
        if (isMoving) {
            let rotationOffset = 0;

            // WASD 조합에 따른 회전 오프셋 계산
            if (input.keys.w && !input.keys.a && !input.keys.d && !input.keys.s) {
                // W만: 앞
                rotationOffset = 0;
            } else if (input.keys.s && !input.keys.a && !input.keys.d && !input.keys.w) {
                // S만: 뒤
                rotationOffset = Math.PI;
            } else if (input.keys.a && !input.keys.w && !input.keys.s && !input.keys.d) {
                // A만: 왼쪽
                rotationOffset = Math.PI / 2;
            } else if (input.keys.d && !input.keys.w && !input.keys.s && !input.keys.a) {
                // D만: 오른쪽
                rotationOffset = -Math.PI / 2;
            } else if (input.keys.w && input.keys.a) {
                // W+A: 왼쪽 앞 대각선
                rotationOffset = Math.PI / 4;
            } else if (input.keys.w && input.keys.d) {
                // W+D: 오른쪽 앞 대각선
                rotationOffset = -Math.PI / 4;
            } else if (input.keys.s && input.keys.a) {
                // S+A: 왼쪽 뒤 대각선
                rotationOffset = Math.PI * 3 / 4;
            } else if (input.keys.s && input.keys.d) {
                // S+D: 오른쪽 뒤 대각선
                rotationOffset = -Math.PI * 3 / 4;
            }

            this.targetRotation = this.yaw + rotationOffset + Math.PI;
        } else {
            // 이동하지 않을 때는 카메라(yaw) 방향의 반대를 바라봄
            this.targetRotation = this.yaw + Math.PI;
        }

        // 부드럽게 회전 (lerp)
        let currentRotation = this.mesh.rotation.y;

        // 각도 차이 계산 (-PI ~ PI 범위로 정규화)
        let diff = this.targetRotation - currentRotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        // 부드러운 회전
        this.mesh.rotation.y += diff * this.rotationSpeed * delta;
    }

    _updateAnimation(input, isMoving) {
        if (!this.isModelLoaded) return;

        // 우선순위: 공격 > 점프 > 이동 > Idle

        // 마우스 클릭 (공격)
        if (input.mouseButtons.left) {
            this.playAnimation('MouseLeft', false);
            return;
        }
        if (input.mouseButtons.right) {
            this.playAnimation('MouseRight', false);
            return;
        }

        // 점프
        if (!this.isGrounded) {
            this.playAnimation('Jump', false);
            return;
        }

        // 이동
        if (isMoving) {
            this.playAnimation('Run', true);
            return;
        }

        // Idle
        this.playAnimation('Idle', true);
    }
}
