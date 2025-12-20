// src/systems/SoundSystem.js

export class SoundSystem {
    constructor() {
        // 배경음악
        this.bgm = new Audio();
        this.bgm.loop = false;  // 루프 재생 안 함
        this.bgm.volume = 0.3;  // 배경음 볼륨 (0.0 ~ 1.0)

        // 효과음 저장소
        this.sfx = new Map();

        // 🔥 오디오 풀 (효과음별 재사용 가능한 Audio 객체들)
        this.sfxPools = new Map();
        this.poolSize = 4;  // 각 효과음당 최대 동시 재생 수

        // 재생 상태
        this.isBGMLoaded = false;
        this.isMuted = false;
    }

    /**
     * 배경음악 로드
     * @param {string} path - 음악 파일 경로
     */
    loadBGM(path) {
        this.bgm.src = path;
        this.bgm.load();
        this.isBGMLoaded = true;
    }

    /**
     * 배경음악 재생
     */
    playBGM() {
        if (!this.isBGMLoaded) {
            console.warn('BGM not loaded');
            return;
        }

        // 브라우저 autoplay 정책 때문에 catch 필요
        this.bgm.play().catch(e => {
            console.log('BGM autoplay blocked. User interaction required:', e);
        });
    }

    /**
     * 배경음악 일시정지
     */
    pauseBGM() {
        this.bgm.pause();
    }

    /**
     * 배경음악 정지 (처음부터 다시 시작)
     */
    stopBGM() {
        this.bgm.pause();
        this.bgm.currentTime = 0;
    }

    /**
     * 배경음악 볼륨 설정
     * @param {number} volume - 0.0 ~ 1.0
     */
    setBGMVolume(volume) {
        this.bgm.volume = Math.max(0, Math.min(1, volume));
    }

    /**
     * 효과음 로드 (풀링용 Audio 객체들 미리 생성)
     * @param {string} name - 효과음 이름
     * @param {string} path - 파일 경로
     * @param {number} volume - 볼륨 (기본 1.0)
     */
    loadSFX(name, path, volume = 1.0) {
        const audio = new Audio(path);
        audio.volume = volume;
        this.sfx.set(name, { path, volume });

        // 🔥 풀 미리 생성
        const pool = [];
        for (let i = 0; i < this.poolSize; i++) {
            const pooledAudio = new Audio(path);
            pooledAudio.volume = volume;
            pool.push(pooledAudio);
        }
        this.sfxPools.set(name, pool);
    }

    /**
     * 효과음 재생 (풀링 사용)
     * @param {string} name - 효과음 이름
     */
    playSFX(name) {
        const pool = this.sfxPools.get(name);
        if (!pool) return;

        // 🔥 풀에서 재생 가능한(일시정지 상태 또는 재생 완료) Audio 찾기
        for (const audio of pool) {
            if (audio.paused || audio.ended) {
                audio.currentTime = 0;
                audio.play().catch(() => {});
                return;
            }
        }
        // 모든 슬롯이 재생 중이면 무시 (동시 재생 제한)
    }

    /**
     * 모든 사운드 음소거/해제
     * @param {boolean} muted
     */
    setMuted(muted) {
        this.isMuted = muted;
        this.bgm.muted = muted;
        // 🔥 풀의 모든 Audio 객체에도 muted 적용
        this.sfxPools.forEach(pool => {
            pool.forEach(audio => {
                audio.muted = muted;
            });
        });
    }

    /**
     * 배경음악 재생 중인지 확인
     * @returns {boolean}
     */
    isBGMPlaying() {
        return !this.bgm.paused;
    }
}
