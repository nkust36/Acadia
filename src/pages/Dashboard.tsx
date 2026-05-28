import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, TrendingUp, Eye, EyeOff, Smile, Coffee, ShoppingBag, Car, Utensils, Gamepad2, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { listExpenses } from "@/lib/expenses";
import { getCategoryIcon, type CategoryIconName } from "@/lib/categories";

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
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      return;
    }

    listExpenses(user.id)
      .then((items) => {
        const todayKey = getTodayKey();
        const monthKey = getMonthKey();
        const currentMonthItems = items.filter((item) => item.expenseDate.startsWith(monthKey));
        const todayItems = items.filter((item) => item.expenseDate === todayKey);

        const currentMonthIncome = currentMonthItems
          .filter((item) => item.transactionType === "income")
          .reduce((sum, item) => sum + item.amount, 0);

        const currentMonthExpense = currentMonthItems
          .filter((item) => item.transactionType === "expense")
          .reduce((sum, item) => sum + item.amount, 0);

        const todayExpense = todayItems
          .filter((item) => item.transactionType === "expense")
          .reduce((sum, item) => sum + item.amount, 0);

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
      })
      .catch(() => undefined);
  }, [user]);

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

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="gradient-warm px-5 pt-12 pb-8 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-primary-foreground/70 text-sm">你好！{user?.name ?? "匿名用戶"}</p>
            <h1 className="text-xl font-bold text-primary-foreground">我的記帳看板</h1>
          </div>
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
          <p className="text-3xl font-bold text-primary-foreground mb-4">
            {balanceVisible ? `NT$ ${monthlyBalance.toLocaleString()}` : "••••••"}
          </p>
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
            <p className="text-lg font-bold mt-1">{stat.value}</p>
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
    </div>
  );
}
