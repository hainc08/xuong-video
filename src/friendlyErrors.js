// Turn known tool errors into a sentence the user can act on.
const RULES = [
  [/daily free allocation/i, 'Cloudflare đã hết hạn mức tạo ảnh miễn phí hôm nay (làm mới lúc 7 giờ sáng). Bạn có thể tải ảnh lên thay.'],
  [/no credits remaining/i, 'Tài khoản OpenAI đã hết tiền.'],
  [/Không kết nối được CIT|CIT Voice Studio chưa sẵn sàng/, 'Mở CIT Voice Studio rồi thử lại.'],
];

export const friendlyError = (text = '') => RULES.find(([re]) => re.test(text))?.[1] ?? null;
