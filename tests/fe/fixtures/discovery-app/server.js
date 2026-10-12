'use strict';

/*
 * APP FIXTURE cho Bước 0 — Khám phá hệ thống (v2.6.0 §D3). Chạy OFFLINE, không mạng, không DB.
 *
 * VÌ SAO LÀ HTTP SERVER mà không phải `file://` như các fixture khác của kit (`expand-trap.html`,
 * `field-inventory.html`): thứ phải chứng minh ở đây là tường lửa chặn request theo METHOD. Trang
 * `file://` không sinh được POST/DELETE, và `fetch` sang một origin khác thì vỡ CORS trước khi tường lửa
 * kịp nói gì. Muốn đo thật thì request phải thật — nên fixture tự dựng server trên cổng ephemeral.
 *
 * Đây là fixture CÓ TRẠNG THÁI, cố ý: `store` thay đổi được qua POST/DELETE. Nhờ vậy spec khẳng định
 * được điều quan trọng nhất — "sau cả lượt bò, bản ghi trong fixture KHÔNG đổi" — bằng cách so dữ liệu,
 * không bằng cách tin vào số request bị chặn.
 *
 * Fixture mang sẵn đủ bẫy của §D3:
 *   · menu nhiều cấp · sidebar thu gọn · tab · accordion · modal
 *   · bảng có phân trang + bộ lọc · form đủ loại field · upload · date picker · nút Xoá/Lưu
 *   · HAI vai trò menu khác nhau, và `/admin` chỉ bị ẩn ở menu chứ KHÔNG bị chặn phía server
 *   · mock API: GET danh sách/chi tiết có trường enum; POST/DELETE là đường ghi
 *   · `openapi.json` THIẾU 1 endpoint mà UI thật có gọi
 *   · `fsd.md` THIẾU 1 màn
 *   · `/truong` nhận `?sort=` CHUỖI TỰ DO + ô tìm kiếm  → điểm nhập injection ưu tiên cao
 *   · `/lop` nhận `?sort=` ENUM CỐ ĐỊNH                 → nhánh khai `N/A` hợp lệ
 *   · `GET /api/loi-sql` cố ý trả NGUYÊN VĂN thông báo lỗi kiểu SQL Server → để test oracle A9.3
 *
 * `/api/loi-sql` là MOCK TĨNH. Không có DB nào phía sau, không câu lệnh nào được thực thi: nó chỉ trả về
 * một chuỗi đã viết sẵn khi thấy dấu nháy. Mục đích là kiểm ORACLE của kit có nhận ra dấu hiệu lỗi hay
 * không — kit kiểm *ứng dụng có để lọt lỗi DB không*, kit không tự injection vào DB.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const DU_LIEU_GOC = [
  { id: 1, ma: 'C2-001', ten: 'Trường THCS Âu Cơ', cap: 'THCS', trangThai: 'dang_hoat_dong', siSo: 820 },
  { id: 2, ma: 'C2-002', ten: 'Trường THCS Thủ Lệ', cap: 'THCS', trangThai: 'dang_hoat_dong', siSo: 640 },
  { id: 3, ma: 'C1-010', ten: 'Trường Tiểu học Vạn Phúc', cap: 'TH', trangThai: 'tam_dung', siSo: 1120 },
  { id: 4, ma: 'C3-003', ten: 'Trường THPT Phú Thọ', cap: 'THPT', trangThai: 'dang_hoat_dong', siSo: 1450 },
  { id: 5, ma: 'MN-021', ten: 'Trường Mầm non Hoa Sen', cap: 'MN', trangThai: 'giai_the', siSo: 210 },
];
const LOP_GOC = [
  { id: 11, ten: '6A1', khoi: 6, truongId: 1 },
  { id: 12, ten: '7B2', khoi: 7, truongId: 1 },
  { id: 13, ten: '1A1', khoi: 1, truongId: 3 },
];
/** Cột sort HỢP LỆ của `/lop` — enum cố định phía server. Đây là nhánh khai `N/A` có lý do. */
const LOP_SORT_ENUM = ['ten', 'khoi', 'id'];

