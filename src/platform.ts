import type { Achievement, LeaderboardEntry, PowlySession } from "./powly/powly.mjs";

export const SAVE_KEY = "best-score";
export const LEADERBOARD_KEY = "high-score";
export const ACHIEVEMENT_KEY = "first-run";

type ApiProfile = {
  playerId: string;
  username: string;
  avatarUrl: string | null;
  scopes: string[];
};

export type PlatformSnapshot = {
  apiProfile: ApiProfile;
  bestScore: number;
  achievements: Achievement[];
  leaderboard: LeaderboardEntry[];
  issues: string[];
};

export const previewSnapshot: PlatformSnapshot = {
  apiProfile: {
    playerId: "preview-player",
    username: "Local player",
    avatarUrl: null,
    scopes: ["profile"],
  },
  bestScore: 12,
  achievements: [
    {
      key: ACHIEVEMENT_KEY,
      name: "First run",
      description: "The game connected to Powly.",
      rarity: "common",
      hidden: false,
      unlocked: true,
      unlockedAt: new Date().toISOString(),
    },
  ],
  leaderboard: [
    { rank: 1, playerId: "preview-1", username: "Nova", score: 32 },
    { rank: 2, playerId: "preview-2", username: "Mika", score: 24 },
    { rank: 3, playerId: "preview-player", username: "Local player", score: 12 },
  ],
  issues: [],
};

type Result<T> = { value: T; issue?: never } | { value: null; issue: string };

async function safely<T>(label: string, work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { value: await work() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { value: null, issue: `${label}: ${message}` };
  }
}

/** Reads browser-safe platform data. One missing Studio resource never blocks the rest of the UI. */
export async function loadPlatformSnapshot(session: PowlySession): Promise<PlatformSnapshot> {
  const [profile, bestScore, achievements, leaderboard] = await Promise.all([
    // api() is the typed escape hatch for platform endpoints not wrapped by another SDK method.
    safely("GET /me", () => session.api<ApiProfile>("/me")),
    safely(`Save ${SAVE_KEY}`, () => session.saves.get<number>(SAVE_KEY)),
    safely("Achievements", () => session.achievements.list()),
    safely(`Leaderboard ${LEADERBOARD_KEY}`, () => session.leaderboards.top(LEADERBOARD_KEY, 5)),
  ]);

  const results = [profile, bestScore, achievements, leaderboard];
  return {
    apiProfile: profile.value ?? {
      ...session.profile,
      scopes: session.scopes,
    },
    bestScore: bestScore.value ?? 0,
    achievements: achievements.value ?? [],
    leaderboard: leaderboard.value ?? [],
    issues: results.flatMap((result) => (result.issue ? [result.issue] : [])),
  };
}
