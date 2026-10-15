/* Powly SDK 0.3.0: ES module */
/** This SDK's version; Powly's Studio shows it next to the downloads. */
const SDK_VERSION = "0.3.0";

// The messages between a game (this SDK, inside Powly's iframe) and the Powly page that framed it.
// Shared with the host side (apps/web/components/player/sdk-host.ts).
//
// 1. The game creates a MessageChannel and posts `InitMessage` to `window.parent`, with the Powly
//    origin it expects as targetOrigin (so the port only ever reaches Powly) and port2 attached.
// 2. Powly answers only the iframe it created, from the origin it expects that frame to have,
//    with `ReadyMessage` over the port. Everything after that goes over the port.
// 3. From then on the game also reports to Powly Anti-Cheat over the port (`PacSample`, src/pac.ts).
const PROTOCOL = "powly-sdk";
const PROTOCOL_VERSION = 1;
const isInitMessage = (data) => typeof data === "object" &&
    data !== null &&
    data.protocol === PROTOCOL &&
    data.type === "init" &&
    data.version === PROTOCOL_VERSION;
const isRequestMessage = (data) => typeof data === "object" &&
    data !== null &&
    data.type === "request" &&
    Number.isInteger(data.id) &&
    ["getSessionToken", "purchases.open", "fullscreen.toggle"].includes(data.method);

// The Powly origins this build of the SDK trusts by default: a game only handshakes with a parent
// page on one of them (unless it passes `powlyOrigin` to `Powly.init()` itself). Set at build
// time with POWLY_SDK_ORIGINS (comma-separated origins); scripts/bundle.ts writes the list
// into dist. Without it: Powly's production origin and the local development app.
const POWLY_ORIGINS = ["https://powly.gg", "http://localhost:3000"];

// The error every SDK call fails with.
class PowlyError extends Error {
    status;
    /** For realtime calls (rooms): what went wrong, e.g. "full", "locked", "not_found". */
    code;
    constructor(message, status, code) {
        super(message);
        this.name = "PowlyError";
        this.status = status;
        this.code = code;
    }
}

// Powly Anti-Cheat (PAC), the game's side. After `Powly.init()` the SDK reports to the Powly page
// every few seconds over its private port: the game's clocks (Powly compares them with its own and
// the server's to catch speed hacks), browser functions that were replaced (speed hack scripts and
// extensions patch timers), traces of automated browsers, and how input arrives (scripted events,
// clicks without pointer movement as AI agents make them, machine-regular timing as macros and
// auto-clickers make them). Nothing is sent anywhere else, and nothing here reads what the player
// types: only event counts and timings.
//
// In real players' runs (not developer mode) the SDK also guards the game's code against being
// copied (`guard`): the browser's context menu and its view-source, save-page and developer-tools
// shortcuts don't open over the game (the game still gets the events), and a debugger trap both
// detects open developer tools and pauses the game whenever someone inspects it.
//
// None of this is a security boundary (the game runs in the player's browser). The Powly server
// decides what a reading means (apps/web/lib/server/pac/). `detectAutomation` and
// `tamperedFunctions` are shared with the Powly page (apps/web/components/player/pac-sensor.ts).
/** How often the SDK reports (ms). */
const PAC_SAMPLE_MS = 5000;
const isPacSample = (data) => typeof data === "object" &&
    data !== null &&
    data.type === "pac" &&
    typeof data.clock === "number" &&
    typeof data.input === "object";
const NATIVE = /\{\s*\[native code\]\s*\}\s*$/;
/**
 * Whether `fn` is the browser's own function. Known wrappers that keep the original (error
 * trackers, Zone.js) count as native when what they wrap is.
 */
function isNative(fn, fnToString) {
    if (typeof fn !== "function")
        return false;
    try {
        if (NATIVE.test(fnToString.call(fn)))
            return true;
    }
    catch {
        return false;
    }
    const wrapped = fn;
    const original = wrapped.__sentry_original__ ?? wrapped.__zone_symbol__OriginalDelegate;
    return original !== undefined && original !== fn && isNative(original, fnToString);
}
/**
 * Browser functions a speed hack or cheat script replaces, by name, when they aren't the
 * browser's own. The clocks ("performance.now", "Date.now") and Function.prototype.toString (which
 * hides patches) are what PAC treats as critical.
 */
