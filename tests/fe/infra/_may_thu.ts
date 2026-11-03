/*
 * `_may_thu` — ĐƯỜNG DẪN SCRIPT ĐANG ĐO, CHO PHÉP TRỎ SANG BẢN CHÉP.
 *
 * VÌ SAO CÓ FILE NÀY (đo 03/11/2026). Để chứng minh một đối chứng KHÔNG RỖNG, phải phá bản vá rồi xem
 * ca nào đỏ. Cách tôi làm hôm nay là `git stash` chính file trên cây làm việc — và cây đó DÙNG CHUNG cho
 * mọi phiên Claude đang chạy. Tôi đã mở một cửa sổ ~15 giây trong lúc một phiên khác nói họ "vẫn còn
 * dùng" đúng script ấy. Lần đó không thiệt hại, nhưng là MAY, không phải vì tôi biết.
 *
 * Chẩn đoán đầu của tôi — "chép ra thư mục tạm rồi phá bản chép" — còn nông. Phiên kia chỉ ra gốc đúng
 * hơn: `git stash` trên cây dùng chung KHÔNG phải một phép đo trên file, nó là **đổi trạng thái của cây
 * mà mọi phiên đang đứng trên đó**. Cùng họ với một cú `checkout`, chỉ ngắn hơn. Cửa sổ 15 giây vẫn là
 * một cửa sổ.
 *
 * Nên: spec nhận đường dẫn qua biến môi trường, mặc định là bản thật. Lượt phá hoại chép script sang
 * thư mục tạm, sửa bản chép, rồi trỏ biến vào đó — khi ấy KHÔNG CÓ cửa sổ nào tồn tại.
 *
 *   # pha ban CHEP, khong cham cay dung chung
 *   cp scripts/integrations/backlog/sua_mo_ta.js /tmp/pha/sua_mo_ta.js
 *   # ...sua /tmp/pha/sua_mo_ta.js...
 *   SUA_MO_TA_JS=/tmp/pha/sua_mo_ta.js npx playwright test tests/fe/infra/sua-mo-ta.spec.ts
 *
 * ĐƯỜNG DẪN GHI ĐÈ KHÔNG TỒN TẠI THÌ PHẢI NÉM, TUYỆT ĐỐI KHÔNG LÙI VỀ BẢN THẬT. Lùi là chỗ phép thử
 * tự rỗng: gõ sai đường dẫn một ký tự thì lượt "phá hoại" chạy trên bản THẬT, mọi ca xanh, và người đọc
 * kết luận "đối chứng không bắt được gì" — trong khi thật ra phép phá chưa bao giờ xảy ra. Đúng loại lỗi
 * mà cả phiên 02–03/11 đi chữa: một lượt KHÔNG đo được trả về thứ trông như một kết quả.
 */
import * as fs from 'fs';
import * as path from 'path';

/**
 * Trả đường dẫn script đang đo.
 *
 * @param bien tên biến môi trường để trỏ sang bản chép, ví dụ `SUA_MO_TA_JS`
 * @param macDinh đường dẫn bản thật trong repo
 */
/** Gốc repo chứa `macDinh`: đi ngược lên tới thư mục đầu tiên có `package.json`. */
function gocCua(duong: string): string | null {
  let d = path.dirname(path.resolve(duong));
  for (let i = 0; i < 12; i += 1) {
    if (fs.existsSync(path.join(d, 'package.json'))) return d;
    const tren = path.dirname(d);
    if (tren === d) return null;
    d = tren;
  }
  return null;
}

export function mayThu(bien: string, macDinh: string): string {
  const ghiDe = process.env[bien];
  if (!ghiDe) return macDinh;
  const duong = path.resolve(ghiDe);
  if (!fs.existsSync(duong)) {
    throw new Error(
      `[may-thu] ${bien}="${ghiDe}" nhưng không có file ở đó (${duong}).`
      + ' NÉM thay vì lùi về bản thật: lùi thì lượt phá hoại chạy trên bản THẬT, mọi ca xanh, và người'
      + ' đọc kết luận "đối chứng không bắt được gì" trong khi phép phá chưa bao giờ xảy ra.',
    );
  }

  /*
   * BẢN CHÉP PHẢI GIỮ ĐÚNG ĐỘ SÂU TƯƠNG ĐỐI — đo 03/11/2026, và lượt đầu của tôi sai đúng chỗ này.
   *
   * Các script của kit giải gốc repo từ `__dirname`, ví dụ `cap_nhat_issue.js` làm
   * `path.resolve(__dirname, '..', '..', '..')` rồi `require(<gốc>/scripts/utils/runtime_config)`. Nên
   * một bản chép PHẲNG (đặt thẳng vào thư mục tạm) không nạp nổi `runtime_config` và CHẾT lúc khởi động.
   *
   * Hậu quả tệ hơn việc chết: nó cho 4 ca đỏ trong đó MỘT ca lẽ ra phải xanh. Người đọc thấy "4 đỏ" và
   * kết luận phép phá có tác dụng, trong khi thật ra script chưa chạy nổi dòng nào. Một lượt KHÔNG chạy
   * được trả về thứ trông như một kết quả — đúng lớp hỏng cả phiên này đi chữa.
   *
   * Nên đòi bản chép nằm ở cùng đường dẫn TƯƠNG ĐỐI so với một gốc có `package.json`:
   *
   *   T=$(mktemp -d) && mkdir -p "$T/scripts/integrations/backlog" "$T/scripts/utils"
   *   cp package.json "$T/" && cp scripts/utils/runtime_config.js "$T/scripts/utils/"
   *   cp scripts/integrations/backlog/cap_nhat_issue.js "$T/scripts/integrations/backlog/"
   *   # ...sua ban chep...
   *   CAP_NHAT_ISSUE_JS="$T/scripts/integrations/backlog/cap_nhat_issue.js" npx playwright test ...
   */
  const goc = gocCua(macDinh);
  if (goc) {
    const tuongDoi = path.relative(goc, path.resolve(macDinh)).split(path.sep).join('/');
    const cuaGhiDe = duong.split(path.sep).join('/');
    if (!cuaGhiDe.endsWith(`/${tuongDoi}`)) {
      throw new Error(
        `[may-thu] ${bien} trỏ vào "${duong}", nhưng bản chép phải nằm ở cùng đường dẫn TƯƠNG ĐỐI`
        + ` "${tuongDoi}" so với một gốc có package.json. Script của kit giải gốc repo từ \`__dirname\`,`
        + ' nên bản chép PHẲNG không nạp nổi `runtime_config` và chết lúc khởi động — khi đó các ca đỏ'
        + ' bạn thấy là do script không chạy được, KHÔNG phải do phép phá có tác dụng.'
        + ' Xem khối chú thích trong tests/fe/infra/_may_thu.ts để biết cách dựng bản chép.',
      );
    }
  }
  return duong;
}
