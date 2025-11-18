// src/systems/EnemySpawner.js
import * as THREE from 'three';
import { Enemy } from '../entities/Enemy.js';

export class EnemySpawner {
    /**
     * @param {THREE.Scene} scene
     * @param {THREE.Mesh} ground  - y 위치 기준용 (없으면 null)
     * @param {Object} options
     * @param {Function} onEnemyDeath - Game에서 넘겨주는 die callback
     */
    constructor(scene, ground, options = {}, onEnemyDeath = null) {
        this.scene = scene;
        this.ground = ground;

        const {
            maxEnemies = 10,          // 동시에 존재할 최대 적 수
            spawnInterval = 3.0,      // 초 단위 스폰 간격
            minSpawnRadius = 10,      // 플레이어 주변 최소 거리
            maxSpawnRadius = 30,      // 플레이어 주변 최대 거리
            enemyOptions = {},        // Enemy 옵션 기본값
        } = options;

        this.maxEnemies = maxEnemies;
        this.spawnInterval = spawnInterval;
        this.minSpawnRadius = minSpawnRadius;
        this.maxSpawnRadius = maxSpawnRadius;
        this.enemyOptions = enemyOptions;

        this.enemies = [];
        this._spawnTimer = 0;

        // 재사용 벡터
        this._tmpPos = new THREE.Vector3();

        // Game에서 받은 콜백 저장
        this.onEnemyDeath = onEnemyDeath;

        // 🔥 Game이 넘겨줄 바운드 getter
        this.boundsProvider = null;
    }

    /**
     * 매 프레임 호출
     * @param {number} delta   프레임 간 시간 (초)
     * @param {Player} player  플레이어 (위치 기준으로 주변에 스폰)
     */
    update(delta, player) {
        // dead enemy 정리
        this._cleanupDead();

        if (!player) return;

        this._spawnTimer += delta;

        // 스폰할 수 있는 상태인지 체크
        if (this.enemies.length >= this.maxEnemies) return;
        if (this._spawnTimer < this.spawnInterval) return;

        // 조건 만족 → 새 enemy 스폰
        this._spawnTimer = 0;
        const enemy = this._spawnAroundPlayer(player);
        if (enemy) {
            this.enemies.push(enemy);
        }
    }

    _spawnAroundPlayer(player) {
        const px = player.mesh.position.x;
        const pz = player.mesh.position.z;

        const bounds = this.boundsProvider ? this.boundsProvider() : null;
        const margin = this.enemyOptions.radius ?? 0.8;  // Enemy 반지름 정도

        let x, z;
        let valid = false;

        for (let i = 0; i < 10; i++) {  // 최대 10번 시도
            const angle = Math.random() * Math.PI * 2;
            const radius =
                this.minSpawnRadius +
                Math.random() * (this.maxSpawnRadius - this.minSpawnRadius);

            x = px + Math.cos(angle) * radius;
            z = pz + Math.sin(angle) * radius;

            if (!bounds) {
                valid = true;
                break;
            }

            const minX = bounds.minX + margin;
            const maxX = bounds.maxX - margin;
            const minZ = bounds.minZ + margin;
            const maxZ = bounds.maxZ - margin;

            if (
                x >= minX && x <= maxX &&
                z >= minZ && z <= maxZ
            ) {
                valid = true;
                break;
            }
        }

        if (!valid) {
            // 맵이 너무 좁아서 유효한 위치 못 찾으면 스폰 포기
            return null;
        }

        // 👇 Enemy 생성 시 onDeathCallback 전달
        const enemy = new Enemy(
            this.scene,
            this.ground,
            this.enemyOptions,
            (deadEnemy) => {
                // Enemy가 죽을 때 호출됨
                if (typeof this.onEnemyDeath === 'function') {
                    this.onEnemyDeath(deadEnemy);  // 결국 Game.handleEnemyDeath로 감
                }
            }
        );

        enemy.mesh.position.x = x;
        enemy.mesh.position.z = z;

        return enemy;
    }


    _cleanupDead() {
        this.enemies = this.enemies.filter(e => !e.isDead());
        // 위 코드: e.isDead 필드가 있거나 isDead() 메서드가 있으면 제거 기준으로 사용
    }

    setBoundsProvider(fn) {
        this.boundsProvider = fn;   // () => ({minX, maxX, minZ, maxZ}) 또는 null
    }
}
