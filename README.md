# Nexus Extension

A Chrome extension that transfers contact data from OneLink Intruity into GoHighLevel (Nexus Sales) with optional workflow enrollment and robust timezone handling.

## Features

- **One-Click Data Transfer**: Automatically extracts and transfers contact information with a single click
- **Smart Data Extraction**: Intelligently identifies and captures contact details from OneLink Intruity pages
- **Workflow Integration**: Direct integration with Nexus Sales workflows
- **Default Workflow Support**: Save and automatically use your preferred workflow
- **Modern UI**: Clean, intuitive interface with real-time status updates
- **Secure API Key Storage**: Safely stores your Nexus Sales API key
- **Duplicate-Safe Transfers**: Exact email or normalized phone matching prevents accidental duplicates
- **Timezone Preservation**: Extracts timezone from OneLink and enforces it in GHL

## Installation (Developer Mode)

1. Clone this repository (or unzip a packaged build)
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory

## Usage

1. **Setup**:
   - Click the extension icon to open the popup
   - Enter your Nexus Sales API key and click "Save API Key"

2. **Transferring Contacts**:
   - Navigate to a OneLink Intruity page with contact information
   - Click the extension icon
   - Select your desired workflow (optional)
   - Click "Transfer to Nexus" to send the data
   - The extension checks for an existing contact using exact email match or a normalized 10‑digit phone match; if found, it reports "already transferred" and can add to a workflow

3. **Setting Default Workflow**:
   - Select your preferred workflow
   - Check "Save as default workflow"
   - The selected workflow will be automatically used for future transfers

## Timezone Handling

- The content script scrapes OneLink's "Current Leadtime" display and maps it to an IANA timezone (e.g., `America/Chicago`).
- On create, the extension sends `timezone` in the contact payload.
- Some GoHighLevel accounts only honor timezone on update, so the extension then enforces timezone with a follow‑up request, trying both `timezone` and `timeZone`. If needed, it retries with common aliases like `US/Central`.
- This avoids the default fallback to Eastern.

## Security

- API keys are stored securely in Chrome's local storage
- No data is stored on external servers
- All data transfers are encrypted using HTTPS

## Requirements

- Google Chrome browser
- Valid Nexus Sales API key
- Access to OneLink Intruity and Nexus Sales platforms

## Support

For support or feature requests, please contact the development team.

## License

This software is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

© 2024 Nexus Sales. All rights reserved. 