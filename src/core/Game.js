// core/Game.js
import * as THREE from 'three';
import { Player } from '../entities/Player.js';
import { InputController } from './InputController.js';
import { EnemySpawner } from '../systems/EnemySpawner.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { EnvironmentSystem } from '../systems/EnvironmentSystem.js';
import { UISystem } from '../systems/UISystem.js';
import { DecorationSystem } from '../systems/DecorationSystem.js';
import { SoundSystem } from '../systems/SoundSystem.js';



export class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        this.player = null;
        this.ground = null;

        this.input = null;

        this.enemySpawner = null;
        this.combatSystem = null;
        this.environmentSystem = null;
        this.uiSystem = null;
        this.decorationSystem = null;
        this.soundSystem = null;

        this.elapsedTime = 0;
        this.killCount = 0;
        this.isGameOver = false;
        this.isGameStarted = false;  // 게임 시작 여부

        this._initThree();
        this._initWorld();
        this._initSystems();

        this.input = new InputController(this.renderer.domElement);

        this._bindEvents();

        this.clock = new THREE.Clock();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    _initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);

        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            100
        );
        this.camera.position.set(-3, 8, 2);
        this.scene.add(this.camera);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0xffffff);
        document.body.appendChild(this.renderer.domElement);
    }

    _initWorld() {
        const ambientLight = new THREE.AmbientLight(0x333333);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff);
        dirLight.position.set(5, 12, 8);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        const planeGeometry = new THREE.PlaneGeometry(1500, 1500);
        const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xaaaa00 });
        const ground = new THREE.Mesh(planeGeometry, planeMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.scene.add(ground);

        this.ground = ground;

        // TODO: worldCubes, followerCubes 등도 여기서 만들고
        // this.enemies, this.obstacles 배열에 넣어 관리
    }

    _initSystems() {
        // Environment System
        this.environmentSystem = new EnvironmentSystem(this.scene, this.renderer, this.ground);

        window.addEventListener('keydown', (e) => {
        if (!this.environmentSystem) return;

        if (e.key === '1') this.environmentSystem.setMode('grassland');
        if (e.key === '2') this.environmentSystem.setMode('wasteland');
        if (e.key === '3') this.environmentSystem.setMode('hell');
        });

        // Decoration System
        this.decorationSystem = new DecorationSystem(this.scene, this.environmentSystem);

        // Sound System 초기화 (Enemy Spawner보다 먼저)
        this.soundSystem = new SoundSystem();
        this.soundSystem.loadBGM('./assets/sounds/Ost/game.mp3');

        // 효과음 로드
        // Player 사운드
        this.soundSystem.loadSFX('playerAttackLeft', './assets/sounds/player/MouseLeft.mp3', 0.5);
        this.soundSystem.loadSFX('playerAttackRight', './assets/sounds/player/MouseRight.mp3', 0.5);
        this.soundSystem.loadSFX('playerRun', './assets/sounds/player/Run.mp3', 0.3);
        this.soundSystem.loadSFX('playerDeath', './assets/sounds/player/Death.mp3', 0.6);

        // Enemy 사운드
        this.soundSystem.loadSFX('enemyAttack', './assets/sounds/enemy/Attack.mp3', 0.4);
        this.soundSystem.loadSFX('enemyHit', './assets/sounds/enemy/Hit.mp3', 0.4);

        // Enemy Spawner
        this.enemySpawner = new EnemySpawner(this.scene, this.ground, {
                maxEnemies: 15,
                spawnInterval: 3.0,
                minSpawnRadius: 10,
                maxSpawnRadius: 30,
                enemyOptions: {
                    color: 0xff5555,
                    radius: 0.8,
                    maxHp: 30,
                    moveSpeed: 5,
                    chaseRange: 25,
                    loseInterestRange: 35,
                    attackRange: 2.0,
                    attackDamage: 5,
                    attackCooldown: 1.0,
                }
            },
            (enemy) => {
                this.handleEnemyDeath(enemy);
            },
            this.soundSystem  // SoundSystem 전달
        );
        this.enemySpawner.setBoundsProvider(() => this.environmentSystem.getGroundBounds());

        // Combat System
        this.combatSystem = new CombatSystem({
            playerAttackRange: 3.0,
            playerAttackAngle: Math.PI / 3,
            playerAttackDamage: 15,
            playerAttackCooldown: 0.4,
            enemyAttackCooldown: 1.0,
        });


        // UI System
        this.uiSystem = new UISystem();

        // Player 초기화 (SoundSystem 로드 후)
        this.player = new Player(
            this.scene,
            this.ground,
            this.soundSystem,
            () => {
                // BGM 중지 콜백
                if (this.soundSystem) {
                    this.soundSystem.stopBGM();
                }
            }
        );

        this.player.onDeathCallback = () => {
            this.handlePlayerDeath();
        }

        // 시작 화면 처리
        this._setupStartScreen();
    }

    _setupStartScreen() {
        const startScreen = document.getElementById('start-screen');
        const beginScreen = document.getElementById('begin-screen');
        if (!startScreen || !beginScreen) return;

        const startGame = () => {
            // 시작 화면 숨기기
            startScreen.classList.add('hidden');

            // 배경음악 즉시 시작
            this.soundSystem.playBGM();
            console.log('Background music playing.');

            // Begin 화면 표시
            beginScreen.classList.add('active');
            const beginImg = beginScreen.querySelector('img');

            // 페이드인 애니메이션 (2.5초)
            beginImg.style.animation = 'fadeIn 2.5s ease-in-out forwards';

            // 2.5초 후 페이드아웃 시작
            setTimeout(() => {
                beginImg.style.animation = 'fadeOut 2.5s ease-in-out forwards';
            }, 2500);

            // 5초 후 게임 시작
            setTimeout(() => {
                // Begin 화면 숨기기
                beginScreen.classList.remove('active');

                // 게임 시작 플래그 설정
                this.isGameStarted = true;

                // Clock 리셋 (시작 화면에서 지난 시간 무시)
                this.clock.getDelta();

                console.log('Game started!');
            }, 5000);

            // 이벤트 리스너 제거
            startScreen.removeEventListener('click', startGame);
            document.removeEventListener('keydown', handleKeyPress);
        };

        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                startGame();
            }
        };

        // 클릭 이벤트
        startScreen.addEventListener('click', startGame);

        // Enter 키 이벤트
        document.addEventListener('keydown', handleKeyPress);
    }

    _bindEvents() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    animate() {
        const delta = this.clock.getDelta();

        // 게임이 시작되지 않았으면 렌더링만 하고 리턴
        if (!this.isGameStarted) {
            this.renderer.render(this.scene, this.camera);
            requestAnimationFrame(this.animate);
            return;
        }

        if (this.isGameOver) {
            // 시간 멈추고 싶으면 elapsedTime 안 올리기
            this.uiSystem.update({
                hp: this.player.hp ?? 0,
                maxHp: this.player.maxHp ?? 100,
                killCount: this.killCount ?? 0,
                level: this.player.level ?? 1,
                elapsedTime: this.elapsedTime,
            });
            this.renderer.render(this.scene, this.camera);
            requestAnimationFrame(this.animate);
            return;
        }

        this.elapsedTime += delta;

        // 입력 업데이트
        this.input.update();

        // 플레이어 업데이트
        this.player.update(delta, this.input);

        // 플레이어는 정해진 바운더리 내에 존재
        this._clampPlayerToGround();

        // 적 스폰/AI 업데이트
        if (this.enemySpawner) {
        this.enemySpawner.update(delta, this.player);

        // 각 enemy의 AI update
        this.enemySpawner.enemies.forEach(enemy => {
            enemy.update(delta, this.player);
        });
        }

        // 전투 판정 (양쪽 공격/피격)
        if (this.combatSystem && this.enemySpawner) {
            this.combatSystem.update(
                delta,
                this.player,
                this.enemySpawner.enemies
            );
        }

        // environment 갱신
        if (this.environmentSystem) {
            this.environmentSystem.update(delta);
        }

        // decoration 갱신
        if (this.decorationSystem) {
            this.decorationSystem.update(delta);
        }

        // ui 갱신
        if (this.uiSystem && this.player) {
            this.uiSystem.update({
                hp: this.player.hp ?? 0,
                maxHp: this.player.maxHp ?? 100,
                killCount: this.killCount ?? 0,
                level: this.player.level ?? 1,
                elapsedTime: this.elapsedTime,
        });
        }

        // 카메라 위치 갱신
        this.input.applyToCamera(this.camera);
        this._updateCamera();

        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.animate);
    }

    _updateCamera() {
        const pos = this.player.mesh.position;
        const offset = this.player.cameraOffset; 
        // 예: new THREE.Vector3(0, 2, 10)
        // offset.z = 카메라와 플레이어 거리 (반지름)
        // offset.y = 플레이어보다 카메라가 얼마나 더 위에 있을지 (추가높이)

        const yaw   = this.input.yaw;   // 또는 this.player.yaw;
        const pitch = this.input.pitch; // 위/아래 각도 (라디안)

        const radius = offset.z;

        // 🔹 yaw/pitch를 이용해서 "플레이어 중심의 구 좌표" 계산
        const dir = new THREE.Vector3(
            -Math.sin(yaw) * Math.cos(pitch), // x
            Math.sin(pitch),                 // y
            -Math.cos(yaw) * Math.cos(pitch)  // z
        ).normalize();

        // 플레이어를 기준으로 dir 반대 방향으로 radius만큼 떨어진 위치
        const camPos = new THREE.Vector3()
            .copy(pos)
            .addScaledVector(dir, -radius);

        // 약간 더 위에서 내려다보게 Y 오프셋
        camPos.y += offset.y;

        this.camera.position.copy(camPos);

        // 항상 플레이어 머리쯤을 바라보게
        this.camera.lookAt(
            pos.x,
            pos.y + 0.5,  // 박스 높이 1이면 머리 근처
            pos.z
        );
    }

    handleEnemyDeath(enemy) {
        // 1) 킬 카운트 증가
        this.killCount += 1;
        console.log('Kill count:', this.killCount);

        // 2) 씬에서 메쉬 제거
        if (enemy.mesh) {
            this.scene.remove(enemy.mesh);
        }

        // 3) EnemySpawner의 enemies 배열에서 제거
        if (this.enemySpawner && this.enemySpawner.enemies) {
            this.enemySpawner.enemies = this.enemySpawner.enemies.filter(e => e !== enemy);
        }

        // 4) 필요하면 추가 연출 (드랍 아이템, 이펙트 등) 여기에
    }

    handlePlayerDeath() {
        this.isGameOver = true;

        // UI에 게임오버 표시
        if (this.uiSystem) {
            this.uiSystem.showGameOver();
        }

    }

    _clampPlayerToGround() {
        if (!this.player || !this.player.mesh || !this.environmentSystem) return;

        const bounds = this.environmentSystem.getGroundBounds();
        if (!bounds) return;

        const pos = this.player.mesh.position;

        // 플레이어 크기에 맞게 margin 설정 (반지름 느낌)
        const margin = 0.5;  // 플레이어가 가로 1이라면 0.5 정도

        const minX = bounds.minX + margin;
        const maxX = bounds.maxX - margin;
        const minZ = bounds.minZ + margin;
        const maxZ = bounds.maxZ - margin;

        pos.x = Math.max(minX, Math.min(maxX, pos.x));
        pos.z = Math.max(minZ, Math.min(maxZ, pos.z));
    }

}
