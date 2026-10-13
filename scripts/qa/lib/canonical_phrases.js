'use strict';
/*
 * canonical_phrases — MỘT NGUỒN cho mẫu dò "bề mặt còn khai Excel/Sheet là nguồn sự thật của testcase".
 *
 * VÌ SAO GOM VỀ ĐÂY. Trước 12/10/2026 có HAI gate canh cùng một luật, ở hai file spec khác nhau, với hai
 * bộ mẫu khác nhau và hai phạm vi quét khác nhau:
 *
 *   - `canonical-drift.spec.ts` quét cả repo, mẫu `/Excel là source of truth/` — chỉ bắt DẤU CÁCH;
 *   - `canonical-md-source.spec.ts` quét một danh sách 9 file khai sẵn, mẫu `/Excel\s*\(?\s*[Ss]ource of truth/`.
 *
 * CẢ HAI ĐỀU XANH, trong khi 7 bề mặt vẫn khai Excel là nguồn — vì repo viết `source-of-truth` có gạch
 * nối, và vì danh sách file khai sẵn không phủ hết. Đây đúng là chuyện đợt này đã trả giá hai lần ở chỗ
 * khác: hai bản lint SQL bất đồng ở 4/795 câu, và năm bản mẫu PII lệch nhau ở SĐT 9 chữ số. Hai bản sao
 * không trôi khỏi nhau ngay — chúng trôi khi một bên được sửa.
 *
 * LUẬT NỚI MẪU: nới thì phải thêm cả hai chiều đối chứng ở `DOI_CHUNG`. Một gate dò bằng chữ mà chỉ có
 * đối chứng dương sẽ được "sửa" bằng cách nới cho tới khi nó không bắt gì nữa.
 */

/**
 * Bề mặt còn KHẲNG ĐỊNH Excel/`.xlsx`/Sheet là nguồn sự thật của NỘI DUNG case.
 *
 * Ba ràng buộc, mỗi cái vá một kiểu báo oan đã xảy ra thật:
 *
 *   1. `Excel`/`.xlsx`/`Sheet` phải đứng GẦN cụm "là nguồn / source-of-truth" — tối đa 40 ký tự. Mẫu
 *      rộng hơn ("có cả Excel lẫn canonical trong câu") bắt 45 dòng mà quá nửa là câu VỐN ĐÃ ĐÚNG.
 *   2. Khoảng trống KHÔNG được bắc qua dấu phẩy hay chấm phẩy. Thiếu ràng buộc này thì câu đúng
 *      `.xlsx là bản xuất, Markdown canonical là nguồn sự thật` bị tố cáo.
 *   3. KHÔNG bắt chuyện KẾT QUẢ. `.xlsx` hôm nay vẫn là chỗ duy nhất giữ verdict đã merge, nên câu
 *      "Excel giữ kết quả" là câu ĐÚNG — §6 nói về nội dung case, không nói về verdict.
 *   4. Chữ `Markdown` KHÔNG được nằm trong khoảng trống. Câu nhắc Markdown ở giữa gần như luôn là câu
 *      nói Markdown mới là nguồn: `…một ô sửa trên Sheet mà không mang về là Markdown đã thôi làm nguồn
 *      sự thật`. Thiếu ràng buộc này, mẫu tố cáo đúng dòng RULE_GLOBAL đang phát biểu luật.
 *
 * VÀ ĐỘNG TỪ `là`/`làm` LÀ BẮT BUỘC. Lượt nới đầu tiên bỏ nó đi và cho `canonical` đứng trần — mẫu khớp
 * 63 dòng, hầu hết là câu VỐN ĐÚNG (`bản xuất Excel của Markdown canonical`). Đó là lần thứ ba trong
 * phiên này tôi nới một bộ dò rồi nó ăn luôn phần đang đúng; chỗ này giữ lại để lần sau khỏi nới tiếp.
 */
const RE_EXCEL_LA_NGUON = /(?:Excel|\.xlsx|Google Sheet|\bSheet\b)(?![^.,;\n]{0,40}Markdown)[^.,;\n]{0,40}?(?:vẫn )?(?:là |làm )(?:source[- ]of[- ]truth|canonical|nguồn sự thật|nguồn chính|nguồn duy nhất|nguồn authoring)(?![^.\n]{0,30}(?:kết quả|verdict|Result))/i;

/**
 * File được bỏ qua, và mỗi dòng một lý do — không có dòng "vì nó ồn".
 *
 * `CHANGELOG` và `docs/token-diet/` là BẢN GHI LỊCH SỬ: chúng ghi điều đã đúng ở thời điểm đó, sửa chúng
 * cho khớp luật mới là xoá dấu vết của một lần đổi luật.
 *
 * Ba file còn lại CHỨA CHÍNH MẪU DÒ, nên chúng tự khớp. Đây là lần thứ chín trong dự án một phép quét
 * bắt đúng dòng mô tả nó.
 */
const BO_QUA = [
  /^CHANGELOG\.md$/,
  /^docs\/token-diet\//,
  /^scripts\/qa\/lib\/canonical_phrases\.js$/,
  /^tests\/fe\/infra\/canonical-drift\.spec\.ts$/,
  /^tests\/fe\/infra\/canonical-md-source\.spec\.ts$/,
];

/**
 * Đối chứng HAI CHIỀU, ghim cạnh mẫu.
 *
 * Chiều âm quan trọng không kém chiều dương: một gate báo oan quá nửa thì không nói được gì, và người
 * đọc sẽ nới nó cho xong việc.
 */
const DOI_CHUNG = {
  phai_khop: [
    'Excel là source-of-truth khi gen/publish',
    'Excel là source of truth khi gen',
    'Excel canonical là source of truth',
    'Coi Excel đã export là source of truth khi gen',
    'không sửa trên Sheet; Excel là nguồn authoring',
    'Excel vẫn là source of truth khi cleanup',
    'Excel là nguồn chính',
    'Excel là canonical khi gen/publish',
    'Excel/testcase canonical là nguồn duy nhất',
    'Sheet là canonical',
  ],
  khong_duoc_khop: [
    /* Câu NÓI ĐÚNG luật — mẫu quá rộng sẽ ăn luôn chúng. */
    'publish đi TỪ Markdown canonical qua bản xuất `.xlsx`',
    'Markdown là source of truth cho NỘI DUNG case',
    '`.xlsx` là bản xuất, Markdown canonical là nguồn sự thật',
    'Markdown canonical trong test-cases/*.md là source of truth cho nội dung case',
    /* KẾT QUẢ là trục khác. */
    'Chừng nào `.xlsx` còn là chỗ DUY NHẤT giữ verdict đã merge',
    'Excel là source-of-truth của kết quả',
    /* Nhắc `Markdown` ở giữa ⇒ câu đang nói Markdown mới là nguồn. */
    'một ô sửa trên Sheet mà không mang về là Markdown đã thôi làm nguồn sự thật',
    'Sửa trực tiếp file `.xlsx` rồi coi đó là bản chuẩn (Markdown mới là canonical)',
    'bản xuất Excel của Markdown canonical',
  ],
};

/** File này có bị bỏ qua không? `rel` dùng dấu `/`, tính từ gốc repo. */
function boQua(rel) {
  return BO_QUA.some((re) => re.test(rel));
}

module.exports = { RE_EXCEL_LA_NGUON, BO_QUA, DOI_CHUNG, boQua };
