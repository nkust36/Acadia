import {
  Utensils,
  Car,
  ShoppingBag,
  Coffee,
  Gamepad2,
  Home,
  HeartPulse,
  BookOpen,
  GraduationCap,
  PiggyBank,
  Ticket,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore";

const DEFAULT_CATEGORIES_COLLECTION = "categories";

export const categoryIconOptions = [
  { value: "utensils", label: "餐飲", icon: Utensils },
  { value: "car", label: "交通", icon: Car },
  { value: "shopping-bag", label: "購物", icon: ShoppingBag },
  { value: "coffee", label: "咖啡", icon: Coffee },
  { value: "gamepad", label: "娛樂", icon: Gamepad2 },
  { value: "home", label: "居住", icon: Home },
  { value: "heart", label: "醫療", icon: HeartPulse },
  { value: "book", label: "學習", icon: BookOpen },
  { value: "graduation-cap", label: "進修", icon: GraduationCap },
  { value: "piggy-bank", label: "儲蓄", icon: PiggyBank },
  { value: "ticket", label: "票券", icon: Ticket },
  { value: "sparkles", label: "其他", icon: Sparkles },
] as const;

export type CategoryIconName = (typeof categoryIconOptions)[number]["value"];

export type ExpenseCategory = {
  id: string;
  label: string;
  icon: CategoryIconName;
};

export const defaultCategories: ExpenseCategory[] = [
  { id: "cat-food", label: "餐飲", icon: "utensils" },
  { id: "cat-transport", label: "交通", icon: "car" },
  { id: "cat-shopping", label: "購物", icon: "shopping-bag" },
  { id: "cat-coffee", label: "咖啡", icon: "coffee" },
  { id: "cat-entertainment", label: "娛樂", icon: "gamepad" },
  { id: "cat-home", label: "居住", icon: "home" },
  { id: "cat-medical", label: "醫療", icon: "heart" },
  { id: "cat-study", label: "學習", icon: "book" },
  { id: "cat-boost", label: "智商稅", icon: "sparkles" },
];

function isCategoryIconName(value: string): value is CategoryIconName {
  return categoryIconOptions.some((option) => option.value === value);
}

function normalizeCategory(category: ExpenseCategory, index: number): ExpenseCategory {
  const label = category.label.trim();
  return {
    id: category.id || `category-${index}`,
    label: label || `未命名類別 ${index + 1}`,
    icon: isCategoryIconName(category.icon) ? category.icon : "sparkles",
  };
}

async function ensureDefaultCategories(userId: string) {
  const categoriesRef = collection(firebaseDb, DEFAULT_CATEGORIES_COLLECTION, userId, "items");
  const snapshot = await getDocs(categoriesRef);

  if (!snapshot.empty) {
    return;
  }

  await Promise.all(
    defaultCategories.map((category) => setDoc(doc(categoriesRef), stripUndefined({
      label: category.label,
      icon: category.icon,
      createdAt: new Date().toISOString(),
    }))),
  );
}

function mapCategoryDoc(id: string, data: Record<string, unknown>, index: number): ExpenseCategory {
  const label = typeof data.label === "string" ? data.label : `未命名類別 ${index + 1}`;
  const icon = typeof data.icon === "string" && isCategoryIconName(data.icon) ? data.icon : "sparkles";

  return normalizeCategory({ id, label, icon }, index);
}

export function watchCategories(userId: string, onChange: (categories: ExpenseCategory[]) => void) {
  const categoriesRef = collection(firebaseDb, DEFAULT_CATEGORIES_COLLECTION, userId, "items");
  const categoriesQuery = query(categoriesRef, orderBy("createdAt", "asc"));

  ensureDefaultCategories(userId).catch(() => undefined);

  return onSnapshot(categoriesQuery, (snapshot) => {
    const next = snapshot.docs.map((entry, index) => mapCategoryDoc(entry.id, entry.data(), index));
    onChange(next.length > 0 ? next : defaultCategories);
  });
}

export async function loadCategories(userId: string): Promise<ExpenseCategory[]> {
  await ensureDefaultCategories(userId);
  const categoriesRef = collection(firebaseDb, DEFAULT_CATEGORIES_COLLECTION, userId, "items");
  const snapshot = await getDocs(query(categoriesRef, orderBy("createdAt", "asc")));

  return snapshot.docs.map((entry, index) => mapCategoryDoc(entry.id, entry.data(), index));
}

export async function createCategory(userId: string, input: Omit<ExpenseCategory, "id">): Promise<ExpenseCategory[]> {
  const categoriesRef = collection(firebaseDb, DEFAULT_CATEGORIES_COLLECTION, userId, "items");
  await addDoc(categoriesRef, stripUndefined({
    label: input.label.trim(),
    icon: input.icon,
    createdAt: new Date().toISOString(),
  }));

  return loadCategories(userId);
}

export async function updateCategory(userId: string, categoryId: string, input: Omit<ExpenseCategory, "id">): Promise<ExpenseCategory[]> {
  const categoryRef = doc(firebaseDb, DEFAULT_CATEGORIES_COLLECTION, userId, "items", categoryId);
  await setDoc(
    categoryRef,
    stripUndefined({
      label: input.label.trim(),
      icon: input.icon,
      createdAt: new Date().toISOString(),
    }),
    { merge: true },
  );

  return loadCategories(userId);
}

export async function deleteCategory(userId: string, categoryId: string): Promise<ExpenseCategory[]> {
  const categoryRef = doc(firebaseDb, DEFAULT_CATEGORIES_COLLECTION, userId, "items", categoryId);
  await deleteDoc(categoryRef);

  return loadCategories(userId);
}

export function getCategoryIcon(iconName: CategoryIconName): LucideIcon {
  const iconMap: Record<CategoryIconName, LucideIcon> = {
    "utensils": Utensils,
    "car": Car,
    "shopping-bag": ShoppingBag,
    "coffee": Coffee,
    "gamepad": Gamepad2,
    "home": Home,
    "heart": HeartPulse,
    "book": BookOpen,
    "graduation-cap": GraduationCap,
    "piggy-bank": PiggyBank,
    "ticket": Ticket,
    "sparkles": Sparkles,
  };

  return iconMap[iconName] ?? Sparkles;
}