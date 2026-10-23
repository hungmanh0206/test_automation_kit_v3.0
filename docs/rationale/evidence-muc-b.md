# Vì sao evidence chuyển sang "mức B" (22/10/2026)

> Phần **luật** nằm ở `RULE_GLOBAL.md` §"Evidence — Quy chuẩn bắt buộc". File này giữ **số đo và lý do**,
> để phần luôn-được-nạp không phình (xem `scripts/qa/prompt_budget.js`).

## Đổi cái gì

| Loại case | Trước | Nay |
|---|---|---|
| Case thường (PASS · FAIL không phải bug) | ảnh **mỗi step** | **1 ảnh/video ở bước quyết định** |
| Case thành bug (`product_bug` · `api_bug`) | ảnh mỗi step | **không đổi** — vẫn ảnh mỗi step |
| `status` của từng step | bắt buộc | **không đổi** — vẫn bắt buộc |

## Tiền đề ban đầu đã bị đo bác một phần

Lý do đề xuất là "evidence mỗi step tốn token". Đo 22/10/2026:

| Chi phí | Thực tế |
|---|---|
| Lúc **chạy** | **0 token.** Spec tự chụp qua `scripts/utils/evidence_recorder.js`; Playwright làm, không qua lời gọi tool của agent |
| Lúc **viết spec** | **1–2% số dòng** — CSDL-9001: 448/20.263 · CSDL-9003: 383/21.337 · CSDL-9004: 441/22.611 |

Nên khoản tiết kiệm thật chỉ quanh **1–2% token sinh spec**, không phải một khoản lớn. Token đang đi vào
chỗ khác: spec dài **~21.000 dòng mỗi task**. Vẫn đổi, vì phần bỏ đi chủ yếu là **ảnh lặp trong cùng một
case** — thứ khả năng truy lại không cần tới.

## Vì sao case bug KHÔNG được nới

Dev nhận bug phải dựng lại được **chuỗi** dẫn tới lỗi. Một ảnh màn cuối không nói được lỗi phát sinh từ
bước nào. Đây là chỗ evidence đắt giá nhất, nên là chỗ duy nhất giữ nguyên mức cũ.

Chỉ `product_bug` và `api_bug` được coi là "thành bug" — đó là hai tầng **duy nhất** được phép log
Backlog. `script_error`, `setup_failure`, `doc_outdated`… đều KHÔNG đòi chuỗi.

`laTangBug()` cố ý **không** nhận chữ `bug` trơ: nó xuất hiện trong vô số câu ("không phải bug", "nghi
bug"), bắt nó sẽ kéo cả case đã loại trừ bug vào diện đòi chuỗi.

## Luật này nằm ở đúng MỘT chỗ trong code

Lúc đầu tôi ước lượng "5 chỗ máy gác". Đo lại: `gate_audit.js`, `next_command.js`, `explore_session.js`
chỉ kiểm ở mức **case/observation**, không kiểm từng step. Chỗ duy nhất thi hành luật per-step là
`output_gate.js`.

## Đối chứng đã chạy

| Ca | Mong đợi | Kết quả |
|---|---|---|
| PASS, step không ảnh | qua | exit 0 |
| FAIL `script_error`, step không ảnh | qua | exit 0 |
| FAIL `product_bug`, step không ảnh | **CHẶN** | exit 1 |
| PASS, **không ảnh nào** ở mức case | **CHẶN** | exit 1 |

Ca thứ tư là ca quan trọng nhất: nó chứng minh việc nới KHÔNG làm thủng luật gốc "case đã execute phải
có evidence".

## Một hệ quả ngược đời, đáng ghi

Lần sửa này **làm phình** phần nạp bắt buộc **+85 token** (rồi +49 sau khi rút gọn lần một), và
`prompt_budget.js` chặn lại — đúng lúc mục tiêu của thay đổi là tiết kiệm token. Phần "vì sao" vì thế
chuyển ra file này, giữ `RULE_GLOBAL` và `CLAUDE.md` ngắn hơn bản gốc.
