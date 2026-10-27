# Changelog

## v0.4.0 — 2026-10-27

- Added Drupal multi-select checkbox recognition, including distinct option names within one question.
- Added explicit single/multiple choice instructions and validated multi-answer JSON arrays.
- Apply the complete selected set, clearing incorrect preselected boxes and verifying all options before Next.
- Support mixed single/multiple choice quizzes; pause on malformed groups, duplicate or out-of-range answer IDs.
- Added regression coverage for subsets, all options, one correct checkbox, stale suggestions and single-choice behavior.

## v0.3.1 — 2026-10-23

- Standardized the userscript name to CDUTOBU VLE Evolved.
- Adopted native block typography, heading styles and link colors instead of hardcoded fonts and blue links.
- Synchronized the isolated AI panel with the native sidebar typography.
- Replaced the refresh button with an All modules-style, right-aligned text link.
- Renamed the install asset and kept the legacy update path for existing installations.

## v0.3.0 — 2026-10-23

- Added a preset DeepSeek Provider, API Key settings and text/image question input.
- Added single-question suggestions, answer adoption and opt-in continuous filling.
- Pause on uncertainty, unsupported questions, malformed responses and request failures.
- Stop before final submission and retain per-tab state across ordinary page navigation.
- Added Provider tests, local simulation fixtures and installation documentation.

## v0.2.0 — 2026-10-23

- Added current-course and Home pagination discovery, deduplication and expiry filtering.
- Adapted the independent Upcoming Quizzes panel to the observed Drupal sidebar.