const CHROME = (vaiTro, tieuDe, than) => `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${tieuDe} · QA Discovery Fixture</title>
<style>
 body{font:14px system-ui;margin:0;display:flex;min-height:100vh}
 nav{width:220px;background:#15202b;color:#e7eef5;padding:12px;flex:0 0 220px}
 nav a{color:#cfe2f3;display:block;padding:5px 6px;text-decoration:none;border-radius:4px}
 nav a:hover{background:#24323f}
 nav .nhom>summary{cursor:pointer;padding:5px 6px;font-weight:600;color:#9fc4e4}
 main{padding:18px 22px;flex:1}
 table{border-collapse:collapse;width:100%;margin:10px 0}
 th,td{border:1px solid #d3dce6;padding:6px 8px;text-align:left}
 th a{text-decoration:none;color:#15202b}
 label{display:block;margin:8px 0 2px;font-weight:600}
 input,select,textarea{padding:5px;min-width:260px}
 .nut{padding:7px 13px;margin:4px 6px 4px 0;border:1px solid #94a7ba;border-radius:4px;background:#f3f7fb;cursor:pointer}
 .nut.nguyhiem{background:#fde7e7;border-color:#e0a0a0}
 dialog{padding:18px;border:1px solid #94a7ba;border-radius:6px}
 [role=tablist]{display:flex;gap:4px;margin:12px 0 0}
 [role=tab]{padding:6px 12px;border:1px solid #d3dce6;border-bottom:none;background:#eef3f8;cursor:pointer}
 [role=tab][aria-selected=true]{background:#fff;font-weight:600}
 [role=tabpanel]{border:1px solid #d3dce6;padding:12px}
</style></head><body>
<nav aria-label="Điều hướng chính">
  <strong style="display:block;padding:4px 6px 10px">QEMIS Fixture</strong>
  <a href="/">Tổng quan</a>
  <details class="nhom" open><summary>Danh mục</summary>
    <a href="/truong">Hồ sơ trường</a>
    <a href="/lop">Hồ sơ lớp</a>
    <a href="/them-truong">Thêm trường</a>
  </details>
  <details class="nhom"><summary>Báo cáo</summary>
    <a href="/bao-cao">Báo cáo tổng hợp</a>
    <!-- HIEN NHUNG DISABLED, co y: "an" va "hien nhung khong bam duoc" la hai loi khai khac nhau cua app
         ve quyen, moi cai mot case. Dung aria-disabled de roles.js doc duoc bang cach chuan; app that con
         dung class disabled va pointer-events none, ca ba deu duoc doc. KHONG dung dau backtick trong khoi
         nay: no nam trong mot template literal cua JS, va backtick se dong chuoi som. -->
    <a href="/bao-cao-emis" aria-disabled="true" style="opacity:.45">Báo cáo EMIS (chưa mở)</a>
  </details>
  ${vaiTro === 'admin' ? '<details class="nhom" open><summary>Quản trị</summary><a href="/admin">Cấu hình hệ thống</a></details>' : '<!-- vai trò nhanvien: mục Quản trị KHÔNG render ở menu, nhưng /admin vẫn vào được -->'}
  <a href="/Logout.aspx">Đăng xuất</a>
  <hr style="border-color:#2c3a47">
  <span style="font-size:12px;color:#8fa6ba">vai trò: <b id="vaiTro">${vaiTro}</b></span>
  <form method="POST" action="/login" style="margin-top:8px">
    <input type="hidden" name="role" value="${vaiTro === 'admin' ? 'nhanvien' : 'admin'}">
    <button class="nut" type="submit">Đổi vai trò</button>
  </form>
</nav>
<main><h1>${tieuDe}</h1>${than}</main></body></html>`;

function trangTongQuan(vaiTro) {
  return CHROME(vaiTro, 'Tổng quan', `
  <p>App fixture offline cho Bước 0. Không có dữ liệu thật, không có DB.</p>
  <ul><li><a href="/truong">Hồ sơ trường</a> — lưới có phân trang, bộ lọc, sort chuỗi tự do</li>
      <li><a href="/lop">Hồ sơ lớp</a> — sort theo enum cố định</li>
      <li><a href="/them-truong">Thêm trường</a> — form đủ loại field</li>
      <li><a href="/bao-cao">Báo cáo</a> — màn KHÔNG có trong fsd.md</li></ul>`);
}

function trangTruong(vaiTro, q) {
  const sort = q.get('sort') || 'ma';
  const tim = q.get('q') || '';
  const trang = Math.max(1, parseInt(q.get('page') || '1', 10) || 1);
  const loc = q.get('cap') || '';
  const cot = ['ma', 'ten', 'cap', 'trangThai', 'siSo'];
  const hang = DU_LIEU_GOC
    .filter((r) => (!loc || r.cap === loc))
    .filter((r) => (!tim || `${r.ma} ${r.ten}`.toLowerCase().includes(tim.toLowerCase())));
  const moiTrang = 3;
  const lat = hang.slice((trang - 1) * moiTrang, trang * moiTrang);
  const soTrang = Math.max(1, Math.ceil(hang.length / moiTrang));
  return CHROME(vaiTro, 'Hồ sơ trường', `
  <form method="GET" action="/truong">
    <label for="q">Tìm kiếm</label><input id="q" name="q" value="${escHtml(tim)}" placeholder="mã hoặc tên">
    <label for="cap">Lọc theo cấp</label>
    <select id="cap" name="cap">${['', 'MN', 'TH', 'THCS', 'THPT'].map((c) => `<option value="${c}"${c === loc ? ' selected' : ''}>${c || '— tất cả —'}</option>`).join('')}</select>
    <button class="nut" type="submit">Áp bộ lọc</button>
  </form>
  <p style="font-size:12px;color:#5b7389">sort hiện tại (chuỗi tự do, không kiểm phía server): <code>${escHtml(sort)}</code></p>
  <table><thead><tr>${cot.map((c) => `<th><a href="/truong?sort=${encodeURIComponent(c)}&q=${encodeURIComponent(tim)}">${c}</a></th>`).join('')}<th>Thao tác</th></tr></thead>
  <tbody>${lat.map((r) => `<tr><td>${r.ma}</td><td><a href="/truong/${r.id}">${escHtml(r.ten)}</a></td><td>${r.cap}</td><td>${r.trangThai}</td><td>${r.siSo}</td>
    <td><button class="nut nguyhiem" data-id="${r.id}" onclick="xoa(${r.id})">Xoá</button></td></tr>`).join('')}</tbody></table>
  <p>${Array.from({ length: soTrang }, (_, i) => `<a class="nut" href="/truong?page=${i + 1}&sort=${encodeURIComponent(sort)}">${i + 1}</a>`).join('')}</p>
  <script>
   // Đường GHI thứ nhất: fetch DELETE. Tường lửa phải abort nó.
   function xoa(id){ fetch('/api/truong/'+id,{method:'DELETE'}).then(function(){location.reload()}).catch(function(e){
     document.title='DELETE bi chan'; }); }
   // Lượt bò nào cũng chạm GET này — dùng để chứng minh GET KHÔNG bị chặn oan.
   fetch('/api/truong?sort='+encodeURIComponent(${JSON.stringify(sort)}));
  </script>`);
}

