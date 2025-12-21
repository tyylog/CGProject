// effects/SwordTrail.js
import * as THREE from 'three';

export class SwordTrail {
    constructor(scene, swordMesh, texturePath = './assets/images/fire.png', options = {}) {
        this.scene = scene;
        this.swordMesh = swordMesh;
        this.isActive = false;

        // 궤적 포인트 저장 배열
        this.trailPoints = [];
        this.maxPoints = 20; // 궤적 길이 (포인트 수)

        // 궤적 메쉬들
        this.trailMeshes = [];

        // 텍스처 로드
        const textureLoader = new THREE.TextureLoader();
        this.texture = textureLoader.load(texturePath);

        // 검의 시작점과 끝점 오프셋 (옵션으로 커스터마이징 가능)
        const scale = options.scale || 1.0;
        this.tipOffset = options.tipOffset || new THREE.Vector3(0, 0, 2.0 * scale);
        this.baseOffset = options.baseOffset || new THREE.Vector3(0, 0, 0.4 * scale);
    }

    // 검의 월드 위치 가져오기
    getSwordWorldPositions() {
        if (!this.swordMesh) return null;

        // 검의 월드 행렬 업데이트
        this.swordMesh.updateMatrixWorld(true);

        // 검 끝 위치
        const tipPos = this.tipOffset.clone();
        tipPos.applyMatrix4(this.swordMesh.matrixWorld);

        // 검 기반 위치
        const basePos = this.baseOffset.clone();
        basePos.applyMatrix4(this.swordMesh.matrixWorld);

        return { tip: tipPos, base: basePos };
    }

    // 궤적 시작
    start() {
        this.isActive = true;
        this.trailPoints = [];
    }

    // 궤적 정지
    stop() {
        this.isActive = false;
    }

    // 매 프레임 업데이트
    update(delta) {
        if (this.isActive && this.swordMesh) {
            const positions = this.getSwordWorldPositions();
            if (positions) {
                // 새 포인트 추가
                this.trailPoints.push({
                    tip: positions.tip.clone(),
                    base: positions.base.clone(),
                    life: 1.0 // 생명력 (1.0 = 완전히 보임, 0.0 = 사라짐)
                });

                // 최대 포인트 수 제한
                if (this.trailPoints.length > this.maxPoints) {
                    this.trailPoints.shift();
                }
            }
        }

        // 모든 포인트의 생명력 감소
        for (let i = 0; i < this.trailPoints.length; i++) {
            this.trailPoints[i].life -= delta * 3.0; // 생명력 감소 속도
        }

        // 생명력이 0 이하인 포인트 제거
        this.trailPoints = this.trailPoints.filter(p => p.life > 0);

        // 궤적 메쉬 업데이트
        this.updateTrailMesh();
    }

    // 궤적 메쉬 생성/업데이트
    updateTrailMesh() {
        // 기존 메쉬 제거
        this.trailMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        this.trailMeshes = [];

        if (this.trailPoints.length < 2) return;

        // 포인트들로 리본 형태의 메쉬 생성
        const vertices = [];
        const uvs = [];
        const indices = [];
        const colors = [];

        for (let i = 0; i < this.trailPoints.length; i++) {
            const point = this.trailPoints[i];
            const alpha = point.life;

            // 각 포인트에서 두 개의 정점 생성 (리본 형태)
            vertices.push(point.tip.x, point.tip.y, point.tip.z);
            vertices.push(point.base.x, point.base.y, point.base.z);

            // UV 좌표
            const u = i / (this.trailPoints.length - 1);
            uvs.push(u, 0);
            uvs.push(u, 1);

            // 색상 (알파값 포함)
            colors.push(1, 1, 1, alpha);
            colors.push(1, 1, 1, alpha);

            // 인덱스 (삼각형 생성)
            if (i < this.trailPoints.length - 1) {
                const base = i * 2;
                indices.push(base, base + 1, base + 2);
                indices.push(base + 1, base + 3, base + 2);
            }
        }

        if (vertices.length === 0) return;

        // 지오메트리 생성
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
        geometry.setIndex(indices);

        // 머티리얼 생성
        const material = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            blending: THREE.NormalBlending,
            depthWrite: false,
            vertexColors: true
        });

        // 메쉬 생성 및 추가
        const mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);
        this.trailMeshes.push(mesh);
    }

    // 정리
    dispose() {
        this.stop();
        this.trailMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        this.trailMeshes = [];
        this.trailPoints = [];
        if (this.texture) this.texture.dispose();
    }
}
