import { User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore";
import { deleteDoc } from "firebase/firestore";

const USERS_COLLECTION = "users";
const FRIEND_REQUESTS_COLLECTION = "friendRequests";
const FRIENDS_COLLECTION = "friends";
const NOTIFICATIONS_COLLECTION = "notifications";

export type UserGender = "male" | "female" | "other" | "prefer_not_to_say";

export type ProfilePrivacySettings = {
  hideFriendIdFromOthers: boolean;
  hideBudgetStatusFromOthers: boolean;
  hidePieChartFromOthers: boolean;
  hideDailyAverageFromOthers: boolean;
};

export type UserProfile = {
  uid: string;
  friendId: string;
  name: string;
  email: string;
  picture?: string;
  provider: "google" | "email";
  createdAt: string;
  updatedAt: string;
  nameUpdatedAt?: string;
  gender?: UserGender;
  age?: number;
  hideFriendIdFromOthers: boolean;
  hideBudgetStatusFromOthers: boolean;
  hidePieChartFromOthers: boolean;
  hideDailyAverageFromOthers: boolean;
  monthlyBudgetAmount?: number;
  monthlyBudgetMonthKey?: string;
  budgetAlertMonthKey?: string;
};

export type FriendConnection = {
  id: string;
  friendUid: string;
  friendId: string;
  friendName: string;
  friendPicture?: string;
  createdAt: string;
};

export type FriendRequestStatus = "pending" | "accepted" | "rejected";

export type FriendRequest = {
  id: string;
  requestId: string;
  fromUserId: string;
  fromFriendId: string;
  fromName: string;
  fromPicture?: string;
  toUserId: string;
  toFriendId: string;
  toName: string;
  toPicture?: string;
  status: FriendRequestStatus;
  createdAt: string;
  updatedAt: string;
  respondedAt?: string;
};

export type FriendNotification = {
  id: string;
  requestId: string;
  type: "friend_request" | "friend_response" | "feed_like" | "feed_comment" | "budget_alert" | "direct_message";
  status: FriendRequestStatus | "info";
  read: boolean;
  title: string;
  body: string;
  fromUserId: string;
  fromFriendId: string;
  fromName: string;
  fromPicture?: string;
  toUserId: string;
  toFriendId: string;
  toName: string;
  toPicture?: string;
  createdAt: string;
  respondedAt?: string;
};

export type FriendRequestResponse = "accepted" | "rejected";

function normalizeFriendId(value: string) {
  return value.trim().toUpperCase();
}

function generateFriendId() {
  return `ACD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function mapUserProfile(id: string, data: Record<string, unknown>): UserProfile {
  return {
    uid: id,
    friendId: readString(data.friendId, `ACD-${id.slice(0, 8).toUpperCase()}`),
    name: readString(data.name, "匿名旅者"),
    email: readString(data.email),
    picture: typeof data.picture === "string" ? data.picture : undefined,
    provider: data.provider === "google" ? "google" : "email",
    createdAt: readString(data.createdAt, new Date().toISOString()),
    updatedAt: readString(data.updatedAt, new Date().toISOString()),
    nameUpdatedAt: typeof data.nameUpdatedAt === "string" ? data.nameUpdatedAt : undefined,
    gender:
      data.gender === "male" || data.gender === "female" || data.gender === "other" || data.gender === "prefer_not_to_say"
        ? data.gender
        : undefined,
    age: typeof data.age === "number" ? data.age : undefined,
    hideFriendIdFromOthers: Boolean(data.hideFriendIdFromOthers),
    hideBudgetStatusFromOthers: Boolean(data.hideBudgetStatusFromOthers),
    hidePieChartFromOthers: Boolean(data.hidePieChartFromOthers),
    hideDailyAverageFromOthers: Boolean(data.hideDailyAverageFromOthers),
    monthlyBudgetAmount: typeof data.monthlyBudgetAmount === "number" ? data.monthlyBudgetAmount : undefined,
    monthlyBudgetMonthKey: typeof data.monthlyBudgetMonthKey === "string" ? data.monthlyBudgetMonthKey : undefined,
    budgetAlertMonthKey: typeof data.budgetAlertMonthKey === "string" ? data.budgetAlertMonthKey : undefined,
  };
}

function mapFriendConnection(id: string, data: Record<string, unknown>): FriendConnection {
  return {
    id,
    friendUid: readString(data.friendUid),
    friendId: readString(data.friendId),
    friendName: readString(data.friendName, "匿名好友"),
    friendPicture: typeof data.friendPicture === "string" ? data.friendPicture : undefined,
    createdAt: readString(data.createdAt, new Date().toISOString()),
  };
}

function mapFriendRequest(id: string, data: Record<string, unknown>): FriendRequest {
  const status = data.status === "accepted" || data.status === "rejected" ? data.status : "pending";

  return {
    id,
    requestId: readString(data.requestId, id),
    fromUserId: readString(data.fromUserId),
    fromFriendId: readString(data.fromFriendId),
    fromName: readString(data.fromName, "匿名好友"),
    fromPicture: typeof data.fromPicture === "string" ? data.fromPicture : undefined,
    toUserId: readString(data.toUserId),
    toFriendId: readString(data.toFriendId),
    toName: readString(data.toName, "匿名好友"),
    toPicture: typeof data.toPicture === "string" ? data.toPicture : undefined,
    status,
    createdAt: readString(data.createdAt, new Date().toISOString()),
    updatedAt: readString(data.updatedAt, new Date().toISOString()),
    respondedAt: typeof data.respondedAt === "string" ? data.respondedAt : undefined,
  };
}

function mapFriendNotification(id: string, data: Record<string, unknown>): FriendNotification {
  const status = data.status === "accepted" || data.status === "rejected" || data.status === "info"
    ? data.status
    : "pending";
  const type = data.type === "friend_response" || data.type === "feed_like" || data.type === "feed_comment" || data.type === "budget_alert" || data.type === "direct_message"
    ? data.type
    : "friend_request";

  return {
    id,
    requestId: readString(data.requestId, id),
    type,
    status,
    read: Boolean(data.read),
    title: readString(data.title, "好友通知"),
    body: readString(data.body, ""),
    fromUserId: readString(data.fromUserId),
    fromFriendId: readString(data.fromFriendId),
    fromName: readString(data.fromName, "匿名好友"),
    fromPicture: typeof data.fromPicture === "string" ? data.fromPicture : undefined,
    toUserId: readString(data.toUserId),
    toFriendId: readString(data.toFriendId),
    toName: readString(data.toName, "匿名好友"),
    toPicture: typeof data.toPicture === "string" ? data.toPicture : undefined,
    createdAt: readString(data.createdAt, new Date().toISOString()),
    respondedAt: typeof data.respondedAt === "string" ? data.respondedAt : undefined,
  };
}

async function generateUniqueFriendId() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateFriendId();
    const snapshot = await getDocs(
      query(collection(firebaseDb, USERS_COLLECTION), where("friendId", "==", candidate), limit(1)),
    );

    if (snapshot.empty) {
      return candidate;
    }
  }

  return `${generateFriendId()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export async function createUserNotification(userId: string, payload: Omit<FriendNotification, "id">) {
  await addDoc(collection(firebaseDb, NOTIFICATIONS_COLLECTION, userId, "items"), stripUndefined(payload));
}

export async function updateUserProfileFields(userId: string, updates: Record<string, unknown>) {
  await updateDoc(doc(firebaseDb, USERS_COLLECTION, userId), stripUndefined({
    ...updates,
    updatedAt: new Date().toISOString(),
  }));
}

export function profileToAuthUser(profile: UserProfile) {
  return {
    uid: profile.uid,
    id: profile.uid,
    friendId: profile.friendId,
    name: profile.name,
    email: profile.email,
    picture: profile.picture,
    emailVerified: profile.provider === "google",
    provider: profile.provider,
  };
}

export async function ensureUserProfile(firebaseUser: User): Promise<UserProfile> {
  const profileRef = doc(firebaseDb, USERS_COLLECTION, firebaseUser.uid);
  const snapshot = await getDoc(profileRef);
  const timestamp = new Date().toISOString();

  if (snapshot.exists()) {
    const current = mapUserProfile(snapshot.id, snapshot.data());
    const next = stripUndefined({
      ...current,
      name: firebaseUser.displayName || current.name,
      email: firebaseUser.email || current.email,
      picture: firebaseUser.photoURL || current.picture,
      provider: firebaseUser.providerData[0]?.providerId === "google.com" ? "google" : current.provider,
      updatedAt: timestamp,
    });

    await setDoc(profileRef, next, { merge: true });
    return mapUserProfile(snapshot.id, next);
  }

  const friendId = await generateUniqueFriendId();
  const profile = stripUndefined({
    uid: firebaseUser.uid,
    friendId,
    name: firebaseUser.displayName || firebaseUser.email || "匿名旅者",
    email: firebaseUser.email || "",
    picture: firebaseUser.photoURL || undefined,
    provider: firebaseUser.providerData[0]?.providerId === "google.com" ? "google" : "email",
    createdAt: timestamp,
    updatedAt: timestamp,
    nameUpdatedAt: timestamp,
    hideFriendIdFromOthers: false,
    hideBudgetStatusFromOthers: false,
    hidePieChartFromOthers: false,
    hideDailyAverageFromOthers: false,
  });

  await setDoc(profileRef, profile);
  return mapUserProfile(firebaseUser.uid, profile);
}

export async function findUserByFriendId(friendId: string): Promise<UserProfile | null> {
  const normalized = normalizeFriendId(friendId);

  if (!normalized) {
    return null;
  }

  const snapshot = await getDocs(
    query(collection(firebaseDb, USERS_COLLECTION), where("friendId", "==", normalized), limit(1)),
  );

  if (snapshot.empty) {
    return null;
  }

  return mapUserProfile(snapshot.docs[0].id, snapshot.docs[0].data());
}

export async function getUserProfileByUid(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(firebaseDb, USERS_COLLECTION, uid));

  if (!snapshot.exists()) {
    return null;
  }

  return mapUserProfile(snapshot.id, snapshot.data());
}

export function watchFriendConnections(userId: string, onChange: (items: FriendConnection[]) => void) {
  const connectionsRef = collection(firebaseDb, FRIENDS_COLLECTION, userId, "items");
  const connectionsQuery = query(connectionsRef, orderBy("createdAt", "desc"));

  return onSnapshot(connectionsQuery, (snapshot) => {
    onChange(snapshot.docs.map((entry) => mapFriendConnection(entry.id, entry.data())));
  });
}

export async function listFriendConnections(userId: string): Promise<FriendConnection[]> {
  const connectionsRef = collection(firebaseDb, FRIENDS_COLLECTION, userId, "items");
  const snapshot = await getDocs(query(connectionsRef, orderBy("createdAt", "desc")));
  return snapshot.docs.map((entry) => mapFriendConnection(entry.id, entry.data()));
}

export async function deleteFriendConnection(userId: string, friendUid: string) {
  await Promise.all([
    deleteDoc(doc(firebaseDb, FRIENDS_COLLECTION, userId, "items", friendUid)),
    deleteDoc(doc(firebaseDb, FRIENDS_COLLECTION, friendUid, "items", userId)),
  ]);
}

export function watchFriendNotifications(userId: string, onChange: (items: FriendNotification[]) => void) {
  const notificationsRef = collection(firebaseDb, NOTIFICATIONS_COLLECTION, userId, "items");
  const notificationsQuery = query(notificationsRef, orderBy("createdAt", "desc"));

  return onSnapshot(notificationsQuery, (snapshot) => {
    onChange(snapshot.docs.map((entry) => mapFriendNotification(entry.id, entry.data())));
  });
}

async function getFriendRequest(requestId: string) {
  const requestRef = doc(firebaseDb, FRIEND_REQUESTS_COLLECTION, requestId);
  const snapshot = await getDoc(requestRef);

  if (!snapshot.exists()) {
    return null;
  }

  return { ref: requestRef, request: mapFriendRequest(snapshot.id, snapshot.data()) };
}

async function hasFriendConnection(userId: string, otherUserId: string) {
  const connectionRef = doc(firebaseDb, FRIENDS_COLLECTION, userId, "items", otherUserId);
  const snapshot = await getDoc(connectionRef);
  return snapshot.exists();
}

async function writeFriendConnection(userProfile: UserProfile, friendProfile: UserProfile) {
  const connectionRef = doc(firebaseDb, FRIENDS_COLLECTION, userProfile.uid, "items", friendProfile.uid);
  await setDoc(
    connectionRef,
    stripUndefined({
      friendUid: friendProfile.uid,
      friendId: friendProfile.friendId,
      friendName: friendProfile.name,
      friendPicture: friendProfile.picture,
      createdAt: new Date().toISOString(),
    }),
  );
}

export async function sendFriendRequest(input: { fromUser: UserProfile; toFriendId: string }) {
  const toProfile = await findUserByFriendId(input.toFriendId);

  if (!toProfile) {
    throw new Error("找不到這個好友 ID。請確認輸入是否正確。");
  }

  if (toProfile.uid === input.fromUser.uid) {
    throw new Error("不能邀請自己成為好友。");
  }

  if (await hasFriendConnection(input.fromUser.uid, toProfile.uid)) {
    throw new Error("你們已經是好友了。");
  }

  const requestId = `${input.fromUser.uid}_${toProfile.uid}`;
  const existingRequest = await getFriendRequest(requestId);

  if (existingRequest && existingRequest.request.status === "pending") {
    throw new Error("邀請已送出，等待對方回覆。");
  }

  const requestPayload = stripUndefined({
    requestId,
    fromUserId: input.fromUser.uid,
    fromFriendId: input.fromUser.friendId,
    fromName: input.fromUser.name,
    fromPicture: input.fromUser.picture,
    toUserId: toProfile.uid,
    toFriendId: toProfile.friendId,
    toName: toProfile.name,
    toPicture: toProfile.picture,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await setDoc(doc(firebaseDb, FRIEND_REQUESTS_COLLECTION, requestId), requestPayload);

  await createUserNotification(toProfile.uid, {
    requestId,
    type: "friend_request",
    status: "pending",
    read: false,
    title: `${input.fromUser.name} 想加你為好友`,
    body: `對方的好友 ID 是 ${input.fromUser.friendId}`,
    fromUserId: input.fromUser.uid,
    fromFriendId: input.fromUser.friendId,
    fromName: input.fromUser.name,
    fromPicture: input.fromUser.picture,
    toUserId: toProfile.uid,
    toFriendId: toProfile.friendId,
    toName: toProfile.name,
    toPicture: toProfile.picture,
    createdAt: requestPayload.createdAt,
  });
}

export async function respondToFriendRequest(input: {
  recipientUser: UserProfile;
  notification: FriendNotification;
  response: FriendRequestResponse;
}) {
  const requestResult = await getFriendRequest(input.notification.requestId);

  if (!requestResult) {
    throw new Error("找不到這則邀請。");
  }

  const { ref, request } = requestResult;

  if (request.toUserId !== input.recipientUser.uid) {
    throw new Error("這不是你的邀請。");
  }

  if (request.status !== "pending") {
    throw new Error("這則邀請已經處理過了。");
  }

  const respondedAt = new Date().toISOString();
  const nextStatus = input.response;

  await updateDoc(ref, {
    status: nextStatus,
    respondedAt,
    updatedAt: respondedAt,
  });

  const recipientNotificationRef = doc(
    firebaseDb,
    NOTIFICATIONS_COLLECTION,
    input.recipientUser.uid,
    "items",
    input.notification.id,
  );

  await updateDoc(recipientNotificationRef, {
    status: nextStatus,
    read: true,
    respondedAt,
  });

  const senderProfile = await getDoc(doc(firebaseDb, USERS_COLLECTION, request.fromUserId));
  const fromUser = senderProfile.exists() ? mapUserProfile(senderProfile.id, senderProfile.data()) : null;

  if (nextStatus === "accepted" && fromUser) {
    await writeFriendConnection(input.recipientUser, fromUser);
    await writeFriendConnection(fromUser, input.recipientUser);
  }

  await createUserNotification(request.fromUserId, {
    requestId: request.requestId,
    type: "friend_response",
    status: nextStatus,
    read: false,
    title: nextStatus === "accepted" ? `${input.recipientUser.name} 接受了你的好友邀請` : `${input.recipientUser.name} 拒絕了你的好友邀請`,
    body: nextStatus === "accepted"
      ? `${input.recipientUser.friendId} 現在已經是你的好友。`
      : `${input.recipientUser.friendId} 目前沒有加入好友。`,
    fromUserId: input.recipientUser.uid,
    fromFriendId: input.recipientUser.friendId,
    fromName: input.recipientUser.name,
    fromPicture: input.recipientUser.picture,
    toUserId: request.fromUserId,
    toFriendId: request.fromFriendId,
    toName: request.fromName,
    toPicture: request.fromPicture,
    createdAt: respondedAt,
    respondedAt,
  });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const notificationRef = doc(firebaseDb, NOTIFICATIONS_COLLECTION, userId, "items", notificationId);
  await updateDoc(notificationRef, { read: true });
}

export async function deleteNotification(userId: string, notificationId: string) {
  const notificationRef = doc(firebaseDb, NOTIFICATIONS_COLLECTION, userId, "items", notificationId);
  await deleteDoc(notificationRef);
}

export async function clearNotifications(userId: string) {
  const notificationsRef = collection(firebaseDb, NOTIFICATIONS_COLLECTION, userId, "items");
  const snapshot = await getDocs(notificationsRef);
  await Promise.all(snapshot.docs.map((entry) => deleteDoc(entry.ref)));
}
