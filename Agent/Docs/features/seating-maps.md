# Seating Maps Feature

## Overview

The Seating Maps feature allows event organizers to create visual venue layouts with interactive seat selection. It consists of a canvas-based builder for creating seat maps and APIs for managing seat configurations per event.

### Current Status

| Component | Status |
|-----------|--------|
| Database schema | Complete |
| Seat map CRUD APIs | Complete |
| Event seating config APIs | Complete |
| Visual builder (web) | Complete |
| Tutorial/onboarding | Complete |
| Customer seat picker | Not started |
| Real-time availability | Not started |
| Checkout integration | Not started |

---

## Feature Architecture

### Database Schema (8 tables, 5 enums)

```
venue_seat_maps        - Master seat map definitions
├── seat_sections      - Logical sections within a map
│   └── seat_rows      - Rows of seats within sections
│       └── seats      - Individual seat positions
├── event_seat_configurations - Links maps to events
│   └── seat_holds     - Temporary seat reservations
│       └── seat_pricing_tiers - Price levels per section
└── seat_assignments   - Final seat purchases
```

**Key Tables:**

| Table | Purpose |
|-------|---------|
| `venue_seat_maps` | Stores map metadata and full `map_data` JSON |
| `seat_sections` | Normalized section data for queries |
| `seat_rows` | Normalized row data |
| `seats` | Individual seat records |
| `event_seat_configurations` | Links a map to an event with settings |
| `seat_holds` | Temporary reservations during checkout |
| `seat_pricing_tiers` | Section-based pricing levels |
| `seat_assignments` | Purchased seat records |

**Enums:**
- `seat_hold_status`: active, expired, converted, released
- `seating_mode`: quantity, zone, individual
- `seat_type`: standard, wheelchair, companion, restricted_view, premium

### Data Flow

```
Builder → SeatMapData (JSON) → venue_seat_maps.map_data
                                      ↓
                              event_seat_configurations
                                      ↓
                              Customer picker (TODO)
```

---

## API Endpoints

### Seat Maps (`/api/seat-maps/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/seat-maps` | List user's maps + public templates |
| POST | `/api/seat-maps` | Create new map |
| GET | `/api/seat-maps/[id]` | Get single map with linked event count |
| PUT | `/api/seat-maps/[id]` | Update map (recalculates capacity) |
| DELETE | `/api/seat-maps/[id]` | Delete map (fails if linked to events) |

**Example: Create Map**
```typescript
POST /api/seat-maps
{
  "name": "Main Hall",
  "map_data": {
    "version": 1,
    "canvas": { "width": 1200, "height": 800, "backgroundColor": "#1a1a2e" },
    "sections": [...],
    "venue": {...}
  }
}
```

### Event Seating (`/api/events/[id]/seating`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events/[id]/seating` | Get event's seating config + map |
| POST | `/api/events/[id]/seating` | Link/update seat map to event |
| DELETE | `/api/events/[id]/seating` | Unlink seat map from event |

**Example: Link Map to Event**
```typescript
POST /api/events/123/seating
{
  "seat_map_id": 45,
  "seating_mode": "individual",
  "hold_duration_minutes": 10
}
```

---

## Builder Component Architecture

### File Structure

```
client/components/seating/
├── builder/
│   ├── SeatMapBuilder.tsx      # Main builder (910 lines)
│   ├── BuilderToolbar.tsx      # Tool selection bar
│   ├── DrawingPreview.tsx      # Live preview while drawing
│   ├── PropertyPanel.tsx       # Section property editor
│   ├── TutorialModal.tsx       # First-time user tutorial
│   └── VenuePresetSelector.tsx # Preset venue shapes
├── canvas/
│   └── SeatMapCanvas.tsx       # SVG canvas with pan/zoom
├── rendering/
│   ├── VenueShape.tsx          # Venue boundary + stage
│   └── SectionShape.tsx        # Section + rows + seats
└── shared/seating/
    ├── types.ts                # TypeScript types (293 lines)
    ├── geometry.ts             # Path calculations
    └── grid.ts                 # Grid/snap utilities
```

### State Management

```typescript
// client/stores/seatMapBuilderStore.ts (1,287 lines)
interface SeatMapBuilderState {
  // Map data
  mapData: SeatMapData;
  mapId: number | null;
  isDirty: boolean;

  // Builder state
  activeTool: BuilderTool;
  selection: SelectionState;

  // Viewport
  zoom: number;
  panX: number;
  panY: number;

  // Grid
  gridConfig: GridConfig;

  // History (undo/redo)
  history: { past: SeatMapData[]; future: SeatMapData[] };

  // Drawing state
  drawingPreview: DrawingPreview | null;
}
```

