# WorkPacer

**WorkPacer** (tiền thân là *IdlePulse*) là ứng dụng desktop đa nền tảng (**Windows & macOS**) sở hữu ngôn ngữ thiết kế **Liquid Glass** hiện đại, giúp theo dõi thông minh nhịp độ làm việc & thời gian rời máy (*idle time*), bảo vệ sức khỏe (quy tắc 20-20-20 toàn màn hình, cảnh báo ngồi lâu, Pomodoro) và tự động tổng hợp **Báo cáo hằng ngày cuối ca (日報 / Daily Report)** định dạng chuẩn Tab (`\t`).

## Điểm nổi bật

- **Thiết kế Liquid Glass (Light / Dark / System):**
  - Hệ thống kính lỏng 3 tầng (`Base Glass`, `Elevated Glass` kèm viền khúc xạ ánh sáng *Specular Rim Highlight*, nền *Ambient Mesh Gradient*).
  - Đồng bộ tức thời khung cửa sổ & thanh tiêu đề hệ điều hành (`nativeTheme.themeSource` + `titleBarOverlay` trên Windows 10/11).
  - **Floating Sidebar** hiển thị trọn vẹn trong một khung hình, hoàn toàn không có thanh cuộn dọc.
  - Công tắc **Giảm hiệu ứng trong suốt** (`Reduce Transparency`) tối ưu hiệu năng GPU trên máy cấu hình thấp.
- **Tự động di chuyển dữ liệu an toàn:** Tự động phát hiện và chuyển toàn bộ lịch sử SQLite (+ WAL) từ `IdlePulse` sang `WorkPacer` mà không mất dữ liệu.
- **Sticky Widget & Quick Tag Popup co giãn linh hoạt (`Resizable`):**
  - Cho phép kéo giãn kích thước tự do, lưu lại cả tọa độ (`x`, `y`) lẫn kích thước (`width`, `height`), điều chỉnh độ trong suốt lớp kính mà vẫn giữ chữ & nút sắc nét.
- **Tùy chỉnh nút Idle chủ động (Tối đa 6 nút & Tự xếp theo tần suất):**
  - Thêm, sửa tên/icon/phân loại và xóa nút nghỉ chủ động; tự động sắp xếp theo `usage_count DESC, last_used_at DESC`.
- **Thuần JS/TS, dễ kéo về build ngay trên Windows & macOS:**
  - Chỉ sử dụng duy nhất `better-sqlite3` (có sẵn N-API prebuild) cho SQLite local; bộ sinh icon đa kích thước (`build/icon.png`, `build/icon.ico`, `build/icon.icns`) viết thuần Node.js không phụ thuộc `sharp` hay `node-canvas`.
- **Đa ngôn ngữ Realtime (`vi` / `en` / `ja`):** Chuyển đổi không cần khởi động lại trên toàn bộ cửa sổ, Sticky Widget, System Tray HiDPI 4 trạng thái (*Active, Idle, Pomodoro, Paused*), OS Notification và màn hình nghỉ.

## Lệnh chạy & Đóng gói

```bash
# 1. Cài đặt dependencies
npm install

# 2. Sinh lại bộ icon đa phân giải (PNG 512px, Windows ICO 7 cỡ, macOS ICNS)
npm run generate:icons

# 3. Chạy ứng dụng Electron ở chế độ Development
npm run dev

# 4. Kiểm tra kiểu TypeScript & Chạy bộ kiểm thử tự động (Vitest)
npm run typecheck
npm test

# 5. Đóng gói bộ cài đặt cho Windows (NSIS Setup + Portable) & macOS (DMG + ZIP)
npm run dist:win
npm run dist:mac
```
