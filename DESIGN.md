# Jev Lab design system

The interface uses a restrained token vocabulary so the dashboard and Studio feel like one product.

## Shape

- `rounded-xl` is the standard control and compact item radius.
- `rounded-2xl` is the standard input, answer card, and nested panel radius.
- `rounded-3xl` is reserved for large decorative callouts.
- `rounded-full` is reserved for pills and circular actions.

## Spacing

- Use Tailwind's spacing scale only. Prefer `gap-2`/`gap-3` for controls, `gap-4`/`gap-5` for groups, and `gap-7`/`gap-8` for page sections.
- Prefer `p-3`/`p-4` for controls and nested content, `p-5`/`p-6` for cards, and `p-7` for large desktop cards.
- Keep spacing on the parent whenever it describes layout between components.

## Color

Use the theme tokens in `tailwind.config.ts`: `ink`, `paper`, `moss`, `coral`, `sky`, and `lavender`. Avoid raw color utilities and arbitrary color values in components.

## Components

`Button` owns its shape, padding, and visual treatment. `Card` owns its border, background, shadow, and shape; callers may control layout and spacing. Reusable visual treatments belong in the component rather than one-off page classes.
