# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Bundle Size Analysis & Optimization

This document explains how to measure bundle sizes, understand minification, and make informed decisions about dependencies.

### Quick Commands

```bash
# Build production bundle
pnpm build

# Analyze client bundle size
du -sh .svelte-kit/output/client

# Find largest JS chunks
find .svelte-kit/output/client -name "*.js" -exec du -sh {} \; | sort -h | tail -10

# Check gzipped size of a file
gzip -c <
```
