import { Router } from "express";
import prisma from "../utils/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

const MINIMUM_WITHDRAWAL = 10;

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
          .json({ error: "Please fill all required fields." });
      }

      if (bankAccountNumber !== confirmAccountNumber) {
        return res
          .status(400)
          .json({ error: "Account numbers do not match. Please re-enter." });
      }

      if (!/^[A-Za-z0-9]+$/.test(bankAccountNumber)) {
        return res
          .status(400)
          .json({ error: "Account number must contain letters or digits only." });
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
        message: "Bank account saved successfully.",
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
              "Cannot delete bank account while a withdrawal request is pending.",
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

      res.json({ message: "Bank account deleted successfully." });
    } catch (err) {
      next(err);
    }
  },
);

router.post("/", authenticate, authorize("OWNER"), async (req, res, next) => {
  try {
    const { amount } = req.body;

    const withdrawAmount = Number(amount);

    if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
      return res
        .status(400)
        .json({ error: "Please enter a valid positive amount." });
    }

    if (withdrawAmount < MINIMUM_WITHDRAWAL) {
      return res
        .status(400)
        .json({ error: `Minimum withdrawal amount is ${MINIMUM_WITHDRAWAL}.` });
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
          error: "Please add a bank account before requesting withdrawal.",
        });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { ownerId: req.user.id },
    });
    const balance = wallet ? Number(wallet.balance) : 0;

    if (withdrawAmount > balance) {
      return res
        .status(400)
        .json({
          error: "Insufficient balance. Please enter a smaller amount.",
        });
    }

    const pendingRequest = await prisma.withdrawRequest.findFirst({
      where: { ownerId: req.user.id, status: "PENDING" },
    });

    if (pendingRequest) {
      return res
        .status(400)
        .json({
          error:
            "You already have a pending withdrawal request. Please wait until it is processed.",
        });
    }

    const request = await prisma.withdrawRequest.create({
      data: {
        amount: withdrawAmount,
        status: "PENDING",
        ownerId: req.user.id,
        bankName: owner.bankName,
        bankAccountHolder: owner.bankAccountHolder,
        bankAccountNumber: owner.bankAccountNumber,
      },
    });

    res.status(201).json({
      message: "Withdrawal request submitted. Waiting for admin approval.",
      request,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", authenticate, authorize("OWNER"), async (req, res, next) => {
  try {
    const { status } = req.query;

    const where = { ownerId: req.user.id };
    if (status) {
      where.status = status.toUpperCase();
    }

    const requests = await prisma.withdrawRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const wallet = await prisma.wallet.findUnique({
      where: { ownerId: req.user.id },
    });

    res.json({
      wallet: wallet || { balance: 0 },
      requests,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
