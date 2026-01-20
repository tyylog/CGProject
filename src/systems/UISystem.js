// src/systems/UISystem.js
import { LEADERBOARD_BASE_URL, getOrCreatePlayerId, getOrAskNickname } from "../config/leaderboardConfig.js";

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

        // ✅ 핵심: 컨테이너를 relative로
        this.hpContainer.style.position = 'relative';
        this.hpContainer.style.overflow = 'hidden'; // 바 줄어들 때 깔끔

        this.hpBar = document.createElement('div');
        this.hpBar.style.height = '100%';
        this.hpBar.style.width = '100%';
        this.hpBar.style.background = '#ff4444';

        // ✅ 바를 뒤에 깔기 (optional이지만 안전)
        this.hpBar.style.position = 'absolute';
        this.hpBar.style.left = '0';
        this.hpBar.style.top = '0';
        this.hpBar.style.zIndex = '1';

        this.hpContainer.appendChild(this.hpBar);

        // ✅ HP 텍스트를 바 위에 올리기
        this.hpBarText = document.createElement('div');
        Object.assign(this.hpBarText.style, {
            position: 'absolute',
            inset: '0',                 // top/right/bottom/left = 0
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            fontSize: '14px',
            fontWeight: '600',
            color: '#fff',
            zIndex: '2',
            textShadow: '0 0 4px rgba(0,0,0,0.9)',
            pointerEvents: 'none',
        });

        this.hpBarText.textContent = '0%';
        this.hpBarText.style.paddingLeft = '2px';
        this.hpBarText.style.boxSizing = 'border-box';
        this.hpContainer.appendChild(this.hpBarText);

        // ============================
        // STAMINA 바
        // ============================
        this.staminaContainer = document.createElement('div');
        this.staminaContainer.style.width = '360px';
        this.staminaContainer.style.height = '4px';
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
        // score 텍스트 (우측 상단)
        // ============================
        this.scoreTopText = document.createElement('div');
        this.scoreTopText.style.position = 'fixed';
        this.scoreTopText.style.top = '10px';
        this.scoreTopText.style.right = '20px';

        this.scoreTopText.style.fontSize = '32px';
        this.scoreTopText.style.fontWeight = 'bold';
        this.scoreTopText.style.letterSpacing = '2px';
        this.scoreTopText.style.fontFamily = 'monospace';
        this.scoreTopText.style.color = '#ffffff';
        this.scoreTopText.style.textShadow = '0 0 10px rgba(0,0,0,0.9)';
        this.scoreTopText.style.zIndex = '1000';

        // 배경(optional, TIME이랑 통일)
        this.scoreTopText.style.background = 'rgba(0,0,0,0.4)';
        this.scoreTopText.style.padding = '6px 14px';
        this.scoreTopText.style.borderRadius = '6px';

        this.scoreTopText.textContent = 'SCORE: 0';

        document.body.appendChild(this.scoreTopText);

        // ============================
        // 경과 시간
        // ============================
        this.timeText = document.createElement('div');
        this.timeText.style.fontSize = '14px';

        this.timeText.style.position = 'fixed';
        this.timeText.style.top = '10px';
        this.timeText.style.left = '50%';
        this.timeText.style.transform = 'translateX(-50%)';

        this.timeText.style.fontSize = '32px';
        this.timeText.style.fontWeight = 'bold';
        this.timeText.style.letterSpacing = '2px';
        this.timeText.style.textShadow = '0 0 10px rgba(0,0,0,0.9)';
        this.timeText.style.zIndex = '1000';

        this.timeText.style.fontFamily = 'monospace';
        this.timeText.style.background = 'rgba(0,0,0,0.4)';
        this.timeText.style.padding = '6px 14px';
        this.timeText.style.borderRadius = '6px';

        // ============================
        // 🧪 포션 UI (좌측 하단: 슬롯 + 아이콘 + 숫자)
        // ============================
        this.potionContainer = document.createElement('div');
            Object.assign(this.potionContainer.style, {
            position: 'relative',
            width: '72px',     // 슬롯 크기
            height: '72px',
            background: '#7a7a7a',   // 회색 슬롯
            border: '3px solid rgba(255,255,255,0.35)',
            borderRadius: '6px',
            boxShadow: '0 0 10px rgba(0,0,0,0.35)',
            zIndex: 999,

            pointerEvents: 'none',
        });

        // 아이콘 이미지 (중앙)
        this.potionIcon = document.createElement('img');
        this.potionIcon.src = './assets/images/potion.png';
        Object.assign(this.potionIcon.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%) rotate(30deg)',

            width: '52px',     // 아이콘 크기
            height: '52px',
            objectFit: 'contain',

            // 픽셀 느낌 원하면 켜기
            imageRendering: 'pixelated',

            filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))',
        });

        // 우하단 숫자
        this.potionCountText = document.createElement('div');
        Object.assign(this.potionCountText.style, {
            position: 'absolute',
            right: '6px',
            bottom: '4px',

            color: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            fontWeight: '900',
        });

        this.potionContainer.appendChild(this.potionIcon);
        this.potionContainer.appendChild(this.potionCountText);

        // ============================
        // 🔥 강공격 쿨타임 UI (포션 옆)
        // ============================
        this.heavyAttackContainer = document.createElement('div');
        Object.assign(this.heavyAttackContainer.style, {
            position: 'relative',
            width: '72px',
            height: '72px',
            background: '#7a7a7a',
            border: '3px solid rgba(255,255,255,0.35)',
            borderRadius: '6px',
            boxShadow: '0 0 10px rgba(0,0,0,0.35)',
            marginLeft: '10px',
            zIndex: 999,
            pointerEvents: 'none',
        });

        // 강공격 아이콘 (이미지)
        this.heavyAttackIcon = document.createElement('img');
        this.heavyAttackIcon.src = './assets/images/strongattack.png';
        Object.assign(this.heavyAttackIcon.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '52px',
            height: '52px',
            objectFit: 'contain',
            imageRendering: 'pixelated',
            filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))',
        });

        // 쿨타임 오버레이 (어둡게 덮음)
        this.heavyAttackOverlay = document.createElement('div');
        Object.assign(this.heavyAttackOverlay.style, {
            position: 'absolute',
            bottom: '0',
            left: '0',
            width: '100%',
            height: '0%',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: '3px',
            transition: 'height 0.1s linear',
        });

        // 쿨타임 텍스트
        this.heavyAttackCooldownText = document.createElement('div');
        Object.assign(this.heavyAttackCooldownText.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            fontWeight: '900',
            textShadow: '0 0 3px rgba(0,0,0,0.9)',
            zIndex: '10',
        });

        this.heavyAttackContainer.appendChild(this.heavyAttackOverlay);
        this.heavyAttackContainer.appendChild(this.heavyAttackIcon);
        this.heavyAttackContainer.appendChild(this.heavyAttackCooldownText);

        // ============================
        // 🔥 JumpAttack(R키) 쿨타임 UI (강공격 옆)
        // ============================
        this.jumpAttackContainer = document.createElement('div');
        Object.assign(this.jumpAttackContainer.style, {
            position: 'relative',
            width: '72px',
            height: '72px',
            background: '#7a7a7a',
            border: '3px solid rgba(255,255,255,0.35)',
            borderRadius: '6px',
            boxShadow: '0 0 10px rgba(0,0,0,0.35)',
            marginLeft: '10px',
            zIndex: 999,
            pointerEvents: 'none',
        });

        // JumpAttack 아이콘 (이미지)
        this.jumpAttackIcon = document.createElement('img');
        this.jumpAttackIcon.src = './assets/images/jumpattack.png';
        Object.assign(this.jumpAttackIcon.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '52px',
            height: '52px',
            objectFit: 'contain',
            imageRendering: 'pixelated',
            filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))',
        });

        // 쿨타임 오버레이 (어둡게 덮음)
        this.jumpAttackOverlay = document.createElement('div');
        Object.assign(this.jumpAttackOverlay.style, {
            position: 'absolute',
            bottom: '0',
            left: '0',
            width: '100%',
            height: '0%',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: '3px',
            transition: 'height 0.1s linear',
        });

        // 쿨타임 텍스트
        this.jumpAttackCooldownText = document.createElement('div');
        Object.assign(this.jumpAttackCooldownText.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            fontWeight: '900',
            textShadow: '0 0 3px rgba(0,0,0,0.9)',
            zIndex: '10',
        });

        this.jumpAttackContainer.appendChild(this.jumpAttackOverlay);
        this.jumpAttackContainer.appendChild(this.jumpAttackIcon);
        this.jumpAttackContainer.appendChild(this.jumpAttackCooldownText);

        // ============================
        // 키 힌트 스타일 헬퍼
        // ============================
        const createKeyHint = (text) => {
            const hint = document.createElement('div');
            Object.assign(hint.style, {
                textAlign: 'center',
                marginTop: '4px',
                fontSize: '12px',
                fontWeight: '700',
                color: 'rgba(255,255,255,0.85)',
                textShadow: '0 0 3px rgba(0,0,0,0.9)',
            });
            hint.textContent = text;
            return hint;
        };

        // 스킬 래퍼 (아이콘 + 키 힌트)
        const createSkillWrapper = (container, hintElement) => {
            const wrapper = document.createElement('div');
            Object.assign(wrapper.style, {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            });
            wrapper.appendChild(container);
            wrapper.appendChild(hintElement);
            return wrapper;
        };

        // 포션 래퍼 (키: 1)
        this.potionWrapper = createSkillWrapper(this.potionContainer, createKeyHint('Q'));

        // 강공격 래퍼 (키: 마우스 오른쪽)
        const heavyHint = document.createElement('div');
        Object.assign(heavyHint.style, {
            textAlign: 'center',
            marginTop: '4px',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.85)',
            textShadow: '0 0 3px rgba(0,0,0,0.9)',
        });
        heavyHint.innerHTML = '🖱️Right';  // 마우스 오른쪽 아이콘
        this.heavyAttackWrapper = createSkillWrapper(this.heavyAttackContainer, heavyHint);
        this.heavyAttackWrapper.style.marginLeft = '10px';

        // JumpAttack 래퍼 (키: R)
        this.jumpAttackWrapper = createSkillWrapper(this.jumpAttackContainer, createKeyHint('R'));
        this.jumpAttackWrapper.style.marginLeft = '10px';

        // 포션과 강공격을 담을 가로 컨테이너
        this.skillContainer = document.createElement('div');
        Object.assign(this.skillContainer.style, {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
        });
        this.skillContainer.appendChild(this.potionWrapper);
        this.skillContainer.appendChild(this.heavyAttackWrapper);
        this.skillContainer.appendChild(this.jumpAttackWrapper);

        // ============================
        // 게임 오버 텍스트
        // ============================

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

        // ============================
        // phase 토스트 메시지
        // ============================ 
        this.phaseToast = document.createElement('div');
        Object.assign(this.phaseToast.style, {
            position: 'fixed',
            top: '100px',               // TIME 아래쪽 느낌
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: 'monospace',
            fontSize: '56px',
            fontWeight: 'bold',
            letterSpacing: '2px',
            color: '#fff',
            background: 'rgba(0,0,0,0.35)',
            padding: '20px 36px',
            borderRadius: '16px',
            textShadow: '0 0 16px rgba(0,0,0,0.95)',
            zIndex: '2000',
            opacity: '0',
            transition: 'opacity 0.35s ease',
            pointerEvents: 'none',
        });
        this.phaseToast.textContent = '';
        document.body.appendChild(this.phaseToast);

        this._phaseToastTimer = null;

        // root에 추가
        this.root.appendChild(this.hpContainer);
        this.root.appendChild(this.staminaContainer);
        this.root.appendChild(this.skillContainer);
        this.root.appendChild(this.timeText);

        // 디버그 모드 패널
        this.debugMode = DEBUG_MODE;
        if (this.debugMode) {
            this._setupDebugPanel();
        }

        // 리더보드 관련
        this.game = null;
        this.gameOverOverlay = null;

        // ============================
        // ✅ Game Over Overlay (입력 가능)
        // ============================
        this.gameOverOverlay = document.createElement('div');
        Object.assign(this.gameOverOverlay.style, {
            position: 'fixed',
            inset: '0',
            background: 'rgba(0,0,0,0.65)',
            display: 'none',
            zIndex: 5000,
            pointerEvents: 'auto', // ✅ 얘만 입력 받음
        });

        this.gameOverPanel = document.createElement('div');
        Object.assign(this.gameOverPanel.style, {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '520px',
            maxWidth: '90vw',
            padding: '22px 22px',
            borderRadius: '14px',
            background: 'rgba(0,0,0,0.55)',
            boxShadow: '0 0 18px rgba(0,0,0,0.8)',
            color: '#fff',
            fontFamily: 'monospace',
        });

        this.gameOverTitle = document.createElement('div');
        this.gameOverTitle.textContent = 'GAME OVER';
        Object.assign(this.gameOverTitle.style, {
            fontSize: '56px',
            fontWeight: '900',
            textAlign: 'center',
            marginBottom: '12px',
            color: '#ff4444',
            textShadow: '0 0 14px rgba(0,0,0,0.9)',
        });

        this.finalScoreText = document.createElement('div');
        Object.assign(this.finalScoreText.style, {
            textAlign: 'center',
            fontSize: '24px',
            marginBottom: '14px',
        });

        this.bestScoreInfoText = document.createElement('div');
        Object.assign(this.bestScoreInfoText.style, {
            textAlign: 'center',
            fontSize: '14px',
            lineHeight: '1.4',
            opacity: '0.85',
            marginBottom: '10px',
            color: '#ddd',
        });

        this.nicknameRow = document.createElement('div');
        Object.assign(this.nicknameRow.style, {
            display: 'flex',
            gap: '8px',
            marginBottom: '12px',
        });

        this.nicknameInput = document.createElement('input');
        this.nicknameInput.placeholder = 'nickname (1~20)';
        Object.assign(this.nicknameInput.style, {
            flex: '1',
            padding: '10px 12px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            outline: 'none',
        });

        this.submitBtn = document.createElement('button');
        this.submitBtn.textContent = 'SUBMIT';
        Object.assign(this.submitBtn.style, {
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.12)',
            color: '#fff',
            cursor: 'pointer',
        });

        this.retryBtn = document.createElement('button');
        this.retryBtn.textContent = 'RETRY';
        Object.assign(this.retryBtn.style, {
            width: '100%',
            marginTop: '10px',
            padding: '12px 14px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.12)',
            color: '#fff',
            fontSize: '18px',
            cursor: 'pointer',
        });

        this.leaderboardBox = document.createElement('div');
        Object.assign(this.leaderboardBox.style, {
            marginTop: '14px',
            padding: '12px',
            borderRadius: '12px',
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.12)',
            fontSize: '16px',
            whiteSpace: 'normal',
            minHeight: '120px',
        });

        this.gameOverPanel.appendChild(this.gameOverTitle);
        this.gameOverPanel.appendChild(this.finalScoreText);
        this.gameOverPanel.appendChild(this.bestScoreInfoText);
        this.nicknameRow.appendChild(this.nicknameInput);
        this.nicknameRow.appendChild(this.submitBtn);
        this.gameOverPanel.appendChild(this.nicknameRow);
        this.gameOverPanel.appendChild(this.leaderboardBox);
        this.gameOverPanel.appendChild(this.retryBtn);
        this.gameOverOverlay.appendChild(this.gameOverPanel);
        document.body.appendChild(this.gameOverOverlay);


    }

    /**
     * @param {object} data
     * @param {number} data.hp
     * @param {number} data.maxHp
     * @param {number} data.stamina
     * @param {number} data.maxStamina
     * @param {number} data.killCount
     * @param {number} data.elapsedTime  (초 단위)
     * @param {number} data.potionCount  (소지한 포션 개수)
     * @param {number} data.heavyAttackCooldown  (강공격 최대 쿨타임)
     * @param {number} data.heavyAttackTimer  (강공격 현재 쿨타임)
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
            elapsedTime = 0,
            potionCount = 0,
            heavyAttackCooldown = 3.0,
            heavyAttackTimer = 0,
            jumpAttackCooldown = 15.0,
            jumpAttackTimer = 0,
            debugInfo,
        } = data;

        // HP 바 비율 반영
        const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
        this.hpBar.style.width = (hpRatio * 100) + '%';

        // HP 텍스트 (바 내부)
        if (this.hpBarText) {
            this.hpBarText.textContent = `${Math.round(hpRatio * 100)}%`;
        }

        // STAMINA 바 비율 반영
        const stRatio = maxStamina > 0 ? Math.max(0, Math.min(1, stamina / maxStamina)) : 0;
        this.staminaBar.style.width = (stRatio * 100) + '%';

        // STAMINA 텍스트
        this.staminaText.textContent = `STA: ${Math.floor(stamina)} / ${maxStamina}`;

        // score 텍스트
        const timeScore = Math.floor(elapsedTime) * 100; // 1초마다 +100
        const killScore = killCount * 200;               // 킬당 +200
        this.score = killScore + timeScore;
        this.scoreTopText.textContent = `SCORE: ${this.score}`;

        // 시간 표시 (MM:SS)
        const t = Math.floor(elapsedTime);
        const min = Math.floor(t / 60);
        const sec = (t % 60).toString().padStart(2, '0');
        this.timeText.textContent = `${min}:${sec}`;

        // 🧪 포션 개수 텍스트 갱신
        if (this.potionCountText) {
            this.potionCountText.textContent = `${potionCount}`;
        }

        // 🔥 강공격 쿨타임 UI 갱신
        if (this.heavyAttackOverlay && this.heavyAttackCooldownText) {
            if (heavyAttackTimer > 0) {
                // 쿨타임 중: 오버레이 높이를 쿨타임 비율만큼 표시
                const cooldownRatio = heavyAttackTimer / heavyAttackCooldown;
                this.heavyAttackOverlay.style.height = (cooldownRatio * 100) + '%';

                // 남은 시간 텍스트 표시 (소수점 첫째자리까지)
                this.heavyAttackCooldownText.textContent = heavyAttackTimer.toFixed(1);
                this.heavyAttackCooldownText.style.display = 'block';
            } else {
                // 쿨타임 끝: 오버레이 숨김
                this.heavyAttackOverlay.style.height = '0%';
                this.heavyAttackCooldownText.style.display = 'none';
            }
        }

        // 🔥 JumpAttack 쿨타임 UI 갱신
        if (this.jumpAttackOverlay && this.jumpAttackCooldownText) {
            if (jumpAttackTimer > 0) {
                // 쿨타임 중: 오버레이 높이를 쿨타임 비율만큼 표시
                const cooldownRatio = jumpAttackTimer / jumpAttackCooldown;
                this.jumpAttackOverlay.style.height = (cooldownRatio * 100) + '%';

                // 남은 시간 텍스트 표시 (소수점 첫째자리까지)
                this.jumpAttackCooldownText.textContent = jumpAttackTimer.toFixed(1);
                this.jumpAttackCooldownText.style.display = 'block';
            } else {
                // 쿨타임 끝: 오버레이 숨김
                this.jumpAttackOverlay.style.height = '0%';
                this.jumpAttackCooldownText.style.display = 'none';
            }
        }

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

    async showGameOver({ score, killCount, elapsedTime }) {
        if (document.pointerLockElement) document.exitPointerLock();
        document.body.style.cursor = 'default';

        const finalScore = Number(score) || 0;
        this.finalScoreToSubmit = finalScore;

        // ✅ overlay 표시
        this.gameOverOverlay.style.display = 'block';

        // 현재 점수
        this.finalScoreText.textContent = `Score: ${finalScore}`;

        // =========================
        // 🔥 최고 기록 계산
        // =========================
        const BEST_KEY = 'cgproject_bestScore';
        const prevBest = Number(localStorage.getItem(BEST_KEY)) || 0;
        const nextBest = Math.max(prevBest, finalScore);

        // 최고 기록 갱신
        if (finalScore > prevBest) {
            localStorage.setItem(BEST_KEY, String(finalScore));
        }

        // =========================
        // 🔎 설명 텍스트 구성
        // =========================
        if (finalScore > prevBest) {
            this.bestScoreInfoText.innerHTML =
                `🎉 <b>NEW RECORD!</b><br>
                현재 점수: ${finalScore} · 이전 내 최고 기록: ${prevBest}<br>
                <span style="opacity:0.8">SUBMIT 버튼을 눌러 최고 기록을 리더보드에 제출하세요.</span>`;
        } else {
            this.bestScoreInfoText.innerHTML =
                `현재 점수: ${finalScore}<br>
                내 최고 기록: ${prevBest}<br>
                <span style="opacity:0.8">※ 리더보드에는 최고 기록만 제출됩니다.</span>`;
        }

        // 닉네임 세팅
        const nickname = (getOrAskNickname?.() || '').trim();
        if (nickname && this.nicknameInput) this.nicknameInput.value = nickname;

        // 리더보드 로드
        this.leaderboardBox.textContent = 'Loading leaderboard...';
        try {
            const top = await fetch(`${LEADERBOARD_BASE_URL}/api/leaderboard?limit=10`)
                .then(r => {
                    if (!r.ok) throw new Error(`leaderboard HTTP ${r.status}`);
                    return r.json();
                });

            this._renderLeaderboardToBox(top);
        } catch (e) {
            console.error(e);
            this.leaderboardBox.textContent = 'Leaderboard load failed.';
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

    showPhaseToast(phaseIndex) {
        if (!this.phaseToast) return;

        this.phaseToast.textContent = `PHASE ${phaseIndex + 1}`;
        this.phaseToast.style.opacity = '1';

        if (this._phaseToastTimer) clearTimeout(this._phaseToastTimer);
        this._phaseToastTimer = setTimeout(() => {
            this.phaseToast.style.opacity = '0';
            }, 2500 // 2.5초 보여주고 사라짐
        );
    }

    
    setGame(game) {
        this.game = game;

        this.retryBtn.onclick = () => window.location.reload();

        this.submitBtn.onclick = async () => {
            const nickname = (this.nicknameInput.value || '').trim();
            if (nickname.length < 1 || nickname.length > 20) {
            this.leaderboardBox.textContent = '닉네임은 1~20 글자여야 합니다.';
            return;
            }

            const playerId = getOrCreatePlayerId();
            const score = this.finalScoreToSubmit ?? 0;

            try {
            this.leaderboardBox.textContent = 'Submitting...';

            const res = await fetch(`${LEADERBOARD_BASE_URL}/api/score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId, nickname, score }),
            });
            if (!res.ok) throw new Error(`score HTTP ${res.status}`);
            const j = await res.json();

            // 제출 후 Top10 다시 로드
            const top = await fetch(`${LEADERBOARD_BASE_URL}/api/leaderboard?limit=10`)
                .then(r => {
                if (!r.ok) throw new Error(`leaderboard HTTP ${r.status}`);
                return r.json();
                });

            this._renderLeaderboardToBox(top);

            } catch (e) {
            console.error(e);
            this.leaderboardBox.textContent = `Submit failed: ${e}`;
            }
        };

        this.nicknameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.submitBtn.click();
        });
    }

    _renderLeaderboardToBox(rows) {
        this.leaderboardBox.innerHTML = '';

        // ✅ 헤더
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'grid',
            gridTemplateColumns: '64px 1fr 100px', // 아래 row랑 반드시 동일
            columnGap: '10px',
            alignItems: 'center',
            paddingBottom: '6px',
            marginBottom: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.18)',
            opacity: '0.9',
            fontWeight: '900',
            fontSize: '14px',
            letterSpacing: '1px',
        });

        const hRank = document.createElement('div');
        hRank.textContent = 'RANK';

        const hName = document.createElement('div');
        hName.textContent = 'NICKNAME';

        const hScore = document.createElement('div');
        hScore.textContent = 'SCORE';
        hScore.style.textAlign = 'right';

        header.appendChild(hRank);
        header.appendChild(hName);
        header.appendChild(hScore);
        this.leaderboardBox.appendChild(header);

        // ✅ 데이터 row들
        (rows || []).forEach(r => {
            const row = document.createElement('div');
            Object.assign(row.style, {
            display: 'grid',
            gridTemplateColumns: '64px 1fr 100px',
            columnGap: '10px',
            alignItems: 'center',
            lineHeight: '1.5',
            padding: '2px 0',
            });

            const rank = document.createElement('div');
            rank.textContent = `#${r.rank}`;
            rank.style.fontWeight = '900';

            const name = document.createElement('div');
            name.textContent = r.nickname;
            name.style.overflow = 'hidden';
            name.style.textOverflow = 'ellipsis';
            name.style.whiteSpace = 'nowrap';

            const score = document.createElement('div');
            score.textContent = `${r.score}`;
            score.style.textAlign = 'right';
            score.style.fontWeight = '900';

            row.appendChild(rank);
            row.appendChild(name);
            row.appendChild(score);
            this.leaderboardBox.appendChild(row);
        });
        }


    _escape(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

}
