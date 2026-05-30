import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Lock, Globe, Users, Eye, Upload, X, Settings2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { ImagePreview } from "@/components/ImagePreview";
import { createExpense, type ExpenseVisibility } from "@/lib/expenses";
import { compressImageFile } from "@/lib/image";
import { getCategoryIcon, watchCategories, type ExpenseCategory } from "@/lib/categories";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

const moods = ["😊", "😐", "😢", "😡", "🤑", "😅"];
const visibilities: Array<{ icon: LucideIcon; label: string; value: ExpenseVisibility }> = [
  { icon: Lock, label: "僅自己", value: "private" },
  { icon: Users, label: "好友", value: "friends" },
  { icon: Globe, label: "公開", value: "public" },
];

const transactionTypes: Array<{ value: "expense" | "income"; label: string; icon: LucideIcon }> = [
  { value: "expense", label: "支出", icon: ArrowUpRight },
  { value: "income", label: "收入", icon: ArrowDownLeft },
];

function getTodayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AddExpense() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(getTodayLocalDate());
  const [transactionType, setTransactionType] = useState<"expense" | "income">("expense");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [selectedCatId, setSelectedCatId] = useState("");
  const [selectedMood, setSelectedMood] = useState(0);
  const [visibility, setVisibility] = useState<ExpenseVisibility>("private");
  const [secretNote, setSecretNote] = useState("");
  const [isPhotoProcessing, setIsPhotoProcessing] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsubscribe = watchCategories(user.id, setCategories);
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (categories.length === 0) {
      return;
    }

    setSelectedCatId((current) => (
      categories.some((category) => category.id === current)
        ? current
        : categories[0].id
    ));
  }, [categories]);

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value.replace(/[^\d.]/g, "");
    const [wholePart, ...fractionParts] = nextValue.split(".");
    const normalizedFraction = fractionParts.join("");

    if (nextValue === "") {
      setAmount("");
      return;
    }

    if (fractionParts.length === 0) {
      setAmount(wholePart);
      return;
    }

    setAmount(`${wholePart}.${normalizedFraction}`);
  };

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

    setIsPhotoProcessing(true);

    compressImageFile(file)
      .then((compressed) => {
        setPhotoDataUrl(compressed);
      })
      .catch(() => {
        toast.error("照片壓縮失敗，請再試一次");
      })
      .finally(() => {
        setIsPhotoProcessing(false);
      });

    event.target.value = "";
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current) {
      return;
    }

    if (isPhotoProcessing) {
      toast.error("照片仍在處理中，請稍候再儲存");
      return;
    }

    const parsedAmount = Number.parseFloat(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("請輸入正確金額");
      return;
    }

    if (!user) {
      toast.error("登入狀態已失效，請重新登入");
      return;
    }

    const selectedCategory = categories.find((category) => category.id === selectedCatId) ?? categories[0];

    if (!selectedCategory) {
      toast.error("請先建立消費類別");
      return;
    }

    const selectedMoodValue = moods[selectedMood] || "😐";

    isSubmittingRef.current = true;

    try {
      const result = await createExpense({
        userId: user.id,
        amount: Math.round(parsedAmount),
        expenseDate,
        transactionType,
        category: selectedCategory.label,
        mood: selectedMoodValue,
        visibility,
        secretNote,
        photoDataUrl: photoDataUrl || undefined,
      });

      if (photoDataUrl && !result.photoUploaded) {
        toast.warning("記帳已儲存，但照片未成功保存（可再編輯重試）");
      } else {
        toast.success("儲存成功");
      }

      setAmount("");
      setExpenseDate(getTodayLocalDate());
      setTransactionType("expense");
      setSecretNote("");
      setSelectedMood(0);
      setPhotoDataUrl("");
      setIsPhotoProcessing(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
      if (categories[0]) {
        setSelectedCatId(categories[0].id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "儲存記帳紀錄失敗，請再試一次";
      toast.error(message);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="max-w-lg mx-auto px-5 pt-12">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold">新增記帳</h1>
          <p className="text-sm text-muted-foreground">快速記錄這筆收支</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/categories")}
          className="w-10 h-10 rounded-full bg-card shadow-card flex items-center justify-center text-muted-foreground"
          aria-label="前往消費類別設定"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Transaction Type */}
      <div className="mb-5">
        <p className="text-sm font-medium text-muted-foreground mb-2">類型</p>
        <div className="grid grid-cols-2 gap-2">
          {transactionTypes.map((type) => {
            const Icon = type.icon;
            const selected = transactionType === type.value;

            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setTransactionType(type.value)}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  selected
                    ? "bg-primary text-primary-foreground shadow-elevated"
                    : "bg-card shadow-card text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Photo */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card rounded-2xl p-4 shadow-card mb-5"
      >
        {photoDataUrl ? (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl border border-border">
              <ImagePreview
                src={photoDataUrl}
                alt="已附上的記帳照片"
                triggerClassName="block w-full"
                imageClassName="h-36 w-full object-cover"
                previewClassName="max-h-[70vh] w-full object-contain"
                title="已附上的記帳照片"
              />
              <button
                type="button"
                onClick={() => setPhotoDataUrl("")}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white backdrop-blur-sm"
                aria-label="移除照片"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">已附上照片縮圖</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/60 px-4 py-6 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Upload className="h-5 w-5" />
            <span className="text-sm font-medium">點擊上傳照片</span>
          </button>
        )}

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoSelect}
          className="hidden"
        />
      </motion.div>


      {/* Amount Display */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card rounded-2xl p-6 shadow-card text-center mb-5"
      >
        <p className="text-sm text-muted-foreground mb-3">金額</p>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={handleAmountChange}
          placeholder="請輸入金額"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-3xl font-bold text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-2 text-xs text-muted-foreground">NT$ {amount || "0"}</p>
      </motion.div>

      {/* Categories */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">分類</p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {categories.map((cat) => {
            const Icon = getCategoryIcon(cat.icon);
            const selected = selectedCatId === cat.id;

            return (
            <button
              key={cat.id}
              onClick={() => setSelectedCatId(cat.id)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                selected
                  ? "bg-primary text-primary-foreground shadow-elevated"
                  : "bg-card shadow-card"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium">{cat.label}</span>
            </button>
            );
          })}
        </div>
      </div>
      
      {/* Date */}
      <div className="mb-5">
        <p className="text-sm font-medium text-muted-foreground mb-2">日期</p>
        <input
          type="date"
          value={expenseDate}
          onChange={(event) => setExpenseDate(event.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>
      
      {/* Mood */}
      <div className="mb-5">
        <p className="text-sm font-medium text-muted-foreground mb-2">心情標籤</p>
        <div className="flex gap-2">
          {moods.map((m, i) => (
            <button
              key={m}
              onClick={() => setSelectedMood(i)}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                selectedMood === i
                  ? "bg-primary shadow-elevated scale-110"
                  : "bg-card shadow-card"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Visibility */}
      <div className="mb-5">
        <p className="text-sm font-medium text-muted-foreground mb-2">社交能見度</p>
        <div className="flex gap-2">
          {visibilities.map((v) => (
            <button
              key={v.value}
              onClick={() => setVisibility(v.value)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                visibility === v.value
                  ? "bg-primary text-primary-foreground shadow-elevated"
                  : "bg-card shadow-card text-muted-foreground"
              }`}
            >
              <v.icon className="w-4 h-4" />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Secret Note */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5 mb-2">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">秘密備註（僅自己可見）</p>
        </div>
        <textarea
          value={secretNote}
          onChange={(e) => setSecretNote(e.target.value)}
          placeholder="寫點只有你知道的真相..."
          className="w-full bg-card border border-border rounded-xl p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Submit */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSubmit}
        disabled={isPhotoProcessing}
        className="w-full gradient-warm text-primary-foreground font-semibold py-3.5 rounded-xl shadow-elevated text-base mb-6 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPhotoProcessing ? "照片處理中..." : "儲存紀錄"}
      </motion.button>
    </div>
  );
}
