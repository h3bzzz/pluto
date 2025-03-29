# Pluto Network Monitor Dashboard

This is the frontend for the Pluto Network Monitor, built with vanilla JavaScript and Chart.js.

## Type Checking and Linting

The dashboard JavaScript code includes TypeScript-style type checking through JSDoc annotations. This provides type safety without converting the codebase to TypeScript.

### Setup

To set up the type checking and linting environment:

1. Install the dependencies:

```bash
cd plutos-space/static
npm install
```

2. Run type checking:

```bash
npm run typecheck
```

3. Run linting:

```bash
npm run lint
```

4. Run both checks at once:

```bash
npm run check
```

### How Type Checking Works

The JavaScript files use JSDoc annotations with TypeScript type references:

- `// @ts-check` at the top of each file enables TypeScript checking
- `/// <reference path="./types.d.ts" />` includes the type definitions
- JSDoc comments provide type information for variables and functions

### Project Structure

- `js/` - JavaScript files
  - `app.js` - Main application logic
  - `types.d.ts` - TypeScript type definitions
- `css/` - CSS stylesheets
- `index.html` - Main HTML page

### Adding New Types

To add new types:

1. Edit the `js/types.d.ts` file
2. Add your interface or type definition
3. Use the type in your JSDoc annotations

Example:

```typescript
// In types.d.ts
interface MyNewType {
  property1: string;
  property2: number;
}

// In your .js file
/**
 * @type {MyNewType}
 */
const myVariable = { property1: "value", property2: 42 };
``` 