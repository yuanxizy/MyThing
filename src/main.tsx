import React from "react";
import { createRoot } from "react-dom/client";
import { Scene } from "./Scene";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Scene />
  </React.StrictMode>,
);
