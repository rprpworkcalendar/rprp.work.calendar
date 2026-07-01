# ไฟล์สำหรับอัปขึ้น GitHub Pages

ให้อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น GitHub repository

```text
index.html
admin.html
calendar.html
report.html
config.js
styles.css
app.js
.nojekyll
```

## ตั้งค่า GitHub Pages

1. เปิด repository ใน GitHub
2. ไปที่ `Settings > Pages`
3. Source: `Deploy from a branch`
4. Branch: `main`
5. Folder: `/root`
6. กด Save

## ตั้งค่า Apps Script URL

เปิดไฟล์ `config.js` แล้วใส่ URL จาก Apps Script Web App:

```javascript
window.RP_CALENDAR_CONFIG = {
  GAS_API_URL: 'https://script.google.com/macros/s/xxxxxxxx/exec',
  APP_NAME: 'ปฏิทินภาพรวมงานอุทยานหลวงราชพฤกษ์',
  ORG_NAME: 'อุทยานหลวงราชพฤกษ์',
  MAX_UPLOAD_MB: 5
};
```

ถ้ายังไม่ใส่ `GAS_API_URL` ระบบจะเปิดได้ใน Demo Mode แต่จะยังไม่บันทึกข้อมูลจริงลง Google Sheet

## หน้าเว็บที่มีให้

```text
index.html    = หน้าแรก/ภาพรวม
calendar.html = ปฏิทินรายเดือน
admin.html    = จัดการรายการงาน
report.html   = รายงานสรุป
```
