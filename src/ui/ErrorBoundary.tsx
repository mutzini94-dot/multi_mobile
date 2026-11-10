import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReload?(): void; // 새로고침 (기본: 창을 다시 읽는다)
}

/**
 * 화면을 그리다 오류가 나면 React는 앱 전체를 지워 까만 창만 남는다.
 * 그 대신 안내와 복구 버튼을 보여 준다 (창 구성은 저장값에 있어 다시 그리거나 새로고침해도 그대로)
 */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[멀티뷰] 화면 오류', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const reload = this.props.onReload ?? (() => window.location.reload());
    return (
      <div className="crash" role="alert">
        <p className="crash__title">화면을 그리는 중 오류가 났습니다</p>
        <p className="crash__desc">창 구성은 그대로 저장되어 있습니다. 다시 그리거나 새로고침해 주세요.</p>
        <div className="crash__actions">
          <button type="button" className="btn btn--donate" onClick={() => this.setState({ error: null })}>
            다시 그리기
          </button>
          <button type="button" className="btn btn--ghost" onClick={reload}>
            새로고침
          </button>
        </div>
        <p className="crash__detail">{error.message}</p>
      </div>
    );
  }
}
