# WorkPacer (v1.2.0)

**WorkPacer** là ứng dụng desktop đa nền tảng (**Windows & macOS**) sở hữu ngôn ngữ thiết kế **Liquid Glass** hiện đại, giúp theo dõi thông minh nhịp độ làm việc & thời gian rời máy (*idle time*), bảo vệ sức khỏe (quy tắc 20-20-20 toàn màn hình, cảnh báo ngồi lâu, Pomodoro nổi) và tự động tổng hợp **Báo cáo hằng ngày cuối ca (Daily Report)** định dạng chuẩn Tab (`\t`).

## Điểm nổi bật trên v1.2.0

- **Cửa sổ nổi trong suốt không lộ góc vuông trên Windows:**
  - Áp dụng đồng bộ `transparent: true`, `frame: false`, `hasShadow: false`, `backgroundColor: '#00000000'` kết hợp đệm đổ bóng CSS bên trong cho cả **Widget ghim ngoài màn hình**, **Pomodoro nổi** và **Idle Modal**.
- **Ghim Pomodoro nổi 3 phong cách đồng bộ:**
  - Chuyển đổi trực tiếp giữa **Đồng hồ kim (Analog)**, **Đồng hồ số (Digital)** và **Vòng đếm ngược (Circular Ring)** đồng bộ giữa trang chính, Cài đặt và cửa sổ Pomodoro nổi.
- **Timeline thông minh hỗ trợ Kéo thả (Drag & Drop):**
  - Tự động sắp xếp theo giờ khi thêm dòng mới, cho phép kéo thả đổi vị trí có kiểm tra ràng buộc thứ tự thời gian, và tự động cập nhật tức thì qua IPC `timeline:changed` ngay khi người dùng lưu lý do rời máy từ cửa sổ Idle Modal căn giữa màn hình.
- **Tùy chỉnh tiêu đề báo cáo & Kiểm tra cập nhật:**
  - Cho phép đặt tiêu đề báo cáo tùy ý trong Cài đặt (mặc định: `Daily Report`).
  - Tích hợp **Check for Update** qua GitHub Releases API (`Notfound-102/WorkPacer`) tự động khi mở app và kiểm tra thủ công trong Cài đặt.

## Lệnh chạy & Đóng gói

```bash
npm install
npm run generate:icons
npm run dev
npm run typecheck
npm test
npm run dist:win
npm run dist:mac
```
