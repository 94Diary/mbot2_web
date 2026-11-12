import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { Button, ToggleRow } from '../../ui/index.js';

const KEY = 'mbot2.consent';
const ConsentContext = createContext(null);

function readStored() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? null; } catch { return null; }
}

/**
 * PDPA cookie consent (decisions.md §9): accept and reject equally prominent, per-category choice,
 * easy to withdraw (footer link reopens it). Every choice is recorded on the server (consent_records).
 */
export function ConsentProvider({ children }) {
  const [stored, setStored] = useState(readStored);
  const [open, setOpen] = useState(() => !readStored());
  const [custom, setCustom] = useState(false);

  const save = useCallback(async (choices) => {
    let anonId = stored?.anon_id;
    try {
      const res = await api('/consent', { method: 'POST', body: { anon_id: anonId, choices } });
      anonId = res.anon_id;
    } catch { /* ยังเก็บในเครื่องไว้ แม้บันทึกฝั่งเซิร์ฟเวอร์ไม่สำเร็จ */ }
    const next = { anon_id: anonId, choices, at: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
    setStored(next);
    setOpen(false);
    setCustom(false);
  }, [stored]);

  const value = useMemo(() => ({
    choices: stored?.choices ?? { necessary: true, prefs: false, analytics: false },
    reopen: () => { setOpen(true); setCustom(true); },
  }), [stored]);

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {open ? <CookieBanner custom={custom} setCustom={setCustom} initial={stored?.choices} onSave={save} /> : null}
    </ConsentContext.Provider>
  );
}

export const useConsent = () => useContext(ConsentContext);

function CookieBanner({ custom, setCustom, initial, onSave }) {
  const [prefs, setPrefs] = useState(initial?.prefs ?? true);
  const [analytics, setAnalytics] = useState(initial?.analytics ?? false);
  const reject = () => onSave({ prefs: false, analytics: false });
  if (custom) {
    return (
      <div className="cookie fadeup" role="dialog" aria-label="ตั้งค่าคุกกี้">
        <h3 style={{ fontSize: 18 }}>ตั้งค่าคุกกี้</h3>
        <ToggleRow title="จำเป็น" description="ให้เว็บทำงานได้ เช่น การเข้าสู่ระบบ ปิดไม่ได้" checked disabled onChange={() => {}} />
        <ToggleRow title="จำการตั้งค่า" description="จำธีมสว่าง/มืด และหุ่นที่เลือก" checked={prefs} onChange={setPrefs} />
        <ToggleRow title="สถิติการใช้งาน" description="นับคนเข้าเว็บแบบไม่ระบุตัวตน ช่วยให้ทีมปรับเว็บ" checked={analytics} onChange={setAnalytics} />
        <div className="row wrapr" style={{ justifyContent: 'flex-end' }}>
          <Button size="sm" onClick={reject}>ปฏิเสธทั้งหมด</Button>
          <Button size="sm" variant="primary" onClick={() => onSave({ prefs, analytics })}>บันทึกตัวเลือก</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="cookie fadeup" role="dialog" aria-label="การใช้คุกกี้">
      <div><strong>เว็บนี้ใช้คุกกี้</strong> <span className="muted">เพื่อจำการเข้าสู่ระบบและการตั้งค่าของคุณ และนับสถิติการใช้งานถ้าคุณยินยอม อ่าน <Link to="/privacy">นโยบายความเป็นส่วนตัว</Link></span></div>
      <div className="row wrapr">
        <Button size="sm" onClick={reject}>ปฏิเสธทั้งหมด</Button>
        <Button size="sm" variant="primary" onClick={() => onSave({ prefs: true, analytics: true })}>ยอมรับทั้งหมด</Button>
        <button type="button" className="link" onClick={() => setCustom(true)}>ตั้งค่าเอง</button>
      </div>
    </div>
  );
}
