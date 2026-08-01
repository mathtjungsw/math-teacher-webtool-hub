# 수학교사들의 웹툴 모음

수학교사들이 직접 제작한 수업용 웹툴 모음 페이지를 한 곳에서 찾는 독립 허브입니다.

## 파일 구조

- `index.html`: 허브 페이지 구조
- `style.css`: 허브 디자인
- `data.js`: 교사별 웹툴 모음 페이지 데이터
- `generated-tools.js`: 자동 수집된 개별 웹툴 검색 데이터
- `script.js`: 검색, 필터, 렌더링 기능
- `scripts/update-hub-tools.js`: 교사 페이지의 웹툴 목록 자동 수집 스크립트

## 데이터 수정

새 교사 페이지를 추가할 때는 `data.js`의 `teachers` 배열에 항목을 추가합니다.

```js
{
  name: "교사 이름",
  school: "학교 또는 소속",
  description: "한 줄 소개",
  tags: ["함수", "수업활동"],
  url: "https://example.com/",
  crawlUrl: "https://example.com/",
  crawlDisabled: false,
  image: "",
  imageAlt: "페이지 미리보기 설명",
  tools: [
    {
      title: "웹툴 모음 페이지",
      description: "자동 수집 실패 시 표시할 기본 설명",
      tags: ["수업활동"],
      url: "https://example.com/",
    },
  ],
}
```

자동 탐색을 지원하지 않는 사이트는 `crawlDisabled: true`로 설정하고 `tools`에 검색용 항목을 직접 등록합니다.

## 자동 수집

```bash
node scripts/update-hub-tools.js
```

GitHub Actions가 매일 오전 5시, 오후 5시(KST)에 `generated-tools.js`를 갱신합니다.

- 외부 페이지와 스크립트에서는 HTTP/HTTPS 링크와 정적인 데이터 리터럴만 읽습니다.
- 요청은 시간 제한과 재시도를 적용하고 최대 4개씩 병렬 처리합니다.
- 이전 수집량보다 20% 넘게 줄면 기존 결과를 유지하고 `regression` 상태로 표시합니다.
- 실제 목록이나 수집 상태가 바뀌지 않으면 파일을 수정하거나 자동 커밋하지 않습니다.

의도적으로 웹툴을 대량 삭제한 경우 GitHub Actions의 수동 실행 화면에서 `allow_count_drop`을 켜고 실행합니다.
