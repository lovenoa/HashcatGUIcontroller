import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./styles-overrides.css";
import "./expert-options.css";
import "./compact.css";
import "./frame-compact.css";
import "./responsive-compact.css";
import "./mobile-rows.css";
import "./toolbox.css";
import "./path-input.css";
import "./result-preview.css";
import "./run-actions.css";
import "./info-pages.css";
import "./algorithm-detail.css";
import "./files-page.css";
import "./converter.css";
import "./hash-mode-combobox.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
