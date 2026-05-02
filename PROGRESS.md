# سجل العمل والمشاكل المتبقية — منصة سكنات

ملف يلخّص ما تم إنجازه في جلسة العمل بتاريخ **2026-05-03**، والمشاكل التي ما زالت متبقية لكل من **مالك العقار** و**الطالب**.

---

## 📑 الفهرس

- [ما تم إنجازه](#ما-تم-إنجازه)
  - [مالك العقار](#مالك-العقار---ما-تم-إنجازه)
  - [الطالب](#الطالب---ما-تم-إنجازه)
- [المشاكل المتبقية](#المشاكل-المتبقية)
  - [مالك العقار](#مالك-العقار---المتبقي)
  - [الطالب](#الطالب---المتبقي)
- [الملاحظات الفنية](#الملاحظات-الفنية)

---

## ما تم إنجازه

### مالك العقار - ما تم إنجازه

| # | المشكلة | UC | الحجم | الملفات الرئيسية |
|---|---------|-----|-------|------------------|
| 1 | تقييم الطالب بـ4 أبعاد (سلوك، نظافة، تواصل، تجربة إجمالية) بدلاً من تقييم واحد | UC-25 | كبير | `server/prisma/schema.prisma`، `server/src/routes/studentRatings.js`، `src/pages/owner/RateStudents.jsx`، migration `20260503100000_add_student_rating_dimensions` |
| 2 | منع إنشاء/تعديل سكن بدون رفع صورة واحدة على الأقل (validation في الباك إند + رسالة واضحة في wizard) | UC-15 / UC-16 | صغير | `server/src/routes/properties.js`، `src/pages/owner/AddEditProperty.jsx` |
| 3 | تصحيح حساب الأشهر — استبدال `Math.ceil(diffDays/30)` بحساب نسبي (proportional) مع حد أدنى شهر واحد | UC-6 / UC-8 | صغير | `server/src/routes/bookings.js`، `server/src/routes/payments.js`، `src/pages/student/PaymentPage.jsx` |
| 4 | إضافة حقل `processedAt` على `WithdrawRequest` ليحمل تاريخ تنفيذ السحب الفعلي | UC-24 | صغير | `server/prisma/schema.prisma`، migration `20260503110000_add_withdraw_processed_at` |
| 5 | حماية رصيد المالك من السحب المبكر — `lockedBalance` محسوب lazily من الدفعات خلال آخر 7 أيام (نافذة الاسترداد UC-12) | UC-23 | متوسط | `server/src/routes/withdrawals.js`، `server/src/routes/payments.js`، `src/pages/owner/Withdrawals.jsx`، `src/pages/owner/Owner.css` |

#### إصلاح إضافي (bonus)
- في `PaymentPage.jsx`: استبدال استخدام `fullPrice` للغرف DOUBLE بـ helper `getMonthlyPrice()` يحسب `halfPrice` كما يفعل الباك إند، حتى يطابق المبلغ المعروض للطالب المبلغ المدفوع فعلاً.

---

### الطالب - ما تم إنجازه

| # | المشكلة | UC | الحجم | الملفات الرئيسية |
|---|---------|-----|-------|------------------|
| 1 | إرسال رابط استعادة كلمة المرور بالإيميل بدلاً من طباعته في console | UC-40 | صغير | `server/src/utils/email.js`، `server/src/routes/auth.js` |
| 2 | منع إرسال طلبات حجز مكررة على نفس السكن أثناء وجود طلب سابق نشط (PENDING/APPROVED/PAID) | UC-4 A1 | صغير | `server/src/routes/bookings.js` |
| 3 | فحص انتهاء فترة الإقامة قبل السماح بتقييم السكن (PAID وحدها لم تعد كافية) | UC-9 | صغير | `server/src/routes/reviews.js` |
| 4 | Rate Limiting على endpoints الـ auth (login، forgot-password، verify-email، resend-code، register) | أمان | متوسط | `server/src/middleware/rateLimit.js`، `server/src/routes/auth.js` |
| 5 | زر "إلغاء الدفع" واضح في صفحة الدفع يعيد الطالب إلى `/bookings` بدون تعديل | UC-8 A4 | صغير | `src/pages/student/PaymentPage.jsx`، `src/pages/student/PaymentPage.css` |
| 6 | عرض ملخص الإلغاء بأرقام محسوبة (رقم الحجز، السكن، المبلغ المدفوع، مبلغ الاسترداد بالنسبة المئوية) قبل التأكيد، مع تمييز القاعدة المنطبقة | UC-11 step 7 | صغير | `src/pages/student/MyBookings.jsx`، `src/pages/student/MyBookings.css` |
| 7 | معالجة timeout أثناء التسجيل (إرسال OTP) برسالة مخصّصة "انتهت مهلة التسجيل. يرجى المحاولة مرة أخرى." | UC-1 E2 | متوسط | `server/src/utils/timeout.js`، `server/src/routes/auth.js` |

---

## المشاكل المتبقية

> هذه المشاكل لم تُعالَج بعد. مرتّبة حسب الأولوية والحجم.

### مالك العقار - المتبقي

#### 🔴 رئيسي
| # | المشكلة | الوصف | الحجم |
|---|---------|--------|-------|
| O-1 | رفع الصور إلى cloud storage | حالياً الصور تُخزّن base64 في الـ DB (`express.json` بحد 20mb في `server/src/index.js`). لا يوجد multer ولا S3/Cloudinary/Supabase. النتيجة: queries بطيئة، DB ضخم، تحميل بطيء للطلاب. يحتاج اختيار خدمة + إعداد credentials + تعديل routes + تعديل uploads في الواجهة | كبير |

#### 🟡 غير مباشر (مرتبط بالأدمن أو الإشعارات)
| # | المشكلة | الوصف |
|---|---------|--------|
| O-2 | لا يوجد route للأدمن للموافقة/الرفض على طلبات السحب | حقل `processedAt` جاهز ومتاح، لكن لا يوجد endpoint admin يستدعي تحديثه. الطلبات تبقى PENDING للأبد. |
| O-3 | لا توجد حالة `REJECTED` على نموذج Property | حالياً `Property` يحتوي فقط على `available: Boolean`. UC-32 يطلب حالة "مرفوض" بسبب مخالفة سياسات. يحتاج إضافة enum + migration + UI لعرض سبب الرفض للمالك. |
| O-4 | إشعارات المالك مفقودة (تعتمد على UC-44) | حجز جديد، إلغاء الطالب، موافقة/رفض السحب، رفض السكن — كلها لا تصل للمالك. |

---

### الطالب - المتبقي

#### 🔴 رئيسي
| # | المشكلة | UC | الوصف | الحجم |
|---|---------|-----|--------|-------|
| S-1 | لا توجد بوابة دفع حقيقية | UC-8 | الباك إند يضع حالة `COMPLETED` مباشرة بدون أي معالجة فعلية. الطالب يظن أنه دفع لكن الفلوس وهمية. يحتاج تكامل مع بوابة دفع فلسطينية/أردنية | كبير |
| S-2 | PaymentPage يجمع بيانات بطاقة وهمية | UC-8 | النموذج يطلب اسم/رقم/تاريخ/CVV لكن الـ API يرسل فقط `bookingId`. بيانات البطاقة لا تُرسل ولا تُتحقق. يعطي إنطباع خاطئ بالأمان (PCI compliance) | متوسط |
| S-3 | UC-8 Alternative flows غير مدعومة | UC-8 A1/A2/A3/E1 | "Insufficient funds"، "Invalid card details"، "Payment gateway timeout"، "Payment gateway down" — كلها مفقودة لأن البوابة الحقيقية مفقودة | كبير (يعتمد S-1) |
| S-4 | الصور base64 — تجربة الطالب بطيئة | أداء | بحث عن سكنات → كل عقار يحمّل 5-10 صور base64 ضخمة → HTML ضخم → تأخير. نفس مشكلة المالك (O-1) | كبير |

#### 🟡 فجوات spec مؤجَّلة بصراحة
| # | المشكلة | UC | السبب |
|---|---------|-----|--------|
| S-5 | تعديل بيانات الملف الشخصي للطالب (`major`, `gender`, `idNumber`, `idPhoto`) | UC-10 | المواصفات تطلبها لكن قرّرنا انتظار تعديل ملف الـ use cases قبل التنفيذ |
| S-6 | فحص JWT_SECRET عند بدء السيرفر | أمان | تجاوزناها بطلب من المستخدم |

#### 🟠 إشعارات (تعتمد على UC-44 - مؤجّلة بكاملها)
- UC-6: إشعار المالك عند طلب حجز جديد
- UC-8: إشعار المالك عند الدفع
- UC-11: إشعار الطالب + المالك عند الإلغاء
- UC-13: إشعار الأدمن عند طلب الاسترداد
- UC-19/20: إشعار الطالب عند قبول/رفض الحجز

---

## الملاحظات الفنية

### تغييرات schema تتطلب migration
في حال نشر التغييرات على بيئة جديدة، تأكد من تشغيل:
```bash
cd server
npx prisma migrate deploy
npx prisma generate
```

الـ migrations الجديدة في هذه الجلسة:
- `20260503100000_add_student_rating_dimensions` — يستبدل `rating` بـ4 حقول (سلوك، نظافة، تواصل، تجربة إجمالية)
- `20260503110000_add_withdraw_processed_at` — يضيف `processedAt` على `WithdrawRequest`

### تبعيات npm جديدة
- `express-rate-limit@^8.4.1` — تم تثبيتها (للـ rate limiting)

### ملفات utility جديدة
- `server/src/utils/timeout.js` — `withTimeout()` و `TimeoutError` لمعالجة timeouts على عمليات خارجية
- `server/src/middleware/rateLimit.js` — 5 limiters للـ auth routes

### نقاط قبل الإنتاج
1. **JWT_SECRET**: استبدل القيمة في `.env` بقيمة عشوائية طويلة (32+ حرف) — يمكن توليدها بـ:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
2. **Rate Limiting خلف proxy**: إذا نُشر السيرفر خلف Nginx/Cloudflare، أضف `app.set('trust proxy', 1)` في `server/src/index.js` ليقرأ rate limiter الـ IP الحقيقي.
3. **Cloud storage للصور** (O-1 / S-4) ضروري قبل أي حجم استخدام جدّي.
4. **بوابة دفع حقيقية** (S-1) — لا يمكن إطلاق المنصة فعلياً بدون هذه.

---

_آخر تحديث: 2026-05-03_
