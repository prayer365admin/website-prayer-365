# Central Admin Prayer — Design Handoff

This document is the implementation reference for the Central Admin Prayer list and editor. The confirmed Central AI Voice Profiles design is the baseline for shared dashboard typography, spacing, table treatment, filters, status pills, and pagination.

Shared list styling is governed by `../CENTRAL-LIST-HANDOFF.md` and implemented in `src/styles/_central-dashboard-list.scss`. Prayer must consume that shared contract for filter controls, table columns/rows, action buttons, and pagination; this file records only Prayer-specific differences.

Reference images:

- `prayer-list.png`
- `details/prayer-details-a.png`
- `details/prayer-details-b.png`
- `details/prayer-details-c.png`
- `details/prayer-details-text-drawer.png`

## Prayer list

### Page header

- Title: `Prayers`, using the same display typography as Central Voice Profiles.
- Subtitle: `Prayers from every church. Open one to review, publish or manage its audio.`
- Header actions align right on desktop and stack below the title on narrow screens.
- `New Prayer` uses the shared solid button at size `md` with a leading plus icon, then applies the list-specific `123px × 40px` frame, `10px 12px 10px 8px` padding, `8px` gap/radius, Primary-500 background, `#005FFF` border, and Body `14px` semibold white label.
- `New Prayer` always opens `/dashboard/central/prayers/new`; it must not depend on the list's Church filter.

### Content container and filters

- White container with `16px` radius and clipped overflow.
- Filter row: minimum `73px` height, `16px` padding, `8px` gap, and Neutral-200 bottom border.
- Filter order: Search Prayer, All Church, All Status.
- Search: `280px × 40px` desktop reference, prefix search icon, `12px` icon-to-text gap.
- Church: `240px × 40px` desktop reference.
- Status: `123px × 40px` desktop reference.
- Church and status placeholders, option labels, and selected values use the Voice Profiles dropdown typography: Body, `14px`, regular, `150%` line height.
- Church and status placeholder/selected-value containers are vertically centered within the `40px` control, including the Ant Design 6 content wrapper.
- The church filter loads the caller's authorized churches using the API-supported `100`-row limit, ordered by name. Do not send empty `limit` or `page` values.
- All controls become full width on narrow screens.

### Table

- Preserve the global dashboard numbering requirement. The `No.` value is `(page - 1) * pageSize + rowIndex + 1`.
- Columns: No., Title, Church, Status, Published at, Actions.
- Header: Neutral-100 background, `34px` height, `12px` semibold text.
- Rows: `72px` shared reference height, `16px 8px` cell padding, Neutral-200 bottom border.
- Title: `14px`, semibold, Primary-900.
- Default cell text: `12px`, regular, Neutral-600.
- Published dates use the stable `day month year` English format; drafts display an em dash.

### Status pills

- Pills fit their content, use `28px` height, `4px 10px` padding, `8px` internal gap, and fully rounded corners.
- Published: Positive-100 background, Positive-200 border, Positive-700 text/dot.
- Draft: Neutral-100 background, Neutral-200 border, Neutral-400 text/dot.
- Scheduled: Primary-100 background, Primary-200 border, Primary-700 text/dot.

### Actions and safety

- Actions follow the design order: history, edit, delete. Each uses a `32px × 32px` button with an `8px` gap.
- Edit is enabled and opens the prayer editor.
- History and delete remain visibly disabled, with explanatory tooltips, until corresponding authorized and audited backend endpoints exist. Do not fake either operation in client state.
- History and edit use outlined neutral buttons. Delete uses Alert-400 with a white icon.

### Central create and edit context

- My Church prayer routes inherit their church from the URL/header and do not add a Church field.
- Central creation has no header church context, so `/dashboard/central/prayers/new` shows the complete prayer form immediately with Church as its first required field, populated only from the current user's authorized church relationships.
- Church-dependent fields remain visible but disabled until Church is selected. Changing the selected church remounts and clears Pastor, language, featured image, and other scoped editor state.
- Central editing stays under `/dashboard/central/prayers/:prayerId` and shows Church as read-only. Existing prayers cannot be moved between churches through ordinary editing.
- The Central wrapper resolves the prayer's church through a centrally scoped read endpoint. Creation and all mutations continue to use church-scoped APIs with server-side permission enforcement.

### Pagination

- Use the shared Central list pagination contract from `../CENTRAL-LIST-HANDOFF.md`; do not add page-local pagination overrides.
- URL-backed page and page-size state.
- No page-size selector in this design.
- Summary aligns left; controls align right.
- Buttons are `32px × 32px`, centered, with Neutral-200 borders and `8px` radius.
- Active page uses Primary-500 with white text.
- Disabled controls use Neutral-200.

## Prayer editor

### Header and tabs

- White rounded page shell.
- Header contains the `40px × 40px` Primary-100 back button, `Prayer title *` label, and the current prayer title using the display heading style.
- Tabs sit in a Primary-150 (`#E6EDFB`) rounded track. Active tab uses a white rounded surface.
- Tabs are `Text` and `Audio & Publication`.

### Text tab

