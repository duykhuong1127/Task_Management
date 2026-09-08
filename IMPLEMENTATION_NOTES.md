# Ghi chú triển khai Google Authentication

## File đã tạo

- `src/auth/AuthContext.tsx`: quản lý session Firebase, Google popup/redirect, đồng bộ hồ sơ Firestore và logout.
- `src/auth/ProtectedRoute.tsx`: bảo vệ route và redirect về `/login`.
- `src/components/LoginPage.tsx`: trang đăng nhập duy nhất với nút “Tiếp tục với Google”.
- `src/components/AuthLoadingScreen.tsx`: loading screen khi Firebase khôi phục session.
- `pnpm-lock.yaml`: lockfile cho package manager khai báo trong `package.json`.

## File đã sửa

- `src/App.tsx`: cấu trúc route và auth gate; thêm `/dashboard`, `/tasks`, `/projects`, `/calendar`, `/settings`, `/admin`.
- `src/main.tsx`: thêm `BrowserRouter` và `AuthProvider`.
- `src/components/Header.tsx`: avatar, tên, email, menu tài khoản/cài đặt/logout; bỏ chuyển tài khoản demo.
- `src/components/CreateTaskModal.tsx`: không yêu cầu quyền Drive khi tạo công việc.
- `src/components/AdminView.tsx`: bỏ chức năng mật khẩu riêng.
- `src/services/dataService.ts`: chỉ nhận hồ sơ sau khi Firebase xác thực; xóa auth/password/token Drive giả và dọn mật khẩu legacy khỏi local storage.
- `src/services/seedData.ts`, `shared/types/models.ts`: loại bỏ password.
- `src/services/businessLogic.test.ts`: cập nhật test theo Google identity.
- `src/config/firebase.ts`, `firestore.rules`: kiểm tra cấu hình và rules hồ sơ theo Firebase UID.
- `.env.example`, `README.md`, `index.html`, `src/index.css`, `package.json`, `vite.config.ts`.

## File đã xóa

- `src/components/AuthScreen.tsx`
- `src/components/LoginModal.tsx`
- `src/components/ChangePasswordModal.tsx`
- `src/components/PendingApprovalView.tsx`
- `src/components/GoogleDriveConsentModal.tsx`
- `src/components/DrivePermissionDeniedBanner.tsx`
- `src/services/driveService.ts`
- `firebase-applet-config.json` (loại cấu hình Firebase hard-code; dùng `.env.local`)
- `bun.lock` (thay bằng `pnpm-lock.yaml`)

## Xác minh

- TypeScript: đạt (`tsc --noEmit`).
- Unit tests: 16/16 đạt.
- Production/PWA build: đạt.
- Cần điền `.env.local`, bật Google provider, cấu hình Authorized domains và triển khai Firestore rules trước khi thử OAuth thật.
