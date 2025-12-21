// entities/Enemy.js
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Character } from './Character.js';
import { SwordTrail } from '../effects/SwordTrail.js';

export class Enemy extends Character {
    /**
     * @param {THREE.Scene} scene
     * @param {THREE.Mesh} ground
     * @param {Object} options
     * @param {Function} onDeathCallback  // 🔹 추가: 죽을 때 호출할 콜백
     * @param {SoundSystem} soundSystem  // 🔹 추가: 사운드 시스템
     * @param {THREE.Object3D} cachedModel  // 🔥 캐시된 모델 (clone된 상태)
     * @param {Array} cachedAnimations  // 🔥 캐시된 애니메이션 클립 배열
     */
    constructor(scene, ground, options = {}, onDeathCallback = null, soundSystem = null, cachedModel = null, cachedAnimations = null) {
        super(scene);
        this.soundSystem = soundSystem;

        const {
            color = 0xff4444,
            radius = 0.7,
            maxHp = 50,
            moveSpeed = 3,
            chaseRange = 25,
            attackRange = 2,
            attackDamage = 5,
            attackCooldown = 1.0,
            // 히스테리시스: 공격 진입/이탈 범위
            attackEnterRange = attackRange - 0.5,   // AI가 공격 상태로 전환되는 거리
            attackExitRange = attackRange + 2       // AI가 공격을 중단하고 추적으로 돌아가는 거리
        } = options;

        this.maxHp = maxHp;
        this.hp = maxHp;

        this.moveSpeed = moveSpeed;
        this.chaseRange = chaseRange;

        // 실제 데미지 판정용 기본 attackRange는 그대로 유지 (CombatSystem 사용)
        this.attackRange = attackRange;

        // AI용 진입/이탈 거리 (히스테리시스)
        this.attackEnterRange = attackEnterRange;
        this.attackExitRange = attackExitRange;
        this.attackDamage = attackDamage;
        this.attackCooldown = attackCooldown;

        // 적들은 y좌표 고정
        this.radius = radius;
        this.groundY = ground ? ground.position.y : 0;

        this.state = 'idle';  // 기본 상태는 idle
        this.isDying = false;  // 죽음 상태 플래그
        this.spawnTime = 0;  // spawn 후 경과 시간
        this.spawnDelay = 0.5;  // 0.5초 대기 후 chase 시작
        this.previousState = 'idle';  // Hit 상태 전의 상태 저장
        this.isAttackActive = false;  // 공격 판정 활성화 플래그 (애니메이션 50% 시점에만 true)
        this.attackSoundPlayed = false;  // 공격 사운드 재생 여부 (중복 재생 방지)
        this.killCounted = false;  // 킬 카운트가 이미 반영되었는지

        // 애니메이션 관련
        this.mixer = null;
        this.actions = {};
        this.currentAction = null;
        this.model = null;
        this.isModelLoaded = false;

        // 히트박스 참조 (피격용)
        this.hitBox = null;
        this.hitBoxCollider = new THREE.Box3();

        // 공격 히트박스 참조 (공격용)
        this.attackLeg = null;      // 발차기 히트박스
        this.attackPunch = null;    // 펀치 히트박스
        this.attackHitboxCollider = new THREE.Box3();
        this.currentAttackType = null;  // 'Punch' 또는 'Kick'

        // 공격 잔상 효과
        this.legTrail = null;
        this.punchTrail = null;

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

        // 🔥 캐시된 모델이 있으면 사용, 없으면 직접 로드 (fallback)
        if (cachedModel && cachedAnimations) {
            this._setupCachedModel(cachedModel, cachedAnimations);
        } else {
            this._loadModel();
        }
    }

    /**
     * 🔥 캐시된 모델을 설정 (EnemySpawner에서 전달받은 clone된 모델)
     */
    _setupCachedModel(model, animations) {
        this.model = model;

        // 기존 임시 메시 제거
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
            }

