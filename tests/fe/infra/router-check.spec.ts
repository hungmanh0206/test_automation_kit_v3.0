/*
 * @infra `router:check` — bảng định tuyến phải PHỦ mọi điểm vào, và mỗi dòng phải nói RANH GIỚI (v2.9.5 §4).
 *
 * Đo 29/10/2026: kit có 13 lệnh `/`, 16 workflow, 3 subagent, và ba chỗ đã liệt kê chúng
 * (`docs/CHEATSHEET.md`, `docs/kit-map.md`, `.agent/skills/INDEX.md`) — nhưng KHÔNG chỗ nào ghi
 * "KHÔNG dùng khi". Danh sách không ranh giới trả lời được "kit có lệnh gì", không trả lời được
 * "lệnh nào SAI cho việc này".
 *
 * Phép kiểm nặng nhất ở file này là ca TRÙNG TÊN: một tên tồn tại vừa là lệnh vừa là workflow. Bản
 * đầu của gate khoá bảng bằng TÊN TRẦN, nên một dòng che được hai điểm vào — 31 dòng phủ 32 điểm vào
 * mà cửa vẫn xanh. Đó là kiểu hỏng riêng của cửa-phủ: nó đếm KHỚP, không đếm PHỦ.
 *
 * VA CHẠM THẬT ĐÃ HẾT, 10/11/2026 — và ca này suýt thành phép đo rỗng. Lúc ấy va chạm là `/rerun`
 * (lệnh) ↔ `rerun.md` (workflow). Đánh số lại đổi lệnh thành `/6_phase4` và workflow thành
 * `13_tong_quan_rerun`, nên trong cây hiện tại KHÔNG còn tên nào trùng. Ca cũ vẫn "xanh" được, nhưng
 * nó sẽ chỉ còn đo "xoá một dòng thì chặn" — đúng y ca ở trên, và không còn đo điều nó sinh ra để đo.
 * Nên nó dựng va chạm trên CÂY TẠM. Giữ phép đo thì phải giữ ĐỐI TƯỢNG của phép đo, không giữ cái tên.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/router_check.js');
const BANG = path.join(REPO, '.agent/skills/phase2/qa_automation_engineer/references/router.md');

const chay = (argv: string[] = []) => {
  const r = spawnSync(process.execPath, [GATE, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

/** Ghi một bản bảng đã sửa ra file tạm — KHÔNG sửa bảng thật (spec khác đọc cùng file, chạy song song). */
function bangTam(bien: (s: string) => string) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'router-'));
  const f = path.join(d, 'router.md');
  fs.writeFileSync(f, bien(fs.readFileSync(BANG, 'utf8')), 'utf8');
  return { d, f };
}