### Available Tools

| Tool | Shortcut | Description |
|------|----------|-------------|
| Select | V | Select/move elements |
| Venue Polygon | P | Draw venue boundary |
| Stage | T | Draw stage rectangle |
| Section | S | Draw seating section |
| Straight Row | R | Draw row of seats |
| Eraser | E | Select for deletion |
| Curved Row | C | Draw curved row (Advanced) |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V, P, S, R, E | Switch tools |
| Enter | Complete polygon |
| Escape | Cancel drawing |
| Delete/Backspace | Delete selected |
| G | Toggle grid |
| Ctrl/Cmd+Z | Undo |
| Ctrl/Cmd+Shift+Z | Redo |

---

## Screen Locations

### Seat Map Library
**Route:** `/seat-maps/`
**File:** `app/(app)/(drawer)/seat-maps/index.tsx`

Lists user's seat maps with:
- Create New button → `/seat-maps/new`
- Edit button → `/seat-maps/[id]`
- Delete button (with confirmation)
- Empty state for no maps

### Seat Map Builder
**Route:** `/seat-maps/[id]` or `/seat-maps/new`
**File:** `app/(app)/(drawer)/seat-maps/[id].tsx`

Full-screen canvas builder with:
- Toolbar for tools and actions
- Property panel for section editing
- Tutorial modal (first visit)
- Save/Close actions

### Event Seating Config
**Route:** `/events/[id]/seating`
**File:** `app/(app)/(drawer)/events/[id]/seating.tsx`

Event-specific seating configuration:
- Create New Map → opens inline builder
- Use Existing Map → modal picker
- Edit Map → opens inline builder
- Remove → unlinks map from event

---

## TypeScript Types

### Core Types

```typescript
// shared/seating/types.ts

interface SeatMapData {
  version: number;
  canvas: { width: number; height: number; backgroundColor: string };
  venue?: VenueShape;
  sections: SectionData[];
  annotations?: Annotation[];
}

interface VenueShape {
  type: 'preset' | 'custom' | 'polygon';
  boundaryPath: string;        // SVG path
  boundaryPoints?: Point[];    // For manipulation
  stageArea?: StageConfig;
}

interface SectionData {
  id: string;
  name: string;
  type: 'seated' | 'standing' | 'table' | 'accessible';
  boundaryPath?: string;
  boundaryPoints?: Point[];
  color: string;
  rows: RowData[];
  centroid?: Point;
}

interface RowData {
  id: string;
  label: string;
  type: 'straight' | 'curved';
  seats: SeatData[];
}

interface SeatData {
  id: string;
  label: string;
  x: number;
  y: number;
  type: 'standard' | 'wheelchair' | 'companion' | 'restricted_view' | 'premium';
  isAvailable: boolean;
}
```

---

## Demo Testing Checklist

### Pre-Demo Verification

- [ ] Start dev server: `bun run dev:local`
- [ ] Login as test user
- [ ] Navigate to `/seat-maps/`

### Library Screen (`/seat-maps/`)

- [ ] Empty state shows when no maps exist
- [ ] "Create New" button navigates to `/seat-maps/new`
- [ ] Existing maps display with name and seat count
- [ ] Edit button opens builder
- [ ] Delete shows confirmation and removes map

### Builder Flow (`/seat-maps/new`)

1. **Initial State**
   - [ ] Tutorial modal appears on first visit
   - [ ] Toolbar shows all core tools
   - [ ] Canvas is empty with grid visible

2. **Venue Tool (P)**
   - [ ] Click places polygon points
   - [ ] Point count shows in instructions
   - [ ] Cursor near start shows closing indicator
   - [ ] Click near start OR press Enter closes polygon
   - [ ] Venue shape appears with fill

3. **Stage Tool (T)**
   - [ ] Click and drag creates rectangle
   - [ ] Release creates stage with "STAGE" label
   - [ ] Stage appears with teal color

4. **Section Tool (S)**
   - [ ] Click and drag creates section rectangle
   - [ ] Auto-named (Section A, B, C...)
   - [ ] Auto-colored from palette
   - [ ] Section shows in property panel when selected

5. **Row Tool (R)**
   - [ ] Must click inside a section
   - [ ] Drag creates row with seats
   - [ ] Seat count shown during drag
   - [ ] Release creates row with labeled seats

