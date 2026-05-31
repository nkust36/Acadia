import { motion } from "framer-motion";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Clock, MessageCircle, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { ImagePreview } from "@/components/ImagePreview";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { addFeedComment, watchFeedComments, type FeedComment } from "@/lib/feed";
import { loadPlazaPosts, votePlazaPost, type PlazaPost } from "@/lib/plaza";

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

  return `${Math.floor(diffHours / 24)} 天前`;
}

function getRankingLabel(post: PlazaPost) {
  if (post.score >= 20) {
    return "爆紅";
  }

  if (post.score >= 10) {
    return "熱門";
  }

  if (post.score > 0) {
    return "上升中";
  }

  if (post.score === 0) {
    return "平盤";
  }

  return "下沉中";
}

export default function Plaza() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PlazaPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [votingPostId, setVotingPostId] = useState<string | null>(null);
  const [activePost, setActivePost] = useState<PlazaPost | null>(null);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

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
        const nextPosts = await loadPlazaPosts(user);

        if (active) {
          setPosts(nextPosts);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "廣場載入失敗。";
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
  }, [user]);

  const visibleCount = useMemo(() => posts.length, [posts]);

  useEffect(() => {
    if (!activePost) {
      setComments([]);
      return undefined;
    }

    const unsubscribe = watchFeedComments(activePost.authorUid, activePost.expense.id, setComments);
    return unsubscribe;
  }, [activePost?.authorUid, activePost?.expense.id]);

  const handleOpenComments = (post: PlazaPost) => {
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
      setPosts((current) =>
        current.map((item) =>
          item.authorUid === activePost.authorUid && item.expense.id === activePost.expense.id
            ? {
                ...item,
                expense: {
                  ...item.expense,
                  commentCount: (item.expense.commentCount ?? 0) + 1,
                },
              }
            : item,
        ),
      );
      toast.success(activePost.authorUid === user.uid ? "留言已送出" : "留言已送出，對方會收到通知");
    } catch (error) {
      const message = error instanceof Error ? error.message : "留言失敗，請再試一次。";
      toast.error(message);
    } finally {
      setSendingComment(false);
    }
  };

  const handleVote = async (post: PlazaPost, vote: -1 | 1) => {
    if (!user) {
      return;
    }

    setVotingPostId(post.expense.id);
    try {
      const result = await votePlazaPost({ viewer: user, post, vote });

      setPosts((current) =>
        current
          .map((item) =>
            item.authorUid === post.authorUid && item.expense.id === post.expense.id
              ? {
                  ...item,
                  viewerVote: result.viewerVote,
                  upvoteCount: result.upvoteCount,
                  downvoteCount: result.downvoteCount,
                  score: result.score,
                }
              : item,
          )
          .sort(
            (left, right) =>
              right.score - left.score ||
              new Date(right.expense.createdAt).getTime() - new Date(left.expense.createdAt).getTime(),
          ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "無法送出投票。";
      toast.error(message);
    } finally {
      setVotingPostId(null);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-5 pt-10 pb-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground mb-2">Global Plaza</p>
          <h1 className="text-2xl font-bold">全球消費廣場</h1>
          <p className="text-sm text-muted-foreground mt-1">所有公開貼文都會出現在這裡，依投票分數排序。</p>
        </div>
        <div className="rounded-2xl bg-card shadow-card px-4 py-3 text-right">
          <p className="text-xs text-muted-foreground">公開貼文</p>
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
          <h2 className="text-lg font-semibold">暫時沒有公開貼文</h2>
          <p className="mt-2 text-sm text-muted-foreground">等有人發公開記帳，這裡就會出現並依票數重新排序。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post, index) => {
            const isUpvoted = post.viewerVote === 1;
            const isDownvoted = post.viewerVote === -1;

            return (
              <motion.div
                key={`${post.authorUid}-${post.expense.id}`}
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.06 * index }}
                className="bg-card rounded-2xl p-4 shadow-card border border-border/70"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-10 w-10 rounded-full gradient-warm flex items-center justify-center overflow-hidden shrink-0">
                      {post.authorPicture ? (
                        <img src={post.authorPicture} alt={post.authorName} className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-primary-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">{post.authorName}</p>
                        {post.isSelf && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">你自己</span>}
                        <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-medium">
                          {getRankingLabel(post)}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{post.authorFriendId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px]">{formatRelativeTime(post.expense.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{post.expense.category}</span>
                  <span className="font-bold text-sm text-destructive">
                    {post.expense.transactionType === "income" ? "+" : "-"}
                    {formatMoney(post.expense.amount)}
                  </span>
                </div>

                <p className="text-sm mb-3 text-muted-foreground whitespace-pre-wrap break-words">
                  {post.expense.secretNote || "沒有附加備註"}
                </p>

                {post.expense.photoUrl && (
                  <div className="mb-3 overflow-hidden rounded-2xl">
                    <ImagePreview
                      src={post.expense.photoUrl}
                      alt="廣場貼文圖片"
                      triggerClassName="block w-full"
                      imageClassName="h-48 w-full object-cover"
                      previewClassName="max-h-[70vh] w-full object-contain"
                      title={`${post.authorName} 的廣場貼文`}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      variant={isUpvoted ? "default" : "outline"}
                      onClick={() => handleVote(post, 1)}
                      disabled={votingPostId === post.expense.id}
                    >
                      <ArrowUp className="w-4 h-4" />
                      {post.upvoteCount}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={isDownvoted ? "destructive" : "outline"}
                      onClick={() => handleVote(post, -1)}
                      disabled={votingPostId === post.expense.id}
                    >
                      <ArrowDown className="w-4 h-4" />
                      {post.downvoteCount}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => handleOpenComments(post)}>
                      <MessageCircle className="w-4 h-4" />
                      {post.expense.commentCount ?? 0}
                    </Button>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">熱度</p>
                    <p className={`text-sm font-bold ${post.score >= 0 ? "text-success" : "text-destructive"}`}>
                      {post.score >= 0 ? "+" : ""}
                      {post.score}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
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
                      <img src={comment.userPicture} alt={comment.userName} className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-sm">
                        {comment.userName.slice(0, 1)}
                      </div>
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
