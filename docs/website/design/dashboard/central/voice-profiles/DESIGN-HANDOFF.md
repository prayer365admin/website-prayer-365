# Central Voice Profiles — Design Handoff

This document is the implementation reference for the Dashboard Central Voice Profiles page. Keep future development consistent with these dimensions, typography, spacing, colors, and component states.

Voice Profiles remains the visual source of truth for the reusable Central list contract documented in `../CENTRAL-LIST-HANDOFF.md` and implemented in `src/styles/_central-dashboard-list.scss`. Shared filter, table/column, action-button, and pagination changes belong there rather than in page-local overrides.

Reference images in this directory:

- `full-voice-profiles.png`
- `header-voice-profiles.png`
- `search-filters-voice-profiles.png`
- `table-voice-profiles.png`
- `pagination-voice-profiles.png`
- `details/full-voice-profile-detail.png`
- `details/header-voice-profile-detail.png`
- `details/left-col-voice-profile-detail.png`
- `details/right-col-voice-profile-detail.png`

## Page structure

The page is composed of:

1. Page header: title and subtitle.
2. A 16 px gap between the header and the filter/table container.
3. Filter bar.
4. Data table.
5. Pagination footer.

The filter bar, table, and pagination are parts of the same content container and align to the same 1184 px reference width.

## Header

### Title

| Property           | Value                                |
| ------------------ | ------------------------------------ |
| Font family        | `Fonts/Display`                      |
| Font weight        | `600`                                |
| Font style         | `SemiBold`                           |
| Font size          | `Scale/600`                          |
| Leading trim       | `NONE`                               |
| Line height        | `100%`                               |
| Letter spacing     | `-1px`                               |
| Vertical alignment | `middle`                             |
| Text color         | `var(--Colors-Primary-900, #0E203E)` |

### Subtitle

| Property           | Value                                |
| ------------------ | ------------------------------------ |
| Font family        | `Fonts/Body`                         |
| Font weight        | `400`                                |
| Font style         | `Regular`                            |
| Font size          | `14px`                               |
| Leading trim       | `NONE`                               |
| Line height        | `150%`                               |
| Letter spacing     | `0px`                                |
| Vertical alignment | `middle`                             |
| Text color         | `var(--Colors-Neutral-600, #5C6370)` |

The vertical gap between the header block and the filter container is `16px`.

## Filter bar

### Container

| Property             | Value                                          |
| -------------------- | ---------------------------------------------- |
| Reference width      | `1184px`                                       |
| Height               | `73px`                                         |
| Padding              | `Scale/400`                                    |
| Gap between controls | `8px`                                          |
| Border bottom        | `1px solid var(--Colors-Neutral-200, #DDE0E4)` |
| Opacity              | `1`                                            |
| Rotation             | `0deg`                                         |

### Controls

| Control              |     Width | Height | Maximum width | Internal gap |
| -------------------- | --------: | -----: | ------------: | -----------: |
| Search               |   `280px` | `40px` |       `280px` |        `4px` |
| Admin Review         |   `151px` | `40px` |       `280px` |        `4px` |
| Registration         |   `141px` | `40px` |       `280px` |        `4px` |
| Published date range | `355.5px` | `40px` |             — |        `8px` |

All controls use `opacity: 1` and `transform: rotate(0deg)`. Maintain an `8px` horizontal gap between adjacent filter controls.

The Published date-range control additionally uses:

```css
border: 1px solid var(--Colors-Neutral-200, #dde0e4);
border-radius: 8px;
```

## Table

### Header row

| Property           | Value                                |
| ------------------ | ------------------------------------ |
| Reference width    | `1184px`                             |
| Height             | `34px`                               |
| Horizontal padding | `0 8px`                              |
| Border bottom      | `1px`                                |
| Background         | `var(--Colors-Neutral-100, #F9FAFB)` |
| Opacity            | `1`                                  |
| Rotation           | `0deg`                               |

### Header cell

Column widths vary according to their content. The `504px` width below is a design reference for the wide Pastor/Church column, not a fixed width for every column.

| Property        | Value                      |
| --------------- | -------------------------- |
| Reference width | `504px` (varies by column) |
| Height          | `34px`                     |
| Gap             | `8px`                      |
| Padding         | `8px 8px 8px 56px`         |
| Opacity         | `1`                        |
| Rotation        | `0deg`                     |

Header-cell text:

| Property           | Value                                |
| ------------------ | ------------------------------------ |
| Font family        | `Fonts/Body`                         |
| Font weight        | `600`                                |
| Font style         | `SemiBold`                           |
| Font size          | `12px`                               |
| Leading trim       | `NONE`                               |
| Line height        | `150%`                               |
| Letter spacing     | `0px`                                |
| Vertical alignment | `middle`                             |
| Text color         | `var(--Colors-Neutral-600, #5C6370)` |

### Body row

| Property           | Value                                          |
| ------------------ | ---------------------------------------------- |
| Reference width    | `1184px`                                       |
| Height             | `73px`                                         |
| Horizontal padding | `0 8px`                                        |
| Border bottom      | `1px solid var(--Colors-Neutral-200, #DDE0E4)` |
| Opacity            | `1`                                            |
| Rotation           | `0deg`                                         |

