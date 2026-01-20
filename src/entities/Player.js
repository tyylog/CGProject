// entities/Player.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Character } from './Character.js';
import { SwordTrail } from '../effects/SwordTrail.js';

export class Player extends Character {
    constructor(scene, ground, soundSystem = null, onBGMStopRequest = null) {
        super(scene);
        this.ground = ground;
        this.soundSystem = soundSystem;
        this.onBGMStopRequest = onBGMStopRequest;

        this.modelBaseOffset = 0.5;

        // 임시 메쉬 (로딩 중)
        const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
        const playerMaterial = new THREE.MeshLambertMaterial({ color: 0x0099ff });
        this.mesh = new THREE.Mesh(playerGeometry, playerMaterial);
        this.mesh.visible = false; // 로딩 중에는 안 보이게
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);

        // 애니메이션 관련
        this.mixer = null;
        this.actions = {};
        this.currentAction = null;
        this.model = null;
        this.isModelLoaded = false;

        // 공격 히트박스 참조
        this.attackHitbox = null;
        this.attackHitboxCollider = new THREE.Box3();

        // Strong 공격 히트박스 참조 (강공격용) - 6개
        this.strongHitboxes = [];
        this.strongHitboxColliders = [];
        for (let i = 0; i < 6; i++) {
            this.strongHitboxColliders.push(new THREE.Box3());
        }

        // 피격 히트박스 참조 (적의 공격을 맞는 용도)
        this.hitBox = null;
        this.hitBoxCollider = new THREE.Box3();

        // 검 메쉬 참조
        this.swordMesh = null;

        // 검 궤적 효과
        this.swordTrail = null;
        this.strongTrails = [];  // Strong 히트박스용 궤적 (6개)

        // 발 잔상 효과
        this.leftFootTrail = null;
        this.rightFootTrail = null;

        this.speed = 5;        // m/s
        this.runMultiplier = 2;
        this.jumpSpeed = 5;
        this.velocityY = 0;
        this.isGrounded = true;

        this.cameraOffset = new THREE.Vector3(0, 4, 5);

        // 캐릭터 회전 관련
        this.targetRotation = 0;  // 목표 회전각
        this.rotationSpeed = 10;  // 회전 속도 (높을수록 빠름)
        this.isAttacking = false;  // 공격 중 플래그 (이동 제한용)
        this.isAttackActive = false;  // 실제 공격 판정 활성화 플래그
        this.isHeavyAttack = false;  // 강공격 여부 (우클릭)
        this.isJumpAttack = false;  // JumpAttack 여부 (R키)
        this.heavyAttackCooldown = 3.0;  // 강공격 쿨타임 (초)
        this.heavyAttackTimer = 0;  // 현재 쿨타임 타이머
        this.jumpAttackCooldown = 15.0;  // JumpAttack 쿨타임 (초)
        this.jumpAttackTimer = 0;  // JumpAttack 현재 쿨타임 타이머
        this.isDying = false;  // 죽음 애니메이션 재생 중 플래그

        // Root Motion 추적용 (MouseRight 전용)
        this.rootMotionEnabled = false;
        this.rootBone = null;
        this.rootMotionStartPos = new THREE.Vector3();  // 애니메이션 시작 시 루트 본 월드 위치
        this.rootMotionStartPlayerPos = new THREE.Vector3();  // 애니메이션 시작 시 플레이어 위치

        // 스태미너 관련
        this.maxStamina = 100;
        this.stamina = this.maxStamina;
        this.staminaRegen = 15;    // 초당 회복량
        this.staminaUse = 25;      // 초당 소모량

        // 체력 포션 관련
        this.potionCount = 3;   // 기본 3개 (또는 0)
        this.potionHealAmount = 40;   // 물약 회복량
        this.potionStaminaAmount = 50; // 스태미너 회복량

        // 달리기 온/오프 문턱
        this.runStartThreshold = 10; // 이 이상이면 달리기 시작 가능
        this.runStopThreshold  = 0;  // 이 이하면 강제 걷기

        this.isRunning = false;

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

