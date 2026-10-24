/* Powly SDK 0.5.0: types for powly.js and powly.mjs */
/** This SDK's version; Powly's Studio shows it next to the downloads. */
export declare const SDK_VERSION = "0.5.0";

export declare const PROTOCOL = "powly-sdk";
export declare const PROTOCOL_VERSION = 1;
/** The corners Powly's options button (its mascot, which opens the player's options) can be in. */
export declare const OPTIONS_BUTTON_CORNERS: readonly ["top-left", "top-right", "bottom-left", "bottom-right"];
export type OptionsButtonCorner = (typeof OPTIONS_BUTTON_CORNERS)[number];
export declare const isOptionsButtonCorner: (value: unknown) => value is OptionsButtonCorner;
export type InitMessage = {
    protocol: typeof PROTOCOL;
    version: number;
    type: "init";
    sdkVersion: string;
    /**
     * The SDK reports to Powly Anti-Cheat (src/pac.ts: `PacSample` messages over the port). Older
     * SDKs leave it out.
     */
    pac?: 1;
    /**
     * Where the game wants Powly's options button to start (`Powly.init({ optionsButton })`); the
     * player's own choice wins. Left out: Powly's default (top left).
     */
    optionsButton?: OptionsButtonCorner;
};
export type PlayerProfile = {
    /** This player's ID in this game: stable, and different in every game. */
    playerId: string;
    username: string;
    avatarUrl: string | null;
};
export type ReadyMessage = {
    type: "ready";
    launchId: string;
    profile: PlayerProfile;
    scopes: string[];
    /** Why the game was opened and the player's preferences (e.g. `reason: "invite"`, `muted`). */
    params: Record<string, string>;
    /** A session token and its lifetime in seconds. */
    token: string;
    expiresIn: number;
    /** Base URL of the platform API, e.g. "https://powly.gg/api/platform/v1". */
    apiBase: string;
    /**
     * Powly Anti-Cheat: guard the game's code (src/pac.ts) in this run. Off in developer mode.
     * Missing from older Powly hosts: no guard.
     */
    pac?: {
        guard: boolean;
    };
};
export type FailedMessage = {
    type: "failed";
    error: string;
};
export type HostMethod = "getSessionToken" | "purchases.open" | "fullscreen.toggle" | "invites.open" | "quit";
export type RequestMessage = {
    type: "request";
    id: number;
    method: HostMethod;
    /** "invites.open": launch params every invite sent from Powly's dialog carries (e.g. a room). */
    params?: Record<string, string>;
    /**
     * "invites.open": player IDs already playing with the player (the room's members): Powly's
     * dialog shows them as in the party, without an Invite button.
     */
    members?: string[];
};
/** What "invites.open" answers once Powly's dialog closed: the friends the player invited. */
export type InvitesOpenResult = {
    invited: string[];
};
export type ResponseMessage = {
    type: "response";
    id: number;
    ok: true;
    result: unknown;
} | {
    type: "response";
    id: number;
    ok: false;
    error: string;
};
export type HostEventName = "pause" | "resume" | "ended";
export type EventMessage = {
    type: "event";
    event: HostEventName;
};
export type HostMessage = ReadyMessage | FailedMessage | ResponseMessage | EventMessage;
export declare const isInitMessage: (data: unknown) => data is InitMessage;
export declare const isRequestMessage: (data: unknown) => data is RequestMessage;

export declare const POWLY_ORIGINS: readonly string[];

export declare class PowlyError extends Error {
    status: number | undefined;
    /** For realtime calls (rooms): what went wrong, e.g. "full", "locked", "not_found". */
    code: string | undefined;
    constructor(message: string, status?: number, code?: string);
}