### Body cell

| Property        | Value                                   |
| --------------- | --------------------------------------- |
| Reference width | `504px` for the wide Pastor/Church cell |
| Height          | `72px`                                  |
| Gap             | `8px`                                   |
| Padding         | `16px 8px`                              |
| Opacity         | `1`                                     |
| Rotation        | `0deg`                                  |

### Pastor image

| Property      | Value  |
| ------------- | ------ |
| Width         | `40px` |
| Height        | `40px` |
| Gap           | `8px`  |
| Border radius | `56px` |
| Opacity       | `1`    |
| Rotation      | `0deg` |

### Pastor/Church text

Primary title:

| Property           | Value        |
| ------------------ | ------------ |
| Font family        | `Fonts/Body` |
| Font weight        | `600`        |
| Font style         | `SemiBold`   |
| Font size          | `14px`       |
| Leading trim       | `NONE`       |
| Line height        | `150%`       |
| Letter spacing     | `0px`        |
| Vertical alignment | `middle`     |

Secondary Pastor/Church text:

| Property           | Value        |
| ------------------ | ------------ |
| Font family        | `Fonts/Body` |
| Font weight        | `400`        |
| Font style         | `Regular`    |
| Font size          | `12px`       |
| Leading trim       | `NONE`       |
| Line height        | `150%`       |
| Letter spacing     | `0px`        |
| Vertical alignment | `middle`     |

## Review status pills

### Approved

| Property      | Value                                           |
| ------------- | ----------------------------------------------- |
| Width         | `89px`                                          |
| Height        | `28px`                                          |
| Padding       | `4px 10px`                                      |
| Border radius | `9999px`                                        |
| Border        | `1px solid var(--Colors-Positive-200, #D3FAEF)` |
| Background    | `var(--Colors-Positive-100, #EDFDF9)`           |
| Opacity       | `1`                                             |
| Rotation      | `0deg`                                          |

Approved text:

| Property           | Value                                 |
| ------------------ | ------------------------------------- |
| Font family        | `Fonts/Body`                          |
| Font weight        | `600`                                 |
| Font style         | `SemiBold`                            |
| Font size          | `12px`                                |
| Leading trim       | `NONE`                                |
| Line height        | `150%`                                |
| Letter spacing     | `0px`                                 |
| Vertical alignment | `middle`                              |
| Text color         | `var(--Colors-Positive-700, #09A97C)` |

### Pending

Use the same dimensions, padding, radius, and typography as the Approved pill, with these state colors:

| Property   | Value                                       |
| ---------- | ------------------------------------------- |
| Border     | `1px solid var(--Colors-Warm-200, #FBEEC6)` |
| Text color | `var(--Colors-Warm-600, #D8A50E)`           |

Use the matching warm semantic background token from the design system when available. Do not introduce an arbitrary hard-coded background color if the token is missing.

## Action buttons

Both actions are `32px × 32px`, use an `8px` internal icon size/gap reference, `8px` padding, and a `4px` border radius.

### Edit

```css
width: 32px;
height: 32px;
padding: 8px;
border-radius: 4px;
background: #ffffff;
border: 1px solid var(--Colors-Neutral-200, #dde0e4);
```

### Delete/Disable

```css
width: 32px;
height: 32px;
padding: 8px;
border-radius: 4px;
background: var(--Colors-Alert-400, #e54c4c);
border: 1px solid var(--Colors-Alert-400, #e54c4c);
```

The delete/disable icon is white. In application behavior, this action disables a voice profile; it must not hard-delete profile data.

## Pagination

### Left-side summary

| Property           | Value                                |
| ------------------ | ------------------------------------ |
| Font family        | `Fonts/Body`                         |
| Font weight        | `400`                                |
| Font style         | `Regular`                            |
| Font size          | `12px`                               |
| Leading trim       | `NONE`                               |
| Line height        | `150%`                               |
| Letter spacing     | `0px`                                |
| Vertical alignment | `middle`                             |
| Text color         | `var(--Colors-Neutral-400, #8F96A3)` |

### Page buttons

| Property      | Value                                          |
| ------------- | ---------------------------------------------- |
| Width         | `32px`                                         |
| Height        | `32px`                                         |
| Gap           | `8px`                                          |
| Padding       | `7px 14px 9px`                                 |
| Border radius | `Borders/Radius/sm`                            |
| Border        | `1px solid var(--Colors-Neutral-200, #DDE0E4)` |
| Background    | `#FFFFFF`                                      |
| Opacity       | `1`                                            |
| Rotation      | `0deg`                                         |

Page-button text:

| Property       | Value                                |
| -------------- | ------------------------------------ |
| Font family    | `Fonts/Body`                         |
| Font weight    | `600`                                |
| Font style     | `SemiBold`                           |
| Font size      | `12px`                               |
| Leading trim   | `NONE`                               |
| Line height    | `150%`                               |
| Letter spacing | `0px`                                |
| Text color     | `var(--Colors-Neutral-600, #5C6370)` |

## Implementation notes

