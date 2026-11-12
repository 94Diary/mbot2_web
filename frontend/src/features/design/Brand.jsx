import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../lib/theme.js';

/** โลโก้ = เส้นทางขั้นบันไดแบบที่หุ่นเดินในเขาวงกต */
export function LogoMark({ size = 18, color = 'var(--orange)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path d="M3 15V9h6V3h6" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function ThemeButton({ className = 'sqbtn' }) {
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด';
  return (
    <button type="button" className={className} onClick={toggle} aria-label={label} title={label}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
      </svg>
    </button>
  );
}

export const Arrow = ({ size = 18 }) => (
  <svg className="arr" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

/**
 * ปุ่มวงจรของหน้าแรก: hover แล้วมีวงเส้นประวิ่งรอบและขาวงจร 4 ทิศ · กดแล้ววงต่อเป็นเส้นเดียวสีส้มก่อนเปลี่ยนหน้า
 * variant: primary | chip | ghost
 */
export function CircuitButton({ to, variant = 'primary', icon, children }) {
  const navigate = useNavigate();
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  const [go, setGo] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setWidth(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const onClick = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setGo(true);
    setTimeout(() => navigate(to), 380);
  };
  const w = width + 14;
  return (
    <Link ref={ref} to={to} onClick={onClick} className={`cbtn cb-${variant} ${go ? 'is-go' : ''}`}>
      <svg className="cb-ring" viewBox={`0 0 ${w} 70`} preserveAspectRatio="none" aria-hidden="true">
        <rect x="1" y="1" width={Math.max(0, w - 2)} height="68" rx="34" pathLength="1" />
      </svg>
      <span className="cb-t cb-l" /><span className="cb-t cb-r" /><span className="cb-t cb-u" /><span className="cb-t cb-d" />
      {icon}{children}<Arrow />
    </Link>
  );
}

// เส้นวงจรพาดจอ 9 เส้น สลับ ส้ม ฟ้า เทา (จากดีไซน์ .pt-in)
const TRANSITION_PATHS = [
  ['M-20 52H177L215 14H436H595L633 -24H770L808 -62H1030L1068 -24H1262L1300 -62H1476L1514 -24', 'var(--orange)'],
  ['M-20 157H192H356L394 119H581L619 81H745L783 119H969H1138L1176 81H1375H1590L1628 43', 'var(--blue)'],
  ['M-20 262H186L224 300H443L481 338H664L702 300H885H1076L1114 262H1374H1495', 'var(--ink-4)'],
  ['M-20 348H179L217 386H386H614L652 424H845H1080L1118 386H1297H1483L1521 348', 'var(--orange)'],
  ['M-20 427H111H302L340 465H596L634 503H874L912 541H1119L1157 503H1327L1365 465H1590L1628 427', 'var(--blue)'],
  ['M-20 540H212H379H610L648 578H850L888 616H1058H1203L1241 578H1419H1599L1637 540', 'var(--ink-4)'],
  ['M-20 625H145H382L420 587H550H691H894L932 549H1134H1336L1374 511H1599L1637 549', 'var(--orange)'],
  ['M-20 731H119H288H482L520 693H704H864H986H1117H1280H1492', 'var(--blue)'],
  ['M-20 823H124H297H470L508 785H643L681 747H815L853 785H1016L1054 823H1212L1250 861H1380L1418 899H1663L1701 937', 'var(--ink-4)'],
];

/** ฉากเปลี่ยนหน้า: เล่นเมื่อเปลี่ยน “ส่วน” ของเว็บ (หน้าแรก บทเรียน คอนโซล หลังบ้าน …) ไม่ใช่ทุกครั้งที่ query เปลี่ยน */
export function PageTransition() {
  const { pathname } = useLocation();
  const parts = pathname.split('/');
  // คอนโซล/หลังบ้านใช้หน้าตาแบบเดิม ไม่มีเส้นสลับหน้า · บทเรียนนับเป็นหน้าเดียว เปลี่ยนบทแค่เนื้อหาเปลี่ยน
  if (parts[1] === 'console' || parts[1] === 'admin') return null;
  const section = parts[1] === 'lessons' ? '/lessons' : parts.slice(0, 3).join('/');
  return (
    <div key={section} className="pt-in" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <g fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {TRANSITION_PATHS.map(([d, color], i) => <path key={d} pathLength="1" d={d} stroke={color} style={{ animationDelay: `${i * 35}ms` }} />)}
        </g>
      </svg>
    </div>
  );
}
