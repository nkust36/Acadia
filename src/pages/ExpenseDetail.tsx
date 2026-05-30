import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarDays, Camera, Edit3, Globe, Lock, Trash2, Users, type LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { ImagePreview } from "@/components/ImagePreview";
import { deleteExpense, getExpense, updateExpense, type ExpenseRecord, type ExpenseVisibility } from "@/lib/expenses";
import { compressImageFile } from "@/lib/image";
import { loadCategories, type ExpenseCategory, getCategoryIcon } from "@/lib/categories";
import { firebaseStorage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getDownloadURL, ref } from "firebase/storage";

const moods = ["😊", "😐", "😢", "😡", "🤑", "😅"];
const visibilities: Array<{ icon: LucideIcon; label: string; value: ExpenseVisibility }> = [
  { icon: Lock, label: "僅自己", value: "private" },
  { icon: Users, label: "好友", value: "friends" },
  { icon: Globe, label: "公開", value: "public" },
];

function parseLocalDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateKey(value: string) {
  return format(parseLocalDateKey(value), "yyyy/MM/dd (EEE)", { locale: zhTW });
}

function formatDateTime(value: string) {
  return format(new Date(value), "yyyy/MM/dd HH:mm", { locale: zhTW });
}

function formatMoney(amount: number) {
  return `NT$ ${Math.abs(amount).toLocaleString()}`;
}

