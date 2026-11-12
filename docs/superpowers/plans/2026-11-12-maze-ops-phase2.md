# mBot2 Maze Ops เฟส 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** หน้าเว็บสาธารณะครบตาม mockup (รวม 3D), ระบบบทเรียน, ติดต่อ, คุกกี้ PDPA, และหลังบ้านที่เหลือ (บทเรียน ข้อความ สถานะระบบ เครื่องรันซิม สำรองข้อมูล ตั้งค่าแท็บ)
**Architecture:** เพิ่มโดเมนใน backend (`content/`, `contact/`, `system/`) ตามแบบเฟส 1 · frontend เพิ่ม `features/content`, `features/robot3d`, หน้า public/admin
**Spec:** `docs/superpowers/specs/2026-11-12-maze-ops-phase2-design.md`

## Global Constraints
- ไม่ commit · ไม่ทำ auth hardening / หุ่นจริง · backend ไม่เพิ่ม dependency · frontend เพิ่มได้แค่ `three`
- เช็กสิทธิ์ที่ API ทุก endpoint · ข้อความไทย · ไม่ใช้ `dangerouslySetInnerHTML`

## Review Focus
1. ผู้เยี่ยมชมเปิด slug ของบทเรียนร่าง / members-only → 404 / 401 ไม่ใช่เนื้อหา
2. กู้คืนข้อมูลขณะมีคนใช้งาน → session/ข้อมูลยังสอดคล้อง และ audit_log ไม่หาย
3. ฟอร์มติดต่อถูกยิงซ้ำ → 429 หลัง 5 ครั้ง/ชม.
4. markdown ที่มี `<script>` หรือ `javascript:` → แสดงเป็นข้อความ ไม่รัน
5. โหลด 3D ไม่ได้ (WebGL ปิด/ไฟล์หาย) → แสดงรูปนิ่งแทน ไม่พังทั้งหน้า

## Tasks
1. **schema + settings** — ตารางใหม่ 6 ตาราง · settings เพิ่ม description, noindex, contact_email/line/phone/github, log_retention_days, consent_retention_days · seed บทเรียน 13 บท (ครั้งแรกที่ตารางว่าง) · test `db.test.js`
2. **บทเรียน backend** — `content/lessons.js` (repo + validate + slug) · `content/routes.js` (public + admin + trash/restore + progress + views) · test `lessons.test.js`
3. **ติดต่อ / คุกกี้ / ค้นหา / สถานะสาธารณะ** — `contact/` · `content/search.js` · `GET /site/status` · test `public.test.js`
4. **ระบบ / เครื่องรันซิม / สำรองข้อมูล** — `system/backups.js` (VACUUM INTO, list, test-restore, restore ไม่รวม audit_log, ตารางเวลา 03:00, เก็บ 30 วัน) · `system/routes.js` · test `system.test.js`
5. **frontend พื้นฐานสาธารณะ** — header/footer ใหม่, ปุ่มค้นหา, CookieBanner, ErrorBoundary (500), NotFound, markdown renderer, หน้าเอกสาร 3 หน้า, ติดต่อ, ค้นหา
6. **บทเรียน frontend** — รายการ + ความคืบหน้า, อ่านบท, หลังบ้าน รายการ + editor (toolbar, preview, autosave, SEO preview, ถังขยะ)
7. **3D** — `features/robot3d/RobotViewer.jsx` (three, lazy, fallback รูป) · หน้าแรก hero · หน้ารู้จักหุ่นกดชิ้นส่วนลอยออก
8. **หลังบ้านที่เหลือ** — สถานะระบบ, เครื่องรันซิม, สำรองข้อมูล, ข้อความติดต่อ, ตั้งค่าแท็บ, Dashboard เพิ่ม KPI/ยอดนิยม/ข้อความใหม่, เมนู sidebar
9. **ตรวจ** — `npm test` ผ่านทั้งหมด · build ผ่าน · เปิดทุกหน้าผ่าน dev server (HTTP 200) · README อัปเดต
