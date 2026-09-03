import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const ENDPOINT = 'http://finlife.fss.or.kr/finlifeapi/savingProductsSearch.json';
const TOP_FIN_GRP_NO = '020000';
const OUT_PATH = 'data/raw/savings.json';
const PAGE_DELAY_MS = 300;

const authKey = process.env.FSS_API_KEY;
if (!authKey) {
  console.error('FSS_API_KEY가 .env에 없습니다.');
  process.exit(1);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(pageNo: number) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('auth', authKey!);
  url.searchParams.set('topFinGrpNo', TOP_FIN_GRP_NO);
  url.searchParams.set('pageNo', String(pageNo));

  const res = await fetch(url);
  const text = await res.text();

  if (!res.ok) {
    console.error(`요청 실패 (status ${res.status}), pageNo=${pageNo}`);
    console.error(text);
    process.exit(1);
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    console.error('JSON 파싱 실패. 원문 응답:');
    console.error(text);
    process.exit(1);
  }

  if (!json.result) {
    console.error('예상치 못한 응답 형식. 원문 응답:');
    console.error(text);
    process.exit(1);
  }

  return json.result;
}

async function main() {
  const first = await fetchPage(1);

  console.log('baseList[0] 키 목록:', Object.keys(first.baseList?.[0] ?? {}));
  console.log('optionList[0] 키 목록:', Object.keys(first.optionList?.[0] ?? {}));

  const maxPageNo: number = first.max_page_no ?? 1;
  console.log(`총 페이지 수: ${maxPageNo}`);

  const baseList: any[] = [...(first.baseList ?? [])];
  const optionList: any[] = [...(first.optionList ?? [])];

  for (let pageNo = 2; pageNo <= maxPageNo; pageNo++) {
    await sleep(PAGE_DELAY_MS);
    const page = await fetchPage(pageNo);
    baseList.push(...(page.baseList ?? []));
    optionList.push(...(page.optionList ?? []));
    console.log(`페이지 ${pageNo}/${maxPageNo} 수집 완료 (누적 baseList ${baseList.length}건)`);
  }

  const output = {
    baseList,
    optionList,
    fetchedAt: new Date().toISOString(),
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`저장 완료: ${OUT_PATH} (baseList ${baseList.length}건, optionList ${optionList.length}건)`);
}

main().catch((err) => {
  console.error('예상치 못한 오류:', err);
  process.exit(1);
});
