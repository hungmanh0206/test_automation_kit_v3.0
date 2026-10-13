'use strict';
/*
 * axes.js — MỘT NGUỒN cho danh mục TRỤC MỞ RỘNG QUANH CASE.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO FILE NÀY TỒN TẠI, có số đo (13/10/2026, v2.8.1 §1).
 *
 * Bốn máy đang nói về cùng một thứ bằng BỐN BỘ TỪ VỰNG khác nhau:
 *
 *   `CLAUDE.md` §3        field · surface · persist · nhánh · trạng thái kế cận   (+ chiều ngược)
 *   `leak_report.AXES`    field · surface · persist · branch · state
 *   `depth.PLAN`          field · surface · persist · concurrency · reverse       (+ state ở medium)
 *   `expansion_audit`     field · reverse · surface · persist · fixture
 *   `self_review.axes`    ① · chiều ngược · ② · ③ · ④⑤ GỘP MỘT DÒNG
 *
 * Chỉ `field`, `surface`, `persist` có mặt ở cả bốn. Hệ quả đo được: **không máy nào trả lời được** câu
 * "case band high này đã mở đủ trục mà band của nó yêu cầu chưa". `depth.PLAN` — bảng band→trục — chỉ
 * được IN RA ở hai chỗ (`console.log` và một dòng markdown của `expansion_plan`), còn phần THI HÀNH nằm
 * ở `expansion_audit.axesRan` và bảng `self_review`, cả hai dùng khoá riêng và không đọc `PLAN`.
 *
 * ĐỢT NÀY (1a) CHỈ GOM NGUỒN, KHÔNG ĐỔI HÀNH VI. Danh mục dưới đây mô tả ĐÚNG những gì bốn máy đang
 * làm hôm nay, kể cả chỗ chúng lệch nhau — chỗ lệch được khai ra ở `_lech`, không bị im lặng xoá. Phần
 * đổi hành vi (bỏ `concurrency`, tách `reverse` khỏi danh sách trục, thêm phép đối chiếu band→trục) để
 * ở bước 1b, commit riêng.
 *
 * Gom trước rồi mới sửa là có lý do: nếu sửa và gom cùng lúc thì khi một máy vỡ, không biết nó vỡ vì
 * gom hay vì sửa.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * Năm trục của `CLAUDE.md` §3, cộng chiều ngược.
 *
 * `artefact` là regex nhận dạng báo cáo mà máy của trục đó sinh ra — lấy NGUYÊN VĂN từ `self_review` và
 * `expansion_audit` đang dùng, không viết lại. Viết lại là tạo bản sao thứ hai của đúng thứ file này
 * sinh ra để gom.
 */
const TRUC = [
  {
    so: 1,
    key: 'field',
    ten: 'field cùng khối (spec→UI)',
    may: 'spec_extract + ui_conformance_check',
    lenh: 'npm run spec:extract … --catalog … rồi node scripts/qa/ui_conformance_check.js --catalog …',
    /* `expansion_audit` và `self_review` cùng dò thư mục `conformance*` rồi đòi có `conformance_report.json`. */
    artefact: { thuMuc: 'test-results', re: /^conformance/, doiFile: 'conformance_report.json' },
  },
  {
    so: 2,
    key: 'surface',
    ten: 'cùng giá trị khác nơi hiển thị',
    may: 'cross_surface_diff',
    lenh: 'npm run xsurf:diff -- --config requirements/cross_surface.json --out reports/cross-surface.md',
    artefact: { thuMuc: 'reports', re: /cross-surface/i },
  },
  {
    so: 3,
    key: 'persist',
    ten: 'chuỗi lưu trữ form→payload→API→UI',
    may: 'persistence_probe',
    lenh: 'npm run probe:persist -- --chains … --out reports/persistence-probe.md',
    artefact: { thuMuc: 'reports', re: /persist|probe/i },
  },
  {
    so: 4,
    key: 'branch',
    ten: 'nhánh / biến thể khác của cùng màn',
    may: 'fixture_matrix',
    lenh: 'npm run fixture:matrix -- --config requirements/fixture_matrix.json --discover --out reports/fixture-matrix.md',
    /*
     * ④ và ⑤ DÙNG CHUNG một artefact (`fixture-matrix`), và `self_review` gộp chúng làm MỘT DÒNG trong
     * khi `leak_report` tách làm hai trục. Cả hai cách đều có lý: một bảng fixture-matrix phủ cả nhánh
     * lẫn trạng thái, nhưng một bug thì rơi vào đúng một trong hai. Giữ nguyên cả hai cách ở 1a.
     */
    artefact: { thuMuc: 'reports', re: /fixture-matrix/i },
    chung_artefact_voi: 'state',
  },
  {
    so: 5,
    key: 'state',
    ten: 'trạng thái kế cận',
    may: 'fixture_matrix',
    lenh: 'npm run fixture:matrix -- --config requirements/fixture_matrix.json --discover --out reports/fixture-matrix.md',
    artefact: { thuMuc: 'reports', re: /fixture-matrix/i },
    chung_artefact_voi: 'branch',
  },
];

