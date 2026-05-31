import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, TrendingUp, Eye, EyeOff, Smile, Coffee, ShoppingBag, Car, Utensils, Gamepad2, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { listExpenses } from "@/lib/expenses";
import { getCategoryIcon, type CategoryIconName } from "@/lib/categories";
import { buildBudgetSnapshot, notifyBudgetAlertIfNeeded, setMonthlyBudget, type BudgetSnapshot } from "@/lib/budget";
import { getUserProfileByUid } from "@/lib/social";

type DashboardExpense = {
  id: string;
  category: string;
  icon: LucideIcon;
  amount: number;
  time: string;
  mood: string;
  expenseDate: string;
  color: string;
  transactionType: "expense" | "income";
};

function getTodayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatRelativeTime(dateString: string) {
  const expenseDate = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((Date.now() - expenseDate.getTime()) / 86400000);

  if (diffDays <= 0) {
    return expenseDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  if (diffDays === 1) {
    return "昨天";
  }

  if (diffDays === 2) {
    return "前天";
  }

  if (expenseDate.getFullYear() === now.getFullYear()) {
    return `${expenseDate.getMonth() + 1}/${expenseDate.getDate()}`;
  }

  return expenseDate.toLocaleDateString();
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

export default function Dashboard() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [recentItems, setRecentItems] = useState<DashboardExpense[]>([]);
  const [monthlyExpenseTotal, setMonthlyExpenseTotal] = useState(0);
  const [monthlyIncomeTotal, setMonthlyIncomeTotal] = useState(0);
  const [todayExpenseTotal, setTodayExpenseTotal] = useState(0);
  const [expenseCount, setExpenseCount] = useState(0);
  const [budgetSnapshot, setBudgetSnapshot] = useState<BudgetSnapshot | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const refreshDashboard = async () => {
    if (!user) {
      return;
    }

    const [profile, items] = await Promise.all([getUserProfileByUid(user.id), listExpenses(user.id)]);
    const snapshot = buildBudgetSnapshot(profile, items);

    const todayKey = getTodayKey();
    const todayItems = items.filter((item) => item.expenseDate === todayKey);
    const currentMonthItems = items.filter((item) => item.expenseDate.startsWith(snapshot.monthKey));

    const currentMonthIncome = currentMonthItems
      .filter((item) => item.transactionType === "income")
      .reduce((sum, item) => sum + item.amount, 0);

    const currentMonthExpense = currentMonthItems
      .filter((item) => item.transactionType === "expense")
      .reduce((sum, item) => sum + item.amount, 0);

    const todayExpense = todayItems
      .filter((item) => item.transactionType === "expense")
      .reduce((sum, item) => sum + item.amount, 0);

    setBudgetSnapshot(snapshot);
    setExpenseCount(items.length);
    setMonthlyIncomeTotal(currentMonthIncome);
    setMonthlyExpenseTotal(currentMonthExpense);
    setTodayExpenseTotal(todayExpense);
    setRecentItems(items.slice(0, 5).map((item) => ({
      id: item.id,
      category: item.category,
      icon: getCategoryIconByLabel(item.category),
      amount: item.transactionType === "income" ? item.amount : -item.amount,
      time: formatRelativeTime(item.expenseDate),
      mood: item.mood,
      expenseDate: item.expenseDate,
      color: item.transactionType === "income"
        ? "bg-success/10 text-success"
        : "bg-destructive/10 text-destructive",
      transactionType: item.transactionType,
    })));

    if (snapshot.isOverBudget) {
      void notifyBudgetAlertIfNeeded(user.id);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    void refreshDashboard().catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (budgetSnapshot?.budgetLockedThisMonth) {
      setBudgetInput(String(budgetSnapshot.monthlyBudgetAmount ?? ""));
    }
  }, [budgetSnapshot]);

  const currentMood = useMemo(() => {
    if (recentItems.length === 0) {
      return "😊";
    }

    const moodCounts = new Map<string, number>();
    for (const item of recentItems) {
      moodCounts.set(item.mood, (moodCounts.get(item.mood) ?? 0) + 1);
    }

    return [...moodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "😊";
  }, [recentItems]);

  const monthlyBalance = monthlyIncomeTotal - monthlyExpenseTotal;

  const handleOpenBudgetDialog = () => {
    if (budgetSnapshot?.budgetLockedThisMonth) {
      return;
    }

    setBudgetInput(budgetSnapshot?.monthlyBudgetAmount ? String(budgetSnapshot.monthlyBudgetAmount) : "");
    setBudgetDialogOpen(true);
  };

  const handleSaveBudget = async () => {
    if (!user) {
      return;
    }

    const parsed = Number.parseFloat(budgetInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    setSavingBudget(true);
    try {
      await setMonthlyBudget(user.id, parsed);
      await refreshDashboard();
      setBudgetDialogOpen(false);
      toast.success("本月預算已設定");
    } catch (error) {
      const message = error instanceof Error ? error.message : "預算設定失敗，請稍後再試。";
      toast.error(message);
    } finally {
      setSavingBudget(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="gradient-warm px-5 pt-12 pb-8 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-primary-foreground/70 text-sm">你好！{user?.name ?? "匿名用戶"}</p>
            <h1 className="text-xl font-bold text-primary-foreground">我的記帳看板</h1>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleOpenBudgetDialog}
            disabled={budgetSnapshot?.budgetLockedThisMonth}
          >
            {budgetSnapshot?.budgetLockedThisMonth ? "本月預算已設定" : "設定本月預算"}
          </Button>
        </div>

        {/* Balance Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-primary-foreground/15 backdrop-blur rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-primary-foreground/80 text-sm">本月結餘</span>
            <button onClick={() => setBalanceVisible(!balanceVisible)}>
              {balanceVisible ? (
                <Eye className="w-4 h-4 text-primary-foreground/60" />
              ) : (
                <EyeOff className="w-4 h-4 text-primary-foreground/60" />
              )}
            </button>
          </div>
          <div className="flex items-end ">
            <p className="text-3xl font-bold text-primary-foreground mb-4">
              {balanceVisible ? `NT$ ${monthlyBalance.toLocaleString()}` : "••••••"} 
            </p>
            <p className="text-3xl font-bold text-primary-foreground mb-4 opacity-50">
              /{budgetSnapshot?.monthlyBudgetAmount ? ` ${budgetSnapshot.monthlyBudgetAmount.toLocaleString()}` : "--"}
            </p>
          </div>
          
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-success/30 flex items-center justify-center">
                <ArrowDown className="w-3 h-3 text-primary-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-primary-foreground/60">本月收入</p>
                <p className="text-sm font-semibold text-primary-foreground">
                  {balanceVisible ? `NT$ ${monthlyIncomeTotal.toLocaleString()}` : "••••"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-destructive/30 flex items-center justify-center">
                <ArrowUp className="w-3 h-3 text-primary-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-primary-foreground/60">本月支出</p>
                <p className="text-sm font-semibold text-primary-foreground">
                  {balanceVisible ? `NT$ ${monthlyExpenseTotal.toLocaleString()}` : "••••"}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Quick Stats */}
      <div className="px-5 -mt-4 grid grid-cols-3 gap-3">
        {[
          { label: "今日支出", value: `NT$ ${todayExpenseTotal.toLocaleString()}`, icon: TrendingUp, trend: "即時更新" },
          { label: "筆數", value: `${expenseCount} 筆`, icon: ShoppingBag, trend: "Firebase" },
          { label: "心情", value: currentMood, icon: Smile, trend: "最近常用" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 * i }}
            className="bg-card rounded-xl p-3 shadow-card"
          >
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-lg font-bold">{stat.value}</p>
              {stat.label === "心情" && budgetSnapshot?.isOverBudget && (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                  超支啦!!
                </span>
              )}
            </div>
            <p className="text-[10px] text-success mt-0.5">{stat.trend}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent Transactions */}
      <div className="px-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">最近紀錄</h2>
          <button
            type="button"
            onClick={() => navigate("/records")}
            className="text-xs text-primary font-medium"
          >
            查看更多
          </button>
        </div>
        <div className="space-y-2.5">
          {recentItems.map((item, i) => (
            <motion.button
              key={i}
              type="button"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.05 * i }}
              onClick={() => navigate(`/records/${item.id}`)}
              className="bg-card rounded-xl p-3.5 shadow-card flex items-center gap-3 text-left w-full cursor-pointer"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-sm">{item.category}</p>
                  <span className="text-xs">{item.mood}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{item.time}</p>
              </div>
              <p className={`font-semibold text-sm ${item.transactionType === "income" ? "text-success" : "text-destructive"}`}>
                {item.amount > 0 ? `+NT$ ${item.amount.toLocaleString()}` : `-NT$ ${Math.abs(item.amount).toLocaleString()}`}
              </p>
            </motion.button>
          ))}
        </div>
      </div>

      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>設定本月預算</DialogTitle>
            <DialogDescription>
              設定後，本月內不可修改；若超支，系統會提醒你與你的好友。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              type="number"
              min="1"
              value={budgetInput}
              onChange={(event) => setBudgetInput(event.target.value)}
              placeholder="請輸入本月預算金額"
            />
            <p className="text-[10px] text-muted-foreground">
              目前本月支出：NT$ {monthlyExpenseTotal.toLocaleString()}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBudgetDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={handleSaveBudget} disabled={savingBudget}>
              {savingBudget ? "儲存中" : "儲存預算"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
