# Image Gen AI

AI-powered image generation app with **Bring Your Own Key** (BYOK) support. Pick your provider, enter your API key, and start generating.

## Features

- **Multi-Provider** — OpenAI, Open Router, and Gemini supported
- **Reference Image** — upload or paste a face/identity reference; vision model describes it automatically for consistent character reproduction
- **Style Templates** — 30+ pre-built prompt templates to jumpstart your creativity
- **Generation History** — scrollable history of all your generations with download
- **Live Preview** — results stream as base64 images

## Quick Start

```bash
npm install
npm run dev
```

No `.env` needed. The API key is entered in the app UI.

## Usage

1. Open the app in your browser
2. Select your **provider** (OpenAI / Open Router / Gemini) in the navbar
3. Paste your **API key** in the input field next to the provider pills
4. Write a prompt or pick a style template from the gallery
5. Click **Generate Image**

## Providers

| Provider | API Key | Models |
|---|---|---|
| **OpenAI** | OpenAI API key | `DALL-E 3`, `GPT Image 2` |
| **Open Router** | OpenRouter API key | `Nano Banana 2`, `GPT Image 2`, `FLUX.2 Pro` |
| **Gemini** | Google AI API key | `Gemini 2.0 Flash Image` |

## Example Generations

| Sunlit Serenity | Neon Rain Monologue |
|---|---|
| ![Sunlit Serenity](https://videos.magichour.ai/templates/cmpxofidr000h600z6fjk4to5/preview.jpg) | ![Neon Rain](https://videos.magichour.ai/templates/cmo9t27md005h560zsf7z8hla/preview.jpg) |

| Moonlit Jellyfish Couture | Misty Forest Car |
|---|---|
| ![Jellyfish Couture](https://videos.magichour.ai/templates/cmnypx0m9000d690zdy5r7yti/preview.jpg) | ![Misty Forest Car](https://videos.magichour.ai/templates/cmo8v7yae07xr0w0ziytsnzej/preview.jpg) |

## Tech Stack

- **React 19** — UI framework
- **Vite 8** — build tool
- **CSS** — custom dark theme with CSS custom properties
- **OpenAI / OpenRouter / Gemini APIs** — image generation & vision

## Build

```bash
npm run build
```

Produces a static `dist/` folder — deploy anywhere (Vercel, Netlify, GitHub Pages, etc.).

## License

MIT
