// One prompt to paste into ChatGPT (or Gemini) that makes every background image of a story in order,
// starting with a character portrait it keeps as the reference for the same face and outfit.

const STYLE_RULES =
  'Vertical portrait, full-bleed, no borders, no text, no watermark, no logos. Other people appear only as blurred shoulders, backs or arms, never with a visible face.';

export const buildBatchImagePrompt = (video) => {
  const images = video.images ?? [];
  if (!images.length) throw new Error('Kịch bản chưa có danh sách ảnh.');
  const name = video.characterName ?? 'the main character';
  const total = images.length + 1;
  return [
    `Tôi cần ${total} ảnh cho một video kể chuyện dọc (khổ 9:16). Hãy tạo theo đúng thứ tự dưới đây, bắt đầu từ ẢNH 0.`,
    '- Mỗi ảnh xong, ghi đúng tên file của ảnh đó ngay dưới ảnh.',
    '- Nếu tạo được nhiều ảnh trong một lượt thì cứ tạo liên tiếp. Nếu không, tạo một ảnh rồi chờ tôi gõ "tiếp".',
    `- Mọi ảnh phải là CÙNG MỘT NHÂN VẬT như ẢNH 0: cùng khuôn mặt, kiểu tóc, trang phục. Dùng ẢNH 0 làm tham chiếu cho tất cả ảnh sau.`,
    '- Khổ dọc (portrait, 1024x1536), ảnh tả thực kiểu điện ảnh, KHÔNG có chữ, logo hay hình mờ.',
    '',
    'CHARACTER (keep identical in every image):',
    video.character ?? '',
    '',
    'STYLE (all images):',
    `${video.imageStyle ?? ''} ${STYLE_RULES} Keep ${name} near the horizontal centre of the frame.`.trim(),
    '',
    'ẢNH 0 — character_ref.png',
    `Character reference portrait of ${name}. Standing, three-quarter body, facing the camera, neutral expression, plain softly lit background, even warm light.`,
    ...images.flatMap(({file, prompt}, i) => ['', `ẢNH ${i + 1} — ${file}`, prompt]),
    '',
  ].join('\n');
};