6. **Select Tool (V)**
   - [ ] Click selects sections/rows/seats
   - [ ] Selected elements show highlight
   - [ ] Drag selected element moves it
   - [ ] Property panel shows for sections

7. **Eraser Tool (E)**
   - [ ] Click selects element
   - [ ] Press Delete removes it

8. **History**
   - [ ] Ctrl/Cmd+Z undoes last action
   - [ ] Ctrl/Cmd+Shift+Z redoes
   - [ ] Toolbar buttons enable/disable correctly

9. **Grid Controls**
   - [ ] G toggles grid visibility
   - [ ] Snap toggle affects element placement

10. **Save**
    - [ ] Save button enabled when dirty
    - [ ] Save persists map to database
    - [ ] Reload shows saved data correctly
    - [ ] Capacity auto-calculated from seats

### Event Seating (`/events/[id]/seating`)

- [ ] No Seating state shows create/link options
- [ ] Create New opens inline builder
- [ ] Use Existing shows map picker modal
- [ ] Linked map shows with Edit/Change/Remove
- [ ] Edit opens builder with map data loaded
- [ ] Remove unlinks (doesn't delete map)

### Advanced Features

- [ ] Advanced toggle reveals Curved Row tool
- [ ] Property panel allows section name/color edit
- [ ] Help button opens tutorial modal

---

## Known Limitations

### Current Limitations

1. **Web-only builder** - The builder is intentionally web-only due to canvas complexity. Native apps show a placeholder.

2. **No customer picker** - Seat selection during checkout is not yet implemented.

3. **No real-time updates** - Seat availability is not real-time; relies on holds expiring.

4. **No seat holds API** - The `seat_holds` table exists but hold/release APIs are not implemented.

5. **Single map per event** - Events can only have one seat map linked at a time.

### Future Work

- [ ] Customer-facing seat picker component
- [ ] Seat hold/release API endpoints
- [ ] Real-time availability via Supabase subscriptions
- [ ] Seat selection during checkout flow
- [ ] Section-based pricing integration
- [ ] Accessibility seat filtering
- [ ] Mobile-friendly map viewer (read-only)
- [ ] Map templates/cloning
- [ ] Multi-select in builder

---

## Demo Script

### Recommended Demo Flow

**1. Start at Seat Map Library** (`/seat-maps/`)
> "Here's where organizers manage their venue layouts. Let's create a new one."

**2. Create New Map** → Click "Create New"
> "The builder opens with a helpful tutorial for first-time users."

**3. Draw Venue** → Use Venue Polygon tool
> "First, I'll outline the venue boundary. Click to place points, Enter to complete."

**4. Add Stage** → Use Stage tool
> "Drag to create the stage area where performers will be."

**5. Create Sections** → Use Section tool
> "Now I'll create seating sections. They auto-name and color themselves."

**6. Add Rows** → Use Row tool inside sections
> "Inside each section, I drag to create rows. Seats are auto-generated based on length."

**7. Adjust Layout** → Use Select tool to move
> "I can select and drag elements to fine-tune the layout."

**8. Save** → Click Save button
> "Saving calculates total capacity and persists to the database."

**9. Link to Event** → Navigate to `/events/[id]/seating`
> "Finally, I link this map to a specific event for ticket sales."

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Builder won't load | Check browser console, ensure web platform |
| Can't draw inside section | Verify section boundaries are closed |
| Row creates no seats | Row may be too short (min ~30px) |
| Save fails | Check network tab, verify auth |
| Map doesn't load | Verify map ID exists and user owns it |
| Undo not working | Ensure focus is on canvas (not input) |

---

## Related Files

| File | Lines | Purpose |
|------|-------|---------|
| `client/components/seating/builder/SeatMapBuilder.tsx` | 910 | Main builder component |
| `client/stores/seatMapBuilderStore.ts` | 1,287 | Zustand state management |
| `shared/seating/types.ts` | 293 | TypeScript definitions |
| `app/api/seat-maps/index+api.ts` | 120 | List/create API |
| `app/api/seat-maps/[id]+api.ts` | 228 | CRUD API |
| `app/api/events/[id]/seating+api.ts` | 228 | Event config API |
| `app/(app)/(drawer)/seat-maps/index.tsx` | 428 | Library screen |
| `app/(app)/(drawer)/seat-maps/[id].tsx` | 220 | Builder screen |
| `app/(app)/(drawer)/events/[id]/seating.tsx` | 570 | Event seating screen |
