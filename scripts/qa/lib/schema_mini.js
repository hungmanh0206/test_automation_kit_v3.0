'use strict';
/*
 * schema_mini — BỘ KIỂM JSON SCHEMA, BỘ CON draft-07.
 *
 * VÌ SAO TỰ VIẾT. `ajv` có trong `node_modules` nhưng là phụ thuộc GIÁN TIẾP (theo `eslint`), không có
 * trong `dependencies` cũng không trong `devDependencies`. Dựa vào nó thì một lần nâng `eslint` là gate
 * này chết với `MODULE_NOT_FOUND`, và §0 của đợt này cấm thêm phụ thuộc nặng.
 *
 * LUẬT QUAN TRỌNG NHẤT CỦA FILE NÀY: **từ khoá không hiểu thì NÉM LỖI, không bỏ qua.**
 *
 * Một bộ kiểm schema bỏ qua từ khoá lạ là thứ nguy hiểm hơn không có bộ kiểm nào: hôm nay schema chỉ dùng
 * `type`/`required`, mai ai đó thêm `oneOf` để tách hai dạng mục, bộ kiểm im lặng không kiểm nhánh đó, và
 * gate vẫn in dấu ✓. Đợt này đã trả giá đúng chuyện đó một lần: `canonical_check.js` đọc `kqDrift.lech` —
 * một khoá KHÔNG TỒN TẠI — nên `soLech` luôn bằng 0 và cửa luôn mở. Chỉ phép đối chứng ÂM tìm ra.
 *
 * Từ khoá được hỗ trợ: $schema · title · type · required · properties · additionalProperties · items ·
 * enum · pattern · minLength · maxLength · minItems · maxItems · minimum · maximum · definitions · $ref
 * (chỉ dạng `#/definitions/<ten>`). Mọi khoá bắt đầu bằng `_` là ghi chú của repo này, được bỏ qua CÓ Ý.
 */

/** Khoá được hỗ trợ. Ngoài danh sách này (và `_*`) ⇒ ném lỗi. */
const HIEU = new Set([
  '$schema', '$id', 'title', 'description', 'type', 'required', 'properties', 'additionalProperties',
  'items', 'enum', 'pattern', 'minLength', 'maxLength', 'minItems', 'maxItems', 'minimum', 'maximum',
  'definitions', '$ref',
]);

class SchemaMiniError extends Error {
  constructor(msg) { super(msg); this.name = 'SchemaMiniError'; }
}

function kieuCuaGiaTri(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
}

function khopKieu(v, t) {
  const k = kieuCuaGiaTri(v);
  if (t === 'number') return k === 'number' || k === 'integer';
  if (t === 'integer') return k === 'integer';
  return k === t;
}

/** Duyệt schema trước khi dùng, để từ khoá lạ nổ NGAY thay vì lúc kiểm dữ liệu. */
function soatSchema(s, duong = '#') {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return;
  for (const k of Object.keys(s)) {
    if (k.startsWith('_')) continue;
    if (!HIEU.has(k)) {
      throw new SchemaMiniError(
        `schema_mini KHÔNG HIỂU từ khoá \`${k}\` ở ${duong}. Bộ kiểm này là BỘ CON draft-07 và nó ném lỗi `
        + 'thay vì bỏ qua: một bộ kiểm im lặng bỏ qua nhánh schema sẽ in dấu ✓ trên thứ nó chưa hề kiểm. '
        + `Hỗ trợ từ khoá đó (sửa ${__filename}) hoặc viết schema trong phạm vi bộ con.`,
      );
    }
  }
  if (s.properties) for (const [k, v] of Object.entries(s.properties)) soatSchema(v, `${duong}/properties/${k}`);
  if (s.definitions) for (const [k, v] of Object.entries(s.definitions)) soatSchema(v, `${duong}/definitions/${k}`);
  if (s.items) soatSchema(s.items, `${duong}/items`);
  if (s.additionalProperties && typeof s.additionalProperties === 'object') {
    soatSchema(s.additionalProperties, `${duong}/additionalProperties`);
  }
}

