# Txflow Stats Design System

## Direction
Modern, premium Web3 analytics SaaS. The interface should feel calm, precise, trustworthy, and data-focused rather than like a neon trading-game interface.

## Color tokens
- App background: #090910
- Primary surface: #12121D
- Raised surface: #191827
- Borders: #29263B
- Main text: #F3F1FA
- Muted text: #A09BB4
- Primary violet: #9B7CFF
- Soft violet: #C4B2FF
- Positive PnL: #55D6A0
- Negative PnL: #FF7185

Violet is the brand and interaction accent. Green and red are reserved for financial meaning (positive and negative performance), not general decoration.

## Visual principles
1. Use dark charcoal with a subtle violet undertone; avoid pure black and large saturated gradients.
2. Use violet sparingly for active navigation, primary actions, focus states, selected controls, and key highlights.
3. Keep cards on layered surfaces with subtle borders. Avoid excessive glow, glass effects, and nested card borders.
4. Use clear type hierarchy: large page title, concise supporting text, small uppercase metadata labels, tabular numerals for financial values.
5. Keep market tables compact and readable. Align numeric columns consistently and preserve horizontal scrolling on narrow screens.
6. Use consistent spacing, radius, borders, and control heights across routes.
7. Motion should be subtle and purposeful. Respect prefers-reduced-motion.
8. Preserve accessible contrast, keyboard focus, semantic headings, and usable touch targets.

## Data visualization
- Positive values: green.
- Negative values: red.
- Neutral values: foreground/muted.
- Violet: selected series, active chart controls, and brand emphasis.
- Never use color alone to communicate PnL direction; retain signs/labels.
- Do not invent freshness, volume, price movement, or data provenance.

## Implementation boundaries
- Do not change API routes, response shapes, Supabase schema/data, indexing, cron jobs, or trading calculations as part of visual work.
- Preserve all existing interactions, filters, routes, charts, and responsive behavior.
- Prefer existing dependencies and CSS before adding component libraries.
- Every redesigned page must be checked at desktop and mobile widths, including loading, empty, and error states.
- Treat the homepage as the visual reference before extending the system to other pages.
