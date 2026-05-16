import rateLimit from "express-rate-limit";

// Each limiter returns an Arabic message and 429 when the IP exceeds its
// allowance. Limits are tuned for typical legitimate use:
//  - login: a real student rarely fails 5 times in 15 minutes
//  - forgot-password: throttled hard to prevent inbox flooding
//  - verify-email / resend-code: small windows because OTP brute-force
//    becomes meaningful very fast (6-digit codes have only 1M values)
//  - register: prevents account-creation spam from a single IP

function arabicMessage(text) {
  return (req, res) => {
    res.status(429).json({ error: text });
  };
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: arabicMessage(
    "تجاوزت الحد المسموح من محاولات تسجيل الدخول. يرجى الانتظار 15 دقيقة قبل المحاولة مرة أخرى.",
  ),
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: arabicMessage(
    "تجاوزت الحد المسموح من طلبات استعادة كلمة المرور. يرجى المحاولة بعد ساعة.",
  ),
});

export const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: arabicMessage(
    "تجاوزت الحد المسموح من محاولات التحقق. يرجى الانتظار 15 دقيقة.",
  ),
});

export const resendCodeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: arabicMessage(
    "تجاوزت الحد المسموح من طلبات إعادة الإرسال. يرجى الانتظار 10 دقائق.",
  ),
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: arabicMessage(
    "تجاوزت الحد المسموح من محاولات إنشاء الحساب. يرجى المحاولة بعد ساعة.",
  ),
});

// Reset-password is bcrypt-heavy (cost 12 → ~250ms CPU per request even on a
// bogus token). Without a limiter an attacker can saturate the CPU just by
// hammering this endpoint with random tokens.
// General API rate limit — 100 requests per minute per IP
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: arabicMessage(
    "تجاوزت الحد المسموح من الطلبات. يرجى الانتظار دقيقة.",
  ),
});

export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: arabicMessage(
    "تجاوزت الحد المسموح من محاولات إعادة تعيين كلمة المرور. يرجى الانتظار 15 دقيقة.",
  ),
});
