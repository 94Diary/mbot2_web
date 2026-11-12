import { useId, useState } from 'react';
import { Icon } from './Icon.jsx';

/** Label + control + hint/error. `children` receives the generated id via render prop or uses `id`. */
export function Field({ label, hint, error, children, id: given }) {
  const auto = useId();
  const id = given ?? auto;
  return (
    <div className="field">
      {label ? <label htmlFor={id}>{label}</label> : null}
      {typeof children === 'function' ? children(id, { 'aria-invalid': Boolean(error), 'aria-describedby': `${id}-msg` }) : children}
      {error ? <span className="err" id={`${id}-msg`}>{error}</span> : hint ? <span className="hint" id={`${id}-msg`}>{hint}</span> : null}
    </div>
  );
}

export function TextInput({ label, hint, error, className = '', ...props }) {
  return (
    <Field label={label} hint={hint} error={error} id={props.id}>
      {(id, aria) => <input id={id} className={`in ${error ? 'bad' : ''} ${className}`} {...aria} {...props} />}
    </Field>
  );
}

export function PasswordInput({ label = 'รหัสผ่าน', hint, error, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, aria) => (
        <div style={{ position: 'relative' }}>
          <input id={id} type={show ? 'text' : 'password'} className={`in ${error ? 'bad' : ''}`} style={{ paddingRight: 48 }} {...aria} {...props} />
          <button type="button" className="btn iconOnly sm" aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} aria-pressed={show}
            onClick={() => setShow((s) => !s)} style={{ position: 'absolute', right: 5, top: 5, border: 'none' }}>
            <Icon name="eye" size={18} />
          </button>
        </div>
      )}
    </Field>
  );
}

export function Select({ label, hint, error, options, ...props }) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, aria) => (
        <select id={id} className={`in ${error ? 'bad' : ''}`} {...aria} {...props}>
          {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
        </select>
      )}
    </Field>
  );
}

export function Textarea({ label, hint, error, ...props }) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, aria) => <textarea id={id} className={`in ${error ? 'bad' : ''}`} {...aria} {...props} />}
    </Field>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button type="button" className="toggle" aria-pressed={Boolean(checked)} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)} />
  );
}

export function ToggleRow({ title, description, checked, onChange, disabled }) {
  return (
    <div className="toggle-row">
      <span className="txt"><strong>{title}</strong>{description ? <small>{description}</small> : null}</span>
      <Toggle checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}

/** options: [{ value, label, disabled?, dot? }] */
export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} disabled={o.disabled}
          onClick={() => onChange(o.value)} title={o.title}>
          {o.dot ? <span className="dot" style={{ color: o.dot }} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'ค้นหา', label = 'ค้นหา' }) {
  return (
    <label className="searchbox">
      <Icon name="search" size={18} />
      <span className="sr">{label}</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}
