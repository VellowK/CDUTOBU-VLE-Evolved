# Changelog

## v0.4.3 — 2026-11-03

- Join checkbox/radio and option-text highlights by removing cell spacing in the suggested answer table and matching internal border colors.
- Restore native table layout when suggestions are cleared, without changing checked answers.
- Publish the separate automatic answering controls and yellow suggestions from local builds v0.4.1/v0.4.2.

## v0.4.2 — 2026-11-03 (local build, included in v0.4.3)

- Highlight every suggested option row in yellow after single-question solving, without selecting or navigating.
- Clear old highlights when solving again or when the question changes or disappears; preserve native backgrounds by removing only the script's class.
- Keep manual review for uncertain suggestions and leave all rows unhighlighted when the model abstains.

## v0.4.1 — 2026-11-03 (local build, included in v0.4.3)

- Expose a prominent, separate 自动答题 button alongside 解答当前题目; explain their different behavior.
- Lock solve/apply/restart controls while automatic answering or navigation is active; keep Stop available.
- Show automatic progress and wait through temporary form removal during AJAX navigation, with the existing timeout and Finish boundary preserved.
- Add local AJAX and failed-navigation scenarios and verify full-page continuation, mixed choice types, pause and stop behavior.

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
