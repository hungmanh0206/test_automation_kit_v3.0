# Khám phá hệ thống trước khi viết case

> **1,5 giờ** · Có gì trong tay: một hệ thống chạy được và một ít tài liệu · Sau bài này: mẫu số coverage của bạn đến từ thứ quan sát được trên app, không chỉ từ thứ tài liệu nhắc tới

**Vấn đề**

Bạn nhận một module để test. Tài liệu có bốn màn. Bạn viết đủ case cho bốn màn đó, coverage báo 100%,
và bạn nộp.

Hai tuần sau khách hàng báo một lỗi ở màn thứ năm. Màn đó có thật, bạn vào được bằng URL, nhưng tài
liệu không có mục nào cho nó. Không ai cố tình bỏ nó. Chỉ là **không gì trong quy trình của bạn có thể
biết nó tồn tại**. Danh mục phạm vi do bạn tự liệt kê từ tài liệu. Nên nó không thể chứa thứ tài
liệu không nhắc.

Con số 100% hôm trước không sai. Nó chỉ là 100% của một mẫu số mà chính bạn đặt ra.


**Tóm tắt bài này**

| | |
|---|---|
| **Bạn đang khổ vì** | Coverage 100% mà vẫn sót màn, vì mẫu số chỉ gồm những gì tài liệu nhắc. |
| **Bài này bạn gõ gì** | Chạy một lệnh bò app, đọc bản tóm tắt, rồi đối chiếu nó với danh mục phạm vi của bạn. |
| **Xong thì được gì** | Biết màn nào có thật mà tài liệu không nói, và một máy chặn khi mẫu số bỏ sót chúng. |

> Bài này có vài từ mới. Chúng được gọi tên ở **cuối bài**, sau khi bạn đã chạm vào chúng, chứ không
> định nghĩa trước. Gặp từ lạ giữa bài thì đọc tiếp, mục đó sẽ gom lại.

## Bài này bạn sẽ làm gì

| Việc | Phút |
|---|---|
| 1. Chạy lệnh và đọc đúng bốn con số | 20 |
| 2. Tìm vùng mù: màn có thật mà tài liệu im lặng | 25 |
| 3. Nối bản đồ vào mẫu số, và để máy chặn khi bỏ sót | 25 |
| 4. Hiểu vì sao kết quả có thể nói dối bạn | 20 |

## Việc 1 — Chạy lệnh và đọc đúng bốn con số (20 phút)

```bash
TASK_ENV=profiles/<TASK>/task.env npm run discover -- --mode task \
  --base-url <url UAT> --confirm-nonprod --pham-vi "^/HocSinh" \
  --tai-lieu <đường dẫn tài liệu .md>
```

Xác nhận với người phụ trách trước khi chạy. Lệnh này mở hàng chục trang trên môi trường thật.

**Bạn sẽ thấy** một bản tóm tắt ngắn. Bốn dòng đầu là thứ đáng đọc nhất:

```
màn: 12 · API: 7 · vai trò: 2
độ đầy đủ lượt bò: 12/14 route (86%)
không tới được: needs_account 1 · captcha 0 · error 1 · budget 0
tường lửa ghi: 23 request ghi bị chặn · 0 lọt (phải là 0)
```

Dòng cuối quan trọng hơn vẻ ngoài của nó. Lệnh chỉ đọc, không ghi: mọi request không phải GET đều bị
chặn ở tầng mạng. Số `lọt` khác 0 nghĩa là có một đường ghi đã đi qua, và bạn phải dừng dùng kết quả
lượt đó.

| Thấy khác | Nghĩa là | Làm gì |
|---|---|---|
| `0 màn` và lệnh exit 1 | Chưa đăng nhập, hoặc URL sai | Nạp session rồi chạy lại. Đừng dùng kết quả rỗng làm mẫu số |
| `captcha` cao hơn số màn bò được | Session chết giữa chừng, mọi trang sau là màn đăng nhập | Đăng nhập lại. Đừng kết luận "app bắt captcha ở mọi màn" |
| độ đầy đủ dưới 80% | Lượt bò hẹp | Vẫn dùng được, nhưng mọi tỉ lệ sau đó phải ghi kèm cảnh báo đó |
| `lọt` khác 0 | Một đường ghi đã đi qua tường lửa | Dừng lại, báo ngay |

