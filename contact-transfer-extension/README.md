# Contact Transfer Extension

A Chrome extension for transferring contact data between OneLink Intruity and Nexus Sales platforms.

## Features

- Scrape contact data from OneLink Intruity pages
- Transfer contact data to Nexus Sales
- Automatic page refresh after successful transfer
- Modern UI with status notifications
- Support for multiple API keys

## Installation

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Save your Nexus Sales API key in the extension
2. Navigate to a OneLink Intruity page with contact information
3. Click the extension icon to open the popup
4. Click "Scrape Contact Data" to extract the contact information
5. Click "Transfer to Nexus Sales" to send the data

## Development

The extension consists of the following components:

- `manifest.json`: Extension configuration
- `popup.html/js`: User interface and interaction
- `content.js`: Data extraction from web pages
- `background.js`: API communication and data processing

## Permissions

The extension requires the following permissions:
- `activeTab`: To access the current tab's content
- `scripting`: To inject content scripts
- `storage`: To save API keys and settings
- `tabs`: To refresh pages after transfer
- `contextMenus`: For future context menu integration

## License

MIT License 