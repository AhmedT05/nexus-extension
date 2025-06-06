// Background service worker for Chrome extension
class BackgroundService {
    constructor() {
        this.init();
    }

    init() {
        // Listen for extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstallation(details);
        });

        // Listen for messages from content scripts and popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });

        // Listen for tab updates to inject content scripts
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });
    }

    handleInstallation(details) {
        console.log('Contact Transfer Extension installed:', details);
        
        // Set default settings
        chrome.storage.sync.set({
            extensionVersion: chrome.runtime.getManifest().version,
            installDate: new Date().toISOString()
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'validateApiKey':
                    await this.validateApiKey(message.apiKey, sendResponse);
                    break;
                
                case 'transferContact':
                    await this.transferContact(message.contactData, message.apiKey, sendResponse);
                    break;
                
                case 'getTabInfo':
                    await this.getTabInfo(sendResponse);
                    break;
                
                case 'logActivity':
                    this.logActivity(message.activity);
                    sendResponse({ success: true });
                    break;
                
                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background script error:', error);
            sendResponse({ error: error.message });
        }
    }

    async handleTabUpdate(tabId, changeInfo, tab) {
        // Only process when tab is completely loaded
        if (changeInfo.status !== 'complete') return;

        // Check if this is a supported website
        const supportedSites = [
            'app.nexussales.io',
            'onelink.intruity.com'
        ];

        const isSupportedSite = supportedSites.some(site => 
            tab.url && tab.url.includes(site)
        );

        if (isSupportedSite) {
            try {
                // Inject content script if not already present
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                });
            } catch (error) {
                // Content script might already be injected
                console.log('Content script injection skipped:', error.message);
            }
        }
    }

    async validateApiKey(apiKey, sendResponse) {
        try {
            // Test the API key with a simple request
            const response = await fetch('https://rest.gohighlevel.com/v1/locations/', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                sendResponse({ valid: true, message: 'API key is valid' });
            } else {
                sendResponse({ valid: false, message: 'Invalid API key' });
            }
        } catch (error) {
            sendResponse({ valid: false, message: 'Error validating API key' });
        }
    }

    async transferContact(contactData, apiKey, sendResponse) {
        try {
            console.log('Starting contact transfer with data:', contactData);
            
            // Prepare the contact payload
            const payload = {
                firstName: this.extractFirstName(contactData.name),
                lastName: this.extractLastName(contactData.name),
                email: contactData.email || '',
                phone: this.formatPhoneNumber(contactData.phone) || '',
                address1: contactData.address || '',
                dateOfBirth: this.formatDateOfBirth(contactData.dob),
                timezone: contactData.timezone || 'America/New_York',
                source: 'Contact Transfer Extension',
                tags: ['imported', 'extension-transfer']
            };

            console.log('Sending payload to API:', payload);

            const response = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            console.log('API Response status:', response.status);
            const responseText = await response.text();
            console.log('API Response body:', responseText);

            if (response.ok) {
                const result = JSON.parse(responseText);
                
                // Log successful transfer
                this.logActivity({
                    action: 'contact_transferred',
                    contactId: result.contact?.id,
                    timestamp: new Date().toISOString(),
                    success: true
                });

                // Find and refresh all Nexus Sales tabs
                try {
                    const tabs = await chrome.tabs.query({ url: '*://*.nexussales.io/*' });
                    console.log('Found Nexus Sales tabs:', tabs.length);
                    
                    if (tabs.length === 0) {
                        console.log('No Nexus Sales tabs found to refresh');
                    } else {
                        for (const tab of tabs) {
                            try {
                                console.log('Attempting to refresh tab:', tab.id, tab.url);
                                await chrome.tabs.reload(tab.id, { bypassCache: true });
                                console.log('Successfully refreshed tab:', tab.id);
                            } catch (error) {
                                console.error('Error refreshing tab:', tab.id, error);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error finding or refreshing tabs:', error);
                }

                sendResponse({ 
                    success: true, 
                    message: 'Contact transferred successfully',
                    contactId: result.contact?.id
                });
            } else {
                let errorMessage = 'Transfer failed';
                try {
                    const errorData = JSON.parse(responseText);
                    errorMessage = errorData.message || errorData.error || `Transfer failed: ${response.status}`;
                } catch (e) {
                    errorMessage = `Transfer failed: ${response.status} - ${responseText}`;
                }

                console.error('Transfer error:', errorMessage);
                sendResponse({ 
                    success: false, 
                    message: errorMessage
                });
            }
        } catch (error) {
            console.error('Transfer error:', error);
            sendResponse({ 
                success: false, 
                message: `Transfer error: ${error.message}` 
            });
        }
    }

    async getTabInfo(sendResponse) {
        try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            const tabInfo = {
                url: activeTab.url,
                title: activeTab.title,
                isSupported: this.isSupportedSite(activeTab.url)
            };

            sendResponse(tabInfo);
        } catch (error) {
            sendResponse({ error: error.message });
        }
    }

    isSupportedSite(url) {
        const supportedSites = [
            'app.nexussales.io',
            'onelink.intruity.com'
        ];
        return supportedSites.some(site => url && url.includes(site));
    }

    extractFirstName(fullName) {
        if (!fullName) return '';
        return fullName.split(' ')[0];
    }

    extractLastName(fullName) {
        if (!fullName) return '';
        const parts = fullName.split(' ');
        return parts.length > 1 ? parts.slice(1).join(' ') : '';
    }

    formatPhoneNumber(phone) {
        if (!phone) return '';
        // Remove all non-digits
        const digits = phone.replace(/\D/g, '');
        
        // Format as (XXX) XXX-XXXX if 10 digits
        if (digits.length === 10) {
            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }
        
        // Return original if not standard format
        return phone;
    }

    formatDateOfBirth(dob) {
        if (!dob) return '';
        
        try {
            // Try to parse and format as YYYY-MM-DD
            const date = new Date(dob);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (error) {
            console.log('Date parsing error:', error);
        }
        
        return dob;
    }

    logActivity(activity) {
        // Store activity log in local storage
        chrome.storage.local.get(['activityLog'], (result) => {
            const log = result.activityLog || [];
            log.push(activity);
            
            // Keep only last 100 activities
            if (log.length > 100) {
                log.shift();
            }
            
            chrome.storage.local.set({ activityLog: log });
        });
    }

    setupContextMenus() {
        chrome.contextMenus.create({
            id: 'extract-contact',
            title: 'Extract Contact Data',
            contexts: ['page'],
            documentUrlPatterns: [
                'https://app.nexussales.io/*',
                'https://onelink.intruity.com/*'
            ]
        });

        chrome.contextMenus.onClicked.addListener((info, tab) => {
            if (info.menuItemId === 'extract-contact') {
                // Send message to content script to extract data
                chrome.tabs.sendMessage(tab.id, { action: 'extractData' });
            }
        });
    }
}

// Initialize the background service
const backgroundService = new BackgroundService();

// Set up context menus when extension loads
chrome.runtime.onStartup.addListener(() => {
    backgroundService.setupContextMenus();
});

// Also set up on install
chrome.runtime.onInstalled.addListener(() => {
    backgroundService.setupContextMenus();
});