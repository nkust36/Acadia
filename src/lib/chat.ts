import { addDoc, collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore";
import { createUserNotification, type UserProfile } from "@/lib/social";

const CHATS_COLLECTION = "directChats";

export type DirectMessage = {
  id: string;
  chatId: string;
  senderUid: string;
  senderName: string;
  senderPicture?: string;
  recipientUid: string;
  recipientName: string;
  recipientPicture?: string;
  text: string;
  createdAt: string;
};

export function getDirectChatId(userUid: string, friendUid: string) {
  return [userUid, friendUid].sort().join("_");
}

function mapDirectMessage(id: string, data: Record<string, unknown>): DirectMessage {
  return {
    id,
    chatId: typeof data.chatId === "string" ? data.chatId : "",
    senderUid: typeof data.senderUid === "string" ? data.senderUid : "",
    senderName: typeof data.senderName === "string" ? data.senderName : "匿名",
    senderPicture: typeof data.senderPicture === "string" ? data.senderPicture : undefined,
    recipientUid: typeof data.recipientUid === "string" ? data.recipientUid : "",
    recipientName: typeof data.recipientName === "string" ? data.recipientName : "匿名",
    recipientPicture: typeof data.recipientPicture === "string" ? data.recipientPicture : undefined,
    text: typeof data.text === "string" ? data.text : "",
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
  };
}

export function watchDirectMessages(chatId: string, onChange: (messages: DirectMessage[]) => void) {
  const messagesRef = collection(firebaseDb, CHATS_COLLECTION, chatId, "messages");
  const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"));

  return onSnapshot(messagesQuery, (snapshot) => {
    onChange(snapshot.docs.map((entry) => mapDirectMessage(entry.id, entry.data())));
  });
}

export async function sendDirectMessage(input: {
  chatId: string;
  sender: UserProfile;
  recipient: UserProfile;
  text: string;
}) {
  const message = input.text.trim();

  if (!message) {
    throw new Error("請輸入訊息內容。");
  }

  const createdAt = new Date().toISOString();
  const messagesRef = collection(firebaseDb, CHATS_COLLECTION, input.chatId, "messages");

  await addDoc(messagesRef, stripUndefined({
    chatId: input.chatId,
    senderUid: input.sender.uid,
    senderName: input.sender.name,
    senderPicture: input.sender.picture,
    recipientUid: input.recipient.uid,
    recipientName: input.recipient.name,
    recipientPicture: input.recipient.picture,
    text: message,
    createdAt,
  }));

  await createUserNotification(input.recipient.uid, {
    requestId: `${input.chatId}_${createdAt}`,
    type: "direct_message",
    status: "info",
    read: false,
    title: `${input.sender.name} 傳來新訊息`,
    body: message,
    fromUserId: input.sender.uid,
    fromFriendId: input.sender.friendId,
    fromName: input.sender.name,
    fromPicture: input.sender.picture,
    toUserId: input.recipient.uid,
    toFriendId: input.recipient.friendId,
    toName: input.recipient.name,
    toPicture: input.recipient.picture,
    createdAt,
  });
}
