// src/systems/SoundSystem.js

export class SoundSystem {
    constructor() {
        // 배경음악
        this.bgm = new Audio();
        this.bgm.loop = false;  // 루프 재생 안 함
        this.bgm.volume = 0.3;  // 배경음 볼륨 (0.0 ~ 1.0)

        // 효과음 저장소
        this.sfx = new Map();

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
     * 효과음 로드
     * @param {string} name - 효과음 이름
     * @param {string} path - 파일 경로
     * @param {number} volume - 볼륨 (기본 1.0)
     */
    loadSFX(name, path, volume = 1.0) {
        const audio = new Audio(path);
        audio.volume = volume;
        this.sfx.set(name, audio);
    }

    /**
     * 효과음 재생
     * @param {string} name - 효과음 이름
     */
    playSFX(name) {
        const audio = this.sfx.get(name);
        if (audio) {
            // 새로운 Audio 인스턴스로 중복 재생 가능
            const sound = audio.cloneNode();
            sound.volume = audio.volume;
            sound.play().catch(e => console.log('SFX play failed:', e));
        }
    }

    /**
     * 모든 사운드 음소거/해제
     * @param {boolean} muted
     */
    setMuted(muted) {
        this.isMuted = muted;
        this.bgm.muted = muted;
        this.sfx.forEach(audio => {
            audio.muted = muted;
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
