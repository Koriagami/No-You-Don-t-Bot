# NYD Bot

🚫 **NYD Bot** helps you keep your Discord server clean by automatically deleting messages containing unwanted links. You can block links that include certain keywords (e.g., `tiktok`) either per-channel or server-wide. The bot also supports user and role allowlists for exceptions.

---

## ✨ Features

* Block links containing specific partials per-channel
* Block links server-wide
* Manage rules via simple slash commands
* Allowlist specific users or roles to bypass blocking
* Lightweight and in-memory (no database required)

---

## 📦 Commands

All commands are under the `/nyd` group.

### Channel-Specific Rules

* `/nyd block <channel> <filtered_partial>` → Block links containing the partial in a channel
* `/nyd list <channel>` → List blocked partials in a channel
* `/nyd unblock <channel> <filtered_partial>` → Remove a block from a channel

### Server-Wide Rules

* `/nyd block-global <filtered_partial>` → Block links server-wide
* `/nyd list-global` → List all globally blocked partials
* `/nyd unblock-global <filtered_partial>` → Remove a global block

### Allowlist

* `/nyd allow-user <user>` → Exempt a user from blocking
* `/nyd remove-allow <user>` → Remove a user from the allowlist
* `/nyd allow-role <role>` → Exempt an entire role from blocking
* `/nyd remove-allow-role <role>` → Remove a role from the allowlist
* `/nyd list-allow` → Show all allowlisted users and roles

---

## 🚀 How It Works

1. When a user sends a message containing a link (`http...`), NYD Bot checks if the message matches any blocked partials for the channel or server.
2. If a match is found, the message is deleted automatically.
3. If the user or their role is allowlisted, the message will not be deleted even if it matches a blocked partial.

---

## ⚙️ Requirements

* Node.js 16.9.0 or higher
* `discord.js` v14
* A Discord Bot Token

---

## ▶️ Setup

1. Clone this repository
2. Install dependencies:

   ```bash
   npm install discord.js
   ```
3. Create a `config.json` file with:

   ```json
   {
     "token": "YOUR_BOT_TOKEN",
     "clientId": "YOUR_CLIENT_ID"
   }
   ```
4. Run the bot:

   ```bash
   node index.js
   ```

---

## 🔒 Permissions Needed

The bot requires:

* **Manage Messages** → to delete blocked messages
* **Read Messages/View Channels** → to monitor messages
* **Send Messages** → to reply with command confirmations

---

## 📖 Example

Block all TikTok links in `#general`:

```
/nyd block #general tiktok
```

Block all TikTok links across the entire server:

```
/nyd block-global tiktok
```

Allow a moderator to bypass filtering:

```
/nyd allow-role @Moderators
```
