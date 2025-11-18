// src/systems/UISystem.js
export class UISystem {
    constructor() {
        // --- 루트 컨테이너 ---
        this.root = document.createElement('div');
        this.root.style.position = 'fixed';
        this.root.style.top = '15px';
        this.root.style.left = '15px';
        this.root.style.zIndex = '999';
        this.root.style.color = '#fff';
        this.root.style.fontFamily = 'Arial, sans-serif';
        this.root.style.userSelect = 'none';
        this.root.style.pointerEvents = 'none';
        this.root.style.textShadow = '0 0 4px rgba(0,0,0,0.8)';
        document.body.appendChild(this.root);

        // ============================
        // HP 바
        // ============================
        this.hpContainer = document.createElement('div');
        this.hpContainer.style.width = '240px';
        this.hpContainer.style.height = '18px';
        this.hpContainer.style.border = '2px solid white';
        this.hpContainer.style.background = 'rgba(0,0,0,0.4)';
        this.hpContainer.style.marginBottom = '6px';
        this.hpBar = document.createElement('div');
        this.hpBar.style.height = '100%';
        this.hpBar.style.width = '100%';
        this.hpBar.style.background = '#ff4444';
        this.hpContainer.appendChild(this.hpBar);

        this.hpText = document.createElement('div');
        this.hpText.style.fontSize = '14px';
        this.hpText.style.marginBottom = '10px';

        // ============================
        // killCount + 레벨
        // ============================
        this.killText = document.createElement('div');
        this.killText.style.fontSize = '14px';
        this.killText.style.marginBottom = '10px';

        // ============================
        // 경과 시간
        // ============================
        this.timeText = document.createElement('div');
        this.timeText.style.fontSize = '14px';

        // root에 추가
        this.root.appendChild(this.hpContainer);
        this.root.appendChild(this.hpText);
        this.root.appendChild(this.killText);
        this.root.appendChild(this.timeText);

        // 게임 오버 텍스트
        this.gameOverText = document.createElement('div');
        this.gameOverText.style.position = 'fixed';
        this.gameOverText.style.top = '50%';
        this.gameOverText.style.left = '50%';
        this.gameOverText.style.transform = 'translate(-50%, -50%)';
        this.gameOverText.style.fontSize = '48px';
        this.gameOverText.style.fontWeight = 'bold';
        this.gameOverText.style.color = '#ff4444';
        this.gameOverText.style.textShadow = '0 0 10px black';
        this.gameOverText.style.display = 'none';
        this.gameOverText.textContent = 'GAME OVER';

        document.body.appendChild(this.gameOverText);
    }

    /**
     * @param {object} data
     * @param {number} data.hp
     * @param {number} data.maxHp
     * @param {number} data.killCount
     * @param {number} data.level
     * @param {number} data.elapsedTime  (초 단위)
     */
    update(data) {
        if (!data) return;

        const { hp = 0, maxHp = 100, killCount = 0, level = 1, elapsedTime = 0 } = data;

        // HP 바 비율 반영
        const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
        this.hpBar.style.width = (ratio * 100) + '%';

        // HP 텍스트
        this.hpText.textContent = `HP: ${hp} / ${maxHp}`;

        // EXP + 레벨
        this.killText.textContent = `LV ${level} | KILL: ${killCount}`;

        // 시간 표시 (MM:SS)
        const t = Math.floor(elapsedTime);
        const min = Math.floor(t / 60);
        const sec = (t % 60).toString().padStart(2, '0');
        this.timeText.textContent = `Time: ${min}:${sec}`;
    }

    showGameOver() {
        if (this.gameOverText) {
            this.gameOverText.style.display = 'block';
        }
    }
}
