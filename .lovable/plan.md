

## UI Resize & Spacing Refinement Plan

Pure CSS/Tailwind class changes only — no logic, no data fetching, no backend changes.

### Changes

**1. `src/components/DashboardLayout.tsx`**
- Expand main content max-width from `max-w-6xl` to `max-w-7xl`
- Increase padding: `p-6 lg:p-10`

**2. `src/pages/Dashboard.tsx`**
- Stat cards grid: `md:grid-cols-3` → `md:grid-cols-2 lg:grid-cols-3`
- Increase spacing between sections from `space-y-8` to `space-y-10`
- Quick action cards: add `lg:grid-cols-2` with larger padding

**3. `src/pages/Recommendations.tsx`**
- Resource cards grid: `md:grid-cols-2` → `md:grid-cols-2 lg:grid-cols-3`

**4. `src/pages/Quiz.tsx`**
- Widen quiz container if it has a narrow max-width

**5. `src/pages/admin/AdminPanel.tsx`**
- No logic changes, just ensure tabs content uses full available width

### Files modified
- `src/components/DashboardLayout.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Recommendations.tsx`
- `src/pages/Quiz.tsx`

All changes are Tailwind class adjustments only.

