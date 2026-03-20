"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          padding: 24,
          textAlign: "center",
          borderRadius: 12,
          border: "1px solid #fecaca",
          background: "#fef2f2",
          margin: 16
        }}>
          <p style={{ fontWeight: 600, color: "#991b1b", fontSize: 16 }}>
            Qualcosa è andato storto
          </p>
          <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 8 }}>
            Si è verificato un errore imprevisto. Ricarica la pagina per riprovare.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 16,
              padding: "8px 24px",
              background: "#1e40af",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Riprova
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