function tamperedFunctions(win) {
    const found = [];
    const fnToString = win.Function.prototype.toString;
    // Checked with itself first: a replaced toString could vouch for everything else.
    if (!NATIVE.test(fnToString.call(fnToString))) {
        found.push("Function.prototype.toString");
    }
    const checks = [
        ["performance.now", win.performance?.now],
        ["Date.now", win.Date.now],
        ["Date", win.Date],
        ["requestAnimationFrame", win.requestAnimationFrame],
        ["setTimeout", win.setTimeout],
        ["setInterval", win.setInterval],
    ];
    for (const [name, fn] of checks)
        if (!isNative(fn, fnToString))
            found.push(name);
    // The browser's own `now` lives on Performance.prototype; a patch puts one on the instance.
    if (win.performance && Object.hasOwn(win.performance, "now"))
        found.push("performance.now");
    return [...new Set(found)];
}
// Globals and attributes that drivers of automated browsers leave behind.
const AUTOMATION_GLOBALS = [
    [
        /^\$?cdc_|^\$wdc_|^__webdriver|^__driver_|^__fxdriver|^__selenium|^_selenium|^callSelenium|^_Selenium_IDE/,
        "selenium",
    ],
    [/^__playwright|^__pw_/, "playwright"],
    [/^__puppeteer/, "puppeteer"],
    [/^callPhantom$|^_phantom$|^__phantomas$/, "phantom"],
    [/^__nightmare$/, "nightmare"],
    [/^domAutomation(Controller)?$/, "chrome-automation"],
    [/^__lastWatirAlert|^__lastWatirConfirm|^__lastWatirPrompt/, "watir"],
];
/** Traces of an automated browser (WebDriver, DevTools Protocol drivers, headless browsers). */
function detectAutomation(win) {
    const found = new Set();
    const nav = win.navigator;
    try {
        if (nav.webdriver)
            found.add("webdriver");
        // The browser defines `webdriver` on Navigator.prototype; stealth plugins hide it on the
        // instance instead.
        if (Object.getOwnPropertyDescriptor(nav, "webdriver"))
            found.add("webdriver-hidden");
    }
    catch { }
    if (/HeadlessChrome|PhantomJS|SlimerJS|HtmlUnit/i.test(nav.userAgent))
        found.add("headless");
    const names = [...Object.getOwnPropertyNames(win), ...Object.getOwnPropertyNames(win.document)];
    for (const name of names) {
        for (const [pattern, label] of AUTOMATION_GLOBALS)
            if (pattern.test(name))
                found.add(label);
    }
    const root = win.document.documentElement;
    for (const attribute of ["webdriver", "selenium", "driver"]) {
        if (root?.hasAttribute(attribute))
            found.add("selenium");
    }
    return [...found];
}
/** Standard deviation of the intervals between `times` (ms), or null for too few. */
function intervalSd(times) {
    if (times.length < 3)
        return null;
    const intervals = times.slice(1).map((time, index) => time - (times[index] ?? time));
    const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    // Only paced input (macros, auto-clickers) is interesting, not held keys or pauses.
    if (mean < 20 || mean > 2000)
        return null;
    const variance = intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length;
    return Math.sqrt(variance);
}
/**
 * Shortcuts that open view-source, save the page or open developer tools: F12, Ctrl+U/S,
 * Ctrl+Shift+I/J/C, and their Cmd(+Option) versions on macOS.
 */
function isInspectShortcut(event) {
    if (event.key === "F12")
        return true;
    const mod = event.ctrlKey || event.metaKey;
    if (!mod)
        return false;
    const key = event.code.replace(/^Key/, "").toUpperCase();
    if (key === "U")
        return true;
    if (key === "S")
        return !event.shiftKey;
    return (event.shiftKey || event.altKey) && (key === "I" || key === "J" || key === "C");
}
/** A paused debugger stops the clock for at least this long (ms) when developer tools are open. */
const TRAP_PAUSE_MS = 100;
/**
 * The debugger trap: does nothing unless developer tools are open, where it pauses. Built at run
 * time so minifiers that drop `debugger` statements (terser's default) keep it; games whose own
 * Content-Security-Policy forbids that simply go without.
 */
function makeTrap(win) {
    try {
        return new win.Function("debugger");
    }
    catch {
        return null;
    }
}
/** How many recent key presses and clicks the timing check looks at. */
const TIMING_WINDOW = 40;
/**
 * Starts reporting to the Powly page over `port`. Returns a function that stops it.
 */
