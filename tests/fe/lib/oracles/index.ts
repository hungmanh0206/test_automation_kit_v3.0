/*
 * ⑦ ORACLE GIÁ TRỊ TÍNH TOÁN — sổ đăng ký (v2.8.1 bước 3).
 *
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║ TẦNG NÀY TÍNH GIÁ TRỊ KỲ VỌNG. Nó KHÔNG được đọc gì của app: không `page`, không `locator`,        ║
 * ║ không `expect`, không import từ `screens/` `steps/` `_widget/` `_checks/`. Có máy canh:            ║
 * ║ `npm run oracle:calc` và `tests/fe/infra/oracle-calc.spec.ts`.                                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝
 *
 * VÌ SAO TẦNG NÀY KHÔNG MÂU THUẪN VỚI LUẬT L4 ("code dùng chung KHÔNG chứa giá trị kỳ vọng").
 *
 * L4 cấm **một giá trị** bị đóng khung trong code dùng chung — "sĩ số phải bằng 35" viết sẵn trong một
 * hàm kiểm là `app == app` chuyển xuống tầng thư viện. Ở đây không có giá trị nào được viết sẵn cho một
 * case: có một **quy tắc** lấy từ đặc tả, nhận dữ liệu của case và SINH ra kỳ vọng. Khác nhau ở chỗ quy
 * tắc đó **neo vào một rule có mã** trong `knowledge/domain`, và `oracle:calc` TỪ CHỐI một oracle mà
 * `oracle_ref` không tra ra rule nào (`domain_rules.js` gọi đó là "oracle ma") hoặc tra ra rule `draft`.
 *
 * Nhưng neo thôi CHƯA ĐỦ, và đây là chỗ dễ tự lừa nhất của cả đợt: một hàm oracle viết theo quan sát app
 * rồi gắn một mã `BR-` vào vẫn trông hợp lệ, và vẫn xanh mãi mãi. Nên mỗi oracle bắt buộc có **cặp đối
 * chứng**:
 *
 *   `dung` — ca mà oracle phải trả đúng;
 *   `lech` — ca mà **app đã/có thể trả một giá trị khác**, và oracle PHẢI khác giá trị đó.
 *
 * Thiếu một trong hai vế thì `dangKy()` NÉM ngay lúc nạp module, không đợi tới lúc chạy. Một oracle chỉ
 * có ca đúng là một oracle chưa ai chứng minh được là nó phân biệt được gì — "nhất quán KHÔNG phải bằng
 * chứng của đúng" (`CLAUDE.md` §3) áp cho chính bộ oracle, không chỉ cho app.
 *
 * `lech` LẤY TỪ ĐÂU: `examples` của chính rule trong `knowledge/domain` đã có sẵn ca lệch — ví dụ
 * `BR-HSLOP-035` có "lop ghep co 20 hoc sinh ⇒ vuot nguong". Lấy từ đó, không tự nghĩ ra.
 */

/** Khuôn `oracle_ref`, GIỮ ĐÚNG của `scripts/lib/expansion/finding.js` — hai nơi lệch là oracle ma im lặng. */
export const ORACLE_RE = /^(BR|SM|PM|SS|DM|UI)-[A-Z0-9]+-\d{3}$/;

/** Lỗi do GỌI/ĐĂNG KÝ sai oracle — khác hẳn một kỳ vọng nghiệp vụ không khớp. */
export class OracleUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OracleUsageError';
  }
}

export type CaDung<I, O> = { input: I; ky_vong: O; ghi_chu?: string };
export type CaLech<I, O> = { input: I; app_tra: O; vi_sao: string };

export type Oracle<I, O> = {
  /** Mã rule trong `knowledge/domain`. Không tra ra ⇒ `oracle:calc` CHẶN. */
  oracle_ref: string;
  ten: string;
  /** Tham số BẮT BUỘC. Thiếu ⇒ ném, không có mặc định — cùng luật `batBuocKyVong` của L4. */
  doi: string[];
  tinh: (d: I) => O;
  dung: CaDung<I, O>[];
  lech: CaLech<I, O>[];
};

