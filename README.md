# CG Project – Rengoku Survival

## 프로젝트 개요
본 프로젝트는 Three JS 기반의 3D 게임 구현을 목표로 진행한 
컴퓨터 그래픽스 팀 프로젝트입니다.

단순한 3D 모델 구현보다는 다음과 같은 사항에 초점을 두어 설계하였습니다.
- 실제 플레이 가능한 게임 구조
- 캐릭터/적/전투/사운드/UI 등을 분리한 시스템 설계
- 확장에 친화적인 아키텍처


## 게임 소개
플레이어는 3D 공간에서 캐릭터를 조작하여
지속적으로 등장하는 적을 처치하며 최대 점수를 기록합니다.

조작법
- WASD로 이동, 마우스로 시점 조절
- 좌클릭으로 기본 공격, 우클릭으로 특수 공격
- Q키로 회복 포션 사용
- R키로 광역 범위의 스킬 사용

점수
- 생존 시간 1초당 100점
- 적을 하나 처치할 때 마다 200점


## 기술 스택
- **Language**: JavaScript (ES6+)
- **Graphics**: Three.js
- **Architecture**: Entity–System 분리형 아키텍처  
  Entity는 상태와 최소 동작만을 보유하고,  
  전투, UI, 사운드 등의 주요 로직은 System 단위로 분리하여  
  유지보수성과 확장성을 고려한 구조로 설계했습니다.
- **Asset**: GLTF 모델링
- **Tooling**: GitHub Web Server, OCI (for leaderboard)


## 프로젝트 구조
```
CGPROJECT
├─ assets
│ ├─ models    # 3D 모델 (GLTF)
│ ├─ textures  # 바닥 텍스처
│ ├─ sounds    # 여러 효과음
│ ├─ images    # 이미지 소스 파일
│
├─ src
│ ├─ core      # 프레임 당 루프 관리 및 입력 처리
│ ├─ entities  # Character -> Player, Enemy 상속 구조
│ ├─ systems   # Combat, Spawn, UI, Sound 등
│ ├─ effects   # SwordTrail 등 시각 효과
│ ├─ config    # 게임 설정 값
│ └─ index.js  # 엔트리 포인트
│
└─ index.html
```

## 핵심 시스템 설명
### Combat System
Combat System은 Player와 Enemy 간의 전투 상호작용만을 전담하는 시스템입니다.
Entity 내부에 전투 로직을 직접 포함시키지 않고,
충돌 판정, 데미지 계산, 사운드 및 이펙트 트리거를
System 단위로 분리하여 관리했습니다.

- 공격 판정 시 SwordTrail 이펙트와 타격 사운드를 함께 처리
- Entity는 체력, 위치 등 상태 정보만 보유
- 전투 규칙 변경 시 Entity 수정 없이 Combat System만 수정 가능

이를 통해 전투 로직의 가독성과 확장성을 확보했습니다.

### Enemy Spawn System
Enemy Spawn System은 적의 생성 주기와 위치를 관리하는 시스템입니다.
게임 진행 중 적이 무작위로 생성되도록 하되,
난이도 조절과 성능 관리를 고려해 설계했습니다.

- 일정 시간 간격으로 Enemy 생성
- 최대 Enemy 수 제한으로 과도한 객체 증가 방지
- 제거된 Enemy는 정리(clean-up) 로직을 통해 메모리 누수 방지

적 생성 로직을 독립적인 시스템으로 분리하여,
추후 보스 몬스터나 패턴 기반 스폰 로직으로의 확장이 가능하도록 했습니다.

### Core: Game / Player Control
Game.js는 입력 처리, 시스템 업데이트, 렌더링 흐름을 조율하는 역할을 합니다.
Player 입력은 직접 Entity를 제어하지 않고,
현재 상태(state)에 따라 이동 및 애니메이션이 결정되도록 구성했습니다.

- 키보드 입력 기반 이동 및 공격 처리
- 상태 머신(state)에 따른 애니메이션 전환
- 매 프레임마다 각 System을 순차적으로 업데이트

이를 통해 게임 전체 흐름을 중앙에서 제어하면서 개별 시스템은 서로 느슨하게 결합되도록 설계했습니다.


## 리더보드
본 게임에서 달성한 점수를 다른 플레이어의 점수와 비교할 수 있도록 하였습니다.
실제 서비스 구조를 간단한 규모로 축소한 풀스택 리더보드 시스템을 함께 구현했습니다.
게임 클라이언트(Frontend)와 서버(Backend), 데이터베이스(DB)를 분리하였습니다.
해당 구현은 /leaderboard/에서 확인할 수 있습니다.

### Architecture Overview
- **Front-end**
  - 게임 종료 시 최고 기록을 달성했다면 점수를 서버로 전송
  - 최고기록을 달성하지 못한 값은 local storage에 저장
  - REST API를 통해 순위 조회 및 UI 표시

- **Back-end**
  - Node.js + Express 기반 REST API 서버
  - 입력 값 검증 및 Rate Limit 적용으로 비정상 요청 방지
  - 트랜잭션 기반 처리로 데이터 일관성 보장

- **Database**
  - SQLite (Node.js에서 better-sqlite3 라이브러리 사용)
  - players / scores의 두 테이블로 분리
  - 최고 점수만 갱신되도록 SQL UPSERT 로직 구현
  - 랭킹 조회의 성능을 고려한 인덱스 구성

### API Endpoints
- `POST /api/score`  
  : 최고 기록을 달성한 점수 제출
- `GET /api/leaderboard?limit=`  
  : 상위 랭킹 조회
- `GET /api/me?playerId=`  
  : 개인 최고 점수 및 순위 조회
- `GET /api/health`  
  : 서버 및 DB 상태 확인

### Deployment & Infrastructure (OCI)
- 리더보드 서버는 Oracle Cloud Infrastructure(OCI)에 배포하여  
  실제 서비스 환경과 유사한 형태로 운영되도록 구성했습니다.

### Network / Security
- OCI 인스턴스 보안 규칙을 설정하여 API 포트에 대한 Ingress 트래픽 제어
- 불필요한 포트는 차단하고 서비스에 필요한 포트만 허용

### Domain & HTTPS
- 퍼블릭 IP에 DNS 도메인을 할당하여 고정 주소로 접근 가능하도록 구성
- Nginx를 리버스 프록시로 사용하여 Node.js(Express) 서버를 외부로 노출
- Certbot을 사용해 Let’s Encrypt 기반 HTTPS 인증서 발급 및 적용
- GitHub Web (HTTPS) 환경에서도 게임 클라이언트가 API 호출할 수 있도록 구성

### Server Architecture
- Nginx → Node.js(Express) → SQLite 구조
- 클라이언트는 HTTPS를 통해 Nginx에 접근하고,
  내부적으로 Express 서버로 요청이 전달되는 방식


## 팀 구성 및 역할


## 구현 포인트 & 고민한 점


## 확장 가능성
## 실행 방법
## 스크린샷 / 영상
