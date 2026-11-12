---
vi_sao: "`release:summary` đọc sổ kết quả + sổ miễn trừ của một TASK rồi in ra màn hình, nó không nhận một file rời. Khuôn ở đây chép theo các dòng `console.log` trong scripts/qa/release_summary.js; sửa khuôn mà lệch thì ca `release-summary.spec` bắt."
---

# Mẫu báo cáo go/no-go — bản đã điền

> Bản **đã điền xong** cho một mốc UAT thật (hồ sơ lớp học + phân công chủ nhiệm), không phải khung
> trống. Khuôn khớp thứ `npm run release:summary -- --task <K>` in ra.
>
> Ba điều mẫu này dạy mà mô tả skill không dạy được: tiêu chí exit phải **chốt trước khi xem kết quả**,
> một tiêu chí "đạt nhờ miễn trừ" **khác** một tiêu chí đạt thật, và dòng cuối luôn là **ĐỀ XUẤT** —
> QA khuyến nghị, PM quyết.

---

## Tiêu chí exit — chốt ngày 02/11/2026, TRƯỚC khi xem kết quả

| # | Tiêu chí | Ngưỡng | Chốt bởi |
|---|---|---|---|
| 1 | Case P1 đã execute | 100% | QA Lead |
| 2 | Bug `Critical`/`High` còn mở | 0 | QA Lead · PO |
| 3 | Case `BLOCKED` | ≤ 5% | QA Lead |
| 4 | Module chưa có case nào | 0 | PO |

> Chốt **trước** là điều kiện để con số có nghĩa. Chốt sau khi xem kết quả thì ngưỡng nào cũng vừa.

## Kết quả đối chiếu

```
   1 ĐẠT           Case P1 đã execute (ngưỡng 100%) — 48/48
   2 KHÔNG ĐẠT     Bug Critical/High còn mở (ngưỡng 0) — 1 · NGOÀI NGƯỠNG
   3 ĐẠT           Case BLOCKED (ngưỡng ≤5%) — 2/112 = 1.8%
   4 KHÔNG ĐẠT     Module chưa có case nào (ngưỡng 0) — 1 · NGOÀI NGƯỠNG

— Đã vượt qua (miễn trừ T1 còn hiệu lực) —
  MT-004 · NT-LOP-030, NT-LOP-031 · QA Lead · hết hạn 30/11/2026 · mt-2026-11-02-004
    Màn Danh sách học sinh trong lớp chưa có dữ liệu UAT đủ 2 khối; đã hẹn DBA nạp.
  Một tiêu chí "đạt" nhờ miễn trừ KHÁC một tiêu chí đạt thật. Hết hạn thì gate đỏ lại.

— ĐỀ XUẤT —
  ĐỀ XUẤT: NO-GO — còn 1 bug High mở (TASK-4188) · 1 module chưa có case nào (Điểm trường).
  Đây là KHUYẾN NGHỊ. Quyết định release là của PM/PO: họ cân thêm áp lực thị trường và chi phí hoãn.
```

## Phần người viết, máy không viết hộ

**Bug High còn mở là bug nào, và nó chặn ai.** `TASK-4188`: lưu lớp mới ở phân hiệu thứ hai không ghi
được bản ghi, triệu chứng giống "app chặn trùng mã". Chặn luồng tạo lớp ở 3/10 trường liên cấp.

**Module chưa có case nào là module nào, và vì sao.** Điểm trường — phạm vi mở thêm ngày 04/11, chưa
kịp Phase 1. Đây là **vùng chưa test**, không phải vùng đã test và đạt.

**Nếu PM vẫn quyết GO thì đổi lấy gì.** Hai việc phải nói trước: luồng tạo lớp ở trường liên cấp còn
lỗi đã biết, và màn Điểm trường ra mắt mà chưa ai kiểm. Ghi vào `knowledge/decisions/` để lần sau
không kết luận lại từ đầu.
