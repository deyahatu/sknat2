import { FiWifi, FiShield } from "react-icons/fi";
import {
  MdElevator,
  MdLocalParking,
  MdLocalLaundryService,
  MdKitchen,
  MdElectricBolt,
  MdVideocam,
  MdWeekend,
  MdCleaningServices,
  MdAcUnit,
  MdLocalFireDepartment,
  MdBalcony,
  MdBathtub,
  MdChair,
  MdCheckroom,
  MdKitchen as MdFridge,
  MdBed,
  MdTv,
  MdEdit,
} from "react-icons/md";

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
  "مولد كهرباء",
  "مصعد",
  "موقف سيارات",
  "حراسة",
  "كاميرات مراقبة",
  "مطبخ مشترك",
  "غسالة",
  "صالة مشتركة",
  "تنظيف دوري",
  "تكييف مركزي",
  "تدفئة مركزية",
];

// مميزات الغرفة (تخزن في roomVariant.services لكل نمط غرفة)
export const ROOM_LEVEL_FEATURES = [
  "حمام خاص",
  "تكييف",
  "تدفئة",
  "شرفة",
  "مكتب دراسة",
  "كرسي مكتب",
  "ثلاجة صغيرة",
  "خزانة ملابس",
  "سرير وفرشة",
  "تلفزيون",
];

export const TARGET_GENDERS = [
  { value: "MALE", label: "ذكور" },
  { value: "FEMALE", label: "إناث" },
];

// خريطة الأيقونات لكل خدمة/ميزة (لاستخدامها في الواجهات)
export const SERVICE_ICONS = {
  // خدمات السكن المشتركة
  "واي فاي": FiWifi,
  "مولد كهرباء": MdElectricBolt,
  "مصعد": MdElevator,
  "موقف سيارات": MdLocalParking,
  "حراسة": FiShield,
  "كاميرات مراقبة": MdVideocam,
  "مطبخ مشترك": MdKitchen,
  "غسالة": MdLocalLaundryService,
  "صالة مشتركة": MdWeekend,
  "تنظيف دوري": MdCleaningServices,
  "تكييف مركزي": MdAcUnit,
  "تدفئة مركزية": MdLocalFireDepartment,

  // مميزات الغرفة
  "حمام خاص": MdBathtub,
  "تكييف": MdAcUnit,
  "تدفئة": MdLocalFireDepartment,
  "شرفة": MdBalcony,
  "مكتب دراسة": MdEdit,
  "كرسي مكتب": MdChair,
  "ثلاجة صغيرة": MdFridge,
  "خزانة ملابس": MdCheckroom,
  "سرير وفرشة": MdBed,
  "تلفزيون": MdTv,
};
