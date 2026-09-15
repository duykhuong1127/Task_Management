# Quản Lý Công Việc PWA

Ứng dụng React/Vite quản lý giao việc, bàn giao, chỉnh sửa và nghiệm thu theo từng người nhận. Xác thực sử dụng duy nhất Firebase Authentication với Google Sign-In; ứng dụng không thu thập hoặc lưu mật khẩu Google.

## Kiến trúc production

Phiên bản này khắc phục ba giới hạn lớn của prototype ban đầu:

### 1. File thật — Firebase Storage

- File binary được tải trực tiếp lên **Firebase Storage**, không còn lưu Base64/DataURL trong LocalStorage hoặc Firestore.
- Firestore chỉ lưu metadata nhỏ của file tại `tasks/{taskId}/files/{fileId}`.
- Upload có progress, giới hạn **25 MB/file**, chặn một số định dạng executable nguy hiểm.
- Download dùng Firebase SDK `getBlob()` nên mọi lượt tải đều đi qua Storage Security Rules.
- Quyền đọc file theo thành viên Project; quyền xóa dành cho Admin, người upload hoặc người giao việc.
- Nếu upload Storage thành công nhưng ghi metadata Firestore thất bại, ứng dụng tự xóa object vừa upload để tránh file mồ côi.

### 2. Multiple Views

Trang `/tasks` dùng cùng một nguồn Task nhưng có 4 view:

- **List** — tìm kiếm, filter và sort.
- **Board** — Kanban kéo/thả giữa `Mới`, `Đang thực hiện`, `Chờ xử lý`; không cho kéo trực tiếp sang `Hoàn thành` để bảo toàn workflow nghiệm thu.
- **Calendar** — lịch tháng theo deadline. Route `/calendar` mở trực tiếp Calendar view.
- **Timeline** — trực quan thời gian từ ngày tạo đến deadline.

View cuối được lưu trên trình duyệt bằng `task_view_mode_v2`.

### 3. Multi-user realtime — Cloud Firestore

`DataService` vẫn giữ vai trò business-logic/cache đồng bộ để không phá các flow hiện có, nhưng khi người dùng ACTIVE đăng nhập, **Cloud Firestore là nguồn dữ liệu dùng chung**:

- realtime users;
- projects;
- tasks;
- assignments theo từng assignee;
- messages/chat;
- file metadata;
- notifications;
- audit log cho Admin.

Mọi thay đổi nghiệp vụ cục bộ được write-through lên Firestore và các máy khác nhận lại qua `onSnapshot()`.

## Firestore database của dự án này

AI Studio đã provision một **named Firestore database**:

`ai-studio-qunlcngvicpwa-dc6350a2-299f-43fb-9ad1-c9d845466237`

Application data nằm ở database này.

Firebase Storage Security Rules chỉ có thể đọc Firestore `(default)`, vì vậy app dùng một ACL mirror rất nhỏ trong `(default)`:

- `storageUsers/{uid}` → role/status;
- `storageProjects/{projectId}` → owner + memberIds.

**Không có nội dung task, chat, mô tả hay file metadata nghiệp vụ bị nhân đôi vào `(default)`.**

Các file liên quan:

- `firestore.rules` → rules cho named app database.
- `firestore.storage-acl.rules` → rules cho `(default)` ACL database.
- `storage.rules` → rules cho Firebase Storage.
- `firebase.json` → cấu hình deploy cả hai Firestore database và Storage.

> Nếu Firebase project hiện chưa có database `(default)`, hãy tạo một Cloud Firestore database `(default)` ở Native mode trước khi deploy. Database này chỉ dùng cho Storage ACL mirror.

## Chạy localhost

1. Cài Node.js 20+.
2. Chạy `npm install` hoặc package manager phù hợp.
3. Bật **Authentication > Sign-in method > Google** trong Firebase Console.
4. Đảm bảo named Firestore database và `(default)` database đã tồn tại.
5. Bật Cloud Storage for Firebase.
6. Deploy Security Rules (xem phần bên dưới).
7. Chạy `npm run dev` và mở `http://localhost:3000`.

## Deploy Firebase Rules

Đăng nhập Firebase CLI và chọn đúng project, sau đó:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Nếu deploy cả web app:

```bash
npm run build
firebase deploy --only firestore,storage,hosting
```

Sau deploy, đăng nhập một lần bằng tài khoản bootstrap Admin để hệ thống tạo/cập nhật ACL mirror cho Storage. Khi Admin duyệt user hoặc thay đổi thành viên Project, ACL được đồng bộ tự động.

## CORS cho tải file trực tiếp

`getBlob()` tải file trực tiếp trong browser nên bucket phải cho phép origin của ứng dụng.

1. Copy `storage.cors.example.json` thành file riêng và thay `https://YOUR_PRODUCTION_DOMAIN` bằng domain thật.
2. Áp CORS cho bucket:

