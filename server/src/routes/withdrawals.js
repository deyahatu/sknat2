import { Router } from "express";
import prisma from "../utils/prisma.js";
import { authenticate, authorize, requireActive } from "../middleware/auth.js";
import { notifyAllAdmins } from "../utils/notify.js";

const router = Router();

const MINIMUM_WITHDRAWAL = 10;
// Refund window per UC-12: payments are eligible for full/partial refund
// during the first 7 days. Funds received within this window are held back
// from withdrawal so a refund approval never fails for "insufficient funds".
const REFUND_WINDOW_DAYS = 7;

async function computeLockedAmount(ownerId) {
  const cutoff = new Date(
    Date.now() - REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  // Sum payments to this owner that are still inside the refund window AND
  // haven't been refunded yet. These represent money that may need to be
  // returned to the student in the next few days.
  const recent = await prisma.payment.findMany({
    where: {
      status: "COMPLETED",
      createdAt: { gte: cutoff },
      booking: {
        property: { ownerId },
      },
    },
    select: { amount: true },
  });

  return recent.reduce((sum, p) => sum + Number(p.amount), 0);
}

async function getWalletSnapshot(ownerId) {
  const wallet = await prisma.wallet.findUnique({ where: { ownerId } });
  const balance = wallet ? Number(wallet.balance) : 0;
  const lockedBalance = await computeLockedAmount(ownerId);
  // Available cannot go negative even in edge cases (e.g. legacy data).
  const availableBalance = Math.max(0, balance - lockedBalance);
  return { balance, lockedBalance, availableBalance };
}

router.get(
  "/bank-account",
  authenticate,
  authorize("OWNER"),
  async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          bankName: true,
          bankAccountHolder: true,
          bankAccountNumber: true,
        },
      });

      res.json({ bankAccount: user });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/bank-account",
  authenticate,
  requireActive,
  authorize("OWNER"),
  async (req, res, next) => {
    try {
      const {
        bankName,
        bankAccountHolder,
        bankAccountNumber,
        confirmAccountNumber,
      } = req.body;

      if (
        !bankName ||
        !bankAccountHolder ||
        !bankAccountNumber ||
        !confirmAccountNumber
      ) {
        return res
          .status(400)
          .json({ error: "يرجى تعبئة جميع الحقول المطلوبة." });
      }

      if (bankAccountNumber !== confirmAccountNumber) {
        return res
          .status(400)
          .json({ error: "أرقام الحساب غير متطابقة. يرجى إعادة الإدخال." });
      }

      if (!/^[A-Za-z0-9]+$/.test(bankAccountNumber)) {
        return res
          .status(400)
          .json({ error: "رقم الحساب يجب أن يحتوي على أحرف أو أرقام فقط." });
      }

      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          bankName: bankName.trim(),
          bankAccountHolder: bankAccountHolder.trim(),
          bankAccountNumber: bankAccountNumber.trim(),
        },
        select: {
          bankName: true,
          bankAccountHolder: true,
          bankAccountNumber: true,
        },
      });

      res.json({
        message: "تم حفظ الحساب البنكي بنجاح.",
        bankAccount: updated,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/bank-account",
  authenticate,
  requireActive,
  authorize("OWNER"),
  async (req, res, next) => {
    try {
      const pendingWithdrawal = await prisma.withdrawRequest.findFirst({
        where: { ownerId: req.user.id, status: "PENDING" },
      });

      if (pendingWithdrawal) {
        return res
          .status(400)
          .json({
            error:
              "لا يمكن حذف الحساب البنكي أثناء وجود طلب سحب قيد المعالجة.",
          });
      }

      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          bankName: null,
          bankAccountHolder: null,
          bankAccountNumber: null,
        },
      });

      res.json({ message: "تم حذف الحساب البنكي بنجاح." });
    } catch (err) {
      next(err);
    }
  },
);

