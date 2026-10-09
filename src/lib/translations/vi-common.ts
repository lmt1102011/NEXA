import type { TranslationEntry } from '@/lib/i18n'

/** Vietnamese strings for shared layout pieces, toasts and system messages. */
export const commonVi: Record<string, TranslationEntry> = {
  // ---- public layout / chrome ----
  'NEXA home': 'Trang chủ NEXA',
  Main: 'Chính',
  Rooms: 'Phòng',
  Create: 'Tạo phòng',
  'Create room': 'Tạo phòng',
  Settings: 'Cài đặt',
  Footer: 'Chân trang',
  You: 'Bạn',
  'Talk. Share. Connect.': 'Nói chuyện. Chia sẻ. Kết nối.',
  'Switch to light mode': 'Chuyển sang chế độ sáng',
  'Switch to dark mode': 'Chuyển sang chế độ tối',
  'Change language': 'Đổi ngôn ngữ',
  Language: 'Ngôn ngữ',

  // ---- notifications: media access ----
  'Microphone access denied': 'Quyền truy cập mic bị từ chối',
  'No microphone found': 'Không tìm thấy mic',
  'Camera access denied': 'Quyền truy cập camera bị từ chối',
  'No camera found': 'Không tìm thấy camera',
  'You can still watch and chat in this room.': 'Bạn vẫn có thể xem và trò chuyện trong phòng này.',
  'You can still join with audio only.': 'Bạn vẫn có thể tham gia chỉ với âm thanh.',
  'No microphone available': 'Không có mic khả dụng',
  'No camera available': 'Không có camera khả dụng',
  'Check your device settings and browser permissions.': 'Kiểm tra cài đặt thiết bị và quyền của trình duyệt.',
  'Screen sharing is disabled by the host': 'Chủ phòng đã tắt chia sẻ màn hình',
  'Only the host can share their screen': 'Chỉ chủ phòng mới có thể chia sẻ màn hình',

  // ---- notifications: names / roles ----
  'Name is already taken': 'Tên đã được sử dụng',
  '“{name}” is used by someone else here. Pick a different name.':
    '“{name}” đang được người khác sử dụng. Hãy chọn tên khác.',
  '“{name}” belongs to someone else here. Choose another name to join.':
    '“{name}” thuộc về người khác trong phòng này. Hãy chọn tên khác để tham gia.',
  'You are now the host of this room': 'Bạn giờ là chủ phòng của phòng này',
  'The host granted you new permissions': 'Chủ phòng đã cấp quyền mới cho bạn',
  'New task assigned to you: "{title}"': 'Công việc mới được giao cho bạn: "{title}"',
  '{name} wants to join': '{name} muốn tham gia',
  'Open Participants to review the request.': 'Mở Người tham dự để xem yêu cầu.',
  '{name} joined the room': '{name} đã tham gia phòng',
  'Muted {name}': 'Đã tắt mic của {name}',
  "Turned off {name}'s camera": 'Đã tắt camera của {name}',
  'Removed {name}': 'Đã xóa {name}',
  'Host transferred to {name}': 'Đã trao quyền chủ phòng cho {name}',

  // ---- chat / files ----
  'Chat is disabled in this room': 'Trò chuyện đã bị tắt trong phòng này',
  'File sharing is disabled in this room': 'Chia sẻ tệp đã bị tắt trong phòng này',
  'File is too large': 'Tệp quá lớn',
  'Maximum file size is 2 MB in peer-to-peer chat.': 'Kích thước tệp tối đa là 2 MB trong trò chuyện ngang hàng.',
  'Could not read this file': 'Không đọc được tệp này',

  // ---- system messages ----
  '{name} created the room': '{name} đã tạo phòng',
  '{name} was accepted by the host': '{name} đã được chủ phòng chấp nhận',
  '{name} left the room': '{name} đã rời phòng',
  '{name} was removed by the host': '{name} đã bị chủ phòng xóa',
  '{name} is now the host': '{name} giờ là chủ phòng',
  '{name} is now the host of this room': '{name} giờ là chủ phòng của phòng này',
  'Room was locked': 'Phòng đã được khóa',
  'Room was unlocked': 'Phòng đã được mở khóa',
}
