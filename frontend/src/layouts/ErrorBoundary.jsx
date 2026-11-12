import { Component } from 'react';
import { Button, Gate } from '../ui/index.js';

/** Page 500 (mockup › servererror): shows a reference code instead of a blank screen. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, ref: null };
  }

  static getDerivedStateFromError(error) {
    return { error, ref: `ERR-${Date.now().toString(16).slice(-4).toUpperCase()}` };
  }

  componentDidCatch(error, info) {
    console.error(`[${this.state.ref}]`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="wrap page">
        <Gate icon="warn" title="ระบบขัดข้องชั่วคราว (500)" action={(
          <>
            <Button variant="primary" onClick={() => window.location.reload()}>ลองอีกครั้ง</Button>
            <Button onClick={() => { window.location.href = '/contact'; }}>แจ้งทีม</Button>
          </>
        )}>
          ไม่ใช่ความผิดของคุณ ลองใหม่อีกครั้งในอีกสักครู่ · รหัสอ้างอิง <span className="M">{this.state.ref}</span>
        </Gate>
      </main>
    );
  }
}
