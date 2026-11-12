import { Link } from 'react-router-dom';
import { Icon } from './Icon.jsx';

/**
 * variant: default | primary | blue | chip | danger | ghostDanger · size: sm | md | lg
 * iconOnly buttons must pass `label` (becomes aria-label).
 */
export function Button({
  variant = 'default', size = 'md', icon, iconOnly = false, loading = false, label, to, children, className = '', ...rest
}) {
  const cls = ['btn', variant !== 'default' && variant, size !== 'md' && size, iconOnly && 'iconOnly', className]
    .filter(Boolean).join(' ');
  const content = (
    <>
      {loading ? <span className="spin" aria-hidden>↻</span> : icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} /> : null}
      {iconOnly ? null : loading && typeof children === 'string' ? `กำลัง${children.replace(/^กำลัง/, '')}…` : children}
    </>
  );
  if (to) {
    return <Link to={to} className={cls} aria-label={iconOnly ? label : undefined} {...rest}>{content}</Link>;
  }
  return (
    <button type="button" className={cls} disabled={loading || rest.disabled} aria-label={iconOnly ? label : undefined} {...rest}>
      {content}
    </button>
  );
}
