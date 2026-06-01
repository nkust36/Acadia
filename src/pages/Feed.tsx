import { motion } from "framer-motion";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3, Heart, MessageCircle, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { ImagePreview } from "@/components/ImagePreview";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  addFeedComment,
  loadFeedPosts,
  toggleFeedLike,
  watchFeedComments,
  type FeedComment,
  type FeedPost,
} from "@/lib/feed";
import { watchFriendConnections } from "@/lib/social";

function formatMoney(amount: number) {
  return `NT$ ${Math.abs(amount).toLocaleString()}`;
}

function formatRelativeTime(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return "剛剛";
  }

  const diffMinutes = Math.floor((Date.now() - time) / 60000);
  if (diffMinutes < 1) {
    return "剛剛";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} 分鐘前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小時前`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天前`;
}

function getPostExpiryLabel(post: FeedPost) {
  if (post.expense.visibility !== "public" || !post.expense.expiresAt) {
    return null;
  }

  const expiresAt = new Date(post.expense.expiresAt).getTime();
  if (Number.isNaN(expiresAt)) {
    return null;
  }

  const remainingMinutes = Math.max(0, Math.floor((expiresAt - Date.now()) / 60000));
  if (remainingMinutes < 60) {
    return `${remainingMinutes} 分鐘後自動隱藏`;
  }

  const remainingHours = Math.floor(remainingMinutes / 60);
  return `${remainingHours} 小時後自動隱藏`;
}

