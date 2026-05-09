import nodemailer from "nodemailer";
import { bookingAcceptedEmail, bookingRejectedEmail, paymentReceiptEmail, bookingCompletedEmail, renewalReminderEmail } from './email-templates.js';

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

export async function sendBookingAccepted(to, studentName, propertyTitle, roomName, dates) {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[DEV] Booking accepted email for ${to}: ${propertyTitle} - ${roomName}\n`);
    return;
  }
  await t.sendMail({
    from: `"سكنات" <${process.env.SMTP_USER}>`,
    to,
    subject: 'تم قبول حجزك - سكنات',
    html: bookingAcceptedEmail(studentName, propertyTitle, roomName, dates),
  });
}

export async function sendBookingRejected(to, studentName, propertyTitle, roomName) {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[DEV] Booking rejected email for ${to}: ${propertyTitle} - ${roomName}\n`);
    return;
  }
  await t.sendMail({
    from: `"سكنات" <${process.env.SMTP_USER}>`,
    to,
    subject: 'تم رفض طلب الحجز - سكنات',
    html: bookingRejectedEmail(studentName, propertyTitle, roomName),
  });
}

export async function sendPaymentReceipt(to, studentName, propertyTitle, amount, paymentDate) {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[DEV] Payment receipt email for ${to}: ${propertyTitle} - ${amount}\n`);
    return;
  }
  await t.sendMail({
    from: `"سكنات" <${process.env.SMTP_USER}>`,
    to,
    subject: 'ايصال الدفع - سكنات',
    html: paymentReceiptEmail(studentName, propertyTitle, amount, paymentDate),
  });
}

export async function sendBookingCompleted(to, studentName, propertyTitle) {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[DEV] Booking completed email for ${to}: ${propertyTitle}\n`);
    return;
  }
  await t.sendMail({
    from: `"سكنات" <${process.env.SMTP_USER}>`,
    to,
    subject: 'اكتمل حجزك - سكنات',
    html: bookingCompletedEmail(studentName, propertyTitle),
  });
}

export async function sendRenewalReminder(to, studentName, propertyTitle, endDate) {
  const t = getTransporter();
  const renewUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/bookings`;
  if (!t) {
    console.log(`\n🔁 [DEV] Renewal reminder for ${to}: ${propertyTitle} ends ${endDate}\n`);
    return;
  }
  await t.sendMail({
    from: `"سكنات" <${process.env.SMTP_USER}>`,
    to,
    subject: 'تذكير: حجزك ينتهي قريباً - سكنات',
    html: renewalReminderEmail(studentName, propertyTitle, endDate, renewUrl),
  });
}

export async function sendPasswordResetEmail(to, resetUrl) {
  const t = getTransporter();
  const fromName = process.env.SMTP_FROM_NAME || "منصة سكنات";

  if (!t) {
    console.log(`\n🔑 [DEV] Password reset link for ${to}: ${resetUrl}\n`);
    return;
  }

  const html = `
    <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background:#f8fbff; border-radius: 16px;">
      <h2 style="color:#17386a; margin:0 0 16px;">إعادة تعيين كلمة المرور</h2>
      <p style="color:#1f3558; font-size:15px; line-height:1.7; margin:0 0 20px;">
        طلبت إعادة تعيين كلمة مرور حسابك في منصة سكنات. اضغط على الزر أدناه لاختيار كلمة مرور جديدة:
      </p>
      <div style="text-align:center; margin:0 0 20px;">
        <a href="${resetUrl}" style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:12px; font-weight:700; font-size:15px;">
          إعادة تعيين كلمة المرور
        </a>
      </div>
      <p style="color:#1f3558; font-size:13px; line-height:1.7; margin:0 0 16px;">
        إذا لم يعمل الزر، انسخ هذا الرابط والصقه في المتصفح:<br>
        <span style="word-break:break-all; color:#2563eb; font-size:12px;">${resetUrl}</span>
      </p>
      <p style="color:#64748b; font-size:13px; line-height:1.7; margin:0;">
        هذا الرابط صالح لمدة ساعة واحدة فقط.<br>
        إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان.
      </p>
    </div>
  `;

  await t.sendMail({
    from: `"${fromName}" <${process.env.SMTP_USER}>`,
    to,
    subject: "إعادة تعيين كلمة المرور - سكنات",
    text: `رابط إعادة تعيين كلمة المرور:\n${resetUrl}\n\nهذا الرابط صالح لمدة ساعة واحدة. إذا لم تطلب ذلك، تجاهل هذه الرسالة.`,
    html,
  });
}
