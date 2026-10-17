# Xưởng Video — thiết kế

## Mục đích
Một web app chạy trên máy người dùng để làm video dọc 9:16 mà không phải gõ lệnh: chọn skill, gõ chủ đề,
app viết kịch bản, người dùng sửa, thêm ảnh (tải lên hoặc AI tạo) hoặc chọn bố cục, chọn giọng, bấm tạo video.
App không thay thế hai skill có sẵn mà điều khiển chúng: dữ liệu vẫn là file JSON và thư mục ảnh trong
workspace của từng skill, nên video làm trên app và video làm qua Claude Code trong chat dùng lẫn được.

## Người dùng đã quyết định
- Luồng 6 bước, kiểu "đi từng bước" (mỗi màn hình một việc): **Chọn skill → Chủ đề → Kịch bản →
  Ảnh/Bố cục → Giọng đọc → Tạo video**.
- Hai skill lúc đầu:
  - `ke-chuyen-video` (Kể chuyện, page Chuyện Đời & Nhân Tâm), workspace `D:\ke-chuyen-video`.
    Bước 4 = ảnh nền từng cảnh: tải ảnh lên, AI tạo, hoặc tạo lại một ảnh.
  - `ai-van-phong-video` (Mẹo AI văn phòng), workspace `C:\Users\admin\ai-van-phong-video`.
    Bước 4 = chọn kiểu bố cục từng cảnh (thẻ số liệu, so sánh, gạch đầu dòng, prompt mẫu, các bước,
    câu khẳng định, con số lớn, ảnh) và sửa chữ; kiểu "Ảnh" cho tải ảnh chụp màn hình.
- Kịch bản do **Claude Code trên máy** viết (lệnh `claude`), dùng hướng dẫn của chính skill đó.
- Thêm skill mới sau này không phải viết lại app.

## Hành vi cần có
- Bước 1: thẻ cho mỗi skill (tên, mô tả, ảnh minh họa, bước 4 sẽ là gì).
- Bước 2: ô chủ đề + vài tùy chọn của skill (thời lượng; kể chuyện thêm bối cảnh). Bấm "Viết kịch bản".
- Bước 3: mỗi cảnh một ô sửa lời đọc; từ khóa phụ đề sửa được; nút viết lại riêng một cảnh; ước tính thời lượng
  (số từ ÷ tốc độ đọc của skill). Kể chuyện còn có hai dòng chữ hook (≤ 18 ký tự mỗi dòng, báo khi quá).
- Bước 4 (kể chuyện): thẻ mỗi ảnh có xem trước, nhãn "AI tạo / Ảnh tải lên / Trống", nút ⬆ Tải, ✨ AI, ↻ Tạo lại,
  ô sửa mô tả ảnh; nút "Tạo tất cả ảnh còn thiếu". Lỗi hết hạn mức (Cloudflare 429 / OpenAI hết tiền) hiện
  thành câu dễ hiểu, không làm hỏng dự án.
- Bước 4 (văn phòng): mỗi cảnh chọn kiểu, form chữ theo kiểu đó, xem trước dạng thẻ.
- Bước 5: danh sách giọng (CIT Voice Studio + Edge), lọc nam/nữ/miền/phong cách, nút ▶ nghe thử câu đầu,
  thanh tốc độ; báo nếu CIT chưa mở.
- Bước 6: chạy chuỗi lệnh của skill, hiện từng bước và phần trăm dựng video; xong thì xem video, tải video,
  ảnh bìa (nếu có), caption. Đóng tab không làm dừng việc tạo.
- Có danh sách dự án đã làm để mở lại và sửa tiếp.

## Ràng buộc
- Chạy cục bộ, chỉ nghe ở `127.0.0.1`. Một người dùng.
- Windows 11, Node 20, Python 3.14, ffmpeg có sẵn. CIT Voice Studio ở `http://127.0.0.1:8001`.
- Không in hay gửi khóa trong `.env` ra trình duyệt.
- Giao diện tiếng Việt có dấu.

## Không làm (lần này)
- Đăng video lên mạng xã hội, đăng nhập, nhiều người dùng, chạy trên máy chủ.
- Sửa video theo dòng thời gian kiểu phần mềm dựng phim.

## Để người làm tự quyết
Bố cục chi tiết, màu (theo bản phác: nền xanh navy, nhấn vàng `#d79a2b`), thư viện nhỏ nếu cần.
Bản phác: `D:\video-motion\.superpowers\mockups\png\`.
