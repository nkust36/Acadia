import { collectionGroup, deleteDoc, doc, getDoc, getDocs, increment, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";
import { deleteExpense, listExpenses, mapExpenseDoc, type ExpenseRecord } from "@/lib/expenses";
import { getUserProfileByUid, type UserProfile } from "@/lib/social";
import { stripUndefined } from "@/lib/firestore";

const PLAZA_VOTES_SUBCOLLECTION = "plazaVotes";

export type PlazaPost = {
  expense: ExpenseRecord;
  authorUid: string;
  authorName: string;
  authorFriendId: string;
  authorPicture?: string;
  viewerVote: -1 | 0 | 1;
  isSelf: boolean;
  upvoteCount: number;
  downvoteCount: number;
  score: number;
};

type PlazaAuthor = {
  uid: string;
  friendId: string;
  name: string;
  picture?: string;
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

function isExpired(expense: ExpenseRecord) {
  const expiresAt = getExpiresAt(expense);
  if (!expiresAt) {
    return false;
  }

  return parseTime(expiresAt) <= Date.now();
}

function mapAuthor(profile: UserProfile | null, fallbackUid: string): PlazaAuthor {
  return {
    uid: profile?.uid ?? fallbackUid,
    friendId: profile?.friendId ?? `ACD-${fallbackUid.slice(0, 8).toUpperCase()}`,
    name: profile?.name ?? "匿名旅者",
    picture: profile?.picture,
  };
}

function sortPlazaPosts(left: PlazaPost, right: PlazaPost) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return parseTime(right.expense.createdAt) - parseTime(left.expense.createdAt);
}

export async function loadPlazaPosts(viewer: UserProfile): Promise<PlazaPost[]> {
  const snapshot = await getDocs(collectionGroup(firebaseDb, "items"));
  const expenseDocs = snapshot.docs.filter((entry) => entry.ref.parent.parent?.parent?.id === "expenses");
  const expenses = expenseDocs.map((entry) => mapExpenseDoc(entry.id, entry.data())).filter((expense) => expense.visibility === "public" && !isExpired(expense));

  const authorIds = [...new Set(expenses.map((expense) => expense.userId).filter(Boolean))];
  const authors = await Promise.all(authorIds.map(async (uid) => [uid, await getUserProfileByUid(uid)] as const));
  const authorMap = new Map<string, PlazaAuthor>(authors.map(([uid, profile]) => [uid, mapAuthor(profile, uid)]));

  const posts = await Promise.all(expenses.map(async (expense) => {
    const author = authorMap.get(expense.userId) ?? mapAuthor(null, expense.userId);
    const voteSnapshot = await getDoc(doc(firebaseDb, "expenses", expense.userId, "items", expense.id, PLAZA_VOTES_SUBCOLLECTION, viewer.uid));
    const viewerVote = voteSnapshot.exists() ? Number(voteSnapshot.data().value) : 0;
    const upvoteCount = Math.max(0, expense.upvoteCount ?? 0);
    const downvoteCount = Math.max(0, expense.downvoteCount ?? 0);
    const score = typeof expense.plazaScore === "number" ? expense.plazaScore : upvoteCount - downvoteCount;

    return {
      expense: {
        ...expense,
        expiresAt: getExpiresAt(expense),
      },
      authorUid: author.uid,
      authorName: author.name,
      authorFriendId: author.friendId,
      authorPicture: author.picture,
      viewerVote: viewerVote === -1 ? -1 : viewerVote === 1 ? 1 : 0,
      isSelf: author.uid === viewer.uid,
      upvoteCount,
      downvoteCount,
      score,
    } satisfies PlazaPost;
  }));

  return posts.sort(sortPlazaPosts);
}

export async function votePlazaPost(input: { viewer: UserProfile; post: PlazaPost; vote: -1 | 1 }) {
  const expenseRef = doc(firebaseDb, "expenses", input.post.expense.userId, "items", input.post.expense.id);
  const voteRef = doc(firebaseDb, "expenses", input.post.expense.userId, "items", input.post.expense.id, PLAZA_VOTES_SUBCOLLECTION, input.viewer.uid);
  const currentVote = input.post.viewerVote;
  const desiredVote = currentVote === input.vote ? 0 : input.vote;
  const next = {
    upvoteCount: input.post.upvoteCount,
    downvoteCount: input.post.downvoteCount,
    score: input.post.score,
  };

  if (currentVote === 1) {
    next.upvoteCount -= 1;
    next.score -= 1;
  }

  if (currentVote === -1) {
    next.downvoteCount -= 1;
    next.score += 1;
  }

  if (desiredVote === 1) {
    next.upvoteCount += 1;
    next.score += 1;
  }

  if (desiredVote === -1) {
    next.downvoteCount += 1;
    next.score -= 1;
  }

  await updateDoc(expenseRef, stripUndefined({
    upvoteCount: Math.max(0, next.upvoteCount),
    downvoteCount: Math.max(0, next.downvoteCount),
    plazaScore: next.score,
  }));

  if (desiredVote === 0) {
    await deleteDoc(voteRef);
  } else {
    await setDoc(voteRef, {
      userId: input.viewer.uid,
      value: desiredVote,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    viewerVote: desiredVote,
    upvoteCount: Math.max(0, next.upvoteCount),
    downvoteCount: Math.max(0, next.downvoteCount),
    score: next.score,
  };
}

export async function purgeExpiredPublicPostsForViewer(viewer: UserProfile) {
  const items = await listExpenses(viewer.uid);
  const expiredItems = items.filter((expense) => expense.visibility === "public" && isExpired(expense));
  await Promise.all(expiredItems.map((expense) => deleteExpense(viewer.uid, expense.id)));
}
