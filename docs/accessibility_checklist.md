# Accessibility Testing Checklist (WCAG 2.1 AA)

## 1. Keyboard Navigation
- [ ] All interactive elements (buttons, links, form fields) are reachable via `Tab` key.
- [ ] The focus order is logical and follows the visual reading order.
- [ ] A visible focus indicator is present for all focused elements.
- [ ] The "Skip to main content" link works correctly.
- [ ] There are no "keyboard traps" (you can tab into and out of all widgets/modals).

## 2. Screen Reader Support
- [ ] All icon-only buttons have an `aria-label`.
- [ ] Images have descriptive `alt` text. Decorative images have `alt=""`.
- [ ] Form fields have associative `<label>` elements or `aria-label`/`aria-labelledby`.
- [ ] Dynamic content changes (e.g., toast notifications, search results) are announced using `aria-live` or our `<LiveRegion>` component.
- [ ] Headings (`h1` through `h6`) are used sequentially and describe the document structure.

## 3. Video Accessibility
- [ ] The video player can be fully controlled with the keyboard.
- [ ] Closed captions/subtitles are available or there is a mechanism to provide them.
- [ ] An interactive transcript is provided for important videos.
- [ ] Keyboard shortcuts for the video player are documented and do not conflict with browser shortcuts.

## 4. Color and Contrast
- [ ] Text has a minimum contrast ratio of 4.5:1 against its background.
- [ ] Large text (18pt or 14pt bold) has a minimum contrast ratio of 3.0:1.
- [ ] Focus indicators meet the 3.0:1 contrast ratio requirement against background colors.
- [ ] Color is not the *only* visual means of conveying information, indicating an action, prompting a response, or distinguishing a visual element (e.g., error states use icons + text).

## 5. Automated and Manual Testing
- [ ] Run `axe-core` tests (e.g., using axe DevTools browser extension) and resolve all reported violations.
- [ ] Perform a manual walkthrough using VoiceOver (macOS/iOS), NVDA (Windows), or TalkBack (Android).
- [ ] Emulate vision deficiencies in browser dev tools to ensure UI remains usable.