function trangChiTiet(vaiTro, id) {
  const r = DU_LIEU_GOC.find((x) => String(x.id) === String(id));
  if (!r) return null;
  return CHROME(vaiTro, escHtml(r.ten), `
  <div role="tablist" aria-label="Thông tin trường">
    <button role="tab" aria-selected="true" aria-controls="t1" id="tab1">Thông tin chung</button>
    <button role="tab" aria-selected="false" aria-controls="t2" id="tab2">Hạ tầng</button>
    <button role="tab" aria-selected="false" aria-controls="t3" id="tab3">Đội ngũ</button>
  </div>
  <div role="tabpanel" id="t1" aria-labelledby="tab1">
    <table><tr><th>Mã</th><td>${r.ma}</td></tr><tr><th>Tên</th><td>${escHtml(r.ten)}</td></tr>
    <tr><th>Cấp</th><td>${r.cap}</td></tr><tr><th>Trạng thái</th><td>${r.trangThai}</td></tr></table>
  </div>
  <div role="tabpanel" id="t2" aria-labelledby="tab2" hidden><p>Số phòng học: 24</p></div>
  <div role="tabpanel" id="t3" aria-labelledby="tab3" hidden><p>Tổng giáo viên: 58</p></div>
  <details><summary>Lịch sử thay đổi (accordion)</summary><p>Chưa có bản ghi.</p></details>
  <p><a href="/lop?truongId=${r.id}">Xem lớp của trường này</a></p>
  <script>
   document.querySelectorAll('[role=tab]').forEach(function(t){ t.addEventListener('click',function(){
     document.querySelectorAll('[role=tab]').forEach(function(x){x.setAttribute('aria-selected','false')});
     document.querySelectorAll('[role=tabpanel]').forEach(function(p){p.hidden=true});
     t.setAttribute('aria-selected','true');
     document.getElementById(t.getAttribute('aria-controls')).hidden=false; }); });
  </script>`);
}

function trangLop(vaiTro, q) {
  const sortTho = q.get('sort') || 'ten';
  const hopLe = LOP_SORT_ENUM.includes(sortTho);
  const sort = hopLe ? sortTho : 'ten';
  const hang = [...LOP_GOC].sort((a, b) => String(a[sort]).localeCompare(String(b[sort])));
  return CHROME(vaiTro, 'Hồ sơ lớp', `
  <p style="font-size:12px;color:#5b7389">sort: <code>${escHtml(sort)}</code>
   ${hopLe ? '' : `— giá trị <code>${escHtml(sortTho)}</code> KHÔNG thuộc enum nên bị bỏ qua`}<br>
   Cột sort hợp lệ (enum cố định phía server): <code>${LOP_SORT_ENUM.join(', ')}</code></p>
  <table><thead><tr>${['ten', 'khoi', 'id'].map((c) => `<th><a href="/lop?sort=${c}">${c}</a></th>`).join('')}</tr></thead>
  <tbody>${hang.map((l) => `<tr><td>${l.ten}</td><td>${l.khoi}</td><td>${l.id}</td></tr>`).join('')}</tbody></table>`);
}

/*
 * TRANG RADCOMBOBOX — tái hiện ĐÚNG năm hành vi đã đo của Telerik trên hệ thật (v2.8.0 L0.5).
 *
 * Fixture này không "giả lập Telerik cho giống". Nó tái hiện năm chỗ mà code thật đã SAI rồi mới biết,
 * vì đó là thứ duy nhất đáng tái hiện — một fixture dễ hơn thực tế sẽ cho L0.5 xanh rồi vỡ trên UAT:
 *
 *   1. Ô ĐANG ĐÚNG giá trị thì click KHÔNG bung dropdown  → `cbCap` mặc định "Mầm non".
 *   2. Item nằm sẵn trong DOM nhưng ẨN cho tới khi mở     → mọi combobox.
 *   3. Ô KHOÁ: item vẫn trong DOM, dropdown không hiện    → `cbKhoa`.
 *   4. Vài combobox KHÔNG bọc `rcbSlide`                   → `cbTron` không có lớp bọc.
 *   5. Chọn ở combobox CHA làm combobox CON nạp lại       → `cbTinh` → `cbHuyen`.
 */
