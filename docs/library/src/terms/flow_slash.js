/* NHÓM 6c — MƯỜI BỐN SLASH COMMAND, mỗi lệnh một mục (11/2026).
   Nguồn: .claude/commands/*.md · .agent/config/load_map.json · .agent/config/handoff.json

   VÌ SAO TÁCH RA THÀNH NHÓM RIÊNG: trước đó cả bộ lệnh nằm gọn trong MỘT mục `f-slash-commands`,
   liệt kê tên trong một dòng `detail`. Mục đó trả lời được "kit có lệnh gì", nhưng không trả lời
   được câu người mới thật sự hỏi: "gõ lệnh nào bây giờ, và nó dừng ở đâu". Và vì nó là một dòng
   văn, hai lệnh thêm vào tháng 11 đã nằm ngoài trang mà không chỗ nào báo — `library:drift` bắt
   được đúng chỗ đó. */
const TERMS_FLOW3 = [

{ id:'f-cmd-1-start', t:'/1_start', cat:'flow',
  def:'Cửa vào cho người mới: hỏi đúng 5 điều rồi tạo profile task.',
  detail:'Hỏi task nào, module nào, nguồn requirement ở đâu, môi trường nào, giới hạn scope. Ghi ra profiles/<TASK_KEY>/task.env và task.md, chạy preflight, rồi in lệnh kế tiếp và DỪNG.',
  why:'Người mới không thiếu tài liệu, họ thiếu một chỗ bắt đầu không phải chọn gì. Năm câu này là tập nhỏ nhất mà thiếu bất kỳ câu nào thì một gate phía sau sẽ chặn.',
  ex:'/1_start CSDL-4008',
  trap:'Nó KHÔNG đọc đặc tả, KHÔNG sinh case và KHÔNG tự gọi phase sau. Thiếu câu trả lời nào thì nó dừng và hỏi, không tự điền.',
  src:'.claude/commands/1_start.md', rel:['f-cmd-2-phase1','f-task-env','f-task-key','g-preflight_gate'] },

{ id:'f-cmd-2-phase1', t:'/2_phase1 — Phase 1', cat:'flow',
  def:'Phase chuẩn bị: gọi /1_start rồi /discover, theo đúng thứ tự đó.',
  detail:'Hai việc hỏng theo hai cách khác nhau nên tách làm hai bước. Bước tạo profile không chạm app, hỏng thì không chạy được gì. Bước khám phá chạm app nhưng chỉ ĐỌC, hỏng thì vẫn chạy được nhưng viết case mù.',
  why:'Mẫu số coverage phải lấy từ thứ quan sát được, không chỉ từ tài liệu. Màn nào tài liệu không nhắc mà app có thật thì vẫn phải vào phạm vi, nếu không thì phần trăm phủ là phần trăm của một danh mục do chính agent tự liệt kê.',
  ex:'/2_phase1 CSDL-4008',
  trap:'Số trong tên lệnh là thứ tự CHẠY chứ không phải thứ tự bao hàm, nên /1_start mang số nhỏ hơn dù nó nằm bên trong /2_phase1. Phase này không đọc đặc tả và không sinh case.',
  src:'.claude/commands/2_phase1.md', rel:['f-cmd-1-start','f-cmd-discover','f-cmd-3-phase2','f-phase1'] },

{ id:'f-cmd-3-phase2', t:'/3_phase2 — Phase 2', cat:'flow',
  def:'Phase sinh testcase: đọc đặc tả, hỏi hết mơ hồ, rồi mới sinh Markdown canonical và xuất Excel.',
  detail:'Chỗ dừng quan trọng là Ambiguity Gate. Requirement còn mơ hồ ở mức Critical hoặc High thì nó ghi câu hỏi ra reports/phase1-clarifications.md và chờ người trả lời.',
  why:'Đoán một chỗ mơ hồ rồi sinh case là biến phỏng đoán thành expected, và expected sai thì lượt execute sau đó xanh trên một kỳ vọng bịa. Gate này là chỗ chặn duy nhất trước khi điều đó xảy ra.',
  ex:'/3_phase2 CSDL-4008',
  trap:'Phase này KHÔNG execute gì cả, nó dừng ở trạng thái Pending QA confirmation. Chỉ cần sửa vài case khi requirement đổi thì dùng /partial-rerun.',
  src:'.claude/commands/3_phase2.md', rel:['f-cmd-2-phase1','f-cmd-4-publish','f-phase1','f-excel-canonical','f-dimension-manifest'] },

{ id:'f-cmd-4-publish', t:'/4_publish', cat:'flow',
  def:'Đồng bộ testcase hoặc kết quả execute lên Google Sheet.',
  detail:'Luôn cho xem bản merge local trước, chỉ ghi đè Sheet thật sau khi người dùng duyệt. Chạy sau khi QA đã xác nhận bộ case.',
  why:'Ghi đè Sheet thật là việc không hoàn tác được, và Sheet là nơi nhiều người cùng đọc. Một bước xem trước bắt buộc rẻ hơn hẳn một lần mất dữ liệu của người khác.',
  ex:'/4_publish CSDL-4008',
  trap:'Chưa xem bản merge thì đừng chạy. Sheet là bản XUẤT, nguồn sự thật vẫn là test-cases/*.md.',
  src:'.claude/commands/4_publish.md', rel:['f-cmd-3-phase2','f-sheet','f-excel-canonical'] },

{ id:'f-cmd-5-phase3', t:'/5_phase3 — Phase 3', cat:'flow',
  def:'Phase execute: dựng automation, chạy thật trên UAT, chấm verdict theo taxonomy.',
  detail:'Nó xác nhận với người dùng trước lượt chạm UAT đầu tiên, vì UAT là môi trường dùng chung. Fail ở bước dựng tiền điều kiện được tính là setup_failure.',
  why:'Một lượt chạy chỉ có giá trị khi tầng lỗi được khoanh đúng. Gộp lỗi setup vào lỗi sản phẩm là tạo nhiễu cho Dev, còn gộp ngược lại là giấu bug.',
  ex:'/5_phase3 CSDL-4008',
  trap:'Chưa có bộ testcase canonical thì chạy /3_phase2 trước. Case setup_failure KHÔNG log bug.',
  src:'.claude/commands/5_phase3.md', rel:['f-cmd-6-phase4','f-verdict-taxonomy','f-phase2','f-test-execution'] },

{ id:'f-cmd-6-phase4', t:'/6_phase4 — Phase 4', cat:'flow',
  def:'Phase rerun: chạy lại đúng những case liên quan tới bug đã fix rồi cập nhật kết quả.',
  detail:'Rerun là phép đo có chủ đích, không phải chạy lại cả suite. Nó map bug đang mở sang case và spec, chạy đúng chừng đó, rồi chuyển bug sang Done khi PASS thật.',
  why:'Chạy tràn cả bộ làm mất ý nghĩa của phép đo: không phân biệt được case xanh vì bug đã sửa với case xanh vì nó vốn chưa bao giờ chạm vào vùng lỗi.',
  ex:'/6_phase4 CSDL-4008',
  trap:'Nó KHÔNG sinh testcase mới. Requirement đổi là việc của /partial-rerun. PASS sau một lượt duy nhất mà chưa loại flaky thì chưa đủ.',
  src:'.claude/commands/6_phase4.md', rel:['f-cmd-5-phase3','f-cmd-7-release','f-rerun'] },

{ id:'f-cmd-7-release', t:'/7_release', cat:'flow',
  def:'Cửa cuối: chạy cửa ra done rồi đưa khuyến nghị go hoặc no-go có căn cứ.',
  detail:'Đối chiếu tiêu chí exit đã chốt TRƯỚC khi xem kết quả, rồi mới kết luận. Còn case BLOCKED hoặc SKIP chưa giải thích thì cửa chặn.',
  why:'Tiêu chí chốt sau khi nhìn số là tiêu chí được uốn theo số. Chốt trước là cách duy nhất để chữ "đạt" còn nghĩa.',
  ex:'/7_release CSDL-4008',
  trap:'QA khuyến nghị, PM quyết. Lệnh này không tự phát hành.',
  src:'.claude/commands/7_release.md', rel:['f-cmd-6-phase4','sk-release_summary','f-kit-version'] },

{ id:'f-cmd-discover', t:'/discover', cat:'flow',
  def:'Bò app bằng script tất định rồi trả bản đồ màn, API, vùng mù tài liệu và bề mặt injection.',
  detail:'Mọi bản ghi mang nhãn observed, tức quan sát được. Kết quả ghi vào requirements/system_map.json và thành mẫu số coverage của phase sinh case.',
  why:'Tài liệu luôn kể thiếu. Thứ app có mà tài liệu không nhắc là đúng vùng không ai viết case, và cũng là vùng không ai biết mình đang bỏ sót.',
  ex:'/discover CSDL-4008',
  trap:'Bản kê này KHÔNG phải oracle. Chụp từ build không chứng minh build đúng.',
  src:'.claude/commands/discover.md', rel:['f-cmd-2-phase1','f-impact-map','c-oracle'] },

{ id:'f-cmd-preflight', t:'/preflight', cat:'flow',
  def:'Soát input và config bắt buộc trước khi vào một phase.',
  detail:'Thiếu file, JSON hỏng, hoặc chưa có testcase canonical thì chặn ngay ở cửa vào.',
  why:'Hỏng sớm ở cửa vào rẻ hơn hẳn hỏng giữa chừng khi đã chạy được nửa bộ case, vì lượt chạy dở dang để lại một bảng kết quả không đọc được.',
  ex:'/preflight CSDL-4008',
  trap:'Nó gác ĐẦU VÀO, không gác chất lượng bộ case. Việc đó là của /gates.',
  src:'.claude/commands/preflight.md', rel:['g-preflight_gate','f-cmd-gates','f-task-env'] },

{ id:'f-cmd-gates', t:'/gates', cat:'flow',
  def:'Chạy một bó gate gộp trước khi finalize hoặc publish.',
  detail:'Gộp preflight, thiết kế case, chất lượng từng dòng, kết quả execute và phần cam kết vào một lượt.',
  why:'Các gate lẻ chạy rời thì người chạy nhớ cái này quên cái kia, và cái bị quên luôn là cái không ai thấy. Một lệnh gộp biến danh sách phải nhớ thành một lượt chạy.',
  ex:'/gates CSDL-4008',
  trap:'Còn dòng CHẶN thì sửa nội dung cho đúng, đừng nới ngưỡng. Chạy giữa lúc đang sinh case chỉ cho một bảng đỏ vô nghĩa vì nó đo bộ ĐÃ XONG.',
  src:'.claude/commands/gates.md', rel:['f-cmd-preflight','f-gate-catalog','g-self_review'] },

{ id:'f-cmd-partial-rerun', t:'/partial-rerun', cat:'flow',
  def:'Sửa hoặc dọn một phần bộ testcase khi requirement đổi giữa chừng.',
  detail:'Dựng bản review trước gồm diff, phần bị ảnh hưởng và case draft, rồi chỉ merge sau khi người dùng duyệt.',
  why:'Requirement đổi làm một phần bộ case thành sai, nhưng sinh lại cả bộ thì mất hết verdict đã có. Bản review trước giữ được cả hai: biết đúng phần nào đổi, và giữ nguyên phần không đổi.',
  ex:'/partial-rerun CSDL-4008',
  trap:'Đây là NGOẠI LỆ ngoài chuỗi bốn phase. Chưa có testcase baseline thì dùng /3_phase2. Không tự apply khi người dùng chưa duyệt.',
  src:'.claude/commands/partial-rerun.md', rel:['f-partial-rerun','f-cmd-3-phase2'] },

{ id:'f-cmd-manual-run', t:'/manual-run', cat:'flow',
  def:'Chạy tay những case khai [manual] để chúng có verdict thật.',
  detail:'Never-auto: chỉ chạy khi người dùng yêu cầu, và chạm UAT thì phải xác nhận trước.',
  why:'SKIP_SETUP chỉ là lời khai "chưa chạy", không phải kết luận. Một case nằm mãi ở đó là một ô trống được đọc nhầm thành một ô đã xong.',
  ex:'/manual-run CSDL-4008',
  trap:'Case CHƯA khai [manual] thì lệnh dừng. Đây không phải đường lách automation.',
  src:'.claude/commands/manual-run.md', rel:['f-verdict-taxonomy','f-cmd-5-phase3'] },

{ id:'f-cmd-explore', t:'/explore', cat:'flow',
  def:'Mở một phiên exploratory có charter để dò rủi ro ngoài phạm vi bộ case đã viết.',
  detail:'Có charter mới chạy. Phát hiện không có oracle_ref thì ghi là OBSERVATION chứ không thành bug.',
  why:'Bộ case viết theo tài liệu chỉ phủ được thứ tài liệu nói tới. Phiên dò có mục tiêu là cách tìm rủi ro nằm ngoài vùng đó mà vẫn kết luận được.',
  ex:'/explore màn hồ sơ trường, trọng tâm phân quyền',
  trap:'Không thay cho bộ case có cấu trúc. Dò không mục tiêu thì không kết luận được gì.',
  src:'.claude/commands/explore.md', rel:['c-oracle','c-oracle','f-cmd-5-phase3'] },

{ id:'f-cmd-ui-debug', t:'/ui-debug', cat:'flow',
  def:'Khám phá DOM thật để tìm locator bền và neo nhãn UI với cột DB.',
  detail:'Dùng khi gặp màn mới, hoặc khi test đỏ vì script_error do locator.',
  why:'Locator đoán từ nhãn trên ảnh chụp màn hình là nguồn chính của script_error, và script_error bị đọc nhầm thành lỗi sản phẩm nhiều hơn bất kỳ tầng nào khác.',
  ex:'/ui-debug màn 3.1 danh sách học sinh',
  trap:'Never-auto: nó mở browser vào UAT nên luôn phải xác nhận trước. Case đỏ vì nghiệp vụ thì soi DOM không trả lời được gì, dùng agent case-debugger.',
  src:'.claude/commands/ui-debug.md', rel:['sk-ui_debug_agent','f-ui-catalog','f-verdict-taxonomy'] }

];
