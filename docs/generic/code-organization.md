# Components and library folders

Group files by the feature or shared responsibility they belong to. Keep rendering and UI interactions in `app/components`, and reusable logic, hooks, data, and service integrations in `app/lib`. Routes compose these modules and provide route state.

## Feature and shared folders

Create feature folders for product-specific components and logic. Keep shared concerns such as forms, overlays, data display, layout, navigation, auth, localization, query caching, and tRPC separate from individual features.

Feature-specific hooks and types stay beside their components. Components used across routes belong in a shared component folder. Compositions of UI primitives belong in `app/components`, rather than `app/components/ui`.

The current product's folders are listed in the [Jupiter code map](../jupiter/code-map.md). Use that inventory for this app; adapt feature folders when deriving another product from the template.

See [page layouts](../../app/components/layout/page-layout.md) for shared layout conventions.

Keep `.server.ts` suffixes on server-only modules. Client components must not import runtime server modules. Type-only imports remain appropriate where needed. Database access belongs behind tRPC server code; route loaders should use the tRPC caller rather than importing Prisma directly.

## Root files required by UI primitives

UI primitives and their shared popup styles, server-rendered popups, icon map, class-name utility, hydration hook, and drawer coordination live in `app/components/ui`. Import these modules directly from there.

Toast managers live in the toast component, and overlay state hooks live in `app/components/ui/overlays`. Application-specific toast behavior and other application utilities remain in `app/lib`.

## Adding and importing files

1. Choose an existing feature folder first. Keep a hook or type used by one feature beside that feature.
2. Put components shared across routes in a shared component folder, such as `forms/`, `overlays/`, or `data-display/`.
3. Put shared non-rendering logic in the relevant library folder. Add a new folder when it represents a distinct responsibility.
4. Import the module directly using its full path. Follow neighboring files for alias or relative import style; avoid catch-all barrel exports that mix client and server modules.
5. When moving a file, update route, server, script, test, build-plugin, and documentation references, including dynamic imports and `ssrLoadModule` paths.

```tsx
import { AppForm } from "~/components/forms/app-form"
import FormLabel from "~/components/forms/form-label"
import { ResponsiveModal } from "~/components/overlays/responsive-modal"
import { formatDateTime } from "~/lib/localization/format-preference"
import { useAppContext } from "~/lib/hooks/use-app-context"
```

Use RVF through `AppForm` and `FormLabel`, and tRPC with TanStack Query for mutations. React Router loaders handle route and app state. See [data handling](data-handling.md) for details.

After reorganizing modules, run `npm run typecheck`, the relevant existing tests, and `npm run build`. Confirm that `git diff -- app/components/ui` is empty when the UI primitives are outside the scope of the change.