/**
 * Chiều NGƯỢC — không phải một trục.
 *
 * `CLAUDE.md` §3 viết "… 5 trục quanh case (…) **+** chiều ngược `spec:gap`". Dấu cộng đó có nghĩa: nó
 * đi từ build về tài liệu, ngược hướng với năm trục kia. `depth.PLAN` xếp nó vào danh sách trục của band
 * high (`reverse`), còn `leak_report` không có nó. Giữ riêng ở đây để 1b tách được mà không mất phần
 * `self_review` đang chấm.
 */
const CHIEU_NGUOC = {
  key: 'reverse',
  ten: 'chiều ngược (build→tài liệu)',
  may: 'spec_gap',
  lenh: 'npm run spec:gap -- --screens … --surface … --bindings …',
  artefact: { thuMuc: 'reports', re: /spec-gap/i },
};

/**
 * CHỖ BỐN MÁY LỆCH NHAU — khai ra, không im lặng xoá.
 *
 * 1a giữ nguyên mọi thứ; danh sách này là đầu vào của 1b và của báo cáo. Một chỗ lệch được ghi lại thì
 * còn truy được; một chỗ lệch bị xoá trong lúc "dọn dẹp" thì mất luôn lý do nó từng tồn tại.
 */
const LECH = [
  {
    khoa: 'concurrency',
    o_dau: 'depth.PLAN.high',
    van_de: 'KHÔNG có máy nào sinh artefact cho nó, không npm script, không mục nào ở `expansion_audit` '
      + 'hay `self_review`. `CLAUDE.md` §3 liệt kê 5 trục và KHÔNG có nó.',
    de_xuat_1b: 'bỏ khỏi `PLAN`; ghi phát hiện vào CHANGELOG để ý định "race condition nên là một trục" '
      + 'không mất — nếu sau này muốn, nó quay lại CÙNG VỚI một cái máy.',
  },
  {
    khoa: 'reverse',
    o_dau: 'depth.PLAN.high (xếp như trục) vs CLAUDE.md (gọi là "+ chiều ngược")',
    van_de: 'bị đếm vào "N trục" ở một chỗ và không ở chỗ khác.',
    de_xuat_1b: 'tách khỏi danh sách trục; `self_review` vẫn chấm, chỉ là không đếm vào mẫu số trục.',
  },
  {
    khoa: 'fixture',
    o_dau: 'expansion_audit.axesRan',
    van_de: 'là TÊN ARTEFACT (`fixture-matrix`), không phải tên trục — nó gánh cả ④ lẫn ⑤.',
    de_xuat_1b: 'đổi thành hai khoá `branch`/`state` cùng trỏ một artefact, để mẫu số trục đếm đúng.',
  },
  {
    khoa: 'state',
    o_dau: 'depth.PLAN — chỉ có ở band medium, KHÔNG có ở high',
    van_de: 'band high đáng ra phủ nhiều hơn medium, nhưng lại thiếu đúng một trục mà medium có. '
      + 'Nhiều khả năng là sót khi viết, không phải chủ ý.',
    de_xuat_1b: 'đưa `state` vào high (high phủ trọn medium).',
  },
];

/** Tra theo khoá. Trả `undefined` khi không có — người gọi tự quyết, không đoán hộ. */
function theoKhoa(key) {
  if (key === CHIEU_NGUOC.key) return CHIEU_NGUOC;
  return TRUC.find((t) => t.key === key);
}

/** Mọi khoá trục (KHÔNG gồm chiều ngược). */
function khoaTruc() {
  return TRUC.map((t) => t.key);
}

module.exports = { TRUC, CHIEU_NGUOC, LECH, theoKhoa, khoaTruc };
