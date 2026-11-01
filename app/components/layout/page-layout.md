# Route page layouts

`ViewportPage` fills the available app height and contains overflow. Its content must provide its own scrolling, as tables, calendars and member panels do.

`ScrollPage` grows with its content. The app page scrolls, and `RouteHeader` stays above the content.

Both accept `header`, `children`, `className` and `contentClassName`. The header and content share a column with no gap. The content has its own column with spacing between sections. Use `RouteHeader` for main route headers and `PageHeading` for standalone headings outside a route layout.

The workspace shell follows the visual viewport and keeps document scrolling locked when the onscreen keyboard opens. Scrolling stays inside the route's page or content area, according to its layout preference.

```tsx
<ScrollPage header={<RouteHeader title="Services" actions={<AddService />} />}>
  <ServiceList />
</ScrollPage>
```

Set the route's `handle.pageLayout` to `"viewport"` or `"scroll"` so the app shell uses the same sizing. `"viewport-desktop"` uses `ViewportPage` on desktop and `ScrollPage` on mobile. Resolve this preference with `resolvePageLayout` when choosing the component, as the calendar route does.

Pass `mobileControls` to `RouteHeader` for a mobile-only control row. This row exists in the server render, so loading does not move controls between the header and content. Pass `controls` for controls used at all screen sizes.