            // 공격 히트박스들 찾아서 참조 저장 및 숨기기
            if (child.name === 'attackleg') {
                this.attackLeg = child;
                child.visible = false;
                // 발차기 잔상 효과 초기화 - 1초 후 활성화
                this._trailTimers = this._trailTimers || [];
                const t = setTimeout(() => {
                if (!this.isDying && this.legTrail) this.legTrail.start();
                }, 1000);
                this._trailTimers.push(t);
            }
            if (child.name === 'attackPunch') {
                this.attackPunch = child;
                child.visible = false;
                // 펀치 잔상 효과 초기화 - 1초 후 활성화
                this.punchTrail = new SwordTrail(this.scene, this.attackPunch, './assets/images/blue.png');
                setTimeout(() => this.punchTrail.start(), 1000);
            }

            // Akaza 모델의 leg와 punch 오브젝트 숨기고 잔상 효과 추가 (1초 후 활성화)
            if (child.name === 'leg') {
                child.visible = false;
                const legEffect = new SwordTrail(this.scene, child, './assets/images/blue.png');
                if (!this.extraTrails) this.extraTrails = [];
                this.extraTrails.push(legEffect);
                // 1초 후 활성화
                setTimeout(() => legEffect.start(), 1000);
            }
            if (child.name === 'punch') {
                child.visible = false;
                const punchEffect = new SwordTrail(this.scene, child, './assets/images/blue.png');
                if (!this.extraTrails) this.extraTrails = [];
                this.extraTrails.push(punchEffect);
                // 1초 후 활성화
                setTimeout(() => punchEffect.start(), 1000);
            }
        });

        // 원래 위치/회전/스케일 적용
        this.model.position.copy(prevPos);
        this.model.rotation.copy(prevRot);
        this.model.scale.multiply(prevScale);
        this.model.position.y = this.groundY + this.radius;

        // 메쉬를 모델로 교체
        this.mesh = this.model;
        this.scene.add(this.mesh);

        // 애니메이션 설정
        this.mixer = new THREE.AnimationMixer(this.model);

        // 애니메이션 액션 생성
        animations.forEach((clip) => {
            const action = this.mixer.clipAction(clip);
            this.actions[clip.name] = action;
        });

        // 기본 애니메이션(Idle) 재생
        if (this.actions['Idle']) {
            this.currentAction = this.actions['Idle'];
            this.currentAction.play();
        }

        // 애니메이션 종료 이벤트 리스너
        this._setupAnimationListeners();

        this._createHealthBar();
        this.isModelLoaded = true;
    }

    /**
     * 🔥 애니메이션 종료 이벤트 리스너 설정 (공통 로직)
     */
    _setupAnimationListeners() {
        this.mixer.addEventListener('finished', (e) => {
            const finishedAction = e.action;
            const clipName = finishedAction.getClip().name;

            // Death 애니메이션이 끝나면 제거
            if (clipName === 'Death') {
                if (this.hpLabel) {
                    if (this.hpLabel.element) {
                        this.hpLabel.element.remove();
                    }
                    if (this.hpLabel.parent) {
                        this.hpLabel.parent.remove(this.hpLabel);
                    }
                    if (this.mesh) this.scene.remove(this.mesh);
                    this._deadDone = true;
                    this.destroy();
                }
            }

            // Hit 애니메이션이 끝나면 이전 상태로 복귀
            if (clipName === 'Hit') {
                this.state = this.previousState;
                switch (this.previousState) {
                    case 'idle':
                        this.playAnimation('Idle', true);
                        break;
                    case 'chase':
                        this.playAnimation('Run', true);
                        break;
                    case 'attack':
                        this.state = 'chase';
                        this.playAnimation('Run', true);
                        break;
                }
            }

            // Punch, Kick 애니메이션이 끝나면 idle로 복귀
            if (clipName === 'Punch' || clipName === 'Kick') {
                this.state = 'idle';
                this.isAttackActive = false;
                this.playAnimation('Idle', true);
            }
        });
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
                    }

                    // 공격 히트박스들 찾아서 참조 저장 및 숨기기
                    if (child.name === 'attackleg') {
                        this.attackLeg = child;
                        child.visible = false;
                        // 발차기 잔상 효과 초기화 - 1초 후 활성화
                        this.legTrail = new SwordTrail(this.scene, this.attackLeg, './assets/images/blue.png');
                        setTimeout(() => this.legTrail.start(), 1000);
                    }
                    if (child.name === 'attackPunch') {
                        this.attackPunch = child;
                        child.visible = false;
                        // 펀치 잔상 효과 초기화 - 1초 후 활성화
                        this.punchTrail = new SwordTrail(this.scene, this.attackPunch, './assets/images/blue.png');
                        setTimeout(() => this.punchTrail.start(), 1000);
                    }

                    // Akaza 모델의 leg와 punch 오브젝트 숨기고 잔상 효과 추가 (1초 후 활성화)
                    if (child.name === 'leg') {
                        child.visible = false;
                        const legEffect = new SwordTrail(this.scene, child, './assets/images/blue.png');
                        if (!this.extraTrails) this.extraTrails = [];
                        this.extraTrails.push(legEffect);
                        // 1초 후 활성화
                        setTimeout(() => legEffect.start(), 1000);
                    }
                    if (child.name === 'punch') {
                        child.visible = false;
                        const punchEffect = new SwordTrail(this.scene, child, './assets/images/blue.png');
                        if (!this.extraTrails) this.extraTrails = [];
                        this.extraTrails.push(punchEffect);
                        // 1초 후 활성화
                        setTimeout(() => punchEffect.start(), 1000);
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
                });

                // 기본 애니메이션(Idle) 재생
                if (this.actions['Idle']) {
                    this.currentAction = this.actions['Idle'];
                    this.currentAction.play();
                }

                // 애니메이션 종료 이벤트 리스너 (공통 메서드 사용)
                this._setupAnimationListeners();

                this._createHealthBar();
                this.isModelLoaded = true;
            },
            undefined,
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

        // 잔상 효과 업데이트
        if (this.legTrail) {
            this.legTrail.update(delta);
        }
        if (this.punchTrail) {
            this.punchTrail.update(delta);
        }

        // 추가 잔상 효과 업데이트 (leg, punch 등)
        if (this.extraTrails) {
            this.extraTrails.forEach(trail => trail.update(delta));
        }

        if (!this.mesh) {
            return;
        }

        // 죽음 상태일 때는 애니메이션만 재생하고 다른 로직은 실행하지 않음
        if (this.state === 'death') {
            return;
        }

        // 플레이어가 죽었으면 더 이상 행동하지 않음
        if (player.isDying) {
            return;
        }

        // spawn 타이머 업데이트
        this.spawnTime += delta;

        const toPlayer = this._tmpDir;
        toPlayer.subVectors(player.mesh.position, this.mesh.position);

        // y좌표 무시
        toPlayer.y = 0;

        // 🔥 최적화: lengthSq() 사용 (sqrt 연산 제거)
        const distanceSq = toPlayer.lengthSq();
        const attackEnterRangeSq = this.attackEnterRange * this.attackEnterRange;
        const attackExitRangeSq = this.attackExitRange * this.attackExitRange;

        // 이전 state 저장
        const prevState = this.state;

        switch (this.state) {
            case 'idle':
                // spawn 1초 후 무조건 행동 시작
                if (this.spawnTime >= this.spawnDelay) {
                    // 플레이어가 공격 범위 안에 있으면 바로 attack
                    if (distanceSq <= attackEnterRangeSq) {
                        this.state = 'attack';
                        this.isAttackActive = false;  // 공격 시작 시 비활성화
                        this.attackStarted = true;  // 새로운 공격 시작 플래그
                        this.attackSoundPlayed = false;  // 사운드 재생 플래그 리셋
                        const randomAttack = Math.random() < 0.5 ? 'Punch' : 'Kick';
                        this.currentAttackType = randomAttack;  // 현재 공격 타입 저장
                        this.playAnimation(randomAttack, false);
                    }
                    // 그 외의 경우는 무조건 chase (거리 상관없이)
                    else {
                        this.state = 'chase';
                    }
                }
                break;

            case 'chase':
                // 진입 범위(enter)를 사용
                if (distanceSq <= attackEnterRangeSq) {
                    this.state = 'attack';
                    this.isAttackActive = false;  // 공격 시작 시 비활성화
                    this.attackStarted = true;  // 새로운 공격 시작 플래그
                    this.attackSoundPlayed = false;  // 사운드 재생 플래그 리셋
                    // attack 진입 시 랜덤 공격 애니메이션 선택
                    const randomAttack = Math.random() < 0.5 ? 'Punch' : 'Kick';
                    this.currentAttackType = randomAttack;  // 현재 공격 타입 저장
                    this.playAnimation(randomAttack, false);
                } else {
                    this._moveTowardsPlayer(delta, toPlayer);
                }
                break;

            case 'attack':
                // 애니메이션 진행도 체크하여 공격 판정 활성화
                if (this.currentAction) {
                    const clipDuration = this.currentAction.getClip().duration;
                    const currentTime = this.currentAction.time;
                    const progress = currentTime / clipDuration;

                    // 애니메이션 50% 지점에서만 공격 판정 활성화 (45%~55% 작은 범위)
                    if (progress >= 0.45 && progress <= 0.55) {
                        this.isAttackActive = true;

                        // 공격 사운드 재생 (50% 지점에서 한 번만)
                        if (!this.attackSoundPlayed && this.soundSystem) {
                            this.soundSystem.playSFX('enemyAttack');
                            this.attackSoundPlayed = true;
                        }
                    } else {
                        this.isAttackActive = false;
                    }
                }

                // 이탈 범위(exit)를 사용: exit 범위를 넘기면 공격 중단
                if (distanceSq > attackExitRangeSq) {
                    this.state = 'chase';
                    this.isAttackActive = false;  // 공격 종료 시 비활성화
                }
                break;

            case 'hit':
                // Hit 애니메이션 재생 중에는 아무것도 하지 않음 (애니메이션 끝나면 finished 이벤트에서 상태 복귀)
                break;

            case 'death':
                // Death 애니메이션 재생 중에는 아무것도 하지 않음 (애니메이션 끝나면 finished 이벤트에서 제거)
                break;
        }

        // state가 변경되었을 때 애니메이션 변경
        if (prevState !== this.state) {
            switch (this.state) {
                case 'idle':
                    this.playAnimation('Idle', true);
                    break;
                case 'chase':
                    this.playAnimation('Run', true);
                    break;
                // hit과 attack은 각각 takeDamage()와 chase에서 직접 재생하므로 여기서는 처리 안 함
            }
        }

        // 🔥 이동 후에도 항상 지면 높이로 고정
        this.mesh.position.y = this.groundY;

        this._lookAtPlayer(player);
        this.updateCollider();
        // hitBoxCollider는 CombatSystem에서 필요할 때만 업데이트
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

        // Hit, Death 같은 중요한 애니메이션은 즉시 전환
        const isImportantAnim = (name === 'Hit' || name === 'Death');

        if (this.currentAction) {
            if (isImportantAnim) {
                this.currentAction.stop();  // 즉시 정지
            } else {
                this.currentAction.fadeOut(0.2);
            }
        }

        newAction.reset();

        if (isImportantAnim) {
            // 중요한 애니메이션은 fade 없이 즉시 재생
            newAction.setLoop(THREE.LoopOnce);
            newAction.clampWhenFinished = true;

            // Hit 애니메이션은 1.5배 빠르게 재생
            // Punch, Kick 애니메이션은 2배 빠르게 재생
            if (name === 'Hit') {
                newAction.setEffectiveTimeScale(1.5);
            } else if (name === 'Punch' || name === 'Kick') {
                newAction.setEffectiveTimeScale(3.0);
            } else {
                newAction.setEffectiveTimeScale(1.3);
            }

            newAction.play();
        } else {
            newAction.fadeIn(0.2);
            newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
            if (!loop) {
                newAction.clampWhenFinished = true;
            }
            newAction.setEffectiveTimeScale(1.8);
            newAction.play();
        }

        this.currentAction = newAction;
    }

    updateHitBoxCollider() {
        if (this.hitBox) {
            this.hitBoxCollider.setFromObject(this.hitBox);
        }
    }

    updateAttackHitboxCollider() {
        // 현재 공격 타입에 맞는 히트박스로 콜라이더 업데이트
        if (this.currentAttackType === 'Kick' && this.attackLeg) {
            this.attackHitboxCollider.setFromObject(this.attackLeg);
        } else if (this.currentAttackType === 'Punch' && this.attackPunch) {
            this.attackHitboxCollider.setFromObject(this.attackPunch);
        }
    }

    takeDamage(amount) {
        // 이미 죽는 중이면 데미지 무시
        if (this.isDying) {
            return;
        }

        this.hp = Math.max(0, this.hp - amount);
        this._updateHealthBar();

        // HP 0이면 죽음 처리
        if (this.hp <= 0) {
            if (!this.killCounted && typeof this.onDeathCallback === 'function') {
                this.killCounted = true;
                this.onDeathCallback(this);
            }

            this.die();
        } else {
            // 살아있으면 Hit 상태로 전환
            this.previousState = this.state;  // 현재 상태 저장
            this.state = 'hit';
            this.playAnimation('Hit', false);  // 즉시 Hit 애니메이션 재생
            // 피격 사운드 재생
            if (this.soundSystem) {
                this.soundSystem.playSFX('enemyHit');
            }
        }
    }

    die() {
        // 죽음 애니메이션 재생 (제거는 애니메이션 종료 후)
        if (!this.isDying && this.isModelLoaded) {
            this.isDying = true;
            this.state = 'death';
            this.playAnimation('Death', false);

            // 죽음 사운드 재생 (Hit와 동일)
            if (this.soundSystem) {
                this.soundSystem.playSFX('enemyHit');
            }
        }
    }

    // isDead() 오버라이드: Death 애니메이션이 완전히 끝날 때까지는 false 반환
    isDead() {
        // Death 애니메이션이 재생 중일 때는 아직 "죽지 않은" 것으로 처리
        // 애니메이션이 끝나고 onDeathCallback이 호출된 후에야 진짜 제거됨
        return !!this._deadDone;
    }

    _createHealthBar() {
        // 컨테이너 div
        const container = document.createElement('div');
        container.style.width = '40px';
        container.style.height = '3px';
        container.style.background = 'rgba(0,0,0,0.4)';
        container.style.border = '1px solid #000';
        container.style.borderRadius = '3px';

        // 실제 HP 바
        this.hpBarEl = document.createElement('div');
        this.hpBarEl.style.height = '100%';
        this.hpBarEl.style.width = '100%';
        this.hpBarEl.style.background = '#ff4444';
        this.hpBarEl.style.borderRadius = '1px';

        container.appendChild(this.hpBarEl);

        // CSS2DObject로 변환
        this.hpLabel = new CSS2DObject(container);
        this.hpLabel.position.set(0, 2.03, 0); // 적 머리 위 위치
        this.mesh.add(this.hpLabel);
    }

    _updateHealthBar() {
        const ratio = this.hp / this.maxHp;
        this.hpBarEl.style.width = (ratio * 100) + '%';

        if (this.hp <= 0) {
            this.hpLabel.element.style.display = 'none';
        }
    }

    // entities/Enemy.js
