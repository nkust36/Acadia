import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MessageCircle, Send, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getDirectChatId, sendDirectMessage, watchDirectMessages, type DirectMessage } from "@/lib/chat";
import { getUserProfileByUid, watchFriendConnections, type FriendConnection, type UserProfile } from "@/lib/social";

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "剛剛";
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({ message, isMine }: { message: DirectMessage; isMine: boolean }) {
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
        <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
        <p className={`mt-1 text-[10px] ${isMine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { friendUid } = useParams();
  const [friends, setFriends] = useState<FriendConnection[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [friendProfile, setFriendProfile] = useState<UserProfile | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsubscribe = watchFriendConnections(user.id, setFriends);
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMyProfile(null);
      return;
    }

    let active = true;

    getUserProfileByUid(user.id)
      .then((profile) => {
        if (active) {
          setMyProfile(profile);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!friendUid) {
      setFriendProfile(null);
      setMessages([]);
      return;
    }

    let active = true;

    getUserProfileByUid(friendUid)
      .then((profile) => {
        if (active) {
          setFriendProfile(profile);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [friendUid]);

  const selectedFriend = useMemo(() => {
    if (!friendUid) {
      return null;
    }

    return friends.find((friend) => friend.friendUid === friendUid) ?? null;
  }, [friends, friendUid]);

  useEffect(() => {
    if (!user || !friendUid) {
      setMessages([]);
      return;
    }

    const friend = friends.find((item) => item.friendUid === friendUid);
    if (!friend) {
      setMessages([]);
      return;
    }

    const chatId = getDirectChatId(user.id, friendUid);
    const unsubscribe = watchDirectMessages(chatId, setMessages);
    return () => unsubscribe();
  }, [user, friendUid, friends]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, friendUid]);

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || !friendUid) {
      return;
    }

    const trimmed = messageText.trim();
    if (!trimmed) {
      toast.error("請輸入訊息內容。");
      return;
    }

    if (!myProfile || !friendProfile) {
      toast.error("聊天室資料載入中，請稍後再試。");
      return;
    }

    setSending(true);
    try {
      const chatId = getDirectChatId(myProfile.uid, friendProfile.uid);
      await sendDirectMessage({
        chatId,
        sender: myProfile,
        recipient: friendProfile,
        text: trimmed,
      });
      setMessageText("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "訊息傳送失敗。";
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  if (!friendUid) {
    return (
      <div className="max-w-lg mx-auto px-5 pt-12 pb-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold">聊天室</h1>
          </div>
          <MessageCircle className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="bg-card rounded-2xl shadow-card p-4">
          {friends.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
              你目前還沒有好友。
            </div>
          ) : (
            <div className="space-y-2">
              {friends.map((friend, index) => (
                <motion.button
                  key={friend.id}
                  type="button"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => navigate(`/chat/${friend.friendUid}`)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-muted/30 p-3 text-left"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full gradient-warm text-lg">
                    {friend.friendPicture ? (
                      <img src={friend.friendPicture} alt={friend.friendName} className="h-11 w-11 rounded-full object-cover" />
                    ) : (
                      <User className="h-5 w-5 text-primary-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{friend.friendName}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{friend.friendId}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-5 pt-12 pb-8">
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate("/chat")}
          className="rounded-full bg-card p-2 shadow-card"
          aria-label="返回聊天室列表"
        >
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="min-w-0 flex items-center gap-3">
            {selectedFriend?.friendPicture || friendProfile?.picture ? (
              <img
                src={selectedFriend?.friendPicture ?? friendProfile?.picture}
                alt={selectedFriend?.friendName ?? friendProfile?.name ?? "聊天對象"}
                className="h-11 w-11 rounded-full object-cover"
              />
            ) : (
              <User className="h-5 w-5 text-primary-foreground" />
            )}
          <h1 className="truncate text-lg font-bold">{selectedFriend?.friendName ?? friendProfile?.name ?? "聊天對象"}</h1>
        </div>
      </div>

      <div className="rounded-3xl bg-card shadow-card">
        <div className="max-h-[58vh] space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              開始傳第一則訊息吧。
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} isMine={message.senderUid === user?.id} />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSendMessage} className="border-t border-border p-4">
          <div className="flex items-end gap-2 rounded-2xl border border-input bg-background p-3 shadow-sm">
            <Textarea
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder="輸入訊息..."
              rows={2}
              className="min-h-[48px] flex-1 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button type="submit" size="sm" disabled={sending || !messageText.trim()}>
              <Send className="h-4 w-4" />
              送出
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
