# MentorSync: Developer Performance & SLA Management System

## โครงการและเป้าหมาย
แอปพลิเคชันสำหรับ Senior Developer ในการบริหารจัดการ (Manage), ตั้งเป้าหมาย (SLA), ประเมินผล, และติดตามการเติบโตของ Junior Developers อย่างเป็นระบบ 

**ชื่อโปรเจกต์ที่แนะนำ:** `MentorSync` 
*(สื่อถึงการทำงานที่สอดคล้องกันระหว่างพี่และน้อง พร้อมกับการซิงค์เป้าหมายให้ตรงกัน)*
**Path ที่จะสร้าง:** `C:\Users\nattapon.nap\Desktop\Repository\my-repo\MentorSync`

---

## User Review Required
> [!IMPORTANT]
> เนื่องจากคำขอนี้เกี่ยวข้องกับการออกแบบโครงสร้างโปรเจกต์ขนาดใหญ่ ผมจึงจัดทำแผนการทำงาน (Implementation Plan) ในฐานะ Senior + BA ให้คุณพิจารณาก่อน หากคุณเห็นด้วยกับ Tech Stack และ Features เหล่านี้ กรุณากด **Proceed** แล้วผมจะดำเนินการสร้าง Folder และเริ่มวางโครงสร้างโค้ดทันที

---

## Proposed Tech Stack (Architecture Design)
เพื่อตอบโจทย์ Backend เป็น Go และ Frontend แบบ Server-Side Rendering ผมขอเสนอ Stack ระดับ Enterprise ดังนี้:

- **Backend:** Go (Golang) + Fiber (หรือ Gin)
  - *เหตุผล:* Go โดดเด่นเรื่อง Performance และ Concurrency เหมาะอย่างยิ่งกับการทำ REST API แนะนำใช้ Fiber เพื่อความรวดเร็วในการพัฒนา
- **Frontend:** Next.js (React + TypeScript) สำหรับ SSR
  - *เหตุผล:* Next.js คือมาตรฐานอุตสาหกรรมสำหรับการทำ Server-Side Rendering (SSR) มีระบบ Router ที่ดีเยี่ยม จัดการ SEO และโหลดหน้าเว็บได้รวดเร็ว เหมาะกับการทำ Dashboard รายงานผล
  - *(หมายเหตุ: หากเป็น ElysiaJS จะเป็นฝั่ง Backend ที่รันบน Bun ซึ่งไปทับซ้อนกับ Go ที่คุณต้องการ จึงแนะนำเป็น Go คู่กับ Next.js ครับ)*
- **Database:** PostgreSQL
  - *เหตุผล:* ระบบประเมินและ SLA มีโครงสร้างข้อมูลที่มีความสัมพันธ์กันค่อนข้างชัดเจน (Relational Data) เช่น ข้อมูลพี่ 1 คนดูแลน้อง N คน และเกณฑ์ SLA ต่างๆ
- **Database Tool:** sqlc + pgx (หรือ GORM)
  - *เหตุผล:* แนะนำ sqlc สำหรับ Go เพื่อ Type-safety และประสิทธิภาพสูงสุด

---

## Core Features (BA Requirement Breakdown)
ในมุมมองของ Business Analyst (BA) เพื่อให้โปรเจกต์นี้สมบูรณ์แบบ ควรมีฟีเจอร์หลักดังนี้:

### 1. User & Mentorship Management (ระบบจัดการผู้ใช้)
- ระบบ Role Base (Admin, Senior/Mentor, Junior/Mentee)
- ฟีเจอร์การ "จับคู่" (Assignment) ระหว่าง Senior 1 คน ต่อน้องในความดูแลหลายคน

### 2. SLA & Criteria Engine (ระบบกฎเกณฑ์และเป้าหมาย)
- ระบบให้ Senior สามารถสร้าง/กำหนด SLA ให้กับน้องๆ แต่ละคนหรือรายทีมได้ เช่น
  - SLA สำหรับการรีวิวโค้ด: ต้องแก้ PR กลับมาภายใน 4 ชั่วโมง
  - SLA สำหรับ Task: สัดส่วนงานที่เสร็จทันตาม Estimation
- ระบบเตือน (Alert/Notification) เมื่อผลงานเข้าข่ายสุ่มเสี่ยงตก SLA

### 3. Evaluation & 1-on-1 System (ระบบประเมิน)
- หน้าฟอร์มให้คะแนนเป็นราย Sprint หรือรายเดือน (Periodic Review)
- ระบบ 1-on-1 Notes: พื้นที่สำหรับบันทึกผลการพูดคุยแบบส่วนตัวระหว่างพี่กับน้อง และกำหนด Action Item
- Timeline Log: บันทึกเหตุการณ์สำคัญ เช่น น้องแก้ Bug งานด่วนเสร็จไวมาก (บันทึกไว้ชื่นชมปลายเดือน)

### 4. Dashboard & Reporting (ระบบรายงาน)
- **Senior Dashboard:** ดูภาพรวมของน้องทุกคน (Team Pulse), แจ้งเตือนเมื่อใครต้องการความช่วยเหลือ
- **Junior Dashboard:** ให้น้องๆ มองเห็นเป้าหมายและ SLA ของตัวเอง (Transparency) รวมทั้ง Progress ตัวเอง
- **Export Report:** สามารถออกรายงาน (PDF) เป็นหลักฐานสำหรับประเมินผลประจำปีกับ HR

---

## การออกแบบเกณฑ์การประเมิน (Evaluation Criteria Design)
การวัดผลน้องๆ ในทีม ควรมีทั้งเชิงปริมาณ (Quantitative) และเชิงคุณภาพ (Qualitative) ผมขอเสนอ Framework 3 เสาหลัก:

1. **Delivery & Velocity (การส่งมอบงาน และความเร็ว)**
   - *Task Hit Rate:* อัตราการทำงานเสร็จตรงตาม Sprint Commitment (%)
   - *SLA Compliance:* การตอบสนองต่อ Issue/Bug ด่วน ภายในเวลาที่กำหนด

2. **Code Quality (คุณภาพของโค้ด)**
   - *Rework/Reopen Rate:* จำนวนครั้งที่ PR โดนตีกลับ หรือบั๊กที่ QA เจอแล้วถูก Reopen
   - *Best Practices:* การปฏิบัติตาม Naming Convention และการเขียน Unit Test

3. **Soft Skills & Growth (ทัศนคติและการทำงานร่วมกัน)**
   - *Proactivity:* การแจ้งเตือนปัญหาแต่เนิ่นๆ (ไม่ดองงาน), การเสนอทางแก้ปัญหา
   - *Communication:* การอัปเดตสถานะงานชัดเจน, การทำงานร่วมกับ QA และทีมอื่นๆ

---

## Verification Plan
1. เมื่อคุณกดยืนยัน (Proceed) ผมจะรันคำสั่งสร้าง Folder `MentorSync` ใน `C:\Users\nattapon.nap\Desktop\Repository\my-repo` ทันที
2. เตรียมพร้อมสำหรับการวางโครงสร้างโปรเจกต์ (Init Go Module และ Next.js) ในลำดับถัดไป
