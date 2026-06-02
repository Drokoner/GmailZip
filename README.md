# GmailZip

A Chrome extension to download all attachments from Gmail emails matching a subject and date range — all packed into a single ZIP file.

Created by [@Drokoner](https://github.com/Drokoner) with the help of [Claude](https://claude.ai) (Anthropic).

---

## Features

- 🔍 Search emails by subject keyword
- 📅 Filter by number of days (e.g. last 10 days)
- 📦 Downloads all attachments as a single ZIP file
- 📊 Progress bar during download and compression
- 🌍 Multilingual: English and Spanish (auto-detected from browser)
- 🔒 Secure: read-only Gmail access, no external servers, your data never leaves your machine

---

## Before you install — you're about to meet Google Cloud

Maybe, like me, you had no idea this existed until you needed it. But trust me, it's worth it.

For GmailZip to read your Gmail, Google requires every user to create their own OAuth credentials. There's no way around it — without this, the extension simply can't connect to Gmail.

The good news: by doing it yourself, **your data is yours alone**. Not even the author of this extension has access to your account. It's actually the most secure setup possible.

You only need to do this once:

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in with any Google account
2. Create a new project (name it whatever you like)
3. Go to **APIs & Services → Library**, search for **Gmail API** and enable it
4. Go to **APIs & Services → OAuth consent screen**:
   - Click **Get started**
   - App name: anything you like (e.g. `GmailZip`)
   - Fill in the required email fields
   - Complete the setup
5. Go to **Audience** and add the Gmail address you want to use as a **test user**
6. Go to **Clients → Create client**:
   - Application type: **Chrome Extension**
   - Name: anything you like
   - Extension ID: use 32 a's as a placeholder for now: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
7. Copy your **Client ID**

---

## Installation

1. Download or clone this repository
2. Open `manifest.json` with any text editor and replace `YOUR_CLIENT_ID_HERE` with your Client ID from the previous step
3. Open Chrome and go to `chrome://extensions`
4. Enable **Developer mode** (top right toggle)
5. Click **Load unpacked** and select the GmailZip folder
6. Copy the **Extension ID** shown on the extension card
7. Go back to Google Cloud → **Clients** → edit your client and replace the 32 a's with the real Extension ID
8. Save

Done — the GmailZip icon will appear in your Chrome toolbar.

---

## Usage

1. Click the **GmailZip** icon in Chrome
2. Enter the **email subject** to search for (e.g. `Invoice`)
3. Set the **number of days** to look back (e.g. `10`)
4. Click **Download attachments as ZIP**
5. The first time, Google will ask you to authorize access — choose the Gmail account you want to use
6. A file named `GmailZip_YYYY-MM-DD.zip` will be saved to your Downloads folder

---

## Known limitations

- Maximum 50 emails per search (Gmail API limit)
- If two attachments share the same filename, one will overwrite the other in the ZIP
- No auto-update — download new versions manually from this repository
- Google will show an "unverified app" warning on first use — this is expected for locally installed extensions. Click **Continue** to proceed

---

## Privacy & Security

- GmailZip only requests **read-only** access to Gmail — it cannot delete or send anything
- Your data never leaves your machine — no external servers, no tracking
- The OAuth token is managed entirely by Chrome
- Each user has their own credentials — nobody else has access to your account
- You can review every line of code in this repository

---

## Tech stack

- Chrome Extensions API (Manifest V3)
- Gmail REST API
- [JSZip](https://stuk.github.io/jszip/) for ZIP generation

---

## License

MIT — free to use, modify and share.