function startPacSensor(port, { guard = false } = {}, win = window) {
    const input = {
        trusted: 0,
        synthetic: 0,
        clicks: 0,
        teleportClicks: 0,
    };
    const keyTimes = [];
    const clickTimes = [];
    // The pointer's last known position, from any pointer event, and whether it moved since.
    let pointer = null;
    const remember = (list, time) => {
        list.push(time);
        if (list.length > TIMING_WINDOW)
            list.shift();
    };
    const onInput = (event) => {
        const counted = event.type === "keydown" || event.type === "pointerdown";
        if (!event.isTrusted) {
            if (counted)
                input.synthetic += 1;
            return;
        }
        if (event.type === "pointermove" || event.type === "pointerover") {
            const move = event;
            pointer = { x: move.clientX, y: move.clientY };
            return;
        }
        if (!counted)
            return;
        input.trusted += 1;
        if (event.type === "keydown") {
            if (!event.repeat)
                remember(keyTimes, event.timeStamp);
            return;
        }
        const down = event;
        if (down.pointerType !== "mouse")
            return;
        input.clicks += 1;
        remember(clickTimes, event.timeStamp);
        // A real mouse moves to where it clicks, and the frame hears that; a driver that clicks at
        // coordinates doesn't. Only a click somewhere else than the pointer last was counts.
        if (pointer && Math.hypot(down.clientX - pointer.x, down.clientY - pointer.y) > 4) {
            input.teleportClicks += 1;
        }
        pointer = { x: down.clientX, y: down.clientY };
    };
    const types = ["keydown", "pointerdown", "pointermove", "pointerover"];
    for (const type of types) {
        win.addEventListener(type, onInput, { capture: true, passive: true });
    }
    // The guard: only the browser's own action is prevented; the game's listeners still run.
    const onGuardKey = (event) => {
        if (isInspectShortcut(event))
            event.preventDefault();
    };
    const onContextMenu = (event) => event.preventDefault();
    if (guard) {
        win.addEventListener("keydown", onGuardKey, { capture: true });
        win.addEventListener("contextmenu", onContextMenu, { capture: true });
    }
    const trap = guard ? makeTrap(win) : null;
    let devtools = false;
    const springTrap = () => {
        if (!trap)
            return;
        const start = win.performance.now();
        trap();
        if (win.performance.now() - start > TRAP_PAUSE_MS)
            devtools = true;
    };
    const now = () => win.performance.now();
    let lastClock = now();
    let lastDate = win.Date.now();
    let dateJump = 0;
    let automation = detectAutomation(win);
    // The date is compared with the monotonic clock more often than reports go out, so a jump in
    // between isn't averaged away.
    const watchDate = () => {
        const clock = now();
        const date = win.Date.now();
        const jump = Math.abs(date - lastDate - (clock - lastClock));
        if (jump > dateJump)
            dateJump = jump;
        lastClock = clock;
        lastDate = date;
    };
    const report = () => {
        watchDate();
        // Drivers can attach after the game started.
        automation = [...new Set([...automation, ...detectAutomation(win)])];
        const sample = {
            type: "pac",
            clock: now(),
            date: win.Date.now(),
            dateJump: Math.round(dateJump),
            devtools,
            tampered: tamperedFunctions(win),
            automation,
            input: {
                ...input,
                keyIntervals: Math.max(keyTimes.length - 1, 0),
                keyIntervalSd: intervalSd(keyTimes),
                clickIntervals: Math.max(clickTimes.length - 1, 0),
                clickIntervalSd: intervalSd(clickTimes),
            },
        };
        try {
            port.postMessage(sample);
        }
        catch { }
        input.trusted = 0;
        input.synthetic = 0;
        input.clicks = 0;
        input.teleportClicks = 0;
        dateJump = 0;
        devtools = false;
    };
    // The browser's own timers, taken before anything could replace them later.
    const setInterval = win.setInterval.bind(win);
    const clearInterval = win.clearInterval.bind(win);
    const dateTimer = setInterval(watchDate, 1000);
    const reportTimer = setInterval(report, PAC_SAMPLE_MS);
    const trapTimer = trap ? setInterval(springTrap, 1500) : undefined;
    report();
    return () => {
        clearInterval(dateTimer);
        clearInterval(reportTimer);
        if (trapTimer !== undefined)
            clearInterval(trapTimer);
        for (const type of types)
            win.removeEventListener(type, onInput, { capture: true });
        win.removeEventListener("keydown", onGuardKey, { capture: true });
        win.removeEventListener("contextmenu", onContextMenu, { capture: true });
    };
}

