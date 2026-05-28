# Arch To View

## 本地開發

1. 安裝依賴

```bash
npm install
```

2. 建立 `.env` 並設定 Firebase 參數

```bash
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_APP_ID=your-app-id
```

3. 啟動專案

```bash
npm run dev
```

## Firebase Setup

這個專案現在會使用 Firebase Auth、Firestore 和 Storage。

1. 到 Firebase Console 建立一個 Firebase 專案。
2. 在 Authentication 中啟用 Email/Password 和 Google 登入。
3. 建立 Firestore Database 與 Storage Bucket。
4. 把上面列出的環境變數加入本機 `.env` 檔案。
5. 設定完成後重新啟動開發伺服器。

建議的開發規則：

```txt
rules_version = '2';
service cloud.firestore {
	match /databases/{database}/documents {
		match /categories/{userId}/items/{categoryId} {
			allow read, write: if request.auth != null && request.auth.uid == userId;
		}

		match /expenses/{userId}/items/{expenseId} {
			allow read, write: if request.auth != null && request.auth.uid == userId;
		}
	}
}
```

上傳的收據圖片會先壓縮，再存到 Firebase Storage，並把下載網址寫回記帳資料。
