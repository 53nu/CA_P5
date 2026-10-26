# Between Breaths

[Demo](https://53nu.github.io/CA_P5/) · [Source](https://github.com/53nu/CA_P5)

p5.js로 만든 출생과 사망의 설치형 웹 시각화입니다. 어두운 배경 위에 화면 전체를 채우는 사각형 점 배열을 배치하며 점의 위치는 고정됩니다. 희미한 일반 점 가운데 출생한 점은 작은 흰색 십자 섬광으로 나타나 약 3.2초 동안 점점 커지며 더 빠르게 흐려져 사라집니다. 그 아래에는 희미한 일반 점이 남습니다. 사망한 점은 검은색 십자 섬광으로 나타나 약 4.8초에 걸쳐 작아지며 완전히 사라집니다. 섬광은 네 방향으로 길고 가늘게 뻗는 형태이며 원형 파동은 사용하지 않습니다. 흰색 출생 숫자 앞에는 生, 회색 사망 숫자 앞에는 死를 표시하며 가운데에는 새로고침 후 경과 시간을 분:초.100분의1초 형식으로 표시합니다.

`index.html`을 정적 서버로 실행합니다. 외부 라이브러리나 API 연결 없이 동작하도록 p5.js와 통계 데이터를 포함합니다. 화면의 큰 숫자는 **접속 후 누적 추정 인원**, 작은 숫자는 **초당 평균 추정 인원**입니다. 흰 점은 출생, 검은 점은 사망입니다. 각 추정 이벤트가 하나의 점을 바꿉니다. 위치는 추상적인 표현이며 실제 인물이나 지리 정보가 아닙니다. 화면을 다시 열면 누적 인원이 0부터 시작합니다.

## Data

UN DESA Population Division, **World Population Prospects 2024**, medium scenario. Distributed by **Our World in Data**. Retrieved 2026-10-24.

- https://population.un.org/wpp/
- https://ourworldindata.org/grapher/number-of-births-per-year
- https://ourworldindata.org/grapher/number-of-deaths-per-year
- https://ourworldindata.org/births-and-deaths

2026년 출생 132,503,470명, 사망 63,637,310명의 연간 전망치를 해당 UTC 연도의 정확한 초 수로 나눕니다. 약 4.20명/초, 2.02명/초입니다. 이 값은 **실측 실시간 집계가 아닌 통계 기반 시뮬레이션**입니다. 시간 누적으로 정수 경계를 지날 때마다 한 명씩 표시합니다. 2024–2100년의 연간 데이터를 포함하며, 연도가 바뀌면 해당 연도 값으로 전환합니다. 범위 밖에서는 가장 가까운 연도의 자료를 사용합니다. 데이터 출처와 계산법은 `demography.json`, HTML 접근성 설명, 이 문서에 명시했습니다.

십자 섬광은 축을 따라 중심에서 끝으로 옅어지는 그라데이션과 일부 구간에만 더해지는 글로우를 사용합니다. 출생 섬광은 백색 중심과 은은한 분홍·주황빛 가장자리, 사망 섬광은 검정 중심과 짙은 자주빛 가장자리를 가집니다. 섬광에만 얕은 블러와 부드러운 잔광을 더하며 숫자에는 블러를 적용하지 않습니다. 효과 이미지를 메모리에 한 번 그린 뒤 재사용해 많은 점을 부드럽게 표시합니다.

## Interaction

- 마우스 위치나 클릭/터치는 점의 형태에 영향을 주지 않습니다.
- 확산 효과 아이콘 / Space: 십자 섬광의 번짐 표시를 켜거나 끕니다. 인원수와 점의 생성·소멸은 계속 갱신합니다.
- 전체 화면 아이콘 / F: 전체 화면으로 전환합니다.
- 운영체제의 동작 줄이기 설정을 따릅니다.

## Library

p5.js 2.3.3, vendored from the official jsDelivr distribution, LGPL-2.1 license. https://p5js.org/ . Source: https://github.com/processing/p5.js .

## Run locally

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173/ .

## Deployment

GitHub Pages publishes the `main` branch from the repository root. `.nojekyll` keeps the site buildless. All runtime assets are vendored locally.