// The wire protocol of Powly's realtime service (apps/realtime): JSON text frames over one
// WebSocket. Games use it through the SDK (`powly.rooms`, src/rooms.ts); Powly's own pages use it
// for live notifications (apps/web/lib/realtime-client.ts). Shared as types only: the service
// validates every frame itself.
//
// 1. The client gets a ticket from Powly (games: POST /api/platform/v1/realtime with a session
//    token; Powly's pages: POST /api/realtime/ticket with the session cookie) and connects to the
//    ticket's URL.
// 2. Its first frame is `{ op: "auth", ticket }`; the service answers `welcome`. Tickets live two
//    minutes: the client sends a fresh one (`auth` again) before that, or the service closes the
//    connection. That is how ended launches, bans and sign-outs reach open connections.
// 3. Requests carry an `id` and get one `reply`; `room.send` has none (fire and forget).
const REALTIME_PROTOCOL_VERSION = 1;
/** Close codes the service uses (4000–4999 are free for applications). */
const REALTIME_CLOSE = {
    /** The ticket was invalid, or expired without a fresh one. Get a new ticket to reconnect. */
    unauthorized: 4001,
    /** The same player connected too many times; the oldest connection is closed. */
    replaced: 4002,
    /** Too many messages, or the client couldn't keep up with what it was sent. */
    overloaded: 4008,
    /** A frame that isn't valid JSON or protocol. */
    invalid: 4009,
};



const REQUEST_TIMEOUT_MS = 10_000;
const TICKET_REFRESH_MS = 45_000;
const MAX_RETRY_MS = 30_000;
/** With no room and no invite listener, the connection closes after this (ms). */
const IDLE_CLOSE_MS = 60_000;
function emit(listeners, event, payload) {
    for (const listener of listeners.get(event) ?? []) {
        try {
            listener(payload);
        }
        catch (error) {
            // A game's listener throwing mustn't break the connection.
            setTimeout(() => {
                throw error;
            });
        }
    }
}
function listen(listeners, event, listener) {
    const set = listeners.get(event) ?? new Set();
    set.add(listener);
    listeners.set(event, set);
    return () => {
        set.delete(listener);
    };
}
/**
 * The game's realtime connection. `getTicket` asks the platform API for a ticket (POST
 * /realtime); `invite` sends a Powly invite.
 */
