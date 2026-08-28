import { Component } from 'react'

export default class RouteErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div role="alert" style={{ padding: 32, color: 'var(--text-primary)' }}>
        <h1>页面加载失败</h1>
        <p>这部分内容暂时无法显示，请重试。</p>
        <button type="button" onClick={this.handleRetry}>重试</button>
      </div>
    )
  }
}