test.describe('@infra router:check', () => {
  test('bảng thật phủ ĐỦ mọi điểm vào, và mỗi dòng có ranh giới', () => {
    /*
     * ĐẾM TỪ CÂY, KHÔNG GHIM SỐ (10/11/2026).
     *
     * Bản đầu ghim `32 điểm vào · lệnh /: 13`. Thêm `/2_phase1` lúc đánh số lại bốn phase là ca này đỏ
     * — không phải vì bảng sai, mà vì CON SỐ TRONG SPEC đã cũ. Một phép kiểm ghim số đếm thì mỗi lần
     * kit lớn lên nó lại đỏ oan, và cách sửa nhanh nhất của người gặp nó là **nâng con số**, tức phép
     * kiểm tự biến thành thủ tục.
     *
     * Đếm số file lệnh trên đĩa rồi đòi bảng khớp: hết ghim, và vẫn gác đúng điều cần gác.
     */
    const soLenh = fs.readdirSync(path.join(REPO, '.claude/commands')).filter((f) => f.endsWith('.md')).length;
    const r = chay();
    expect(r.code, r.out).toBe(0);
    expect(r.out, `đĩa có ${soLenh} file lệnh — bảng phải khai đúng chừng ấy`)
      .toMatch(new RegExp(`lệnh \`/\`: ${soLenh}`));
    expect(r.out).toMatch(/workflow: \d+/);
    expect(r.out).toMatch(/subagent: \d+/);
    /* Số DÒNG phải bằng số ĐIỂM VÀO — chỗ đã lộ ra lỗi khoá-theo-tên-trần. */
    const m = r.out.match(/(\d+) dòng · (\d+) điểm vào/);
    expect(m, 'cửa không in được cặp "N dòng · N điểm vào" ⇒ ca này mất nguồn').not.toBeNull();
    expect(Number(m![1]), 'bảng thiếu dòng cho một điểm vào').toBe(Number(m![2]));
  });

  test('ĐỐI CHỨNG DƯƠNG: bỏ một dòng ⇒ CHẶN, và nói đúng tên điểm vào', () => {
    const t = bangTam((s) => s.split(/\r?\n/).filter((l) => !l.startsWith('| `/ui-debug`')).join('\n'));
    const r = chay(['--bang', t.f]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('ui-debug');
    expect(r.out).toContain('KHÔNG có dòng');
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG — TRÙNG TÊN: xoá dòng workflow mà dòng lệnh còn ⇒ vẫn phải CHẶN', () => {
    /*
     * ĐÂY là phép kiểm đáng giá nhất của file. Một tên tồn tại ở HAI loại điểm vào. Nếu gate khoá
     * bằng tên trần thì xoá dòng workflow vẫn xanh, vì dòng lệnh "đã khớp".
     *
     * Cây thật không còn tên nào trùng, nên dựng cây tạm: `trung` vừa là lệnh vừa là workflow.
     */
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'router-trung-'));
    const dat = (p: string, s = '# x\n') => {
      fs.mkdirSync(path.join(d, path.dirname(p)), { recursive: true });
      fs.writeFileSync(path.join(d, p), s, 'utf8');
    };
    dat('.claude/commands/trung.md');
    dat('.agent/workflows/trung.md');
    dat('.claude/agents/mot-agent.md');

    const o = ' Một ô ranh giới đủ dài để qua sàn hai mươi lăm ký tự. ';
    const dongLenh = `| \`/trung\` | ${o} |${o}|`;
    const dongWf = `| \`trung\` | ${o} |${o}|`;
    const dongAg = `| \`mot-agent\` | ${o} |${o}|`;
    const bang = (coDongWf: boolean) => [
      '<!-- router:command -->', '', '| Lệnh | Dùng khi | KHÔNG dùng khi |', '|---|---|---|', dongLenh, '',
      '<!-- router:workflow -->', '', '| Workflow | Dùng khi | KHÔNG dùng khi |', '|---|---|---|',
      ...(coDongWf ? [dongWf] : []), '',
      '<!-- router:agent -->', '', '| Agent | Dùng khi | KHÔNG dùng khi |', '|---|---|---|', dongAg, '',
    ].join('\n');

    /* ĐỐI CHỨNG ÂM trước: đủ ba dòng thì cây tạm này PHẢI xanh — nếu không, ca dưới đỏ vì lý do khác. */
    const fDu = path.join(d, 'du.md');
    fs.writeFileSync(fDu, bang(true), 'utf8');
    const rDu = chay(['--repo', d, '--bang', fDu]);
    expect(rDu.code, `cây tạm phải tự xanh trước đã, nếu không ca dưới đo nhầm thứ:\n${rDu.out}`).toBe(0);

    /* Giờ xoá dòng WORKFLOW, giữ nguyên dòng LỆNH cùng tên. */
    const fThieu = path.join(d, 'thieu.md');
    fs.writeFileSync(fThieu, bang(false), 'utf8');
    const r = chay(['--repo', d, '--bang', fThieu]);
    expect(r.code, r.out).toBe(1);
    expect(r.out, 'phải nói rõ là WORKFLOW `trung` thiếu dòng, không im vì lệnh cùng tên đã có')
      .toMatch(/workflow `trung`/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: ô "KHÔNG dùng khi" điền dấu cho đủ ⇒ CHẶN', () => {
    /* Không có phép kiểm này thì cửa dạy người ta gõ `-` vào ô cuối, và bảng tụt về bản liệt kê. */
    const t = bangTam((s) => s.replace(/^(\| `\/explore` \|[^|]*\|)[^|]*\|/m, '$1 - |'));
    const r = chay(['--bang', t.f]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('quá ngắn');
    expect(r.out).toContain('explore');
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: ô ranh giới NGẮN NHẤT của bảng thật vẫn phải qua', () => {
    /*
     * Sàn đặt quá cao thì cửa đòi người ta viết dài cho đủ chữ, và đó là một kiểu hỏng khác. Đo lại ô
     * ngắn nhất đang có để biết sàn còn cách thực tế bao xa.
     */
    const s = fs.readFileSync(BANG, 'utf8');
    const o = s.split(/\r?\n/)
      .filter((l) => /^\| `\/?[a-z0-9_-]+` \|/.test(l))
      .map((l) => {
        const c = l.split('|').slice(1, -1).map((x) => x.trim());
        return c[c.length - 1].replace(/[`*\s-]/g, '').length;
      });
    expect(o.length, 'không đọc được dòng nào — sửa regex chứ đừng bỏ phép kiểm').toBeGreaterThanOrEqual(30);
    expect(Math.min(...o), 'ô ranh giới ngắn nhất phải còn trên sàn 25').toBeGreaterThan(25);
  });

  test('dòng MỒ CÔI chỉ CẢNH BÁO, không chặn', () => {
    /* Xoá một lệnh rồi quên xoá dòng là chuyện nhỏ hơn hẳn so với thêm lệnh mà quên thêm dòng. */
    const t = bangTam((s) => s.replace('<!-- router:agent -->', '<!-- router:agent -->\n\n| `khong-ton-tai` | x | một ô ranh giới đủ dài để qua sàn hai mươi lăm ký tự |'));
    const r = chay(['--bang', t.f]);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('MỒ CÔI');
    expect(r.out).toContain('khong-ton-tai');
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('"không phán được" KHÔNG thành "đạt": thiếu bảng ⇒ exit 2', () => {
    const r = chay(['--bang', path.join(os.tmpdir(), 'khong-he-ton-tai-router.md')]);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
  });

  test('0 điểm vào trên đĩa ⇒ exit 2, không phải exit 0', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'router0-'));
    const r = chay(['--repo', d, '--bang', BANG]);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toMatch(/KHÔNG đồng nghĩa với "đạt"/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('gate TỰ NÓI giới hạn: đọc TÊN và ĐỘ DÀI, không hiểu nghĩa', () => {
    const src = fs.readFileSync(GATE, 'utf8');
    expect(src).toMatch(/không hiểu nghĩa/);
    expect(src, 'phải nói rõ ranh giới ĐÚNG hay không thì review tay').toMatch(/review tay/);
  });

  test('bảng chỉ nhắc npm script CÓ THẬT', () => {
    /* eslint-disable @typescript-eslint/no-var-requires, global-require */
    const pkg = require(path.join(REPO, 'package.json'));
    /* eslint-enable @typescript-eslint/no-var-requires, global-require */
    const s = fs.readFileSync(BANG, 'utf8');
    const goi = [...s.matchAll(/`npm run ([a-z0-9:_-]+)/g)].map((m) => m[1]);
    expect(goi.length, 'bảng phải trỏ tới máy thật, không dạy chay').toBeGreaterThan(2);
    const thieu = [...new Set(goi)].filter((g) => !pkg.scripts[g]);
    expect(thieu, `bảng nhắc npm script KHÔNG tồn tại: ${thieu.join(', ')}`).toEqual([]);
  });
});
