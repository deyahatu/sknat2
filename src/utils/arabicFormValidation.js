// Translate native HTML5 form validation messages to Arabic.
// Browsers show "Please fill out this field" etc. in English regardless of
// page lang. We intercept the `invalid` event globally and set a localized
// custom message based on the element's ValidityState, then clear it on the
// next user input so the field re-evaluates from scratch on the next submit.

function localizedMessage(el) {
  const v = el.validity;
  if (v.valueMissing) {
    if (el.type === 'checkbox' || el.type === 'radio') {
      return 'يجب تحديد هذا الخيار.';
    }
    if (el.tagName === 'SELECT') return 'يرجى اختيار قيمة من القائمة.';
    return 'يرجى ملء هذا الحقل.';
  }
  if (v.typeMismatch) {
    if (el.type === 'email') return 'يرجى إدخال بريد إلكتروني صحيح.';
    if (el.type === 'url') return 'يرجى إدخال رابط صحيح.';
    return 'الصيغة غير صحيحة.';
  }
  if (v.patternMismatch) return 'الصيغة المُدخلة لا تطابق المطلوب.';
  if (v.tooShort) {
    return `الحد الأدنى ${el.minLength} حرفاً (المُدخل: ${el.value.length}).`;
  }
  if (v.tooLong) {
    return `الحد الأقصى ${el.maxLength} حرفاً.`;
  }
  if (v.rangeUnderflow) return `القيمة يجب ألا تقل عن ${el.min}.`;
  if (v.rangeOverflow) return `القيمة يجب ألا تزيد عن ${el.max}.`;
  if (v.stepMismatch) return 'القيمة المُدخلة غير صالحة.';
  if (v.badInput) return 'القيمة المُدخلة غير صالحة.';
  return '';
}

export function installArabicFormValidation() {
  document.addEventListener(
    'invalid',
    (e) => {
      const el = e.target;
      if (
        !(el instanceof HTMLInputElement) &&
        !(el instanceof HTMLTextAreaElement) &&
        !(el instanceof HTMLSelectElement)
      ) return;
      const msg = localizedMessage(el);
      if (msg) el.setCustomValidity(msg);
    },
    true, // capture — runs before form submit so the bubble shows the localized text
  );

  document.addEventListener(
    'input',
    (e) => {
      const el = e.target;
      if (typeof el.setCustomValidity === 'function') {
        // Clear so the next validation re-evaluates against real rules.
        el.setCustomValidity('');
      }
    },
    true,
  );

  document.addEventListener(
    'change',
    (e) => {
      const el = e.target;
      if (typeof el.setCustomValidity === 'function') {
        el.setCustomValidity('');
      }
    },
    true,
  );
}
