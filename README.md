# IdlePulse

**IdlePulse** là ứng dụng desktop đa nền tảng (**Windows & macOS**) theo dõi thông minh thời gian không sử dụng máy tính (*idle time*), ghi nhận đầu việc theo thời gian thực, bảo vệ sức khỏe (quy tắc 20-20-20, cảnh báo ngồi lâu, Pomodoro) và tự động tổng hợp **Báo cáo hằng ngày cuối ca (日報 / Daily Report)** định dạng chuẩn Tab (`\t`).

## Kiến trúc & Tech Stack

- **Desktop Shell:** Electron + Multi-window Architecture (Main Window, Floating Sticky Widget, Quick Tag Return Popup, 20-20-20 Break Overlay, System Tray)
- **Frontend:** React 19 + TypeScript + Vite (`electron-vite`) + Tailwind CSS + Recharts
- **Local Database:** SQLite (`better-sqlite3` chế độ WAL) — 100% dữ liệu lưu trữ cục bộ trên máy người dùng, offline & bảo mật quyền riêng tư.
- **Đa ngôn ngữ (Realtime i18n):** `i18next` + `react-i18next` đồng bộ tức thời **Tiếng Việt (`vi`)**, **Tiếng Anh (`en`)**, **Tiếng Nhật (`ja`)** trên toàn bộ UI, Sticky Widget, System Tray, OS Notification và màn hình nghỉ mà không cần khởi động lại ứng dụng.

## Tính năng cốt lõi

1. **Core Idle Tracking Engine (`src/main/idleTracker.ts` & `src/main/smartExceptions.ts`):**
   - Đo chính xác qua `powerMonitor.getSystemIdleTime()`, ngưỡng tùy chỉnh `1–15 phút` (mặc định `2 phút`), tự động lùi mốc bắt đầu phiên nghỉ về đúng thời điểm ngừng thao tác.
   - **Smart Exceptions:** Tự động phát hiện cuộc gọi Mic/Audio hoặc xem video toàn màn hình trên macOS (`pmset assertions`) & Windows (`CapabilityAccessManager` + `SHQueryUserNotificationState`) với chế độ *Bỏ qua* hoặc *Gắn cờ riêng*.
   - **Lock / Sleep / Shutdown Resilience:** Lắng nghe `suspend`, `resume`, `lock-screen`, `unlock-screen`, `shutdown` kết hợp ghi SQLite heartbeat mỗi 15 giây để khôi phục khoảng gián đoạn qua đêm hoặc mất điện.
   - Phân biệt **Auto Idle** vs **Manual Idle** và tự phân loại thời lượng: **Micro-break (`< 5p`)**, **Short break (`5–30p`)**, **Away / Long (`> 30p`)**.
2. **Return UX (`src/renderer/src/windows/ReturnPopup.tsx`):**
   - Khi quay lại sau khoảng nghỉ dài (`> 5 phút`, tùy chỉnh được), hiển thị góc màn hình **Quick Tag Popup** để gắn nhanh thẻ *Ăn uống, Nghỉ ngơi, Họp, Ra ngoài, Ngủ, Khác* hoặc *Bỏ qua*.
3. **Dashboard & Analytics (`src/renderer/src/components/DashboardView.tsx`):**
   - Biểu đồ Active/Idle theo **Giờ / Ngày / Tuần**, tỷ lệ **Active vs Idle %**, **Intraday Timeline**, **7×24 Hourly Heatmap**, **Top khung giờ rời máy**, và xuất **CSV (UTF-8 BOM) / JSON** theo khoảng ngày.
4. **Sức khỏe & Năng suất (`src/renderer/src/components/HealthView.tsx`, `TasksPomodoroView.tsx`):**
   - Quy tắc **20-20-20** kèm cửa sổ đếm ngược 20 giây, cảnh báo ngồi lâu liên tục (`90 phút`), nhắc nhẹ quay lại làm việc trong ca, **Pomodoro (`25/5`, `50/10`, tùy chỉnh)** và thanh tiến độ **Daily Goal**.
5. **Floating Sticky Widget (`src/renderer/src/windows/StickyWidget.tsx`):**
   - Cửa sổ nổi không viền (**Always-on-Top**), kéo thả tự do, thu gọn/mở rộng, chỉnh độ mờ (`opacity`), tự nhớ tọa độ màn hình, nhập nhanh đầu việc (`Quick Task Input`) và bật nhanh Manual Idle.
6. **Báo cáo cuối ca — Daily Report / 日報 (`src/renderer/src/components/DailyReportView.tsx`):**
   - Tự động nhắc khi đến giờ kết thúc ca, tổng hợp timeline từ các đầu việc + phiên Active/Meeting, tùy chọn ẩn giờ nghỉ trưa (`12:00–13:00`) và gộp nghỉ vụn `< X phút`, chỉnh sửa trực quan và sao chép plain-text dùng ký tự Tab (`\t`) chuẩn mẫu `YYYY/MM/DD (Tên người dùng)日報`.

## Hướng dẫn chạy & Đóng gói

```bash
# 1. Cài đặt dependencies
npm install

# 2. Chạy ứng dụng Electron ở chế độ Development
npm run dev

# 3. Chạy kiểm thử tự động (Vitest + SQLite)
npm test

# 4. Kiểm tra kiểu TypeScript & Build bundle
npm run typecheck
npm run build

# 5. Đóng gói bộ cài đặt cho Windows (NSIS + Portable) & macOS (DMG + ZIP x64/arm64)
npm run dist:win
npm run dist:mac
```
