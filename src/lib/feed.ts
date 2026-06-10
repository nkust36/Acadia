import { collection, deleteDoc, doc, getDoc, increment, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";
import { listExpenses, type ExpenseRecord } from "@/lib/expenses";
import { createUserNotification, getUserProfileByUid, listFriendConnections, type UserProfile } from "@/lib/social";
import { buildBudgetSnapshot } from "@/lib/budget";
import { stripUndefined } from "@/lib/firestore";

const COMMENTS_SUBCOLLECTION = "comments";
const LIKES_SUBCOLLECTION = "likes";

export type FeedComment = {
  id: string;
  userId: string;
  userName: string;
  userPicture?: string;
  text: string;
  createdAt: string;
};

export type FeedCommentUser = {
  name: string;
  picture?: string;
};

export type FeedPost = {
  expense: ExpenseRecord;
  authorUid: string;
  authorName: string;
  authorFriendId: string;
  authorPicture?: string;
  isSelf: boolean;
  isFriend: boolean;
  likedByViewer: boolean;
  authorOverBudget: boolean;
};

type FeedAuthor = {
  uid: string;
  friendId: string;
  name: string;
  picture?: string;
};

type FeedViewer = Pick<UserProfile, "uid" | "friendId" | "name" | "picture">;

type FeedCommentTargetPost = {
  expense: Pick<ExpenseRecord, "id" | "userId" | "category" | "amount">;
  authorFriendId: string;
  authorName: string;
  authorPicture?: string;
};

function parseTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getExpiresAt(expense: ExpenseRecord) {
  if (expense.expiresAt) {
    return expense.expiresAt;
  }

  if (expense.visibility !== "public") {
    return undefined;
  }

  return new Date(parseTime(expense.createdAt) + 12 * 60 * 60 * 1000).toISOString();
}

function isExpiredPublicPost(expense: ExpenseRecord) {
  if (expense.visibility !== "public") {
    return false;
  }

  const expiresAt = getExpiresAt(expense);
  if (!expiresAt) {
    return false;
  }

  return parseTime(expiresAt) <= Date.now();
}

function isVisibleInFeed(expense: ExpenseRecord) {
  return expense.visibility === "friends" || expense.visibility === "public";
}

function mapComment(id: string, data: Record<string, unknown>): FeedComment {
  return {
    id,
    userId: typeof data.userId === "string" ? data.userId : "",
    userName: typeof data.userName === "string" ? data.userName : "匿名留言者",
    userPicture: typeof data.userPicture === "string" ? data.userPicture : undefined,
    text: typeof data.text === "string" ? data.text : "",
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
  };
}

function buildPost(expense: ExpenseRecord, author: FeedAuthor, viewerUid: string, likedByViewer: boolean, authorOverBudget: boolean): FeedPost {
  const isSelf = author.uid === viewerUid;
  return {
    expense: {
      ...expense,
      expiresAt: getExpiresAt(expense),
    },
    authorUid: author.uid,
    authorName: author.name,
    authorFriendId: author.friendId,
    authorPicture: author.picture,
    isSelf,
    isFriend: !isSelf,
    likedByViewer,
    authorOverBudget,
  };
}

export async function loadFeedPosts(viewer: FeedViewer): Promise<FeedPost[]> {
  const friends = await listFriendConnections(viewer.uid);
  const authors: FeedAuthor[] = [
    {
      uid: viewer.uid,
      friendId: viewer.friendId,
      name: viewer.name,
      picture: viewer.picture,
    },
    ...friends.map((friend) => ({
      uid: friend.friendUid,
      friendId: friend.friendId,
      name: friend.friendName,
      picture: friend.friendPicture,
    })),
  ];

  const fetched = await Promise.all(
    authors.map(async (author) => {
      const [profile, items] = await Promise.all([getUserProfileByUid(author.uid), listExpenses(author.uid)]);
      const budgetSnapshot = buildBudgetSnapshot(profile, items);
      const visibleItems = items.filter(isVisibleInFeed).filter((expense) => !isExpiredPublicPost(expense) || author.uid === viewer.uid);

      return visibleItems.map(async (expense) => {
        const likeSnapshot = await getDoc(doc(firebaseDb, "expenses", author.uid, "items", expense.id, LIKES_SUBCOLLECTION, viewer.uid));
        return buildPost(expense, author, viewer.uid, likeSnapshot.exists(), budgetSnapshot.isOverBudget);
      });
    }),
  );

  const resolved = await Promise.all(fetched.flat());
  return resolved.sort((left, right) => parseTime(right.expense.createdAt) - parseTime(left.expense.createdAt));
}

export function watchFeedComments(ownerUid: string, expenseId: string, onChange: (comments: FeedComment[]) => void) {
  const commentsRef = collection(firebaseDb, "expenses", ownerUid, "items", expenseId, COMMENTS_SUBCOLLECTION);
  const commentsQuery = query(commentsRef, orderBy("createdAt", "asc"));

  return onSnapshot(commentsQuery, (snapshot) => {
    onChange(snapshot.docs.map((entry) => mapComment(entry.id, entry.data())));
  });
}

export async function loadFeedCommentUsers(comments: FeedComment[]) {
  const userIds = Array.from(new Set(comments.map((comment) => comment.userId).filter(Boolean)));
  const entries = await Promise.all(userIds.map(async (userId) => {
    try {
      const profile = await getUserProfileByUid(userId);
      return [userId, {
        name: profile?.name,
        picture: profile?.picture,
      }] as const;
    } catch {
      return [userId, {}] as const;
    }
  }));

  return entries.reduce<Record<string, FeedCommentUser>>((result, [userId, profile]) => {
    const hasName = typeof profile.name === "string" && profile.name.trim().length > 0;
    const hasPicture = typeof profile.picture === "string" && profile.picture.length > 0;

    if (hasName || hasPicture) {
      result[userId] = {
        name: hasName ? profile.name : "匿名留言者",
        picture: hasPicture ? profile.picture : undefined,
      };
    }

    return result;
  }, {});
}

export async function toggleFeedLike(input: { viewer: FeedViewer; post: FeedPost }) {
  const expenseRef = doc(firebaseDb, "expenses", input.post.expense.userId, "items", input.post.expense.id);
  const likeRef = doc(firebaseDb, "expenses", input.post.expense.userId, "items", input.post.expense.id, LIKES_SUBCOLLECTION, input.viewer.uid);
  const existing = await getDoc(likeRef);
  const now = new Date().toISOString();

  if (existing.exists()) {
    await deleteDoc(likeRef);
    await updateDoc(expenseRef, { likeCount: increment(-1) });
    return { liked: false, likeCount: Math.max(0, (input.post.expense.likeCount ?? 0) - 1) };
  }

  await setDoc(likeRef, stripUndefined({
    userId: input.viewer.uid,
    userName: input.viewer.name,
    userPicture: input.viewer.picture,
    createdAt: now,
  }));

  await updateDoc(expenseRef, { likeCount: increment(1) });

  if (input.viewer.uid !== input.post.expense.userId) {
    await createUserNotification(input.post.expense.userId, {
      requestId: `${input.post.expense.userId}_${input.post.expense.id}_like_${input.viewer.uid}`,
      type: "feed_like",
      status: "info",
      read: false,
      title: `${input.viewer.name} 讚了你的記帳`,
      body: `${input.post.expense.category} · ${input.post.expense.amount.toLocaleString()}`,
      fromUserId: input.viewer.uid,
      fromFriendId: input.viewer.friendId,
      fromName: input.viewer.name,
      fromPicture: input.viewer.picture,
      toUserId: input.post.expense.userId,
      toFriendId: input.post.authorFriendId,
      toName: input.post.authorName,
      toPicture: input.post.authorPicture,
      createdAt: now,
    });
  }

  return { liked: true, likeCount: (input.post.expense.likeCount ?? 0) + 1 };
}

export async function addFeedComment(input: { viewer: FeedViewer; post: FeedCommentTargetPost; text: string }) {
  const message = input.text.trim();

  if (!message) {
    throw new Error("請輸入留言內容。");
  }

  const commentsRef = collection(firebaseDb, "expenses", input.post.expense.userId, "items", input.post.expense.id, COMMENTS_SUBCOLLECTION);
  const expenseRef = doc(firebaseDb, "expenses", input.post.expense.userId, "items", input.post.expense.id);
  const commentRef = doc(commentsRef);
  const createdAt = new Date().toISOString();

  await setDoc(commentRef, stripUndefined({
    userId: input.viewer.uid,
    userName: input.viewer.name,
    userPicture: input.viewer.picture,
    text: message,
    createdAt,
  }));

  await updateDoc(expenseRef, { commentCount: increment(1) });

  if (input.viewer.uid !== input.post.expense.userId) {
    await createUserNotification(input.post.expense.userId, {
      requestId: `${input.post.expense.userId}_${input.post.expense.id}_comment_${commentRef.id}`,
      type: "feed_comment",
      status: "info",
      read: false,
      title: `${input.viewer.name} 留言了你的記帳`,
      body: message,
      fromUserId: input.viewer.uid,
      fromFriendId: input.viewer.friendId,
      fromName: input.viewer.name,
      fromPicture: input.viewer.picture,
      toUserId: input.post.expense.userId,
      toFriendId: input.post.authorFriendId,
      toName: input.post.authorName,
      toPicture: input.post.authorPicture,
      createdAt,
    });
  }

  return {
    id: commentRef.id,
    userId: input.viewer.uid,
    userName: input.viewer.name,
    userPicture: input.viewer.picture,
    text: message,
    createdAt,
  } satisfies FeedComment;
}