/** How often the SDK reports (ms). */
export declare const PAC_SAMPLE_MS = 5000;
export type PacSample = {
    type: "pac";
    /** The game's performance.now() and Date.now() when sampled. */
    clock: number;
    date: number;
    /** The largest jump of Date.now() against performance.now() since the last sample (ms). */
    dateJump: number;
    /** Developer tools were open on the game (the debugger trap fired). */
    devtools: boolean;
    tampered: string[];
    automation: string[];
    input: {
        trusted: number;
        synthetic: number;
        clicks: number;
        teleportClicks: number;
        keyIntervals: number;
        keyIntervalSd: number | null;
        clickIntervals: number;
        clickIntervalSd: number | null;
        /** Every trusted interaction: key presses, clicks, taps, pointer movement, wheel, gamepads. */
        activity: number;
    };
};
export declare const isPacSample: (data: unknown) => data is PacSample;
/**
 * Browser functions a speed hack or cheat script replaces, by name, when they aren't the
 * browser's own. The clocks ("performance.now", "Date.now") and Function.prototype.toString (which
 * hides patches) are what PAC treats as critical.
 */
export declare function tamperedFunctions(win: Window & typeof globalThis): string[];
/** Traces of an automated browser (WebDriver, DevTools Protocol drivers, headless browsers). */
export declare function detectAutomation(win: Window & typeof globalThis): string[];
/**
 * Shortcuts that open view-source, save the page or open developer tools: F12, Ctrl+U/S,
 * Ctrl+Shift+I/J/C, and their Cmd(+Option) versions on macOS.
 */
