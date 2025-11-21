# Chrome Web Store Publishing Checklist

## ✅ Extension Files (Ready)

- [x] **manifest.json** - Complete with all required fields
  - Manifest version 3
  - Name, version, description
  - Permissions properly declared
  - Icons (16, 32, 48, 128px) present
  - Service worker configured

- [x] **Icons** - All sizes present (16, 32, 48, 128px)

- [x] **Privacy Policy** - Available in `privacy-policy.md`

## 📋 Chrome Web Store Requirements

### 1. **Privacy Policy URL** (REQUIRED)
   - ⚠️ **ACTION NEEDED**: You must host the privacy policy at a publicly accessible URL
   - The privacy policy is in `privacy-policy.md`
   - Update the date in the privacy policy before publishing
   - Add this URL when submitting to Chrome Web Store

### 2. **Store Listing Information** (Prepare these)

   **Title**: Nexus
   
   **Short Description** (132 chars max):
   ```
   Transfer contact data from OneLink Intruity to GoHighLevel with automatic workflow enrollment and timezone preservation.
   ```
   
   **Detailed Description** (Use README.md content or create a detailed description):
   - One-click data transfer
   - Smart data extraction
   - Workflow integration
   - Timezone preservation
   - Name validation
   - API v1 and v2 support
   
   **Category**: Productivity or Business
   
   **Language**: English (United States)

### 3. **Screenshots** (REQUIRED)
   - ⚠️ **ACTION NEEDED**: Take screenshots of:
     - Extension popup (showing the UI)
     - Extension in action (on OneLink Intruity page)
     - At least 1 screenshot required, up to 5 recommended
     - Minimum size: 1280x800 or 640x400
     - Format: PNG or JPEG

### 4. **Promotional Images** (Optional but recommended)
   - Small promotional tile: 440x280
   - Large promotional tile: 920x680
   - Marquee promotional tile: 1400x560

### 5. **Store Listing Details**

   **Single Purpose**: Yes - Transfer contact data from OneLink to GoHighLevel
   
   **Permissions Justification**:
   - `activeTab`: To extract contact data from OneLink Intruity pages
   - `storage`: To securely store API keys and preferences locally
   - Host permissions: Required to communicate with GoHighLevel API and OneLink Intruity

### 6. **Pricing & Distribution**
   - Free
   - Visibility: Public or Unlisted (your choice)
   - Regions: All regions (or specific if needed)

### 7. **Developer Information**
   - Developer name
   - Support email/website
   - Privacy policy URL (must be hosted)

## 🔍 Pre-Publishing Checklist

- [x] Extension tested and working
- [x] Version number set (1.2.3)
- [x] Description updated
- [ ] Privacy policy hosted at public URL
- [ ] Privacy policy date updated
- [ ] Screenshots taken
- [ ] Store listing description written
- [ ] Support contact information ready

## 📝 Notes

- The extension uses Manifest V3 (required for new extensions)
- All permissions are justified and minimal
- No external data collection - all data stored locally
- API keys are stored securely in Chrome's local storage
- Extension communicates only with GoHighLevel API and OneLink Intruity

## 🚀 Publishing Steps

1. **Prepare Privacy Policy**
   - Host `privacy-policy.md` at a public URL
   - Update the date in the file
   - Note the URL for submission

2. **Take Screenshots**
   - Extension popup
   - Extension in use
   - Save as PNG/JPEG

3. **Create ZIP File**
   - Use the latest version (v1.2.3)
   - Ensure all files are included

4. **Submit to Chrome Web Store**
   - Go to Chrome Web Store Developer Dashboard
   - Create new item
   - Upload ZIP file
   - Fill in all required fields
   - Add privacy policy URL
   - Upload screenshots
   - Submit for review

5. **Review Process**
   - Typically takes 1-3 business days
   - May require additional information
   - Respond promptly to any requests

## ⚠️ Important Reminders

- **Privacy Policy URL is REQUIRED** - Chrome Web Store will reject without it
- **Screenshots are REQUIRED** - At least 1, up to 5 recommended
- **Test thoroughly** - Make sure all features work before submitting
- **Version number** - Increment for future updates