export default function Feed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [activePost, setActivePost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [likingPostId, setLikingPostId] = useState<string | null>(null);
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsubscribe = watchFriendConnections(user.uid, () => {
      setRefreshTick((value) => value + 1);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPosts([]);
      setIsLoading(false);
      return;
    }

    let active = true;

    const load = async () => {
      setIsLoading(true);

      try {
        const nextPosts = await loadFeedPosts(user);

        if (active) {
          setPosts(nextPosts);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "動態載入失敗。";
        toast.error(message);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [user, refreshTick]);

  useEffect(() => {
    if (!activePost) {
      setComments([]);
      return undefined;
    }

    const unsubscribe = watchFeedComments(activePost.authorUid, activePost.expense.id, setComments);
    return unsubscribe;
  }, [activePost?.authorUid, activePost?.expense.id]);

  const visibleCount = useMemo(() => posts.length, [posts]);

  const handleToggleLike = async (post: FeedPost) => {
    if (!user) {
      return;
    }

    setLikingPostId(post.expense.id);
    try {
      const result = await toggleFeedLike({ viewer: user, post });

      setPosts((current) => current.map((item) => (
        item.expense.id === post.expense.id && item.authorUid === post.authorUid
          ? {
              ...item,
              likedByViewer: result.liked,
              expense: {
                ...item.expense,
                likeCount: result.likeCount,
              },
            }
          : item
      )));

      if (activePost?.expense.id === post.expense.id && activePost.authorUid === post.authorUid) {
        setActivePost((current) => (current ? {
          ...current,
          likedByViewer: result.liked,
          expense: {
            ...current.expense,
            likeCount: result.likeCount,
          },
        } : current));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "無法處理按讚。";
      toast.error(message);
    } finally {
      setLikingPostId(null);
    }
  };

  const handleOpenComments = (post: FeedPost) => {
    setActivePost(post);
    setCommentText("");
  };

  const handleCloseComments = () => {
    setActivePost(null);
    setCommentText("");
    setComments([]);
  };

  const handleSubmitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || !activePost) {
      return;
    }

    const trimmed = commentText.trim();
    if (!trimmed) {
      toast.error("請輸入留言內容。");
      return;
    }

    setSendingComment(true);
    try {
      const created = await addFeedComment({ viewer: user, post: activePost, text: trimmed });
      setCommentText("");
      setComments((current) => [...current, created]);
      setPosts((current) => current.map((item) => (
        item.expense.id === activePost.expense.id && item.authorUid === activePost.authorUid
          ? {
              ...item,
              expense: {
                ...item.expense,
                commentCount: (item.expense.commentCount ?? 0) + 1,
              },
            }
          : item
      )));

      toast.success(activePost.authorUid === user.uid ? "留言已送出" : "留言已送出，對方會收到通知");
    } catch (error) {
      const message = error instanceof Error ? error.message : "留言失敗，請再試一次。";
      toast.error(message);
    } finally {
      setSendingComment(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-5 pt-10 pb-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground mb-2">Social Feed</p>
          <h1 className="text-2xl font-bold">好友動態</h1>
          <p className="text-sm text-muted-foreground mt-1">只顯示好友與你自己的公開 / 好友記帳紀錄</p>
        </div>
        <div className="rounded-2xl bg-card shadow-card px-4 py-3 text-right">
          <p className="text-xs text-muted-foreground">可見貼文</p>
          <p className="text-xl font-bold">{visibleCount}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="bg-card rounded-2xl p-4 shadow-card animate-pulse">
              <div className="h-10 w-48 rounded bg-muted mb-4" />
              <div className="h-20 rounded bg-muted mb-4" />
              <div className="h-8 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">暫時沒有動態</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            先去好友列表加一些人，或等好友把記帳屬性設成「好友」或「公開」。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post, index) => (
            <motion.article
              key={`${post.authorUid}-${post.expense.id}`}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              className="bg-card rounded-3xl p-4 shadow-card border border-border/70"
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  {post.authorPicture ? (
                    <button type="button" onClick={() => navigate(`/profile/${post.authorUid}`)} className="h-11 w-11 rounded-full overflow-hidden">
                      <img
                        src={post.authorPicture}
                        alt={post.authorName}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(`/profile/${post.authorUid}`)}
                      className="flex h-11 w-11 items-center justify-center rounded-full gradient-warm text-lg"
                    >
                      {post.isSelf ? <User className="h-5 w-5 text-primary-foreground" /> : "👤"}
                    </button>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{post.authorName}</p>
                      {post.authorOverBudget && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                          已超支
                        </span>
                      )}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {post.expense.visibility === "public" ? "公開" : "好友"}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{post.authorFriendId}</p>
                  </div>
                </div>
                <div className="text-right text-[10px] text-muted-foreground">
                  <div className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatRelativeTime(post.expense.createdAt)}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-muted/30 p-4 mb-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-full bg-background px-3 py-1 text-xs font-medium">{post.expense.category}</span>
                    <span className="rounded-full bg-background px-3 py-1 text-xs font-medium">{post.expense.transactionType === "expense" ? "支出" : "收入"}</span>
                  </div>
                  <p className={`text-lg font-bold ${post.expense.transactionType === "income" ? "text-success" : "text-destructive"}`}>
                    {post.expense.transactionType === "income" ? "+" : "-"}{formatMoney(post.expense.amount)}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{post.expense.secretNote || "沒有附加備註"}</p>
                {post.expense.photoUrl && (
                  <div className="mt-3 overflow-hidden rounded-2xl">
                    <ImagePreview
                      src={post.expense.photoUrl}
                      alt="記帳照片"
                      triggerClassName="block w-full"
                      imageClassName="h-48 w-full rounded-2xl object-cover"
                      previewClassName="max-h-[70vh] w-full object-contain"
                      title={`${post.authorName} 的記帳照片`}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => handleToggleLike(post)}
                  disabled={likingPostId === post.expense.id}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition-colors ${post.likedByViewer ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  <Heart className={`h-4 w-4 ${post.likedByViewer ? "fill-current" : ""}`} />
                  {post.expense.likeCount ?? 0}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenComments(post)}
                  className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80"
                >
                  <MessageCircle className="h-4 w-4" />
                  {post.expense.commentCount ?? 0}
                </button>
                <div className="ml-auto text-[10px] text-muted-foreground">
                  {getPostExpiryLabel(post)}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      <Sheet open={Boolean(activePost)} onOpenChange={(open) => (open ? undefined : handleCloseComments())}>
        <SheetContent side="bottom" className="h-[82vh] rounded-t-[2rem] border-t border-border p-0">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-border px-5 pb-4 pt-5 text-left">
              <SheetTitle>留言</SheetTitle>
              <SheetDescription>{activePost ? `${activePost.authorName} · ${activePost.expense.category}` : ""}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {comments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-center text-sm text-muted-foreground">
                  尚無留言
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-3 rounded-2xl bg-muted/20 p-3">
                    {comment.userPicture ? (
                      <button type="button" onClick={() => navigate(`/profile/${comment.userId}`)} className="h-9 w-9 rounded-full overflow-hidden">
                        <img src={comment.userPicture} alt={comment.userName} className="h-full w-full object-cover" />
                      </button>
                    ) : (
                      <button type="button" onClick={() => navigate(`/profile/${comment.userId}`)} className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-sm">{comment.userName.slice(0, 1)}</button>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{comment.userName}</p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatRelativeTime(comment.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap break-words">{comment.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSubmitComment} className="border-t border-border p-4 px-5">
              <div className="flex items-end gap-2 rounded-2xl border border-input bg-background p-3 shadow-sm">
                <Textarea
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="輸入留言..."
                  rows={2}
                  className="min-h-[48px] flex-1 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button type="submit" size="sm" disabled={sendingComment || !commentText.trim()}>
                  <Send className="h-4 w-4" />
                  送出
                </Button>
              </div>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}