function createRooms(options) {
    let socket = null;
    let status = "offline";
    let ready = null;
    let stopped = false;
    let attempt = 0;
    let retryTimer;
    let refreshTimer;
    let idleTimer;
    let nextId = 1;
    const pending = new Map();
    const statusListeners = new Map();
    const inviteListeners = new Set();
    let current = null;
    const setStatus = (next) => {
        if (status === next)
            return;
        status = next;
        emit(statusListeners, "status", next);
    };
    /** Whether anything still needs the connection. */
    const needed = () => !stopped && (current !== null || inviteListeners.size > 0);
    const failPending = (message) => {
        for (const [id, waiting] of pending) {
            clearTimeout(waiting.timer);
            waiting.reject(new PowlyError(message, undefined, "unavailable"));
            pending.delete(id);
        }
    };
    const scheduleRefresh = () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(async () => {
            try {
                const fresh = await options.getTicket();
                if (socket?.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ op: "auth", ticket: fresh.ticket }));
                }
            }
            catch {
                // The launch ended, or Powly is unreachable: the service closes the connection when the
                // ticket runs out, and reconnecting asks again.
            }
            if (socket)
                scheduleRefresh();
        }, TICKET_REFRESH_MS);
    };
    const onMessage = (message) => {
        if (message.type === "reply") {
            const waiting = pending.get(message.id);
            if (!waiting)
                return;
            pending.delete(message.id);
            clearTimeout(waiting.timer);
            if (message.ok)
                waiting.resolve(message.result);
            else
                waiting.reject(new PowlyError(message.error.message, undefined, message.error.code));
        }
        else if (message.type === "invite") {
            for (const listener of inviteListeners)
                listener(message.invite);
        }
        else if (message.type.startsWith("room.")) {
            current?.apply(message);
        }
    };
    const connect = () => {
        if (stopped)
            return Promise.reject(new PowlyError("The launch has ended.", 401));
        clearTimeout(idleTimer);
        ready ??= new Promise((resolve, reject) => {
            setStatus(attempt === 0 && status === "offline" ? "connecting" : "reconnecting");
            let welcomed = false;
            options
                .getTicket()
                .then((ticket) => {
                if (stopped)
                    throw new PowlyError("The launch has ended.", 401);
                const ws = new WebSocket(ticket.url);
                socket = ws;
                ws.onopen = () => ws.send(JSON.stringify({ op: "auth", ticket: ticket.ticket }));
                ws.onmessage = (event) => {
                    let message;
                    try {
                        message = JSON.parse(String(event.data));
                    }
                    catch {
                        return;
                    }
                    if (message.type === "welcome") {
                        welcomed = true;
                        attempt = 0;
                        setStatus("connected");
                        scheduleRefresh();
                        resolve();
                    }
                    else {
                        onMessage(message);
                    }
                };
                ws.onclose = (event) => {
                    if (socket !== ws)
                        return;
                    socket = null;
                    ready = null;
                    clearTimeout(refreshTimer);
                    failPending("The connection to Powly was lost.");
                    if (!welcomed)
                        reject(new PowlyError("Couldn’t connect to Powly.", undefined, "unavailable"));
                    onDisconnected(event.code);
                };
            })
                .catch((error) => {
                ready = null;
                setStatus("offline");
                reject(error instanceof PowlyError ? error : new PowlyError("Couldn’t connect to Powly."));
                // The ticket was refused (launch over): nothing to retry.
                if (error instanceof PowlyError && error.status === 401)
                    return;
                if (needed())
                    retry();
            });
        });
        return ready;
    };
    const retry = () => {
        clearTimeout(retryTimer);
        const delay = Math.min(MAX_RETRY_MS, 1000 * 2 ** attempt) * (0.5 + Math.random() / 2);
        attempt += 1;
        setStatus("reconnecting");
        retryTimer = setTimeout(() => {
            if (!needed())
                return setStatus("offline");
            connect()
                .then(rejoin)
                .catch(() => { });
        }, delay);
    };
    const onDisconnected = (code) => {
        if (code === REALTIME_CLOSE.replaced) {
            // This player connected again elsewhere (another tab): that one has the room now.
            current?.close("replaced");
            setStatus("offline");
            return;
        }
        if (!needed())
            return setStatus("offline");
        retry();
    };
    /** Back after a dropped connection: take the seat in the room again. */
    const rejoin = async () => {
        const room = current;
        if (!room)
            return;
        try {
            const state = (await request({
                op: "room.join",
                code: room.code,
                me: room.myData(),
            }));
            if (current === room)
                room.reset(state);
        }
        catch (error) {
            if (current === room && !(error instanceof PowlyError && error.code === "unavailable")) {
                room.close("connection");
            }
        }
    };
    const request = async (message) => {
        await connect();
        const ws = socket;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            throw new PowlyError("Not connected to Powly.", undefined, "unavailable");
        }
        const id = nextId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                pending.delete(id);
                reject(new PowlyError("Powly didn’t answer in time.", undefined, "unavailable"));
            }, REQUEST_TIMEOUT_MS);
            pending.set(id, { resolve, reject, timer });
            ws.send(JSON.stringify({ ...message, id }));
        });
    };
    const disconnect = () => {
        clearTimeout(retryTimer);
        clearTimeout(refreshTimer);
        clearTimeout(idleTimer);
        const ws = socket;
        socket = null;
        ready = null;
        ws?.close(1000);
        setStatus("offline");
    };
    /** Closes the connection once nothing has needed it for a minute. */
    const disconnectIfIdle = () => {
        clearTimeout(idleTimer);
        if (needed())
            return;
        if (stopped)
            return disconnect();
        idleTimer = setTimeout(() => {
            if (!needed())
                disconnect();
        }, IDLE_CLOSE_MS);
    };
    function createRoom(initial) {
        let state = initial;
        let active = true;
        const listeners = new Map();
        const view = {
            get id() {
                return state.id;
            },
            get code() {
                return state.code;
            },
            get hostId() {
                return state.hostId;
            },
            get isHost() {
                return state.hostId === options.playerId;
            },
            get maxPlayers() {
                return state.maxPlayers;
            },
            get locked() {
                return state.locked;
            },
            get listed() {
                return state.listed;
            },
            get data() {
                return state.data;
            },
            get members() {
                return state.members;
            },
            get active() {
                return active;
            },
            send(event, data, sendOptions) {
                if (!active || socket?.readyState !== WebSocket.OPEN || status !== "connected")
                    return false;
                socket.send(JSON.stringify({
                    op: "room.send",
                    event,
                    data,
                    ...(sendOptions?.to !== undefined && { to: sendOptions.to }),
                }));
                return true;
            },
            on: (event, listener) => listen(listeners, event, listener),
            update: async (changes) => {
                handle.reset((await request({ op: "room.update", ...changes })));
            },
            setMyData: async (data) => {
                const member = (await request({ op: "room.me", data }));
                state = {
                    ...state,
                    members: state.members.map((entry) => entry.playerId === member.playerId ? member : entry),
                };
            },
            kick: async (playerId) => {
                await request({ op: "room.kick", playerId });
            },
            makeHost: async (playerId) => {
                handle.reset((await request({ op: "room.host", playerId })));
            },
            invite: (playerId) => options.invite(playerId, { room: state.code }),
            leave: async () => {
                if (!active)
                    return;
                const open = socket?.readyState === WebSocket.OPEN;
                handle.close("left");
                if (open)
                    await request({ op: "room.leave" });
            },
        };
        const replaceMember = (member) => {
            const known = state.members.some((entry) => entry.playerId === member.playerId);
            state = {
                ...state,
                members: known
                    ? state.members.map((entry) => (entry.playerId === member.playerId ? member : entry))
                    : [...state.members, member],
            };
        };
        const handle = {
            view,
            get code() {
                return state.code;
            },
            /** What you share in the room, to keep it when rejoining. */
            myData() {
                return state.members.find((entry) => entry.playerId === options.playerId)?.data ?? null;
            },
            reset(next) {
                const changed = next.hostId !== state.hostId ||
                    next.locked !== state.locked ||
                    next.listed !== state.listed ||
                    JSON.stringify(next.data) !== JSON.stringify(state.data);
                state = next;
                if (changed)
                    emit(listeners, "update", view);
            },
            apply(message) {
                if (!active)
                    return;
                switch (message.type) {
                    case "room.message":
                        emit(listeners, "message", {
                            from: message.from,
                            event: message.event,
                            data: message.data,
                        });
                        break;
                    case "room.member_joined":
                        replaceMember(message.member);
                        emit(listeners, "join", message.member);
                        break;
                    case "room.member_updated":
                        replaceMember(message.member);
                        emit(listeners, "member", message.member);
                        break;
                    case "room.member_left":
                        state = {
                            ...state,
                            members: state.members.filter((entry) => entry.playerId !== message.playerId),
                        };
                        emit(listeners, "leave", { playerId: message.playerId, reason: message.reason });
                        break;
                    case "room.updated":
                        state = {
                            ...state,
                            hostId: message.hostId,
                            data: message.data,
                            locked: message.locked,
                            listed: message.listed,
                        };
                        emit(listeners, "update", view);
                        break;
                    case "room.left":
                        handle.close(message.reason === "closed" ? "connection" : message.reason);
                        break;
                }
            },
            close(reason) {
                if (!active)
                    return;
                active = false;
                if (current === handle)
                    current = null;
                emit(listeners, "closed", { reason });
                disconnectIfIdle();
            },
        };
        return handle;
    }
    const enter = (state) => {
        // Creating or joining a room left the one before.
        current?.close("left");
        const handle = createRoom(state);
        current = handle;
        return handle.view;
    };
    return {
        rooms: {
            create: async (createOptions = {}) => enter((await request({ op: "room.create", ...createOptions }))),
            join: async (code, joinOptions = {}) => {
                if (typeof code !== "string" || !code.trim()) {
                    throw new PowlyError("Give a room code.", undefined, "invalid");
                }
                if (current && current.code === code.replace(/[\s-]/g, "").toUpperCase()) {
                    return current.view;
                }
                return enter((await request({ op: "room.join", code, me: joinOptions.me })));
            },
            list: async () => {
                try {
                    return (await request({ op: "room.list" }));
                }
                finally {
                    disconnectIfIdle();
                }
            },
            get current() {
                return current?.view ?? null;
            },
            get status() {
                return status;
            },
            on: (event, listener) => listen(statusListeners, event, listener),
        },
        onInvite(listener) {
            inviteListeners.add(listener);
            connect().catch(() => { });
            return () => {
                inviteListeners.delete(listener);
                disconnectIfIdle();
            };
        },
        stop() {
            stopped = true;
            current?.close("connection");
            inviteListeners.clear();
            failPending("The launch has ended.");
            disconnectIfIdle();
        },
    };
}