export declare function isInspectShortcut(event: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">): boolean;
/**
 * Starts reporting to the Powly page over `port`. Returns a function that stops it.
 */
export declare function startPacSensor(port: MessagePort, { guard }?: {
    guard?: boolean;
}, win?: Window & typeof globalThis): () => void;

export declare const REALTIME_PROTOCOL_VERSION = 1;
/** Close codes the service uses (4000–4999 are free for applications). */
export declare const REALTIME_CLOSE: {
    /** The ticket was invalid, or expired without a fresh one. Get a new ticket to reconnect. */
    readonly unauthorized: 4001;
    /** The same player connected too many times; the oldest connection is closed. */
    readonly replaced: 4002;
    /** Too many messages, or the client couldn't keep up with what it was sent. */
    readonly overloaded: 4008;
    /** A frame that isn't valid JSON or protocol. */
    readonly invalid: 4009;
};
export type RoomMember = {
    playerId: string;
    username: string;
    avatarUrl: string | null;
    /** What the member shares about themselves (ready, character…), set with `room.me`. */
    data: unknown;
    /** False for a few seconds after their connection dropped, while they may come back. */
    connected: boolean;
    joinedAt: string;
};
export type RoomState = {
    id: string;
    /** What friends type (or get in an invite) to join: 6 letters and digits. */
    code: string;
    hostId: string;
    maxPlayers: number;
    /** Locked rooms take nobody new (members who dropped can still come back). */
    locked: boolean;
    /** Listed by `room.list` for anyone in the game to join. */
    listed: boolean;
    /** The room's shared state, set by the host. */
    data: unknown;
    members: RoomMember[];
    createdAt: string;
};
/** A listed room, as `room.list` shows it. */
export type ListedRoom = {
    code: string;
    host: string;
    players: number;
    maxPlayers: number;
    data: unknown;
};
export type RealtimeInvite = {
    id: string;
    from: {
        playerId: string;
        username: string;
    };
    params: Record<string, string>;
    createdAt: string;
};
export type ClientMessage = {
    op: "auth";
    id?: number;
    ticket: string;
} | {
    op: "room.create";
    id: number;
    maxPlayers?: number;
    listed?: boolean;
    data?: unknown;
    me?: unknown;
} | {
    op: "room.join";
    id: number;
    code: string;
    me?: unknown;
} | {
    op: "room.leave";
    id: number;
} | {
    op: "room.list";
    id: number;
} | {
    op: "room.update";
    id: number;
    data?: unknown;
    locked?: boolean;
    listed?: boolean;
} | {
    op: "room.me";
    id: number;
    data: unknown;
} | {
    op: "room.kick";
    id: number;
    playerId: string;
} | {
    op: "room.host";
    id: number;
    playerId: string;
} | {
    op: "room.send";
    event: string;
    data?: unknown;
    to?: string;
};
export type RealtimeErrorCode = "invalid" | "unauthorized" | "not_found" | "full" | "locked" | "forbidden" | "not_in_room" | "too_large" | "rate_limited" | "unavailable"
/** The game's Multiplayer setting is off (Studio): no rooms, only invites. */
 | "multiplayer_off";
export type ServerMessage = {
    type: "welcome";
    protocol: number;
    /** "game": a player in a game; "site": Powly's own pages. */
    kind: "game" | "site";
    /** Seconds the ticket is still good for. */
    expiresIn: number;
} | {
    type: "reply";
    id: number;
    ok: true;
    result: unknown;
} | {
    type: "reply";
    id: number;
    ok: false;
    error: {
        code: RealtimeErrorCode;
        message: string;
    };
} | {
    type: "room.message";
    from: string;
    event: string;
    data: unknown;
} | {
    type: "room.member_joined";
    member: RoomMember;
} | {
    type: "room.member_updated";
    member: RoomMember;
} | {
    type: "room.member_left";
    playerId: string;
    reason: "left" | "kicked" | "dropped";
} | {
    type: "room.updated";
    hostId: string;
    data: unknown;
    locked: boolean;
    listed: boolean;
}
/** You're no longer in the room. */
 | {
    type: "room.left";
    reason: "kicked" | "replaced" | "closed";
}
/** A friend invited the player to this game while they're playing it. */
 | {
    type: "invite";
    invite: RealtimeInvite;
}
/** Powly's pages: a platform event (apps/web/lib/social/types.ts RealtimeEvent). */
 | {
    type: "event";
    event: unknown;
} | {
    type: "error";
    code: RealtimeErrorCode;
    message: string;
};



export type RoomCreateOptions = {
    /** From 2 up to the game's players per room (Studio, Multiplayer), which is also the default. */
    maxPlayers?: number;
    /** Listed rooms show up in `rooms.list()` for anyone in the game to join. Default false. */
    listed?: boolean;
    /** The room's shared state (up to 4 KB of JSON); only the host changes it. */
    data?: unknown;
    /** What you share about yourself (up to 1 KB of JSON), e.g. { ready: false }. */
    me?: unknown;
};
export type RoomEvents = {
    /** Another member sent something (`room.send`). */
    message: {
        from: string;
        event: string;
        data: unknown;
    };
    /** Someone joined. */
    join: RoomMember;
    /** Someone left, was kicked, or didn't come back after their connection dropped. */
    leave: {
        playerId: string;
        reason: "left" | "kicked" | "dropped";
    };
    /** A member's data changed, or their connection dropped (`connected: false`) or came back. */
    member: RoomMember;
    /** The host, the room's data, `locked` or `listed` changed. */
    update: Room;
    /**
     * You're out of the room: you left (or created or joined another one), were kicked, the same
     * player joined from elsewhere ("replaced"), or the connection couldn't get back in
     * ("connection", also when the launch ended).
     */
    closed: {
        reason: "left" | "kicked" | "replaced" | "connection";
    };
};
export type Room = {
    readonly id: string;
    /** What friends join with: 6 letters and digits. */
    readonly code: string;
    readonly hostId: string;
    /** Whether you're the host. */
    readonly isHost: boolean;
    readonly maxPlayers: number;
    readonly locked: boolean;
    readonly listed: boolean;
    readonly data: unknown;
    /** Everyone in the room, you included, in the order they joined. */
    readonly members: readonly RoomMember[];
    /** Whether you're still in it. */
    readonly active: boolean;
    /**
     * Sends to everyone else in the room, or to one member (`to`). `event`: 1–32 letters, digits or
     * _ . : -; `data`: up to 8 KB of JSON. Returns false when it couldn't be sent (reconnecting).
     */
    send(event: string, data?: unknown, options?: {
        to?: string;
    }): boolean;
    on<K extends keyof RoomEvents>(event: K, listener: (payload: RoomEvents[K]) => void): () => void;
    /** Host only. */
    update(changes: {
        data?: unknown;
        locked?: boolean;
        listed?: boolean;
    }): Promise<void>;
    /** What you share about yourself (up to 1 KB of JSON). */
    setMyData(data: unknown): Promise<void>;
    /** Host only: removes a player, who can't come back. */
    kick(playerId: string): Promise<void>;
    /** Host only: hands hosting to another member. */
    makeHost(playerId: string): Promise<void>;
    /** Invites a friend (scope invites.write); opening it launches the game with `room` = the code. */
    invite(playerId: string): Promise<void>;
    leave(): Promise<void>;
};
export type RealtimeStatus = "offline" | "connecting" | "connected" | "reconnecting";
export type RoomsApi = {
    /** Creates a room with you as its host (leaving the one you're in). */
    create(options?: RoomCreateOptions): Promise<Room>;
    /** Joins by code (leaving the one you're in). Fails with code "not_found", "full" or "locked". */
    join(code: string, options?: {
        me?: unknown;
    }): Promise<Room>;
    /** Listed rooms that still take players, newest first (up to 50). */
    list(): Promise<ListedRoom[]>;
    /** The room you're in, or null. */
    readonly current: Room | null;
    /** The connection to Powly's realtime service. */
    readonly status: RealtimeStatus;
    on(event: "status", listener: (status: RealtimeStatus) => void): () => void;
};
type Ticket = {
    url: string;
    ticket: string;
    expiresIn: number;
};
/**
 * The game's realtime connection. `getTicket` asks the platform API for a ticket (POST
 * /realtime); `invite` sends a Powly invite.
 */
export declare function createRooms(options: {
    playerId: string;
    getTicket: () => Promise<Ticket>;
    invite: (playerId: string, params: Record<string, string>) => Promise<void>;
}): {
    rooms: RoomsApi;
    onInvite(listener: (invite: RealtimeInvite) => void): () => void;
    stop(): void;
};

export declare const TWITCH_CHAT_URL = "wss://irc-ws.chat.twitch.tv:443";
export type TwitchStatus = "connected" | "not_connected";
/** What GET /twitch answers: the game's Twitch chat setting and the player's channel. */
export type TwitchInfo = {
    /** The game's Twitch chat setting in Studio. */
    mode: "optional" | "required";
    /** "connected": `channel` is the player's. "not_connected": they haven't connected Twitch. */
    status: TwitchStatus;
    channel: {
        login: string;
        displayName: string;
    } | null;
};
export type TwitchChatMessage = {
    /** Twitch's message ID (what "delete" events name). */
    id: string;
    /** The chatter's Twitch user ID, login and display name. */
    userId: string;
    login: string;
    displayName: string;
    /** Their name colour as "#RRGGBB", or null when they never picked one. */
    color: string | null;
    text: string;
    /** A "/me" message. */
    action: boolean;
    /** Bits cheered with the message (0 if none). */
    bits: number;
    /** Badge name → version, e.g. { subscriber: "12", moderator: "1" }. */
    badges: Record<string, string>;
    broadcaster: boolean;
    moderator: boolean;
    subscriber: boolean;
    vip: boolean;
    /** The chatter's first message in this channel ever. */
    firstMessage: boolean;
    /** When Twitch received it (ISO 8601). */
    sentAt: string;
};
/** The chat connection: "idle" until `connect()`, "closed" after `disconnect()`. */
export type TwitchChatState = "idle" | "connecting" | "connected" | "reconnecting" | "closed";
type Events = {
    message: TwitchChatMessage;
    /** A moderator deleted one message. */
    delete: {
        id: string;
    };
    /** A moderator cleared the chat (`userId` null) or one chatter's messages (timeout, ban). */
    clear: {
        userId: string | null;
    };
    state: TwitchChatState;
};
export type TwitchApi = {
    /** The game's setting and the player's channel, without opening chat. */
    info(): Promise<TwitchInfo>;
    /**
     * Opens the player's chat when they have a channel to read (`status: "connected"`). Resolves
     * with the info, once chat is joined (or failed to; it keeps retrying in the background).
     */
    connect(): Promise<TwitchInfo>;
    /** Closes chat; `connect()` opens it again. */
    disconnect(): void;
    readonly state: TwitchChatState;
    /** The channel chat is open for, or null. */
    readonly channel: TwitchInfo["channel"];
    on<E extends keyof Events>(event: E, listener: (value: Events[E]) => void): () => void;
};
export type IrcMessage = {
    tags: Record<string, string>;
    /** The sender's nick (the part of the prefix before "!"), or null. */
    nick: string | null;
    command: string;
    params: string[];
};
/** One IRC line (without its CRLF), or null when it isn't one. */
export declare function parseIrcLine(line: string): IrcMessage | null;
/** A PRIVMSG as a chat message, or null. */
export declare function chatMessageOf(message: IrcMessage): TwitchChatMessage | null;
export declare function createTwitch(options: {
    getInfo: () => Promise<TwitchInfo>;
    /** Twitch chat's WebSocket URL (tests point it elsewhere). */
    url?: string;
}): TwitchApi & {
    stop(): void;
};







export type InitOptions = {
    /**
     * Powly origins the game accepts, e.g. ["https://powly.gg"]. Defaults to the Powly origins
     * built into the SDK (POWLY_SDK_ORIGINS at build time, see src/origins.ts); the launch URL's
     * `powly_origin` only picks one of those, and is ignored otherwise.
     */
    powlyOrigin?: string | string[];
    /** How long to wait for Powly to answer (ms). Default 10 s. */
    timeoutMs?: number;
    /**
     * Which corner Powly's options button (its mascot, which opens the player's options) starts in:
     * "top-left" (the default), "top-right", "bottom-left" or "bottom-right". Pick the one your own
     * UI leaves free. Players can still move it, and their choice wins.
     */
    optionsButton?: OptionsButtonCorner;
};
export type LeaderboardEntry = {
    rank: number;
    playerId: string;
    username: string;
    score: number;
};
export type Friend = {
    playerId: string;
    username: string;
    /** Their picture (by player ID), or null; missing from older Powly servers. */
    avatarUrl?: string | null;
};
export type Achievement = {
    key: string;
    /** "Hidden achievement" for hidden ones the player hasn't unlocked. */
    name: string;
    description: string;
    rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
    hidden: boolean;
    unlocked: boolean;
    unlockedAt: string | null;
};
export type Ownership = {
    owned: boolean;
    since: string | null;
    addOns: string[];
};
export type Invite = {
    id: string;
    from: Friend;
    params: Record<string, string>;
    createdAt: string;
};
export type PowlySession = {
    profile: PlayerProfile;
    scopes: string[];
    /** Why the game was opened (`reason: "invite"`, `invitedBy`…) and the player's preferences. */
    launchParams: Record<string, string>;
    launchId: string;
    /** The platform API's base URL, e.g. "https://powly.gg/api/platform/v1". */
    apiBase: string;
    /** A valid session token (refreshed automatically, valid for at least 10 more seconds). */
    getSessionToken(): Promise<string>;
    /** Calls the platform API with a session token: `api("/me")`. */
    api<T = unknown>(path: string, init?: {
        method?: string;
        body?: unknown;
    }): Promise<T>;
    friends: {
        list(): Promise<Friend[]>;
    };
    presence: {
        set(text: string | null): Promise<void>;
    };
    invites: {
        list(): Promise<Invite[]>;
        send(playerId: string, params?: Record<string, string>): Promise<void>;
        /** A friend invited the player to this game while they're playing it (live, realtime). */
        on(event: "received", listener: (invite: Invite) => void): () => void;
        /**
         * Opens Powly's own invite dialog over the game (drawn by Powly, not the game): the player's
         * friends who play it, each with an Invite button. Every invite sent from it carries `params`
         * (e.g. `{ room: code }`), like `send`. With the code of the room the player is in, its members
         * show as already in the party (no Invite button). Resolves when the player closes it, with
         * the player IDs they invited. Needs the friends.read and invites.write scopes.
         */
        open(params?: Record<string, string>): Promise<{
            invited: string[];
        }>;
    };
    /** Realtime rooms (parties) with other players of this game. */
    rooms: RoomsApi;
    /**
     * The chat of the player's Twitch channel, for games with Twitch chat on (Studio → Configuration
     * → Twitch chat). Read-only; calls fail with a 403 PowlyError while the setting is off.
     */
    twitch: TwitchApi;
    leaderboards: {
        submit(board: string, score: number): Promise<{
            best: number;
            improved: boolean;
        }>;
        top(board: string, limit?: number): Promise<LeaderboardEntry[]>;
    };
    /**
     * The player's saves, stored by Powly: each key is created in Studio (game → Saves) with a simple
     * type (number, text, true/false, object, array). Reading always works; `set` and `delete` too,
     * except for saves the studio made server-only (403; the game's backend writes those). Unknown
     * keys fail with a 404, values of another type with a 422.
     */
    saves: {
        /** The player's value, or null if they have none. */
        get<T = unknown>(key: string): Promise<T | null>;
        /** All of the player's saves, by key. */
        all(): Promise<Record<string, unknown>>;
        set(key: string, value: unknown): Promise<void>;
        delete(key: string): Promise<void>;
        /** The keys the player has a value for. */
        list(): Promise<string[]>;
    };
    achievements: {
        /** The game's achievements (defined in Studio), with the player's unlocks. */
        list(): Promise<Achievement[]>;
        /**
         * Unlocks one from the browser: only achievements the studio marked "can be unlocked from the
         * browser" (others answer 403; the game's backend unlocks those). `granted` is false when the
         * player already had it.
         */
        unlock(key: string): Promise<{
            key: string;
            granted: boolean;
        }>;
    };
    /** @deprecated Settings are saves now: use `saves` (`reset` is `saves.delete`). */
    settings: {
        get<T = unknown>(key: string): Promise<T | null>;
        all(): Promise<Record<string, unknown>>;
        set(key: string, value: unknown): Promise<void>;
        reset(key: string): Promise<void>;
    };
    /** Whether the player owns the game (scope ownership.read). */
    ownership: {
        get(): Promise<Ownership>;
    };
    /** Asks Powly to open its own purchase dialog (drawn by Powly, outside the game). */
    purchases: {
        open(): Promise<void>;
    };
    fullscreen: {
        toggle(): Promise<void>;
    };
    /**
     * Closes the game, like the exit button in Powly's options bar: the player goes back to the
     * game's store page and the launch ends ("ended" fires). Save the player's progress first.
     */
    quit(): Promise<void>;
    /** Powly UI opened over the game ("pause"), closed ("resume"), or the launch ended ("ended"). */
    on(event: HostEventName, listener: () => void): () => void;
};
/** Starts the SDK. Rejects when the game wasn't launched from Powly. */
export declare function init(options?: InitOptions): Promise<PowlySession>;
declare const Powly: {
    init: typeof init;
    SDK_VERSION: string;
    PowlyError: typeof PowlyError;
};

export default Powly;

declare global {
  interface Window {
    /** Set by powly.js (the classic script). */
    Powly: typeof Powly;
  }
}
