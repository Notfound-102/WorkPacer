# Hướng dẫn Chỉnh sửa & Mở rộng Mã nguồn WorkPacer

Tài liệu này hướng dẫn chi tiết cấu trúc dự án, luồng dữ liệu giữa các tiến trình Electron, hệ thống giao diện **Liquid Glass** và cách tùy chỉnh từng phân hệ trong **WorkPacer**.

---

## 1. Bản đồ thư mục dự án

| Đường dẫn | Vai trò chính |
| :--- | :--- |
| `scripts/generate-icons.mjs` | Script thuần Node.js (`zlib` + SDF) sinh `build/icon.png` (512px), `build/icon.ico` (7 cỡ cho Windows) và `build/icon.icns` (macOS) không cần binary C++. |
| `src/shared/types.ts` | Toàn bộ kiểu dữ liệu (`AppSettings`, `QuickIdlePreset`, `WorkPacerAPI`, `MAX_QUICK_IDLE_PRESETS = 6`). |
| `src/shared/i18nResources.ts` | Từ điển đa ngôn ngữ (`vi`, `en`, `ja`) dùng chung cho cả Renderer và Main (System Tray, OS Notification). |
| `src/shared/reportFormatter.ts` | Bộ tổng hợp timeline và xuất Báo cáo cuối ca (`日報`) định dạng Tab (`\t`). |
| `src/main/dataMigration.ts` | Tự động di chuyển an toàn file SQLite (+ WAL/SHM) từ thư mục cũ `IdlePulse` sang `WorkPacer`. |
| `src/main/database.ts` | SQLite (`better-sqlite3`) chế độ WAL, migration cột an toàn (`ensureColumn`), bảng `quick_idle_presets` sắp xếp theo tần suất. |
| `src/main/idleTracker.ts` | Core Tracking Engine (`Active`, `Auto Idle`, `Manual Idle`, `Paused`), 20-20-20, ngồi lâu, Pomodoro. |
| `src/main/windowManager.ts` | Quản lý 4 cửa sổ, đồng bộ `nativeTheme.themeSource` + `titleBarOverlay`, lưu tọa độ & kích thước co giãn (`resizable: true`), hiệu ứng fade mượt. |
| `src/main/trayManager.ts` | Sinh icon System Tray HiDPI (`@1x` + `@2x`) theo 4 trạng thái (*Active, Idle, Pomodoro, Paused*) và menu sắp xếp theo tần suất. |
| `src/renderer/src/index.css` | Hệ thống biến màu **Liquid Glass** (Base Glass, Elevated Glass kèm *Specular Rim*, Ambient Mesh, Reduce Transparency). |
| `src/renderer/src/components/WorkPacerLogo.tsx` | Logo vector SVG chuẩn của WorkPacer và bộ ánh xạ icon nút nghỉ nhanh. |
| `src/renderer/src/components/QuickPresetsManager.tsx` | Giao diện thêm/sửa/xóa nút Idle chủ động (tối đa 6 nút). |

---

## 2. Các điểm chỉnh sửa thường gặp

- **Đổi bảng màu Liquid Glass & Độ tương phản chữ:** Mở `src/renderer/src/index.css` tại `:root` (Light Mode) và `.dark` (Dark Mode). Công tắc **Giảm hiệu ứng trong suốt** điều khiển class `html.reduce-transparency`.
- **Đổi giới hạn số lượng nút Idle chủ động:** Chỉnh hằng số `MAX_QUICK_IDLE_PRESETS` trong `src/shared/types.ts` (mặc định là `6`). Thứ tự hiển thị luôn tự động lấy từ câu truy vấn `ORDER BY usage_count DESC, last_used_at DESC` trong `src/main/database.ts`.
- **Sinh lại bộ Icon đóng gói sau khi sửa thiết kế:** Chỉnh hàm `sampleWorkPacerPixel` trong `scripts/generate-icons.mjs` rồi chạy `npm run generate:icons`.
- **Đổi mẫu xuất Báo cáo cuối ngày (日報):** Chỉnh `formatNippoDateHeader` và `formatDailyReportPlainText` trong `src/shared/reportFormatter.ts`.

---

## 3. Lệnh kiểm thử & Đóng gói

```bash
npm run typecheck      # Kiểm tra kiểu TypeScript (0 lỗi)
npm test               # Chạy toàn bộ unit test (Vitest)
npm run generate:icons # Sinh build/icon.png, build/icon.ico, build/icon.icns
npm run build          # Build bundle Electron (out/main, out/preload, out/renderer)
npm run dist:win       # Đóng gói NSIS Setup & Portable cho Windows
npm run dist:mac       # Đóng gói DMG & ZIP cho macOS
```