function go(s, goc, duong) {
  if (!s || typeof s !== 'object') return s;
  if (!s.$ref) return s;
  const m = /^#\/definitions\/([A-Za-z0-9_-]+)$/.exec(s.$ref);
  if (!m) throw new SchemaMiniError(`\`$ref\` chỉ hỗ trợ dạng \`#/definitions/<ten>\`, gặp \`${s.$ref}\` ở ${duong}.`);
  const d = (goc.definitions || {})[m[1]];
  if (!d) throw new SchemaMiniError(`\`$ref\` trỏ tới \`${s.$ref}\` không có trong \`definitions\` (${duong}).`);
  return d;
}

function kiemNut(giaTri, schemaThô, goc, duong, loi) {
  const s = go(schemaThô, goc, duong);
  if (!s || typeof s !== 'object') return;

  if (s.type) {
    const ts = Array.isArray(s.type) ? s.type : [s.type];
    if (!ts.some((t) => khopKieu(giaTri, t))) {
      loi.push(`${duong}: cần kiểu ${ts.join('|')}, gặp ${kieuCuaGiaTri(giaTri)}`);
      return; /* Sai kiểu rồi thì mọi phép kiểm sau vô nghĩa và chỉ sinh thêm tiếng ồn. */
    }
  }

  if (s.enum && !s.enum.includes(giaTri)) {
    loi.push(`${duong}: phải là một trong ${JSON.stringify(s.enum)}, gặp ${JSON.stringify(giaTri)}`);
  }

  if (typeof giaTri === 'string') {
    if (s.minLength != null && giaTri.length < s.minLength) loi.push(`${duong}: dài ${giaTri.length}, cần ≥ ${s.minLength}`);
    if (s.maxLength != null && giaTri.length > s.maxLength) loi.push(`${duong}: dài ${giaTri.length}, cần ≤ ${s.maxLength}`);
    if (s.pattern && !new RegExp(s.pattern).test(giaTri)) {
      loi.push(`${duong}: ${JSON.stringify(giaTri)} không khớp mẫu \`${s.pattern}\``);
    }
  }

  /* `minimum`/`maximum` chỉ áp cho số. `null` đã lọt qua `type: ["number","null"]` thì không so tiếp. */
  if (typeof giaTri === 'number') {
    if (s.minimum != null && giaTri < s.minimum) loi.push(`${duong}: ${giaTri} < tối thiểu ${s.minimum}`);
    if (s.maximum != null && giaTri > s.maximum) loi.push(`${duong}: ${giaTri} > tối đa ${s.maximum}`);
  }

  if (Array.isArray(giaTri)) {
    if (s.minItems != null && giaTri.length < s.minItems) loi.push(`${duong}: ${giaTri.length} phần tử, cần ≥ ${s.minItems}`);
    if (s.maxItems != null && giaTri.length > s.maxItems) loi.push(`${duong}: ${giaTri.length} phần tử, cần ≤ ${s.maxItems}`);
    if (s.items) giaTri.forEach((x, i) => kiemNut(x, s.items, goc, `${duong}[${i}]`, loi));
  }

  if (giaTri && typeof giaTri === 'object' && !Array.isArray(giaTri)) {
    for (const k of s.required || []) {
      if (!(k in giaTri)) loi.push(`${duong}: thiếu khoá bắt buộc \`${k}\``);
    }
    const props = s.properties || {};
    for (const [k, v] of Object.entries(giaTri)) {
      if (k.startsWith('_')) continue; /* ghi chú `_y`, `_vi_sao_*` của repo này */
      if (props[k]) { kiemNut(v, props[k], goc, `${duong}/${k}`, loi); continue; }
      if (s.additionalProperties === false) { loi.push(`${duong}: khoá lạ \`${k}\``); continue; }
      if (s.additionalProperties && typeof s.additionalProperties === 'object') {
        kiemNut(v, s.additionalProperties, goc, `${duong}/${k}`, loi);
      }
    }
  }
}

/**
 * Kiểm `duLieu` theo `schema`. Trả `{ hop_le, loi: string[] }`.
 *
 * Ném `SchemaMiniError` khi SCHEMA có từ khoá không hiểu — đó là lỗi của người viết schema, không phải
 * lỗi dữ liệu, nên nó không được trộn vào danh sách `loi`.
 */
function kiem(duLieu, schema) {
  soatSchema(schema);
  const loi = [];
  kiemNut(duLieu, schema, schema, '#', loi);
  return { hop_le: loi.length === 0, loi };
}

module.exports = { kiem, soatSchema, SchemaMiniError, HIEU };
