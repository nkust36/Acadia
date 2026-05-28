export type ExpenseVisibility = "private" | "friends" | "public";

export type ExpenseRecord = {
  id: string;
  userId: string;
  amount: number;
  expenseDate: string;
  transactionType: "expense" | "income";
  category: string;
  mood: string;
  visibility: ExpenseVisibility;
  secretNote: string;
  photoUrl?: string;
  photoPath?: string;
  createdAt: string;
};

export type CreateExpenseInput = {
  userId: string;
  amount: number;
  expenseDate: string;
  transactionType: "expense" | "income";
  category: string;
  mood: string;
  visibility: ExpenseVisibility;
  secretNote?: string;
  photoDataUrl?: string;
};

export type CreateExpenseResult = {
  expense: ExpenseRecord;
  photoUploaded: boolean;
};
export type UpdateExpenseInput = {
  userId: string;
  expenseId: string;
  amount: number;
  expenseDate: string;
  transactionType: "expense" | "income";
  category: string;
  mood: string;
  visibility: ExpenseVisibility;
  secretNote?: string;
  photoDataUrl?: string;
  removePhoto?: boolean;
};
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { firebaseDb, firebaseStorage } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore";

const EXPENSES_COLLECTION = "expenses";

function shouldSyncExpensePhotosToStorage() {
  return import.meta.env.VITE_ENABLE_FIREBASE_STORAGE_SYNC === "true";
}

function getExpenseRef(userId: string, expenseId: string) {
  return doc(firebaseDb, EXPENSES_COLLECTION, userId, "items", expenseId);
}

async function saveExpensePhotoWithFallback(
  expenseRef: ReturnType<typeof getExpenseRef>,
  userId: string,
  expenseId: string,
  photoDataUrl: string,
  previousPhotoPath?: string,
): Promise<boolean> {
  const photoPath = previousPhotoPath ?? `expenses/${userId}/${expenseId}.jpg`;

  try {
    const storageRef = ref(firebaseStorage, photoPath);
    const photoBlob = await fetch(photoDataUrl).then((response) => response.blob());
    await uploadBytes(storageRef, photoBlob, { contentType: photoBlob.type || "image/jpeg" });
    const photoUrl = await getDownloadURL(storageRef);

    await updateDoc(expenseRef, stripUndefined({ photoUrl, photoPath }));
    return true;
  } catch (error) {
    console.warn("Photo upload failed, falling back to data URL", error);
  }

  try {
    await updateDoc(expenseRef, {
      photoUrl: photoDataUrl,
      photoPath: deleteField(),
    });

    return true;
  } catch (error) {
    console.error("Photo fallback save failed", error);
    return false;
  }
}

async function uploadExpensePhotoToStorage(
  expenseRef: ReturnType<typeof getExpenseRef>,
  userId: string,
  expenseId: string,
  photoDataUrl: string,
  previousPhotoPath?: string,
) {
  const photoPath = previousPhotoPath ?? `expenses/${userId}/${expenseId}.jpg`;
  const storageRef = ref(firebaseStorage, photoPath);
  const photoBlob = await fetch(photoDataUrl).then((response) => response.blob());
  await uploadBytes(storageRef, photoBlob, { contentType: photoBlob.type || "image/jpeg" });
  const photoUrl = await getDownloadURL(storageRef);

  await updateDoc(expenseRef, stripUndefined({ photoUrl, photoPath }));
}

