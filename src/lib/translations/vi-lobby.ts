import type { TranslationEntry } from '@/lib/i18n'

/** Vietnamese strings for the public lobby: home, create room, directory. */
export const lobbyVi: Record<string, TranslationEntry> = {
  // ── HomePage ──────────────────────────────────────────────────
  '{count} people online in {rooms} rooms': '{count} người đang online trong {rooms} phòng',
  'Talk. Share. Connect.': 'Trò chuyện. Chia sẻ. Kết nối.',
  'Create a room, share a link, and start talking. No account required.':
    'Tạo phòng, chia sẻ liên kết và bắt đầu trò chuyện. Không cần tài khoản.',
  'Create Room': 'Tạo phòng',
  'Find a Room': 'Tìm phòng',
  'Works in your browser · Desktop & mobile · No download':
    'Hoạt động ngay trên trình duyệt · Máy tính & di động · Không cần tải',
  'Active Public Rooms': 'Phòng công khai đang hoạt động',
  'Jump into a live room, or search by name or room code.':
    'Tham gia phòng đang diễn ra ngay, hoặc tìm theo tên hoặc mã phòng.',
  'Search rooms...': 'Tìm phòng…',
  'Search rooms': 'Tìm phòng',
  'No rooms match “{query}”.': 'Không có phòng nào khớp “{query}”.',
  'Browse all rooms': 'Xem tất cả phòng',
  'View all rooms': 'Xem tất cả phòng',
  'Create in seconds': 'Tạo chỉ trong vài giây',
  'Name your room, pick visibility, share the link. Guests join without an account.':
    'Đặt tên phòng, chọn chế độ hiển thị, chia sẻ liên kết. Khách tham gia không cần tài khoản.',
  'Host controls': 'Quyền của chủ phòng',
  'Approve join requests, mute, remove, lock the room or transfer hosting anytime.':
    'Duyệt yêu cầu tham gia, tắt mic, xóa người, khóa phòng hoặc trao quyền chủ phòng bất cứ lúc nào.',
  'Built for clarity': 'Thiết kế vì sự rõ ràng',
  'Adaptive video grid, connection radar, low bandwidth mode and crisp room chat.':
    'Lưới video thích ứng, radar kết nối, chế độ tiết kiệm dữ liệu và trò chuyện sắc nét trong phòng.',

  // ── CreateRoomPage ────────────────────────────────────────────
  'Please enter your name': 'Vui lòng nhập tên của bạn',
  'Room created': 'Đã tạo phòng',
  'Your room is live and listed publicly.': 'Phòng của bạn đang hoạt động và được liệt kê công khai.',
  'Your room is private — share the link or code.':
    'Phòng của bạn ở chế độ riêng tư — hãy chia sẻ liên kết hoặc mã phòng.',
  'Home': 'Trang chủ',
  'Create a room': 'Tạo phòng mới',
  'Set the essentials now — you can fine-tune everything later in room settings.':
    'Cài các mục cơ bản ngay — bạn có thể chỉnh mọi thứ chi tiết hơn sau trong cài đặt phòng.',
  'Your name': 'Tên của bạn',
  'e.g. Tri': 'VD: Tri',
  'This is how you appear to everyone in the room.': 'Đây là cách bạn hiển thị với mọi người trong phòng.',
  'Room name': 'Tên phòng',
  'e.g. Gaming Night': 'VD: Gaming Night',
  'Optional — leave empty to use “Room by {name}”.': 'Tùy chọn — để trống để dùng “Phòng của {name}”.',
  'You': 'Bạn',
  'Visibility': 'Hiển thị',
  'Public': 'Công khai',
  'Appears in the public room list.': 'Xuất hiện trong danh sách phòng công khai.',
  'Private': 'Riêng tư',
  'Only accessible with the link or code.': 'Chỉ vào được bằng liên kết hoặc mã phòng.',
  'Advanced Settings': 'Cài đặt nâng cao',
  'Require host approval': 'Yêu cầu chủ phòng duyệt',
  'Guests wait until you accept their request.': 'Khách sẽ chờ cho đến khi bạn chấp nhận yêu cầu của họ.',
  'Default microphone': 'Mic mặc định',
  'Microphone starts on when you enter.': 'Mic tự bật khi bạn vào phòng.',
  'Default camera': 'Camera mặc định',
  'Camera starts on when you enter.': 'Camera tự bật khi bạn vào phòng.',
  'Room chat': 'Trò chuyện trong phòng',
  'Text messages, reactions and file sharing.': 'Tin nhắn, biểu cảm và chia sẻ tệp.',
  'Maximum participants': 'Số người tối đa',
  'Full room settings live inside the room.': 'Toàn bộ cài đặt phòng nằm trong phòng.',
  'Already have a code?': 'Bạn đã có mã phòng?',
  'Find a room': 'Tìm một phòng',

  // ── RoomsPage ─────────────────────────────────────────────────
  'Live': 'Trực tiếp',
  'Most people': 'Đông người nhất',
  'Recently active': 'Hoạt động gần đây',
  'Public rooms': 'Phòng công khai',
  'Browse live rooms, or search by room name and code.':
    'Xem các phòng đang diễn ra, hoặc tìm theo tên phòng và mã phòng.',
  'Sort rooms': 'Sắp xếp phòng',
  'Found by code': 'Tìm thấy theo mã',
  'No rooms found': 'Không tìm thấy phòng nào',
  'Nothing matches “{query}”. Try a different name or room code.':
    'Không có gì khớp với “{query}”. Hãy thử tên hoặc mã phòng khác.',
  'There are no public rooms right now. Why not create one?':
    'Hiện không có phòng công khai nào. Tại sao bạn không tạo một phòng?',
  'Clear search': 'Xóa tìm kiếm',

  // ── RoomCard ──────────────────────────────────────────────────
  'Full': 'Đầy',
  'Idle': 'Rảnh',
  'Hosted by': 'Chủ phòng:',
  '{count} of {total} seats': '{count}/{total} chỗ ngồi',
  'just now': 'vừa xong',
  '{n}m ago': '{n} phút trước',
  '{n}h ago': '{n} giờ trước',
  '{n}d ago': '{n} ngày trước',
  'View {name}': 'Xem {name}',
  'Join {name}': 'Tham gia {name}',
  'View': 'Xem',
  'Join': 'Tham gia',

  // ── NotFoundPage ──────────────────────────────────────────────
  'Page not found': 'Không tìm thấy trang',
  'The page you are looking for doesn’t exist or has moved.':
    'Trang bạn đang tìm không tồn tại hoặc đã được di chuyển.',
  'Back to Home': 'Về trang chủ',
  'Browse rooms': 'Xem các phòng',
  'Room not found': 'Không tìm thấy phòng',
  'The room may have expired or no longer exists.': 'Phòng có thể đã hết hạn hoặc không còn tồn tại.',
}