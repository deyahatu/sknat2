import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../utils/prisma.js";
import { generateToken } from "../utils/jwt.js";
import { generateResetToken, hashToken } from "../utils/crypto.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_REGEX = /^[؀-ۿa-zA-Z\s]+$/;
const MAJOR_REGEX = /^[؀-ۿa-zA-Z\s]{2,100}$/;
const PHONE_REGEX = /^\d{10}$/;
const ID_NUMBER_REGEX = /^\d{9}$/;
const UNIVERSITY_ID_REGEX = /^\d{8}$/;
const ID_PHOTO_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,/i;
const GENDER_VALUES = ["MALE", "FEMALE"];

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  avatar: true,
  idNumber: true,
  gender: true,
  major: true,
  createdAt: true,
};

router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password, role, idNumber, idPhoto, gender, major } = req.body;
    const userRole = role?.toUpperCase() === "OWNER" ? "OWNER" : "STUDENT";
    const isOwner = userRole === "OWNER";

    if (!name || !email || !phone || !password || !idNumber || !idPhoto) {
      return res
        .status(400)
        .json({ error: "يرجى تعبئة جميع الحقول المطلوبة." });
    }

    if (!isOwner && (!gender || !major)) {
      return res
        .status(400)
        .json({ error: "يرجى تعبئة جميع الحقول المطلوبة." });
    }

    if (!NAME_REGEX.test(name.trim())) {
      return res.status(400).json({ error: "الاسم يجب أن يحتوي على أحرف فقط." });
    }

    if (!PHONE_REGEX.test(phone)) {
      return res
        .status(400)
        .json({ error: "رقم الجوال يجب أن يتكوّن من 10 أرقام بالضبط." });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res
        .status(400)
        .json({
          error:
            "يرجى إدخال بريد إلكتروني صحيح (مثال: name@university.com).",
        });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." });
    }

    const idRegex = isOwner ? ID_NUMBER_REGEX : UNIVERSITY_ID_REGEX;
    if (!idRegex.test(idNumber)) {
      return res.status(400).json({
        error: isOwner
          ? "رقم الهوية يجب أن يحتوي على أرقام فقط ويتبع الصيغة المطلوبة."
          : "الرقم الجامعي يجب أن يحتوي على أرقام فقط ويتبع الصيغة المطلوبة.",
      });
    }

    if (!ID_PHOTO_REGEX.test(idPhoto)) {
      return res.status(400).json({ error: "يرجى إعادة رفع الصورة." });
    }

    if (!isOwner) {
      if (!GENDER_VALUES.includes(gender?.toUpperCase())) {
        return res.status(400).json({ error: "يرجى اختيار الجنس." });
      }
      if (!MAJOR_REGEX.test(major.trim())) {
        return res
          .status(400)
          .json({ error: "التخصص يجب أن يحتوي على أحرف فقط (2-100 حرف)." });
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res
        .status(409)
        .json({ error: "هذا البريد الإلكتروني مسجّل مسبقاً. يرجى تسجيل الدخول." });
    }

    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) {
      return res
        .status(409)
        .json({ error: "رقم الجوال هذا مرتبط بحساب آخر." });
    }

    const existingIdNumber = await prisma.user.findUnique({
      where: { idNumber },
    });
    if (existingIdNumber) {
      return res.status(409).json({
        error: isOwner
          ? "رقم الهوية هذا مسجّل مسبقاً."
          : "الرقم الجامعي هذا مرتبط بحساب آخر.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        role: userRole,
        idNumber,
        idPhoto,
        gender: isOwner ? null : gender.toUpperCase(),
        major: isOwner ? null : major.trim(),
      },
      select: userSelect,
    });

    res.status(201).json({
      message: "Registration successful. Please log in.",
      user,
    });
  } catch (err) {
    if (err?.code === "P2002") {
      const target = err.meta?.target || [];
      const isOwnerRole = req.body.role?.toUpperCase() === "OWNER";

      if (target.includes("email")) {
        return res
          .status(409)
          .json({ error: "هذا البريد الإلكتروني مسجّل مسبقاً. يرجى تسجيل الدخول." });
      }
      if (target.includes("phone")) {
        return res
          .status(409)
          .json({ error: "رقم الجوال هذا مرتبط بحساب آخر." });
      }
      if (target.includes("idNumber")) {
        return res.status(409).json({
          error: isOwnerRole
            ? "رقم الهوية هذا مسجّل مسبقاً."
            : "الرقم الجامعي هذا مرتبط بحساب آخر.",
        });
      }
    }

    return res
      .status(500)
      .json({ error: "فشل إنشاء الحساب. يرجى المحاولة لاحقاً." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "يرجى تعبئة جميع الحقول المطلوبة." });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res
        .status(401)
        .json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى." });
    }

    const token = generateToken(user.id);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });
  } catch (err) {
    console.error("Login error:", err);
    return res
      .status(500)
      .json({
        error: "تسجيل الدخول غير متاح حالياً. يرجى المحاولة لاحقاً.",
      });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ message: "تم تسجيل الخروج بنجاح" });
});

router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "البريد الإلكتروني مطلوب" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.json({
        message: "إذا كان البريد الإلكتروني مسجلاً، سيتم إرسال رابط الاستعادة",
      });
    }

    const { rawToken, hashedToken } = generateResetToken();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
      },
    });

    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password/${rawToken}`;
    console.log(`\n🔑 Password reset link for ${email}:\n${resetUrl}\n`);

    res.json({
      message: "إذا كان البريد الإلكتروني مسجلاً، سيتم إرسال رابط الاستعادة",
    });
  } catch (err) {
    next(err);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res
        .status(400)
        .json({ error: "الرمز وكلمة المرور الجديدة مطلوبان" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
    }

    const hashedToken = hashToken(token);

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ error: "رابط الاستعادة غير صالح أو منتهي الصلاحية" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({ message: "تم تغيير كلمة المرور بنجاح" });
  } catch (err) {
    next(err);
  }
});

router.put("/change-password", authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "كلمة المرور الحالية والجديدة مطلوبتان" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "كلمة المرور الحالية غير صحيحة" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.json({ message: "تم تغيير كلمة المرور بنجاح" });
  } catch (err) {
    next(err);
  }
});

export default router;
