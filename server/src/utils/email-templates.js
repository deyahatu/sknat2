function baseTemplate(content) {
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0}
    .container{max-width:560px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .header{background:#1e1b4b;color:#fff;padding:24px;text-align:center}
    .header h1{margin:0;font-size:20px}
    .body{padding:24px}
    .footer{padding:16px 24px;text-align:center;color:#888;font-size:12px;border-top:1px solid #eee}
    .info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0}
    .info-row:last-child{border:none}
    .info-label{color:#666}
    .info-value{font-weight:600}
  </style></head><body><div class="container">
    <div class="header"><h1>سكنات</h1></div>
    <div class="body">${content}</div>
    <div class="footer">منصة سكنات للسكن الطلابي</div>
  </div></body></html>`;
}

export function bookingAcceptedEmail(studentName, propertyTitle, roomName, dates) {
  const content = `
    <h2 style="color:#15803d;margin:0 0 16px;">تم قبول حجزك</h2>
    <p style="color:#374151;margin:0 0 20px;">مرحباً ${studentName}، تمت الموافقة على طلب حجزك. يمكنك الآن إتمام الدفع.</p>
    <div>
      <div class="info-row"><span class="info-label">السكن</span><span class="info-value">${propertyTitle}</span></div>
      <div class="info-row"><span class="info-label">الغرفة</span><span class="info-value">${roomName}</span></div>
      <div class="info-row"><span class="info-label">الفترة</span><span class="info-value">${dates}</span></div>
    </div>
  `;
  return baseTemplate(content);
}

export function bookingRejectedEmail(studentName, propertyTitle, roomName) {
  const content = `
    <h2 style="color:#dc2626;margin:0 0 16px;">تم رفض طلب الحجز</h2>
    <p style="color:#374151;margin:0 0 20px;">مرحباً ${studentName}، نأسف لإبلاغك بأنه تم رفض طلب حجزك. يمكنك البحث عن سكن آخر على المنصة.</p>
    <div>
      <div class="info-row"><span class="info-label">السكن</span><span class="info-value">${propertyTitle}</span></div>
      <div class="info-row"><span class="info-label">الغرفة</span><span class="info-value">${roomName}</span></div>
    </div>
  `;
  return baseTemplate(content);
}

export function paymentReceiptEmail(studentName, propertyTitle, amount, paymentDate) {
  const content = `
    <h2 style="color:#1d4ed8;margin:0 0 16px;">ايصال الدفع</h2>
    <p style="color:#374151;margin:0 0 20px;">مرحباً ${studentName}، تم استلام دفعتك بنجاح.</p>
    <div>
      <div class="info-row"><span class="info-label">السكن</span><span class="info-value">${propertyTitle}</span></div>
      <div class="info-row"><span class="info-label">المبلغ المدفوع</span><span class="info-value">${amount} ريال</span></div>
      <div class="info-row"><span class="info-label">تاريخ الدفع</span><span class="info-value">${paymentDate}</span></div>
    </div>
  `;
  return baseTemplate(content);
}

export function bookingCompletedEmail(studentName, propertyTitle) {
  const content = `
    <h2 style="color:#15803d;margin:0 0 16px;">اكتمل حجزك</h2>
    <p style="color:#374151;margin:0 0 20px;">مرحباً ${studentName}، تم إكمال حجزك بنجاح. نتمنى لك إقامة طيبة.</p>
    <div>
      <div class="info-row"><span class="info-label">السكن</span><span class="info-value">${propertyTitle}</span></div>
    </div>
  `;
  return baseTemplate(content);
}

export function renewalReminderEmail(studentName, propertyTitle, endDate, renewUrl) {
  const formattedDate = new Date(endDate).toLocaleDateString('ar-EG');
  const content = `
    <h2 style="color:#d97706;margin:0 0 16px;">حجزك ينتهي قريباً</h2>
    <p style="color:#374151;margin:0 0 14px;">مرحباً ${studentName}، حجزك على <strong>${propertyTitle}</strong> ينتهي بتاريخ <strong>${formattedDate}</strong>.</p>
    <p style="color:#374151;margin:0 0 20px;">إذا كنت ترغب بالاستمرار في السكن، يمكنك تقديم طلب تجديد الآن قبل انتهاء حجزك.</p>
    <div style="text-align:center;margin:0 0 16px;">
      <a href="${renewUrl}" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;">طلب تجديد الحجز</a>
    </div>
    <div>
      <div class="info-row"><span class="info-label">السكن</span><span class="info-value">${propertyTitle}</span></div>
      <div class="info-row"><span class="info-label">تاريخ انتهاء الحجز</span><span class="info-value">${formattedDate}</span></div>
    </div>
  `;
  return baseTemplate(content);
}
