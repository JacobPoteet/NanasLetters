import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Nothing downstream (page components, the router) catches a render-time
// throw, so without this a single bad component unmounts the whole tree and
// leaves a blank white page — the worst possible failure for a family
// visitor who just wants to read a letter.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled error rendering the app", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="content">
          <div className="eyebrow">Something went wrong</div>
          <div className="big-date" style={{ fontSize: 40 }}>
            This page hit a snag
          </div>
          <div className="subtext">Reloading usually fixes it. If it keeps happening, let Jacob know.</div>
          <div style={{ marginTop: 24 }}>
            <button onClick={() => window.location.assign("/")}>← Back to On this day</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
