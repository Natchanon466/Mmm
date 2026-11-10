// คัดลอกเฉพาะไฟล์ที่ใช้เผยแพร่ไปที่โฟลเดอร์ _site (ใช้ใน GitHub Actions)
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, '_site');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
['index.html', 'css', 'js'].forEach(function (name) {
  fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
});
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('สร้าง _site เรียบร้อย');