destroy() {
  // 이미 정리됐으면 중복 방지
  if (this._destroyed) return;
  this._destroyed = true;

  // 1) AnimationMixer 이벤트 제거
  if (this.mixer && this._onMixerFinished) {
    this.mixer.removeEventListener('finished', this._onMixerFinished);
    this._onMixerFinished = null;
  }

  // 2) SwordTrail 정리 (🔥 가장 중요)
  if (this.legTrail) {
    this.legTrail.dispose();
    this.legTrail = null;
  }
  if (this.punchTrail) {
    this.punchTrail.dispose();
    this.punchTrail = null;
  }
  if (this.extraTrails) {
    this.extraTrails.forEach(t => t?.dispose?.());
    this.extraTrails = null;
  }

  // 3) CSS2D HP bar 제거 (DOM 누수 방지)
  if (this.hpLabel) {
    if (this.hpLabel.element?.parentNode) {
      this.hpLabel.element.parentNode.removeChild(this.hpLabel.element);
    }
    if (this.hpLabel.parent) {
      this.hpLabel.parent.remove(this.hpLabel);
    }
    this.hpLabel = null;
    this.hpBarEl = null;
  }

  // 4) Scene에서 mesh 제거
  if (this.mesh && this.scene) {
    this.scene.remove(this.mesh);
  }

  // 5) timeout 정리 (있다면)
  if (this._trailTimers) {
    this._trailTimers.forEach(clearTimeout);
    this._trailTimers = null;
  }

  // 6) 참조 끊기 (GC 가능하게)
  this.mesh = null;
  this.model = null;
  this.mixer = null;
  this.actions = null;
  this.soundSystem = null;
  this.scene = null;
}


    
}
