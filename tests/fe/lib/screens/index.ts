import type { Locator, Page } from '@playwright/test';

/*
 * L1 — MÔ HÌNH MÀN: phân giải NHÃN ĐẶC TẢ → control thật trên màn (v2.8.0 §A).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * TẦNG NÀY LÀ CODE, DỮ LIỆU MÀN NẰM Ở LỚP PROJECT.
 *
 * Mô hình màn của một task sống ở `<TASK_OUTPUT_DIR>/requirements/ui_catalog.json` — nó là dữ liệu của
 * dự án, đo trên chính build đó. File này chỉ biết ĐỌC nó. Nhúng dữ liệu màn vào thư viện là nhúng một
 * dự án vào kit, và lần sau kit dùng cho dự án khác thì nó mang theo nhãn của dự án cũ.
 *
 * VÌ SAO PHÂN GIẢI THEO NHÃN ĐẶC TẢ, KHÔNG THEO NHÃN APP. `expectedFields` là chữ của ĐẶC TẢ; `name`
 * của control là chữ của APP. Case phải định vị được field mà KHÔNG phải đổi `expectedFields` — nắn
 * expected về phía app là vi phạm CLAUDE.md §6 và là đúng kiểu `app == app`. Khi hai bên lệch nhau,
 * catalog ghi ở `matchedLabel` và đó là một FINDING, không phải một lần sửa expected.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║ ĐO 12/10/2026 TRÊN CATALOG THẬT CỦA TASK-9001 — và hai con số này định hình cả tầng:              ║
 * ║                                                                                                   ║
 * ║   · Neo control chỉ có ở MỘT cấp: THCS 87/89 (98%). Mầm non, Tiểu học, THPT, GDTX đều **0**.      ║
 * ║     Tổng 87/433 = 20%. Nên `man()` phải TRẢ VỀ ĐƯỢC trạng thái "màn này chưa có neo" thay vì ném  ║
 * ║     hoặc trả rỗng — bốn phần năm số màn đang ở trạng thái đó.                                     ║
 * ║   · Loại control: input/text 67 · input/checkbox 18 · textarea 2. **KHÔNG CÓ RadComboBox nào.**   ║
 * ║     Tức sáu bước đầu tiên của danh mục (toàn combobox) không dùng được cho module này — biết điều  ║
 * ║     đó TRƯỚC khi viết L2 tiết kiệm đúng một lượt viết sai.                                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝
 *
 * HẠN DÙNG CỦA NEO. Catalog ghi rõ neo đo ngày 30/09/2026 trên `C2/HoSoDetail.aspx`. Một artifact
 * khám phá cũ có hạn dùng: sổ tri thức của dự án có ca một probe 11 ngày làm người đọc tưởng 6 ô đang
 * sống là đã chết. Nên `man()` trả luôn `neo_do_ngay` và `tuoi_ngay`, và `canhBaoHanDung()` nói ra khi
 * neo quá hạn — KHÔNG tự chặn, vì "neo cũ" không có nghĩa "neo sai", nhưng nó phải hiện ra ở báo cáo.
 *
 * LUẬT VÀNG: tầng này KHÔNG chứa `expect`. Nó trả locator và dữ liệu; phán đúng/sai là việc của `_checks/`.
 */

/** Lỗi phân giải màn — khác hẳn một khẳng định nghiệp vụ sai. */
export class ScreenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScreenError';
  }
}

/** Neo một control, đúng như catalog ghi. */
export interface NeoControl {
  /** `name` của control do ASP.NET sinh — dùng làm locator. */
  name: string;
  /** Số `[N]` app in ra, DUY NHẤT trong màn. KHÔNG phải Stt của đặc tả (catalog đo: chỉ khớp 10/89). */
  screenIdx?: string;
  tag?: string;
  type?: string;
  disabled?: boolean;
  /** Nhãn APP đọc được. Lệch với nhãn đặc tả ⇒ là FINDING, không phải cớ để sửa expected. */
  matchedLabel?: string;
  matchedBy?: string;
}

export interface NhomField {
  name: string;
  headingText?: string;
  expectedFields: string[];
  controls?: Record<string, NeoControl>;
}

export interface MoHinhMan {
  ten: string;
  url: string;
  nhom: NhomField[];
  /** Nhãn đặc tả → neo. Gộp từ mọi nhóm, vì case nói "ô Tên trường" chứ không nói nhóm nào. */
  neo: Map<string, NeoControl>;
  so_expected: number;
  so_neo: number;
  /** `true` khi màn CHƯA CÓ NEO NÀO — bốn trên năm màn của TASK-9001 đang như thế. */
  chua_co_neo: boolean;
  neo_do_ngay: string | null;
  tuoi_ngay: number | null;
  /** Stt đặc tả → nhãn đặc tả. Rỗng khi catalog chưa khai — xem `oTheoStt`. */
  stt_nhan: Map<string, string>;
}

