// نوع العقار (يطابق enum PropertyKind في schema.prisma)
export const PROPERTY_KINDS = [
  {
    id: "APARTMENT",
    title: "شقة",
    icon: "🏢",
    desc: "شقة طلابية تحتوي على عدة غرف، يُمكن تأجيرها بالغرفة",
    needsRooms: true,
  },
  {
    id: "STUDIO",
    title: "استوديو",
    icon: "🏠",
    desc: "وحدة سكنية مستقلة (غرفة + مطبخ + حمام) لشخص",
    needsRooms: false,
  },
];

// نوع الغرفة (يطابق enum RoomKind في schema.prisma)
export const ROOM_KINDS = [
  { id: "SINGLE", title: "غرفة مفردة", icon: "🛏️", capacity: 1 },
  { id: "DOUBLE", title: "غرفة مزدوجة", icon: "🛏️🛏️", capacity: 2 },
];

// الحرم الجامعي (نص حر يخزن في property.campus)
export const CAMPUSES = [
  { id: "OLD", label: "الحرم القديم" },
  { id: "NEW", label: "الحرم الجديد" },
];

// الخدمات الرئيسية للسكن (تخزن في property.sharedServices)
// هذه القائمة هي المصدر الموحد للخدمات في wizard + صفحة الفلترة
export const PROPERTY_LEVEL_SERVICES = [
  "واي فاي",
  "مصعد",
  "موقف سيارات",
  "حراسة",
  "غسالة",
  "مطبخ مشترك",
];

// مميزات الغرفة (تخزن في roomVariant.services لكل نمط غرفة)
export const ROOM_LEVEL_FEATURES = [
  "حمام خاص",
  "تكييف",
  "تدفئة",
  "شرفة",
  "مكتب دراسة",
  "ثلاجة صغيرة",
  "خزانة ملابس",
];

export const TARGET_GENDERS = [
  { value: "MALE", label: "ذكور" },
  { value: "FEMALE", label: "إناث" },
];
