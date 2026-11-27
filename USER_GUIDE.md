# Hướng dẫn sử dụng WorkPacer

Chào mừng bạn dùng thử **WorkPacer** — trợ lý desktop nhỏ gọn giúp theo dõi nhịp độ làm việc thực tế, nhắc nhở bảo vệ sức khỏe (mắt & cột sống) và **tự động tổng hợp Báo cáo cuối ngày (日報)** chỉ với 1 cú click!

> **Cam kết quyền riêng tư:** 100% dữ liệu của bạn được lưu nội bộ trên máy tính cá nhân (SQLite). WorkPacer **không** kết nối cloud, **không** chụp màn hình và **không** ghi lại nội dung phím gõ của bạn.

---

## 1. Cài đặt & Mở ứng dụng lần đầu

### Trên Windows (Windows 10 / 11)
- **Bản cài đặt (`WorkPacer-...-Setup.exe`):** Nhấn đúp để cài đặt, biểu tượng **WorkPacer** sẽ tự động xuất hiện trên Desktop và Start Menu.
- **Bản chạy ngay (`WorkPacer-...-Portable.exe`):** Mở trực tiếp không cần cài đặt.
- *Lưu ý nếu Windows hiện cảnh báo "Windows protected your PC" (SmartScreen):* Do đây là bản dùng thử chưa ký chứng chỉ thương mại, bạn chỉ cần bấm **More info (Thông tin thêm)** → **Run anyway (Vẫn chạy)**.

### Trên macOS (Intel & Apple Silicon)
- Mở file `WorkPacer-....dmg` và kéo biểu tượng **WorkPacer** vào thư mục **Applications**.
- *Lưu ý lần đầu mở app trên macOS:* Nếu hệ thống báo không rõ nhà phát triển, hãy nhấn chuột phải vào biểu tượng WorkPacer → chọn **Open (Mở)** → xác nhận **Open**.

---

## 2. Thiết lập nhanh trong 1 phút

Khi mở ứng dụng lần đầu, vào mục **Cài đặt (Settings)** ở thanh menu bên trái để chỉnh 4 thông tin cơ bản:

1. **Tên người dùng:** Nhập tên của bạn (sẽ tự động xuất hiện trên tiêu đề báo cáo cuối ngày `YYYY/MM/DD (Tên của bạn)日報`).
2. **Ca làm việc & Giờ nghỉ trưa:** Mặc định là `08:30 – 17:30` và nghỉ trưa `12:00 – 13:00` (bạn có thể đổi theo ca của mình).
3. **Ngôn ngữ & Giao diện:** Chọn **Tiếng Việt / English / 日本語** và chế độ **Sáng / Tối / Theo hệ thống** — mọi thứ thay đổi tức thì không cần khởi động lại app.
4. **Ngưỡng tính Idle:** Mặc định là **2 phút** không thao tác chuột/bàn phím.
   - *Mẹo hay:* Mục **Ngoại lệ thông minh (Smart Exceptions)** đã bật sẵn chế độ *Bỏ qua*, nên khi bạn **đang họp online (Mic bật)** hoặc **xem video toàn màn hình**, WorkPacer sẽ không tính nhầm là bạn rời máy.

---

## 3. Hướng dẫn sử dụng hằng ngày