function trangTelerik(vaiTro) {
  const combo = (id, nhan, items, opt) => {
    const o = opt || {};
    const giaTri = o.giaTri || '';
    const khoa = !!o.khoa;
    const coSlide = o.coSlide !== false;
    const li = items.map((x) => `<li class="rcbItem">${x}</li>`).join('');
    const ds = `<div id="${id}_DropDown" class="rcbDropDown" style="display:none"><ul class="rcbList">${li}</ul></div>`;
    return `
    <div class="rcbWrap" data-combo="${id}">
      <label for="${id}_Input">${nhan}</label>
      <div id="${id}" class="RadComboBox${khoa ? ' rcbDisabled' : ''}">
        <input id="${id}_Input" class="rcbInput${khoa ? ' rcbDisabled' : ''}" value="${giaTri}" readonly
               data-khoa="${khoa ? '1' : '0'}" data-dangDung="${giaTri ? '1' : '0'}">
        <span id="${id}_Arrow" class="rcbArrow">▾</span>
      </div>
      ${coSlide ? `<div class="rcbSlide" style="display:none">${ds}</div>` : ds}
    </div>`;
  };

  const JS = `
  <script>
  /* Mở/đóng dropdown. KHÔNG mở nếu ô khoá (hành vi 3), và KHÔNG mở nếu click vào ô đang đúng giá trị
   * đã chọn sẵn (hành vi 1) — đúng như Telerik thật. */
  function moDong(id) {
    var inp = document.getElementById(id + '_Input');
    if (inp.dataset.khoa === '1') return;                    // hành vi 3
    if (inp.dataset.dangDung === '1') return;                // hành vi 1
    var dd = document.getElementById(id + '_DropDown');
    var slide = dd.parentElement.classList.contains('rcbSlide') ? dd.parentElement : null;
    var hien = dd.style.display !== 'none';
    dd.style.display = hien ? 'none' : 'block';              // hành vi 2: item luôn trong DOM
    if (slide) slide.style.display = hien ? 'none' : 'block';
  }
  function chon(id, li) {
    var inp = document.getElementById(id + '_Input');
    inp.value = li.textContent;
    document.getElementById(id + '_DropDown').style.display = 'none';
    var dd = document.getElementById(id + '_DropDown');
    if (dd.parentElement.classList.contains('rcbSlide')) dd.parentElement.style.display = 'none';
    /* Hành vi 5: chọn ở cbTinh thì cbHuyen nạp lại sau một nhịp, và trong nhịp đó nó RỖNG. */
    if (id === 'cbTinh') {
      var con = document.getElementById('cbHuyen_Input');
      var dsCon = document.getElementById('cbHuyen_DropDown').querySelector('ul');
      con.value = '';
      dsCon.innerHTML = '';
      setTimeout(function () {
        var ds = inp.value === 'Phú Thọ' ? ['Phường Âu Cơ', 'Phường Hùng Vương'] : ['Quận 1', 'Quận 3'];
        dsCon.innerHTML = ds.map(function (x) { return '<li class="rcbItem">' + x + '</li>'; }).join('');
        gan();
      }, 400);
    }
  }
  function gan() {
    document.querySelectorAll('.rcbWrap').forEach(function (w) {
      var id = w.dataset.combo;
      var inp = document.getElementById(id + '_Input');
      var arrow = document.getElementById(id + '_Arrow');
      inp.onclick = function () { moDong(id); };
      arrow.onclick = function () { moDong(id); };
      document.getElementById(id + '_DropDown').querySelectorAll('li.rcbItem').forEach(function (li) {
        li.onclick = function () { chon(id, li); };
      });
    });
  }
  gan();
  </script>`;

  return CHROME(vaiTro, 'Combobox Telerik', [
    '<h2>Combobox dạng Telerik</h2>',
    combo('cbCap', 'Cấp học', ['Mầm non', 'Tiểu học', 'THCS', 'THPT', 'GDTX'], { giaTri: 'Mầm non' }),
    combo('cbTinh', 'Tỉnh/Thành', ['Phú Thọ', 'Hồ Chí Minh']),
    combo('cbHuyen', 'Quận/Huyện', []),
    combo('cbKhoa', 'Loại hình (chỉ xem)', ['Công lập', 'Tư thục'], { giaTri: 'Công lập', khoa: true }),
    combo('cbTron', 'Năm học (không rcbSlide)', ['2025-2026', '2026-2027'], { coSlide: false }),
    JS,
  ].join('\n'));
}

/*
 * Trang HỒ SƠ kiểu ASP.NET WebForms — để đo L1 (mô hình màn) + L0.5 textbox/checkbox + L2 form hoàn
 * toàn OFFLINE. Ba đặc điểm dưới đây là thứ làm nó giống app thật, và mỗi cái là một bài học đã trả giá:
 *
 *   · `name` dạng `ctl00$ContentPlaceHolder1$tbTen` — có `$`, nên `#id` không dùng được và phải định vị
 *     bằng `[name$="tbTen"]`. Đúng cách L1 làm.
 *   · ô `tbMa` có `maxlength=10` và CẮT ÂM THẦM: `fill` không báo gì, giá trị chỉ còn 10 ký tự.
 *   · `tbKhoa` là `readonly`, `tbThue` là `disabled` — hai kiểu khoá KHÁC nhau, và L0.5 phải phân biệt
 *     `khong-tuong-tac-duoc` với `tuong-tac-duoc-nhung-khong-doi-duoc`.
 */
