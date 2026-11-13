# Grade systems by certification

- Issue: [#51](https://github.com/sirloinbh/cert-manager/issues/51)
- Checked: 2026-10-31
- Source of the values the app uses: `backend/src/grade-scales.ts`

"Grade" means a level inside a certification (score band, level, stage, or license type) (confirmed by the user).

## TOEIC (Listening and Reading)

TOEIC has no pass or fail and no official grade. This uses the minimum scores for the CEFR mapping that ETS published. The minimum total is the sum of the listening and reading minimums.

| Grade | Listening minimum | Reading minimum | Total minimum | App band |
| ----- | ----------------- | --------------- | ------------- | -------- |
| C1    | 490               | 455             | 945           | 945~990  |
| B2    | 400               | 385             | 785           | 785~944  |
| B1    | 275               | 275             | 550           | 550~784  |
| A2    | 110               | 115             | 225           | 225~549  |
| A1    | 60                | 60              | 120           | 120~224  |

- Source: [ETS TOEIC CEFR mapping table](https://www.ets.org/pdfs/toeic/toeic-mapping-cefr-reference.pdf)
- Limit: ETS advises not to use these values as strict criteria and to look at listening and reading separately. The app takes only the total score, so it uses them only as reference grades based on the total. I could not open the PDF text myself and checked it with the table quoted in search results.

## TOEIC Speaking

Since the regular exam on June 4, 2022, a grade based on ACTFL is shown together.

| Grade       | Score   |
| ----------- | ------- |
| AH          | 200     |
| AM          | 180~190 |
| AL          | 160~170 |
| IH          | 140~150 |
| IM3·IM2·IM1 | 110~130 |
| IL          | 90~100  |
| NH          | 60~80   |
| NM/NL       | 0~50    |

- Source: [Korea TOEIC Committee TOEIC Story](https://www.toeicstory.co.kr/2607), [TOEIC Speaking official site levels and scores](https://www.toeicswt.co.kr/common/template/viewContents.php?contentsCode=78)
- Limit: I could not confirm the score ranges for IM1 to IM3 in official sources. The official comparison table is an image, so I could not read it. Unofficial sources (Namuwiki, blogs) list IM1=110, IM2=120, IM3=130, but some of their content does not agree with each other, so I did not use them. For 110 to 130 points, the app lets the user choose among the three. I could not read the official site text directly with a tool and checked it with search results, and I read the TOEIC Story text and confirmed the IM ranges.
- A score from before the revision, such as `Level 7`, can stay as it is in the grade of an attempt record.

## Information processing (national technical qualification)

The grades in the technology and skills field have five levels: Master Craftsman, Craftsman Master (Gineung-jang), Engineer, Industrial Engineer, and Craftsman. Only the levels that exist in the information processing field are included.

| Grade                 | Applicable exams                                                     |
| --------------------- | -------------------------------------------------------------------- |
| Professional Engineer | Professional Engineer Information Management and others              |
| Engineer              | Engineer Information Processing                                      |
| Industrial Engineer   | Industrial Engineer Information Processing                           |
| Craftsman             | Programming Craftsman (Craftsman Information Processing before 2026) |

- Source: [National Technical Qualification Act grade provision (Wikisource, No. 10339)](<https://ko.wikisource.org/wiki/%EA%B5%AD%EA%B0%80%EA%B8%B0%EC%88%A0%EC%9E%90%EA%B2%A9%EB%B2%95_(%EC%A0%9C10339%ED%98%B8)>), Q-Net [Engineer Information Processing](https://www.q-net.or.kr/crf005.do?id=crf00503&jmCd=1320) · [Industrial Engineer Information Processing](https://www.q-net.or.kr/crf005.do?id=crf00503&jmCd=2290) · [Professional Engineer Information Management](https://q-net.or.kr/crf005.do?gSite=Q&id=crf00503&jmCd=0601), [Engineer and Industrial Engineer exam schedule](https://q-net.or.kr/crf021.do?scheType=03)
- Limit: I confirmed the grade provision in an old edition (No. 10339). I could not open the text of the current law directly. I confirmed the Craftsman name change with search results that quote a Q-Net notice. Eligibility to apply differs by grade, so check it with the Q-Net self-check before you apply.

## AWS

| Grade        | Applicable certification (goals in this app)                   |
| ------------ | -------------------------------------------------------------- |
| Foundational | Cloud Practitioner                                             |
| Associate    | Solutions Architect – Associate                                |
| Professional | A higher level that suggests 2 or more years of AWS experience |
| Specialty    | A specific technology field. A separate field, not a level     |

- Source: [AWS Certification](https://aws.amazon.com/certification/)
- Limit: The same page also has a Business category that includes beta exams, but it is unrelated to the current goals, so I did not include it. The app does not compare Specialty with the other levels.

## Driver's license

These are license types, not levels, so they are not compared as higher or lower. It counts as goal achieved only when you get the same type.

| Class   | Type                                                                              |
| ------- | --------------------------------------------------------------------------------- |
| Class 1 | Large, Regular, Small, Special (large tow truck, small tow truck, rescue vehicle) |
| Class 2 | Regular, Small, Motorized bicycle                                                 |

- Source: [Public Data Portal National Police Agency driver's license data description](https://www.data.go.kr/biz/dcat/metadata/15160156.do)
- Limit: I could not open the original text of Annex 18 of the Enforcement Rule of the Road Traffic Act.
