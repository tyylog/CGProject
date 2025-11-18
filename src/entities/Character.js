// entities/Character.js
import * as THREE from 'three';

export class Character {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.hp = 100;
        this.maxHp = 100;

        this.collider = new THREE.Box3();

        // Game/Spawner에서 넣어줄 콜백 전용 필드
        this.onDeathCallback = null;
    }

    updateCollider() {
        if (this.mesh) {
            this.collider.setFromObject(this.mesh);
        }
    }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        // TODO: HP 0이면 죽음 처리 (애니메이션, 제거 등)
        if (this.hp <= 0) {
            this.die();
        }
    }

    die() {
        // 실제 "죽음 이벤트" 발생 지점
        if (typeof this.onDeathCallback === 'function') {
            this.onDeathCallback(this); // 자신(캐릭터)을 넘겨줌
        }
    }

    isDead() {
        return this.hp <= 0;
    }

    update(delta) {
        // 자식 클래스에서 override
        this.updateCollider();
    }
}
