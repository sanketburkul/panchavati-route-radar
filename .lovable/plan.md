# KumbhPath AI — Panchavati navigation

## What to build
Replace the blank home screen with a usable, map-first Nashik Kumbh Mela guide. The screen will center on real Panchavati streets, show key pilgrimage sites and a current-location marker, and display community congestion reports with a clear low-to-high legend. A compact, responsive left-side panel will provide destination search/selection, place shortcuts, directions, report congestion, emergency assistance, and a volunteer review view.

Directions will show a road-following recommended route and alternatives with distance, estimated time, and reported congestion. Reporting will capture the current position when available, allow an intensity choice, and confirm successful submission. Volunteer mode will summarize reports and allow a report to be marked verified. Search, place selection, map controls, route selection, report submission, volunteer controls, and emergency contact will have real UI behavior rather than dead buttons.

## Technical approach
- Use Leaflet with OpenStreetMap street tiles and real Panchavati coordinates; avoid drawing fictional roads. Load browser-only map code after hydration so the page remains safe to render on the server.
- Use a public, no-paid-key road-routing service for road-following route geometry; provide a usable message if routing or location is unavailable.
- Enable Lovable Cloud for shared community reports, RLS-protected public report access, and live map refreshes. Include clearly identified starter sample reports, keep reporter identity private, and permit verification only through a protected volunteer mechanism rather than an unrestricted public action.
- Keep the first experience at `/`, use the existing design system with a crisp light GIS palette, and set app-specific metadata for every content route.

## Technical details
- Add Leaflet and its React bindings; dynamically load the map to avoid SSR browser-global access.
- Create a constrained community-report schema and policies, explicitly grant allowed Data API roles, seed the starter reports in the schema migration, and enable table change notifications.
- Validate the home view, interactions, viewport behavior, and project build after implementation.
