# 3D Edu Platform

Interactive 3D and graphics demos for teaching first-year 3D students. Every demo is a standalone page under `/embed/<slug>` that can be embedded in an iframe; the home page is a gallery of all of them.

- Live site: https://3d-edu-platform.vercel.app/
- Demo list, links, and the embed snippet: [DEMOS.md](DEMOS.md)

### Project layout

- `src/app/embed/<slug>/page.tsx` - the embeddable page for each demo (UI and controls).
- `src/scenes/<slug>/` - the demo's rendering and simulation code.
- `src/lib/demos.ts` - the list of demos shown in the gallery. Keep [DEMOS.md](DEMOS.md) in sync with it.

Built with [Next.js](https://nextjs.org), bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
