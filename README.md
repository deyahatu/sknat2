# 🏠 منصة سكنات

منصة سكن طلابي لجامعة النجاح الوطنية في نابلس.

---

## 📋 المتطلبات قبل البدء

تأكد من تثبيت البرامج التالية على جهازك:

| البرنامج | الإصدار المطلوب | رابط التحميل |
|---|---|---|
| **Node.js** | 20 أو أحدث | https://nodejs.org |
| **PostgreSQL** | 14 أو أحدث | https://www.postgresql.org/download |
| **Git** | أي إصدار حديث | https://git-scm.com |

للتأكد من التثبيت:
```bash
node --version    # يجب أن يظهر v20.x.x أو أعلى
npm --version
psql --version    # PostgreSQL
git --version
```

---

## 🚀 خطوات التشغيل (من الصفر)

### 1️⃣ استنساخ المشروع

```bash
git clone <رابط-الريبو>
cd sknat_project
```

---

### 2️⃣ تثبيت مكتبات الفرونت إند

من جذر المشروع:
```bash
npm install
```

---

### 3️⃣ تثبيت مكتبات السيرفر

```bash
cd server
npm install
```

> ⚠️ **مهم:** لازم تشغّل `npm install` **مرّتين** — مرة في الجذر للفرونت، ومرة داخل `server/` للسيرفر.

---

### 4️⃣ إنشاء قاعدة البيانات

افتح **psql** أو أي أداة لـ PostgreSQL (مثل pgAdmin) وأنشئ قاعدة باسم `sknat`:

```sql
CREATE DATABASE sknat;
```

أو من الـ terminal:
```bash
psql -U postgres -c "CREATE DATABASE sknat;"
```

---

### 5️⃣ إعداد ملف `.env`

داخل مجلد `server/`، انسخ ملف القالب:

```bash
# Windows (PowerShell)
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

ثم افتح `server/.env` بأي محرر وعدّل **سطرين**:

```env
# 1. كلمة سر postgres عندك (محل YOUR_PASSWORD)
DATABASE_URL="postgresql://postgres:كلمة_سرّك@localhost:5432/sknat?schema=public"

# 2. مفتاح JWT عشوائي طويل
JWT_SECRET="أي-سلسلة-عشوائية-طويلة-هنا"
```

---

### 6️⃣ تطبيق الـ Migrations على قاعدة البيانات

من داخل `server/`:
```bash
npx prisma migrate deploy
```

هذا الأمر بينشئ كل الجداول (Users, Properties, Bookings, Payments, إلخ).

---

### 7️⃣ توليد Prisma Client

```bash
npx prisma generate
```

هذا الأمر بيبني الـ client اللي السيرفر يستخدمه للتواصل مع قاعدة البيانات.

---

### 8️⃣ تعبئة بيانات تجريبية (Seed)

```bash
npm run db:seed
```

بتنشئ:
- حساب أدمن
- بعض الطلاب التجريبيين
- بعض المالكين والعقارات

---

### 9️⃣ تشغيل السيرفر

من داخل `server/`:
```bash
npm run dev
```

السيرفر رح يشتغل على: **http://localhost:5000**

---

### 🔟 تشغيل الفرونت إند

افتح **terminal جديد** (لا تغلق terminal السيرفر) وارجع للجذر:

```bash
cd ..
npm run dev
```

الموقع رح يشتغل على: **http://localhost:5173**

افتحه في المتصفح وجرّب! 🎉

---

## 🧪 حسابات تجريبية للاختبار

| الدور | البريد الإلكتروني | كلمة المرور |
|---|---|---|
| **أدمن** | `admin@sakanat.com` | `admin123` |

> الحسابات الأخرى موجودة في ملف [server/src/seed.js](server/src/seed.js) — افتحه لرؤية كل الحسابات المتاحة.

---

## 🛠️ التقنيات المستخدمة

| الجزء | التقنيات |
|---|---|
| **Frontend** | React 19, Vite, React Router, React Icons |
| **Backend** | Express.js, JWT, bcryptjs |
| **Database** | PostgreSQL + Prisma ORM |
| **Styling** | CSS (دعم RTL للعربية) |

---

## 📂 هيكل المشروع

```
sknat_project/
├── public/                  # الأصول العامة
├── src/                     # كود الفرونت إند
│   ├── pages/              # الصفحات
│   │   ├── student/        # صفحات الطالب
│   │   └── owner/          # صفحات المالك
│   ├── components/         # المكونات المشتركة
│   ├── context/            # AuthContext
│   ├── utils/              # api.js, text.js
│   └── constants/          # الثوابت
└── server/                  # الباك إند
    ├── prisma/
    │   ├── schema.prisma   # نموذج قاعدة البيانات
    │   └── migrations/     # تعديلات قاعدة البيانات
    └── src/
        ├── routes/         # نقاط النهاية API
        ├── middleware/     # المصادقة، إلخ
        └── utils/          # أدوات مساعدة
```

---

## 📜 الأوامر المتوفرة

### في الجذر (الفرونت)
```bash
npm run dev      # تشغيل السيرفر التطويري
npm run build    # بناء نسخة الإنتاج
npm run preview  # معاينة نسخة الإنتاج
npm run lint     # فحص الكود
```

### داخل `server/`
```bash
npm run dev          # تشغيل السيرفر مع إعادة تحميل تلقائي
npm start            # تشغيل عادي
npm run db:migrate   # إنشاء migration جديدة بعد تعديل schema
npm run db:seed      # تعبئة بيانات تجريبية
npm run db:studio    # فتح Prisma Studio (واجهة لتصفح القاعدة)
```

---

## ❓ مشاكل شائعة وحلولها

### ❌ "Can't reach database server"
- تأكد إن PostgreSQL شغّال
- تأكد إن قاعدة `sknat` تم إنشاؤها
- تأكد إن `DATABASE_URL` في `.env` فيها كلمة السر الصحيحة

### ❌ "PrismaClientValidationError" أو حقل غير موجود
شغّل من داخل `server/`:
```bash
npx prisma generate
```
ثم أعد تشغيل السيرفر.

### ❌ السيرفر شغّال لكن الفرونت يعطي "Network Error"
- تأكد إن السيرفر فعلاً شغّال على المنفذ 5000
- تأكد من قيمة `CLIENT_URL` في `.env`

### ❌ "Port 5000 already in use"
غيّر قيمة `PORT` في `server/.env` إلى منفذ ثاني (مثلاً 5001).

---

## 🤝 المساهمة

لو بدّك تضيف ميزة جديدة:

1. أنشئ branch جديد: `git checkout -b feature/your-feature`
2. عدّل الكود
3. لو عدّلت على `schema.prisma`، شغّل: `npx prisma migrate dev --name وصف_التعديل`
4. اعمل commit وادفع للـ remote
5. افتح Pull Request
