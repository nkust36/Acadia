import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Plus, PencilLine, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import {
  categoryIconOptions,
  createCategory,
  deleteCategory,
  getCategoryIcon,
  watchCategories,
  updateCategory,
  type CategoryIconName,
  type ExpenseCategory,
} from "@/lib/categories";

const emptyForm = {
  label: "",
  icon: "utensils" as CategoryIconName,
};

export default function CategorySettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsubscribe = watchCategories(user.id, setCategories);
    return unsubscribe;
  }, [user]);

  const editingCategory = useMemo(
    () => categories.find((category) => category.id === editingCategoryId) ?? null,
    [categories, editingCategoryId],
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingCategoryId(null);
  };

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, label: event.target.value }));
  };

  const handleSubmit = async () => {
    const trimmedLabel = form.label.trim();

    if (!trimmedLabel) {
      toast.error("請輸入消費類別名稱");
      return;
    }

    const duplicate = categories.some((category) => (
      category.label === trimmedLabel && category.id !== editingCategoryId
    ));

    if (duplicate) {
      toast.error("此類別名稱已存在");
      return;
    }

    if (editingCategoryId) {
      const next = await updateCategory(user!.id, editingCategoryId, {
        label: trimmedLabel,
        icon: form.icon,
      });
      setCategories(next);
      toast.success("已更新消費類別");
      resetForm();
      return;
    }

    const next = await createCategory(user!.id, { label: trimmedLabel, icon: form.icon });
    setCategories(next);
    toast.success("已新增消費類別");
    setForm(emptyForm);
  };

  const handleEdit = (category: ExpenseCategory) => {
    setEditingCategoryId(category.id);
    setForm({ label: category.label, icon: category.icon });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (category: ExpenseCategory) => {
    if (!window.confirm(`確定要刪除「${category.label}」嗎？`)) {
      return;
    }

    const next = await deleteCategory(user!.id, category.id);
    setCategories(next);

    if (editingCategoryId === category.id) {
      resetForm();
    }

    toast.success("已刪除消費類別");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto px-5 pt-12 pb-10">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-card shadow-card flex items-center justify-center"
          aria-label="返回"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">消費類別設定</h1>
          <p className="text-sm text-muted-foreground">新增、編輯或刪除你的分類</p>
        </div>
      </div>

      <motion.section
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-card rounded-2xl p-5 shadow-card mb-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">新增消費類別</p>
            <p className="text-xs text-muted-foreground">先命名，再選一個圖示</p>
          </div>
          {editingCategory ? (
            <span className="text-xs rounded-full bg-primary/10 text-primary px-3 py-1">編輯中</span>
          ) : null}
        </div>

        <div className="grid gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">類別名稱</label>
            <input
              value={form.label}
              onChange={handleNameChange}
              placeholder="例如：午餐、旅行、健身"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">選擇 Icon</label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {categoryIconOptions.map((option) => {
                const Icon = option.icon;
                const selected = form.icon === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, icon: option.value }))}
                    className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 transition-all ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground shadow-elevated"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[11px] font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-elevated"
            >
              <Plus className="h-4 w-4" />
              {editingCategoryId ? "更新類別" : "新增類別"}
            </button>
            {editingCategoryId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground"
              >
                取消編輯
              </button>
            ) : null}
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="bg-card rounded-2xl p-5 shadow-card"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">原有消費類別</p>
            <p className="text-xs text-muted-foreground">點擊可修改，右側可刪除</p>
          </div>
          <span className="text-xs text-muted-foreground">{categories.length} 項</span>
        </div>

        <div className="grid gap-3">
          {categories.map((category) => {
            const Icon = getCategoryIcon(category.icon);

            return (
              <div
                key={category.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => handleEdit(category)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{category.label}</p>
                    <p className="text-xs text-muted-foreground">點擊修改</p>
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(category)}
                    className="rounded-full bg-muted p-2 text-muted-foreground"
                    aria-label={`修改 ${category.label}`}
                  >
                    <PencilLine className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(category)}
                    className="rounded-full bg-destructive/10 p-2 text-destructive"
                    aria-label={`刪除 ${category.label}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>
    </div>
  );
}