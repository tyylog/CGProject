// src/index.js
import { Game } from './core/Game.js';

const DEBUG_MODE = false;

if (DEBUG_MODE) {
    document.getElementById("start-screen")?.remove();
    document.getElementById("begin-screen")?.remove();
}

const STORAGE_VERSION = 'v0';  // 🔥 업데이트할 때마다 증가
const STORAGE_VERSION_KEY = 'cgproject_storage_version';

const savedVersion = localStorage.getItem(STORAGE_VERSION_KEY);

if (savedVersion !== STORAGE_VERSION) {
  // 이 프로젝트에서 쓰는 키만 정리
  localStorage.removeItem('cgproject_bestScore');

  localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
}

const game = new Game({ debug: DEBUG_MODE});
game.uiSystem.setGame(game);

// ===== 탭 비활성 감지 =====
document.addEventListener("visibilitychange", () => {
  game.setVisibilityPaused(document.hidden);
});