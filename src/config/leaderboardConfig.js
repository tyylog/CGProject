// src/config/leaderboardConfig.js
export const LEADERBOARD_BASE_URL = "https://cgprojectleaderboard.duckdns.org:3000";

export function getOrCreatePlayerId() {
  const key = "cgproject_playerId";
  let id = localStorage.getItem(key);
  if (!id) {
    // 서버 검증: 8~64, [a-zA-Z0-9-_] 만
    id = `p_${crypto.randomUUID().replaceAll("-", "")}`.slice(0, 32);
    localStorage.setItem(key, id);
  }
  return id;
}

export function getOrAskNickname() {
  const key = "cgproject_nickname";
  let nick = localStorage.getItem(key);
  if (!nick) {
    nick = (prompt("닉네임을 입력하세요 (1~20자)") || "Player").trim();
    if (!nick) nick = "Player";
    nick = nick.slice(0, 20);
    localStorage.setItem(key, nick);
  }
  return nick;
}
