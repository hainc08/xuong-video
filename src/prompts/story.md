Bạn đang làm phần VIẾT của skill "ke-chuyen-video" cho một web app. Người dùng sẽ tự xem, sửa, tạo ảnh và dựng video trong app, nên lần này bạn KHÔNG chạy lệnh nào, KHÔNG tạo ảnh, KHÔNG tạo giọng: chỉ làm Bước 1 đến Bước 4 (câu chuyện, lời đọc, kế hoạch ảnh, JSON) và viết caption theo Bước 8.

Chủ đề người dùng nhập: {{TOPIC}}
Tùy chọn: {{OPTIONS}}
Mã video (trường "id"): {{ID}}

Trả lời bằng ĐÚNG MỘT đối tượng JSON, không thêm chữ nào khác:
{"video": <nội dung file videos/{{ID}}.json, đúng cấu trúc file mẫu bên dưới, không có "timeline">, "caption": "<caption Facebook theo Bước 8>"}
Trường "tts" để {"engine": "cit", "voice": "Thiện Minh", "speed": 0.8}. Ảnh nào cũng phải nằm trong "images" và mọi "at", "keywords" phải có nguyên văn trong lời đọc (bỏ ~).

===== HƯỚNG DẪN SKILL (SKILL.md) =====
{{SKILL}}

{{REFERENCES}}

===== FILE MẪU videos/_sample.json =====
{{SAMPLE}}