function trangHoSo(vaiTro) {
  const pre = 'ctl00$ContentPlaceHolder1$';
  const o = (id, nhan, opt) => {
    const v = opt || {};
    const attr = [
      `name="${pre}${id}"`, `id="${id}"`, 'type="text"',
      `value="${v.giaTri === undefined ? '' : v.giaTri}"`,
      v.maxlength ? `maxlength="${v.maxlength}"` : '',
      v.readonly ? 'readonly' : '',
      v.disabled ? 'disabled' : '',
    ].filter(Boolean).join(' ');
    return `<div class="row"><label for="${id}">${nhan}</label><input ${attr}></div>`;
  };
  const cb = (id, nhan, opt) => {
    const v = opt || {};
    return `<div class="row"><label for="${id}">${nhan}</label>`
      + `<input name="${pre}${id}" id="${id}" type="checkbox" ${v.tich ? 'checked' : ''}></div>`;
  };
  const ta = (id, nhan) => `<div class="row"><label for="${id}">${nhan}</label>`
    + `<textarea name="${pre}${id}" id="${id}"></textarea></div>`;

  return CHROME(vaiTro, 'Hồ sơ trường', [
    '<h2>1.1 Hồ sơ trường</h2>',
    '<form id="aspnetForm" method="POST">',
    o('tbTen', 'Tên trường', { giaTri: 'Truong THCS Fixture' }),
    o('tbMa', 'Mã định danh', { giaTri: '', maxlength: 10 }),
    o('tbDienTich', 'Diện tích đất', { giaTri: '1000' }),
    o('tbKhoa', 'Loại hình', { giaTri: 'Công lập', readonly: true }),
    o('tbThue', 'Mã số thuế', { giaTri: '0101234567', disabled: true }),
    /*
     * Ô NHẬN ĐƯỢC CHỮ RỒI TRẢ LẠI GIÁ TRỊ CŨ KHI RỜI Ô.
     *
     * Đây là trạng thái thứ ba của `ghiDuoc()` — `tuong-tac-duoc-nhung-khong-doi-duoc` — và nó KHÁC hẳn
     * ô khoá: người dùng gõ được, nhìn thấy chữ mình gõ, rồi mất. Không có ô kiểu này trong fixture thì
     * một trong ba trạng thái của hàm đó chưa bao giờ được thử, và một nhánh chưa thử là một nhánh có
     * thể sai mà suite vẫn xanh. Mẫu thật: field bị JS/postback của WebForms nắn lại.
     */
    o('tbTuHoan', 'Khoảng cách (tự hoàn nguyên)', { giaTri: '3' }),
    cb('ckInternet', 'Có Internet', { tich: false }),
    cb('ckDien', 'Có điện (lưới)', { tich: true }),
    ta('txGhiChu', 'Ghi chú'),
    '<table id="grid"><thead><tr><th><input type="checkbox" id="ckAll" name="ckAll"></th><th>Tên</th></tr></thead>',
    '<tbody><tr><td><input type="checkbox" name="ckRow1"></td><td>Dòng 1</td></tr></tbody></table>',
    '<input type="submit" value="Cập nhật">',
    '<input type="button" value="Huỷ">',
    '</form>',
    /* JS nắn `tbTuHoan` về giá trị cũ khi rời ô — xem ghi chú ở chỗ khai ô đó. */
    '<script>(function(){var e=document.getElementById("tbTuHoan");var cu=e.value;'
      + 'e.addEventListener("blur",function(){e.value=cu;});})();</script>',
  ].join('\n'));
}

