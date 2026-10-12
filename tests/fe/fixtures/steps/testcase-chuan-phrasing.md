# Fixture — testcase viết ĐÚNG chuẩn §K (step_phrasing)

Fixture này là **phép đối chứng DƯƠNG** cho `steps:match`. Nó tồn tại vì bộ khớp chạy trên 5 task thật
cho ra `0/1079 dùng lại ngay`, và một con số 0 có hai cách đọc hoàn toàn khác nhau:

- bộ khớp hỏng, hoặc
- bộ khớp đúng, còn câu bước của case không viết theo chuẩn tham số.

Không có fixture này thì không phân biệt được hai cách đọc đó, và đúng lý lẽ ấy thì "0%" không được phép
dùng để kết luận bất cứ điều gì. Các case dưới đây diễn đạt **cùng những thao tác** mà case thật đang làm,
chỉ khác ở chỗ **bọc tham số trong nháy kép** (luật P1) và **một mệnh đề một thao tác** (luật P2).

Mọi câu bước ở đây phải khớp `exact` vào `tests/fe/lib/step_catalog.json`. Mục nào rơi xuống `fuzzy` hoặc
`none` là một lỗi của bộ khớp hoặc của danh mục, không phải của fixture.

| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|---|---|---|---|
| FIX_STEPS_TC_001 | UI | [Positive][Display] | Fixture / Khớp exact một tham số | Đọc giá trị combobox theo chuẩn P1 | [ui] Đang ở màn fixture có combobox `cbNamHoc` | `cbNamHoc` | 1. đọc giá trị combobox "cbNamHoc" | 1. Đọc được giá trị đang hiển thị | Medium |
| FIX_STEPS_TC_002 | UI | [Positive][Action] | Fixture / Khớp exact hai tham số | Chọn giá trị combobox theo chuẩn P1 | [ui] Đang ở màn fixture có combobox `cbNamHoc` | `cbNamHoc` = `2026-2027` | 1. chọn combobox "cbNamHoc" = "2026-2027" | 1. Combobox mang giá trị đã chọn | Medium |
| FIX_STEPS_TC_003 | UI | [Positive][Action] | Fixture / Đồng nghĩa động từ | Bốn cách viết cùng một cú bấm đều phải khớp | [ui] Đang ở màn fixture | `cbCapHoc` | 1. kích chọn combobox "cbCapHoc" = "THCS"<br>2. nhấn chọn combobox "cbCapHoc" = "THPT"<br>3. click chọn combobox "cbCapHoc" = "GDTX" | 1. Cả ba lượt chọn đều vào cùng một bước danh mục | Medium |
| FIX_STEPS_TC_004 | UI | [Positive][Action] | Fixture / Tách mệnh đề | Một câu ghép ba thao tác phải tách thành ba mệnh đề | [ui] Đang ở màn fixture | `cbTinh`, `cbHuyen` | 1. chọn combobox "cbTinh" = "Phú Thọ", chọn combobox "cbHuyen" = "Việt Trì", đọc giá trị combobox "cbHuyen" | 1. Ba mệnh đề, cả ba khớp exact | Medium |
| FIX_STEPS_TC_005 | UI | [Negative][Lock] | Fixture / Đo trạng thái khoá | Kiểm ô có bị khoá không | [ui] Đang ở màn fixture có combobox bị khoá | `cbKhoa` | 1. kiểm combobox "cbKhoa" có bị khoá không | 1. Trả về một trong ba trạng thái khoá | Medium |
| FIX_STEPS_TC_006 | UI | [Positive][Display] | Fixture / Bước không tham số | Liệt kê combobox trên màn | [ui] Đang ở màn fixture | — | 1. liệt kê các combobox trên màn | 1. Trả về danh sách ID | Low |
| FIX_STEPS_TC_007 | UI | [Positive][Display] | Fixture / Đọc danh sách lựa chọn | Mở dropdown và đọc toàn bộ lựa chọn | [ui] Đang ở màn fixture | `cbNamHoc` | 1. đọc toàn bộ lựa chọn trong danh sách "cbNamHoc" | 1. Trả về mảng chuỗi hiển thị | Medium |
| FIX_STEPS_TC_008 | UI | [Negative][Match] | Fixture / Mệnh đề KHÔNG có trong danh mục | Thao tác chưa có bước nào phủ phải rơi vào `none` | [ui] Đang ở màn fixture | — | 1. tải tệp "danh-sach.xlsx" lên ô đính kèm | 1. Bộ khớp trả `none`, KHÔNG gán bừa vào một bước combobox | Medium |
| FIX_STEPS_TC_009 | DB | [Positive][Data] | Fixture / Câu SQL không bị tách | Mệnh đề chứa SQL phải giữ nguyên, không tách ở dấu phẩy | [pre_existing] — | — | 1. Chạy db_readonly: SELECT MA_TRUONG, TEN_TRUONG FROM TRUONG WHERE MA_NAM_HOC = 2026 | 1. Một mệnh đề duy nhất, không tách ở dấu phẩy trong danh sách cột | Medium |
| FIX_STEPS_TC_010 | UI | [Negative][Match] | Fixture / Thiếu tham số thì không phải exact | Hình dạng trùng nhưng thiếu giá trị ⇒ phải là `fuzzy`, không được là `exact` | [ui] Đang ở màn fixture | — | 1. chọn combobox "cbNamHoc" = | 1. Bộ khớp trả `fuzzy` kèm lý do thiếu tham số | Medium |