// The Powly SDK for games. `Powly.init()` handshakes with the Powly page that framed the game and
// refuses to start anywhere else; afterwards the game gets the player's profile, short-lived
// session tokens (refreshed automatically) and the platform services.
//
//   const powly = await Powly.init();
//   powly.profile.username;
//   await powly.leaderboards.submit("high-score", 1200);
//   const token = await powly.getSessionToken(); // send it to your backend, which verifies it
//   const room = await powly.rooms.create();    // realtime parties (src/rooms.ts)
//
// Nothing here is a security boundary: the game runs in the player's browser. Your backend must
// verify session tokens (JWKS) or exchange them, and Powly checks everything server-side.
//
// Powly Anti-Cheat starts with the session (src/pac.ts): the SDK reports the game's clocks,
// replaced browser functions, automation traces and input timing to the Powly page. Runs it flags
// can't submit scores, unlock achievements or write saves.
//
// Saves are created in Studio (game → Saves); other keys and values of another type can't be
// written.
// Saves and leaderboard scores are written by your backend by default (an access token from the
// token exchange), because players can change anything the browser sends. `saves.set`/`delete`
// only work on saves the studio lets the browser write, and `leaderboards.submit` only on boards created with `clientSubmissions: true`; otherwise they
// fail with a 403 PowlyError. Reading saves and leaderboards always works.