router.post("/", authenticate, requireActive, authorize("OWNER"), async (req, res, next) => {
  try {
    const { amount } = req.body;

    const withdrawAmount = Number(amount);

    if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
      return res
        .status(400)
        .json({ error: "يرجى إدخال مبلغ صحيح وموجب." });
    }

    if (withdrawAmount < MINIMUM_WITHDRAWAL) {
      return res
        .status(400)
        .json({ error: `الحد الأدنى لمبلغ السحب هو ${MINIMUM_WITHDRAWAL}.` });
    }

    const owner = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        bankName: true,
        bankAccountHolder: true,
        bankAccountNumber: true,
      },
    });

    if (
      !owner.bankName ||
      !owner.bankAccountHolder ||
      !owner.bankAccountNumber
    ) {
      return res
        .status(400)
        .json({
          error: "يرجى إضافة حساب بنكي قبل طلب السحب.",
        });
    }

    let request;
    try {
      request = await prisma.$transaction(async (tx) => {
        const { availableBalance, lockedBalance } = await getWalletSnapshot(
          req.user.id,
        );

        if (withdrawAmount > availableBalance) {
          const lockedMsg = lockedBalance > 0
            ? ` (${lockedBalance.toFixed(2)} شيكل مقفولة مؤقتاً خلال فترة الاسترداد).`
            : ".";
          const err = new Error(
            `الرصيد المتاح للسحب غير كافٍ. الرصيد المتاح حالياً ${availableBalance.toFixed(2)} شيكل${lockedMsg}`,
          );
          err.statusCode = 400;
          throw err;
        }

        const pendingRequest = await tx.withdrawRequest.findFirst({
          where: { ownerId: req.user.id, status: "PENDING" },
        });

        if (pendingRequest) {
          const err = new Error(
            "لديك طلب سحب قيد المعالجة بالفعل. يرجى الانتظار حتى تتم معالجته.",
          );
          err.statusCode = 400;
          throw err;
        }

        return tx.withdrawRequest.create({
          data: {
            amount: withdrawAmount,
            status: "PENDING",
            ownerId: req.user.id,
            bankName: owner.bankName,
            bankAccountHolder: owner.bankAccountHolder,
            bankAccountNumber: owner.bankAccountNumber,
          },
        });
      }, { isolationLevel: "Serializable" });
    } catch (txErr) {
      if (txErr.statusCode) {
        return res.status(txErr.statusCode).json({ error: txErr.message });
      }
      if (txErr.code === "P2034" || txErr.message?.includes("40001")) {
        return res.status(409).json({ error: "حدث تعارض. يرجى المحاولة مرة أخرى." });
      }
      throw txErr;
    }

    notifyAllAdmins(
      'طلب سحب جديد',
      `${req.user.name} طلب سحب ${withdrawAmount} ₪ — يحتاج مراجعة`,
      '/admin',
    ).catch(() => {});

    res.status(201).json({
      message: "تم إرسال طلب السحب. بانتظار موافقة المسؤول.",
      request,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", authenticate, async (req, res, next) => {
  try {
    const { status } = req.query;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isAdmin && req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'غير مصرح.' });
    }

    const where = isAdmin ? {} : { ownerId: req.user.id };
    if (status) {
      where.status = status.toUpperCase();
    }

    const requests = await prisma.withdrawRequest.findMany({
      where,
      include: isAdmin ? { owner: { select: { id: true, name: true, email: true } } } : undefined,
      orderBy: { createdAt: "desc" },
    });

    if (isAdmin) {
      return res.json({ withdrawals: requests });
    }

    const snapshot = await getWalletSnapshot(req.user.id);

    res.json({
      wallet: snapshot,
      requests,
    });
  } catch (err) {
    next(err);
  }
});

// UC-38: Admin approve withdrawal
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

// UC-38: Admin reject withdrawal
router.patch('/:id/reject', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const withdrawal = await prisma.withdrawRequest.findUnique({ where: { id: req.params.id } });
    if (!withdrawal) return res.status(404).json({ error: 'طلب السحب غير موجود.' });
    if (withdrawal.status !== 'PENDING') return res.status(400).json({ error: 'يمكن رفض الطلبات المعلقة فقط.' });

    const updated = await prisma.withdrawRequest.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED', rejectionReason: req.body.reason || null, processedAt: new Date() },
    });

    res.json({ message: 'تم رفض طلب السحب.', withdrawal: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