### 3.1. Cửa sổ nổi Sticky Widget (Trợ thủ tiện nhất!)
Bấm nút **Sticky Widget nổi** ở góc dưới thanh menu bên trái để bật cửa sổ mini dạng kính mờ nổi trên desktop:
- **Ghim luôn nổi trên cùng:** Bấm biểu tượng **Cái ghim (Pin)** ở thanh tiêu đề của Widget để luôn thấy đồng hồ khi làm việc trên các phần mềm khác.
- **Kéo thả & Co giãn kích thước:** Kéo thanh tiêu đề để đặt Widget ở bất kỳ góc nào, hoặc kéo cạnh/góc cửa sổ để phóng to/thu nhỏ. App tự nhớ vị trí & kích thước cho lần mở sau.
- **Chỉnh độ trong suốt:** Bấm biểu tượng thanh trượt để chỉnh độ mờ lớp kính theo sở thích (chữ và nút bấm vẫn luôn rõ nét).
- **Ghi nhanh việc đang làm:** Gõ tên công việc vào ô nhập trên Widget (ví dụ: `Fix bug login`, `Họp với khách hàng`) rồi nhấn **Enter**. WorkPacer sẽ tự ghi nhận mốc giờ bắt đầu – kết thúc để tối tổng hợp báo cáo cho bạn!

### 3.2. Nút Idle chủ động (Tối đa 6 nút — Tự học theo thói quen)
Trước khi rời máy, bạn có thể bấm nhanh 1 nút trạng thái trên **Sticky Widget**, **Tổng quan** hoặc **System Tray** (mặc định có sẵn: *Đi ăn trưa, Họp, Nghỉ ngắn*):
- **Tự sắp xếp thông minh:** Nút nào bạn bấm nhiều nhất sẽ tự động nhảy lên vị trí đầu tiên.
- **Tự tùy biến tối đa 6 nút:** Bấm biểu tượng **Quản lý nút** (trên Widget, Dashboard hoặc trong Cài đặt) để thêm, sửa tên/biểu tượng hoặc xóa các trạng thái theo thói quen của riêng bạn (ví dụ: *Đi pha cà phê, Nghe điện thoại, Nghỉ mắt*).
- Khi quay lại, chỉ cần bấm **Quay lại làm việc** để tiếp tục ghi nhận thời gian Active.

### 3.3. Gắn thẻ nhanh khi quay lại máy (Quick Tag Popup)
Nếu bạn rời máy quá **5 phút** (có thể chỉnh trong Cài đặt) mà quên bấm nút trước đó, ngay khi bạn chạm lại chuột/bàn phím, một thẻ nhỏ sẽ trượt ra ở góc dưới màn hình hỏi:
> *"Bạn vừa rời máy X phút. Bạn vừa làm gì?"*

Bạn chỉ cần 1 click chọn nhanh (**Ăn uống, Nghỉ ngơi, Họp, Ra ngoài, Ngủ, Khác**) hoặc bấm **Bỏ qua**. Các phiên gắn thẻ **Họp** sẽ được tự động đưa vào báo cáo cuối ngày!

### 3.4. Chăm sóc sức khỏe & Pomodoro
- **Quy tắc 20-20-20 bảo vệ mắt:** Mỗi 20 phút nhìn màn hình liên tục, WorkPacer sẽ phủ một lớp kính mờ dịu mắt kèm vòng đếm ngược **20 giây** nhắc bạn nhìn ra xa khoảng 6 mét. Bạn có thể bấm **Nhắc lại sau 5 phút** nếu đang dở tay.
- **Cảnh báo ngồi lâu:** Nhắc bạn đứng dậy vươn vai khi làm việc liên tục quá **90 phút**.
- **Pomodoro & Mục tiêu ngày:** Vào mục **Công việc & Pomo** để chạy đồng hồ tập trung (`25/5`, `50/10` hoặc tự chỉnh) và theo dõi thanh tiến độ mục tiêu Active trong ngày (mặc định `4 giờ/ngày`).

### 3.5. Xem thống kê & Xuất dữ liệu (Dashboard)
Trong mục **Tổng quan**, bạn có thể xem:
- **Biểu đồ Active & Idle** theo *Giờ / Ngày / Tuần* và tỷ lệ phần trăm tập trung trong ngày.
- **Dòng thời gian trong ngày (Timeline)** và **Bản đồ nhiệt (Heatmap 7 ngày × 24 giờ)** để biết khung giờ nào mình hay mất tập trung nhất.
- **Xuất lịch sử:** Chọn khoảng ngày rồi bấm **Xuất CSV** (mở đẹp trên Excel hỗ trợ đầy đủ tiếng Việt & tiếng Nhật) hoặc **Xuất JSON**.

