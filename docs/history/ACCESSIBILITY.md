# Accessibility Check and Compliance (WCAG 2.1 AA)

## 1. Keyboard Navigation
- All interactive elements (buttons, links, form fields) are reachable via `Tab` key.
- The focus order is logical and follows the visual reading order.
- A visible focus indicator is present for all focused elements.
- The "Skip to main content" link works correctly.

## 2. Screen Reader Support
- All icon-only buttons have an `aria-label`.
- Images have descriptive `alt` text.
- Dynamic content changes (e.g., toast notifications, search results) are announced using `aria-live` or our `<LiveRegion>` component.

## 3. Video Accessibility
- The video player can be fully controlled with the keyboard.
- Closed captions/subtitles supported via `<track>` elements.
- Interactive transcript functionality provided for comprehensive courses.

## 4. Color and Contrast
- Text has a minimum contrast ratio of 4.5:1 against its background.
- Focus indicators meet the 3.0:1 contrast ratio requirement against background colors.
- Color alone is not used to convey information.

## 5. Automated Testing
- Axe-core tests are integrated into developer workflows.
