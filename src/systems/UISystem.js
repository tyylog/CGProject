// src/systems/UISystem.js
export class UISystem {
    constructor(DEBUG_MODE = false) {
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
        this.hpContainer.style.width = '360px';
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
        // STAMINA 바
        // ============================
        this.staminaContainer = document.createElement('div');
        this.staminaContainer.style.width = '360px';
        this.staminaContainer.style.height = '6px';
        this.staminaContainer.style.border = '2px solid white';
        this.staminaContainer.style.background = 'rgba(0,0,0,0.4)';
        this.staminaContainer.style.marginBottom = '6px';

        this.staminaBar = document.createElement('div');
        this.staminaBar.style.height = '100%';
        this.staminaBar.style.width = '100%';
        this.staminaBar.style.background = '#e8eef1ff';
        this.staminaContainer.appendChild(this.staminaBar);

        this.staminaText = document.createElement('div');
        this.staminaText.style.fontSize = '14px';
        this.staminaText.style.marginBottom = '10px';

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
        this.root.appendChild(this.staminaContainer);
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

        // 디버그 모드 패널
        this.debugMode = DEBUG_MODE;
        if (this.debugMode) {
            this._setupDebugPanel();
        }
    }

    /**
     * @param {object} data
     * @param {number} data.hp
     * @param {number} data.maxHp
     * @param {number} data.stamina
     * @param {number} data.maxStamina
     * @param {number} data.killCount
     * @param {number} data.level
     * @param {number} data.elapsedTime  (초 단위)
     * @param {object} debugInfo  디버그 정보 객체
     */
    update(data) {
        if (!data) return;

        // stamina/maxStamina 추가 (기본값 지정)
        const {
            hp = 0,
            maxHp = 100,
            stamina = 100,
            maxStamina = 100,
            killCount = 0,
            level = 1,
            elapsedTime = 0,
            debugInfo,
        } = data;

        // HP 바 비율 반영
        const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
        this.hpBar.style.width = (hpRatio * 100) + '%';

        // HP 텍스트
        this.hpText.textContent = `HP: ${hp} / ${maxHp}`;

        // STAMINA 바 비율 반영
        const stRatio = maxStamina > 0 ? Math.max(0, Math.min(1, stamina / maxStamina)) : 0;
        this.staminaBar.style.width = (stRatio * 100) + '%';

        // STAMINA 텍스트
        this.staminaText.textContent = `STA: ${Math.floor(stamina)} / ${maxStamina}`;

        // EXP + 레벨
        this.killText.textContent = `LV ${level} | KILL: ${killCount}`;

        // 시간 표시 (MM:SS)
        const t = Math.floor(elapsedTime);
        const min = Math.floor(t / 60);
        const sec = (t % 60).toString().padStart(2, '0');
        this.timeText.textContent = `Time: ${min}:${sec}`;

        // 🔹 디버그 패널 갱신
        if (this.debugMode && this.debugEl && debugInfo) {
            const p = debugInfo.playerPos;
            const yawDeg = (debugInfo.playerYaw * 180 / Math.PI).toFixed(1);
            const b = debugInfo.bounds;

            let text =
                `DEBUG MODE\n` +
                `FPS      : ${debugInfo.fps.toFixed(1)}\n` +
                `Player   : (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})\n` +
                `Yaw      : ${yawDeg}°\n` +
                `Enemies  : ${debugInfo.enemyCount}\n` +
                `Mode     : ${debugInfo.modeName || '-'}\n` +
                `Time     : ${elapsedTime.toFixed(2)}s`;

            if (b) {
                text += `\nBounds   : X(${b.minX.toFixed(1)}, ${b.maxX.toFixed(1)}), `
                    +  `Z(${b.minZ.toFixed(1)}, ${b.maxZ.toFixed(1)})`;
            }

            this.debugEl.textContent = text;   // 🔥 if 블록 안에서만 실행되어야 한다!
        }

    }

    showGameOver() {
        if (this.gameOverText) {
            this.gameOverText.style.display = 'block';
        }
    }

    _setupDebugPanel() {
        this.debugEl = document.createElement('div');
        this.debugEl.id = 'debug-panel';
        Object.assign(this.debugEl.style, {
            position: 'fixed',
            right: '10px',
            bottom: '10px',
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.6)',
            color: '#0f0',
            fontFamily: 'monospace',
            fontSize: '12px',
            whiteSpace: 'pre',
            zIndex: 9999,
            pointerEvents: 'none',
        });
        document.body.appendChild(this.debugEl);
    }
}
