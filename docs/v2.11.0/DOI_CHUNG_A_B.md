# Đối chứng kit A với kit B — quy trình để so cho công bằng

Viết ngày **12/11/2026**. Đây là quy trình, **chưa phải kết quả**. Chưa có lượt đối chứng nào chạy theo nó.

## Câu hỏi được phép trả lời

> Trên **cùng một task**, **cùng đầu vào**, **cùng model**, kit nào sinh bộ testcase **phủ yêu cầu rộng hơn**, **bắt
> được nhiều bug thật hơn**, và **ít kỳ vọng sai hơn**, với chi phí bao nhiêu?

Không được trả lời câu "kit nào tốt hơn" nói chung. Mỗi kết luận chỉ đúng cho loại task đã đo.

## Vì sao so hiện tại KHÔNG công bằng

| Lệch | Hậu quả |
|---|---|
| B có output thật trên task QEMIS, A chỉ có source | So một bên đã chạy với một bên chưa chạy. Không ra kết luận nào về độ chính xác |
| `knowledge/` của B đã tích luỹ từ chính các task đó | B được đọc đáp án của lượt trước. Đo 09/11 (`DO_LUONG_PACK.md`): một file mẫu do chính B viết đã chứa nguyên văn đáp án |
| Đánh giá bằng gate của B | Gate của B kiểm khuôn của B. A sai khuôn B là chuyện hiển nhiên, không phải sai nghiệp vụ |
| Một lượt mỗi bên | Model chạy hai lần cho hai kết quả khác nhau. Một lượt không tách được kit với độ ngẫu nhiên |

## 1. Đăng ký TRƯỚC khi chạy

Ghi các mục dưới vào một file đăng ký, băm `sha256`, và commit **trước** lượt chạy đầu tiên. Đổi bất kỳ mục nào sau
khi đã thấy kết quả thì cả lượt đối chứng bị huỷ.

| Mục | Quy định |
|---|---|
| Task | Ít nhất 3 task, mỗi task một loại: ① validation theo bảng trường · ② luồng trạng thái và phân quyền · ③ tính toán xuyên module. Chọn task mà **cả hai kit chưa từng chạy** |
| Đầu vào | Một gói cố định cho mỗi task: file đặc tả, `ui_catalog`, ảnh màn. Băm từng file |
| Model | Cùng `model id`, cùng mức effort, cùng trần token và trần thời gian |
| Số lượt | **Ít nhất 3 lượt** mỗi kit mỗi task, mỗi lượt một workspace sạch |
| Mẫu số | Danh mục yêu cầu của từng task (`scope:anchor`), mỗi mục kèm nguồn, chốt trước khi chạy |
| Bug đã biết | Danh sách bug DEV đã **nhận** trên module đó (`bug:outcome:backlog`, nhãn `accepted`). Giấu khỏi cả hai kit |
| Ngưỡng kết luận | Khai trước: chênh bao nhiêu thì gọi là khác biệt, và khoảng tin cậy bao nhiêu |

## 2. Chặn rò đáp án

- Workspace của mỗi lượt **không** có: `outputs/` của task đó, `knowledge/` của module đó, transcript của các phiên
  cũ, và file bug đã biết.
- Khai trước các cụm chỉ người biết đáp án mới viết ra (theo cách `skills:practice` khai `tu_khoa_phan_biet`).
  Cụm nào có sẵn trong workspace làm bài thì lượt đó **không ra số** (exit 2).
- Chạy thêm **một task đối chứng**: một task dễ, mà cả hai kit đều nên đạt trần. Nếu hai kit chênh nhau ở task này
  thì nghi bộ chấm thiên vị trước khi nghi kit.

## 3. Chuẩn hoá đầu ra

Mỗi kit xuất testcase theo khuôn của nó. Trước khi chấm, chuyển cả hai về **một khuôn trung lập**:
`{ id, yeu_cau: [mã trong danh mục], tien_de, buoc, ky_vong }`.

- Bộ chuyển chỉ được đổi **khuôn**, không được đổi **nội dung**. Kiểm bằng cách đối chiếu số case và băm phần chữ
  của bước và kỳ vọng trước và sau khi chuyển.
