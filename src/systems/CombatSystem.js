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

        // 임시 벡터들
        this._tmpVec = new THREE.Vector3();
        this._tmpForward = new THREE.Vector3();
    }

    /**
     * 매 프레임 호출
     * @param {number} delta
     * @param {Player} player
     * @param {Enemy[]} enemies
     * @param {InputController} input
     */
    update(delta, player, enemies, input) {
        if (!player || !enemies) return;

        // 쿨타임 감소
        if (this._playerAttackTimer > 0) {
            this._playerAttackTimer -= delta;
        }

        // 1) 플레이어 → 적 공격 처리
        this._handlePlayerAttack(delta, player, enemies, input);

        // 2) 적 → 플레이어 공격 처리
        this._handleEnemyAttacks(delta, player, enemies);
    }

    _handlePlayerAttack(delta, player, enemies, input) {
        // 공격 입력: 예시로 마우스 왼쪽 버튼 사용 (InputController 기준에 맞게 수정)
        const wantsAttack = input && input.keys && input.keys.mouseLeft;

        if (!wantsAttack) return;
        if (this._playerAttackTimer > 0) return; // 쿨타임 중

        // 공격 발동
        this._playerAttackTimer = this.playerAttackCooldown;

        const playerPos = player.mesh.position;

        // 플레이어가 바라보는 forward 벡터
        const forward = player.getForwardVector().clone();
        forward.y = 0;

        enemies.forEach(enemy => {
            if (!enemy.mesh || (enemy.isDead && enemy.isDead())) return;

            const enemyPos = enemy.mesh.position;

            // 거리 체크
            const toEnemy = this._tmpVec.subVectors(enemyPos, playerPos);
            const dist = toEnemy.length();
            if (dist > this.playerAttackRange) return;

            // 각도 체크 (플레이어 앞쪽인지)
            toEnemy.normalize();
            const angle = Math.acos(
                THREE.MathUtils.clamp(forward.dot(toEnemy), -1, 1)
            );
            if (angle > this.playerAttackAngle) return;

            // 여기까지 왔다면 타격 판정
            enemy.takeDamage(this.playerAttackDamage);
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
