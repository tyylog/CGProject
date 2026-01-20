import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// === 1) DB 파일 위치(배포/업데이트해도 유지되게 프로젝트 밖에 두는 걸 추천) ===
// 필요하면 환경변수로 바꿀 수 있게 해둠.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR  = process.env.DB_DIR || path.join(__dirname, "data");
const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, "leaderboard.db");

// DB 폴더가 없으면 생성
fs.mkdirSync(DB_DIR, { recursive: true });

// === 2) SQLite 연결 ===
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");      // 동시성 좀 더 안전
db.pragma("synchronous = NORMAL");    // 성능/안정 밸런스

// === 3) 테이블 생성 ===
// - players: 플레이어 고정 정보(닉네임)
// - scores: 최고점(업데이트), 업데이트 시간
db.exec(`
CREATE TABLE IF NOT EXISTS players (
  player_id TEXT PRIMARY KEY,
  nickname  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scores (
  player_id TEXT PRIMARY KEY,
  best_score INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(player_id) REFERENCES players(player_id)
);

CREATE INDEX IF NOT EXISTS idx_scores_best ON scores(best_score DESC, updated_at ASC);
`);

// === 4) Express ===
const app = express();
app.set("trust proxy", 1);

// JSON 바디 파서
app.use(express.json({ limit: "64kb" }));

// CORS: 처음엔 전체 허용(빠르게 개발)
// 배포 후엔 아래에서 origin을 GitHub Pages 도메인으로 좁히는 걸 추천
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*"
}));

// 간단 레이트 리밋(과도한 요청 방지)
app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200, // 15분에 200회
  standardHeaders: "draft-7",
  legacyHeaders: false
}));

// 헬스체크
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, db: DB_PATH });
});

// === 유틸: 입력 검증 ===
function isValidPlayerId(s) {
  // UUID 형태가 아니어도 되지만, 너무 길거나 이상한 값은 차단
  return typeof s === "string" && s.length >= 8 && s.length <= 64 && /^[a-zA-Z0-9-_]+$/.test(s);
}
function isValidNickname(s) {
  return typeof s === "string" && s.trim().length >= 1 && s.trim().length <= 20;
}
function isValidScore(n) {
  return Number.isInteger(n) && n >= 0 && n <= 100000000; // 상한선은 게임에 맞게 조절
}

// === prepared statements ===
const upsertPlayer = db.prepare(`
INSERT INTO players(player_id, nickname)
VALUES(?, ?)
ON CONFLICT(player_id) DO UPDATE SET nickname=excluded.nickname
`);

const getBest = db.prepare(`SELECT best_score FROM scores WHERE player_id=?`);

const upsertBest = db.prepare(`
INSERT INTO scores(player_id, best_score, updated_at)
VALUES(?, ?, datetime('now'))
ON CONFLICT(player_id) DO UPDATE SET
  best_score = CASE WHEN excluded.best_score > scores.best_score THEN excluded.best_score ELSE scores.best_score END,
  updated_at = CASE WHEN excluded.best_score > scores.best_score THEN datetime('now') ELSE scores.updated_at END
`);

const topN = db.prepare(`
SELECT p.nickname, s.best_score AS score
FROM scores s
JOIN players p ON p.player_id = s.player_id
ORDER BY s.best_score DESC, s.updated_at ASC
LIMIT ?
`);

const myRankStmt = db.prepare(`
SELECT
  s.best_score AS score,
  1 + (SELECT COUNT(*) FROM scores s2 WHERE s2.best_score > s.best_score) AS rank
FROM scores s
WHERE s.player_id = ?
`);

const myNickStmt = db.prepare(`SELECT nickname FROM players WHERE player_id=?`);

// === 5) API: 점수 제출 ===
app.post("/api/score", (req, res) => {
  const { playerId, nickname, score } = req.body ?? {};

  if (!isValidPlayerId(playerId)) {
    return res.status(400).json({ ok: false, error: "Invalid playerId" });
  }
  if (!isValidNickname(nickname)) {
    return res.status(400).json({ ok: false, error: "Invalid nickname (1~20 chars)" });
  }
  if (!isValidScore(score)) {
    return res.status(400).json({ ok: false, error: "Invalid score" });
  }

  // 트랜잭션으로 묶기
  const tx = db.transaction(() => {
    upsertPlayer.run(playerId, nickname.trim());
    upsertBest.run(playerId, score);

    const bestNow = getBest.get(playerId)?.best_score ?? score;
    const myRank = myRankStmt.get(playerId) ?? null;

    return { bestNow, myRank };
  });

  try {
    const { bestNow, myRank } = tx();
    res.json({
      ok: true,
      accepted: score >= bestNow ? true : (score === bestNow), // 참고용
      bestScore: bestNow,
      rank: myRank?.rank ?? null
    });
  } catch (e) {
    console.error("POST /api/score error:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// === 6) API: 리더보드 조회 ===
app.get("/api/leaderboard", (req, res) => {
  let limit = 10;
  if (req.query.limit) {
    const n = Number(req.query.limit);
    if (Number.isFinite(n)) limit = Math.min(Math.max(1, Math.floor(n)), 100);
  }

  try {
    const rows = topN.all(limit).map((r, idx) => ({
      rank: idx + 1,
      nickname: r.nickname,
      score: r.score
    }));
    res.json(rows);
  } catch (e) {
    console.error("GET /api/leaderboard error:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// === 7) API: 내 순위 조회 ===
app.get("/api/me", (req, res) => {
  const playerId = req.query.playerId;

  if (!isValidPlayerId(playerId)) {
    return res.status(400).json({ ok: false, error: "Invalid playerId" });
  }

  try {
    const nick = myNickStmt.get(playerId)?.nickname ?? null;
    const info = myRankStmt.get(playerId) ?? null;

    res.json({
      ok: true,
      playerId,
      nickname: nick,
      bestScore: info?.score ?? null,
      rank: info?.rank ?? null
    });
  } catch (e) {
    console.error("GET /api/me error:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// === 8) 시작 ===
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Leaderboard server running on :${PORT}`);
  console.log(`DB: ${DB_PATH}`);
});

