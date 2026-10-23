# Learning loop và Risk-Based Testing

> Nhắc tới ở [`USER_GUIDE.md`](../../USER_GUIDE.md) mục 10. File này giữ chi tiết.

## Thu học liệu giờ tự động

Trước đây việc này phụ thuộc agent nhớ chạy skill, nên `knowledge/` hay rỗng.

| Khi nào | Cơ chế | Ghi vào |
|---|---|---|
| Sau **mỗi** `playwright test` | reporter `learn_reporter` tự chạy (tắt bằng `LEARN_AFTER_RUN=0`) | `knowledge/metrics/` + `historical_execution/` |
| Execute bằng script tự chế | chạy tay `npm run learn` | như trên |
| Task cũ đã chạy trước đây | `npm run learn:backfill` (idempotent) | như trên |
| Sau khi log bug Backlog | `npm run learn:bugs:apply` | `knowledge/bugs/` |

`self_review` **chặn** nếu execute xong mà chưa có snapshot hay KPI, và **cảnh báo** khi có case FAILED
mà `knowledge/bugs/` chưa có entry.

## Ba kho máy KHÔNG tự thu được

Chỉ người hoặc agent ghi, nên `self_review` có check riêng: record sai schema hoặc có PII thì **chặn**;
kho rỗng chỉ nhắc **khi có tín hiệu**, để cảnh báo khỏi thành tiếng ồn.

| Kho | Trả lời câu hỏi | Skill | Kiểm |
|---|---|---|---|
| `knowledge/domain/` | **Giá trị đúng là gì** (business rule đã xác nhận, có `source` và ví dụ) | `domain_recorder` | `npm run domain:check` |
| `knowledge/system/` | **Hệ thống được phép làm gì**: state machine, ma trận quyền, bề mặt dùng chung | `system_mapper` | `npm run system:check` |
| `knowledge/decisions/` | **Vì sao đã kết luận như thế**: bug bị Rejected, PASS kèm ghi chú, QA override risk | `decision_recorder` | `npm run decisions:check` |

### Bắt buộc tra `decisions/` trước khi log bug

```bash
node scripts/qa/decisions.js --check "<triệu chứng>" --module <Module>
```

Khớp `false_positive` hoặc `by_design` thì **không log lại**. Log lại là bị Dev bounce lần hai. Muốn
log thì phải có bằng chứng **mới** khác lần trước.

### Bản đồ `system/` sinh ra nghĩa vụ test

Cặp state không khai thì phải có case chứng minh bị chặn. Ô ngoài vùng `allow` thì phải trả 403.

`system:check` liệt kê nghĩa vụ còn trống, đánh dấu `‼` cho nghĩa vụ xuất phát từ state terminal hoặc
ô DENY, vì đó là nhóm sinh bug doanh thu và phân quyền.

Nhờ vậy câu hỏi "API cho huỷ đơn đã thanh toán, bug hay đúng thiết kế?" trả lời được bằng **trích
dẫn** (`SM-ORDER-001`) thay vì phỏng đoán.

## Risk Scorer

```bash
npm run risk              # bảng risk theo module
npm run risk:gate         # cảnh báo
npm run risk:gate:enforce # chặn CI khi module High thiếu độ sâu
```

`Risk = Likelihood × Impact`, đọc từ `knowledge/` và `.agent/config/risk_model.json`.

**Likelihood = bug hiệu dụng + failRate.** Thiếu bước thu học liệu ở trên thì Likelihood mãi bằng 0 và
band chỉ do Impact dẫn (cold start).

**Bug hiệu dụng** tính theo `statusWeight × 0.5^(tuổi / halfLifeDays)`: bug đã `Done` và bug cũ nhẹ hơn
bug mới mở, để risk phản ánh **hiện tại** chứ không phải quá khứ. Register in cả bug thô và bug hiệu
dụng, ví dụ `3 → 1`. Tắt bằng `halfLifeDays: 0`.

QA **override band** được nếu không đồng ý, và quyết định đó được nhắc lại ở cuối register.

## Chọn test theo risk

```bash
npm run select:tests -- --include-risky 5 --risk-first
```

Xếp hạng file hay fail hoặc flaky từ `tc-history`. `--include-risky` kéo thêm file rủi ro dù diff không
đụng tới. Lệnh cũng cảnh báo test đang **quarantine**.
