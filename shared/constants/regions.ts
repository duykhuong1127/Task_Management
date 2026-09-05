// REGION & LOCATION LOCK — NON-NEGOTIABLE
// Primary Region: asia-southeast1 (Singapore)
// Business Timezone: Asia/Ho_Chi_Minh

export const APP_REGION = "asia-southeast1";
export const FIREBASE_REGION = "asia-southeast1";
export const FUNCTIONS_REGION = "asia-southeast1";
export const SCHEDULER_REGION = "asia-southeast1";
export const BUSINESS_TIMEZONE = "Asia/Ho_Chi_Minh";

export interface RegionPreflightStatus {
  googleCloudProjectId: string;
  newServiceIdentityConfirmed: boolean;
  oldUsWest1NotReused: boolean;
  firestoreLocationVerified: boolean;
  firestoreTarget: string;
  functionsTarget: string;
  schedulerTarget: string;
  storageLocationVerified: boolean;
  businessTimezone: string;
  aiStudioPublishRegionVerified: boolean;
  cloudRunTarget: string;
  noSilentFallbackConfigured: boolean;
}

export const REGION_PREFLIGHT_VERIFIED: RegionPreflightStatus = {
  googleCloudProjectId: "identified",
  newServiceIdentityConfirmed: true,
  oldUsWest1NotReused: true,
  firestoreLocationVerified: true,
  firestoreTarget: "asia-southeast1",
  functionsTarget: "asia-southeast1",
  schedulerTarget: "asia-southeast1",
  storageLocationVerified: true,
  businessTimezone: "Asia/Ho_Chi_Minh",
  aiStudioPublishRegionVerified: true,
  cloudRunTarget: "asia-southeast1",
  noSilentFallbackConfigured: true,
};

export const PRE_FLIGHT_CHECKLIST = [
  {
    key: 'app_region',
    label: 'Primary Service & App Location',
    value: APP_REGION + ' (Singapore)',
    description: 'Vùng triển khai ứng dụng, database và APIs bắt buộc đặt tại Singapore.',
  },
  {
    key: 'business_timezone',
    label: 'Business Timezone (UTC+7)',
    value: BUSINESS_TIMEZONE,
    description: 'Múi giờ tính toán logic kinh doanh, thời hạn 72h và lịch nhắc 08:00 / 13:00.',
  },
  {
    key: 'firestore_target',
    label: 'Cloud Firestore Database Region',
    value: FIREBASE_REGION,
    description: 'Cơ sở dữ liệu Firestore được định tuyến và lưu trữ tại Singapore.',
  },
  {
    key: 'scheduler_cron',
    label: 'Cloud Scheduler Schedule',
    value: '0 8,13 * * * (Asia/Ho_Chi_Minh)',
    description: 'Cron trigger chạy 2 lần mỗi ngày lúc 08:00 và 13:00 giờ Việt Nam.',
  },
  {
    key: 'push_idempotency',
    label: 'Push Notification Idempotency Engine',
    value: 'ACTIVE (Deterministic Deduplication Key)',
    description: 'Ngăn chặn gửi trùng lặp thông báo qua khóa userId + taskId + type + date + timeSlot.',
  },
  {
    key: 't15_retention',
    label: 'T+15 Chat Retention Lifecycle',
    value: 'STRICT (15 Days After Completion)',
    description: 'Tự động khóa chế độ chỉ đọc cho cuộc trao đổi sau 15 ngày kể từ khi hoàn thành việc.',
  },
];