                    // attackHitbox 찾아서 참조 저장 및 숨기기
                    if (child.name === 'attackHitbox') {
                        this.attackHitbox = child;
                        child.visible = false;
                        console.log('attackHitbox found and hidden');

                        // 검 궤적 효과 초기화 (attackHitbox를 따라감)
                        this.swordTrail = new SwordTrail(this.scene, this.attackHitbox);
                        console.log('SwordTrail initialized with attackHitbox');
                    }

                    // sword 메쉬 찾아서 참조 저장
                    if (child.name === 'sword') {
                        this.swordMesh = child;
                        console.log('sword mesh found:', child);
                    }

                    // hitbox 찾아서 참조 저장 및 숨기기 (피격 판정용)
                    if (child.name === 'hitbox') {
                        this.hitBox = child;
                        child.visible = false;
                        console.log('hitbox found and hidden');
                    }

                    // leftfoot 오브젝트 숨기고 잔상 효과 추가 (항상 활성화)
                    if (child.name === 'leftfoot') {
                        child.visible = false;
                        this.leftFootTrail = new SwordTrail(this.scene, child, './assets/images/fire.png');
                        this.leftFootTrail.start();
                        console.log('leftfoot trail initialized');
                    }

                    // rightfoot 오브젝트 숨기고 잔상 효과 추가 (항상 활성화)
                    if (child.name === 'rightfoot') {
                        child.visible = false;
                        this.rightFootTrail = new SwordTrail(this.scene, child, './assets/images/fire.png');
                        this.rightFootTrail.start();
                        console.log('rightfoot trail initialized');
                    }

