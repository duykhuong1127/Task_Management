# Quản Lý Công Việc PWA

Ứng dụng React/Vite sử dụng duy nhất Firebase Authentication với Google Sign-In. Ứng dụng không thu thập hoặc lưu mật khẩu Google.

## Chạy trên localhost

1. Cài Node.js 20+ và chạy `npm install`.
2. Sao chép `.env.example` thành `.env.local` và điền cấu hình Firebase Web App.
3. Trong Firebase Console, bật **Authentication > Sign-in method > Google**.
4. Tạo Cloud Firestore và triển khai rules bằng `firebase deploy --only firestore:rules`.
5. Chạy `npm run dev`, sau đó mở `http://localhost:3000`.

## Biến môi trường

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Các giá trị trên lấy tại **Firebase Console > Project settings > General > Your apps > Web app**. Không đặt OAuth client secret hoặc service-account key trong biến `VITE_*` vì chúng được đóng gói vào frontend.

## Cấu hình Firebase và Google OAuth

1. Chọn hoặc tạo Google Cloud/Firebase project.
2. Cấu hình OAuth consent screen: tên ứng dụng, email hỗ trợ, domain được phép và privacy policy cho production.
3. Bật Google provider trong Firebase Authentication.
4. Trong **Authentication > Settings > Authorized domains**, thêm `localhost` và domain production.
5. Nếu quản lý OAuth Client ID thủ công, cấu hình:
   - Authorized JavaScript origin development: `http://localhost:3000`
   - Authorized JavaScript origin production: `https://YOUR_DOMAIN`
   - Redirect URI: `https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler`
   - Nếu dùng custom auth domain, thêm handler tương ứng của custom domain.
6. Không cần thêm scope Drive, Gmail, Calendar hoặc Contacts cho đăng nhập cơ bản. Các quyền này phải được yêu cầu riêng đúng lúc người dùng sử dụng tính năng tương ứng.

## Luồng xác thực

- Desktop sử dụng `signInWithPopup()`.
- Màn hình nhỏ sử dụng `signInWithRedirect()`; popup bị chặn cũng chuyển sang redirect.
- `AuthProvider` chờ Firebase khôi phục session trước khi render route, tránh nháy trang login.
- `/dashboard`, `/tasks`, `/projects`, `/calendar`, `/settings` và `/admin` đều nằm sau `ProtectedRoute`.
- `/admin` còn yêu cầu hồ sơ Firestore có role `ADMIN`.
- Lần đăng nhập đầu tạo `users/{firebaseUid}` với role `MEMBER`; các lần sau cập nhật tên, ảnh và `lastLoginAt`.
- Để cấp admin ban đầu, quản trị viên dự án phải đổi trường `role` của hồ sơ Firestore thành `ADMIN` bằng môi trường quản trị đáng tin cậy.

## Trước khi triển khai production

- Dùng HTTPS và thêm domain production vào Firebase Authorized domains.
- Hạn chế Firebase API key theo domain/API trong Google Cloud Console.
- Triển khai và kiểm thử Firestore rules bằng Emulator Suite.
- Chuyển dữ liệu công việc hiện còn ở local storage sang Firestore/backend trước khi dùng đa người dùng.
- Thực hiện thao tác quản trị role/status qua backend hoặc Cloud Functions với custom claims; không tin role do client gửi lên.
- Tích hợp App Check, CSP, giám sát lỗi và chính sách quyền riêng tư.
