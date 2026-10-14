import { test, expect } from '@playwright/test';
import * as path from 'path';

/*
 * Mục A của v2.8.4 — harness đồng thời.
 *
 * Thứ phải khoá KHÔNG phải "harness chạy được", mà là **harness không báo xanh cho một thứ nó chưa đo**.
 * Hai chỗ nguy hiểm nhất, và cả hai có test riêng:
 *   · kịch bản không khai bất biến ⇒ `CHUA_KIEM`, không PASS;
 *   · N request KHÔNG thật sự đua (độ lệch thả quá ngưỡng) ⇒ `CHUA_KIEM`, không PASS.
 *
 * Và điều kiện để tin nó: mỗi lỗi đua có CẶP hỏng/đúng. Một harness chỉ được thử trên bản đúng thì chưa
 * ai biết nó bắt được gì.
 */

const REPO = path.resolve(__dirname, '..', '..', '..');
const FXDIR = path.join(REPO, 'tests', 'fe', 'fixtures', 'discovery-app');
/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const fixture = require(path.join(FXDIR, 'server.js'));
const cc = require(path.join(REPO, 'scripts', 'qa', 'concurrency_check.js'));
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

type Srv = { url: string; close(): Promise<void> };
type Ket = { tt: string; vi_sao: string | null; lech?: number; ma?: number[] };

/** Gọi thật, dùng chung với CLI. Giữ một bản để test đo đúng thứ sản phẩm chạy. */
const goi = async (url: string, init: Record<string, unknown>) => {
  const r = await fetch(url, init as RequestInit);
  let body = null;
  try { body = await r.json(); } catch (e) { body = null; }
  return { status: r.status, body };
};

function o(baseUrl: string, them: Record<string, unknown> = {}) {
  return {
    baseUrl,
    laFixture: cc.laFixture(baseUrl),
    resourceTest: '',
    nTran: 5,
    lechToiDa: cc.LECH_MAC_DINH_MS,
    goi,
    ...them,
  };
}

const KB = {
  duyet: (hong: boolean) => ({
    id: 'duyet', chay_o: 'fixture', method: 'POST', n: 4,
    duong: `/api/dua/duyet${hong ? '?hong=1' : ''}`,
    doc_lai: '/api/dua/trang-thai',
    bat_bien: { ma_tra_ve: { so_2xx: 1, cam_500: true }, doc: { so_lan_duyet: 1 } },
  }),
  dat: (hong: boolean) => ({
    id: 'dat', chay_o: 'fixture', method: 'POST', n: 4,
    duong: `/api/dua/dat${hong ? '?hong=1' : ''}`,
    headers: { 'idempotency-key': 'K1' },
    doc_lai: '/api/dua/trang-thai',
    bat_bien: { doc: { so_ban_ghi_dat: 1 } },
  }),
  tru: (hong: boolean) => ({
    id: 'tru', chay_o: 'fixture', method: 'POST', n: 4,
    duong: `/api/dua/tru${hong ? '?hong=1' : ''}`,
    doc_lai: '/api/dua/trang-thai',
    bat_bien: { doc: { kho_con_lai: { toi_thieu: 0 } } },
  }),
  callback: (hong: boolean) => ({
    id: 'callback', chay_o: 'fixture', method: 'POST', n: 4,
    duong: `/api/dua/callback?ref=R1${hong ? '&hong=1' : ''}`,
    doc_lai: '/api/dua/trang-thai',
    bat_bien: { doc: { callback_tong: 100 } },
  }),
};

test.describe('@infra đồng thời — CẶP hỏng/đúng cho từng lỗi đua', () => {
  for (const [ten, dung] of Object.entries(KB)) {
    test(`${ten}: fixture ĐÚNG ⇒ PASS, fixture CÀI LỖI ⇒ FAIL`, async () => {
      test.setTimeout(60000);

      const sOk: Srv = await fixture.start();
      const ok: Ket = await cc.chayKichBan(dung(false), o(sOk.url));
      await sOk.close();

      const sBad: Srv = await fixture.start();
      const bad: Ket = await cc.chayKichBan(dung(true), o(sBad.url));
      await sBad.close();

      expect(ok.tt, `bản ĐÚNG phải PASS — ${ok.vi_sao}`).toBe(cc.TT.pass);
      /*
       * Vế quyết định: nếu bản CÀI LỖI cũng PASS thì control này chưa có hiệu lực, và mọi lượt xanh về
       * sau không chứng minh gì. Prompt v2.8.4 đặt đây là điều kiện DỪNG.
       */
      expect(bad.tt, 'bản CÀI LỖI phải FAIL — nếu không, harness chưa bắt được gì').toBe(cc.TT.fail);
      expect(bad.vi_sao, 'FAIL phải NÊU số đo, không chỉ nói "sai"').toMatch(/\d/);
    });
  }
});

