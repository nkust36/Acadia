import { motion } from "framer-motion";
import { Check, X, Bell, UserPlus2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import {
  getUserProfileByUid,
  watchFriendNotifications,
  clearNotifications,
  deleteNotification,
  respondToFriendRequest,
  type FriendNotification,
} from "@/lib/social";

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "剛剛";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNotificationSummary(notification: FriendNotification) {
  if (notification.type === "feed_like") {
    return "有人按讚";
  }

  if (notification.type === "feed_comment") {
    return "有人留言";
  }

  if (notification.type === "budget_alert") {
    return "預算超支";
  }

  if (notification.type === "direct_message") {
    return "新訊息";
  }

  if (notification.type === "friend_request" && notification.status === "pending") {
    return "等待回覆";
  }

  if (notification.status === "accepted") {
    return "已接受";
  }
  if (notification.status === "rejected") {
  return "已拒絕";
  }
}

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<FriendNotification[]>([]);
  const [respondingNotificationId, setRespondingNotificationId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = watchFriendNotifications(user.id, setNotifications);
    return () => unsubscribe();
  }, [user]);

  const recentNotifications = useMemo(() => notifications.slice(0, 50), [notifications]);

  const handleNotificationResponse = async (notification: FriendNotification, response: "accepted" | "rejected") => {
    if (!user) return;

    setRespondingNotificationId(notification.id);
    try {
      const recipientProfile = await getUserProfileByUid(user.id);

      if (!recipientProfile) {
        throw new Error("找不到你的個人資料，請重新登入後再試。");
      }

      await respondToFriendRequest({ recipientUser: recipientProfile, notification, response });
      toast.success(response === "accepted" ? "已接受好友邀請" : "已拒絕好友邀請");
    } catch (error) {
      const message = error instanceof Error ? error.message : "無法處理這則通知。";
      toast.error(message);
    } finally {
      setRespondingNotificationId(null);
    }
  };

  const handleDeleteNotification = async (notification: FriendNotification) => {
    if (!user) return;

    try {
      await deleteNotification(user.id, notification.id);
    } catch {
      toast.error("無法刪除這則通知。");
    }
  };

  const handleDeleteAllNotifications = async () => {
    if (!user) return;

    try {
      await clearNotifications(user.id);
      toast.success("已刪除所有通知");
    } catch {
      toast.error("無法刪除所有通知。");
    }
  };

  return (
    <div className="max-w-lg mx-auto px-5 pt-12">
      <div className="bg-card rounded-2xl shadow-card p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-sm font-semibold">通知</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDeleteAllNotifications}
              disabled={notifications.length === 0}
            >
              刪除全部
            </Button>
          </div>
        </div>

        {recentNotifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            暫時沒有通知。
          </div>
        ) : (
          <div className="space-y-3">
            {recentNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`rounded-2xl border p-4 ${notification.read ? "border-border bg-muted/20" : "border-primary/20 bg-primary/5"}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                    {notification.type === "friend_request" ? (
                      <UserPlus2 className="w-4 h-4 text-primary" />
                    ) : (
                      <Bell className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{notification.title}</p>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="text-[10px] text-muted-foreground">{formatTime(notification.createdAt)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteNotification(notification)}
                          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
                          aria-label="刪除通知"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{notification.body}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">{getNotificationSummary(notification)}</span>
                    </div>
                  </div>
                </div>

                {notification.type === "friend_request" && notification.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={() => handleNotificationResponse(notification, "accepted")}
                      disabled={respondingNotificationId === notification.id}
                    >
                      <Check className="w-4 h-4" />
                      接受
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleNotificationResponse(notification, "rejected")}
                      disabled={respondingNotificationId === notification.id}
                    >
                      <X className="w-4 h-4" />
                      拒絕
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