## Việc 2 — Tìm vùng mù (25 phút)

Trong bản tóm tắt có một mục tên **Vùng mù**. Đó là danh sách màn bạn bò tới được mà tài liệu không có
mục nào cho nó.

```
## Vùng mù: 2 màn quan sát được mà tài liệu KHÔNG có mục
- /HocSinh/ChuyenLop.aspx
- /HocSinh/SapXepAlphabet.aspx
```

**Bạn sẽ thấy** mỗi màn trong danh sách đó kéo theo một câu hỏi trong `questions.md`. Câu hỏi không tự
trả lời được: *màn này là tính năng ngoài tài liệu, hay tài liệu thiếu?* Hai câu trả lời dẫn tới hai
việc khác nhau, nên đừng chọn bừa.

Bây giờ tới chỗ **vì sao nó đếm theo mục có tiêu đề**, không đếm theo chuỗi xuất hiện. Đếm theo chuỗi thì một câu kiểu *"màn Chuyển lớp sẽ bổ sung sau"* cũng tính là đã có tài liệu.
Màn bị bỏ sót lại được báo là đã phủ. Một tài liệu phủ một màn khi nó có **mục** cho màn đó.

| Thấy khác | Nghĩa là | Làm gì |
|---|---|---|
| Vùng mù bằng 0 mà bạn không truyền `--tai-lieu` | Không phải tài liệu đủ, mà là không có tài liệu nào để so | Truyền đường dẫn tài liệu rồi chạy lại |
| Mọi màn đều là vùng mù | Đúng với dự án mới chưa có tài liệu | Đọc là "toàn vùng mù", đừng đọc là "không có vùng mù" |
| Màn có trong tài liệu mà lượt bò không thấy | Ba cách đọc, không chọn bừa | Đối chiếu ma trận vai trò và độ đầy đủ trước khi nói "chưa build" |

## Việc 3 — Nối bản đồ vào mẫu số (25 phút)

Chép hai file vào thư mục `requirements/` của task:

```bash
cp knowledge/system/discovery/<build>/system_map.json       outputs/<DA>/tasks/<TASK>/requirements/
cp knowledge/system/discovery/<build>/injection_surface.json outputs/<DA>/tasks/<TASK>/requirements/
```

Rồi chạy máy neo mẫu số:

```bash
npm run scope:anchor -- --task <TASK>
```

**Bạn sẽ thấy** nó liệt kê những route nằm trong phạm vi mà danh mục của bạn chưa khai. Khai từng cái
trong file manifest chiều của task:

```json
{
  "routes_quan_sat_duoc": {
    "/HocSinh/DanhSach.aspx": "INV-001",
    "/HocSinh/ChuyenLop.aspx": "n/a"
  },
  "na_reasons": {
    "/HocSinh/ChuyenLop.aspx": "chuyển lớp thuộc task CSDL-9002, không phải task này"
  }
}
```

Giá trị là mã mục phạm vi phủ route đó, hoặc `n/a` kèm lý do. Không có lựa chọn thứ ba, và đó là chủ
đích. Một route có thật mà không ai khai là một vùng không ai test. Coverage vẫn báo đủ.

| Thấy khác | Nghĩa là | Làm gì |
|---|---|---|
| Hàng chục route bị báo thiếu | Bạn chạy lệnh mà không có `--pham-vi`, nên nó bò cả app | Chạy lại với khuôn regex của module |
| Máy nói "CHƯA GÁC ĐƯỢC" | Chưa có `system_map.json`, hoặc lượt bò không khai phạm vi | Đó không phải "đạt". Nó đang nói nó không kiểm được gì |
| `n/a` bị chặn | Khai `n/a` mà không có lý do | Viết lý do cụ thể, không viết "không áp dụng" |

## Việc 4 — Vì sao kết quả có thể nói dối bạn (20 phút)

Phần này quan trọng hơn ba việc trên.

Lượt chạy thật đầu tiên của chính lệnh này trên một hệ thống thật trả về: **292 route báo captcha**. Đọc
qua thì đó là một phát hiện lớn về sản phẩm — "app bắt captcha ở mọi màn".

