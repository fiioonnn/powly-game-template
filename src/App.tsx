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
      <section className="card">
        <header className="header">
          <div className="title">
            <span className="logo">P</span>
            <div>
              <h1>Powly game template</h1>
              <p>React + TypeScript + Vite</p>
            </div>
          </div>
          <span className={`status ${session ? "online" : ""}`}>
            <span />
            {paused ? "Paused" : session ? "Connected" : "Local preview"}
          </span>
        </header>

        {!session && (
          <p className="notice">
            {connection.error} Open this URL through Studio’s Developer mode for live data.
          </p>
        )}

        <div className="profile">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" />
          ) : (
            <span className="avatar">{initials(profile.username)}</span>
          )}
          <div>
            <strong>{profile.username}</strong>
            <code>{profile.playerId}</code>
          </div>
        </div>

        <dl className="details">
          <div>
            <dt>Platform API</dt>
            <dd>
              <code>GET /me</code>
            </dd>
          </div>
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
            <dt>Best score</dt>
            <dd>{snapshot.bestScore}</dd>
          </div>
          <div>
            <dt>Achievements</dt>
            <dd>
              {unlocked} / {snapshot.achievements.length} unlocked
            </dd>
          </div>
          <div>
            <dt>Top score</dt>
            <dd>{topScore ? `${topScore.username} · ${topScore.score}` : "Not configured"}</dd>
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
            Documentation
          </a>
        </footer>
      </section>
    </main>
  );
}
