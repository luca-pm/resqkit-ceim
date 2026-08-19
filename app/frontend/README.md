# Shadcn-UI Template Usage Instructions

## technology stack

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

All shadcn/ui components have been downloaded under `@/components/ui`.

## File Structure

- `index.html` - HTML entry point
- `vite.config.ts` - Vite configuration file
- `tailwind.config.ts` - Tailwind CSS configuration file
- `package.json` - NPM dependencies and scripts
- `src/main.tsx` - Project entry point
- `src/App.tsx` - Router shell (imports pages and sets up routes)
- `src/pages/Index.tsx` - Main page entry point for `/` by default; replace the placeholder page here unless you explicitly reroute `/` elsewhere
- `src/index.css` - Existing CSS configuration

## Components

- All shadcn/ui components are pre-downloaded and available at `@/components/ui`

## Styling

- Add global styles to `src/index.css` or create new CSS files as needed
- Use Tailwind classes for styling components

## Development

- Import components from `@/components/ui` in your React components
- Customize the UI by modifying the Tailwind configuration

## Note

- The `@/` path alias points to the `src/` directory

# Commands

**Install Dependencies**

```shell
npm install
```

**Start Preview**

```shell
npm run dev
```

**To build**

```shell
npm run build
```