function trangThemTruong(vaiTro) {
  /* Đủ 18 loại field của `.agent/config/ui_components.json`, để spec dấu vân tay đếm được. */
  return CHROME(vaiTro, 'Thêm trường', `
  <form id="f" method="POST" action="/api/truong">
    <label for="ten">Tên trường <span style="color:#c00">*</span></label>
    <input id="ten" name="ten" type="text" required maxlength="120" minlength="3" placeholder="nguyên văn tên trường">
    <label for="email">Email liên hệ</label><input id="email" name="email" type="email" maxlength="80">
    <label for="sdt">Điện thoại</label><input id="sdt" name="sdt" type="tel" pattern="0[0-9]{9}" maxlength="10">
    <label for="mk">Mật khẩu quản trị</label><input id="mk" name="mk" type="password" minlength="8">
    <label for="siso">Sĩ số</label><input id="siso" name="siso" type="number" min="0" max="5000" value="0">
    <label for="cap">Cấp học</label><select id="cap" name="cap"><option>MN</option><option>TH</option><option>THCS</option><option>THPT</option><option>GDTX</option></select>
    <label><input type="checkbox" name="cong_lap" checked> Trường công lập</label>
    <label><input type="radio" name="vung" value="dong_bang" checked> Đồng bằng</label>
    <label><input type="radio" name="vung" value="mien_nui"> Miền núi</label>
    <label for="ngay_tl">Ngày thành lập</label><input id="ngay_tl" name="ngay_tl" type="date">
    <label for="thang">Tháng báo cáo</label><input id="thang" name="thang" type="month">
    <label for="gio">Giờ làm việc</label><input id="gio" name="gio" type="time">
    <label for="tu">Khoảng ngày — từ</label><input id="tu" name="tu" type="date">
    <label for="den">Khoảng ngày — đến</label><input id="den" name="den" type="date">
    <label for="ghichu">Ghi chú</label><textarea id="ghichu" name="ghichu" maxlength="500" rows="3"></textarea>
    <label for="tep">Tệp quyết định</label><input id="tep" name="tep" type="file" accept=".pdf,.xlsx">
    <label for="otp">Mã OTP</label><input id="otp" name="otp" type="text" inputmode="numeric" maxlength="6" pattern="[0-9]{6}">
    <label for="mota">Mô tả (rich text)</label><div id="mota" contenteditable="true" role="textbox" aria-multiline="true" style="border:1px solid #d3dce6;min-height:48px;padding:6px"></div>
    <label for="mon">Môn học (chọn nhiều)</label><select id="mon" name="mon" multiple size="3"><option>Toán</option><option>Văn</option><option>Anh</option></select>
    <label for="muc">Mức đánh giá</label><input id="muc" name="muc" type="range" min="1" max="5" value="3">
    <label for="tong">Tổng chỉ tiêu (tự tính)</label><input id="tong" name="tong" type="text" readonly value="0">
    <button class="nut" type="submit">Lưu</button>
    <button class="nut" type="button" onclick="document.getElementById('d').showModal()">Xoá bản nháp</button>
    <button class="nut" type="button" onclick="guiApi()">Ghi lại qua API</button>
  </form>
  <dialog id="d"><p>Xoá bản nháp?</p><button class="nut nguyhiem" onclick="document.getElementById('d').close()">Đồng ý</button>
   <button class="nut" onclick="document.getElementById('d').close()">Quay lại</button></dialog>
  <script>
   // Đường GHI thứ hai: fetch POST.  Đường thứ ba: submit form POST (nút "Lưu").
   function guiApi(){ fetch('/api/truong',{method:'POST',headers:{'content-type':'application/json'},
     body:JSON.stringify({ten:document.getElementById('ten').value||'qua-api'})})
     .then(function(){document.title='POST da ghi'}).catch(function(){document.title='POST bi chan'}); }
  </script>`);
}

function trangBaoCao(vaiTro, q) {
  /* Màn này KHÔNG có trong `fsd.md` ⇒ phải ra ô `undocumented_present`. */
  const tu = q.get('tu') || '';
  const loc = q.get('loc') || '';
  return CHROME(vaiTro, 'Báo cáo tổng hợp', `
  <form method="GET" action="/bao-cao">
    <label for="tu">Từ ngày</label><input id="tu" name="tu" type="date" value="${escHtml(tu)}">
    <label for="loc">Lọc tên trường (dùng lại giá trị đã lưu ở màn Thêm trường)</label>
    <input id="loc" name="loc" value="${escHtml(loc)}">
    <button class="nut" type="submit">Kết xuất</button>
  </form>
  <table><thead><tr><th>Tên trường</th><th>Sĩ số</th></tr></thead>
  <tbody>${DU_LIEU_GOC.filter((r) => !loc || r.ten.includes(loc)).map((r) => `<tr><td>${escHtml(r.ten)}</td><td>${r.siSo}</td></tr>`).join('')}</tbody></table>
  <script>
   // Endpoint này KHÔNG có trong openapi.json — để test đối chiếu hai chiều.
   fetch('/api/loi-sql?q=' + encodeURIComponent(${JSON.stringify(loc)}));
  </script>`);
}

