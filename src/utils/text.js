const ARABIC_DIACRITICS = /[ً-ْٰـ]/g;
const ALEF_VARIANTS = /[إأآا]/g;
const YAA_VARIANTS = /[ىي]/g;
const TAA_MARBUTA = /ة/g;

export function normalizeArabic(input) {
  if (input == null) return '';
  return String(input)
    .trim()
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, '')
    .replace(ALEF_VARIANTS, 'ا')
    .replace(YAA_VARIANTS, 'ي')
    .replace(TAA_MARBUTA, 'ه')
    .replace(/\s+/g, ' ');
}

export function findCanonical(value, list) {
  const normalized = normalizeArabic(value);
  if (!normalized) return null;
  return list.find((item) => normalizeArabic(item) === normalized) || null;
}