/** Khuôn catalog, đủ phần tầng này cần. */
export interface Catalog {
  screens: Array<{ name: string; url?: string; fields?: NhomField[]; stt_nhan?: Record<string, string> }>;
  _control_anchor?: string;
}

/** Ngày đo neo, trích từ câu `_control_anchor` của catalog. Không có thì `null` — KHÔNG đoán. */
export function ngayDoNeo(catalog: Catalog): string | null {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(String(catalog._control_anchor || ''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Dựng mô hình một màn từ catalog.
 *
 * `tenMan` khớp theo chuỗi con, không phân biệt dấu — case gọi "THCS" còn catalog ghi
 * "Hồ sơ trường — THCS". Khớp ra NHIỀU màn thì NÉM: chọn bừa một cái là đo nhầm cấp học, và sổ tri thức
 * đã có ca hai task khác cấp chạy song song đổi cấp của nhau.
 */
export function man(catalog: Catalog, tenMan: string, homNay = new Date()): MoHinhMan {
  const chuan = (s: string) => String(s || '').normalize('NFC').normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

  const can = chuan(tenMan);
  const khop = (catalog.screens || []).filter((s) => chuan(s.name).includes(can));
  if (!khop.length) {
    throw new ScreenError(
      `L1: không màn nào trong catalog khớp "${tenMan}". Có: ${(catalog.screens || []).map((s) => s.name).join(' · ')}`,
    );
  }
  if (khop.length > 1) {
    throw new ScreenError(
      `L1: "${tenMan}" khớp ${khop.length} màn (${khop.map((s) => s.name).join(' · ')}). Chọn bừa một cái là đo nhầm cấp học.`,
    );
  }

  const s = khop[0];
  const nhom = (s.fields || []) as NhomField[];
  const neo = new Map<string, NeoControl>();
  let soExpected = 0;
  for (const g of nhom) {
    soExpected += (g.expectedFields || []).length;
    for (const [nhan, n] of Object.entries(g.controls || {})) {
      /*
       * Nhãn TRÙNG giữa hai nhóm: giữ cái ĐẦU và không ghi đè im lặng. Catalog của TASK-9001 không có
       * ca nào, nhưng ghi đè im lặng là cách một neo đúng bị thay bằng neo của nhóm khác mà không ai thấy.
       */
      if (!neo.has(nhan)) neo.set(nhan, n);
    }
  }

  const ngay = ngayDoNeo(catalog);
  const tuoi = ngay ? Math.floor((homNay.getTime() - new Date(`${ngay}T00:00:00Z`).getTime()) / 86_400_000) : null;

  return {
    ten: s.name,
    url: String(s.url || ''),
    nhom,
    neo,
    so_expected: soExpected,
    so_neo: neo.size,
    chua_co_neo: neo.size === 0,
    stt_nhan: new Map(Object.entries((s as { stt_nhan?: Record<string, string> }).stt_nhan || {})),
    neo_do_ngay: ngay,
    tuoi_ngay: tuoi,
  };
}

/**
 * Locator của một field theo NHÃN ĐẶC TẢ.
 *
 * Ném khi màn chưa có neo, và thông điệp nói rõ ĐÓ LÀ TRẠNG THÁI CỦA CATALOG, không phải lỗi app —
 * một case đỏ vì thiếu neo mà báo như lỗi sản phẩm là gán sai tầng lỗi, và người ta đi tìm bug trong
 * app cho một artifact chưa đo.
 */
export function o(page: Page, mh: MoHinhMan, nhan: string): Locator {
  if (mh.chua_co_neo) {
    throw new ScreenError(
      `L1: màn "${mh.ten}" CHƯA CÓ NEO CONTROL nào trong catalog (${mh.so_expected} nhãn expected, 0 neo). `
      + 'Đây là trạng thái của catalog, KHÔNG phải lỗi sản phẩm — đo neo cho màn này trước.',
    );
  }
  const n = mh.neo.get(nhan);
  if (!n) {
    throw new ScreenError(
      `L1: màn "${mh.ten}" không có neo cho nhãn đặc tả "${nhan}" (${mh.so_neo}/${mh.so_expected} nhãn có neo). `
      + 'KHÔNG được đổi nhãn expected để khớp app — lệch nhãn là một FINDING.',
    );
  }
  /* `name` của ASP.NET chứa `$`, nên dùng selector thuộc tính chứ không dùng `#id`. */
  return page.locator(`[name$="${n.name}"]`);
}

/**
 * Locator của một field theo **Stt của đặc tả** (`Nhập Stt 26 = 5000`).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO ĐƯỜNG NÀY CẦN, và vì sao nó KHÔNG được suy theo vị trí.
 *
 * Đo trên 1.079 mệnh đề của TASK-9001: khung câu áp đảo trỏ field bằng `Stt #`, không bằng nhãn —
 * `tải lại màn và đọc lại Stt #` 56 lượt, `ghi lại giá trị hiện tại của Stt #` 30 lượt, `Stt # = #` 19
 * lượt. Bỏ đường này là bỏ phần lớn câu bước của module.
 *
 * NHƯNG Stt → control KHÔNG suy được bằng máy, và catalog tự ghi con số chứng minh điều đó: `screenIdx`
 * (số `[N]` app in ra) khớp Stt đặc tả **10/89**. Đặc tả có 120 dòng Stt cho CẢ 5 CẤP, còn màn THCS chỉ
 * có 89 nhãn — nên khớp theo THỨ TỰ là lệch ngay từ dòng đầu không áp dụng cho cấp đó.
 *
 * Nên bản đồ `stt_nhan` là DỮ LIỆU ĐO ĐƯỢC của lớp PROJECT, khai trong catalog theo từng màn. Thiếu nó
 * thì hàm này NÉM kèm lời giải thích, chứ KHÔNG đoán: một bản đồ đoán sẽ làm case ghi vào SAI Ô, và kết
 * quả là một FAIL trông như lỗi sản phẩm.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 */
export function oTheoStt(page: Page, mh: MoHinhMan, stt: number | string): Locator {
  const nhan = mh.stt_nhan.get(String(stt));
  if (!nhan) {
    if (!mh.stt_nhan.size) {
      throw new ScreenError(
        `L1: màn "${mh.ten}" CHƯA CÓ bản đồ \`stt_nhan\` trong catalog, nên không tra được "Stt ${stt}". `
        + 'KHÔNG suy theo thứ tự `expectedFields`: đặc tả có 120 dòng Stt cho cả 5 cấp còn màn này ít nhãn hơn, '
        + 'và catalog đã đo `screenIdx` chỉ khớp Stt 10/89. Một bản đồ đoán làm case ghi vào SAI Ô.',
      );
    }
    throw new ScreenError(`L1: màn "${mh.ten}" có bản đồ \`stt_nhan\` nhưng không có Stt ${stt} (${mh.stt_nhan.size} mục).`);
  }
  return o(page, mh, nhan);
}

/** Nhãn đặc tả ứng với một Stt, hoặc `null`. Dùng để IN ra evidence — người đọc cần thấy cả hai. */
export function nhanTheoStt(mh: MoHinhMan, stt: number | string): string | null {
  return mh.stt_nhan.get(String(stt)) ?? null;
}

/** Neo thô của một nhãn — để bước cần biết `tag`/`type`/`disabled` mà không tự dò DOM. */
export function neoCua(mh: MoHinhMan, nhan: string): NeoControl {
  const n = mh.neo.get(nhan);
  if (!n) throw new ScreenError(`L1: màn "${mh.ten}" không có neo cho "${nhan}".`);
  return n;
}

/** Mọi nhãn đặc tả của màn, theo thứ tự nhóm. */
export function nhanCuaMan(mh: MoHinhMan): string[] {
  return mh.nhom.flatMap((g) => g.expectedFields || []);
}

/**
 * Cảnh báo HẠN DÙNG của neo. Trả `null` khi còn trong hạn.
 *
 * KHÔNG tự chặn: "neo cũ" không có nghĩa "neo sai". Nhưng nó phải hiện ra ở báo cáo, vì một artifact
 * khám phá cũ từng làm người đọc tưởng 6 ô đang sống là đã chết.
 */
export function canhBaoHanDung(mh: MoHinhMan, hanNgay = 7): string | null {
  if (mh.neo_do_ngay === null) {
    return `neo control của màn "${mh.ten}" KHÔNG ghi ngày đo — không biết nó bao nhiêu tuổi.`;
  }
  if (mh.tuoi_ngay !== null && mh.tuoi_ngay > hanNgay) {
    return `neo control của màn "${mh.ten}" đo ngày ${mh.neo_do_ngay}, đã ${mh.tuoi_ngay} ngày (hạn ${hanNgay}). `
      + 'Không chặn, nhưng đo lại trước khi dựa vào nó để kết luận.';
  }
  return null;
}
