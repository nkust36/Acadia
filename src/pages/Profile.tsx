import { motion } from "framer-motion";
import {
  Bell,
  Check,
  ChevronRight,
  Copy,
  HelpCircle,
  LogOut,
  MessageCircle,
  Search,
  Settings,
  Shield,
  UserPlus2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  findUserByFriendId,
  clearNotifications,
  deleteNotification,
  respondToFriendRequest,
  sendFriendRequest,
  watchFriendConnections,
  watchFriendNotifications,
  type FriendConnection,
  type FriendNotification,
  type UserProfile,
} from "@/lib/social";

const menuItems = [
  { icon: MessageCircle, label: "聊天室", desc: "一對一訊息" },
  { icon: Shield, label: "隱私與安全", desc: "資料保護設定" },
  { icon: HelpCircle, label: "幫助中心", desc: "常見問題" },
];

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

  if (notification.type === "friend_request" && notification.status === "pending") {
    return "等待回覆";
  }

  if (notification.status === "accepted") {
    return "已接受";
  }

  return "已拒絕";
}

export default function Profile() {
  const { user, logout } = useAuth();
  const [socialLoading, setSocialLoading] = useState(true);
  const [friends, setFriends] = useState<FriendConnection[]>([]);
  const [notifications, setNotifications] = useState<FriendNotification[]>([]);
  const [friendIdQuery, setFriendIdQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<UserProfile | null>(null);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [respondingNotificationId, setRespondingNotificationId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    setSocialLoading(true);

    const unsubscribeFriends = watchFriendConnections(user.id, setFriends);
    const unsubscribeNotifications = watchFriendNotifications(user.id, setNotifications);

    setSocialLoading(false);

    return () => {
      unsubscribeFriends();
      unsubscribeNotifications();
    };
  }, [user]);

  const pendingRequests = useMemo(
    () => notifications.filter((notification) => notification.type === "friend_request" && notification.status === "pending"),
    [notifications],
  );

  const recentNotifications = useMemo(() => notifications.slice(0, 5), [notifications]);
  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.read).length, [notifications]);
  const friendCount = friends.length;

  const handleLogout = async () => {
    await logout();
    toast.success("已登出");
  };

  const handleCopyFriendId = async () => {
    if (!user?.friendId) {
      return;
    }

    await navigator.clipboard.writeText(user.friendId);
    setCopied(true);
    toast.success("好友 ID 已複製");

    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const query = friendIdQuery.trim();
    if (!query) {
      toast.error("請輸入好友 ID。");
      return;
    }

    setSearching(true);
    try {
      const result = await findUserByFriendId(query);

      if (!result) {
        setSearchResult(null);
        toast.error("找不到這個好友 ID。請再確認一次。");
        return;
      }

      setSearchResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "搜尋失敗，請稍後再試。";
      toast.error(message);
    } finally {
      setSearching(false);
    }
  };

  const handleSendInvite = async (target: UserProfile) => {
    if (!user) {
      return;
    }

    setSendingInviteId(target.uid);
    try {
      await sendFriendRequest({ fromUser: user, toFriendId: target.friendId });
      toast.success(`邀請已送出給 ${target.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "邀請發送失敗。";
      toast.error(message);
    } finally {
      setSendingInviteId(null);
    }
  };

  const handleNotificationResponse = async (notification: FriendNotification, response: "accepted" | "rejected") => {
    if (!user) {
      return;
    }

    setRespondingNotificationId(notification.id);
    try {
      await respondToFriendRequest({ recipientUser: user, notification, response });
      toast.success(response === "accepted" ? "已接受好友邀請" : "已拒絕好友邀請");
    } catch (error) {
      const message = error instanceof Error ? error.message : "無法處理這則通知。";
      toast.error(message);
    } finally {
      setRespondingNotificationId(null);
    }
  };

  const handleDeleteNotification = async (notification: FriendNotification) => {
    if (!user) {
      return;
    }

    try {
      await deleteNotification(user.id, notification.id);
    } catch {
      toast.error("無法刪除這則通知。");
    }
  };

  const handleDeleteAllNotifications = async () => {
    if (!user) {
      return;
    }

    try {
      await clearNotifications(user.id);
      toast.success("已刪除所有通知");
    } catch {
      toast.error("無法刪除所有通知。");
    }
  };

  const isCurrentUserResult = searchResult?.uid === user?.id;
  const isAlreadyFriend = Boolean(searchResult && friends.some((friend) => friend.friendUid === searchResult.uid));

  return (
    <div className="max-w-lg mx-auto px-5 pt-12">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-card rounded-2xl p-5 shadow-card mb-5"
      >
        <div className="flex items-center gap-4 mb-4">
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="w-16 h-16 rounded-full object-cover shadow-elevated"
            />
          ) : (
            <div className="w-16 h-16 rounded-full gradient-warm flex items-center justify-center text-3xl shadow-elevated">
              🌮
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg truncate">{user?.name ?? "匿名旅者"}</h2>
            <p className="text-xs text-muted-foreground truncate">{user?.email ?? "尚未登入電子郵件"}</p>
            <div className="flex items-center gap-1 mt-1">
              <Shield className="w-3 h-3 text-success" />
              <span className="text-[10px] text-success font-medium">
                {user?.emailVerified ? "Google 已驗證" : "匿名保護中"}
              </span>
            </div>
          </div>
          <button className="w-9 h-9 rounded-full bg-muted flex items-center justify-center" type="button">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="rounded-2xl bg-muted/40 p-3 flex items-center gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground">你的好友 ID</p>
            <p className="font-semibold tracking-[0.2em] text-sm truncate">{user?.friendId ?? "載入中..."}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleCopyFriendId} disabled={!user?.friendId}>
            <Copy className="w-4 h-4" />
            {copied ? "已複製" : "複製"}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "好友", value: socialLoading ? "--" : String(friendCount) },
            { label: "通知", value: socialLoading ? "--" : String(unreadCount) },
            { label: "尾碼", value: user?.friendId?.slice(-4) ?? "----" },
          ].map((item) => (
            <div key={item.label} className="text-center py-2 bg-muted/50 rounded-xl">
              <p className="text-lg font-bold">{item.value}</p>
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="bg-accent/10 rounded-xl p-3 mb-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
          <Shield className="w-4 h-4 text-accent" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium">只要知道好友 ID，就能搜尋並送出邀請</p>
          <p className="text-[10px] text-muted-foreground">對方會收到通知，並可直接接受或拒絕。</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-card p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold">搜尋好友 ID</p>
            <p className="text-[10px] text-muted-foreground">例如 ACD-1A2B3C4D</p>
          </div>
          <Search className="w-4 h-4 text-muted-foreground" />
        </div>

        <form className="flex gap-2" onSubmit={handleSearch}>
          <Input
            value={friendIdQuery}
            onChange={(event) => setFriendIdQuery(event.target.value)}
            placeholder="輸入好友 ID"
            autoCapitalize="characters"
            autoCorrect="off"
          />
          <Button type="submit" disabled={searching}>
            {searching ? "搜尋中" : "搜尋"}
          </Button>
        </form>

        {searchResult && (
          <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              {searchResult.picture ? (
                <img
                  src={searchResult.picture}
                  alt={searchResult.name}
                  className="w-11 h-11 rounded-full object-cover"
                />
              ) : (
                <div className="w-11 h-11 rounded-full gradient-warm flex items-center justify-center">👤</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{searchResult.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{searchResult.friendId}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {isCurrentUserResult ? (
                <span className="text-xs text-muted-foreground">這是你自己的帳號</span>
              ) : isAlreadyFriend ? (
                <span className="text-xs text-success font-medium">已是好友</span>
              ) : (
                <Button
                  type="button"
                  onClick={() => handleSendInvite(searchResult)}
                  disabled={sendingInviteId === searchResult.uid}
                >
                  <UserPlus2 className="w-4 h-4" />
                  {sendingInviteId === searchResult.uid ? "送出中" : "送出邀請"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl shadow-card p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold">通知中心</p>
            <p className="text-[10px] text-muted-foreground">好友邀請與回覆都會顯示在這裡</p>
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
            <Bell className="w-4 h-4 text-muted-foreground" />
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

      <div className="bg-card rounded-2xl shadow-card p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold">好友列表</p>
            <p className="text-[10px] text-muted-foreground">已接受的好友會出現在這裡</p>
          </div>
          <Users className="w-4 h-4 text-muted-foreground" />
        </div>

        {friends.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            還沒有好友，先試著搜尋一個 ID 吧。
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((friend) => (
              <div key={friend.id} className="flex items-center gap-3 rounded-2xl bg-muted/30 p-3">
                <div className="w-10 h-10 rounded-full gradient-warm flex items-center justify-center text-lg">
                  {friend.friendPicture ? null : "👥"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{friend.friendName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{friend.friendId}</p>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatTime(friend.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl shadow-card overflow-hidden mb-5">
        {menuItems.map((item, i) => (
          <motion.button
            key={item.label}
            type="button"
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.05 * i }}
            className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors border-b border-border last:border-b-0"
          >
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <item.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-[10px] text-muted-foreground">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </motion.button>
        ))}
      </div>

      <button
        onClick={handleLogout}
        className="w-full mt-5 mb-8 flex items-center justify-center gap-2 py-3 text-destructive text-sm font-medium"
      >
        <LogOut className="w-4 h-4" />
        登出帳號
      </button>
    </div>
  );
}