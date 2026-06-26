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

## 자동 수집

```bash
node scripts/update-hub-tools.js
```

GitHub Actions가 매일 오전 5시, 오후 5시(KST)에 `generated-tools.js`를 갱신합니다.
