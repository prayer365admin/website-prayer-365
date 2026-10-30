# Dashboard Layout — Design Handoff

This document is the implementation reference for the shared authenticated dashboard shell. Reference images in this directory are `Aside.png` and `Masthead.png`.

## Desktop scrolling contract

- The dashboard shell is locked to the viewport using `100vh` with a `100dvh` override.
- The document, outer Ant Layout, left navigation, masthead, and footer must not participate in page scrolling.
- The main content region is the only vertical scroll container. It uses `min-height: 0`, `overflow-y: auto`, contained overscroll, and a stable scrollbar gutter.
- The left navigation is sticky at `top: 0`, occupies the full viewport height, and clips its outer surface.
- The navigation menu may scroll inside its existing `.menuScroll` region when its items exceed available sidebar height. The brand and sync status remain visible.
- The main column is viewport-height, `min-height: 0`, and overflow-hidden so content cannot expand the document.
- The masthead and footer remain fixed in the shell as non-scrolling siblings of the content region.

## Mobile behavior

- At `760px` and below, the desktop sidebar remains hidden and navigation uses the existing left Drawer.
- The main content remains the vertical scroll container.
- Opening or closing the mobile Drawer must not change desktop sidebar collapsed state or introduce document scrolling.

## Implementation source

- Shell: `src/components/container/dashboard/index.tsx`
- Shell sizing/scroll ownership: `src/components/container/dashboard/index.module.scss`
- Desktop sidebar and mobile drawer: `src/components/container/dashboard/sider/index.tsx`
- Sidebar sizing/internal menu scroll: `src/components/container/dashboard/sider/index.module.scss`