export default function ExpenseDetail() {
  const { expenseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [expense, setExpense] = useState<ExpenseRecord | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [transactionType, setTransactionType] = useState<"expense" | "income">("expense");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedMood, setSelectedMood] = useState(0);
  const [visibility, setVisibility] = useState<ExpenseVisibility>("private");
  const [secretNote, setSecretNote] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [resolvedPhotoUrl, setResolvedPhotoUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!user || !expenseId) {
      return;
    }

    setIsLoading(true);

    Promise.all([getExpense(user.id, expenseId), loadCategories(user.id)])
      .then(([nextExpense, nextCategories]) => {
        setExpense(nextExpense ?? null);
        setCategories(nextCategories);

        if (nextExpense) {
          setAmount(String(nextExpense.amount));
          setExpenseDate(nextExpense.expenseDate);
          setTransactionType(nextExpense.transactionType);
          setVisibility(nextExpense.visibility);
          setSecretNote(nextExpense.secretNote);
          setSelectedMood(Math.max(0, moods.indexOf(nextExpense.mood)));
          setPhotoDataUrl(null);
          setRemovePhoto(false);
          setSelectedCategoryId(nextCategories.find((category) => category.label === nextExpense.category)?.id ?? nextCategories[0]?.id ?? "");

          if (nextExpense.photoUrl) {
            setResolvedPhotoUrl(nextExpense.photoUrl);
          } else if (nextExpense.photoPath) {
            getDownloadURL(ref(firebaseStorage, nextExpense.photoPath))
              .then((url) => setResolvedPhotoUrl(url))
              .catch(() => setResolvedPhotoUrl(undefined));
          } else {
            setResolvedPhotoUrl(undefined);
          }
        }
      })
      .catch(() => {
        setExpense(null);
      })
      .finally(() => setIsLoading(false));
  }, [user, expenseId]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? categories[0],
    [categories, selectedCategoryId],
  );

  const currentMood = moods[selectedMood] || expense?.mood || "😐";
  const currentPhoto = photoDataUrl || (removePhoto ? undefined : resolvedPhotoUrl || expense?.photoUrl);

  const handlePhotoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("請選擇圖片檔案");
      event.target.value = "";
      return;
    }

    compressImageFile(file)
      .then((compressed) => {
        setPhotoDataUrl(compressed);
        setRemovePhoto(false);
      })
      .catch(() => {
        toast.error("照片壓縮失敗，請再試一次");
      });

    event.target.value = "";
  };

  const startEditing = () => {
    if (!expense) {
      return;
    }

    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (!expense) {
      return;
    }

    setAmount(String(expense.amount));
    setExpenseDate(expense.expenseDate);
    setTransactionType(expense.transactionType);
    setVisibility(expense.visibility);
    setSecretNote(expense.secretNote);
    setSelectedMood(Math.max(0, moods.indexOf(expense.mood)));
    setPhotoDataUrl(null);
    setRemovePhoto(false);
    setSelectedCategoryId(categories.find((category) => category.label === expense.category)?.id ?? categories[0]?.id ?? "");
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!user || !expense || !expenseId) {
      toast.error("無法更新這筆紀錄");
      return;
    }

    const parsedAmount = Number.parseFloat(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("請輸入正確金額");
      return;
    }

    const category = selectedCategory ?? categories.find((item) => item.label === expense.category);

    if (!category) {
      toast.error("請先建立消費類別");
      return;
    }

    try {
      const updated = await updateExpense({
        userId: user.id,
        expenseId,
        amount: Math.round(parsedAmount),
        expenseDate,
        transactionType,
        category: category.label,
        mood: currentMood,
        visibility,
        secretNote,
        photoDataUrl: photoDataUrl ?? undefined,
        removePhoto,
      });

      setExpense(updated);
      setResolvedPhotoUrl(updated.photoUrl);
      setPhotoDataUrl(null);
      setRemovePhoto(false);
      setIsEditing(false);
      toast.success("已更新記帳紀錄");
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新失敗，請再試一次";
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!user || !expenseId) {
      toast.error("無法刪除這筆紀錄");
      return;
    }

    try {
      await deleteExpense(user.id, expenseId);
      toast.success("已刪除記帳紀錄");
      navigate("/records", { replace: true });
    } catch {
      toast.error("刪除失敗，請再試一次");
    }
  };

  if (isLoading) {
    return <div className="max-w-lg mx-auto px-5 pt-8 text-sm text-muted-foreground">載入中...</div>;
  }

  if (!expense) {
    return (
      <div className="max-w-lg mx-auto px-5 pt-8 space-y-4">
        <p className="text-sm text-muted-foreground">找不到這筆記帳紀錄。</p>
        <Button variant="outline" onClick={() => navigate("/records")}>返回紀錄頁</Button>
      </div>
    );
  }

  const CategoryIcon = selectedCategory ? getCategoryIcon(selectedCategory.icon) : null;

  return (
    <div className="max-w-lg mx-auto px-5 pt-6 pb-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" className="px-0 hover:bg-transparent" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
        {isEditing ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancelEditing}>取消</Button>
            <Button onClick={handleSave}>儲存</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={startEditing}>
              <Edit3 className="w-4 h-4 mr-2" />
              編輯
            </Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              刪除
            </Button>
          </div>
        )}
      </div>

      <motion.section
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="gradient-warm rounded-3xl p-5 text-primary-foreground shadow-elevated"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-primary-foreground/70 text-sm">記帳詳細</p>
            <h1 className="text-2xl font-bold mt-1">{expense.category}</h1>
            <p className="text-sm text-primary-foreground/80 mt-1">{formatDateKey(expense.expenseDate)}</p>
          </div>
          <div className="rounded-2xl bg-primary-foreground/15 p-3">
            {expense.transactionType === "income" ? <span className="text-lg font-bold">+</span> : <span className="text-lg font-bold">-</span>}
          </div>
        </div>
        <p className="text-3xl font-bold mt-5">
          {expense.transactionType === "income" ? "+" : "-"}{formatMoney(expense.amount)}
        </p>
      </motion.section>

      <section className="bg-card rounded-2xl p-4 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">照片</h2>
          {isEditing && currentPhoto && (
            <button type="button" onClick={() => setRemovePhoto(true)} className="text-xs text-destructive">
              移除照片
            </button>
          )}
        </div>

        {currentPhoto ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <ImagePreview
              src={currentPhoto}
              alt="記帳照片"
              triggerClassName="block w-full"
              imageClassName="h-56 w-full object-cover"
              previewClassName="max-h-[70vh] w-full object-contain"
              title="記帳照片"
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-background/60 p-8 text-center text-sm text-muted-foreground">
            沒有附照片
          </div>
        )}

        {isEditing && (
          <div className="flex items-center gap-3">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <Button variant="outline" type="button" onClick={() => photoInputRef.current?.click()}>
              <Camera className="w-4 h-4 mr-2" />
              {photoDataUrl ? "更換照片" : "上傳新照片"}
            </Button>
            {photoDataUrl && (
              <button type="button" onClick={() => setPhotoDataUrl(null)} className="text-xs text-muted-foreground">
                取消新照片
              </button>
            )}
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <p className="text-xs text-muted-foreground">金額</p>
          {isEditing ? (
            <Input value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))} className="mt-2" />
          ) : (
            <p className="text-lg font-bold mt-2">{formatMoney(expense.amount)}</p>
          )}
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <p className="text-xs text-muted-foreground">日期</p>
          {isEditing ? (
            <Input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} className="mt-2" />
          ) : (
            <p className="text-lg font-bold mt-2 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              {formatDateKey(expense.expenseDate)}
            </p>
          )}
        </div>
      </section>

      <section className="bg-card rounded-2xl p-4 shadow-card space-y-4">
        <h2 className="font-semibold">內容</h2>

        <div>
          <p className="text-xs text-muted-foreground mb-2">類別</p>
          {isEditing ? (
            <select
              value={selectedCategoryId}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.label}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm font-medium flex items-center gap-2">
              {CategoryIcon ? <CategoryIcon className="w-4 h-4" /> : null}
              {expense.category}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">備註</p>
          {isEditing ? (
            <Textarea value={secretNote} onChange={(event) => setSecretNote(event.target.value)} className="min-h-[96px]" />
          ) : (
            <p className="text-sm leading-6 whitespace-pre-wrap text-foreground/90">
              {expense.secretNote || "沒有備註"}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">心情</p>
          {isEditing ? (
            <div className="flex flex-wrap gap-2">
              {moods.map((mood, index) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => setSelectedMood(index)}
                  className={`h-10 w-10 rounded-full text-lg ${selectedMood === index ? "bg-primary text-primary-foreground shadow-elevated" : "bg-background shadow-card"}`}
                >
                  {mood}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm">{expense.mood}</p>
          )}
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">能見度</p>
          {isEditing ? (
            <div className="grid grid-cols-3 gap-2">
              {visibilities.map((item) => {
                const Icon = item.icon;
                const selected = visibility === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setVisibility(item.value)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm ${selected ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {visibilities.find((item) => item.value === expense.visibility)?.label ?? "僅自己"}
            </p>
          )}
        </div>
      </section>

      <section className="bg-card rounded-2xl p-4 shadow-card">
        <p className="text-xs text-muted-foreground">類型</p>
        {isEditing ? (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={() => setTransactionType("expense")}
              className={`rounded-xl px-4 py-3 text-sm font-medium ${transactionType === "expense" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
            >
              支出
            </button>
            <button
              type="button"
              onClick={() => setTransactionType("income")}
              className={`rounded-xl px-4 py-3 text-sm font-medium ${transactionType === "income" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
            >
              收入
            </button>
          </div>
        ) : (
          <p className="text-sm font-medium mt-2">{expense.transactionType === "income" ? "收入" : "支出"}</p>
        )}
      </section>

      <section className="bg-card rounded-2xl p-4 shadow-card">
        <p className="text-xs text-muted-foreground">建立時間</p>
        <p className="text-sm font-medium mt-2">{formatDateTime(expense.createdAt)}</p>
      </section>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除這筆記帳紀錄？</AlertDialogTitle>
            <AlertDialogDescription>
              這個動作無法復原，相關照片也會一併刪除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}