### 3.6. Tạo & Copy Báo cáo cuối ngày (日報 / Daily Report)
Đến giờ tan ca đã cài đặt, WorkPacer sẽ gửi thông báo nhắc bạn mở mục **Báo cáo (日報)**:
1. Ứng dụng đã **tự động dựng sẵn timeline** các đầu việc trong ngày của bạn.
2. Tích chọn **Ẩn giờ nghỉ trưa (`12:00–13:00`)** và **Gộp nghỉ vụn dưới `5` phút** để báo cáo gọn gàng, sạch sẽ.
3. Bạn có thể sửa nhanh nội dung, giờ bắt đầu/kết thúc, thêm hoặc xóa dòng ngay trên giao diện trực quan.
4. Bấm **Sao chép báo cáo (Copy)** và dán (`Ctrl+V` / `Cmd+V`) thẳng vào **Chatwork, Slack, Microsoft Teams hoặc Email** với định dạng chuẩn Tab (`\t`):

```text
2026/11/27 (Tên của bạn)日報
8:30~9:30	Review PR & họp đầu ngày
9:30~12:00	Phát triển tính năng mới
13:00~15:20	Kiểm thử & sửa lỗi giao diện
15:30~17:30	Viết tài liệu & bàn giao
```

---

## 4. Nhận biết nhanh trên Khay hệ thống (System Tray)

Biểu tượng đồng hồ nhỏ của WorkPacer ở góc dưới Taskbar (Windows) hoặc thanh Menu Bar (macOS) sẽ đổi màu chấm trạng thái theo thời gian thực:
- **Chấm xanh ngọc:** Đang làm việc (*Active*).
- **Chấm vàng hổ phách:** Đang rời máy / Nghỉ (*Idle*).
- **Chấm đỏ san hô:** Đang trong phiên tập trung *Pomodoro*.
- **Chấm xám:** Đang *Tạm dừng theo dõi*.

Nhấn chuột phải vào biểu tượng này để bật/tắt nhanh Sticky Widget, chuyển trạng thái nghỉ, đổi ngôn ngữ hoặc thoát hẳn ứng dụng.

---

## 5. Câu hỏi thường gặp (FAQ)

- **Tôi bấm nút `X` đóng cửa sổ nhưng ứng dụng không tắt?**
  Đúng rồi! WorkPacer sẽ thu nhỏ xuống khay hệ thống (System Tray) để tiếp tục đo thời gian ngầm cực nhẹ. Nếu muốn thoát hoàn toàn, hãy nhấn chuột phải vào biểu tượng WorkPacer dưới khay hệ thống → chọn **Thoát WorkPacer**.
- **Máy tính của tôi hơi yếu / dùng pin muốn mượt hơn?**
  Vào **Cài đặt** → bật công tắc **Giảm hiệu ứng trong suốt (Reduce Transparency)** để giảm tải GPU mà giao diện vẫn gọn đẹp.
- **Nếu máy tính Sleep hoặc tắt máy qua đêm thì có bị mất dữ liệu không?**
  Không. WorkPacer tự lưu mốc hoạt động định kỳ xuống SQLite nên khi bạn mở máy lại, ứng dụng sẽ tự động khôi phục chính xác khoảng thời gian nghỉ qua đêm.
- **Dữ liệu của tôi được lưu ở đâu?**
  - **Windows:** `%APPDATA%\WorkPacer\workpacer.sqlite`
  - **macOS:** `~/Library/Application Support/WorkPacer/workpacer.sqlite`

Chúc bạn có những ngày làm việc thật tập trung, khỏe mạnh và luôn gửi báo cáo cuối ngày thật nhanh gọn cùng **WorkPacer**!
