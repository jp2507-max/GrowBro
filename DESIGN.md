# Design System: GrowBro Production

**Project ID:** 2092860482060459766

## 1. Visual Theme & Atmosphere

GrowBro embodies a **"Modern Organic Tech"** aesthetic—a premium, immersive dark-mode experience that evokes the tranquility of a moonlit greenhouse. The atmosphere is **deep, lush, and breathing**, with generous negative space allowing content to "grow" naturally without feeling crowded.

### Mood Keywords

- **Immersive & Enveloping**: Deep forest charcoal backgrounds create a cozy, focused growing environment
- **Premium Apothecary**: The design channels botanical precision with modern tech sophistication
- **Warm Yet Technical**: Earthy undertones balance the clinical precision of growing data
- **Inviting & Supportive**: A digital garden that nurtures both plants and growers

### Density & Spacing Philosophy

The interface favors an **unhurried, breathable layout** with:

- Generous vertical rhythm between sections
- Spacious card padding (16–20px internal)
- Liberal use of whitespace to let content elements "rest"
- A non-cramped mobile experience prioritizing scanability over density

---

## 2. Color Palette & Roles

### Primary Backgrounds

| Name                  | Hex       | Role                                                                       |
| --------------------- | --------- | -------------------------------------------------------------------------- |
| **Deep Forest Black** | `#0f2e1a` | App background (charcoal-950) — The darkest canvas, evoking a night garden |
| **Midnight Canopy**   | `#1C1917` | Sheet/modal backgrounds (charcoal-900) — Slightly elevated surfaces        |
| **Twilight Bark**     | `#181a19` | Card backgrounds (darkSurface.card) — Floating content containers          |
| **Dusk Canopy**       | `#1e201f` | Elevated/highlighted cards — Subtle lift for interactive states            |

### Primary Accent — Neon Lime

| Name                 | Hex                        | Role                                                                              |
| -------------------- | -------------------------- | --------------------------------------------------------------------------------- |
| **Electric Lime**    | `#a3e635`                  | Primary accent for CTAs, progress indicators, active states — THE signature color |
| **Lime Pressed**     | `#84cc16`                  | Hover/pressed state for lime elements                                             |
| **Lime Glow**        | `rgba(163, 230, 53, 0.35)` | Shadow/glow effect for accent buttons                                             |
| **Neon Lime Bright** | `#94fa2e`                  | Ultra-vibrant variant for key emphasis (neon.lime)                                |

### Secondary Accent — Terracotta CTA

| Name             | Hex       | Role                                                                |
| ---------------- | --------- | ------------------------------------------------------------------- |
| **Burnt Clay**   | `#F97316` | Primary buttons, critical CTAs — Warm contrast to guide user action |
| **Clay Pressed** | `#EA580C` | Button hover/pressed state                                          |
| **Ember Glow**   | `#FB923C` | Lighter accent for badges and highlights                            |

### Primary Brand — Deep Jungle Green

| Name            | Hex       | Role                                              |
| --------------- | --------- | ------------------------------------------------- |
| **Jungle Mint** | `#10B981` | Brand color for success states, health indicators |
| **Soft Mint**   | `#6EE7B7` | Light variant for active containers               |
| **Deep Fern**   | `#047857` | Dark mode text on light backgrounds               |

### Text Colors

| Name             | Hex       | Role                                    |
| ---------------- | --------- | --------------------------------------- |
| **Pure White**   | `#FFFFFF` | Primary headings, key content           |
| **Morning Mist** | `#F2F9F6` | Body text, general content (neutral-50) |
| **Sage Gray**    | `#6EAD8C` | Tertiary text, timestamps (neutral-400) |
| **Pale Sage**    | `#A8D9C0` | Disabled/inactive text (neutral-300)    |

### Semantic Colors

| Name              | Hex       | Role                                  |
| ----------------- | --------- | ------------------------------------- |
| **Healthy Green** | `#10B981` | Success states, "on track" indicators |
| **Caution Amber** | `#F59E0B` | Warnings, attention needed            |
| **Danger Red**    | `#EF4444` | Errors, critical alerts               |
| **Info Blue**     | `#3B82F6` | Informational highlights              |

### Glass & Overlay Effects

| Name              | Value                       | Role                       |
| ----------------- | --------------------------- | -------------------------- |
| **Glass Pill**    | `rgba(28, 25, 23, 0.70)`    | Frosted tab bar background |
| **Glass Capsule** | `rgba(255, 255, 255, 0.22)` | Active tab indicator       |
| **Subtle Border** | `rgba(255, 255, 255, 0.10)` | Glass-effect borders       |
| **Input Glass**   | `rgba(255, 255, 255, 0.08)` | Input field backgrounds    |

---

## 3. Typography Rules

### Font Family

**Inter** — A modern, highly-legible sans-serif that conveys technical precision while remaining warm and approachable.

### Hierarchy

| Level               | Weight         | Size    | Usage                                  |
| ------------------- | -------------- | ------- | -------------------------------------- |
| **Hero Headlines**  | Bold (700)     | 28–32px | Greeting screens, "Good Morning, Alex" |
| **Section Headers** | SemiBold (600) | 20–24px | "My Garden", "Today's Focus"           |
| **Card Titles**     | Medium (500)   | 16–18px | Strain names, plant identifiers        |
| **Body Text**       | Regular (400)  | 14–16px | Descriptions, general content          |
| **Captions**        | Regular (400)  | 12–13px | Timestamps, metadata, secondary info   |

### Letter Spacing

- Headlines: Slightly tighter (-0.02em) for density
- Body: Standard (0) for readability
- Captions: Slightly wider (+0.01em) for clarity at small sizes

