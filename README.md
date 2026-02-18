# Mission Control

A standalone Node.js dashboard for work productivity, aggregating data from Calendar, Shortcut (Clubhouse), GitHub, and Todoist.

## Features

- **Calendar Integration**: Personal and work calendar events via iCal
- **Shortcut Stories**: Track your work items and notifications
- **GitHub PRs & Notifications**: Monitor your code reviews and mentions
- **Todoist Tasks**: Keep your todo list in view
- **Apple-Style UI**: Clean, minimal interface inspired by Apple's design language

## Quick Start

### Option 1: Docker (Recommended)

```bash
docker-compose up -d
```

The app will be available at `http://localhost:1337`

### Option 2: Local

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
| `./config.json:/app/config.json` | Configuration file |
| `~/.config/gh:/root/.config/gh` | **gh CLI authentication from host** |

### GitHub CLI Authentication

The gh CLI authentication is mounted from your host machine. To use private repositories:

1. Ensure you're authenticated on your host: `gh auth status`
2. If not authenticated: `gh auth login`
3. The container will use your host's credentials automatically

This allows the app to fetch private repository data without storing tokens in the container.

## Configuration

On first run, visit `/setup` to configure:

- **Personal iCal URL**: Your personal calendar feed
- **Work iCal URL**: Your work calendar feed
- **Shortcut API Token**: From Shortcut (Clubhouse) settings
- **Shortcut Workspace Name**: Your workspace slug
- **GitHub Personal Access Token**: For API access
- **Private Repo to Monitor**: Default: `KimonoIM/web`
- **Todoist API Token**: From Todoist integrations
- **Use gh CLI**: Enable for private repo access via mounted credentials

## Project Structure

```
mission-control/
├── src/
│   ├── server.js          # Express server entry
│   ├── config/            # Configuration management
│   ├── routes/            # Express routes
│   ├── services/          # API service integrations
│   └── database/          # SQLite database layer
├── public/                # Static assets
│   ├── css/
│   └── js/
├── data/                  # SQLite database (gitignored)
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Development

```bash
npm run dev  # Uses nodemon for auto-restart
```

## License

MIT