```bash
gcloud storage buckets update gs://gen-lang-client-0181319443.firebasestorage.app --cors-file=storage.cors.example.json
```

Không nên dùng `origin: ["*"]` trên môi trường nội bộ production nếu đã biết domain chính xác.

## Migration dữ liệu LocalStorage cũ

Prototype cũ giữ project/task/chat/file metadata trong LocalStorage. Migration **không tự chạy mặc định** để tránh vô tình đưa seed/demo data lên production.

Nếu muốn chuyển dữ liệu cũ từ trình duyệt Admin sang Firestore:

1. Xác nhận Firestore cloud workspace đang trống.
2. Trên chính trình duyệt chứa dữ liệu cần giữ, đặt:

```env
VITE_AUTO_MIGRATE_LOCAL_DATA="true"
```

3. Build/deploy và đăng nhập bằng **ADMIN**.
4. App chỉ migration khi cloud hiện có `0 project` và `0 task`.
5. Kiểm tra dữ liệu đã lên Firestore.
6. Đổi ngay biến về:

```env
VITE_AUTO_MIGRATE_LOCAL_DATA="false"
```

> Dữ liệu cũ nằm trong từng browser riêng biệt nên không thể tự động hợp nhất an toàn từ nhiều máy. Hãy chọn một bản dữ liệu Admin làm nguồn migration hoặc nhập lại các dữ liệu khác có chủ đích.

## Cấu hình Firebase và Google OAuth

1. Chọn Google Cloud/Firebase project đúng với `firebase-applet-config.json`.
2. Bật Google provider trong **Firebase Authentication > Sign-in method > Google**.
3. Trong **Firebase Authentication > Settings > Authorized domains**, thêm `localhost` và domain production.
4. Trong Google Cloud Console, kiểm tra OAuth Client loại **Web application**. Client ID phải trùng với `oAuthClientId`.
5. Cấu hình **Authorized JavaScript origins**:
   - Development: `http://localhost:3000`
   - Production: `https://YOUR_DOMAIN`
6. Nếu OAuth consent screen ở trạng thái **Testing**, thêm Gmail cần dùng vào **Test users**, hoặc hoàn tất cấu hình và chuyển sang trạng thái phù hợp cho production.
7. Login cơ bản chỉ dùng `openid email profile`; Drive/Gmail/Calendar scopes không được yêu cầu lúc đăng nhập.

## Luồng xác thực và phê duyệt

- Nút **Tiếp tục với Google** dùng Google Identity Services (GIS) lấy access token trực tiếp từ `accounts.google.com`.
- Access token được đổi thành Firebase credential bằng `signInWithCredential()`.
- `/dashboard`, `/tasks`, `/projects`, `/calendar`, `/settings`, `/admin` đều nằm sau `ProtectedRoute`.
- Google account mới thông thường có `role = MEMBER`, `status = PENDING_APPROVAL`.
- Bootstrap Admin có thể bắt đầu với `role = ADMIN`, `status = ACTIVE`.
- Admin phê duyệt user và gán Project; thay đổi này được write-through lên Firestore để có hiệu lực trên mọi thiết bị.

## Security model quan trọng

- Project lưu thêm `memberIds[]` làm chỉ mục query/quyền realtime.
- Task lưu thêm `projectMemberIds[]` để thành viên chỉ subscribe những task được phép đọc.
- Người ngoài Project không đọc được task, assignment, chat hoặc file metadata.
- Assignee không thể kéo card trực tiếp thành `COMPLETED`; trạng thái hoàn thành vẫn yêu cầu workflow bàn giao → người giao/Admin nghiệm thu.
- Chat sau `T+15` chuyển read-only theo `chatWritableUntil` dạng Firestore Timestamp.
- Audit logs immutable từ phía client.
- Storage objects là immutable binary; muốn thay nội dung thì upload version/file mới.

## Kiểm tra trước production

- Dùng HTTPS.
- Cấu hình Firebase Authorized Domains + OAuth Authorized JavaScript Origins.
- Deploy rules cho **cả named DB, `(default)` ACL DB và Storage**.
- Cấu hình CORS bucket cho production domain.
- Kiểm thử tối thiểu bằng 2 tài khoản ở 2 browser/device:
  1. Admin giao việc.
  2. Member thấy task realtime.
  3. Member cập nhật tiến độ/bàn giao.
  4. Admin thấy thay đổi realtime và nghiệm thu.
  5. User ngoài Project không đọc task/file.
  6. Upload/download/delete file đúng quyền.
  7. Board/List/Calendar/Timeline cùng phản ánh một Task.
- Sau khi ổn định, nên bổ sung Firebase App Check, CSP, error monitoring và Cloud Functions cho các automation cần server authority.
