import { createUserNotification, getUserProfileByUid, listFriendConnections, updateUserProfileFields, type UserProfile } from "@/lib/social";
import { listExpenses, type ExpenseRecord } from "@/lib/expenses";

export type BudgetSnapshot = {
  monthKey: string;
  monthlyIncomeTotal: number;
  monthlyExpenseTotal: number;
  monthlyBalance: number;
  monthlyBudgetAmount?: number;
  budgetRemaining?: number;
  isOverBudget: boolean;
  budgetLockedThisMonth: boolean;
  profile: UserProfile | null;
};

export function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function sumMonthlyTotals(items: ExpenseRecord[], monthKey: string) {
  const currentMonthItems = items.filter((item) => item.expenseDate.startsWith(monthKey));

  const monthlyIncomeTotal = currentMonthItems
    .filter((item) => item.transactionType === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const monthlyExpenseTotal = currentMonthItems
    .filter((item) => item.transactionType === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    monthlyIncomeTotal,
    monthlyExpenseTotal,
    monthlyBalance: monthlyIncomeTotal - monthlyExpenseTotal,
  };
}

export function buildBudgetSnapshot(profile: UserProfile | null, items: ExpenseRecord[], monthKey = getMonthKey()): BudgetSnapshot {
  const totals = sumMonthlyTotals(items, monthKey);
  const monthlyBudgetAmount = profile?.monthlyBudgetMonthKey === monthKey ? profile.monthlyBudgetAmount : undefined;
  const budgetLockedThisMonth = Boolean(profile?.monthlyBudgetMonthKey === monthKey && typeof monthlyBudgetAmount === "number");
  const budgetRemaining = typeof monthlyBudgetAmount === "number" ? monthlyBudgetAmount - totals.monthlyExpenseTotal : undefined;

  return {
    monthKey,
    ...totals,
    monthlyBudgetAmount,
    budgetRemaining,
    isOverBudget: typeof monthlyBudgetAmount === "number" ? totals.monthlyExpenseTotal > monthlyBudgetAmount : false,
    budgetLockedThisMonth,
    profile,
  };
}

export async function loadBudgetSnapshot(userId: string): Promise<BudgetSnapshot> {
  const [profile, items] = await Promise.all([getUserProfileByUid(userId), listExpenses(userId)]);
  return buildBudgetSnapshot(profile, items);
}

export async function setMonthlyBudget(userId: string, amount: number): Promise<UserProfile> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("請輸入正確的預算金額。");
  }

  const profile = await getUserProfileByUid(userId);
  if (!profile) {
    throw new Error("找不到使用者資料，請重新登入後再試。");
  }

  const monthKey = getMonthKey();

  if (profile.monthlyBudgetMonthKey === monthKey && typeof profile.monthlyBudgetAmount === "number") {
    throw new Error("本月預算已設定，不能修改。");
  }

  await updateUserProfileFields(userId, {
    monthlyBudgetAmount: Math.round(amount),
    monthlyBudgetMonthKey: monthKey,
    budgetAlertMonthKey: undefined,
  });

  const updated = await getUserProfileByUid(userId);
  if (!updated) {
    throw new Error("預算設定失敗，請稍後再試。");
  }

  return updated;
}

export async function notifyBudgetAlertIfNeeded(userId: string): Promise<BudgetSnapshot> {
  const snapshot = await loadBudgetSnapshot(userId);
  const profile = snapshot.profile;

  if (!profile || !snapshot.monthlyBudgetAmount || !snapshot.isOverBudget) {
    return snapshot;
  }

  if (profile.budgetAlertMonthKey === snapshot.monthKey) {
    return snapshot;
  }

  const friends = await listFriendConnections(userId);
  const now = new Date().toISOString();

  await Promise.all(
    friends.map((friend) => createUserNotification(friend.friendUid, {
      requestId: `${userId}_${friend.friendUid}_${snapshot.monthKey}_budget_alert`,
      type: "budget_alert",
      status: "info",
      read: false,
      title: `${profile.name} 超支啦!`,
      body: `本月開支已超過 NT$ ${snapshot.monthlyBudgetAmount.toLocaleString()}`,
      fromUserId: profile.uid,
      fromFriendId: profile.friendId,
      fromName: profile.name,
      fromPicture: profile.picture,
      toUserId: friend.friendUid,
      toFriendId: friend.friendId,
      toName: friend.friendName,
      toPicture: friend.friendPicture,
      createdAt: now,
    })),
  );

  await updateUserProfileFields(userId, {
    budgetAlertMonthKey: snapshot.monthKey,
  });

  return snapshot;
}