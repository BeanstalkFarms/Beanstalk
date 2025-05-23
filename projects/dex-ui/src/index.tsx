import React from "react";

import ReactDOM from "react-dom/client";

import { App } from "src/components/App/App";
import { Wrapper } from "src/components/App/Wrapper";

import "src/normalize.css";
import "src/theme.css";
import "src/index.css";
import { basin } from "./utils/useBasin";

basin();

ReactDOM.createRoot(document.getElementById("root")!).render(
  // <React.StrictMode>
  <Wrapper>
    <App />
  </Wrapper>
  // </React.StrictMode>
);
