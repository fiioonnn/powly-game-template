import type { Achievement, PowlySession } from "./powly/powly.mjs";

export const SAVE_KEY = "best-score";
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
};

async function safely<T>(label: string, fallback: T, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`Powly ${label}: ${message}`);
    return fallback;
  }
}

/** Reads browser-safe platform data. One missing Studio resource never blocks the rest of the UI. */
export async function loadPlatformSnapshot(session: PowlySession): Promise<PlatformSnapshot> {
  const [apiProfile, bestScore, achievements] = await Promise.all([
    // api() is the typed escape hatch for platform endpoints not wrapped by another SDK method.
    safely("GET /me", { ...session.profile, scopes: session.scopes }, () =>
      session.api<ApiProfile>("/me"),
    ),
    safely(`save ${SAVE_KEY}`, 0, async () => (await session.saves.get<number>(SAVE_KEY)) ?? 0),
    safely("achievements", [], () => session.achievements.list()),
  ]);

  return { apiProfile, bestScore, achievements };
}