### Line Height

- Headlines: 1.2–1.3 (tight)
- Body text: 1.5–1.6 (generous for comfortable reading)

---

## 4. Component Stylings

### Buttons

- **Primary CTA**: Pill-shaped (fully rounded, `rounded-full`), Burnt Clay (#F97316) fill, white text. Generous horizontal padding (24–32px). Subtle shadow for depth.
- **Secondary Actions**: Pill-shaped outline with Electric Lime (#a3e635) border, transparent fill, lime text. On press, fills with lime at 20% opacity.
- **Icon Buttons**: Circular containers with glass backgrounds, organic icons in white or lime.

### Cards & Containers

- **Corner Roundness**: Generously rounded (`rounded-2xl` / 16px) — approachable, non-clinical
- **Background**: Twilight Bark (#181a19) with subtle glass effect
- **Border**: Whisper-thin 1px border using Subtle Border color
- **Shadow**: Minimal-to-none; relies on background hierarchy for depth
- **Internal Padding**: Spacious (16–20px) for breathing room

### Inputs & Forms

- **Background**: Input Glass (semi-transparent white at 8%)
- **Border**: Input Border (semi-transparent white at 12%), 1px
- **Corner Roundness**: Subtly rounded (`rounded-lg` / 8px)
- **Focus State**: Electric Lime border glow
- **Placeholder**: Sage Gray (#6EAD8C)

### Bottom Tab Bar

- **Style**: Frosted glass "soft pill" floating above content
- **Background**: Glass Pill overlay on blur
- **Active Indicator**: Glass Capsule highlight behind active icon
- **Icons**: Thin-stroked, organic shapes; active icons in Electric Lime

### Status Badges & Pills

- **Success**: Semi-transparent green container (`rgba(22, 163, 74, 0.18)`) with mint text (#86EFAC)
- **Warning**: Semi-transparent amber container with amber text
- **Phase Indicators**: Neon Lime borders with subtle lime glow

### Sheets & Modals

- **Background**: Midnight Canopy (#1C1917)
- **Corner Roundness**: Extra-large rounded top corners (`rounded-t-[40px]` / 40px)
- **Handle**: Subtle horizontal bar in neutral-100 equivalent

---

## 5. Layout Principles

### Grid Alignment

- Mobile-first design with a single-column primary layout
- 16–20px horizontal page margins
- Card-based content organization with 12–16px gaps

### Whitespace Strategy

- **Generous vertical spacing** between sections (24–32px)
- **Breathable card interiors** with consistent internal padding
- **Progressive disclosure**: Hide complexity behind expandable sections

### Visual Hierarchy

- Hero greeting area with date and personalized welcome
- "Garden at a glance" card carousel for quick status
- Task-focused sections with completion progress
- Community feed with full-bleed imagery inspiration

### Responsive Behavior

- Cards stretch to fill viewport width (minus margins)
- Imagery uses aspect ratio containers (16:9 for landscape, 1:1 for profiles)
- Tab bar fixed to bottom with safe area insets

---

## 6. Iconography & Imagery

### Icon Style

- **Thin-stroked** (1.5–2px) custom icons
- **Organic shapes** leaning towards botanical and natural metaphors
- Material Icons or custom SVGs with consistent stroke weight
- Active/selected icons filled or in Electric Lime

### Photography

- **Aspirational and lush**: Vibrant plant photography showcasing healthy growth
- **High-contrast on dark**: Images pop against the dark background
- **Community-focused**: Diverse growers, hands-on cultivation moments
- **No placeholder content**: Always use generated or real imagery

---

## 7. Animation & Motion

### Principles

- **Subtle and purposeful**: Micro-animations enhance UX without distraction
- **Organic timing**: Prefer spring physics over linear timing for natural feel
- **Respect Reduced Motion**: Always honor system accessibility preferences

### Typical Durations

| Token | Duration | Usage                                |
| ----- | -------- | ------------------------------------ |
| `xs`  | 120ms    | Micro-interactions (button feedback) |
| `sm`  | 180ms    | Quick transitions (tab switches)     |
| `md`  | 260ms    | Standard transitions (page fades)    |
| `lg`  | 360ms    | Elaborate animations (sheet reveals) |

### Easing

- Standard: `cubic-bezier(0.2, 0, 0, 1)` — Emphasis at end
- Decel: `cubic-bezier(0, 0, 0.2, 1)` — Soft landing

---

## 8. Usage Notes for Stitch Prompts

When prompting Stitch to generate new screens for GrowBro:

1. **Always specify dark mode**: "Dark interface with Deep Forest Black (#0f2e1a) background"
2. **Reference the neon accent**: "Electric Lime (#a3e635) for primary actions and highlights"
3. **Emphasize organic shapes**: "Generously rounded cards (16px corners), pill-shaped buttons"
4. **Request Inter font**: "Use Inter font family with clear hierarchy"
5. **Describe the atmosphere**: "Premium, immersive greenhouse feel with generous whitespace"
6. **Include glass effects**: "Frosted glass tab bar and subtle semi-transparent overlays"
7. **Reference terracotta for CTAs**: "Burnt Clay (#F97316) for primary call-to-action buttons"

### Example Prompt Fragment

> "Create a dark mode screen with a Deep Forest Black background (#0f2e1a). Use generously rounded cards with Twilight Bark surfaces (#181a19) and whisper-thin white borders at 10% opacity. Primary accent color is Electric Lime (#a3e635) for active states and progress indicators. Burnt Clay (#F97316) for CTA buttons. Inter font with bold headings and regular body text. Floating pill-shaped frosted glass tab bar at the bottom."
