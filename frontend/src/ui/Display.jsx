import { Icon } from './Icon.jsx';

export function Pill({ tone = 'gray', children, className = '' }) {
  return <span className={`pill ${tone} ${className}`}>{children}</span>;
}

export function Dot({ color, pulse = false, size = 8 }) {
  return <span className={`dot ${pulse ? 'led' : ''}`} style={{ color, width: size, height: size }} aria-hidden />;
}

export function UserAvatar({ user, size = 32 }) {
  const letter = (user?.display_name ?? '?').trim().charAt(0).toUpperCase();
  return <span className="av" style={{ width: size, height: size, background: user?.avatar_color ?? 'var(--raise)', fontSize: size * 0.42 }}>{letter}</span>;
}

export function BotAvatar({ robot, size = 36 }) {
  const n = String(robot.ns).replace(/\D/g, '') || '?';
  return <span className="av bot" style={{ width: size, height: size, background: robot.color, fontSize: size * 0.42 }} aria-hidden>{n}</span>;
}

export function Skeleton({ height = 16, width = '100%', style }) {
  return <div className="skel" style={{ height, width, ...style }} aria-hidden />;
}

const NOTICE_ICON = { warn: 'warn', red: 'warn', blue: 'info', go: 'check' };
export function Notice({ tone = 'blue', title, children, action }) {
  return (
    <div className={`notice ${tone}`} role={tone === 'red' ? 'alert' : 'status'}>
      <Icon name={NOTICE_ICON[tone]} size={18} />
      <div className="body">
        {title ? <strong>{title}</strong> : null}
        {children ? <div>{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function Banner({ tone = 'info', icon = 'mega', children, onClose }) {
  return (
    <div className={`banner ${tone}`} role={tone === 'red' ? 'alert' : 'status'}>
      <Icon name={icon} size={16} />
      <span className="sp">{children}</span>
      {onClose ? <button type="button" className="link" onClick={onClose} aria-label="ปิดประกาศ"><Icon name="x" size={16} /></button> : null}
    </div>
  );
}

export function EmptyState({ icon = 'doc', title, children, action }) {
  return (
    <div className="empty">
      <span className="ic"><Icon name={icon} size={26} /></span>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action ? <div className="row wrapr" style={{ justifyContent: 'center' }}>{action}</div> : null}
    </div>
  );
}

export function Gate({ icon = 'lock', title, children, action }) {
  return (
    <div className="card pad gate fadeup">
      <EmptyState icon={icon} title={title} action={action}>{children}</EmptyState>
    </div>
  );
}

export function Stat({ label, value, hint, tone }) {
  return (
    <div className="card pad stat">
      <div className="k">{label}</div>
      <div className="num" style={tone ? { color: `var(--${tone})` } : undefined}>{value}</div>
      {hint ? <div className="muted small">{hint}</div> : null}
    </div>
  );
}

export function KeyValue({ label, children }) {
  return <div className="kv"><span>{label}</span><strong>{children}</strong></div>;
}

export function ErrorNotice({ error, onRetry }) {
  if (!error) return null;
  return (
    <Notice tone="red" title="โหลดข้อมูลไม่สำเร็จ" action={onRetry ? <button type="button" className="link" onClick={onRetry}>ลองใหม่</button> : null}>
      {error.message}
    </Notice>
  );
}
