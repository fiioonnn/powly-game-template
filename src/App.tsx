import { useCallback, useEffect, useRef, useState } from "react";
import type { Connection } from "./main";
import {
  loadPlatformSnapshot,
  type PlatformSnapshot,
  previewSnapshot,
  recordRound,
} from "./platform";

const ROUND_MS = 15_000;

type Phase = "idle" | "playing" | "finished";
type Target = { x: number; y: number };

const nextTarget = (): Target => ({
  x: 12 + Math.random() * 76,
  y: 15 + Math.random() * 70,
});

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function App({ connection }: { connection: Connection }) {
  const { session } = connection;
  const [snapshot, setSnapshot] = useState<PlatformSnapshot>(previewSnapshot);
  const [loading, setLoading] = useState(Boolean(session));
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [remainingMs, setRemainingMs] = useState(ROUND_MS);
  const [target, setTarget] = useState<Target>(nextTarget);
  const [paused, setPaused] = useState(false);
  const [writeIssues, setWriteIssues] = useState<string[]>([]);
  const endsAt = useRef(0);
  const pausedAt = useRef<number | null>(null);
  const scoreRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!session) return;
    setSnapshot(await loadPlatformSnapshot(session));
    setLoading(false);
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!session) return;
    const stopPause = session.on("pause", () => {
      pausedAt.current = performance.now();
      setPaused(true);
    });
    const stopResume = session.on("resume", () => {
      if (pausedAt.current !== null) endsAt.current += performance.now() - pausedAt.current;
      pausedAt.current = null;
      setPaused(false);
    });
    return () => {
      stopPause();
      stopResume();
    };
  }, [session]);

  const finishRound = useCallback(async () => {
    setPhase("finished");
    setRemainingMs(0);
    if (!session) {
      setSnapshot((current) => ({
        ...current,
        bestScore: Math.max(current.bestScore, scoreRef.current),
      }));
      return;
    }

    setWriteIssues(await recordRound(session, scoreRef.current, snapshot.bestScore));
    await refresh();
  }, [refresh, session, snapshot.bestScore]);

  useEffect(() => {
    if (phase !== "playing" || paused) return;

    let frame = 0;
    const tick = () => {
      const next = Math.max(0, endsAt.current - performance.now());
      setRemainingMs(next);
      if (next === 0) {
        void finishRound();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [finishRound, paused, phase]);

  const startRound = () => {
    scoreRef.current = 0;
    setScore(0);
    setWriteIssues([]);
    setRemainingMs(ROUND_MS);
    endsAt.current = performance.now() + ROUND_MS;
    setTarget(nextTarget());
    setPhase("playing");
  };

  const hitTarget = () => {
    if (phase !== "playing" || paused) return;
    scoreRef.current += 1;
    setScore(scoreRef.current);
    setTarget(nextTarget());
  };

  const profile = snapshot.apiProfile;
  const firstAchievement = snapshot.achievements[0];
  const allIssues = [...snapshot.issues, ...writeIssues];

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="https://powly.gg" target="_blank" rel="noreferrer">
          <span className="brand-mark">P</span>
          <span>Powly game starter</span>
        </a>
        <span className={`connection ${session ? "connected" : "preview"}`}>
          <span className="connection-dot" />
          {session ? "Powly connected" : "Local preview"}
        </span>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">React + Vite + Powly</p>
          <h1>
            Build the game.
            <br />
            Powly handles the platform.
          </h1>
          <p className="lede">
            A tiny reaction game with a real player profile, API data, saves, achievements, and a
            leaderboard wired in.
          </p>
        </div>
        <div className="player-card">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="avatar" />
          ) : (
            <span className="avatar fallback">{initials(profile.username)}</span>
          )}
          <div>
            <span className="muted">Playing as</span>
            <strong>{profile.username}</strong>
            <code>{profile.playerId}</code>
          </div>
        </div>
      </section>

      {!session && (
        <aside className="notice">
          <strong>Preview mode.</strong> {connection.error} Open this URL through Studio’s Developer
          mode to use live player data.
        </aside>
      )}

      <section className="workspace">
        <article className="game-card">
          <div className="game-head">
            <div>
              <p className="eyebrow">Starter game</p>
              <h2>Pulse tap</h2>
            </div>
            <div className="scoreboard">
              <span>
                <small>Score</small>
                {score}
              </span>
              <span>
                <small>Best</small>
                {Math.max(snapshot.bestScore, score)}
              </span>
              <span>
                <small>Time</small>
                {Math.ceil(remainingMs / 1000)}s
              </span>
            </div>
          </div>

          <div className={`arena ${paused ? "is-paused" : ""}`}>
            <div className="grid" />
            {phase === "playing" ? (
              <button
                type="button"
                className="target"
                style={{ left: `${target.x}%`, top: `${target.y}%` }}
                onPointerDown={hitTarget}
                aria-label="Target"
              >
                <span />
              </button>
            ) : (
              <div className="game-prompt">
                <span className="prompt-orb" />
                <h3>{phase === "finished" ? `${score} hits` : "Ready?"}</h3>
                <p>Tap the pulse as many times as you can in 15 seconds.</p>
                <button type="button" className="primary" onClick={startRound}>
                  {phase === "finished" ? "Play again" : "Start round"}
                </button>
              </div>
            )}
            {paused && <div className="pause-layer">Paused by Powly</div>}
          </div>
        </article>

        <aside className="platform-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Live platform data</p>
              <h2>Powly API</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => void refresh()}
              disabled={!session || loading}
            >
              Refresh
            </button>
          </div>

          <dl className="facts">
            <div>
              <dt>Endpoint</dt>
              <dd>
                <code>GET /me</code>
              </dd>
            </div>
            <div>
              <dt>API</dt>
              <dd>{session?.apiBase ?? "Preview data"}</dd>
            </div>
            <div>
              <dt>Launch</dt>
              <dd>{session?.launchId ?? "local-preview"}</dd>
            </div>
            <div>
              <dt>Scopes</dt>
              <dd className="chips">
                {profile.scopes.map((scope) => (
                  <span key={scope}>{scope}</span>
                ))}
              </dd>
            </div>
          </dl>

          <div className="platform-block">
            <div className="block-label">
              <span>Achievement</span>
              <span>{firstAchievement?.unlocked ? "Unlocked" : "Locked"}</span>
            </div>
            <strong>{firstAchievement?.name ?? "Create first-run in Studio"}</strong>
            <p>
              {firstAchievement?.description ?? "The UI stays usable when a resource is missing."}
            </p>
          </div>

          <div className="platform-block leaderboard">
            <div className="block-label">
              <span>Leaderboard</span>
              <code>high-score</code>
            </div>
            {snapshot.leaderboard.length ? (
              <ol>
                {snapshot.leaderboard.slice(0, 3).map((entry) => (
                  <li key={entry.playerId}>
                    <span>{entry.rank}</span>
                    <strong>{entry.username}</strong>
                    <b>{entry.score}</b>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Create the leaderboard in Studio to show scores.</p>
            )}
          </div>

          {allIssues.length > 0 && (
            <details className="issues">
              <summary>
                {allIssues.length} setup note{allIssues.length === 1 ? "" : "s"}
              </summary>
              <ul>
                {allIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="actions">
            <button
              type="button"
              onClick={() => void session?.fullscreen.toggle()}
              disabled={!session}
            >
              Toggle fullscreen
            </button>
            <a href="https://powly.gg/studio/help" target="_blank" rel="noreferrer">
              Read the docs ↗
            </a>
          </div>
        </aside>
      </section>
    </main>
  );
}
