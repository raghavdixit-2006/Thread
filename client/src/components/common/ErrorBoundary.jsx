// components/common/ErrorBoundary.jsx - last-resort render guard. A page-level
// crash should not blank the header and footer; show a recoverable panel instead.
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the detail in the console for local debugging; never render a stack to shoppers.
    console.error('THREAD render error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container page-head">
        <div className="panel empty-state" role="alert">
          <i className="bi bi-exclamation-triangle" aria-hidden="true" />
          <h3>This page hit a snag</h3>
          <p>The rest of the shop is still here. Reload the page or head back to the catalogue.</p>
          <div className="error-actions">
            <button type="button" className="btn" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <a className="btn ghost" href="/shop">Back to the shop</a>
          </div>
        </div>
      </div>
    );
  }
}
