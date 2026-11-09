# V4 — Báo cáo tích hợp và đối chứng

## Phạm vi
- Kit B nguyên bản là baseline bất biến. **Không thay đổi file nào có trong ZIP Kit B**.
- Chỉ thêm các file extension và công cụ kiểm tra. Không chèn npm script vào `package.json` gốc.
- Năm adapter Kit A từ V3 được giữ lại để thử nghiệm; không tự động thay thế skill gốc.
- Các kiểm tra cấu trúc và định tuyến không chứng minh chất lượng đầu ra của AI trong runtime.

## Thang điểm gốc (đánh giá kiến trúc, chưa phải benchmark thực nghiệm)
| Nhóm | Kit A | Kit B gốc | V4 |
|---|---:|---:|---|
| Tổng 18 tiêu chí có trọng số | 70.7 | 88.4 | Chưa chấm độc lập |

Không tự nâng điểm V4 khi chưa có đánh giá chuyên gia từng tiêu chí và benchmark đối chứng.

## Chạy kiểm tra
```powershell
node scripts/qa/v4_baseline_integrity.js
node scripts/qa/v4_verify.js
node --test tests/unit/extension_router.test.js tests/unit/extension_benchmark.test.js
```

## Các điểm cần xác minh tiếp
- Skill semantic routing: chưa có benchmark AI với prompt đa dạng.
- Testcase quality: chưa có ground-truth dataset.
- False PASS / false bug: chưa chạy mutation-based benchmark.
- CI, Playwright, load, security: chưa chạy end-to-end.
- Chi phí token, thời gian và độ ổn định: chưa đo.

## Nguyên tắc bảo toàn
Có thể gỡ toàn bộ phần mới mà không phải phục hồi file gốc. Hash baseline tại `.agent/extensions/kit-a/baseline-sha256.json`.
