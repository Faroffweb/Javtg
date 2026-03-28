# Javtg — JAV Database Telegram Bot

A Telegram bot that searches javdatabase.com for JAV movies, scrapes metadata and images, and posts formatted entries to a configured Telegram channel.

Features
- Search movies by ID or title (`/search`).
- Direct fetch from URL (`/direct`).
- Search actresses (`/actress <name>`) and studios (`/studio <name>`), show movie lists and let users select a video ID to post.
- Per-user processing queue to avoid concurrent requests.
- Auto-tagging stored in `tags.json` and `/tags` browsing.
- Single editable progress message to avoid chat spam.

Quick start
1. Copy `.env.example` (or create a `.env`) and set required variables:

```
BOT_TOKEN=your_telegram_bot_token
CHANNEL_ID=-1001234567890
ADMIN_IDS=12345678,87654321
```

2. Install dependencies and run:

```bash
npm install
npm start
```

Development
- Run locally with auto-reload:

```bash
npm run dev
```

Bot commands
- `/start` — help message.
- `/search <query>` — search movies by ID/title.
- `/direct <url>` — fetch from a full movie URL.
- `/actress <name>` — search actress, show movies, select by video ID.
- `/studio <name>` — search studio, show movies, select by video ID.
- `/tags [category]` — list popular tags (genres, actresses, studios, series).
- `/queue` — show your queue status.
- `/stats` — admin-only stats.

Notes & troubleshooting
- The bot scrapes only `javdatabase.com` (external links are ignored).
- If Telegram returns `caption is too long` the bot retries uploads with actress names removed.
- Progress updates are sent as a single editable message; previous progress messages are auto-deleted when a new search starts.
- Tag data is persisted in `tags.json` — back this file up if needed.

Logging
- The bot logs activity and errors to stdout. Check the console for debug prints (e.g. `showIdolMovies` keyboard rows).

Contributing
- Fork, make changes, open a PR. Keep changes focused and run `npm test` (no tests included by default).

License
- No license specified.

Enjoy — use responsibly and respect website terms of service.

