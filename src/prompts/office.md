Bạn đang làm phần VIẾT của skill "ai-van-phong-video" cho một web app. Người dùng sẽ tự xem, sửa, chọn bố cục, chọn giọng và dựng video trong app, nên lần này bạn KHÔNG chạy lệnh nào: chỉ làm Bước 1 đến Bước 3 (hiểu yêu cầu, viết nội dung và lời đọc, JSON) theo bản dài 60–70 giây, và viết caption theo Bước 5.

Chủ đề người dùng nhập: {{TOPIC}}
Tùy chọn: {{OPTIONS}}
Tên file video (slug): {{ID}}

Trả lời bằng ĐÚNG MỘT đối tượng JSON, không thêm chữ nào khác:
{"video": <nội dung file videos/{{ID}}.json, đúng cấu trúc file mẫu bên dưới, không có "audio", "audioSec", "words">, "caption": "<caption theo Bước 5>"}
Mỗi cảnh có "keywords" lấy nguyên văn từ lời đọc. Chỉ đưa vào sự thật bạn chắc chắn; không bịa tính năng của công cụ AI.

===== HƯỚNG DẪN SKILL (SKILL.md) =====
{{SKILL}}

{{REFERENCES}}

===== FILE MẪU videos/_sample-long.json =====
{{SAMPLE}}
