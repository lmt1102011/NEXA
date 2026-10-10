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

  // ---- connection quality ----
  'Unstable connection': 'Kết nối không ổn định',
  'NEXA is lowering video quality to keep the call stable.': 'NEXA đang giảm chất lượng video để cuộc gọi mượt hơn.',
  'Connection restored': 'Đã khôi phục kết nối',
  'Video quality is back to normal.': 'Chất lượng video đã trở lại bình thường.',

  // ---- kicked ----
  'You were removed': 'Bạn đã bị xóa khỏi phòng',
  'The host removed you from this room, so you left the call.': 'Chủ phòng đã xóa bạn khỏi phòng, nên bạn đã thoát khỏi cuộc gọi.',

  // ---- screen share ----
  'Screen sharing is not supported on this device': 'Thiết bị này không hỗ trợ chia sẻ màn hình',
  'This browser cannot capture your screen. You can still share your camera.': 'Trình duyệt này không thể thu màn hình của bạn. Bạn vẫn có thể mở camera.',
  '{name} is presenting': '{name} đang trình chiếu',

  // ---- video grid ----
  'Show all participants ({count})': 'Hiện tất cả {count} người tham dự',
  'More': 'Thêm',
  '{count} people in the room': '{count} người trong phòng',
  'Close': 'Đóng',
  'Sharing screen': 'Đang chia sẻ màn hình',

  // ---- activity dock / drawer ----
  New: 'Mới',
  'Add a note…': 'Thêm ghi chú…',
  'Activities': 'Hoạt động',
  'Activities · {count}': 'Hoạt động · {count}',
  'Collapse activities': 'Thu gọn hoạt động',
  'Add an activity': 'Thêm một hoạt động',
  'Poll': 'Bình chọn',
  'Task': 'Công việc',
  'Timer': 'Hẹn giờ',
  'Todo list': 'Todo list',
  'To-do': 'Todo list',
  'Active': 'Đang chạy',
  'Cancel': 'Hủy',
  'New poll': 'Bình chọn mới',
  'New task': 'Công việc mới',
  'New to-do': 'Mục todo mới',
  'New timer': 'Hẹn giờ mới',
  'Add activity': 'Thêm hoạt động',
  '{count} activities': '{count} hoạt động',
  'No activities yet': 'Chưa có hoạt động',
  'Activities are shared live with everyone in the room.': 'Hoạt động được chia sẻ trực tiếp cho mọi người trong phòng.',
  '{count} tasks': '{count} công việc',
  '{count} to-dos': '{count} việc cần làm',
  'Add': 'Thêm',
  'Poll ended': 'Đã kết thúc bình chọn',
  'Vote {option}': 'Bình chọn {option}',
  'Results': 'Kết quả',

  // ---- host task management ----
  'Manage tasks': 'Quản lý công việc',
  'Task management': 'Quản lý công việc',
  'Assign and lock the work of everyone in the room.': 'Phân công và khóa công việc của mọi người trong phòng.',
  'Assigned tasks': 'Công việc được giao',
  'No tasks assigned.': 'Chưa có công việc nào được giao.',
  'Assignee': 'Người được giao',
  'No assignee': 'Chưa giao',
  'Lock task': 'Khóa công việc',
  'Unlock task': 'Mở khóa công việc',
  'Locked by the host': 'Bị chủ phòng khóa',
  'Delete task': 'Xóa công việc',

  // ---- per-participant volume ----
  'Volume': 'Âm lượng',
  'Adjust volume for {name}': 'Chỉnh âm lượng cho {name}',
  'Muted': 'Đã tắt tiếng',

  // ---- fullscreen ----
  'Fullscreen': 'Toàn màn hình',
  'Exit fullscreen': 'Thoát toàn màn hình',

  // ---- timer finished ----
  "Time's up!": 'Hết giờ!',
  "Time's up — {name}'s countdown is over.": 'Hết giờ — hẹn giờ của {name} đã kết thúc.',
  'The countdown is over.': 'Đếm ngược đã kết thúc.',
  '+1 minute': '+1 phút',
  'Got it': 'Đã rõ',

  // ---- chat: copy / pin ----
  'Copy': 'Sao chép',
  'Copied': 'Đã sao chép',
  'Pin': 'Ghim',
  'Unpin': 'Bỏ ghim',
}
