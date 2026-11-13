# #70 Fill in word meanings, examples, and etymology

- Issue: [#70](https://github.com/sirloinbh/cert-manager/issues/70)
- Branch: `docs/70-word-fill-record`

## Purpose

Fill in the Korean meanings, examples, and etymology parts of the 2,809 words in the word list. The filled values exist only in this PC's `cert` DB and in `.local/`, and are not put in the repository. This document records only the process and the result.

## Result: 2026-11-01

| Item                                            | Value |
| ----------------------------------------------- | ----: |
| All words                                       | 2,809 |
| Words with meaning, part of speech, and example | 2,809 |
| Words with etymology parts                      | 1,107 |
| Distinct etymology parts                        | 1,168 |
| No etymology data                               |     7 |

The 7 words with no etymology data (favorite, labor, neighbor, portion, exam, humor, catalog) have no etymology parts. Every word is shown on the screen as "AI 정리" ("organized by AI").

## How it was done

1. I filled the sample of ranks 1 to 50, and the user approved the quality.
2. I split the rest into batches of 190 to 200 words and had a separate agent fill them. I passed only the first 450 characters of the first entry of the etymology text.
3. I checked the results with a script, removed etymology parts with weak evidence, and then put them in with `npm run words:fill -w backend`.

## Etymology part judgments

I put in parts only when the source text or its direct etymology split the word. I did not put in the following.

- Splits of reconstructed forms (`*`), splits written as guesses such as "perhaps", truncated splits, and splits with only one part
- In all, 30 words: here, through, hear, either, and others that were decided to be removed in the review of the first 1,000 words, and video, tool, phase, and others in the later batches. When the first 1,000 words were filled, the rules were looser and they went through this review, and the later batches were filled with narrower rules.

A part with the same name uses the meaning saved first. For the 13 whose meanings differ, I split the names, as in `suffix:s:plural` and `prefix:im:in`. Similar meanings were merged even when the wording differed.

## Verification

- DB lookup: 2,809 in total, 2,809 with meaning, 0 missing part of speech or example, 0 etymology parts on words with no data.
- File check: all 2,759 words have the same input and order, and passed the field length and the check that the example contains the headword (I checked by eye 1 example where an inflected form was used, as in `bound`).
- I checked the content only by sample. I read the meanings and examples of about 120 words and found no problems. For the etymology parts, I checked the format and the supporting phrase with a script, and skimmed only part of the list up to rank 2,050 by eye. I did not read the parts list of the last 759 words. I did not compare word by word with the original text.

## Limits and follow-up

- The meanings and examples are AI-written values, and the sample approval was received for the first 50 words. Wrong values may remain.
- The meaning explanations of the etymology parts were written by the agent when they were not in the source text. For the same reason, some may be wrong.
- If you make another PC or DB new, you have to put them in again from the files in `.local/word-batches/imported/`.
