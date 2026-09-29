import React from "react";
import { createRoot } from "react-dom/client";
import { OriginalScene } from "./OriginalScene";

if (window.location.pathname === "/original") {
  window.history.replaceState(null, "", "/");
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OriginalScene />
  </React.StrictMode>,
);
