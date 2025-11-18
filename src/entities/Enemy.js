// entities/Enemy.js
import * as THREE from 'three';
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
    }

    update(delta, player) {
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
