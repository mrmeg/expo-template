# Terlo Design System — Figma AI Reference

## Brand & Aesthetic
- **App:** Terlo — local event discovery platform for Terre Haute, Indiana
- **Style:** Luma-inspired restraint. Clean, minimal, confident.
- **Font:** Inter only. No serif fonts. Ever.
- **NO:** gradients on surfaces, glow shadows, blur circles, entrance animations, decorative backgrounds, scale animations on hover

---

## Colors

### Light Theme
| Token | Hex | Usage |
|-------|-----|-------|
| background | #faf9f7 | Page background (warm off-white) |
| card | #f3f1ee | Card surfaces, alternate section bg |
| text | #1c1917 | Primary text (warm dark) |
| textDim | #78716c | Secondary/muted text |
| primary | #292524 | Dark buttons, emphasis |
| primaryForeground | #faf9f7 | Text on primary buttons |
| accent | #14b8a6 | Teal accent, links, highlights |
| muted | #e7e5e0 | Muted backgrounds |
| mutedForeground | #78716c | Text on muted |
| border | #e7e5e0 | Borders, dividers |
| destructive | #FF5252 | Error/danger |
| success | #4CAF50 | Success |
| warning | #F59E0B | Warning |

### Dark Theme
| Token | Hex | Usage |
|-------|-----|-------|
| background | #111110 | Page background |
| card | #1c1b19 | Card surfaces |
| text | #e8e6e3 | Primary text |
| textDim | rgba(255,255,255,0.55) | Secondary text |
| primary | #e8e6e3 | Light buttons (inverted) |
| primaryForeground | #111110 | Text on primary |
| accent | #2dd4bf | Teal accent (brighter) |
| border | rgba(255,255,255,0.08) | Borders |

### Raw Palette
- Teal: #2dd4bf, #14b8a6, #0d9488
- Light neutrals: #faf9f7, #f3f1ee, #e7e5e0, #dbd8d3, #78716c, #1c1917
- Dark neutrals: #111110, #1c1b19, #242220, #3d3a37, #a8a29e, #e8e6e3

### Category Colors
Music (#92400E/#FEF3C7), Food (#7F1D1D/#FEE2E2), Arts (#312E81/#E0E7FF), Sports (#065F46/#D1FAE5), Nightlife (#9F1239/#FFE4E6), Community (#1E3A5F/#DBEAFE)

---

## Typography

| Role | Size | Weight | Letter Spacing | Line Height |
|------|------|--------|---------------|-------------|
| Hero Title | 36-52px | 800 (ExtraBold) | -1.5px | 44-60px |
| Section Title | 28-36px | 800 | -1px | 34px |
| Card Title | 18-22px | 700 (Bold) | -0.3px | 28px |
| Subtitle | 16-17px | 400 (Regular) | 0 | 26px |
| Body | 15px | 400 | 0 | 24px |
| Button Text | 15px | 600 (SemiBold) | 0 | 20px |
| Metadata | 13px | 500 (Medium) | 0 | 18px |
| Caption/Label | 11-12px | 600 | 0.5-1px | 16px |

---

## Spacing (8px base grid)

| Token | Value |
|-------|-------|
| xxs | 2px |
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 32px |
| xxl | 48px |
| xxxl | 64px |

**Layout:** gutter 16px, screenPadding 16px, sectionSpacing 24px
**Sections:** 48px vertical mobile / 64px desktop
**Hero:** 56px top mobile / 80px desktop

### Border Radius
| Token | Value |
|-------|-------|
| xs | 4px |
| sm | 6px |
| md | 8px |
| lg | 12px |
| xl | 12px |
| full | 9999px (pill) |

---

## Components

### Button
**Presets:**
- `default` — teal bg (#14b8a6), light text. Primary action.
- `secondary` — dark bg (#292524), light text. Strong emphasis.
- `outline` — transparent, 1px border, dark text. Secondary action.
- `ghost` — transparent, no border. Tertiary.
- `destructive` — red bg, white text.

**Sizes:** sm (32px/12px), md (36px/14px), lg (44px/16px)
**States:** loading (spinner), disabled (0.6 opacity), pressed (0.9 opacity, 0.97 scale)

### Card
**Variants:** default (card bg + border), outline (transparent + border), ghost (transparent)
**Sub-parts:** CardHeader, CardTitle (18px semibold), CardContent, CardFooter
**Interactive:** onPress adds 0.98 scale press effect
**Standard style:** bg card, borderRadius 12px, 1px border, padding 12px

### Badge
**Variants:** default (primary bg), secondary, outline (border only), destructive, warning
**Shape:** Pill (radiusFull), 10px horizontal padding
**Optional:** icon prop (Feather icon, 12px, left of text)
**Text:** 12px, weight 500

### TextInput
**Variants:** outline (border), filled (bottom border + card bg), underlined (bottom border only)
**Sizes:** sm (32px), md (36px), lg (40px)
**Features:** label, required asterisk, error state (red border + message), helper text, password toggle, left/right icon slots

### Pill (Filter Chip)
**States:** inactive (card bg + border), active (primary bg + primary text)
**Sizes:** small (12px), medium (13px)
**Optional:** icon, remove icon (x-circle, active only)

### Switch
**Variants:** default (primary color), ios (#34C759 green)
**Size:** 44×24px track, 20px thumb
**Animation:** thumb slides, 120ms

### Toggle / ToggleGroup
**Variants:** default (transparent, pressed → 10% primary bg), outline (border, pressed → primary bg)
**Sizes:** sm (32px), default (36px), lg (40px)

### Accordion
**Pattern:** Accordion > AccordionItem > AccordionTrigger + AccordionContent
**Style:** bottom border per item, chevron rotates 180° on expand
**Trigger:** row, space-between, padding md vertical

### EmptyState
**Structure:** icon (48px) → title (18px semibold) → description (14px, max-width 280px) → action button
**Centered column layout, padding xxl vertical**

### Skeleton
**Sub-components:** Skeleton (rectangle), SkeletonText (N lines), SkeletonAvatar (circle), SkeletonCard (image + avatar + text)
**Animation:** pulsing opacity, respects reduced-motion

---

## Screen Patterns

### Navigation
- **Mobile:** Bottom tab bar (56px + safe area). 3 tabs: Featured, Explore, My Events. Active = teal.
- **Desktop:** Permanent sidebar (240px width)
- **Mobile header:** Scroll-to-hide animated header (56px, translateY animation)

### Every Screen Handles 3 States
1. **Loading:** Skeleton placeholders matching content layout
2. **Empty:** EmptyState component with icon + message + optional CTA
3. **Error:** ErrorBoundary with retry button

### Responsive
- Single breakpoint: **width >= 1024px** = large screen
- Mobile-first flexbox layout
- MaxWidthContainer for web (default 1536px)

---

## Key UI Patterns

### Event Card (list variant)
- Image (full width, ~180px height)
- Category badge (pill, category colors)
- Title (17-18px bold)
- Date + time (metadata style)
- Location (14px dim)
- Price pill or "Free" badge

### Featured Hero Card
- Desktop: side-by-side (55% image, info right)
- Mobile: full-bleed image with dark scrim overlay, white text on top
- Title 22-28px, date/time/location metadata

### Detail Hero Screen
- Parallax hero image (250px default)
- Content card overlaps hero by 30px
- borderTopRadius 24px on content
- Sticky header on scroll

### Profile/Settings
- Card-based sections
- Modal overlays for edit flows
- Avatar + info header
