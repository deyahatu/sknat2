# ثغرات وأخطاء في الاسترداد (Refund) والسحب (Withdrawal)

تاريخ الفحص: 2026-05-17
الملفات المفحوصة:
- `server/src/routes/refunds.js`
- `server/src/routes/withdrawals.js`
- `server/src/routes/bookings.js` (إنشاء طلب الاسترداد)
- `server/src/routes/payments.js` (شحن المحفظة)

---

## 1. ⚠️ ثغرة استنزاف الرصيد عند موافقة الأدمن على السحب (الأخطر)

**الموقع:** `server/src/routes/withdrawals.js:305-320`

```javascript
router.patch('/:id/approve', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const withdrawal = await prisma.withdrawRequest.findUnique({ where: { id: req.params.id } });
    if (!withdrawal) return res.status(404).json({ error: 'طلب السحب غير موجود.' });
    if (withdrawal.status !== 'PENDING') return res.status(400).json({ error: 'يمكن الموافقة على الطلبات المعلقة فقط.' });

    const updated = await prisma.withdrawRequest.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED', processedAt: new Date() },
    });

    res.json({ message: 'تم الموافقة على طلب السحب.', withdrawal: updated });
  } catch (err) {
    next(err);
  }
});
```

### المشكلة
الكود يُحدّث **حالة الطلب فقط** إلى `APPROVED`، ولا يخصم المبلغ من `wallet.balance` الخاصة بالمالك.

### السيناريو
1. المالك لديه رصيد 1000 ₪ في المحفظة.
2. يطلب سحب 1000 ₪ — يُسجَّل الطلب بحالة `PENDING`.
3. الأدمن يوافق — تتغير الحالة إلى `APPROVED`، لكن `wallet.balance` يبقى 1000 ₪.
4. المالك يطلب 1000 ₪ ثانية — `getWalletSnapshot` تُرجع نفس الرصيد، لا يوجد طلب `PENDING`، يمر بدون مشاكل.
5. يتكرر بلا نهاية → المالك يسحب أضعاف المستحق.

### الإصلاح المقترح
لف عملية الموافقة في transaction واحد يتضمن:
- التحقق من أن `wallet.balance >= withdrawal.amount`.
- خصم المبلغ: `tx.wallet.update({ where: { ownerId }, data: { balance: { decrement: amount } } })`.
- تحديث حالة الطلب.
- استخدام `isolationLevel: "Serializable"` كما في إنشاء الطلب.

```javascript
await prisma.$transaction(async (tx) => {
  const withdrawal = await tx.withdrawRequest.findUnique({ where: { id: req.params.id } });
  if (!withdrawal) { /* 404 */ }
  if (withdrawal.status !== 'PENDING') { /* 400 */ }

  const wallet = await tx.wallet.findUnique({ where: { ownerId: withdrawal.ownerId } });
  if (!wallet || Number(wallet.balance) < Number(withdrawal.amount)) {
    throw Object.assign(new Error('رصيد المالك غير كافٍ.'), { statusCode: 400 });
  }

  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: { decrement: Number(withdrawal.amount) } },
  });

  await tx.withdrawRequest.update({
    where: { id: withdrawal.id },
    data: { status: 'APPROVED', processedAt: new Date() },
  });
}, { isolationLevel: 'Serializable' });
```

---

## 2. ⚠️ Bug يُفشل كل عملية موافقة على الاسترداد (Refund Approval)

**الموقع:** `server/src/routes/refunds.js:79-177`

```javascript
router.patch('/:id/approve', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    try {
      await prisma.$transaction(async (tx) => {
        const refund = await tx.refundRequest.findUnique({ ... });          // ← const داخل scope الـ tx
        ...
        const refundAmount = Math.max(0, Number(refund.refundAmount));      // ← const داخل scope الـ tx
        ...
      }, { isolationLevel: "Serializable" });
    } catch (txErr) { ... }

    // ↓ خارج الـ transaction — refund و refundAmount غير معرّفين هنا
    const updated = await prisma.refundRequest.findUnique({
      where: { id: refund.id },                                              // ReferenceError
      ...
    });

    notify(
      updated.studentId,
      'تمت الموافقة على طلب الاسترداد',
      `تم استرداد مبلغ ${refundAmount} ₪ بنجاح.`,                            // ReferenceError
      '/bookings',
    ).catch(() => {});

    res.json({ message: '...', refund: updated });
  } catch (err) {
    next(err);
  }
});
```

