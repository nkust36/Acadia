import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronRight, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { format, subDays } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { listExpenses } from "@/lib/expenses";
import { getCategoryIcon, type CategoryIconName } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type RecordItem = {
  id: string;
  category: string;
  icon: LucideIcon;
  amount: number;
  mood: string;
  createdAt: string;
  expenseDate: string;
  transactionType: "expense" | "income";
  color: string;
};

function getTodayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateKey(dateKey: string) {
  return format(parseLocalDateKey(dateKey), "yyyy/MM/dd (EEE)", { locale: zhTW });
}

function getCategoryIconByLabel(label: string): LucideIcon {
  const iconMap: Record<string, CategoryIconName> = {
    餐飲: "utensils",
    交通: "car",
    購物: "shopping-bag",
    咖啡: "coffee",
    娛樂: "gamepad",
    居住: "home",
    醫療: "heart",
    學習: "book",
    進修: "graduation-cap",
    儲蓄: "piggy-bank",
    票券: "ticket",
    智商稅: "sparkles",
  };

  return getCategoryIcon(iconMap[label] ?? "sparkles");
}

function formatMoney(amount: number) {
  return `NT$ ${amount.toLocaleString()}`;
}

export default function Records() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(getTodayKey());

  useEffect(() => {
    if (!user) {
      return;
    }

    listExpenses(user.id)
      .then((items) => {
        setRecords(
          items.map((item) => ({
            id: item.id,
            category: item.category,
            icon: getCategoryIconByLabel(item.category),
            amount: item.transactionType === "income" ? item.amount : -item.amount,
            mood: item.mood,
            createdAt: item.createdAt,
            expenseDate: item.expenseDate,
            transactionType: item.transactionType,
            color: item.transactionType === "income"
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive",
          })),
        );
      })
      .catch(() => undefined);
  }, [user]);

  const recentDateKeys = useMemo(
    () => Array.from({ length: 5 }, (_, index) => getTodayKey(subDays(new Date(), 4 - index))),
    [],
  );

  const selectedDateObject = useMemo(() => parseLocalDateKey(selectedDate), [selectedDate]);

  const selectedRecords = useMemo(
    () => records.filter((record) => record.expenseDate === selectedDate),
    [records, selectedDate],
  );

  const selectedExpenseTotal = useMemo(
    () => selectedRecords
      .filter((record) => record.transactionType === "expense")
      .reduce((sum, record) => sum + Math.abs(record.amount), 0),
    [selectedRecords],
  );

  const recentSummaries = useMemo(() => {
    return recentDateKeys.map((dateKey) => {
      const dayRecords = records.filter((record) => record.expenseDate === dateKey);
      const expenseTotal = dayRecords
        .filter((record) => record.transactionType === "expense")
        .reduce((sum, record) => sum + Math.abs(record.amount), 0);
      const incomeTotal = dayRecords
        .filter((record) => record.transactionType === "income")
        .reduce((sum, record) => sum + Math.abs(record.amount), 0);

      return {
        dateKey,
        label: format(parseLocalDateKey(dateKey), "MM/dd", { locale: zhTW }),
        weekday: format(parseLocalDateKey(dateKey), "EEE", { locale: zhTW }),
        count: dayRecords.length,
        expenseTotal,
        incomeTotal,
        netTotal: incomeTotal - expenseTotal,
      };
    });
  }, [records, recentDateKeys]);

  return (
    <div className="max-w-lg mx-auto px-5 pt-6 pb-8 space-y-6">
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="gradient-warm rounded-3xl p-5 text-primary-foreground shadow-elevated"
      >
        <p className="text-primary-foreground/70 text-sm">近 5 天記帳紀錄</p>
        <div className="flex items-end justify-between gap-3 mt-2">
          <div>
            <h1 className="text-2xl font-bold">{formatDateKey(selectedDate)}</h1>
            <p className="text-sm text-primary-foreground/80 mt-1">
              {selectedRecords.length} 筆紀錄 · 支出 {formatMoney(selectedExpenseTotal)}
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" className="shrink-0 bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                <CalendarDays className="w-4 h-4" />
                選日期
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDateObject}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(getTodayKey(date));
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </motion.div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">近 5 天概覽</h2>
          <span className="text-xs text-muted-foreground">點一下可快速切換</span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {recentSummaries.map((summary, index) => {
            const isActive = summary.dateKey === selectedDate;

            return (
              <motion.button
                key={summary.dateKey}
                type="button"
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.04 * index }}
                onClick={() => setSelectedDate(summary.dateKey)}
                className={`rounded-2xl border p-4 text-left transition-all ${isActive ? "border-primary bg-primary/5 shadow-card" : "bg-card border-border shadow-card"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{summary.label}</p>
                    <p className="text-xs text-muted-foreground">{summary.weekday} · {summary.count} 筆</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex items-center gap-4 mt-3 text-sm flex-wrap">
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <TrendingDown className="w-4 h-4" />
                    {formatMoney(summary.expenseTotal)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-success">
                    <TrendingUp className="w-4 h-4" />
                    {formatMoney(summary.incomeTotal)}
                  </span>
                  <span className="text-muted-foreground ml-auto">
                    淨額 {summary.netTotal >= 0 ? "+" : "-"}{formatMoney(Math.abs(summary.netTotal))}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">當日明細</h2>
          <span className="text-xs text-muted-foreground">收入與支出都會列出</span>
        </div>

        <div className="space-y-2.5">
          {selectedRecords.length > 0 ? selectedRecords.map((record) => (
            <motion.button
              key={record.id}
              type="button"
              initial={{ x: -12, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-card rounded-xl p-3.5 shadow-card flex items-center gap-3 text-left w-full cursor-pointer"
              onClick={() => navigate(`/records/${record.id}`)}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${record.color}`}>
                <record.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-sm truncate">{record.category}</p>
                  <span className="text-xs">{record.mood}</span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{format(parseLocalDateKey(record.expenseDate), "yyyy/MM/dd", { locale: zhTW })}</p>
              </div>
              <p className={`font-semibold text-sm ${record.transactionType === "income" ? "text-success" : "text-destructive"}`}>
                {record.amount >= 0 ? "+" : "-"}{formatMoney(Math.abs(record.amount))}
              </p>
            </motion.button>
          )) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">
              這一天沒有記帳紀錄
            </div>
          )}
        </div>
      </section>
    </div>
  );
}