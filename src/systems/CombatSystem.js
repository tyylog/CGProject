// src/systems/CombatSystem.js
import * as THREE from 'three';

export class CombatSystem {
    constructor(options = {}) {
        const {
            playerAttackRange = 3.0,      // 플레이어 근접 공격 거리
            playerAttackAngle = Math.PI / 3, // 앞쪽 ±각도 (60도)
            playerAttackDamage = 10,
            playerAttackCooldown = 0.5,   // 초
            enemyAttackCooldown = 1.0,    // 각 enemy 기본 쿨타임
        } = options;

        this.playerAttackRange = playerAttackRange;
        this.playerAttackAngle = playerAttackAngle;
        this.playerAttackDamage = playerAttackDamage;
        this.playerAttackCooldown = playerAttackCooldown;
        this.enemyAttackCooldown = enemyAttackCooldown;

        this._playerAttackTimer = 0;

        // enemy별 공격 쿨타임 관리용
        this._enemyAttackTimers = new WeakMap();

        // 플레이어가 적을 타격한 시간 기록 (적마다 개별 쿨타임)
        this._lastHitTime = new WeakMap();

        // 임시 벡터들
        this._tmpVec = new THREE.Vector3();
        this._tmpForward = new THREE.Vector3();
    }

    /**
     * 매 프레임 호출
     * @param {number} delta
     * @param {Player} player
     * @param {Enemy[]} enemies
     */
    update(delta, player, enemies) {
        if (!player || !enemies) return;

        // 쿨타임 감소
        if (this._playerAttackTimer > 0) {
            this._playerAttackTimer -= delta;
        }

        // 1) 플레이어 → 적 공격 처리
        this._handlePlayerAttack(player, enemies);

        // 2) 적 → 플레이어 공격 처리
        this._handleEnemyAttacks(delta, player, enemies);
    }

    _handlePlayerAttack(player, enemies) {
        // 공격 애니메이션이 재생 중이 아니면 충돌 검사 안 함
        if (!player.isAttackActive) return;

        // attackHitbox가 없으면 충돌 검사 불가
        if (!player.attackHitbox || !player.attackHitboxCollider) return;

        enemies.forEach(enemy => {
            if (!enemy.mesh || (enemy.isDead && enemy.isDead())) return;
            if (!enemy.hitBox || !enemy.hitBoxCollider) return;

            // Box3 충돌 검사: attackHitbox와 hitBox가 겹치는지 확인
            if (player.attackHitboxCollider.intersectsBox(enemy.hitBoxCollider)) {
                // 연속 타격 방지를 위한 쿨타임 체크
                const now = performance.now();
                const lastHit = this._lastHitTime.get(enemy) || 0;

                // 1초 내에 같은 적을 다시 때리지 않음
                if (now - lastHit < 1000) return;

                // 타격 판정
                enemy.takeDamage(this.playerAttackDamage);
                this._lastHitTime.set(enemy, now);
                console.log('Hit detected! Enemy HP:', enemy.hp);

                // 넉백 효과: 플레이어 방향 반대로 1m 밀어내기
                const knockbackDir = new THREE.Vector3().subVectors(
                    enemy.mesh.position,
                    player.mesh.position
                );
                knockbackDir.y = 0; // y축 무시 (수평 방향만)
                knockbackDir.normalize();
                knockbackDir.multiplyScalar(1.0); // 1m 거리

                enemy.mesh.position.add(knockbackDir);
            }
        });
    }

    _handleEnemyAttacks(delta, player, enemies) {
        const playerPos = player.mesh.position;

        enemies.forEach(enemy => {
            if (!enemy.mesh || (enemy.isDead && enemy.isDead())) return;

            const enemyPos = enemy.mesh.position;

            const toPlayer = this._tmpVec.subVectors(playerPos, enemyPos);
            const dist = toPlayer.length();

            const range = enemy.attackRange || 2.0;
            if (dist > range) return;

            // enemy별 쿨타임 꺼내기
            let timer = this._enemyAttackTimers.get(enemy) || 0;
            if (timer > 0) {
                timer -= delta;
                this._enemyAttackTimers.set(enemy, timer);
                return;
            }

            // 공격 발동
            const dmg = enemy.attackDamage;
            player.takeDamage(dmg);

            // 쿨타임 리셋
            this._enemyAttackTimers.set(enemy, this.enemyAttackCooldown);
        });
    }

}
