# Quản Lý Công Việc PWA

Ứng dụng React/Vite sử dụng duy nhất Firebase Authentication với Google Sign-In. Ứng dụng không thu thập hoặc lưu mật khẩu Google.

## Chạy trên localhost

1. Cài Node.js 20+ và chạy `npm install`.
2. Cấu hình Firebase Web App cho môi trường chạy.
3. Trong Firebase Console, bật **Authentication > Sign-in method > Google**.
4. Tạo Cloud Firestore và triển khai rules bằng `firebase deploy --only firestore:rules`.
5. Chạy `npm run dev`, sau đó mở `http://localhost:3000`.

## Cấu hình Firebase và Google OAuth

1. Chọn hoặc tạo Google Cloud/Firebase project.
2. Bật Google provider trong **Firebase Authentication > Sign-in method > Google**.
3. Trong **Firebase Authentication > Settings > Authorized domains**, thêm `localhost` và domain production.
4. Trong Google Cloud Console, kiểm tra OAuth Client loại **Web application**. Client ID phải trùng với `oAuthClientId` trong `firebase-applet-config.json` của môi trường đang chạy.
5. Cấu hình **Authorized JavaScript origins** cho OAuth Client:
   - Development: `http://localhost:3000`
   - Production: `https://YOUR_DOMAIN`
   - Nếu dùng môi trường preview/embedded có origin riêng, origin đó cũng phải được cấp phép.
6. Kiểm tra **OAuth consent screen / Audience**:
   - Nếu ứng dụng đang ở trạng thái **Testing**, mọi Gmail dùng để đăng nhập phải nằm trong **Test users**.
   - Nếu muốn cho phép người dùng ngoài danh sách test, hoàn tất cấu hình cần thiết và chuyển ứng dụng sang **Production**.
7. Không cần scope Drive, Gmail, Calendar hoặc Contacts cho đăng nhập cơ bản. Các quyền này phải được yêu cầu riêng đúng lúc người dùng sử dụng tính năng tương ứng.

## Luồng xác thực

- Nút **Tiếp tục với Google** sử dụng **Google Identity Services (GIS)** để lấy Google access token trực tiếp từ `accounts.google.com`.
- Access token được đổi thành Firebase credential bằng `signInWithCredential()`.
- Ứng dụng **không fallback sang `signInWithPopup()` / `firebaseapp.com/__/auth/handler`**. Điều này tránh lỗi `The requested action is invalid` từng xuất hiện trong preview/iframe hoặc khi Firebase auth handler không phù hợp origin hiện tại.
- `AuthProvider` chỉ chuyển sang trạng thái `authenticated` sau khi Firebase thực sự có session và hồ sơ Firestore đồng bộ thành công.
- `/dashboard`, `/tasks`, `/projects`, `/calendar`, `/settings` và `/admin` đều nằm sau `ProtectedRoute`.
- Tài khoản Google mới thông thường được tạo tại `users/{firebaseUid}` với `role = MEMBER` và `status = PENDING_APPROVAL`.
- Các email bootstrap admin được khai báo trong mã/rules có thể tạo lần đầu với `role = ADMIN` và `status = ACTIVE`.
- Sau khi hồ sơ đã tồn tại, client chỉ được cập nhật thông tin Google cơ bản và thời gian đăng nhập; `role/status` phải do Admin/backend quản lý.

## Xử lý lỗi đăng nhập Google

Nếu một số tài khoản đăng nhập được nhưng một số tài khoản bị từ chối:

1. Kiểm tra **Google Cloud > OAuth consent screen / Audience**. Nếu app đang **Testing**, thêm tài khoản lỗi vào **Test users**.
2. Kiểm tra `oAuthClientId` có đúng OAuth Web Client của cùng Firebase/Google Cloud project hay không.
3. Kiểm tra domain hiện tại trong **Authorized JavaScript origins** và **Firebase Authorized domains**.
4. Nếu đang chạy trong môi trường Preview/iframe, thử **Open in new tab**.
5. Mở Console và đọc thông báo lỗi; ứng dụng không còn chuyển sang trang `firebaseapp.com/__/auth/handler` khi GIS thất bại.

## Trước khi triển khai production

- Dùng HTTPS và thêm domain production vào Firebase Authorized domains và OAuth Authorized JavaScript origins.
- Chuyển OAuth consent screen sang trạng thái phù hợp với tập người dùng thực tế.
- Hạn chế Firebase API key theo domain/API trong Google Cloud Console.
- Triển khai và kiểm thử Firestore rules bằng Emulator Suite.
- Chuyển dữ liệu công việc hiện còn ở local storage sang Firestore/backend trước khi dùng đa người dùng.
- Thực hiện thao tác quản trị role/status qua backend hoặc Cloud Functions với custom claims.
- Tích hợp App Check, CSP, giám sát lỗi và chính sách quyền riêng tư.
