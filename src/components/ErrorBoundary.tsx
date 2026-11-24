import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected application error.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="h-dvh w-full bg-[#050507] text-white flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl bg-[#13131A] border border-white/15 p-6 text-center shadow-2xl">
            <h2 className="font-display text-xl font-extrabold">Something went wrong</h2>
            <p className="mt-2 text-xs text-zinc-400 break-words">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 w-full py-2.5 px-4 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold text-sm transition-colors"
            >
              Reload Game
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
