// entities/Player.js
import * as THREE from 'three';
import { Character } from './Character.js';

export class Player extends Character {
    constructor(scene, ground) {
        super(scene);
        this.ground = ground;

        const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
        const playerMaterial = new THREE.MeshLambertMaterial({ color: 0x0099ff });
        this.mesh = new THREE.Mesh(playerGeometry, playerMaterial);
        this.mesh.castShadow = true;

        this.scene.add(this.mesh);

        this.speed = 5;        // m/s
        this.runMultiplier = 2;
        this.jumpSpeed = 8;
        this.velocityY = 0;
        this.isGrounded = true;

        this.cameraOffset = new THREE.Vector3(0, 2, 10);
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

        if (move.lengthSq() > 0) {
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
        const groundY = this.ground.position.y + 0.5;
        if (this.mesh.position.y <= groundY) {
            this.mesh.position.y = groundY;
            this.velocityY = 0;
            this.isGrounded = true;
        }

        // 플레이어 회전(yaw만)
        this.mesh.rotation.y = this.yaw;

        // 애니메이션 전환도 앞으로 여기서:
        // - 속도 > 0 && shift 누름 -> run 애니메이션
        // - 속도 > 0 && shift 없음 -> walk 애니메이션
        // - 속도 == 0 -> idle 애니메이션 등

        this.updateCollider();
    }
}
