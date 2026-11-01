# 자격증 후보와 추천 로드맵

- 이슈: [#38](https://github.com/sirloinbh/cert-manager/issues/38)
- 확인일: **2026-11-01** (Asia/Seoul). 아래 모든 값의 확인 날짜이며, 값 옆의 링크가 출처다.
- 함께 볼 문서: [자격증별 등급 체계](certification-grades.md), [세부 공부 계획](../plans/README.md)

## 읽는 법

- 공식 사이트만 근거로 삼았다. 사용자가 받아 둔 AI 추천 목록의 금액은 쓰지 않았다.
- **확인 못 함**: 공식 근거를 찾지 못한 값이다. 추정해서 채우지 않았다.
- **(발췌)**: 공식 페이지 본문을 열지 못해 검색 결과의 공식 페이지 발췌로 본 값이다. 결제 전에 다시 확인한다.
- 응시료는 한국 가격이 공개되어 있으면 그 값이고, 없으면 USD 정가다. 세금은 별도일 수 있다.
- 응시료는 바뀐다. 접수할 때 공식 사이트에서 다시 확인한다.

## 지금 목표와 맞춘 추천 로드맵

앞 3단계는 [세부 공부 계획](../plans/README.md)의 순서이고, 4단계부터는 작성자의 추천이다. 공부 시간은 공휴일 2시간과 시험 전 2주의 평일 1시간뿐이라, 기간은 적지 않고 앞 단계가 끝나면 다음 단계를 정한다.

| 단계 | 자격증                                                                                | 이유                                                                |
| ---- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1    | 토익 첫 응시(2027-01-31 잠정), 정보처리기사 실기                                      | 토익은 사용자가 정한 시기이고, 실기는 2027년 3회가 기한이다         |
| 2    | 운전면허 2종 보통, AWS Cloud Practitioner                                             | 면허가 없고, AWS 첫 단계는 경험이 없어도 된다                       |
| 3    | 토익 스피킹, 토익 두 번째 응시, AWS Solutions Architect – Associate                   | 지금 목표에 있는 시험의 나머지다                                    |
| 4    | SQLD, Terraform Associate, KCNA                                                       | 지금 앱을 만들며 쓰는 기술에 가깝고 비용이 낮다                     |
| 5    | 방향 선택: 보안(정보보안기사), 인프라(CKA, AWS Professional), AI(AWS AI Practitioner) | 그때의 일과 관심사로 정한다. AWS Professional은 경험 2년이 필요하다 |

사용자 결정으로 기능사와 산업기사는 따지 않으므로, 아래 표의 조리기능사는 참고로만 남긴다.

## AWS 라인업

가격표: [AWS 시험 정책](https://aws.amazon.com/certification/policies/before-testing/). 세금 별도이고, 최소 연 1회 환율을 반영해 바뀐다. 유효기간: [재인증](https://aws.amazon.com/certification/recertification/) 기준 3년. 단계별 경험: [시험 목록](https://aws.amazon.com/certification/exams/).

| 단계         | 응시료          | AWS가 안내하는 경험                     |
| ------------ | --------------- | --------------------------------------- |
| Foundational | ₩131,525 ($100) | 경험 불필요                             |
| Associate    | ₩197,287 ($150) | 클라우드 또는 IT 경험 권장              |
| Professional | ₩394,575 ($300) | AWS 경험 2년 이상(목록 표기는 required) |
| Specialty    | ₩394,575 ($300) | 시험마다 다름                           |

| 단계         | 자격증                                                                                                           | 비고                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Foundational | [Cloud Practitioner](https://aws.amazon.com/certification/certified-cloud-practitioner/)                         | 추천 1순위. 지금 목표                                     |
| Foundational | [AI Practitioner](https://aws.amazon.com/certification/certified-ai-practitioner/)                               |                                                           |
| Associate    | [Solutions Architect](https://aws.amazon.com/certification/certified-solutions-architect-associate/)             | 추천 2순위. 지금 목표. 설계 실무 1년 이상 권장            |
| Associate    | [Developer](https://aws.amazon.com/certification/certified-developer-associate/)                                 | C02 마지막 응시 2026-11-30, C03 시행 2026-12-01           |
| Associate    | [CloudOps Engineer](https://aws.amazon.com/certification/certified-cloudops-engineer-associate/)                 | 옛 SysOps Administrator. 한국어 시험은 2026-11-19 뒤 폐지 |
| Associate    | [Data Engineer](https://aws.amazon.com/certification/certified-data-engineer-associate/)                         | 데이터 분야 2~3년 권장                                    |
| Associate    | [Machine Learning Engineer](https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/) | C02 전환 중. 시행일이 공식 자료끼리 다름                  |
| Professional | [Solutions Architect](https://aws.amazon.com/certification/certified-solutions-architect-professional/)          | C03 시행 2026-11-17                                       |
| Professional | [DevOps Engineer](https://aws.amazon.com/certification/certified-devops-engineer-professional/)                  | 한국어 시험은 2026-12-31 뒤 폐지                          |
| Professional | [Generative AI Developer](https://aws.amazon.com/certification/certified-generative-ai-developer-professional/)  | 개별 페이지에 유효기간 표기 없음(공통 규정 3년)           |
| Specialty    | [Security](https://aws.amazon.com/certification/certified-security-specialty/)                                   | IT 보안 5년, AWS 보안 2년 이상 권장                       |
| Specialty    | [Advanced Networking](https://aws.amazon.com/certification/certified-advanced-networking-specialty/)             | 2026-12-31이 마지막 응시일                                |
| Business     | [AI Business Strategist](https://aws.amazon.com/certification/certified-ai-business-strategist/)                 | 베타 $50, 정식 $100                                       |

Machine Learning Specialty는 [현재 시험 목록](https://docs.aws.amazon.com/aws-certification/latest/examguides/aws-certification-exam-guides.html)에 없다.

**추천 순서:** Cloud Practitioner → Solutions Architect Associate → 일에 맞는 Associate 하나 더 → Professional(경험 2년 뒤) → 필요하면 Security Specialty.

## 개발 자격증

### 기초·국가자격

국가기술자격의 "만료 없음"은 [Q-Net 일반 안내](https://www.q-net.or.kr/qlf001.do?id=qlf00109) 기준이다. 필기 합격 뒤 실기 응시 기한은 자격의 유효기간이 아니다.

| 자격증                                                                                                                 | 응시료                       | 유효기간                                                             | 비고                                 |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| [정보처리기사](https://www.q-net.or.kr/crf005.do?id=crf00503s02&gSite=Q&gId=&jmCd=1320&jmInfoDivCcd=B0)                | 필기 19,400원, 실기 22,600원 | 만료 없음                                                            | 지금 목표                            |
| [정보관리기술사](https://www.q-net.or.kr/crf005.do?id=crf00503s02&gSite=Q&gId=&jmCd=0601&jmInfoDivCcd=B0)              | 필기 67,800원, 실기 87,100원 | 만료 없음                                                            | 응시 자격 조건은 등급 체계 문서 참고 |
| [리눅스마스터 1급](https://www.ihd.or.kr/introducesubject1.do)                                                         | 1차 55,000원, 2차 77,000원   | [평생 유효](https://www.ihd.or.kr/questionlist4.do)                  |                                      |
| [LPIC-1](https://www.lpi.org/our-certifications/lpic-1-overview/)                                                      | 과목당 $200, 2과목 $400      | 5년                                                                  | 한국에 $200 적용은 추론              |
| [네트워크관리사 2급](https://www.icqa.or.kr/cn/page/network)                                                           | 필기 43,000원, 실기 78,000원 | [5년 단위, 보수교육으로 연장](https://www.icqa.or.kr/cn/faq?fm_id=3) |                                      |
| [Cisco CCNA](https://www.cisco.com/site/us/en/learn/training-certifications/certifications/enterprise/ccna/index.html) | $300                         | 3년                                                                  |                                      |

### 클라우드

Azure 역할 기반 자격은 [1년마다 무료 온라인 평가로 갱신](https://learn.microsoft.com/en-us/credentials/certifications/renew-your-microsoft-certification-faq)하고 Fundamentals는 만료가 없다. Azure 한국 가격은 페이지가 스크립트로만 보여 주어 읽지 못했고, [공식 FAQ](https://learn.microsoft.com/en-us/credentials/certifications/frequently-asked-questions)의 "typically US$165"만 확인했다. 폐지 일자는 [폐지 시험 목록](https://learn.microsoft.com/en-us/credentials/support/retired-certification-exams)에 있다. Google Cloud는 USD 가격이고 세금은 별도다.

| 자격증                                                                                             | 응시료                            | 유효기간            | 비고                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [AZ-900](https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/)         | 확인 못 함                        | 만료 없음           |                                                                                                                                                               |
| [AZ-104](https://learn.microsoft.com/en-us/credentials/certifications/azure-administrator/)        | 일반가 $165, 한국 가격 확인 못 함 | 1년                 |                                                                                                                                                               |
| [AZ-305](https://learn.microsoft.com/en-us/credentials/certifications/azure-solutions-architect/)  | 일반가 $165, 한국 가격 확인 못 함 | 1년                 | Azure Administrator Associate 필요                                                                                                                            |
| [AZ-400](https://learn.microsoft.com/en-us/credentials/certifications/devops-engineer/)            | 일반가 $165, 한국 가격 확인 못 함 | 1년                 | Administrator 또는 Developer Associate 필요                                                                                                                   |
| [AZ-204](https://learn.microsoft.com/en-us/credentials/certifications/azure-developer/)            | 응시 불가                         | 신규 취득·갱신 불가 | **2026-07-31 폐지.** 후속 AI-200                                                                                                                              |
| [AZ-500](https://learn.microsoft.com/en-us/credentials/certifications/azure-security-engineer/)    | 응시 불가                         | 신규 취득·갱신 불가 | **2026-08-31 폐지.** 후속 [SC-500](https://learn.microsoft.com/en-us/partner-center/announcements/2026-august)                                                |
| [AI-900](https://learn.microsoft.com/en-us/credentials/certifications/azure-ai-fundamentals/)      | 응시 불가                         | 자격은 만료 없음    | **시험 2026-06-30 폐지.** 같은 자격을 [AI-901](https://learn.microsoft.com/en-us/credentials/certifications/exams/ai-901/)로 취득. AI-901 응시료는 확인 못 함 |
| [AI-102](https://learn.microsoft.com/en-us/credentials/certifications/azure-ai-engineer/)          | 응시 불가                         | 신규 취득·갱신 불가 | **2026-06-30 폐지.** 후속 [AI-103](https://learn.microsoft.com/en-us/credentials/certifications/azure-ai-apps-and-agents-developer-associate/)                |
| [Cloud Digital Leader](https://cloud.google.com/learn/certification/cloud-digital-leader)          | $99                               | 3년                 | 갱신 $60                                                                                                                                                      |
| [Associate Cloud Engineer](https://cloud.google.com/learn/certification/cloud-engineer)            | $125                              | 3년                 | 갱신 $75                                                                                                                                                      |
| [Professional Cloud Architect](https://cloud.google.com/learn/certification/cloud-architect)       | $200                              | 2년                 | 갱신 $100                                                                                                                                                     |
| [Professional Data Engineer](https://cloud.google.com/learn/certification/data-engineer)           | $200                              | 2년                 | 갱신 $100                                                                                                                                                     |
| [Professional ML Engineer](https://cloud.google.com/learn/certification/machine-learning-engineer) | $200                              | 2년                 |                                                                                                                                                               |

### 컨테이너·자동화

| 자격증                                                                                                      | 응시료                                     | 유효기간                                                  | 비고                            |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------- | ------------------------------- |
| [KCNA](https://training.linuxfoundation.org/certification/kubernetes-cloud-native-associate/)               | $250                                       | 2년                                                       | 재응시 1회 포함                 |
| [CKAD](https://training.linuxfoundation.org/certification/certified-kubernetes-application-developer-ckad/) | $445                                       | 2년                                                       | 재응시 1회 포함. 실습형         |
| [CKA](https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/)           | $445                                       | 2년                                                       | 재응시 1회 포함. 실습형         |
| [Terraform Associate](https://developer.hashicorp.com/certifications/terraform-associate)                   | $70.50                                     | 2년                                                       | 무료 재응시 없음                |
| [GitHub Foundations](https://learn.microsoft.com/en-us/credentials/certifications/github-foundations/)      | [$99](https://learn.github.com/faq) (발췌) | 확인 못 함: 공식 페이지끼리 다름("갱신 불필요", "24개월") | 한국 가격 확인 못 함            |
| [GitHub Actions](https://learn.microsoft.com/en-us/credentials/certifications/github-actions/)              | [$99](https://learn.github.com/faq) (발췌) | 2년                                                       | 한국 가격 확인 못 함            |
| [Docker Certified Associate](https://training.mirantis.com/certification/dca-certification-exam/)           | $199                                       | 2년                                                       | Docker사가 아닌 Mirantis가 운영 |

### 보안

| 자격증                                                                                                         | 응시료                       | 유효기간                                                    | 비고                                                  |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| [정보보안기사](https://www.cq.or.kr/qh_quagm01_020.do)                                                         | 필기 19,400원, 실기 22,600원 | 만료 없음                                                   | 안내 게시 시점이 오래되어 최신 여부 불확실            |
| [CompTIA Security+](https://www.comptia.org/en-eu/blog/how-long-does-the-comptia-security-certification-last/) | 확인 못 함                   | 3년                                                         | V8 2026-11-17경 출시                                  |
| [CPPG](https://cpptest.or.kr/new/board/noticeView.php?b_idx=195)                                               | 130,000원                    | 확인 못 함                                                  |                                                       |
| [ISC2 CISSP](https://www.isc2.org/register-for-exam/isc2-exam-pricing)                                         | $749 (Asia Pacific)          | [3년 주기](https://www.isc2.org/landing/CISSP-one-constant) | 경력 5년 요건. 연회비 $135. 한국의 APAC 포함은 미확인 |

AWS Security Specialty는 AWS 라인업에, Azure의 AZ-500은 클라우드 표에 있다.

### 데이터

보수교육 규정은 [SQLD](https://www.dataq.or.kr/www/sub/a_04.do), [SQLP](https://www.dataq.or.kr/www/sub/a_03.do), [보수교육 안내](https://www.dataq.or.kr/www/sub/a_iocon.do)에 있다. 응시료는 모두 [데이터자격검정 접수 안내](https://www.dataq.or.kr/www/accept/guide.do)의 값이다. 2026년 제도 변경 여부는 공지 게시판을 읽지 못해 확인하지 못했다.

| 자격증                                          | 응시료                       | 유효기간                                    | 비고                            |
| ----------------------------------------------- | ---------------------------- | ------------------------------------------- | ------------------------------- |
| SQLD                                            | 50,000원                     | 합격일부터 2년, 무료 보수교육으로 영구 전환 | 합격 후 1년 6개월~2년 사이 이수 |
| SQLP                                            | 100,000원                    | 합격일부터 2년, 무료 보수교육으로 영구 전환 |                                 |
| [ADsP](https://www.dataq.or.kr/www/sub/a_06.do) | 50,000원                     | 확인 못 함                                  |                                 |
| [ADP](https://www.dataq.or.kr/www/sub/a_05.do)  | 필기 80,000원, 실기 70,000원 | 확인 못 함                                  |                                 |
| 빅데이터분석기사                                | 필기 17,800원, 실기 40,800원 | 만료 없음                                   |                                 |

AWS Data Engineer와 Google Professional Data Engineer는 위 표에 있다.

### AI·ML

입문은 AWS AI Practitioner, 실무는 AWS Machine Learning Engineer와 Google Professional ML Engineer, 심화는 AWS Generative AI Developer다. 값은 위 표에 있다. Azure는 AI-900, AI-102가 폐지되어 AI-901, AI-103을 본다.

### 언어·테스트·방법론

| 자격증                                                                                                     | 응시료                                                    | 유효기간                                                                                       | 비고                            |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------- |
| [Oracle Java SE OCP](https://education.oracle.com/java-se-25-developer-professional/pexam_1Z0-831)         | USD 245 (발췌)                                            | 확인 못 함                                                                                     |                                 |
| [Python Institute PCAP](https://pythoninstitute.org/pcap)                                                  | $295부터                                                  | 5년                                                                                            |                                 |
| [ISTQB Foundation (KSTQB)](https://www.kstqb.org/sw/sw3.asp)                                               | 198,000원                                                 | 평생                                                                                           | 실러버스 개정 때 갱신 단서 있음 |
| [Scrum.org PSM I](https://www.scrum.org/assessments/professional-scrum-master-i-certification)             | $200 (발췌)                                               | 평생                                                                                           |                                 |
| [Scrum Alliance CSM](https://www.scrumalliance.org/get-certified/scrum-master-track/certified-scrummaster) | 교육 포함 $250~$2,495(2023-10 범위), 한국 가격 확인 못 함 | 2년. [갱신 20 SEU와 $100](https://www.scrumalliance.org/get-certified/renewing-certifications) | 강사별 가격                     |
| [PMI PMP](https://www.pmi.org/certifications/project-management-pmp)                                       | 회원 $405, 비회원 $655 (발췌)                             | 3년 주기                                                                                       | 지역별 가격 있음. 유지 60 PDU   |
| [PMI-ACP](https://www.pmi.org/certifications/agile-acp)                                                    | 회원 $435, 비회원 $495 (발췌)                             | 3년 주기                                                                                       | 유지 30 PDU                     |

## 어학

유효기간은 시험 주관사 표기다. 제출 기관이 정한 기한은 다를 수 있다.

| 시험                                                                        | 응시료                                                            | 유효기간                                                                                                                                   | 비고                      |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| [토익](https://exam.toeic.co.kr/receipt/receiptStep1.php)                   | 확인 못 함                                                        | [시험일부터 2년](https://m.exam.toeic.co.kr/customer/csFaq.php) (발췌)                                                                     | 지금 목표. 접수 화면 확인 |
| [토익 스피킹](https://exam.toeic.co.kr/receipt/receiptStep1.php)            | 84,000원 (발췌)                                                   | [시험일부터 2년](https://m.exam.toeic.co.kr/customer/csFaq.php) (발췌)                                                                     | 지금 목표. 접수 화면 확인 |
| [OPIc](https://www.opic.or.kr/opics/jsp/senior/receipt/aboutOpicMobile.jsp) | 84,000원                                                          | [응시일부터 2년](https://www.opic.or.kr/opics/servlet/controller.opic.site.applyinfor.ActflTestRuleServlet?p_process=move-actfl_test_rule) |                           |
| JLPT                                                                        | 확인 못 함                                                        | [만료 없음](https://www.jlpt.jp/e/faq/index.html)                                                                                          |                           |
| [HSK](https://www.hsk.or.kr/?c1=100&c2=002&c3=002&c4=001)                   | IBT 1~6급 35,000 / 50,000 / 70,000 / 90,000 / 110,000 / 130,000원 | [시험일부터 2년](https://www.chinesetest.cn/HSK/2)                                                                                         |                           |

## 생활 자격증

### 생활 필수

운전면허 비용과 주기는 [안전운전 통합민원 수수료](https://www.safedriving.or.kr/guide/rerGuide07View.do?menuCode=MN-PO-1117)와 [갱신 안내](https://www.safedriving.or.kr/guide/larGuide011.do?menuCode=MN-PO-1211) 기준이다. 학원비는 공식 고정값이 없고, 학원이 수강료를 [게시한다](https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=668&ccfNo=2&cciNo=2&cnpClsNo=1).

| 자격증                                                                          | 비용                           | 유효기간                                         | 비고                                 |
| ------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------ | ------------------------------------ |
| 1종 보통 면허                                                                   | 시험 65,000원, 면허증 10,000원 | 적성검사 10년 주기(65세 이상 5년, 75세 이상 3년) |                                      |
| 2종 보통 면허                                                                   | 시험 65,000원, 면허증 10,000원 | 갱신 10년 주기(65세 이상 5년, 75세 이상 3년)     | 지금 목표                            |
| [2종 소형 면허](https://www.safedriving.or.kr/dtGuide/selectDtGuide11.do)       | 시험 24,000원, 면허증 10,000원 | 2종과 같음                                       |                                      |
| [심폐소생술 수료증](https://www.redcross.or.kr/learn/edu/education_firstAid.do) | 20,000~40,000원                | 확인 못 함                                       | 4시간                                |
| [응급처치 수료증](https://www.redcross.or.kr/learn/edu/education_firstAid.do)   | 70,000원                       | 확인 못 함                                       | 8시간                                |
| [인명구조요원](https://www.redcross.or.kr/learn/edu/education_waterSafety.do)   | 250,000원                      | 확인 못 함                                       | 추천 목록의 "수상인명구조원". 48시간 |

### 금융·재테크

| 자격증                                                                                                                                                            | 비용                                         | 유효기간                                                                                          | 비고                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [펀드투자권유자문인력](https://license.kofia.or.kr/resources/etc/PLIO.pdf)                                                                                        | 응시료 50,000원, 필수 교육 87,000원          | [합격 유효기간 없음](https://www.kofia.or.kr/brd/m_17/view.do?seq=867). 등록 인력은 매년 보수교육 | 금액 근거는 2023년 문서                         |
| [AFPK](https://fpsbkorea.org/?mnu_usn=67&mode=view&page_no=1&data_usn=168742)                                                                                     | 응시료 66,000원, 라이선스비 110,000원 (발췌) | [인증 2년](https://www.fpsbkorea.org/?mnu_usn=53) (발췌)                                          | 금액 근거는 2024년 공지. 교육비는 기관마다 다름 |
| [공인중개사](https://q-net.or.kr/crf005.do?gId=08&gSite=L&id=crf00503s02&jmCd=9630&jmInfoDivCcd=B0&jmNm=%EA%B3%B5%EC%9D%B8%EC%A4%91%EA%B0%9C%EC%82%AC&seriesCd=8) | 1차 13,700원, 2차 14,300원                   | 확인 못 함                                                                                        |                                                 |
| [전산세무회계·전산회계 2급](https://license.kacpta.or.kr/web/info/info_diary.aspx)                                                                                | 응시료 30,000원, 발급 6,000원                | 확인 못 함                                                                                        | 표 글자가 깨져 있어 숫자 배열로 판단            |

### 취미·생활기술

| 자격증                                                                                                                                                                         | 비용                                                     | 유효기간                                                           | 비고                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------- |
| [한식조리기능사](https://www.q-net.or.kr/crf005.do?id=crf00503s02&gSite=Q&gId=&jmCd=7910&jmInfoDivCcd=B0&jmNm=%ED%95%9C%EC%8B%9D%EC%A1%B0%EB%A6%AC%EA%B8%B0%EB%8A%A5%EC%82%AC) | 필기 14,500원, 실기 26,900원                             | 확인 못 함                                                         | 기능사는 따지 않기로 함             |
| [양식조리기능사](https://www.q-net.or.kr/crf005.do?id=crf00503s02&gSite=Q&gId=&jmCd=7911&jmInfoDivCcd=B0&jmNm=%EC%96%91%EC%8B%9D%EC%A1%B0%EB%A6%AC%EA%B8%B0%EB%8A%A5%EC%82%AC) | 필기 14,500원, 실기 29,600원                             | 확인 못 함                                                         | 기능사는 따지 않기로 함             |
| [바리스타 2급(한국커피협회)](https://www.kca-coffee.org/cms/FrCon/index.do?MENU_ID=400)                                                                                        | 필기 33,000원, 실기 66,000원                             | 확인 못 함                                                         | 주관 단체가 여럿이라 단일 금액 없음 |
| [생활스포츠지도사 2급](https://sqms.kspo.or.kr/info/commisionInfo.kspo)                                                                                                        | 필기 25,000원, 실기·구술 45,000원, 연수 200,000원        | 확인 못 함                                                         |                                     |
| [PADI Open Water Diver](https://www.padi.com/education)                                                                                                                        | 온라인 이론 약 $230. 총액은 숍마다 다름                  | [만료 없음](https://blog.padi.com/do-scuba-certifications-expire/) |                                     |
| [드론 조종자 4종](https://edu.kotsa.or.kr/user/crse/CrseSeqUserList.do?_menuNo=226)                                                                                            | 교육 0원(6시간). 발급비 확인 못 함                       | 확인 못 함                                                         |                                     |
| [아마추어무선기사](https://www.cq.or.kr/qh_quagm02_005.do)                                                                                                                     | 1~3급 필기 20,000원, 발급 4,500원. 4급 교육비 확인 못 함 | 확인 못 함                                                         | 무선국 허가는 별도                  |

### 커리어 보조

| 자격증                                                                                                    | 비용                           | 유효기간                                                                                  | 비고                       |
| --------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------- |
| [컴퓨터활용능력 1급](https://license.korcham.net/co/examguide.do?mm=21&cd=0103)                           | 필기 20,500원, 실기 25,000원   | 만료 없음                                                                                 |                            |
| [워드프로세서](https://license.korcham.net/co/examguide.do?mm=22&cd=0102)                                 | 필기 19,000원, 실기 22,000원   | 만료 없음                                                                                 |                            |
| GTQ                                                                                                       | 확인 못 함                     | [합격일부터 5년, 보수교육으로 갱신](https://license.kpc.or.kr/nasec/refedu/refeduInfo.do) |                            |
| [ITQ](https://license.kpc.or.kr/nasec/qlfint/qlfint/selectItqinfotchnlgyqc.do?pageKind=announcement)      | 1과목 22,000원, 2과목 42,000원 | [합격일부터 5년, 보수교육으로 갱신](https://license.kpc.or.kr/nasec/refedu/refeduInfo.do) |                            |
| [한국사능력검정시험](https://m.historyexam.go.kr/pageLink.do?link=apyexmInfo)                             | 심화 27,000원, 기본 22,000원   | [없음](https://www.historyexam.go.kr/pst/view.do?bbs=faq&pst_sno=1000029590)              | 기관별 기한은 다를 수 있음 |
| [산업안전기사](https://www.q-net.or.kr/crf005.do?gId=07&gSite=Q&id=crf00503s02&jmCd=1431&jmInfoDivCcd=B0) | 필기 19,400원, 실기 34,600원   | 만료 없음                                                                                 |                            |

## 처음 받은 추천 목록과 달라진 점

- Azure의 AZ-204, AZ-500, AI-900, AI-102는 시험이 폐지되었다.
- Terraform Associate는 $70.50이다(목록은 $70). Docker Certified Associate는 $199다(목록은 $195).
- ISTQB Foundation은 198,000원이다(목록은 약 25만 원).
- 이 밖의 차이는 항목별로 모두 비교하지 않았다. 위 표를 기준으로 하고, 확인 못 한 값은 접수 전에 공식 사이트에서 본다.

## 확인하지 못한 값

| 항목                                                                                                                         | 남은 값   | 이유                                          |
| ---------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------- |
| 토익, JLPT, GTQ, CompTIA Security+, AZ-900, AI-901                                                                           | 응시료    | 페이지 본문을 읽지 못함                       |
| CPPG, ADsP, ADP, GitHub Foundations, Oracle Java SE OCP                                                                      | 유효기간  | 문구 없음, 읽지 못함, 또는 공식 자료끼리 충돌 |
| 심폐소생술, 응급처치, 인명구조요원, 공인중개사, 전산세무회계, 조리기능사, 바리스타, 생활스포츠지도사, 드론, 아마추어무선기사 | 유효기간  | 공식 안내에 문구 없음                         |
| 드론 발급비, 아마추어무선기사 4급 교육비, 생활스포츠지도사 발급비                                                            | 비용 일부 | 공식 안내를 찾지 못함                         |