### المشكلة
المتغيرات `refund` و `refundAmount` معرّفة بـ `const` **داخل** الـ transaction callback (سطر 87 و 112). بعد انتهاء الـ transaction، الكود يحاول استخدامها في السطر 150 و 165 — وهي خارج النطاق (scope) → `ReferenceError: refund is not defined`.

### النتيجة
- الـ transaction تنجح: الرصيد يُخصم، الـ Payment يُحدّث إلى `REFUNDED`، الـ refund إلى `COMPLETED`.
- لكن بعدها يُرمى `ReferenceError` → الـ catch الخارجي يرجع 500.
- الطالب يرى خطأ، لا يستلم إشعار، والـ frontend يظن العملية فشلت رغم أن الفلوس فعلاً انخصمت.

### الإصلاح المقترح
ارفع المتغيرات للنطاق الخارجي، أو حضّر النتيجة داخل الـ transaction:

```javascript
let refundId;
let refundAmount;
let studentId;

await prisma.$transaction(async (tx) => {
  const refund = await tx.refundRequest.findUnique({ ... });
  if (!refund) { /* 404 */ }
  if (refund.status !== 'PENDING') { /* 400 */ }

  refundId = refund.id;
  refundAmount = Math.max(0, Number(refund.refundAmount));
  studentId = refund.studentId;
  ...
}, { isolationLevel: 'Serializable' });

const updated = await prisma.refundRequest.findUnique({
  where: { id: refundId },
  include: { ... },
});

notify(studentId, 'تمت الموافقة على طلب الاسترداد',
  `تم استرداد مبلغ ${refundAmount} ₪ بنجاح.`, '/bookings').catch(() => {});

res.json({ message: '...', refund: updated });
```

---

## 3. Race Condition في حساب الرصيد المقفول

**الموقع:** `server/src/routes/withdrawals.js:14-43, 206`

```javascript
async function computeLockedAmount(ownerId) {
  ...
  const recent = await prisma.payment.findMany({ ... });   // ← prisma وليس tx
  ...
}

async function getWalletSnapshot(ownerId) {
  const wallet = await prisma.wallet.findUnique({ ... });  // ← prisma وليس tx
  ...
}

router.post('/', ..., async (req, res, next) => {
  ...
  request = await prisma.$transaction(async (tx) => {
    const { availableBalance, lockedBalance } = await getWalletSnapshot(req.user.id);
    // ↑ القراءة خارج حدود الـ transaction
    ...
  }, { isolationLevel: "Serializable" });
});
```

### المشكلة
دالتا `getWalletSnapshot` و `computeLockedAmount` تستخدمان عميل `prisma` العام بدلاً من `tx`، رغم استدعائهما داخل `prisma.$transaction`. القراءات تخرج عن حدود الـ Serializable isolation، فيمكن لطلبات سحب متزامنة من نفس المالك أن ترى نفس الرصيد المتاح وتُنشئ طلبات متضاربة قبل أن يحظر check الـ PENDING الطلبَ الثاني (الذي بدوره يقرأ أيضاً خارج الـ tx في `findFirst` — هذا داخل tx فعلاً، جيد).

### الإصلاح المقترح
مرّر `tx` للدوال المساعدة:

```javascript
async function computeLockedAmount(client, ownerId) {
  const recent = await client.payment.findMany({ ... });
  ...
}

async function getWalletSnapshot(client, ownerId) {
  const wallet = await client.wallet.findUnique({ ... });
  const lockedBalance = await computeLockedAmount(client, ownerId);
  ...
}

// داخل الـ transaction:
const { availableBalance, lockedBalance } = await getWalletSnapshot(tx, req.user.id);
```

---

## ملخص الأولويات

| # | المشكلة | الخطورة | الأثر |
|---|---------|---------|------|
| 1 | السحب لا يخصم من المحفظة | حرجة (مالية) | استنزاف غير محدود لأموال المنصة |
| 2 | Refund approve يرمي ReferenceError | حرجة (سلامة بيانات) | فلوس تنخصم بدون إشعار/استجابة صحيحة |
| 3 | قراءة الرصيد خارج الـ transaction | متوسطة | احتمال سحب مكرر تحت تزامن عالٍ |

البندان 1 و 2 يجب إصلاحهما قبل أي إطلاق إنتاجي يتعامل مع أموال حقيقية.
