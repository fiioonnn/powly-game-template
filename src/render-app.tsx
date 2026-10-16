import "@fontsource-variable/space-grotesk";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import type { Connection } from "./main";
import "./styles.css";

export function renderApp(connection: Connection) {
  const root = document.querySelector<HTMLElement>("#root");
  if (!root) throw new Error("Missing #root element.");

  createRoot(root).render(
    <StrictMode>
      <App connection={connection} />
    </StrictMode>,
  );
}
