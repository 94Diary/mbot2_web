# แนวทางจากการค้นคว้า

เทียบแนวทางจาก 15 แหล่ง สรุปหลักที่ได้ และนำมาใช้ตรงไหนในเว็บนี้
(ใน mockup มีหน้า “★ แนวทางจากการค้นคว้า” พร้อมเช็กลิสต์และปุ่มเปิดหน้าที่เกี่ยว)

| แหล่ง | หลักที่ได้ | นำมาใช้ |
|---|---|---|
| Eleken · Admin dashboard UI | หลังบ้านเป็นเครื่องมือทำงาน ออกแบบตามงานของแต่ละบทบาท | แยกหลังบ้านออกจากคอนโซลหุ่น · เมนูซ้ายจัดกลุ่มตามงาน |
| UX Studio · Dashboard design | ตัวเลขสำคัญอยู่บนสุด ส่วน “ต้องจัดการ” กดไปแก้ได้ทันที | Dashboard: KPI 4 ตัว + กล่องต้องจัดการ |
| Tenet / Metizsoft · Admin panel | ตารางต้องค้นหา กรอง เลือกหลายแถว แบ่งหน้า รายละเอียดไว้ในแผงข้าง | หน้าผู้ใช้: ค้นหา กรอง bulk pager drawer |
| AppMaster / MakerKit · RBAC | ตารางสิทธิ์ แถว=สิทธิ์ คอลัมน์=บทบาท · API ต้องตอบ 403 | หน้าบทบาทและสิทธิ์ · หน้า 403 · ป้ายดูอย่างเดียว |
| WorkOS / NIST SP 800-92 · Audit log | ใคร ทำอะไร กับอะไร เมื่อไหร่ จากไหน ค่าก่อน/หลัง · append-only · ไม่เก็บรหัสผ่าน | Audit log ไม่มีปุ่มลบ กางดูรายละเอียด/IP เก็บ 1 ปี |
| OWASP · Forgot password | ตอบข้อความเดียวกันเสมอ ลิงก์หมดอายุเร็ว ใช้ครั้งเดียว จำกัดครั้ง | ลืมรหัส · ลิงก์หมดอายุ · ตั้งใหม่แล้วออกทุกเครื่อง |
| OWASP · Authentication | ล็อกเมื่อผิดหลายครั้ง CAPTCHA หลังผิดซ้ำ ไม่บอกว่าอีเมลหรือรหัสผิด | ผิด 3 ครั้ง CAPTCHA · 5 ครั้งล็อก 15 นาที |
| AccelByte / GitHub Enterprise · ระงับผู้ใช้ | เหตุผล ระยะเวลา แจ้งผู้ใช้ บันทึกภายใน ช่องทางอุทธรณ์ | SuspendForm · ยกเลิกต้องใส่เหตุผล · หน้าระงับมีปุ่มอุทธรณ์ |
| WordPress · Settings | แบ่งหมวด ทั่วไป/การสมัคร/การค้นเจอ (noindex)/ความเป็นส่วนตัว | ตั้งค่าเว็บ 4 แท็บ + ตัวอย่างผลค้นหา + ปิดปรับปรุง |
| Veeam / Backblaze · 3-2-1-1-0 | 3 สำเนา 2 สื่อ 1 นอกสถานที่ 1 แก้ไม่ได้ 0 ผิดพลาดตอนทดสอบกู้ | หน้าสำรองข้อมูล + ทดสอบกู้ + กู้คืนเฉพาะเจ้าของ |
| NN/g · Error messages & empty states | ภาษาคน บอกวิธีแก้ หน้าว่างบอกขั้นต่อไป | EmptyState ทุกหน้า · error ใต้ช่องกรอก |
| PDPA (สคส.) · Cookie consent | ยอมรับ/ปฏิเสธเด่นเท่ากัน เลือกรายหมวด ถอนง่าย เก็บบันทึกความยินยอม | CookieBanner + ตั้งค่าเอง + ลิงก์ใน footer/โปรไฟล์ + consent_records |
| Cipher.co.th · องค์ประกอบหน้าแรก | โลโก้ เมนูชัด ข้อความหลัก CTA ค้นหา ลิงก์ติดต่อ | SiteHeader / SiteFooter / hero หน้าแรก |
| Foxglove / Arduino Cloud Agent | เว็บสาธารณะคุมของในเครื่องผู้ใช้ผ่านโปรแกรมเล็กที่ติดตั้งเอง | ตัวเชื่อมเครื่อง: ติดตั้งคำสั่งเดียว จับคู่รหัส 6 หลัก คำสั่งที่อนุญาตเท่านั้น |
| Chrome · Local Network Access (142 HTTP, 147 WebSocket) | เว็บสาธารณะต่อ localhost ต้องได้รับอนุญาตจากผู้ใช้ และต้อง HTTPS | ขั้น “อนุญาตเบราว์เซอร์” + ภาพหน้าต่าง + วิธีแก้เมื่อกดบล็อก |

## ลิงก์

- Chrome Local Network Access: https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access
- Chrome LNA blog: https://developer.chrome.com/blog/local-network-access
- OWASP Forgot Password Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- NIST SP 800-92: https://csrc.nist.gov/publications/detail/sp/800-92/final
- NN/g Error-Message Guidelines: https://www.nngroup.com/articles/error-message-guidelines/
