Remember our existing Cursor Rules, especially:

- Tech stack (React Native, Expo, NativeWind, Reanimated 4, etc.)
- Our design system and design conventions
- The defined purpose and responsibilities of the currently opened screen

Context:

- You are looking at the full code of the current screen in this file.
- I have attached a screenshot reference (e.g., from Mobbin).
- The screen already works correctly from a functional/business logic perspective:
  navigation, state, data flow, and logic should NOT be changed.

TASK:
Use the attached screenshot ONLY as a VISUAL reference to improve the design:
layout, spacing, hierarchy, typography, cards, shadows, components, etc.

Please:

1. First read and understand the existing code of the opened screen.

2. Compare the current design with the screenshot reference.

3. Redesign the UI of the existing screen so that it visually matches the style,
   layout patterns, spacing rhythm, and component hierarchy of the reference design.

Important constraints:

- Do NOT change business logic, props, callbacks, API shapes, or state management.
- Preserve the functional behavior and component structure unless clearly required.
- Use NativeWind for styling (className) in a clean, consistent way.
- Use Reanimated 4 only where it fits naturally (light transitions, subtle motions),
  without affecting existing logic.
- Keep our architectural conventions, naming, folder structure, and design rules.

WORKFLOW:

A) Before coding:  
 Write a short UI analysis based on the reference screenshot:

- What are the key visual components and patterns? (header, cards, lists, sections, etc.)
- Which concrete changes will you apply to the current screen’s UI?
  (e.g., “increase spacing”, “rounded cards with subtle shadows”,
  “stronger typography hierarchy”, “improve visual grouping of sections”)

B) Then update the code of the current file:

- Directly modify the existing JSX and styling.
- Improve layout containers, spacing, and visual grouping.
- Apply updated NativeWind classes for spacing, fonts, colors, radius, shadows.
- Introduce small, tasteful Reanimated transitions/animations only if appropriate.
- Do NOT rewrite the entire screen; refine and enhance it visually.

C) After coding:  
 Provide 3–5 bullet points summarizing what has changed from a UI/UX perspective.

Goal:
A clean, polished, modern redesign of the current screen based on the reference screenshot,
without breaking any existing functionality.
