/* NHÓM 6b — điểm vào và hạ tầng phát hành của kit (9/2026).
   Nguồn: .claude/commands/*.md · scripts/qa/gate_index.js · package.json · docs/UPGRADE.md */
const TERMS_FLOW2 = [

{ id:'f-slash-commands', t:'Slash command (.claude/commands/)', cat:'flow',
  def:'Mười bốn điểm vào gõ được thẳng trong phiên chat, thay cho việc tự nhớ đọc file nào trước.',
  detail:'Bảy lệnh là DÒNG CHẢY CHÍNH, theo đúng thứ tự chạy: /start · /phase1 · /phase2 · /publish · /phase3 · /phase4 · /release. Bảy lệnh còn lại là CÔNG CỤ, gọi khi gặp đúng tình huống: /discover · /preflight · /gates · /partial-rerun · /manual-run · /explore · /ui-debug. Mỗi file khai một description ngắn rồi liệt kê ĐÚNG THỨ TỰ những file phải đọc và những gate bắt buộc phải chạy, với $ARGUMENTS là mã task.',
  why:'Trước đó điểm vào là "đọc prompt_templates/phase2/01_run_phase2.md rồi đọc tiếp bốn workflow theo thứ tự". Tức là người dùng phải nhớ cả thứ tự lẫn tên file, và bỏ sót một bước thì không có gì báo. Đưa vào slash command là biến trình tự đó thành thứ gọi được bằng một dòng.',
  ex:'/phase2 CSDL-12345 sẽ nạp đúng chuỗi: 01_run_phase2 → scope planning → prepare context → generate tc, kèm hai gate bắt buộc.',
  trap:'Slash command KHÔNG thay thế gate, nó chỉ dẫn đúng đường. Gate vẫn là thứ chặn. Và thứ tự chạy KHÔNG đọc được từ thư mục lệnh — nó nằm ở bảng định tuyến và README.',
  how:['Trong Claude Code, TÊN FILE chính là tên lệnh: lệnh ở .claude/commands/ KHÔNG nhận trường name để đặt bí danh, nên tên file không đánh số được mà không bắt người dùng gõ số.','Đổi tên file là đổi luôn lệnh phải gõ, nên mọi chỗ trỏ tới nó phải đổi theo: npm run workflow:refs gác đúng việc đó.'],
  src:'.claude/commands/', rel:['f-cmd-1-start','f-cmd-2-phase1','f-cmd-3-phase2','f-cmd-7-release','g-workflow_refs'] },

{ id:'f-gate-catalog', t:'Danh mục gate (tự sinh)', cat:'flow',
  def:'Bảng liệt kê mọi máy của kit kèm mức chặn, sinh tự động từ source.',
  detail:'Con số hiện tại: 178 máy — 122 CHẶN · 34 SINH (ghi artifact) · 22 BÁO CÁO (chỉ in). Mức được suy từ code chứ không khai tay: exit 1 là CHẶN, ghi artifact là SINH, chỉ in là BÁO CÁO. Bảng còn ghi mỗi máy được gọi từ đâu, và ghi ra .agent/config/GATES.md.',
  why:'Luận đề của kit là "luật cần MÁY". Nhưng máy mà không liệt kê được thì không kiểm toán được. Không ai biết một gate đã âm thầm tụt xuống thành cảnh báo, hay đã mất hết nơi gọi và thành mồ côi.',
  how:['Sinh lại: npm run gates:index.','Chặn khi bảng lệch source: npm run gates:index:check.'],
  trap:'SINH và BÁO CÁO không phải gate bị nới. Chúng không kiểm vi phạm, chỉ tạo dữ liệu cho máy khác chặn.',
  src:'scripts/qa/gate_index.js', rel:['g-gate_index','c-forcing-function','g-policy_source_check'] },

{ id:'f-kit-version', t:'Phiên bản kit (2.0.0)', cat:'flow',
  def:'Kit được phát hành theo MAJOR.MINOR.PATCH, không theo ngày.',
  detail:'Luồng phát hành có ba máy: version:check chặn phát hành thiếu sót · package:kit đóng gói chỉ lớp GENERIC vào dist/ · release:verify giải nén vào thư mục sạch rồi chạy thử.',
  why:'Kit phát cho nhiều dự án và sửa rất thường xuyên. Số phiên bản trả lời được câu duy nhất người nhận cần: nâng bản này có phải sửa gì trong lớp PROJECT không. Ngày tháng không trả lời được câu đó.',
  cmd:'npm run version:check   ·   npm run package:kit   ·   npm run release:verify',
  src:'package.json', rel:['g-version_check','g-package_kit','g-verify_release','f-kit-layers','f-changelog'] },

{ id:'f-upgrade-doc', t:'docs/UPGRADE.md', cat:'flow',
  def:'Hướng dẫn nâng bản kit cho dự án đang dùng bản cũ.',
  detail:'Đi cùng CHANGELOG: changelog nói ĐÃ ĐỔI GÌ, upgrade nói PHẢI LÀM GÌ ở lớp PROJECT khi nâng.',
  why:'Người nhận kit không cần biết mọi thay đổi bên trong, họ cần biết đúng phần phải tự sửa. Tách hai tài liệu ra khiến việc nâng bản thành một checklist thay vì một buổi đọc changelog.',
  src:'docs/UPGRADE.md', rel:['f-changelog','f-kit-version','f-kit-layers'] }

];
