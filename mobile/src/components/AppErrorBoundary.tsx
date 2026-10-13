import React from "react";
import CrashScreen from "./CrashScreen";

// Catches render-time errors anywhere in the app tree and shows CrashScreen with
// the error + component stack, instead of letting the error propagate to React
// Native's fatal handler (which aborts the process). Pairs with
// lib/installErrorGuard for non-render (async/effect) startup errors.
type Props = { children: React.ReactNode };
type State = { error: Error | null; info: string };

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    this.setState({ error, info: info?.componentStack ?? "" });
  }

  render() {
    if (this.state.error) {
      return <CrashScreen error={this.state.error} info={this.state.info} />;
    }
    return this.props.children;
  }
}