function mapExpenseDoc(id: string, data: Record<string, unknown>): ExpenseRecord {
  return {
    id,
    userId: typeof data.userId === "string" ? data.userId : "",
    amount: typeof data.amount === "number" ? data.amount : Number(data.amount || 0),
    expenseDate: typeof data.expenseDate === "string"
      ? data.expenseDate
      : (typeof data.createdAt === "string" ? data.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
    transactionType: data.transactionType === "income" ? "income" : "expense",
    category: typeof data.category === "string" ? data.category : "",
    mood: typeof data.mood === "string" ? data.mood : "😐",
    visibility: data.visibility === "public" || data.visibility === "friends" ? data.visibility : "private",
    secretNote: typeof data.secretNote === "string" ? data.secretNote : "",
    photoUrl: typeof data.photoUrl === "string" ? data.photoUrl : undefined,
    photoPath: typeof data.photoPath === "string" ? data.photoPath : undefined,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
  };
}

export async function listExpenses(userId?: string): Promise<ExpenseRecord[]> {
  if (!userId) {
    return [];
  }

  const expensesRef = collection(firebaseDb, EXPENSES_COLLECTION, userId, "items");
  const expenseQuery = query(expensesRef, orderBy("createdAt", "desc"));

  const snapshot = await getDocs(expenseQuery);
  return snapshot.docs.map((entry) => mapExpenseDoc(entry.id, entry.data()));
}

export async function getExpense(userId: string, expenseId: string): Promise<ExpenseRecord | undefined> {
  if (!userId || !expenseId) {
    return undefined;
  }

  const snapshot = await getDoc(getExpenseRef(userId, expenseId));

  if (!snapshot.exists()) {
    return undefined;
  }

  return mapExpenseDoc(snapshot.id, snapshot.data());
}

export async function createExpense(input: CreateExpenseInput): Promise<CreateExpenseResult> {
  const expenseRef = doc(collection(firebaseDb, EXPENSES_COLLECTION, input.userId, "items"));
  const expenseId = expenseRef.id;
  const createdAt = new Date().toISOString();

  const next: ExpenseRecord = {
    id: expenseId,
    userId: input.userId,
    amount: input.amount,
    expenseDate: input.expenseDate,
    transactionType: input.transactionType,
    category: input.category,
    mood: input.mood,
    visibility: input.visibility,
    secretNote: input.secretNote?.trim() || "",
    createdAt,
  };

  await setDoc(expenseRef, stripUndefined(next));

  if (!input.photoDataUrl) {
    return { expense: next, photoUploaded: false };
  }

  const photoPath = `expenses/${input.userId}/${expenseId}.jpg`;
  const photoUploaded = await updateDoc(expenseRef, {
    photoUrl: input.photoDataUrl,
    photoPath: deleteField(),
  })
    .then(() => true)
    .catch((error) => {
      console.error("Photo preview save failed", error);
      return false;
    });

  if (shouldSyncExpensePhotosToStorage()) {
    void uploadExpensePhotoToStorage(expenseRef, input.userId, expenseId, input.photoDataUrl, photoPath)
      .catch((error) => {
        console.warn("Background photo storage sync failed", error);
      });
  }

  const withPhoto = await getExpense(input.userId, expenseId);

  return { expense: withPhoto ?? next, photoUploaded };
}

export async function updateExpense(input: UpdateExpenseInput): Promise<ExpenseRecord> {
  const expenseRef = getExpenseRef(input.userId, input.expenseId);
  const current = await getExpense(input.userId, input.expenseId);

  if (!current) {
    throw new Error("找不到記帳紀錄");
  }

  const updates: Record<string, unknown> = {
    userId: input.userId,
    amount: input.amount,
    expenseDate: input.expenseDate,
    transactionType: input.transactionType,
    category: input.category,
    mood: input.mood,
    visibility: input.visibility,
    secretNote: input.secretNote?.trim() || "",
  };

  await updateDoc(expenseRef, updates);

  if (input.removePhoto) {
    await updateDoc(expenseRef, {
      photoUrl: deleteField(),
      photoPath: deleteField(),
    });
  }

  if (input.photoDataUrl) {
    await updateDoc(expenseRef, {
      photoUrl: input.photoDataUrl,
      photoPath: deleteField(),
    });

    if (shouldSyncExpensePhotosToStorage()) {
      void uploadExpensePhotoToStorage(
        expenseRef,
        input.userId,
        input.expenseId,
        input.photoDataUrl,
        current.photoPath,
      ).catch((error) => {
        console.warn("Background photo storage sync failed", error);
      });
    }
  }

  const updated = await getExpense(input.userId, input.expenseId);

  if (!updated) {
    throw new Error("更新記帳紀錄失敗");
  }

  return updated;
}

export async function deleteExpense(userId: string, expenseId: string): Promise<void> {
  const expenseRef = getExpenseRef(userId, expenseId);
  const current = await getExpense(userId, expenseId);

  if (current?.photoPath) {
    try {
      await deleteObject(ref(firebaseStorage, current.photoPath));
    } catch (error) {
      console.error("Photo delete failed", error);
    }
  }

  await deleteDoc(expenseRef);
}

export async function clearExpenses() {
  const snapshot = await getDocs(collection(firebaseDb, EXPENSES_COLLECTION));
  await Promise.all(snapshot.docs.map((expense) => deleteDoc(doc(firebaseDb, EXPENSES_COLLECTION, expense.id))));
}
