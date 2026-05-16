import { Component } from 'react';
import './ErrorBoundary.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = import.meta.env.DEV;

    return (
      <div className="error-boundary" dir="rtl">
        <div className="error-boundary__card">
          <div className="error-boundary__icon">&#9888;&#65039;</div>
          <h1 className="error-boundary__title">حدث خطأ غير متوقع</h1>
          <p className="error-boundary__subtitle">
            نعتذر عن هذا الخطأ. يرجى إعادة تحميل الصفحة.
          </p>
          <div className="error-boundary__actions">
            <button
              className="error-boundary__btn error-boundary__btn--primary"
              onClick={() => window.location.reload()}
            >
              إعادة تحميل الصفحة
            </button>
            <button
              className="error-boundary__btn error-boundary__btn--secondary"
              onClick={() => window.history.back()}
            >
              الرجوع
            </button>
          </div>
          {isDev && this.state.error && (
            <details className="error-boundary__details">
              <summary>تفاصيل الخطأ (وضع التطوير)</summary>
              <pre className="error-boundary__stack">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
