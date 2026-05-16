# 🚀 دليل شامل لربط وتهيئة المستودع الجديد

## المستودع الجديد (فارغ)

```
https://github.com/deyahatu/sknat.git
```

---

## ✅ الخطوة 1️⃣: ربط المستودع الجديد في VS Code

### افتح Terminal في VS Code:

- اضغط `Ctrl + `` (باك تيك)
- أو: `Terminal > New Terminal`

### انتقل إلى مجلد المشروع:

```powershell
cd C:\Users\PC\OneDrive\Desktop\sknat_project
```

### أضف المستودع الجديد:

```powershell
git remote add github-deya https://github.com/deyahatu/sknat.git
```

### تحقق من المستودعات:

```powershell
git remote -v
```

**يجب أن تشاهد:**

```
origin          git@github.com:MahdyHamdan2001/sknat.git (fetch)
origin          git@github.com:MahdyHamdan2001/sknat.git (push)
github-deya     https://github.com/deyahatu/sknat.git (fetch)
github-deya     https://github.com/deyahatu/sknat.git (push)
```

✅ **إذا شفت `github-deya` = نجح الربط!**

---

## ✅ الخطوة 2️⃣: اختر الملفات التي تريد رفعها

### شوف الملفات المتاحة:

```powershell
git status
```

---

## ✅ الخطوة 3️⃣: أضف الملفات المحددة (2-4 ملفات فقط)

**اختر ملفاتك وأضفها واحد واحد:**

```powershell
git add server/src/routes/complaints.js
git add src/pages/student/Complaints.jsx
git add src/components/complaints/ComplaintsForm.jsx
```

---

## ✅ الخطوة 4️⃣: تأكد من الملفات المرحلة

```powershell
git status
```

**يجب أن تشاهد الملفات بلون أخضر تحت "Changes to be committed"**

---

## ✅ الخطوة 5️⃣: عمل Commit

```powershell
git commit -m "Add complaints system with media support"
```

أو بالعربية:

```powershell
git commit -m "إضافة نظام الشكاوى"
```

---

## ✅ الخطوة 6️⃣: الرفع على المستودع الجديد

**هذا هو الأمر الأخير:**

```powershell
git push github-deya deya
```

🎉 **خلاص! الملفات صارت في المستودع الجديد!**

---

## 🎯 مثال كامل (انسخ والصق)

```powershell
# 1. روح مجلد المشروع
cd C:\Users\PC\OneDrive\Desktop\sknat_project

# 2. أضف المستودع (مرة واحدة فقط)
git remote add github-deya https://github.com/deyahatu/sknat.git

# 3. شوف الملفات
git status

# 4. أضف ملفاتك (بدل الملفات بملفاتك الفعلية)
git add server/src/routes/complaints.js
git add src/pages/student/Complaints.jsx
git add src/components/complaints/ComplaintsForm.jsx

# 5. تأكد
git status

# 6. commit
git commit -m "Add complaints system"

# 7. الرفع على المستودع الجديد
git push github-deya deya
```

---

## ⚠️ ملاحظات مهمة

| ✅ افعل                              | ❌ لا تفعل                |
| ------------------------------------ | ------------------------- |
| أضف ملفات محددة                      | لا تضف كل شيء `git add .` |
| اكتب رسالة commit واضحة              | لا تنسى الرسالة           |
| استخدم `git status`                  | لا تسرع بدون تحقق         |
| استخدم `github-deya` للمستودع الجديد | لا تستخدم origin          |

---

## ❓ حل مشاكل شائعة

### المشكلة: "fatal: remote origin already exists"

**الحل:** المستودع موجود بالفعل

```powershell
git remote remove github-deya
git remote add github-deya https://github.com/deyahatu/sknat.git
```

### المشكلة: "rejected - no changes added to commit"

**الحل:** أنت ما أضفت ملفات

```powershell
git add مسار-الملف
git status  # تأكد
git commit -m "الرسالة"
```

### المشكلة: "Permission denied"

**الحل:** تحقق من SSH keys أو استخدم HTTPS token

---

## 🔄 خطوات الرفع اللاحقة (للمرات القادمة)

بعد إضافة المستودع للمرة الأولى، في الرفعات القادمة:

```powershell
git add الملفات
git commit -m "الرسالة"
git push github-deya deya
```

**خلاص!** 🚀
