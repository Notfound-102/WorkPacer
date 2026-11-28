# Hướng dẫn sử dụng WorkPacer (v1.2.0)

Chào mừng bạn dùng thử **WorkPacer** — trợ lý desktop nhỏ gọn giúp theo dõi nhịp độ làm việc thực tế, nhắc nhở bảo vệ sức khỏe (mắt & cột sống), ghim đồng hồ Pomodoro nổi và **tự động tổng hợp Báo cáo cuối ngày** chỉ với 1 cú click!

> **Cam kết quyền riêng tư:** 100% dữ liệu của bạn được lưu nội bộ trên máy tính cá nhân (SQLite). WorkPacer **không** kết nối cloud để gửi dữ liệu cá nhân, **không** chụp màn hình và **không** ghi lại nội dung phím gõ của bạn.

---

## 1. Thiết lập nhanh trong 1 phút

Khi mở ứng dụng lần đầu, vào mục **Cài đặt (Settings)** ở thanh menu bên trái để chỉnh các thông tin cơ bản:

1. **Tên người dùng & Tiêu đề báo cáo:** Nhập tên của bạn và tiêu đề báo cáo mong muốn (mặc định là `Daily Report` — sẽ hiển thị ở dòng đầu dạng `YYYY/MM/DD (Tên của bạn) Daily Report`).
2. **Ca làm việc & Giờ nghỉ trưa:** Mặc định là `08:30 – 17:30` và nghỉ trưa `12:00 – 13:00`.
3. **Ngôn ngữ & Giao diện:** Chọn **Tiếng Việt / English / 日本語** và chế độ **Sáng / Tối / Theo hệ thống** — thay đổi tức thì không cần khởi động lại app.
4. **Kiểm tra cập nhật:** Ứng dụng tự động kiểm tra phiên bản mới từ GitHub Releases khi khởi động, hoặc bạn có thể bấm nút **Kiểm tra cập nhật (Check for Update)** bất kỳ lúc nào.

---

## 2. Các tính năng nổi bật hằng ngày

### 2.1. Ghim ra màn hình (Floating Widget) & Ghim Pomodoro nổi
- Bấm nút **Ghim ra màn hình** ở góc dưới thanh menu trái để bật cửa sổ mini trong suốt nổi trên mọi ứng dụng:
  - Ghi nhanh đầu việc đang làm + nhấn **Enter** để lưu mốc thời gian vào Timeline.
  - Bấm nhanh các nút **Idle chủ động** (tối đa 6 nút, tự động xếp nút hay dùng nhất lên đầu).
  - Chỉnh **Độ trong suốt**, thu gọn/mở rộng và kéo giãn kích thước tùy ý.
- Trong mục **Công việc & Pomo** (hoặc Cài đặt), bấm **Ghim Pomodoro nổi** để đưa đồng hồ tập trung ra màn hình với **3 kiểu hiển thị đồng bộ**:
  1. **Đồng hồ kim (Analog)**
  2. **Đồng hồ số (Digital)**
  3. **Vòng đếm ngược (Circular Ring)**

### 2.2. Nhập lý do khi quay lại máy (Idle Modal căn giữa màn hình)
Khi bạn rời máy quá ngưỡng cài đặt (mặc định **5 phút**), ngay khi quay lại thao tác, cửa sổ **Idle Modal** sẽ hiện ở chính giữa màn hình:
- Chọn thẻ (*Ăn uống, Nghỉ ngơi, Họp, Ra ngoài, Ngủ, Khác*) và/hoặc gõ ghi chú chi tiết rồi bấm **Lưu vào Timeline**.
- Dòng thời gian mới sẽ **lập tức xuất hiện trên Timeline** ở cửa sổ chính mà không cần tải lại ứng dụng!

### 2.3. Chỉnh sửa, Kéo thả Timeline & Sao chép Báo cáo cuối ngày
Mở mục **Báo cáo** trên thanh bên trái:
- **Thêm dòng mới:** Danh sách Timeline sẽ tự động sắp xếp lại theo đúng thứ tự thời gian.
- **Kéo thả (Drag & Drop):** Giữ biểu tượng chấm ở đầu dòng để kéo đổi vị trí. Ứng dụng tự kiểm tra ràng buộc thời gian (không cho đặt việc có giờ muộn hơn đứng trước việc có giờ sớm hơn trừ khi bạn sửa lại giờ trước). Nút **Sắp xếp giờ** luôn sẵn sàng khi cần.
- Xem trực tiếp ở khung **Bản xem trước chuẩn Plain-Text** và bấm **Sao chép báo cáo (Copy)** để dán đẹp vào **Chatwork, Slack, Microsoft Teams hoặc Email**!
