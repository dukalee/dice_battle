# Task 1: 프로젝트 초기화와 게임 골격

## 참조
- PRD 비기능 요구사항: 호환성(16:9, 창 크기 스케일링, Chrome/Edge/Firefox 최신판), 기술(Canvas 2D + TypeScript, Vite, Vitest), 성능(60fps), 테스트 용이성(규칙 계산과 렌더링 분리)
- FR-21 (논리 해상도 1280x720, 비율 유지 스케일링)

## 선행 task
- 없음

## 구현 기능 목록
- Vite + TypeScript 프로젝트 생성 (React는 쓰지 않는다. 모든 화면은 Canvas로 그린다.)
- Vitest 설정 및 샘플 테스트 1개
- 논리 해상도 1280x720 캔버스를 만들고, 창 크기에 맞춰 16:9 비율을 유지하며 스케일링 (남는 영역은 여백 처리)
- 화면 좌표를 논리 좌표(1280x720)로 변환하는 함수 (이후 Pointer 입력에서 사용)
- 고정 시간 간격 update와 requestAnimationFrame render로 구성된 게임 루프. update는 경과 시간(dt)을 받아 연출 타이머를 구동하며, 일시정지(Task 9)를 위해 dt를 0으로 막을 수 있어야 한다.
- 상수 파일(constants): 논리 해상도, 업데이트 간격, 기본 색상/폰트, 라운드 클리어 회복 비율(1/2) 등 공용 값
- 게임 규칙 로직은 렌더링/DOM과 분리된 순수 TypeScript 모듈로 구성하는 디렉터리 구조 (예: `src/core`, `src/game`, `src/scenes`, `src/render`)
- `CLAUDE.md`의 "Project status"와 명령 목록 갱신: dev/build/test 명령과 단일 테스트 실행 방법

## 완성 조건
- [x] `npm run dev`로 실행하면 캔버스가 화면에 표시된다.
- [x] 창 크기를 바꿔도 16:9 비율이 유지되고 캔버스가 찌그러지지 않는다.
- [x] 화면 좌표를 논리 좌표로 변환한 값이 여백과 스케일을 반영해 올바르다. (단위 테스트)
- [x] 게임 루프가 일정한 간격으로 update를 호출하고, 임시 도형(예: 움직이는 사각형)이 부드럽게 그려진다.
- [x] dt를 0으로 막으면 update 상태가 멈추고 render는 계속된다.
- [x] `npm run test`가 통과한다.
- [x] `npm run build`가 오류 없이 끝난다.
