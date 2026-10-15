import { useCallback, useEffect, useState } from "react";
import type { Connection } from "./main";
import { loadPlatformSnapshot, type PlatformSnapshot, previewSnapshot } from "./platform";

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
  const [paused, setPaused] = useState(false);
  const [xp, setXp] = useState(0);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setSnapshot(await loadPlatformSnapshot(session));
    setLoading(false);
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!session) return;
    const stopPause = session.on("pause", () => setPaused(true));
    const stopResume = session.on("resume", () => setPaused(false));
    return () => {
      stopPause();
      stopResume();
    };
  }, [session]);

  const profile = snapshot.apiProfile;
  const unlocked = snapshot.achievements.filter((achievement) => achievement.unlocked).length;
  const topScore = snapshot.leaderboard[0];
  const launchParams = Object.entries(session?.launchParams ?? {});

  return (
    <main className="page">
      <section className="starter">
        <div className="mark" aria-hidden="true">
          <span>P</span>
        </div>
        <p className="eyebrow">Powly game starter</p>
        <h1>Powly + React + Vite</h1>
        <p className="intro">Build a client-only game with the Powly SDK and platform API.</p>

        <button className="xp-counter" type="button" onClick={() => setXp((value) => value + 1)}>
          <span>XP</span>
          <strong>{xp}</strong>
          <small>+1</small>
        </button>
        <p className="hint">
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>

        <section className="platform-card" aria-label="Powly platform information">
          <header className="player-row">
            <div className="player">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" />
              ) : (
                <span className="avatar">{initials(profile.username)}</span>
              )}
              <div>
                <strong>{profile.username}</strong>
                <span className="player-id">{profile.playerId}</span>
              </div>
            </div>
            <span className={`status ${session ? "online" : ""}`}>
              <span />
              {paused ? "Paused" : session ? "Connected" : "Preview"}
            </span>
          </header>

          {!session && (
            <p className="notice">
              {connection.error} Open through Studio Developer mode for live data.
            </p>
          )}

          <dl className="stats">
            <div>
              <dt>Platform API</dt>
              <dd>
                <code>GET /me</code>
              </dd>
            </div>
            <div>
              <dt>Best score</dt>
              <dd>{snapshot.bestScore}</dd>
            </div>
            <div>
              <dt>Achievements</dt>
              <dd>
                {unlocked} / {snapshot.achievements.length}
              </dd>
            </div>
            <div>
              <dt>Leaderboard</dt>
              <dd>{topScore ? `${topScore.username} · ${topScore.score}` : "Not configured"}</dd>
            </div>
          </dl>

          <details className="session-details">
            <summary>Session details</summary>
            <dl>
              <div>
                <dt>API base</dt>
                <dd>{session?.apiBase ?? "Preview data"}</dd>
              </div>
              <div>
                <dt>Launch ID</dt>
                <dd>{session?.launchId ?? "local-preview"}</dd>
              </div>
              <div>
                <dt>Scopes</dt>
                <dd>{profile.scopes.join(", ") || "None"}</dd>
              </div>
              <div>
                <dt>Launch params</dt>
                <dd>
                  {launchParams.length
                    ? launchParams.map(([key, value]) => `${key}: ${value}`).join(", ")
                    : "None"}
                </dd>
              </div>
            </dl>
          </details>

          {snapshot.issues.length > 0 && (
            <details className="issues">
              <summary>{snapshot.issues.length} optional resource note(s)</summary>
              <ul>
                {snapshot.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </details>
          )}

          <footer className="actions">
            <button type="button" onClick={() => void refresh()} disabled={!session || loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => void session?.fullscreen.toggle()}
              disabled={!session}
            >
              Fullscreen
            </button>
            <a href="https://powly.gg/studio/help" target="_blank" rel="noreferrer">
              Read the docs ↗
            </a>
          </footer>
        </section>
      </section>
    </main>
  );
}