                    // Strong1~6 공격 히트박스 찾아서 참조 저장 및 숨기기 (강공격용)
                    const strongMatch = child.name.match(/^Strong(\d)$/);
                    if (strongMatch) {
                        const index = parseInt(strongMatch[1]) - 1;  // Strong1 -> index 0
                        this.strongHitboxes[index] = child;
                        child.visible = false;
                        console.log(`Strong${strongMatch[1]} hitbox found and hidden`);

                        // Strong 궤적 효과 초기화 (오프셋 4배)
                        const trail = new SwordTrail(this.scene, child, './assets/images/fire.png', { scale: 7.0 });
                        this.strongTrails[index] = trail;
                        console.log(`StrongTrail${strongMatch[1]} initialized`);
                    }
                });

                // 모델 크기 조정 (필요시)
                this.model.scale.set(1, 1, 1);

                // 루트 본 찾기 (Root Motion 추적용)
                this.model.traverse((child) => {
                    if (child.isBone && (child.name === 'mixamorigHips' || child.name === 'Hips' || child.name === 'Root')) {
                        this.rootBone = child;
                        console.log('Root bone found:', child.name);
                    }
                });

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

                // 애니메이션 종료 이벤트 리스너
                this.mixer.addEventListener('finished', (e) => {
                    const finishedAction = e.action;
                    const clipName = finishedAction.getClip().name;

                    // Death 애니메이션이 끝난 경우 → 무조건 제일 우선
                    if (clipName === 'Death') {
                        if (typeof this.onDeathCallback === 'function') {
                            this.onDeathCallback(this);
                        }
                        return;
                    }

                    // 🔥 이미 죽는 중이면, 다른 애니메이션 끝난 건 전부 무시
                    if (this.isDying) {
                        return;
                    }

                    // 공격/점프 끝나면 Idle로 복귀
                    if (clipName === 'MouseLeft' || clipName === 'MouseRight' || clipName === 'Jump' || clipName === 'JumpAttack') {
                        // MouseRight/JumpAttack 애니메이션 종료 시 루트 본의 최종 위치로 이동
                        if ((clipName === 'MouseRight' || clipName === 'JumpAttack') && this.rootMotionEnabled && this.rootBone) {
                            // 현재 루트 본의 월드 위치
                            const finalRootPos = new THREE.Vector3();
                            this.rootBone.getWorldPosition(finalRootPos);

                            // 시작 위치와 최종 위치의 차이 계산
                            const delta = finalRootPos.clone().sub(this.rootMotionStartPos);

                            // 플레이어 위치를 시작 위치 + 이동량으로 설정
                            this.mesh.position.x = this.rootMotionStartPlayerPos.x + delta.x;
                            this.mesh.position.z = this.rootMotionStartPlayerPos.z + delta.z;

                            this.rootMotionEnabled = false;

                            // 페이드 없이 즉시 Idle로 전환 (뒤로 가는 모션 방지)
                            this.playAnimation('Idle', true, 0);
                        } else {
                            this.playAnimation('Idle', true);
                        }
                        this.isAttacking = false;
                        this.isAttackActive = false;
                        this.isJumpAttack = false;

                        // 검 궤적 정지
                        if (this.swordTrail && (clipName === 'MouseLeft' || clipName === 'MouseRight')) {
                            this.swordTrail.stop();
                        }
                        // Strong 궤적 정지 (6개)
                        if (clipName === 'JumpAttack') {
                            for (const trail of this.strongTrails) {
                                if (trail) trail.stop();
                            }
                        }
                    }
                });


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

    playAnimation(name, loop = true, fadeTime = 0.2) {
        if (!this.isModelLoaded || !this.actions[name]) {
            return;
        }

        const newAction = this.actions[name];

        if (this.currentAction === newAction) {
            return;
        }

        // 이전 애니메이션 페이드아웃
        if (this.currentAction) {
            if (fadeTime === 0) {
                this.currentAction.stop();
            } else {
                this.currentAction.fadeOut(fadeTime);
            }
        }

        // 새 애니메이션 설정
        newAction.reset();
        newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);

        if (!loop) {
            newAction.clampWhenFinished = true;
        }

        // 공격 애니메이션은 1.3배 빠르게 재생
        if (name === 'MouseLeft' || name === 'MouseRight') {
            newAction.setEffectiveTimeScale(1.3);
        } else {
            newAction.setEffectiveTimeScale(1.0);
        }

        // fadeTime에 따라 전환 방식 결정
        if (fadeTime === 0) {
            // 즉시 전환 (T-pose 방지를 위해 weight를 1로 설정)
            newAction.setEffectiveWeight(1);
            newAction.play();
        } else {
            newAction.fadeIn(fadeTime).play();
        }
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

    die() {
        // 죽음 애니메이션 재생 (게임오버는 애니메이션 종료 후 호출됨)
        if (!this.isDying && this.isModelLoaded) {
            this.isDying = true;
            this.isAttacking = false;  // 공격 중이어도 강제 해제
            this.isAttackActive = false;  // 공격 판정 비활성화

            // 땅에 고정
            this.mesh.position.y = 0;

            // 배경음악 즉시 중지
            if (typeof this.onBGMStopRequest === 'function') {
                this.onBGMStopRequest();
            }

            this.playAnimation('Death', false);
            // 죽음 사운드 재생
            if (this.soundSystem) {
                this.soundSystem.playSFX('playerDeath');
            }
            
        }
        // onDeathCallback은 Death 애니메이션이 끝난 후 호출됨 (finished 이벤트에서)
    }

    update(delta, input) {
        // 애니메이션 믹서 업데이트
        if (this.mixer) {
            this.mixer.update(delta);
        }

        // 발 잔상 효과 업데이트
        if (this.leftFootTrail) {
            this.leftFootTrail.update(delta);
        }
        if (this.rightFootTrail) {
            this.rightFootTrail.update(delta);
        }

        // 검 궤적 업데이트
        if (this.swordTrail) {
            this.swordTrail.update(delta);
        }

        // Strong 궤적 업데이트 (6개)
        for (const trail of this.strongTrails) {
            if (trail) trail.update(delta);
        }

        // JumpAttack 애니메이션 60%에서 강제 종료
        if (this.isJumpAttack && this.actions['JumpAttack']) {
            const action = this.actions['JumpAttack'];
            const clip = action.getClip();
            const progress = action.time / clip.duration;

            if (progress >= 0.6) {
                // Root Motion 적용 (최종 위치로 이동)
                if (this.rootMotionEnabled && this.rootBone) {
                    const finalRootPos = new THREE.Vector3();
                    this.rootBone.getWorldPosition(finalRootPos);

                    const delta = finalRootPos.clone().sub(this.rootMotionStartPos);

                    this.mesh.position.x = this.rootMotionStartPlayerPos.x + delta.x;
                    this.mesh.position.z = this.rootMotionStartPlayerPos.z + delta.z;

                    this.rootMotionEnabled = false;
                }

                // 플래그 리셋
                this.isAttacking = false;
                this.isAttackActive = false;
                this.isJumpAttack = false;

                // Strong 궤적 정지 (6개)
                for (const trail of this.strongTrails) {
                    if (trail) trail.stop();
                }

                // Idle로 즉시 전환 (T-pose 방지)
                this.playAnimation('Idle', true, 0);
            }
        }

        // 죽은 상태에서는 입력 처리 안 함
        if (this.isDying) {
            this.updateCollider();
            return;
        }

        // 강공격 쿨타임 감소
        if (this.heavyAttackTimer > 0) {
            this.heavyAttackTimer -= delta;
        }

        // JumpAttack 쿨타임 감소
        if (this.jumpAttackTimer > 0) {
            this.jumpAttackTimer -= delta;
        }

        // yaw/pitch는 input 쪽에서 업데이트됨
        this.yaw = input.yaw;
        this.pitch = input.pitch;

        const forward = this.getForwardVector();
        const right = this.getRightVector();

        // --- 이동 벡터 계산 ---
        const move = new THREE.Vector3();

        // 공격 중이 아닐 때만 이동 가능
        if (!this.isAttacking) {
            if (input.keys.w) move.add(forward);
            if (input.keys.s) move.addScaledVector(forward, -1);
            if (input.keys.a) move.addScaledVector(right, -1);
            if (input.keys.d) move.add(right);
        }

        const isMoving   = move.lengthSq() > 0;
        const wantsToRun = input.keys.shift;   // Shift 입력 여부

        // --- 스태미너 / 달리기 상태 업데이트 ---
        // 상태 머신처럼: "현재 뛰는 중" / "현재 걷는 중" 을 기준으로 처리

        if (this.isRunning) {
            // 이미 달리는 중일 때: 스태미너 소모
            this.stamina -= this.staminaUse * delta;
            if (this.stamina < 0) this.stamina = 0;

            // 달리기 유지 조건 깨지면 걷기로 전환
            if (!isMoving || !wantsToRun || this.stamina <= this.runStopThreshold) {
                this.isRunning = false;
            }
        } else {
            // 걷는 중일 때: 스태미너 회복
            this.stamina += this.staminaRegen * delta;
            if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;

            // 달리기 시작 조건
            if (isMoving && wantsToRun && this.stamina >= this.runStartThreshold) {
                this.isRunning = true;
            }
        }

        // 실제 이동 속도 결정
        let moveSpeed = this.speed;
        if (this.isRunning) {
            moveSpeed *= this.runMultiplier;
        }

        // --- 위치 업데이트 ---
        if (isMoving) {
            move.normalize();
            move.multiplyScalar(moveSpeed * delta);
            this.mesh.position.add(move);
        }

        // 점프 (아주 간단한 버전, 나중에 물리로 바꿀 수 있음)
        if (input.keys.space && this.isGrounded && this.stamina >= 5) {
            this.velocityY = this.jumpSpeed;
            this.stamina -= 5;
            this.isGrounded = false;
        }

        // 중력 적용 및 y 위치 업데이트
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
        // attackHitboxCollider는 CombatSystem에서 필요할 때만 업데이트
    }


    _updateRotation(delta, input, isMoving) {
        // MouseRight 공격 중에는 회전 불가
        if (this.isAttacking) {
            return;
        }

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
        if (input.mouseButtons.left && !this.isAttacking) {
            // 이미 공격 중이 아닐 때만 새로운 공격 시작
            this.isAttacking = true;  // 이동 제한
            this.isAttackActive = true;  // 공격 판정 활성화
            this.isHeavyAttack = false;  // 일반 공격
            this.playAnimation('MouseLeft', false);
            // 검 궤적 시작
            if (this.swordTrail) {
                this.swordTrail.start();
            }
            // 공격 사운드 재생
            if (this.soundSystem) {
                this.soundSystem.playSFX('playerAttackLeft');
            }
            return;
        }
        if (input.mouseButtons.right && !this.isAttacking && this.heavyAttackTimer <= 0) {
            // 이미 공격 중이 아니고 쿨타임이 끝났을 때만 강공격 시작
            this.isAttacking = true;  // 이동 제한
            this.isAttackActive = true;  // 공격 판정 활성화
            this.isHeavyAttack = true;  // 강공격
            this.heavyAttackTimer = this.heavyAttackCooldown;  // 쿨타임 시작

            // Root Motion 추적 시작
            this.rootMotionEnabled = true;
            this.rootMotionStartPlayerPos.copy(this.mesh.position);  // 플레이어 시작 위치 저장
            if (this.rootBone) {
                this.rootBone.getWorldPosition(this.rootMotionStartPos);  // 루트 본 시작 월드 위치 저장
            }

            this.playAnimation('MouseRight', false);
            // 검 궤적 시작
            if (this.swordTrail) {
                this.swordTrail.start();
            }
            // 공격 사운드 재생
            if (this.soundSystem) {
                this.soundSystem.playSFX('playerAttackRight');
            }
            return;
        }

        // R키 - JumpAttack
        // R키 - JumpAttack (✅ 입력은 먼저 소비)
if (input.keyPresses.has('jumpAttack')) {
    // ✅ 성공/실패 상관없이 먼저 소비
    input.keyPresses.delete('jumpAttack');

    // 이제 성공 조건 체크
    if (!this.isAttacking && this.jumpAttackTimer <= 0) {
            this.isAttacking = true;
            this.isAttackActive = true;
            this.isHeavyAttack = true;  // 강공격 취급
            this.isJumpAttack = true;   // JumpAttack 플래그
            this.jumpAttackTimer = this.jumpAttackCooldown;  // 쿨타임 시작 (15초)

            // Root Motion 추적 시작
            this.rootMotionEnabled = true;
            this.rootMotionStartPlayerPos.copy(this.mesh.position);
            if (this.rootBone) {
                this.rootBone.getWorldPosition(this.rootMotionStartPos);
            }

            this.playAnimation('JumpAttack', false);

            // Strong 궤적 시작 (6개)
            for (const trail of this.strongTrails) {
                if (trail) trail.start();
            }

            // JumpAttack 사운드
            if (this.soundSystem) {
                this.soundSystem.playSFX('playerFlame');
                this.soundSystem.playSFX('playerRengoku');
            }
            return;
        }
        // 쿨타임이거나 공격중이면 그냥 아무 일도 안 일어남 (토큰은 이미 소비됨)
    }


        // 공격 중이면 다른 애니메이션으로 전환하지 않음
        if (this.isAttacking) {
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

    updateAttackHitboxCollider() {
        if (this.attackHitbox) {
            this.attackHitboxCollider.setFromObject(this.attackHitbox);
        }
    }

    updateStrongHitboxColliders() {
        for (let i = 0; i < this.strongHitboxes.length; i++) {
            if (this.strongHitboxes[i]) {
                this.strongHitboxColliders[i].setFromObject(this.strongHitboxes[i]);
            }
        }
    }

    updateHitBoxCollider() {
        if (this.hitBox) {
            this.hitBoxCollider.setFromObject(this.hitBox);
        }
    }

    usePotion() {
        if (this.potionCount <= 0) return false;
        if (this.isDying) return false;

        this.potionCount--;

        // HP 회복
        this.hp = Math.min(this.maxHp, this.hp + this.potionHealAmount);

        // 스태미너 회복
        this.stamina = Math.min(this.maxStamina, this.stamina + this.potionStaminaAmount);

        // 회복 사운드 넣으려면 여기에
        if (this.soundSystem) {
            this.soundSystem.playSFX('potion');
        }

        return true; // 성공
    }

    addPotion(count = 1) {
        this.potionCount += count;
    }

    // 카메라가 따라갈 위치 반환 (Root Motion 활성화 시 루트 본 위치 기준)
    getCameraTargetPosition() {
        if (this.rootMotionEnabled && this.rootBone) {
            // 루트 본의 현재 월드 위치 기준으로 카메라 타겟 계산
            const rootWorldPos = new THREE.Vector3();
            this.rootBone.getWorldPosition(rootWorldPos);

            // 시작 위치 + (현재 루트 본 위치 - 시작 루트 본 위치)
            return new THREE.Vector3(
                this.rootMotionStartPlayerPos.x + (rootWorldPos.x - this.rootMotionStartPos.x),
                this.mesh.position.y,
                this.rootMotionStartPlayerPos.z + (rootWorldPos.z - this.rootMotionStartPos.z)
            );
        }
        return this.mesh.position;
    }
}
