'use strict';

/*
 * js_source — đọc MÃ NGUỒN JS/TS mà không bị chính chữ nghĩa trong đó đánh lừa.
 *
 * VÌ SAO TÁCH RA (09/11/2026). `boChuThich` có BA bản giống hệt từng byte trong cây:
 * `version_check.js` · `recon_passive.js` · `env_assumptions.js`. Ba bản của một hàm phân tích nguồn
 * là ba chỗ để trôi khỏi nhau, và khi chúng trôi thì ba cửa đọc cùng một file ra ba kết quả khác
 * nhau — kiểu hỏng không ai nhìn thấy cho tới lúc hai cửa cãi nhau.
 *
 * KHÔNG gộp lúc viết cửa thứ ba, có chủ ý: gộp một helper dùng chung là thay đổi chạm vào HAI cửa
 * đang xanh, nên nó xứng đáng có lượt nghiệm thu riêng thay vì đi ké một cửa mới. Đây là lượt đó.
 *
 * ĐÃ ĐO TRƯỚC KHI GỘP: ba bản giống hệt từng byte, nên gộp là DỌN, không phải đổi hành vi.
 */

/**
 * Xoá nội dung chú thích, GIỮ NGUYÊN SỐ DÒNG.
 *
 * Giữ số dòng là điều kiện bắt buộc: mọi cửa dùng hàm này đều báo `file:dòng`, và một bản xoá sạch
 * chú thích rồi làm lệch số dòng sẽ chỉ sai chỗ — tệ hơn không báo, vì người đọc sẽ đi sửa nhầm.
 *
 * `(^|[^:])` trước `//` là để KHÔNG ăn mất `https://`. Thiếu nó thì mọi URL trong mã biến thành
 * khoảng trắng từ dấu `//` tới hết dòng.
 */
function boChuThich(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
}

module.exports = { boChuThich };