- Form content sits in a white, Neutral-200 bordered panel with `8px` radius and `16px` padding.
- Standard form controls use Ant Design `size="large"` for Church, Title, Pastor, Content language, Publication date, Time, and Time zone. Shared Prayer editor CSS enforces `48px` height, `12px` internal gap, `8px` radius, `1px #737C8C` Neutral-500 border, white background, and `12px 8px 12px 16px` padding. In this control context, `Scale/400` resolves to `12px`; using `16px` vertical padding leaves only `14px` of content height and clips the required `21px` text line.
- Publication date uses a `20px` Calendar prefix and publication time uses a `20px` Clock prefix. Set each picker's `suffixIcon` to `null` so no duplicate trailing icon appears.
- Form-control text uses Body, `14px`, regular, `150%` line height, zero letter spacing, and Neutral-800 `#393E46`. This applies to current values and placeholders, including disabled display values.
- The `large` prop controls geometry only. Explicitly override Ant's `.ant-input-lg`, `.ant-select-lg`, and `.ant-picker-large` typography to `14px`; do not inherit Ant's larger default text size.
- Church, Pastor, and Content language selects carry the shared `prayer-form-select` class. Apply the same geometry and typography directly to Ant Design 6's select root/content as well as the legacy selector/selection wrappers so select inputs never fall back to Ant defaults.
- Preserve title, featured image, introduction, pastor, content language, and full prayer text fields; these are part of the working data model even where a static reference crop does not show every field.
- Footer actions align right: Upload text and Save text. Both use the shared button at `size="md"` with trailing `20px` icons: Upload uses the outlined variant with an upload icon, while Save uses the solid variant with a check icon. Text review must not be exposed from the Text tab.
- Preserve validation, immutable prayer-version creation, and featured image behavior.

### Editor loading state

- The edit-page skeleton must preserve the real editor hierarchy instead of rendering generic paragraph lines: header title, two-tab strip, bordered Text form, labeled 48px inputs, 320px × 180px featured-image area, introduction editor, two-column Pastor/language row, full prayer editor, and two right-aligned medium action buttons.
- Use the same container spacing, borders, radii, and responsive behavior as the loaded editor. On narrow screens, the two-column field row and action buttons stack to one column.
- Keep the skeleton lightweight: use compact static Neutral-200 surfaces rather than separate animated layers for every label and field. Preserve the hierarchy and relative control shapes without reproducing the loaded form's full vertical height. Keep the active tab placeholder white against the Primary-150 tab background.

### Review text drawer

- Review opens only from the Review text step in the Audio & Publication tab, using a right-side drawer matching `prayer-details-text-drawer.png`.
- Drawer size: `640px` desktop reference, supplied through Ant Design 6's `size` prop rather than the deprecated `width` prop.
- The drawer panel is inset `24px` from the viewport's top, right, and bottom edges. Its content wrapper and surface use a `16px` radius with clipped overflow; the mask remains full-screen.
- Drawer header, body, and footer use `16px` internal padding instead of Ant's `24px` default.
- Place the built-in close control at the right/end of the drawer header using Ant Design 6's `closable={{ placement: 'end' }}` API.
- The drawer close button is `32px × 32px`, with `8px` padding/gap, `8px` radius, full opacity, and a `1px solid` Neutral-200 (`#DDE0E4`) border.
- Content includes Title, Introduction, Full prayer text, Pastor, Content language, and Version.
- When approval metadata is present, show it as a full-width positive banner with an approval icon, Positive-200 background, Positive-700 text, `8px` radius, and `8px 12px` padding. Show the approving user's display name; never expose the raw user ID in the drawer.
- Review fields use `20px` vertical spacing. Each field uses an `8px` label-to-value gap. Labels are Body `14px` semibold at `150%`; values are Body `14px` regular at `150%`; both use Neutral-800 (`#393E46`) with zero letter spacing.
- Footer keeps Cancel left and Approve text for audio right. Both actions use the shared `size="md"` button treatment; Cancel is outlined, while Approve is solid with a trailing `20px` check icon.
- Preserve the existing text-approval concurrency checks.

### Audio & Publication tab

- Uses bordered step cards for Audio generation, Audio Review, and Publication.
- Every Audio & Publication card header and body uses `16px` horizontal padding. Preserve each card's existing vertical padding.
- Every actionable button inside Audio & Publication uses the shared `size="md"` button. Primary operations remain solid; secondary/retry/view operations use the outlined variant.
- Audio & Publication button icons are trailing and `20px`: View reviewed text uses the code-native Align Left icon translated from `public/icons/Icon-align-left.svg`; Generate audio, Generate again, and Approve audio use the reusable Play icon; Schedule publication uses Ant Design's full Calendar icon for a larger visible glyph; Publish now uses the Check icon.
- Explicit Prayer editor action and picker icons use the shared `.editorIcon` treatment: a fixed `20px × 20px` wrapper with the SVG glyph capped at `17.5px` width and `20px` height. Keep SVG dimensions automatic within those maxima to preserve aspect ratio.
- Audio generation contains two equal status panels on desktop: Review text and Pastor voice. Each panel uses a Neutral-100 header, semantic status pill, and action body; stack them on narrow screens.
- Preserve text-approval and verified-voice gates before audio generation.
- Generated audio uses the shared reusable waveform player, not native browser audio controls.
- Preserve provider-missing recovery, audio approval, timezone-aware scheduling, immediate publishing, and already-published safeguards.

## Responsive behavior

- The list filters and header actions stack on narrow screens.
- The editor keeps its header hierarchy and converts footer action groups to full-width stacked controls.
- Do not remove permission checks, loading states, confirmation/review steps, or concurrency tokens to achieve visual parity.
