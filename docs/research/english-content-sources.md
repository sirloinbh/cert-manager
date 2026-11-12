# Sources of English study material and how to fetch them

- Issue: [#31](https://github.com/sirloinbh/cert-manager/issues/31)
- Surveyed: 2026-10-30 (Asia/Seoul). The numbers below (rate limits, word counts, and so on) are the values confirmed in official documents on that day, and they may change.
- Feature issues that follow this document: [#35](https://github.com/sirloinbh/cert-manager/issues/35) viewing pop song lyrics, [#36](https://github.com/sirloinbh/cert-manager/issues/36) word list and etymology, [#37](https://github.com/sirloinbh/cert-manager/issues/37) word of the day

## Conclusion

The lyrics source, the translation method, and the song scope were decided by the user on 2026-10-30 (comment on #31).

| Target                | Method decided                                                                                                                                         | Decision       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| Original lyrics       | Do not use YouTube Music. Fetch once per song from the LRCLIB API and store in the local DB, and paste in songs that are not found by hand             | User decision  |
| Lyrics translation    | The user pastes it on the screen or imports a translation file. The app does not call the Claude API                                                   | Changed in #35 |
| "All songs" scope     | Start with the base tracks of the 12 regular albums and the From the Vault songs of the 4 Taylor's Version albums                                      | User decision  |
| Song list             | Fetch the list of albums and tracks from the MusicBrainz API                                                                                           | Recommended    |
| Frequently used words | Download NGSL 1.2 (2,809 words) from the official site                                                                                                 | Recommended    |
| Etymology             | Based on the Wiktionary etymology text (the kaikki.org extract), split into prefix, root, and suffix in a Claude Code session and explain it in Korean | Recommended    |
| Where to store        | Keep original lyrics and translations only in the local DB and `.local/`. Do not commit them to the repository                                         | Required rule  |

## 1. Original lyrics

### YouTube Music: not used

- YouTube Music has no official API that provides lyrics.
- The unofficial library `ytmusicapi` (Python) has `get_lyrics()`. But this library works by imitating web browser requests.
- The YouTube Terms of Service forbid "accessing the Service using automated means (such as robots, botnets, or scrapers)". The only exceptions are public search engines that follow robots.txt and prior written approval from YouTube.
- This project is Node.js, so a Python tool would have to be brought in.
- So we take the "if that does not work" path of the user requirement.

### Comparison of other lyrics sources

| Source                       | Full lyrics                                               | API key      | Terms and limits                                                                    | Judgment                          |
| ---------------------------- | --------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------- | --------------------------------- |
| YouTube Music (`ytmusicapi`) | Available                                                 | Login cookie | An unofficial method, and the YouTube terms forbid automated access                 | Not used                          |
| Genius API                   | Not provided. Gives only song info and web page addresses | Required     | You would have to scrape the web page to get lyrics                                 | Not used                          |
| Musixmatch API               | The free tier gives only about 30% of the lyrics          | Required     | Full lyrics need a commercial contract (price not public)                           | Not used                          |
| **LRCLIB**                   | Available (plain and time-synced lyrics)                  | Not needed   | A free public service. You must follow the rate limit. No license notice for lyrics | **Used**                          |
| Paste by hand                | The user enters them                                      | None         | No external service. A lot of manual work if there are many songs                   | Used only for songs not in LRCLIB |

The limits of Genius and Musixmatch are what I confirmed from developer posts and an API listing site, not from the official terms. Since neither is used, I did not check further.

### LRCLIB

[LRCLIB](https://lrclib.net/docs) is a free public lyrics database.

- No API key is needed.
- Find the lyrics of one song with `GET /api/get`. It returns time-synced lyrics (`syncedLyrics`) and plain lyrics (`plainLyrics`).
  - Required values: `track_name`, `artist_name`
  - Optional values: `album_name`, `duration` (seconds, 1 to 3600). They improve match accuracy, so fill them with the values fetched from MusicBrainz.
  - It returns `404` if it cannot find the song.
- The rate limit is about 45 requests per minute per IP. If you send a `User-Agent` that contains the app name and a contact, it is about 90 requests per minute.
- Send requests one at a time with 700 ms between requests (an interval that does not exceed about 90 requests per minute; changed from 200-500 ms in #64). On a `429` response, wait for `Retry-After`.
- The docs have no license notice for the lyrics data. The copyright of the lyrics is treated as belonging to the original author.
- For songs that are not found, let the user paste them in by hand on the screen.

### Copyright and storage rules

The following are operating rules this project follows to reduce risk, not a judgment that it is legally allowed.

- Original lyrics and their translations are copyrighted works. This repository is public, so committing lyrics or translations would publish them.
- Store lyrics and translations only in the local DB. Keep files for translation work in `.local/`, and backup files go to `backups/`. Both folders are in `.gitignore`.
- Only the user sees the lyrics. Before the app is made public, put the lyrics screen behind private access or authentication (a precondition for going public in the #25 service scope).
- Tests use only short sentences written by hand.

## 2. Lyrics translation

**Changed 2026-10-31 (#35):** "Translate in a Claude Code session" in the table and the steps below cannot be done. Claude Code does not copy or translate full copyrighted lyrics. Filling in the translation file is done by the user or with another translation tool, and it is loaded with the export and import scripts (#64) and by pasting on the screen. The text below is kept as a record of the comparison at the time. The real usage is in the [#64 change record](../changes/64-lyrics-scripts.md).

| Method                                                               | Advantages                                                               | Disadvantages                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Call the Claude API every time the screen opens                      | Can be seen right away                                                   | The same song is translated many times, so the cost keeps going. Needs an API key |
| Translate once with the Claude API when importing and store it       | Handles a lot automatically                                              | Needs an API key and a registry setting                                           |
| **Translate in a Claude Code session and put it in (user decision)** | No API key or extra cost. The translation can be refined in conversation | If there are many songs, it has to be done in several batches                     |

Order of the chosen method:

1. The export script exports the lyrics of songs without a translation, with line numbers, to `.local/translations/<song ID>.json`.
2. In a Claude Code session, read that file and fill the same file with a Korean translation that has the same number of lines.
3. The import script checks that the line counts match and saves it to the DB line by line. If the line counts differ, it does not save and reports it.

- Work album by album. Check progress with whether a song is "translated" in the DB.
- This method sends the lyrics to Claude Code (Anthropic). The app does not call an external API directly, but it is the same in that the lyrics are passed to a third-party service.
- The app does not use the Claude API, so leave `features.claude` in the central registry turned off.

## 3. Song list and the "all songs" scope

### Source of the song list: MusicBrainz

- Fetch artist → album (release group) → track list from the [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API) API.
- The core data (artist, album, and song names) is CC0 (public domain), so the song list may be stored and published.
- The rate limit is 1 request per second on average per IP, and a `User-Agent` that identifies the app is required.

### Scope (user decision)

Taylor Swift has 12 regular albums (as of 2026-10). The last is _The Life of a Showgirl_, released on 2025-10-03.

1. Base edition tracks of the 12 regular albums: _Taylor Swift_, _Fearless_, _Speak Now_, _Red_, _1989_, _reputation_, _Lover_, _folklore_, _evermore_, _Midnights_, _The Tortured Poets Department_, _The Life of a Showgirl_
2. Only the From the Vault songs of the 4 Taylor's Version albums (_Fearless_, _Red_, _Speak Now_, _1989_). Re-recorded songs mostly have the same lyrics as the originals, so they are not included. For songs whose lyrics changed (for example "Better than Revenge" in _Speak Now (Taylor's Version)_), use the original lyrics and write the changed lines in the song note.
3. Deluxe edition bonus tracks and single and soundtrack songs are postponed to phase 2.

If the same song is on several albums, store it as one song and link several albums that include it.

## 4. Frequently used words

Use [NGSL (New General Service List) 1.2](https://www.newgeneralservicelist.com/new-general-service-list).

- It is 2,809 core words of general, everyday English for English learners.
- The license is CC BY-SA 4.0. You must credit the source (Browne, Culligan, Phillips), and if you distribute a modified list, you must follow the same license.
- The official site says `newgeneralservicelist.com` is its only site. Download only from there.
- Download the version with frequency statistics (`NGSL_12_stats.csv`, confirmed 2,809 words on 2026-11-01) and store the frequency rank. As a trace of passing through a spreadsheet, `TRUE` and `FALSE` are uppercase, so fix them to lowercase.
- Create the Korean meanings and examples in a Claude Code session and store them (unlike lyrics, this is not copying copyrighted text), and mark them as AI-generated values. Proceed in batches from the most frequent words.

## 5. Etymology

- The source is the English etymology text in Wiktionary. Download the JSON data (wiktextract) that [kaikki.org](https://kaikki.org/) extracted from the Wiktionary dump, one file per word, one at a time at 1 second intervals (#36). The full file is 3.2 GB and is marked as scheduled for removal.
- The license of Wiktionary text is CC BY-SA. kaikki.org has no license notice (confirmed 2026-11-01), so record CC BY-SA 4.0 from the Wiktionary copyright page.
- Wiktionary etymology is prose, not split into prefix, root, and suffix. In a Claude Code session, split it into parts based on the etymology text and explain it in Korean. Leave a word with no source text as "no etymology data" and do not make anything up.
- Show the source (a Wiktionary link) and whether it was organized by AI on the screen.

## 6. Common rules

- A script that fetches external material keeps the downloaded originals outside the repository (the local DB or `.local/`). Store the source URL and the fetch date together.
- Only the song list (CC0) and the script code may go into the public repository. To put NGSL or Wiktionary material in the repository you must include the CC BY-SA notice, so do not include it at first.

## Sources

- [ytmusicapi docs](https://ytmusicapi.readthedocs.io/en/stable/)
- [YouTube Terms of Service](https://www.youtube.com/static?template=terms)
- [LRCLIB API docs](https://lrclib.net/docs)
- A record that the Genius API does not provide lyrics: [Getting Song Lyrics from Genius’s API + Scraping](https://bigishdata.com/2016/09/27/getting-song-lyrics-from-geniuss-api-scraping/)
- Musixmatch free tier 30% limit: [Musixmatch API (API listing)](https://freeapihub.com/apis/musixmatch)
- [MusicBrainz API rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
- [NGSL 1.2](https://www.newgeneralservicelist.com/new-general-service-list)
- [kaikki.org](https://kaikki.org/)