Nó sai hoàn toàn. Trong danh sách 292 route đó có một route tên `Logout`. Bộ bò đã **đi theo link Đăng
xuất và tự huỷ phiên của chính nó**. Mọi trang sau đó đều là màn đăng nhập. Màn đăng nhập thì có
captcha.

Không có gì đỏ. Không có lỗi nào ném ra. Lệnh vẫn kết thúc bình thường. Và nó sinh ra một kết luận sai
về sản phẩm **từ một lỗi của chính công cụ**.

**Bạn sẽ thấy** ba thói quen rút ra từ đó, và chúng dùng được cho mọi công cụ chứ không riêng bài này:

- **Một con số bất thường thì nghi công cụ trước, nghi sản phẩm sau.** Một app hiếm khi bắt captcha ở
  mọi màn. Tỉ lệ captcha cao là tín hiệu của phiên đăng nhập, không phải của sản phẩm.
- **Đọc cả danh sách, đừng đọc mỗi con số tổng.** Tên `Logout` nằm ngay trong danh sách đó.
- **Hỏi phép đo này đo được trong điều kiện nào.** Lượt bò chỉ nói về những màn nó tới được. Độ đầy đủ
  86% nghĩa là 14% hệ thống chưa ai nhìn, và không con số nào sau đó phủ được phần ấy.

Mọi bản ghi mà lệnh sinh ra đều mang nhãn `observed`. Nó là **thứ quan sát được**, không phải điều
đúng. Muốn dùng làm căn cứ kết luận PASS hay FAIL thì phải hỏi người, rồi mới ghi vào kho tri thức.

## Gọi tên những gì bạn vừa làm

| Từ | Nghĩa trong bài này |
|---|---|
| Mẫu số coverage | Tập hợp những thứ bạn coi là "phải test". Tỉ lệ phủ là phần đã test chia cho tập này |
| Vùng mù | Màn quan sát được trên app mà tài liệu không có mục nào cho nó |
| Độ đầy đủ lượt bò | Bao nhiêu phần hệ thống lượt bò tới được. Dưới ngưỡng thì mọi tỉ lệ sau đó kèm cảnh báo |
| Tường lửa ghi | Lớp chặn ở tầng mạng: mọi request không phải GET đều bị huỷ trước khi ra khỏi máy |
| `observed` | Nhãn nói bản ghi này là thứ quan sát được, chưa ai xác nhận nó đúng |

## Cây thư mục sau bài này

```
outputs/<DA>/tasks/<TASK>/requirements/
├── system_map.json           ← MỚI · bản đồ màn và API quan sát được
├── injection_surface.json    ← MỚI · điểm nhập đi tới truy vấn dữ liệu
├── scope_inventory.md        ← có từ trước · nay được đối chiếu với bản đồ
└── manifest chiều             ← có từ trước · thêm khối routes_quan_sat_duoc
```

## Tự kiểm

| Câu | Trả lời được chưa |
|---|---|
| Vì sao coverage 100% vẫn có thể sót cả một màn? | |
| Vùng mù khác gì với "màn chưa test"? | |
| Thấy `captcha` cao hơn số màn bò được thì nghi gì trước? | |
| Vì sao độ phủ tài liệu đếm theo mục có tiêu đề, không đếm theo chuỗi? | |
| `observed` khác gì với một luật đã được chốt? | |

## Bài tập về nhà (20 phút)

Chạy lệnh trên một module bạn đã test xong. Đếm xem bản đồ có bao nhiêu màn, rồi mở danh mục phạm vi cũ
của bạn ra đếm lại.

Nếu hai con số bằng nhau, viết một dòng nói vì sao bạn tin chúng bằng nhau. Nếu lệch, đừng sửa danh mục
ngay: viết trước một câu cho mỗi màn lệch, nói nó là tính năng ngoài tài liệu hay tài liệu thiếu. Câu
đó mới là thứ đáng mang đi hỏi.

## Bài sau

Bài này cho bạn một mẫu số đến từ app. Nhưng một mẫu số đúng vẫn chưa nói gì về **thứ tự** làm: với hai
mươi màn và thời gian cho mười màn, bạn test màn nào trước?

Phần chấm điểm rủi ro trả lời đúng câu đó. Nó dùng lại chính bản đồ bạn vừa tạo: màn nào có
bề mặt dùng chung, màn nào có điểm nhập đi thẳng tới truy vấn dữ liệu.