/*
 * Kiểu của một oracle BẤT KỲ trong sổ.
 *
 * Bản đầu dùng `Oracle<never, never>`, và `npm run typecheck` đỏ — nhưng chỉ ĐỎ TRONG GÓI, vì `full:suite`
 * không chạy typecheck. Lại đúng bài học v2.8.0: repo xanh KHÔNG đồng nghĩa gói xanh.
 * `never` làm mọi giá trị trả về của `tinh()` thành `never`, nên `expect(...)` mất hết phương thức.
 */
export type OracleBatKy = Oracle<Record<string, unknown>, unknown>;

const SO: Map<string, OracleBatKy> = new Map();

/**
 * Đăng ký một oracle. Mọi điều kiện kiểm NGAY lúc nạp module: một oracle sai khuôn phải làm vỡ lúc
 * import, không phải lúc một case nào đó tình cờ gọi tới nó.
 */
export function dangKy<I, O>(o: Oracle<I, O>): Oracle<I, O> {
  if (!ORACLE_RE.test(String(o.oracle_ref || ''))) {
    throw new OracleUsageError(
      `oracle "${o.ten}": \`oracle_ref\` "${o.oracle_ref}" sai khuôn. Phải là mã rule trong `
      + '`knowledge/domain` (BR-/SM-/PM-/SS-/DM-/UI-). Oracle không neo vào đặc tả thì nó neo vào app.',
    );
  }
  if (!Array.isArray(o.doi) || !o.doi.length) {
    throw new OracleUsageError(`oracle "${o.ten}": phải khai \`doi\` — tham số bắt buộc. Oracle không đòi gì là oracle đoán.`);
  }
  if (!Array.isArray(o.dung) || !o.dung.length) {
    throw new OracleUsageError(`oracle "${o.ten}": thiếu ca ĐÚNG (\`dung\`).`);
  }
  if (!Array.isArray(o.lech) || !o.lech.length) {
    throw new OracleUsageError(
      `oracle "${o.ten}": thiếu ca LỆCH (\`lech\`). Một oracle chỉ có ca đúng chưa chứng minh được nó `
      + 'phân biệt được gì — nó có thể đang trả đúng vì luôn trả đúng. Lấy ca lệch từ `examples` của '
      + `rule ${o.oracle_ref} trong knowledge/domain.`,
    );
  }
  if (SO.has(o.oracle_ref)) {
    throw new OracleUsageError(`\`oracle_ref\` ${o.oracle_ref} đã có oracle khác đăng ký — hai quy tắc cùng mã thì không biết case trỏ cái nào.`);
  }
  SO.set(o.oracle_ref, o as unknown as OracleBatKy);
  return o;
}

/** Mọi oracle đã đăng ký. Mẫu số 0 ⇒ nơi gọi phải báo `CHƯA KIỂM`, KHÔNG phải PASS. */
export function tatCa(): OracleBatKy[] {
  return [...SO.values()];
}

/** Lấy theo mã. Không có ⇒ ném: "không tra được oracle" không được lặng lẽ thành "không cần oracle". */
export function theoRef(ref: string): OracleBatKy {
  const o = SO.get(ref);
  if (!o) throw new OracleUsageError(`không có oracle nào đăng ký cho \`${ref}\`. Chưa viết ⇒ case đó là CHƯA KIỂM, không phải PASS.`);
  return o;
}

/**
 * Kiểm tham số bắt buộc rồi tính. Thiếu một tham số là NÉM — đúng luật `batBuocKyVong` của L4: một oracle
 * tự điền mặc định sẽ trả ra một con số trông như kỳ vọng, và không ai biết nó dựa trên gì.
 */
export function tinh<I, O>(o: Oracle<I, O>, d: I): O {
  const thieu = o.doi.filter((k) => (d as Record<string, unknown>)?.[k] === undefined || (d as Record<string, unknown>)?.[k] === null);
  if (thieu.length) {
    throw new OracleUsageError(
      `oracle "${o.ten}" (${o.oracle_ref}): thiếu tham số ${thieu.map((k) => `\`${k}\``).join(', ')}. `
      + 'Không có giá trị mặc định — thiếu dữ liệu thì phép tính chưa xảy ra.',
    );
  }
  return o.tinh(d);
}
