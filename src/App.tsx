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
  const [paused, setPaused] = useState(false);

  const refresh = useCallback(async () => {
    if (session) setSnapshot(await loadPlatformSnapshot(session));
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

  return (
    <main>
      <section className="starter">
        <p className="brand">Powly</p>
        <h1>React + Vite game template</h1>
        <p className="intro">A clean starting point for client-only games on Powly.</p>

        <section className="details" aria-label="Powly platform information">
          <header className="player">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" />
            ) : (
              <span className="avatar">{initials(profile.username)}</span>
            )}
            <div>
              <span className="player-label">Player</span>
              <strong>{profile.username}</strong>
            </div>
            <span
              className={`status ${session ? "online" : ""}`}
              title={connection.error ?? undefined}
            >
              <span />
              {paused ? "Paused" : session ? "Connected" : "Preview"}
            </span>
          </header>

          <dl>
            <div>
              <dt>Platform API</dt>
              <dd>GET /me</dd>
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
          </dl>
        </section>

        <p className="hint">
          Edit <code>src/App.tsx</code> and save to test HMR.
        </p>
        <a className="docs" href="https://powly.gg/studio/help" target="_blank" rel="noreferrer">
          Powly documentation ↗
        </a>
      </section>
    </main>
  );
}
