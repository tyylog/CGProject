// src/main.js
import { Game } from './core/Game.js';

const DEBUG_MODE = false;

if (DEBUG_MODE) {
    document.getElementById("start-screen")?.remove();
    document.getElementById("begin-screen")?.remove();
}

const game = new Game({ debug: DEBUG_MODE});