- Values described as `background` for text in the source design notes are documented here as `color`; they represent text color tokens.
- Pixel widths are desktop reference dimensions. Preserve the component hierarchy, spacing, and visual weight on narrower screens while allowing controls and columns to respond to available space.
- Keep an `8px` gap between filter controls and between related inline elements.
- Keep table header and body content aligned even where individual column widths vary.
- Reuse existing design-system tokens and shared components before introducing page-specific hard-coded styles.
- Preserve permission checks and the confirmation step for the disable action.

## Voice profile detail page

This section records the reviewed implementation decisions for the Central Voice Profile detail page. Apply future corrections incrementally and do not replace already-confirmed sections with inferred styling.

### Header

The current detail-page header is confirmed correct. Preserve its structure, typography, back button, submitted date, church name, spacing, border, and background unless a later handoff explicitly changes one of those properties.

### Detail columns container

The container around the left and right columns uses the same white background as the confirmed header:

```css
background: #ffffff;
```

### Left column — voice sample waveform

The dashboard voice player is a reusable shared component. It is used on both Central Voice Profile details and the pastor-facing My Voice page.

| Property                                | Confirmed value               |
| --------------------------------------- | ----------------------------- |
| Maximum waveform-bar height             | `40px`                        |
| Gap between individual waveform bars    | `6px`                         |
| Gap from waveform container to controls | `8px`                         |
| Play icon component box                 | `20px × 20px`                 |
| Pause icon rendered size                | `11px × 20px`                 |
| Download icon component box             | `20px × 20px`                 |
| Pause asset                             | `/icons/icon-pause.svg`       |
| Play asset                              | `/icons/icon-play-button.svg` |

Play and pause use the same button dimensions and alignment. Do not substitute a font icon for the supplied pause asset.

The pause SVG is translated into the reusable Ant Design icon structure from `src/components/icon/_template.tsx` and exposed as `PauseIcon` from `src/components/icon/pause.tsx`. Use this component in JSX; do not render the pause asset through `next/image` or a raw `<img>` element.

The play and download SVGs follow the same component structure and are exposed as `PlayIcon` and `DownloadIcon`. Render both at `fontSize: 20` inside their existing `32px × 32px` controls. This removes the intrinsic whitespace/size mismatch that made the play and download artwork appear smaller than pause. Do not render these two assets through `next/image`.

The playback-rate fast-forward SVG is exposed as `FastForwardIcon` from `src/components/icon/fast-forward.tsx`. Render it at `fontSize: 12` and allow it to inherit the rate button's color through `currentColor`; do not render it through `next/image`.

### Left column — registration

The successful registration banner uses:

```css
background: var(--Colors-Positive-200, #d3faef);
```

In code, use the equivalent project token `var(--color-positive-200, #D3FAEF)`.

### Left column — Offline authorization

The `View evidence` action uses the shared site button system at design size `xs`, matching the Voice Controls actions. Use `siteButtonClassName({ size: 'xs', variant: 'outlined', asLink: true })` for its link form, add the scoped detail `xs` dimensions below, and preserve its arrow icon.

### Left column — Voice Controls

- The section title is exactly `Voice Controls`.
- Both actions use the shared `SiteButton` component with `size="xs"` and `variant="outlined"`, plus the scoped detail-page `xs` dimensions below. The shared component supplies transitions, focus state, and disabled behavior.
- Apply the scoped alert border/text treatment to Voice Controls; on hover, use the alert background with white text.
- Both actions are text-only; do not add icons.
- Keep each button content-fit while the controls are in one horizontal row. The measured `122px` width is an example for content that produces that width, not a fixed width for every `xs` button. When the responsive layout changes Voice Controls to one column, stack the buttons and make each button `width: 100%`.
- Preserve the existing permission checks, confirmation dialogs, loading states, and danger treatment.

Confirmed detail-page `xs` button geometry:

| Property      | Value                                          |
| ------------- | ---------------------------------------------- |
| Width         | `fit-content` (`122px` was a measured example) |
| Height        | `32px`                                         |
| Padding       | `7px 14px 9px`                                 |
| Internal gap  | `8px`                                          |
| Border radius | `Borders/Radius/sm` (`8px` implementation)     |
| Border width  | `1px`                                          |
| Opacity       | `1`                                            |
| Rotation      | `0deg`                                         |

Horizontal buttons size naturally from their label, icon, gap, and padding. The existing one-column responsive rule expands Voice Controls buttons to `width: 100%`.

### Detail loading skeleton

The loading state must mimic the confirmed detail-page structure instead of displaying a generic paragraph skeleton:

- Keep the confirmed header and back button in place.
- Use header skeleton lines for the submitted metadata and pastor name.
- Preserve the two-column grid at desktop widths and the same responsive single-column behavior.
- The left skeleton card includes two waveform-player placeholders, Offline authorization, Registration, and Voice Controls sections.
- Waveform placeholders preserve the confirmed `40px` bar height, `6px` bar gap, and `8px` waveform-to-controls gap.
- The right skeleton card includes the Submission status heading and two timeline-track placeholders.
- Skeleton cards, section headings, borders, padding, and radii must match the loaded layout so content does not visibly jump when data arrives.