- Tên kit bị gỡ khỏi mọi file đưa cho người chấm, thay bằng nhãn ngẫu nhiên `X`/`Y` có seed ghi lại.

## 4. Bốn phép đo

| # | Đo gì | Ai chấm | Dùng máy nào của B |
|---|---|---|---|
| M1 | **Phủ yêu cầu**: số mục trong danh mục có ít nhất một case trỏ tới. Liên kết suy diễn không được tính | Máy | `scope:anchor`, `trace:matrix` |
| M2 | **Bắt bug đã biết**: với từng bug đã nhận, có case nào mà nếu chạy trên bản lỗi thì sẽ FAIL | Người chấm mù, trả lời có cấu trúc `{ bug, tcId, vi_sao }` | Bộ chấm phải qua hiệu chuẩn ≥90% (`judge`) |
| M3 | **Kỳ vọng sai**: bốc ngẫu nhiên case, người chấm đối chiếu kỳ vọng với **đặc tả**, không với app | Người, theo phiếu mù | Cơ chế của `pass:audit`: seed, phiếu không có lời khai, Wilson 95% |
| M4 | **Chi phí**: token, thời gian, số câu hỏi chặn người | Máy | `agent:scorecard` |

Không dùng gate của B để chấm A. Kiểm khuôn chỉ dùng các luật trung lập: case có kỳ vọng, có bước, trỏ được về yêu
cầu.

M2 là phép đo mạnh nhất, vì bug đã được DEV nhận là lỗi thật, không phụ thuộc ý kiến của ai trong hai kit.

## 5. Quy tắc kết luận

- Báo **từng task, từng phép đo**, kèm khoảng tin cậy. Không gộp thành một con số chung.
- "Không phân biệt được" là một kết luận hợp lệ, và với n=3 nó thường là kết luận đúng.
- Lượt nào máy gác rò đáp án chặn thì lượt đó bị huỷ, không được chạy lại riêng lượt đó cho đến khi được.
- Không viết "kit X chính xác hơn Y%" nếu khoảng tin cậy hai bên chồng nhau.

## 6. Ai làm phần nào

| Việc | Ai |
|---|---|
| Chạy phía B | Làm được trong repo này |
| Chạy phía A | **Người phụ trách kit A**, hoặc chạy theo README của A trên máy sạch. Repo này chỉ có hướng dẫn tham khảo của A (`.agent/extensions/kit-a/source-references/`), không có bản chạy được |
| Chấm M2 và M3 | Người không tham gia viết testcase của bên nào |
| Duyệt file đăng ký | QA-Lead, trước lượt chạy đầu tiên |

## 7. Còn thiếu gì trước khi chạy được

Ba thứ chưa có máy. Phải dựng trước lượt đầu tiên, nếu không mỗi lượt sẽ tự làm tay theo một kiểu:

1. **Đóng gói và băm đầu vào** cho từng task, kèm danh sách đường dẫn bị cấm trong workspace.
2. **Bộ chuyển khuôn của A** sang khuôn trung lập, kèm phép kiểm "không đổi nội dung".
3. **Phiếu chấm mù cho M2**: liệt kê bug đã biết và bộ case đã gỡ tên kit, nhận câu trả lời có cấu trúc.

Phần M3 dùng lại được `pass:audit`. Phần chặn rò dùng lại được cơ chế của `skills:practice`.

## Bài học đã trả giá mà quy trình này mang theo

Từ `DO_LUONG_PACK.md` (09/11/2026), ba lượt đo đầu đều hỏng:

- **Nhánh đối chứng cầm sẵn đáp án** qua một file mẫu. Vì thế mới có mục 2.
- **Đề quá dễ**, cả hai nhánh cùng chạm trần. Vì thế mới cần task đối chứng.
- **Bộ chấm khớp chữ chấm oan 3/4 câu trả lời tốt.** Vì thế M2 bắt người chấm trả lời có cấu trúc.

Từ `pass:audit` và `bug:tac-gia` (12/11/2026):

- **Phiếu chấm có lời khai của bên được chấm thì người chấm bị neo.**
- **Đọc lại một báo cáo không chứng minh được ai đã làm ra nó.** Bản đầu của `bug:tac-gia` đếm 48/96 bug "do
  agent", neo đúng chỉ còn 16/96.
