import React from "react";
import ReactDOM from "react-dom/client";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error) {
      return React.createElement(
        "div",
        { style: { padding: 20, color: "red" } },
        React.createElement("h2", null, "Error"),
        React.createElement("pre", null, this.state.error),
      );
    }
    return this.props.children;
  }
}

import App from "./App";

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    React.createElement(ErrorBoundary, null, React.createElement(App)),
  );
} else {
  document.body.innerHTML =
    '<div style="padding:20px;color:red">No #root element found</div>';
}
