import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";
// KaTeX CSS for math rendering
import "katex/dist/katex.min.css";
// Highlight.js theme for code syntax highlighting
import "highlight.js/styles/atom-one-dark.css";

const rootElement = document.getElementById("root")!;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
