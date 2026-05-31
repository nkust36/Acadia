import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarRange, ChevronLeft, ChevronRight, PieChart, Sparkles, TrendingDown, Wallet } from "lucide-react";
import { Cell, Pie, PieChart as RePieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useAuth } from "@/auth/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listExpenses, type ExpenseRecord } from "@/lib/expenses";
import { getCategoryIcon, type CategoryIconName } from "@/lib/categories";

type CategorySummary = {
  category: string;
  total: number;
  count: number;
  color: string;
  icon: CategoryIconName;
};

const CHART_COLORS = ["#f97316", "#14b8a6", "#8b5cf6", "#f43f5e", "#0ea5e9", "#22c55e", "#eab308", "#ec4899", "#6366f1", "#ef4444"];

function formatMoney(amount: number) {
  return `NT$ ${amount.toLocaleString()}`;
}

function getMonthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(monthValue: string, delta: number) {
  const [year, month] = monthValue.split("-").map(Number);
  const next = new Date(year, month - 1, 1);
  next.setMonth(next.getMonth() + delta);
  return getMonthValue(next);
}

function getDaysInMonth(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function getMonthLabel(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  return `${year} 年 ${month} 月`;
}

function getCategoryIconByLabel(label: string): CategoryIconName {
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

  return iconMap[label] ?? "sparkles";
}

export default function Analysis() {
  const { user } = useAuth();
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [monthValue, setMonthValue] = useState(getMonthValue());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRecords([]);
      setIsLoading(false);
      return;
    }

    let active = true;

    setIsLoading(true);
    listExpenses(user.id)
      .then((items) => {
        if (active) {
          setRecords(items);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user]);

  const selectedMonthExpenses = useMemo(
    () => records.filter((record) => record.transactionType === "expense" && record.expenseDate.startsWith(monthValue)),
    [records, monthValue],
  );

  const categorySummaries = useMemo(() => {
    const totals = new Map<string, { total: number; count: number }>();

    for (const record of selectedMonthExpenses) {
      const current = totals.get(record.category) ?? { total: 0, count: 0 };
      totals.set(record.category, {
        total: current.total + record.amount,
        count: current.count + 1,
      });
    }

    return [...totals.entries()]
      .map(([category, value], index) => ({
        category,
        total: value.total,
        count: value.count,
        color: CHART_COLORS[index % CHART_COLORS.length],
        icon: getCategoryIconByLabel(category),
      }))
      .sort((left, right) => right.total - left.total);
  }, [selectedMonthExpenses]);

  const monthTotal = useMemo(
    () => selectedMonthExpenses.reduce((sum, record) => sum + record.amount, 0),
    [selectedMonthExpenses],
  );

  const averageDailyExpense = monthTotal / getDaysInMonth(monthValue);
  const currentMonthValue = getMonthValue();
  const canGoNext = monthValue < currentMonthValue;

  return (
    <div className="max-w-lg mx-auto px-5 pt-6 pb-8 space-y-6">
      <motion.section
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="gradient-warm rounded-3xl p-5 text-primary-foreground shadow-elevated"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-primary-foreground/70 text-sm">每月分類消費分析</p>
            <h1 className="text-2xl font-bold mt-1">{getMonthLabel(monthValue)}</h1>
          </div>
          <div className="rounded-2xl bg-primary-foreground/15 p-3">
            <PieChart className="w-6 h-6" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "總消費", value: formatMoney(monthTotal), icon: Wallet },
            { label: "每日平均", value: formatMoney(Math.round(averageDailyExpense)), icon: TrendingDown },
            { label: "分類數", value: `${categorySummaries.length} 類`, icon: Sparkles },
          ].map((item, index) => (
            <div key={item.label} className="rounded-2xl bg-primary-foreground/15 p-3 backdrop-blur">
              <div className="flex items-center gap-2 text-primary-foreground/70 text-[11px]">
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </div>
              <p className="mt-1 text-sm font-semibold text-primary-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </motion.section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">月份切換</h2>
            <p className="text-xs text-muted-foreground">可查看指定月份的圓餅圖</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => setMonthValue(shiftMonth(monthValue, -1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Input
              type="month"
              value={monthValue}
              max={currentMonthValue}
              onChange={(event) => setMonthValue(event.target.value)}
              className="w-[160px] bg-card"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMonthValue(shiftMonth(monthValue, 1))}
              disabled={!canGoNext}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-card rounded-3xl p-4 shadow-card border border-border"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">分類占比圓餅圖</h2>
              <p className="text-xs text-muted-foreground">僅統計支出</p>
            </div>
          </div>

          {isLoading ? (
            <div className="h-[320px] rounded-2xl bg-muted/40 animate-pulse" />
          ) : categorySummaries.length > 0 ? (
            <div className="h-[320px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Tooltip
                    formatter={(value: number, name: string) => [formatMoney(value), name]}
                    contentStyle={{
                      borderRadius: "16px",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--background))",
                    }}
                  />
                  <Pie
                    data={categorySummaries}
                    dataKey="total"
                    nameKey="category"
                    innerRadius={76}
                    outerRadius={112}
                    paddingAngle={2}
                  >
                    {categorySummaries.map((entry) => (
                      <Cell key={entry.category} fill={entry.color} stroke={entry.color} />
                    ))}
                  </Pie>
                </RePieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">總消費</p>
                  <p className="text-xl font-bold">{formatMoney(monthTotal)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">平均每日 {formatMoney(Math.round(averageDailyExpense))}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[320px] rounded-2xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center text-center px-6">
              <CalendarRange className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="font-medium">這個月份沒有支出資料</p>
              <p className="text-sm text-muted-foreground mt-1">切換月份後可以重新查看圓餅圖分析</p>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-card rounded-3xl p-4 shadow-card border border-border space-y-3"
        >
          <div>
            <h2 className="font-semibold">分類明細</h2>
            <p className="text-xs text-muted-foreground">由高到低排序</p>
          </div>

          <div className="space-y-3">
            {categorySummaries.length > 0 ? categorySummaries.map((item) => {
              const share = monthTotal > 0 ? (item.total / monthTotal) * 100 : 0;
              const Icon = getCategoryIcon(item.icon);

              return (
                <div key={item.category} className="rounded-2xl border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.category}</p>
                        <p className="text-xs text-muted-foreground">{item.count} 筆 · {share.toFixed(1)}%</p>
                      </div>
                    </div>
                    <p className="font-semibold text-sm whitespace-nowrap">{formatMoney(item.total)}</p>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                先選擇有支出的月份，這裡就會顯示分類占比。
              </div>
            )}
          </div>
        </motion.div>
      </section>
    </div>
  );
}