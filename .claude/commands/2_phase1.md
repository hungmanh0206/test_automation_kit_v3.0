---
description: PHASE 1 — chuẩn bị. Tạo profile task rồi khám phá hệ thống; chạy trước mọi thứ khác, không đọc đặc tả và không sinh case.
---

Task: **$ARGUMENTS**

Thiếu mã task → `npm run task:which -- $ARGUMENTS`; thoát 2 = KHÔNG PHÁN ĐƯỢC, nó in danh sách profile để chọn. **Đừng suy từ hội thoại cũ** (CLAUDE.md §5).

Phase 1 làm **đúng hai việc**, theo thứ tự:

| Bước | Lệnh | Việc |
|---|---|---|
| 1 | [`/1_start`](1_start.md) | Hỏi đúng 5 điều, tạo `profiles/<TASK>/task.env`, chạy preflight |
| 2 | [`/discover`](discover.md) | Bò app: bản đồ màn, API, vùng mù tài liệu, bề mặt injection |

> **Phạm vi: CHỈ chuẩn bị.** Không đọc đặc tả, không neo mẫu số, không sinh case, không execute —
> những việc đó là `/3_phase2`.

## Vì sao tách hai bước

Chúng hỏng theo hai cách khác nhau. Bước 1 **không chạm app**, hỏng thì *không chạy được gì*. Bước 2
**chạm app nhưng chỉ ĐỌC**, hỏng thì *vẫn chạy được nhưng viết case mù*.

Kết quả bước 2 là **đầu vào của Phase 2**, không phải testcase: bản kê chụp từ build không chứng minh
build đúng, nên nó **không phải oracle**.

## Chạm UAT: xác nhận TRƯỚC

Bước 2 mở UAT thật. **Hỏi user xác nhận trước mỗi lượt chạm UAT** (CLAUDE.md §2), và chỉ đọc — không
bấm Ghi, không Xoá, không đổi trạng thái bản ghi nào.

## Chạy

```
/1_start <TASK_KEY>
/discover <TASK_KEY>
```

## Dừng khi

- **Đã có profile VÀ đã có `requirements/system_map.json`** — chạy lại không thêm thông tin nào.
- **Preflight chặn ở bước 1** — dựng đúng thứ nó đòi rồi mới đi tiếp.
- **User chưa xác nhận chạm UAT** — dừng ở bước 1.
- **Xong bước 2** — báo bản đồ rồi **DỪNG**. KHÔNG tự chạy `/3_phase2`: đó là lượt khác, cần phiên
  sạch và một bản bàn giao (`handoff/`).

## Bốn phase

| | Lệnh | Việc |
|---|---|---|
| **1** | `/2_phase1` | tạo profile · khám phá hệ thống |
| **2** | `/3_phase2` | đọc tài liệu · sinh testcase · đẩy lên Sheet |
| **3** | `/5_phase3` | execute trên UAT · chấm verdict |
| **4** | `/6_phase4` | rerun sau khi bug được sửa |

`/4_publish` chen giữa phase 2 và 3 khi cần đẩy Sheet; `/7_release` là cửa cuối. `/partial-rerun` là
**ngoại lệ** ngoài chuỗi bốn phase: dùng khi **requirement đổi** và chỉ một phần bộ case cần sửa.
