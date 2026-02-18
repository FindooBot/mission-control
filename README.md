# Mission Control 🚀

A standalone Node.js dashboard for work productivity, aggregating data from Calendar, Shortcut (Clubhouse), GitHub, and Todoist.

![Dashboard Screenshot](screenshot.png)

## Features

- **📅 Calendar Integration**: Personal and work calendar events via iCal
- **🚀 Shortcut Stories**: Track your work items and notifications
- **🐙 GitHub PRs & Notifications**: Monitor your code reviews and mentions
- **✅ Todoist Tasks**: Manage your todo list with create/complete functionality
- **🔔 Notification Panel**: Unified GitHub and Shortcut notifications
- **🤖 Claude Integration**: One-click prompts to review PRs or investigate stories
- **🌙 Dark Mode**: Automatic system preference detection
- **🍎 Apple-Style UI**: Clean, minimal interface inspired by Apple's design language

## Installation Options

### Option 1: macOS App (Recommended for Mac users)

Build a native macOS app with Tauri:

```bash
# Clone and setup
git clone https://github.com/FindooBot/mission-control.git
cd mission-control

# Install dependencies
npm install

# Install Rust (one-time)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build the macOS app
npm run tauri:build
```

After building, find your app at:
- **DMG Installer**: `src-tauri/target/release/bundle/dmg/Mission-Control_1.0.0_x64.dmg`
- **App Bundle**: `src-tauri/target/release/bundle/macos/Mission Control.app`

Features:
- Native macOS menu bar integration
- System tray (click icon to show/hide)
- Auto-starts the server
- Close button minimizes to tray

See [TAURI.md](TAURI.md) for detailed build instructions.

### Option 2: Docker

```bash
docker-compose up -d
```

The app will be available at `http://localhost:1337`

### Option 3: Local Node.js

```bash
npm install
npm start
```

The setup wizard will guide you through configuration on first run.

## Docker Configuration

### Volume Mounts

The `docker-compose.yml` includes several important volume mounts:

| Mount | Purpose |
|-------|---------|
| `./data:/app/data` | Persistent SQLite database storage |
| `./config:/app/config` | Configuration directory |
| `~/.config/gh:/root/.config/gh` | **gh CLI authentication from host** |

### GitHub CLI Authentication

The gh CLI authentication is mounted from your host machine. To use private repositories:

1. Ensure you're authenticated on your host: `gh auth status`
2. If not authenticated: `gh auth login`
3. The container will use your host's credentials automatically

## Configuration

On first run, visit `/setup` to configure your integrations:

| Setting | Description |
|---------|-------------|
| **Personal iCal URL** | Your personal calendar feed (iCloud/Google) |
| **Work iCal URL** | Your work calendar feed |
| **Shortcut API Token** | From Shortcut settings → API Tokens |
| **Shortcut Workspace** | Your workspace slug |
| **GitHub PAT** | Personal Access Token with `repo` scope |
| **Private Repo** | Default: `KimonoIM/web` |
| **Todoist API Token** | From Todoist → Settings → Integrations |

## Widget Layout

```
┌─────────────────┬─────────────────┐
│   🐙 GitHub     │    🚀 Shortcut  │
│   Pull Requests │    Stories      │
├─────────────────┼─────────────────┤
│   ✅ Todoist    │    📅 Calendar  │
│   Tasks         │    Events       │
└─────────────────┴─────────────────┘
```

## Features Guide

### Todoist Widget
- **Click task** → Complete it (strikethrough then removes)
- **+ button** → Add new task with due date and priority

### GitHub Widget
- **Click PR title** → Open PR in browser
- **🤖 Robot icon** → Copy Claude review prompt
- **Review badges** → Shows approval/changes requested status

### Shortcut Widget
- **Click story** → Open in Shortcut
- **🤖 Robot icon** → Copy Claude investigation prompt

### Notification Panel (🔔 in header)
- **GitHub tab** → PR comments, mentions, reviews
- **Shortcut tab** → Story mentions and assignments
- **Click notification** → Open item and mark as read
- **× button** → Dismiss individual notification

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` (in Add Task modal) | Create task |
| `Esc` | Close modal |

## Project Structure

```
mission-control/
├── src/
│   ├── server.js          # Express server entry
│   ├── scheduler.js       # Background data fetching
│   ├── config/            # Configuration management
│   ├── routes/            # Express routes
│   ├── services/          # API integrations
│   │   ├── calendar.js
│   │   ├── github.js
│   │   ├── shortcut.js
│   │   └── todoist.js
│   └── database/          # SQLite database layer
├── public/                # Static assets
│   ├── css/
│   └── js/
├── src-tauri/             # macOS app (Tauri)
│   ├── src/
│   └── icons/
├── data/                  # SQLite database (gitignored)
├── config/                # Config files (gitignored)
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Development

```bash
# Local development with auto-restart
npm run dev

# Tauri development (macOS app)
npm run tauri:dev

# Build for production
npm run tauri:build
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/data` | GET | Get all dashboard data |
| `/api/config` | GET | Get configuration status |
| `/api/todoist/tasks` | POST | Create new task |
| `/api/todoist/tasks/:id/complete` | POST | Complete a task |
| `/api/notifications/:type/:id/read` | POST | Mark notification as read |

## Troubleshooting

### "App is damaged" error (macOS)
```bash
xattr -cr "/Applications/Mission Control.app"
```

### Todoist tasks not updating
Completed tasks are filtered out every fetch cycle. If you see completed tasks:
1. Check browser console for errors
2. Verify your Todoist API token has access
3. Restart the container/app

### Shortcut shows no stories
1. Verify your Shortcut API token
2. Check that stories are assigned to you (Owner field)
3. Stories must be in active workflow states (Ready for Dev, In Dev, Code Review, etc.)

### GitHub private repo not working
1. Ensure `gh auth status` shows you're logged in on your host
2. For Docker: The `~/.config/gh` mount must point to your actual gh config
3. Or use a GitHub PAT with `repo` scope instead

## Privacy & Security

- All API tokens stored locally in `config/config.json`
- Database is local SQLite (`data/mission-control.db`)
- No data sent to external servers except API calls to your configured services
- GitHub private repos accessed via your local gh CLI auth or PAT

## Technologies

- **Backend**: Node.js, Express, SQLite (better-sqlite3)
- **Frontend**: Vanilla JS, EJS templates
- **Styling**: Custom CSS (Apple-inspired design)
- **Desktop**: Tauri (Rust + WebView)
- **Scheduling**: node-cron

## Roadmap

- [x] Native macOS app (Tauri)
- [ ] Windows/Linux builds
- [ ] Keyboard shortcuts for navigation
- [ ] Drag-and-drop task reordering
- [ ] Slack notifications integration
- [ ] Custom dashboard layouts

## License

MIT © Finlay Smith
