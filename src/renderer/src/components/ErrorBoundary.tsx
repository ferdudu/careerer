import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Keeps one broken screen from blanking the whole window. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Screen crashed:', error.message, info.componentStack)
  }

  componentDidUpdate(prev: { resetKey?: string }): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="page">
        <div className="errbox" role="alert">
          <strong>This screen hit a problem.</strong>
          <p>{this.state.error.message}</p>
          <div className="row-wrap">
            <a className="btn" href="#/">
              Back to New application
            </a>
          </div>
        </div>
      </div>
    )
  }
}
