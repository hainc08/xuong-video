// Turn known tool errors into a sentence the user can act on.
const RULES = [
  [/daily free allocation/i, 'Cloudflare đã hết hạn mức tạo ảnh miễn phí hôm nay (làm mới lúc 7 giờ sáng). Bạn có thể tải ảnh lên thay.'],
  [/no credits remaining/i, 'Tài khoản OpenAI đã hết tiền.'],
  [/Không kết nối được CIT|CIT Voice Studio chưa sẵn sàng/, 'Mở CIT Voice Studio rồi thử lại.'],
];

const LIMIT = /(String|Array) must contain at (most|least) (\d+)/;

const issueText = ({path = [], message = ''}) => {
  const [, scene, ...field] = path;
  const m = LIMIT.exec(message);
  const rule = m ? `${m[2] === 'most' ? 'tối đa' : 'ít nhất'} ${m[3]} ${m[1] === 'String' ? 'ký tự' : 'mục'}` : message;
  const human = field.map((f) => (typeof f === 'number' ? f + 1 : f)); // count items from 1 for people
  const where = typeof scene === 'number' ? `Cảnh ${scene + 1}${human.length ? ` (${human.join(' › ')})` : ''}` : path.join(' › ');
  return `${where}: ${rule}`;
};

// scripts/validate.ts prints "INVALID:" followed by the zod issue list as JSON.
const validationMessage = (text) => {
  const at = text.indexOf('INVALID:');
  if (at < 0) return null;
  const start = text.indexOf('[', at);
  const end = text.lastIndexOf(']');
  try {
    const issues = JSON.parse(text.slice(start, end + 1));
    return `Kịch bản chưa hợp lệ: ${issues.map(issueText).join('; ')}. Sửa ở bước Bố cục rồi tạo lại.`;
  } catch {
    return 'Kịch bản chưa hợp lệ. Sửa ở bước Bố cục rồi tạo lại.';
  }
};

export const friendlyError = (text = '') => validationMessage(text) ?? RULES.find(([re]) => re.test(text))?.[1] ?? null;
