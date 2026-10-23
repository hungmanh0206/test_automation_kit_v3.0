# Test Automation Kit

> Phân tích requirement, sinh testcase, execute automation, triage bug và quản lý evidence theo một
> quy trình có máy gác ở từng cửa.

## Đọc một trang này trước

**[`docs/CHEATSHEET.md`](docs/CHEATSHEET.md)** là thứ duy nhất cần đọc trước khi chạy: năm lệnh, ba cửa
ra, cách đọc output của `/check`, và cách xin vượt qua cho hợp lệ.

```
/start  →  /phase1  →  /phase2  →  /rerun  →  /release     (/check gọi lúc nào cũng được)
```

Các lệnh còn lại không cần nhớ. Chúng được gợi ý đúng lúc ở dòng **Lệnh tiếp theo** trong output của
`/check`, hoặc xem thẳng bằng `npm run next -- --task <TASK_KEY>`.

## Đi đâu tiếp

| Bạn cần | Đọc |
|---|---|
| Dựng kit trên máy mới | [`QUICKSTART.md`](QUICKSTART.md) |
| Chạy một task từ đầu đến cuối | [`USER_GUIDE.md`](USER_GUIDE.md) |
| Biết một thư mục dùng để làm gì | [`docs/kit-map.md`](docs/kit-map.md) |
| Tra luật | [`RULE_GLOBAL.md`](RULE_GLOBAL.md) — bản rút gọn luôn trong ngữ cảnh agent: [`CLAUDE.md`](CLAUDE.md) |
| Hiểu **vì sao** một luật tồn tại | [`docs/rationale/`](docs/rationale/) |
| Nâng bản kit | [`docs/UPGRADE.md`](docs/UPGRADE.md) và [`CHANGELOG.md`](CHANGELOG.md) |
| Học sâu, không cần để dùng kit | `docs/course/` và `docs/library/` |

## Giới hạn — đọc trước khi chọn kit này

Nói thẳng ở đây rẻ hơn nhiều so với để bạn phát hiện sau khi đã dựng xong profile và viết được nửa bộ
case.

- **Chỉ Playwright.** Không Selenium, không Appium, không lớp mobile-native. Mobile chỉ tới mức
  **mobile-web** (giả lập thiết bị trong cùng một browser). Dự án cần mobile-native thì cần kit khác.
- **Test management là Google Sheet**, công cụ duy nhất. Bug đi Backlog. Không có tầng tích hợp nào khác.
- **DB chỉ đọc**, và chỉ qua client riêng của kit. Tiền điều kiện không được dựng bằng DB.
- **Captcha không tự giải được.** Màn login của app hiện tại sinh captcha mới mỗi postback, nên **CI
  không người trông sẽ không tự đăng nhập được**. Phải nạp sẵn phiên, hoặc có người đọc captcha.

## Kiến trúc

```mermaid
flowchart TD
    Kit(["Test Automation Kit"])
    Kit --> B0["Bước 0<br/>khám phá hệ thống"]
    B0 --> P1
    Kit --> P1["Phase 1<br/>sinh testcase + Excel"]
    Kit --> P2["Phase 2<br/>execute automation"]
    Kit --> RR["Rerun<br/>verify bug đã fix"]
    Kit --> SS["Shared Services<br/>Google Sheet, Backlog, Excel, config"]
    Kit --> PR["Partial Rerun<br/>xử lý đổi tài liệu"]
    Kit --> OUT["Outputs<br/>artifact theo task"]
```

| Lớp | Làm gì |
|---|---|
| **Bước 0** | Bò app bằng script tất định, trả bản đồ màn, danh mục API, vùng mù tài liệu. Mẫu số coverage của Phase 1 lấy từ đây, nên màn không có trong tài liệu vẫn vào phạm vi. Mọi bản ghi là `observed`, không phải oracle |
| **Phase 1** | Đọc requirement, sinh testcase Markdown canonical, xuất Excel, chấm coverage |
| **Publish** | Sau khi QA duyệt, đẩy Excel lên Google Sheet qua Drive MCP |
| **Phase 2** | Dựng tiền điều kiện qua setup layer, execute Playwright, thu evidence, đồng bộ cột `Result` |
| **Rerun** | Chạy lại case của bug đã fix. Không dùng để đồng bộ tài liệu mới |
| **Partial Rerun** | Nhánh phụ xử lý tài liệu đổi. Xoá nhánh này thì luồng chính vẫn chạy |
| **Setup Layer** | `tests/support/setup/`: factory, hook, fixture, mock, cleanup, contract. Không dựng state bằng DB |

Chi tiết từng thư mục: [`docs/kit-map.md`](docs/kit-map.md).
Quy ước Playwright: [`.agent/rules/playwright_fe.md`](.agent/rules/playwright_fe.md).

## Máy gác

Kit không dựa vào việc người nhớ luật. Mỗi luật đo được đều có một máy gác, và CI chạy chúng mỗi lần
push.

```bash
npm run preflight -- --task <TASK_KEY>   # thiếu input hoặc config hỏng thì chặn
npm run gates -- --task <TASK_KEY>       # bó gate trước khi finalize
npm run next -- --task <TASK_KEY>        # lệnh tiếp theo nên chạy
```

Danh mục đầy đủ (tự sinh, đừng sửa tay): [`.agent/config/GATES.md`](.agent/config/GATES.md).

Quy ước mã thoát: **1 = đã đo và sai**, **2 = chưa phán được**. Gặp exit 2 thì đừng đọc report của
lượt đó.

## Phát hành kit

Dành cho người maintain kit, không phải người dùng.

```bash
npm run version:check    # version hợp semver, khớp tag, CHANGELOG có mục tương ứng
npm run package:kit      # đóng gói CHỈ lớp GENERIC ra dist/
npm run release:verify   # cổng cuối: giải nén ra thư mục sạch rồi chạy lại toàn bộ
```

`release:verify` là **cổng**: không đạt thì không phát hành. Ranh giới GENERIC và PROJECT:
[`.agent/config/kit-layers.md`](.agent/config/kit-layers.md).