function trangAdmin(vaiTro) {
  /* Route quản trị: với vai trò `nhanvien` nó KHÔNG xuất hiện ở menu, nhưng server VẪN trả 200. */
  return CHROME(vaiTro, 'Cấu hình hệ thống', `
  <p>Đây là màn quản trị. Vai trò hiện tại: <b>${vaiTro}</b>.</p>
  <p style="color:#a0522d">Server KHÔNG kiểm quyền ở route này — vai trò <code>nhanvien</code> vào thẳng URL
   vẫn thấy nội dung. Đó là chỗ <code>roles.js</code> phải sinh ra một EXPANSION_FINDING.</p>
  <button class="nut nguyhiem">Xoá toàn bộ cấu hình</button>`);
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Dựng server. Trả `{ url, store, close, reset }`.
 *
 * `store` là trạng thái SỐNG — spec so nó trước/sau lượt bò để khẳng định fixture không đổi. Không tin
 * vào số request bị chặn: số đó chứng minh tường lửa có chạy, còn `store` chứng minh nó có TÁC DỤNG.
 */
function start() {
  const store = { truong: DU_LIEU_GOC.map((r) => ({ ...r })), soLanGhi: 0, nhatKyGhi: [] };

  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost');
    const p = u.pathname;
    const q = u.searchParams;
    const vaiTro = /(?:^|;\s*)role=admin(?:;|$)/.test(req.headers.cookie || '') ? 'admin' : 'nhanvien';
    const html = (body, code = 200) => { res.writeHead(code, { 'content-type': 'text/html; charset=utf-8' }); res.end(body); };
    const json = (o, code = 200) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };

    // ---- đăng nhập: POST, và là ngoại lệ DUY NHẤT của tường lửa ----
    if (p === '/login' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        const role = /role=admin/.test(body) ? 'admin' : 'nhanvien';
        res.writeHead(302, { 'set-cookie': `role=${role}; Path=/`, location: '/' });
        res.end();
      });
    }

    // ---- API ghi: POST / DELETE / PUT. Tường lửa phải không cho tới được đây ----
    if (p === '/api/truong' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        let o = {};
        try { o = JSON.parse(body || '{}'); } catch (e) { o = { ten: '(không parse được)' }; }
        const id = Math.max(0, ...store.truong.map((r) => r.id)) + 1;
        store.truong.push({ id, ma: `NEW-${id}`, ten: String(o.ten || 'không tên'), cap: 'THCS', trangThai: 'dang_hoat_dong', siSo: 0 });
        store.soLanGhi += 1;
        store.nhatKyGhi.push({ method: 'POST', path: p, luc: Date.now() });
        json({ ok: true, id }, 201);
      });
    }
    const mDel = p.match(/^\/api\/truong\/(\d+)$/);
    if (mDel && (req.method === 'DELETE' || req.method === 'PUT')) {
      store.truong = store.truong.filter((r) => String(r.id) !== mDel[1]);
      store.soLanGhi += 1;
      store.nhatKyGhi.push({ method: req.method, path: p, luc: Date.now() });
      return json({ ok: true });
    }

    // ---- API đọc ----
    if (p === '/api/truong' && req.method === 'GET') {
      return json({ sort_nhan_duoc: q.get('sort') || null, items: store.truong, enum_trangThai: ['dang_hoat_dong', 'tam_dung', 'giai_the'] });
    }
    const mGet = p.match(/^\/api\/truong\/(\d+)$/);
    if (mGet && req.method === 'GET') {
      const r = store.truong.find((x) => String(x.id) === mGet[1]);
      return r ? json(r) : json({ loi: 'không thấy' }, 404);
    }
    if (p === '/api/lop' && req.method === 'GET') {
      const s = q.get('sort') || 'ten';
      if (!LOP_SORT_ENUM.includes(s)) return json({ loi: 'sort không thuộc enum cho phép', cho_phep: LOP_SORT_ENUM }, 400);
      return json({ items: LOP_GOC, sort: s });
    }
    if (p === '/api/loi-sql' && req.method === 'GET') {
      /*
       * MOCK TĨNH — không có DB, không câu lệnh nào chạy. Thấy dấu nháy thì trả về NGUYÊN VĂN một thông
       * báo kiểu SQL Server, đúng loại chuỗi mà `discovery.json §dau_hieu_loi_sql` phải nhận ra. Mục
       * đích duy nhất: kiểm oracle A9.3 có bắt được dấu hiệu lỗi hay không.
       */
      const s = q.get('q') || '';
      if (s.includes("'")) {
        return json({ loi: "Unclosed quotation mark after the character string ''. Incorrect syntax near 'DM_TRUONG'." }, 500);
      }
      return json({ ok: true, q: s });
    }

    // ---- trang HTML ----
    if (p === '/') return html(trangTongQuan(vaiTro));
    if (p === '/truong') return html(trangTruong(vaiTro, q));
    const mCt = p.match(/^\/truong\/(\d+)$/);
    if (mCt) { const t = trangChiTiet(vaiTro, mCt[1]); return t ? html(t) : html('<h1>404</h1>', 404); }
    if (p === '/lop') return html(trangLop(vaiTro, q));
    if (p === '/them-truong') return html(trangThemTruong(vaiTro));
    if (p === '/telerik') return html(trangTelerik(vaiTro));
    if (p === '/ho-so') return html(trangHoSo(vaiTro));
    if (p === '/bao-cao') return html(trangBaoCao(vaiTro, q));
    if (p === '/admin') return html(trangAdmin(vaiTro));   // KHÔNG kiểm quyền — cố ý
    /*
     * Trang CHẬM có chủ đích, dùng để đo TRẦN MỖI TRANG.
     *
     * Chặn SAU khi tải xong, và chặn LẶP LẠI. Hai bản trước đều hỏng theo một kiểu khác nhau:
     *   · chặn TRONG lúc tải ⇒ `page.goto` tự nó chờ hết rồi mới trả về, nên tới lúc dấu vân tay chạy thì
     *     luồng đã rảnh và trần mỗi trang không bao giờ bắn;
     *   · chặn MỘT lần sau 50ms ⇒ xanh khi chạy riêng, Đỏ khi chạy cả suite: máy bận thì `goto` trả về muộn
     *     hơn 50ms ấy và cục chặn đã trôi qua. Một test chỉ xanh khi máy rảnh là một test flaky.
     * Chặn lặp (300ms mỗi 60ms, trong `ms` mili giây) thì phép đo trúng block bất kể nó chạy lúc nào.
     *
     * Link tới trang này KHÔNG đặt trong menu: chỉ test gọi thẳng.
     */
    /*
     * `/Logout.aspx` HUY session roi day ve man dang nhap co captcha. Dung dung hinh dang cua QEMIS:
     * Dang xuat la mot the <a> trong menu, nen crawler di theo link se tu giet phien cua chinh no.
     */
    if (p === '/Logout.aspx') {
      res.writeHead(302, { 'set-cookie': 'role=; Path=/; Max-Age=0', location: '/Login.aspx' });
      return res.end();
    }
    if (p === '/Login.aspx') {
      return html('<!doctype html><html><body><h1>Dang nhap</h1>'
        + '<img id="captchaImage" alt="captcha" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'
        + '</body></html>');
    }
    /*
     * `/trang-cham`: trang làm cho một lượt xử lý VƯỢT trần mỗi trang, để kiểm chính cái trần đó.
     *
     * Trang này trả `khoi=N` khối mở được. Bên test điều khiển độ chậm bằng `doTre`, vì `moCacKhoi` chờ
     * `doTre` sau MỖI khối: `N × doTre` là thời gian xử lý, tất định, do `page.waitForTimeout` của
     * Playwright đếm.
     *
     * HAI CÁCH LÀM CHẬM TRƯỚC ĐÓ ĐỀU SAI, và cả hai đều xanh khi chạy một mình:
     *
     *   1. `setInterval` 60ms, mỗi nhịp chiếm luồng 300ms, trong 4 giây. Khối chặn neo vào đồng hồ
     *      tường TỪ LÚC TẢI TRANG, còn trần mỗi trang chỉ bấm giờ SAU `page.goto`.
     *   2. Vẫn `setInterval` nhưng chặn KHÔNG giới hạn, để bỏ cái lệch đồng hồ ở trên.
     *
     * Cách 2 vẫn đỏ, và đo ra lý do: `screens=["/trang-cham"]`, tức trang XỬ LÝ XONG trong dưới 1 giây
     * dù JS "đang bị chặn". Chromium HÃM `setInterval` ở trang đang ẩn, mà chạy 8 file spec song song
     * thì trang nào cũng ẩn. Nhịp giãn ra, luồng rảnh phần lớn thời gian, `page.evaluate` chen vào được.
     *
     * Bài học ghi lại ở đây để không ai thử lại: TIMER TRONG TRANG KHÔNG PHẢI ĐÒN BẨY ĐO ĐƯỢC. Trình
     * duyệt được phép hãm nó, và nó hãm đúng lúc chạy song song. Muốn một lượt xử lý chậm có kiểm soát
     * thì chậm ở phía điều khiển, đừng chậm ở phía trang.
     *
     * Trang này KHÔNG nằm trong menu, nên chỉ tới được khi khai thẳng làm `baseUrl`.
     */
    if (p === '/trang-cham') {
      const soKhoi = Math.max(1, Math.min(12, Number(q.get('khoi') || 3)));
      let than = '<p>Trang nay co nhieu khoi mo ra duoc.</p>';
      for (let i = 1; i <= soKhoi; i += 1) {
        than += '<details><summary>Xem them muc ' + i + '</summary><p>Noi dung muc ' + i + '.</p></details>';
      }
      return html(CHROME(vaiTro, 'Trang cham', than));
    }
    /*
     * `/bao-cao-emis`: menu KHOÁ mục này (aria-disabled) nhưng server VẪN trả 200. Đây là lỗ thứ hai,
     * khác đường vào với `/admin`: ở `/admin` việc chặn nằm ở chỗ ẩn menu, ở đây nằm ở chỗ khoá nút. Cả
     * hai đều là client-only, và `roles.js` phải bắt được cả hai.
     */
    if (p === '/bao-cao-emis') {
      return html(CHROME(vaiTro, 'Bao cao EMIS', '<p>Man nay le ra chua mo. Menu khoa muc nay, nhung server khong chan.</p>'));
    }

    // ---- tệp tĩnh cạnh file này (openapi.json, fsd.md) ----
    const tep = path.join(__dirname, p.replace(/^\/+/, ''));
    if (tep.startsWith(__dirname) && fs.existsSync(tep) && fs.statSync(tep).isFile()) {
      const ext = path.extname(tep);
      res.writeHead(200, { 'content-type': ext === '.json' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8' });
      return res.end(fs.readFileSync(tep));
    }
    return html('<h1>404</h1>', 404);
  });

  return new Promise((resolve) => {
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        store,
        reset() { store.truong = DU_LIEU_GOC.map((r) => ({ ...r })); store.soLanGhi = 0; store.nhatKyGhi = []; },
        close: () => new Promise((r) => srv.close(r)),
      });
    });
  });
}

module.exports = { start, DU_LIEU_GOC, LOP_GOC, LOP_SORT_ENUM };
