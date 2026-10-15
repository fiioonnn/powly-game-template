import Powly, { type PowlySession } from "./powly/powly.mjs";

export type Connection = {
  session: PowlySession | null;
  error: string | null;
};

// Connect before React, the UI, or game assets are imported. Powly expects the handshake promptly.
let connection: Connection;
try {
  connection = { session: await Powly.init(), error: null };
} catch (error) {
  connection = {
    session: null,
    error: error instanceof Error ? error.message : "Could not connect to Powly.",
  };
}

const { renderApp } = await import("./render-app");
renderApp(connection);
