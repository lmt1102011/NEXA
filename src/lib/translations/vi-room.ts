import type { TranslationEntry } from '@/lib/i18n'

/** Vietnamese strings for the room shell: header, rail, control bar, tiles. */
export const roomVi: Record<string, TranslationEntry> = {
  // RoomHeader
  'NEXA home': 'Trang chủ NEXA',
  'Live': 'Trực tiếp',
  'Locked': 'Đã khóa',
  'Show participants': 'Xem người tham dự',
  'Room settings': 'Cài đặt phòng',
  'Invite': 'Mời',

  // RoomRail
  'Chat': 'Trò chuyện',
  'People': 'Người tham dự',
  'Activities': 'Hoạt động',
  'Room': 'Cài đặt',
  'Keys': 'Phím tắt',
  'Room navigation': 'Điều hướng phòng',

  // RoomPanel
  'Close panel': 'Đóng bảng',

  // ControlBar
  'Mute': 'Tắt mic',
  'Unmute': 'Bật mic',
  'Mute microphone': 'Tắt mic',
  'Unmute microphone': 'Bật mic',
  'Stop video': 'Tắt camera',
  'Start video': 'Bật camera',
  'Turn camera off': 'Tắt camera',
  'Turn camera on': 'Bật camera',
  'Stop share': 'Dừng chia sẻ',
  'Share': 'Chia sẻ màn hình',
  'Stop screen sharing': 'Dừng chia sẻ màn hình',
  'Share your screen': 'Chia sẻ màn hình',
  'Open chat': 'Mở trò chuyện',
  'Open room activities': 'Mở hoạt động',
  'Devices': 'Thiết bị',
  'Device settings': 'Cài đặt thiết bị',
  'Invite people': 'Mời người tham dự',
  'Keyboard shortcuts': 'Phím tắt',
  'Leave': 'Rời phòng',
  'Leave room': 'Rời phòng',
  'More': 'Thêm',
  'More options': 'Tùy chọn khác',
  'Private room': 'Phòng riêng',
  'Public room': 'Phòng công khai',
  'You are the host': 'Bạn là chủ phòng của phòng này',
  'Hosted by {name}': 'Chủ phòng: {name}',

  // VideoTile
  'Speaking': 'Đang nói',
  '{name} (You)': '{name} (bạn)',
  'Actions for {name}': 'Thao tác với {name}',
  'Mute mic': 'Tắt mic',
  'Turn off camera': 'Tắt camera',
  'Remove from room': 'Xóa khỏi phòng',

  // NameConflictBar
  '“{name}” is used by someone else in this room.':
    '“{name}” đã được người khác trong phòng này dùng.',
  'Choose another name to stay in the room.': 'Chọn tên khác để tiếp tục ở trong phòng.',
  'New name': 'Tên mới',
  'Rename': 'Đổi tên',

  // ConnectionRadar
  'Reconnecting…': 'Đang kết nối lại…',
  'Connection: {quality}': 'Kết nối: {quality}',
  '{ping} ms · {jitter} ms jitter · {loss}% loss':
    '{ping} ms · {jitter} ms dao động · {loss}% mất gói',
  '{ping} ms · {loss}% loss': '{ping} ms · {loss}% mất gói',
  'Connection quality: {quality}, {ping} milliseconds ping':
    'Chất lượng kết nối: {quality}, ping {ping} milli giây',

  // RoomStage
  'You are presenting': 'Bạn đang chia sẻ màn hình',
  '1 person wants to join': '1 người muốn tham gia',
  '{count} people want to join': '{count} người muốn tham gia',
  'Mic on': 'Bật mic',
  'Mic off': 'Tắt mic',
  'camera on': 'Bật camera',
  'camera off': 'Tắt camera',
  '+{count} more waiting': '+{count} người đang chờ',
  'Decline {name}': 'Từ chối {name}',
  'Decline': 'Từ chối',
  'Accept': 'Chấp nhận',
  'Review all requests in People': 'Xem tất cả yêu cầu trong Người tham dự',

  // RoomLayout
  'Participants': 'Người tham dự',
  'Messages for everyone in the room.': 'Tin nhắn cho mọi người trong phòng.',
}
