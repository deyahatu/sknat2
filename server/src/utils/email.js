import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) return null;

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  return transporter;
}

export function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendVerificationCodeEmail(to, code) {
  const t = getTransporter();
  const fromName = process.env.SMTP_FROM_NAME || "منصة سكنات";

  if (!t) {
    console.log(`\n📧 [DEV] Verification code for ${to}: ${code}\n`);
    return;
  }

  const html = `
    <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background:#f8fbff; border-radius: 16px;">
      <h2 style="color:#17386a; margin:0 0 16px;">رمز تحقق التسجيل في سكنات</h2>
      <p style="color:#1f3558; font-size:15px; line-height:1.7; margin:0 0 20px;">
        أهلاً بك في منصة سكنات. استخدم الرمز التالي لإكمال إنشاء حسابك:
      </p>
      <div style="background:#ffffff; border:2px dashed #2563eb; border-radius:14px; padding:20px; text-align:center; margin:0 0 20px;">
        <span style="font-size:32px; font-weight:800; color:#2563eb; letter-spacing:8px;">${code}</span>
      </div>
      <p style="color:#64748b; font-size:13px; line-height:1.7; margin:0;">
        هذا الرمز صالح لمدة 10 دقائق فقط.<br>
        إذا لم تطلب إنشاء حساب، يمكنك تجاهل هذه الرسالة.
      </p>
    </div>
  `;

  await t.sendMail({
    from: `"${fromName}" <${process.env.SMTP_USER}>`,
    to,
    subject: "رمز تحقق التسجيل في سكنات",
    text: `رمز التحقق الخاص بك: ${code}\nهذا الرمز صالح لمدة 10 دقائق.`,
    html,
  });
}
