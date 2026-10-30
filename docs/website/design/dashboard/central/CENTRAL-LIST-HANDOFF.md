# Central Dashboard List — Shared Design Handoff

This is the canonical reference for reusable Central dashboard list styling. Central AI Voice Profiles is the visual source of truth. Prayer and future Central list pages must consume the shared implementation instead of copying local Ant Design overrides.

## Implementation source

- Shared SCSS: `src/styles/_central-dashboard-list.scss`
- Consumers include the mixins from their page-level CSS module so each page can retain only its own widths and content-specific styles.
- Current consumers:
  - `src/contents/voice/central-review.module.scss`
  - `src/contents/central/prayers/index.module.scss`

## Shared filter contract

- `filter-bar`: flex/wrapping container, minimum `73px` height, `16px` padding, `8px` gap, and Neutral-200 bottom border.
- `filter-control`: `40px` inputs/selects/date pickers, Neutral-200 border, `8px` radius, Body `14px` regular text at `150%` line height.
- `search-control`: Primary-900 `14px` prefix icon, `12px` icon-to-text gap, and consistent clear-icon states.
- `select-control`: vertically centers placeholders and selected values. It supports both Ant Design 6 (`.ant-select-content`, `.ant-select-placeholder`, `.ant-select-content-value`) and the previous selection wrapper classes.
- Searchable Ant Design 6 selects configure client filtering through `showSearch.filterOption`; do not use the deprecated top-level `filterOption` prop.
- Page modules define only control widths and control-specific behavior such as the Voice Profiles date-range calendar.

## Shared table/column contract

- Header: `34px` height, Neutral-100 background, Neutral-200 bottom border, `8px` cell padding, Body `12px` semibold Neutral-600 text.
- The second header cell uses `56px` left padding, following the Voice Profiles reference.
- Body cells: `72px` height, `16px 8px` padding, Neutral-200 bottom border, Body `12px` regular Neutral-600 text.
- First body cell receives `16px` left padding.
- Page modules own semantic cell content such as titles, avatars, status pills, and dates.

## Shared action-button contract

- Action groups are inline-flex, centered, with an `8px` gap.
- Buttons are `32px × 32px`, `8px` padding, and `4px` radius.
- Icons are `10px` with a `20px` line height.
- Neutral actions use a white background, Neutral-200 border, and Neutral-300 icon.
- Danger actions use Alert-400 for border/background with a white icon.
- Permission and disabled behavior remains page-owned; shared styling must not make an unauthorized action available.

## Shared pagination contract

- Summary stays left; page controls align right. Mobile centers the controls and puts the summary on its own row.
- Every page, previous, next, and jump control is `32px × 32px`, with an `8px` radius and centered content.
- Text/icons use Body `12px` semibold at `150%` line height.
- Default controls are white with Neutral-200 borders and Neutral-600 content.
- Active page uses Primary-500 with white text; active hover uses Primary-300.
- Inactive hover uses a Primary-500 border/content and Neutral-100 background.
- Disabled controls use Neutral-200 content/border, remain opaque, and do not accept pointer input.
- Color, border, and background transitions use `200ms ease`.

## Usage rule

When adding or changing a Central list page, update the shared SCSS and this handoff first for behavior common to Voice Profiles, Prayer, or future lists. Keep only truly page-specific dimensions and semantic styling in the consumer module. Do not reintroduce copied pagination or Ant Select internals in page-level styles.