function expectedOrigins(options) {
    const configured = options.powlyOrigin;
    if (configured)
        return (Array.isArray(configured) ? configured : [configured]).map(originOf);
    // The launch URL can't add an origin (anyone can write one): it only narrows the built-in list.
    const fromUrl = originOf(new URL(location.href).searchParams.get("powly_origin") ?? "");
    const known = POWLY_ORIGINS.map(originOf);
    const candidates = known.includes(fromUrl) ? [fromUrl] : known;
    // Where the browser tells us who our parent really is, it must be one of them.
    const parent = location.ancestorOrigins?.[0];
    return parent ? candidates.filter((origin) => origin === parent) : candidates;
}
function originOf(value) {
    try {
        return new URL(value).origin;
    }
    catch {
        return "";
    }
}
/** Starts the SDK. Rejects when the game wasn't launched from Powly. */
function init(options = {}) {
    if (window.parent === window) {
        return Promise.reject(new PowlyError("This game only runs when launched from Powly."));
    }
    const origins = expectedOrigins(options).filter(Boolean);
    if (origins.length === 0) {
        return Promise.reject(new PowlyError("This game only runs when launched from Powly."));
    }
    return new Promise((resolve, reject) => {
        const channels = origins.map((origin) => {
            const channel = new MessageChannel();
            const message = {
                protocol: PROTOCOL,
                version: PROTOCOL_VERSION,
                type: "init",
                sdkVersion: SDK_VERSION,
                pac: 1,
            };
            channel.port1.onmessage = (event) => {
                const data = event.data;
                if (data?.type === "ready") {
                    clearTimeout(timer);
                    for (const other of channels)
                        if (other !== channel)
                            other.port1.close();
                    resolve(createSession(channel.port1, data));
                }
                else if (data?.type === "failed") {
                    clearTimeout(timer);
                    reject(new PowlyError(data.error));
                }
            };
            // targetOrigin: the port is only delivered if the parent really is this Powly origin.
            window.parent.postMessage(message, origin, [channel.port2]);
            return channel;
        });
        const timer = setTimeout(() => {
            for (const channel of channels)
                channel.port1.close();
            reject(new PowlyError("Powly didn’t answer. This game only runs when launched from Powly."));
        }, options.timeoutMs ?? 10_000);
    });
}
function createSession(port, ready) {
    let token = ready.token;
    let expiresAt = Date.now() + ready.expiresIn * 1000;
    let refreshing = null;
    let nextId = 1;
    const pending = new Map();
    const listeners = new Map();
    port.onmessage = (event) => {
        const data = event.data;
        if (data?.type === "response") {
            const waiting = pending.get(data.id);
            if (!waiting)
                return;
            pending.delete(data.id);
            if (data.ok)
                waiting.resolve(data.result);
            else
                waiting.reject(new PowlyError(data.error));
        }
        else if (data?.type === "event") {
            for (const listener of listeners.get(data.event) ?? [])
                listener();
        }
    };
    const call = (method) => new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        port.postMessage({ type: "request", id, method });
    });
    const getSessionToken = async () => {
        if (expiresAt - Date.now() > 10_000)
            return token;
        refreshing ??= call("getSessionToken")
            .then((result) => {
            const fresh = result;
            token = fresh.token;
            expiresAt = Date.now() + fresh.expiresIn * 1000;
            return token;
        })
            .finally(() => {
            refreshing = null;
        });
        return refreshing;
    };
    // Keep a token ready, so calls don't wait for a refresh.
    const refreshTimer = setInterval(() => {
        if (expiresAt - Date.now() < 20_000)
            getSessionToken().catch(() => { });
    }, 5_000);
    const stopPac = startPacSensor(port, { guard: ready.pac?.guard === true });
    listeners.set("ended", new Set([() => clearInterval(refreshTimer), stopPac]));
    const api = async (path, init = {}) => {
        const response = await fetch(`${ready.apiBase}${path}`, {
            method: init.method ?? "GET",
            headers: {
                authorization: `Bearer ${await getSessionToken()}`,
                ...(init.body !== undefined && { "content-type": "application/json" }),
            },
            body: init.body === undefined ? undefined : JSON.stringify(init.body),
            credentials: "omit",
        });
        const data = response.status === 204 ? null : await response.json().catch(() => null);
        if (!response.ok) {
            const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
                ? data.error
                : `Request failed (${response.status})`;
            throw new PowlyError(message, response.status);
        }
        return data;
    };
    const path = (value) => encodeURIComponent(value);
    const sendInvite = async (playerId, params = {}) => {
        await api("/invites", { method: "POST", body: { to: playerId, params } });
    };
    const realtime = createRooms({
        playerId: ready.profile.playerId,
        getTicket: () => api("/realtime", { method: "POST" }),
        invite: sendInvite,
    });
    listeners.get("ended")?.add(() => realtime.stop());
    const saves = {
        get: async (key) => {
            try {
                return (await api(`/saves/${path(key)}`)).value;
            }
            catch (error) {
                if (error instanceof PowlyError && error.status === 404)
                    return null;
                throw error;
            }
        },
        all: async () => (await api("/saves?values=1")).values,
        set: async (key, value) => {
            await api(`/saves/${path(key)}`, { method: "PUT", body: { value } });
        },
        delete: async (key) => {
            await api(`/saves/${path(key)}`, { method: "DELETE" });
        },
        list: async () => (await api("/saves")).keys,
    };
    return {
        profile: ready.profile,
        scopes: ready.scopes,
        launchParams: ready.params,
        launchId: ready.launchId,
        apiBase: ready.apiBase,
        getSessionToken,
        api,
        friends: { list: async () => (await api("/friends")).friends },
        presence: {
            set: async (text) => {
                await api("/presence", { method: "PUT", body: { text } });
            },
        },
        invites: {
            list: async () => (await api("/invites")).invites,
            send: sendInvite,
            on: (_event, listener) => realtime.onInvite(listener),
        },
        rooms: realtime.rooms,
        leaderboards: {
            submit: (board, score) => api(`/leaderboards/${path(board)}/scores`, { method: "POST", body: { score } }),
            top: async (board, limit = 10) => (await api(`/leaderboards/${path(board)}?limit=${limit}`))
                .entries,
        },
        saves,
        achievements: {
            list: async () => (await api("/achievements")).achievements,
            unlock: (key) => api("/achievements", { method: "POST", body: { key } }),
        },
        settings: { get: saves.get, all: saves.all, set: saves.set, reset: saves.delete },
        ownership: { get: () => api("/ownership") },
        purchases: {
            open: async () => {
                await call("purchases.open");
            },
        },
        fullscreen: {
            toggle: async () => {
                await call("fullscreen.toggle");
            },
        },
        on(event, listener) {
            const set = listeners.get(event) ?? new Set();
            set.add(listener);
            listeners.set(event, set);
            return () => set.delete(listener);
        },
    };
}
const Powly = { init, SDK_VERSION, PowlyError };

export { init, PowlyError, SDK_VERSION };
export default Powly;
