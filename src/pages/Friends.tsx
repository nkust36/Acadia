import { motion } from "framer-motion";
import { Search, ChevronLeft, Trash2, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { Input } from "@/components/ui/input";
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
import { deleteFriendConnection, watchFriendConnections, type FriendConnection } from "@/lib/social";

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

export default function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<FriendConnection[]>([]);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FriendConnection | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsubscribe = watchFriendConnections(user.id, setFriends);
    return () => unsubscribe();
  }, [user]);

  const filteredFriends = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    if (!keyword) {
      return friends;
    }

    return friends.filter((friend) => friend.friendName.toLowerCase().includes(keyword));
  }, [friends, query]);

  const handleDeleteFriend = async (friend: FriendConnection) => {
    if (!user) {
      return;
    }

    try {
      await deleteFriendConnection(user.id, friend.friendUid);
      toast.success(`已刪除好友 ${friend.friendName}`);
    } catch {
      toast.error("刪除好友失敗，請稍後再試。");
    }
  };

  return (
    <div className="max-w-lg mx-auto px-5 pt-12 pb-8">
      <button
        type="button"
        onClick={() => navigate("/profile")}
        className="mb-4 p-2 rounded-md bg-card shadow-sm"
        aria-label="返回我的頁面"
      >
        <ChevronLeft className="w-5 h-5 text-muted-foreground" />
      </button>
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-card rounded-2xl shadow-card p-4 mb-5"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold">好友列表</p>
            <p className="text-[10px] text-muted-foreground">可依名稱搜尋你的好友</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋好友名稱"
            autoComplete="off"
          />
          <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Search className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        

        {filteredFriends.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            {friends.length === 0 ? "還沒有好友，先回到個人頁搜尋一個 ID 吧。" : "找不到符合名稱的好友。"}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFriends.map((friend) => (
              <div key={friend.id} className="flex items-center gap-3 rounded-2xl bg-muted/30 p-3">
                <button
                  type="button"
                  onClick={() => navigate(`/profile/${friend.friendUid}`)}
                  className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0"
                  aria-label={`查看 ${friend.friendName} 的個人檔案`}
                >
                  {friend.friendPicture ? (
                    <img src={friend.friendPicture} alt={friend.friendName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full gradient-warm flex items-center justify-center text-lg">👥</div>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{friend.friendName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{friend.friendId}</p>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatTime(friend.createdAt)}</span>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(friend)}
                  className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`刪除好友 ${friend.friendName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <AlertDialogTitle>刪除好友</AlertDialogTitle>
                <AlertDialogDescription>
                  確定要刪除「{deleteTarget?.friendName}」嗎？刪除後雙方都會從好友名單中移除。
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  void handleDeleteFriend(deleteTarget);
                  setDeleteTarget(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      
    </div>
  );
}