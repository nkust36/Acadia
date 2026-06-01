import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { buildBudgetSnapshot } from "@/lib/budget";
import { listExpenses, type ExpenseRecord } from "@/lib/expenses";
import { getUserProfileByUid, type UserProfile } from "@/lib/social";

function formatCurrency(n: number) {
  return `NT$ ${n.toLocaleString()}`;
}

function buildCategoryTotals(items: ExpenseRecord[]) {
  const totals: Record<string, number> = {};

  for (const it of items) {
    if (it.transactionType !== "expense") continue;
    totals[it.category] = (totals[it.category] || 0) + it.amount;
  }

  return Object.entries(totals).map(([category, amount]) => ({ category, amount }));
}

function getThirtyDayStartKey() {
  const start = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  return start.toISOString().slice(0, 10);
}

export default function UserProfile() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    let active = true;

    setLoading(true);
    Promise.all([getUserProfileByUid(uid), listExpenses(uid)])
      .then(([p, items]) => {
        if (!active) return;
        setProfile(p);
        setExpenses(items);
      })
      .catch((err) => {
        console.error(err);
        toast.error("載入使用者資料失敗。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [uid]);

  const isOwnProfile = user?.id === profile?.uid;

  const last30DaysExpenses = useMemo(() => {
    const startKey = getThirtyDayStartKey();
    return expenses.filter((e) => e.transactionType === "expense" && e.expenseDate >= startKey);
  }, [expenses]);

  const budgetSnapshot = useMemo(() => buildBudgetSnapshot(profile, expenses), [profile, expenses]);

  const last30DaysSum = useMemo(() => {
    return last30DaysExpenses.reduce((sum, item) => sum + item.amount, 0);
  }, [last30DaysExpenses]);

  const dailyAverage = useMemo(() => {
    return Math.round((last30DaysSum / 30) * 100) / 100;
  }, [last30DaysSum]);

  const categories = useMemo(() => buildCategoryTotals(last30DaysExpenses), [last30DaysExpenses]);

  const totalForChart = categories.reduce((s, c) => s + c.amount, 0);

  const colors = ["#60A5FA", "#F97316", "#F43F5E", "#34D399", "#A78BFA", "#FBBF24"];
  const hideFriendId = Boolean(profile?.hideFriendIdFromOthers && !isOwnProfile);
  const hideBudgetStatus = Boolean(profile?.hideBudgetStatusFromOthers && !isOwnProfile);
  const hidePieChart = Boolean(profile?.hidePieChartFromOthers && !isOwnProfile);
  const hideDailyAverage = Boolean(profile?.hideDailyAverageFromOthers && !isOwnProfile);
  const statusText = budgetSnapshot.monthlyBudgetAmount
    ? (budgetSnapshot.isOverBudget ? "超支" : "未超支")
    : "尚未設定預算";

  return (
    <div className="max-w-2xl mx-auto px-5 pt-12 pb-12">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="h-11 w-11 rounded-full bg-card shadow-card flex items-center justify-center"
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">使用者資料</h1>
          <p className="text-sm text-muted-foreground">查看他人的個人檔案與消費分析</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-card p-6">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">載入中...</div>
        ) : !profile ? (
          <div className="py-16 text-center text-sm text-muted-foreground">找不到使用者資料。</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="h-44 w-44 rounded-2xl overflow-hidden bg-background">
                {profile.picture ? <img src={profile.picture} alt={profile.name} className="h-full w-full object-cover" /> : <div className="p-6 text-center text-muted-foreground">無照片</div>}
              </div>

              <div>
                <p className="text-sm text-muted-foreground">名稱</p>
                <p className="font-medium text-lg">{profile.name}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">好友 ID</p>
                <p className="font-medium tracking-[0.2em]">{hideFriendId ? "對方已隱藏" : profile.friendId}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">性別</p>
                <p className="font-medium">{profile.gender ?? "不公開"}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">年齡</p>
                <p className="font-medium">{profile.age ?? "-"}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">狀態</p>
                <p className="font-medium">{hideBudgetStatus ? "對方已隱藏" : statusText}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">最近 30 天平均每日花費</p>
                <p className="text-xl font-bold">{hideDailyAverage ? "對方已隱藏" : Number.isFinite(dailyAverage) ? formatCurrency(dailyAverage) : "--"}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">分類圓餅圖（最近 30 天）</p>
                {hidePieChart ? (
                  <div className="p-6 text-center text-muted-foreground">對方已隱藏這份分析</div>
                ) : totalForChart === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">沒有支出資料</div>
                ) : (
                  <div className="flex items-center gap-4">
                    <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
                      <g transform="translate(80,80)">
                        {(() => {
                          const radius = 60;
                          let cumulative = 0;
                          return categories.map((c, i) => {
                            const start = (cumulative / totalForChart) * Math.PI * 2;
                            cumulative += c.amount;
                            const end = (cumulative / totalForChart) * Math.PI * 2;
                            const x1 = Math.cos(start) * radius;
                            const y1 = Math.sin(start) * radius;
                            const x2 = Math.cos(end) * radius;
                            const y2 = Math.sin(end) * radius;
                            const large = end - start > Math.PI ? 1 : 0;
                            const d = `M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
                            return <path key={c.category} d={d} fill={colors[i % colors.length]} stroke="#fff" strokeWidth={0.5} />;
                          });
                        })()}
                      </g>
                    </svg>

                    <div className="flex-1">
                      {categories.map((c, i) => (
                        <div key={c.category} className="flex items-center gap-3 mb-2">
                          <span className="inline-block h-3 w-3 rounded" style={{ background: colors[i % colors.length] }} />
                          <div className="flex-1 text-sm">
                            <div className="font-medium">{c.category}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(Math.round(c.amount * 100) / 100)}</div>
                          </div>
                          <div className="text-sm">{Math.round((c.amount / totalForChart) * 100)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