test.describe('@infra đồng thời — không báo xanh cho thứ chưa đo', () => {
  test('không khai bất biến ⇒ CHUA_KIEM, KHÔNG phải PASS vì "chạy không lỗi"', async () => {
    const s: Srv = await fixture.start();
    const k: Ket = await cc.chayKichBan(
      { id: 'rong', chay_o: 'fixture', method: 'GET', n: 2, duong: '/api/dua/trang-thai', bat_bien: {} },
      o(s.url),
    );
    await s.close();
    expect(k.tt).toBe(cc.TT.chua_kiem);
    expect(k.vi_sao).toMatch(/KHÔNG khai bất biến/);
  });

  test('N request KHÔNG thật sự đua (lệch quá ngưỡng) ⇒ CHUA_KIEM', async () => {
    /*
     * Chỗ dễ tự lừa nhất của cả mục A. Hai request cách nhau 300ms thì chúng không đua, và "không đua mà
     * không lỗi" chẳng chứng minh gì — nhưng bất biến vẫn sẽ khớp, nên nếu không đo độ lệch thì harness
     * báo PASS cho một lượt chưa bao giờ xảy ra.
     *
     * Ép lệch bằng cách CHẶN EVENT LOOP giữa các lượt thả — không phải bằng cách cho mạng chậm.
     *
     * Bản đầu của test này cho `goi` ngủ (`await setTimeout`), và nó SAI: mạng chậm thì N request vẫn
     * chồng nhau trong lúc bay, tức vẫn đua. Thứ phá cuộc đua là DISPATCH bị trễ. Phép thử sai đó báo
     * PASS và làm lộ ra rằng tôi đang đo nhầm thứ.
     */
    const s: Srv = await fixture.start();
    let lan = 0;
    const goiCham = (url: string, init: Record<string, unknown>) => {
      const n = lan;
      lan += 1;
      const den = Date.now() + n * 60;
      while (Date.now() < den) { /* chặn event loop: lượt thả kế tiếp bị đẩy lùi thật */ }
      return goi(url, init);
    };
    const k: Ket = await cc.chayKichBan(KB.duyet(false), o(s.url, { goi: goiCham, lechToiDa: 5 }));
    await s.close();

    expect(k.tt, 'lệch quá ngưỡng thì phép đo CHƯA xảy ra').toBe(cc.TT.chua_kiem);
    expect(k.vi_sao).toMatch(/KHÔNG đua/);
  });
});

test.describe('@infra đồng thời — ranh giới an toàn, không nới', () => {
  test('kịch bản `fixture` TỪ CHỐI chạy khi target không phải loopback', async () => {
    const k: Ket = await cc.chayKichBan(KB.duyet(false), o('https://uat.vi-du.vn'));
    expect(k.tt).toBe(cc.TT.tu_choi);
    expect(k.vi_sao).toMatch(/KHÔNG phải fixture/);
  });

  test('kịch bản `uat_ghi` TỪ CHỐI khi thiếu `--resource-test`', async () => {
    const kb = { ...KB.duyet(false), chay_o: 'uat_ghi' };
    const k: Ket = await cc.chayKichBan(kb, o('https://uat.vi-du.vn'));
    expect(k.tt).toBe(cc.TT.tu_choi);
    expect(k.vi_sao).toMatch(/resource-test/);
  });

  test('N vượt trần ⇒ TỪ CHỐI — đây không phải load test', async () => {
    const s: Srv = await fixture.start();
    const k: Ket = await cc.chayKichBan({ ...KB.duyet(false), n: 99 }, o(s.url));
    await s.close();
    expect(k.tt).toBe(cc.TT.tu_choi);
    expect(k.vi_sao).toMatch(/vượt trần/);
    /* Trần CỨNG trong code chặn cả khi config khai to hơn. */
    expect(cc.N_TRAN_CUNG).toBeLessThanOrEqual(10);
  });

  test('n < 2 ⇒ TỪ CHỐI: một request thì không có gì để đua', async () => {
    const s: Srv = await fixture.start();
    const k: Ket = await cc.chayKichBan({ ...KB.duyet(false), n: 1 }, o(s.url));
    await s.close();
    expect(k.tt).toBe(cc.TT.tu_choi);
  });
});

test.describe('@infra đồng thời — chấm bất biến', () => {
  test('500 là FAIL, không phải "từ chối có kiểm soát"', () => {
    const k = cc.chamBatBien({ ma_tra_ve: { so_2xx: 1 } }, null, [200, 500]);
    expect(k.tt).toBe(cc.TT.fail);
    expect(k.vi_sao).toMatch(/vỡ ở server/);
  });

  test('tầng đọc thiếu trường ⇒ FAIL kèm tên trường, không im lặng bỏ qua', () => {
    const k = cc.chamBatBien({ doc: { khong_co: 1 } }, { co: 1 }, [200]);
    expect(k.tt).toBe(cc.TT.fail);
    expect(k.vi_sao).toMatch(/khong_co/);
  });

  test('ĐỐI CHỨNG: bất biến khớp ⇒ PASS', () => {
    expect(cc.chamBatBien({ doc: { a: 1 } }, { a: 1 }, [200]).tt).toBe(cc.TT.pass);
  });
});
