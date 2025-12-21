// effects/SwordTrail.js
import * as THREE from 'three';

export class SwordTrail {
    constructor(scene, swordMesh, texturePath = './assets/images/fire.png', options = {}) {
    this.scene = scene;
    this.swordMesh = swordMesh;
    this.isActive = false;

    // 포인트
    this.trailPoints = [];
    this.maxPoints = options.maxPoints ?? 20;

    // 오프셋
    const scale = options.scale || 1.0;
    this.tipOffset  = options.tipOffset  || new THREE.Vector3(0, 0, 2.0 * scale);
    this.baseOffset = options.baseOffset || new THREE.Vector3(0, 0, 0.4 * scale);

    // 텍스처 (TextureLoader는 내부적으로 캐시하긴 하지만, 그래도 dispose는 명확히)
    this.texture = new THREE.TextureLoader().load(texturePath);

    // ====== 1회 생성: geometry/material/mesh ======
    // 정점: 포인트당 2개 (tip, base)
    const maxVerts = this.maxPoints * 2;
    // 인덱스: (N-1) 세그먼트 * 2 triangles * 3 = 6*(N-1)
    const maxIndices = 6 * (this.maxPoints - 1);

    this._positions = new Float32Array(maxVerts * 3);
    this._uvs       = new Float32Array(maxVerts * 2);
    this._colors    = new Float32Array(maxVerts * 4);
    this._indices   = new Uint16Array(maxIndices); // maxPoints 20이면 충분히 16bit

    this.geometry = new THREE.BufferGeometry();

    const posAttr = new THREE.BufferAttribute(this._positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', posAttr);

    const uvAttr = new THREE.BufferAttribute(this._uvs, 2);
    uvAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('uv', uvAttr);

    const colAttr = new THREE.BufferAttribute(this._colors, 4);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('color', colAttr);

    const idxAttr = new THREE.BufferAttribute(this._indices, 1);
    idxAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setIndex(idxAttr);

    // 처음엔 아무것도 안 그리게
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      depthWrite: false,
      vertexColors: true
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false; // 트레일은 바운딩 계산 귀찮으면 끄는 게 안정적
    this.scene.add(this.mesh);

    // 임시 벡터 재사용 (GC 줄이기)
    this._tmpTip  = new THREE.Vector3();
    this._tmpBase = new THREE.Vector3();
  }

  getSwordWorldPositions() {
    if (!this.swordMesh) return null;

    this.swordMesh.updateMatrixWorld(true);

    // clone() 남발 금지: tmp 벡터 재사용
    this._tmpTip.copy(this.tipOffset).applyMatrix4(this.swordMesh.matrixWorld);
    this._tmpBase.copy(this.baseOffset).applyMatrix4(this.swordMesh.matrixWorld);

    return { tip: this._tmpTip, base: this._tmpBase };
  }

  start() {
    this.isActive = true;
    this.trailPoints.length = 0;
    this.geometry.setDrawRange(0, 0);
  }

  stop() {
    this.isActive = false;
    // 원하면 stop 시 즉시 사라지게:
    // this.trailPoints.length = 0;
    // this.geometry.setDrawRange(0, 0);
  }

  update(delta) {
    if (this.isActive && this.swordMesh) {
      const positions = this.getSwordWorldPositions();
      if (positions) {
        // 여기서도 clone 최소화: 필요한 값만 숫자로 저장
        this.trailPoints.push({
          tipX: positions.tip.x,  tipY: positions.tip.y,  tipZ: positions.tip.z,
          baseX: positions.base.x, baseY: positions.base.y, baseZ: positions.base.z,
          life: 1.0
        });

    // 검의 월드 위치 가져오기
        if (this.trailPoints.length > this.maxPoints) {
          this.trailPoints.shift();
        }
      }
    }
        // life 감소 + 필터링 (배열 새로 만들지 말고 in-place로)
    for (let i = 0; i < this.trailPoints.length; i++) {
      this.trailPoints[i].life -= delta * 3.0;
    }
    // 뒤에서부터 제거
    for (let i = this.trailPoints.length - 1; i >= 0; i--) {
      if (this.trailPoints[i].life <= 0) this.trailPoints.splice(i, 1);
    }

        this._updateTrailBuffers();
        }

        _updateTrailBuffers() {
    const n = this.trailPoints.length;

        if (n < 2) {
      this.geometry.setDrawRange(0, 0);
      return;
    }

    // 궤적 시작
    // vertices / uvs / colors 채우기
    for (let i = 0; i < n; i++) {
      const p = this.trailPoints[i];
      const alpha = p.life;
      const u = i / (n - 1);

      const vBase = i * 2;

      // tip vertex
      let pi = (vBase + 0) * 3;
      this._positions[pi + 0] = p.tipX;
      this._positions[pi + 1] = p.tipY;
      this._positions[pi + 2] = p.tipZ;

      // base vertex
      pi = (vBase + 1) * 3;
      this._positions[pi + 0] = p.baseX;
      this._positions[pi + 1] = p.baseY;
      this._positions[pi + 2] = p.baseZ;

      // uvs
      let ui = (vBase + 0) * 2;
      this._uvs[ui + 0] = u; this._uvs[ui + 1] = 0;

      ui = (vBase + 1) * 2;
      this._uvs[ui + 0] = u; this._uvs[ui + 1] = 1;

      // colors (rgba)
      let ci = (vBase + 0) * 4;
      this._colors[ci + 0] = 1;
      this._colors[ci + 1] = 1;
      this._colors[ci + 2] = 1;
      this._colors[ci + 3] = alpha;

      ci = (vBase + 1) * 4;
      this._colors[ci + 0] = 1;
      this._colors[ci + 1] = 1;
      this._colors[ci + 2] = 1;
      this._colors[ci + 3] = alpha;
    }

    // indices 채우기 (세그먼트 수 = n-1)
    let idx = 0;
    for (let i = 0; i < n - 1; i++) {
      const base = i * 2;
      this._indices[idx++] = base;
      this._indices[idx++] = base + 1;
      this._indices[idx++] = base + 2;

      this._indices[idx++] = base + 1;
      this._indices[idx++] = base + 3;
      this._indices[idx++] = base + 2;
    }

        // 업데이트 플래그
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.index.needsUpdate = true;
    

        // 실제 그릴 인덱스 수만
    this.geometry.setDrawRange(0, idx);

        // 바운딩 업데이트(선택): frustumCulled=false면 생략 가능
    // this.geometry.computeBoundingSphere();
  }
    dispose() {
    this.stop();
    this.trailPoints.length = 0;
        
        if (this.mesh) {
      if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
      this.mesh = null;
    }
        if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
        

        if (this.material) {
      this.material.dispose();
      this.material = null;
    }

    // 정리
    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
    this.swordMesh = null;
    this.scene = null;
  }
}
