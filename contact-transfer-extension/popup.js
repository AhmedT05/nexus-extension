class ContactTransferTool {
    constructor() {
        this.apiKey = null;
        this.scrapedData = null;
        this.init();
    }

    init() {
        this.loadApiKey();
        this.bindEvents();
    }

    async loadApiKey() {
        try {
            const result = await chrome.storage.sync.get(['nexusApiKey']);
            if (result.nexusApiKey) {
                this.apiKey = result.nexusApiKey;
                document.getElementById('api-key').value = '••••••••••••••••';
                document.getElementById('scrape-data').disabled = false;
                this.showStatus('API Key loaded successfully', 'success');
            }
        } catch (error) {
            console.error('Error loading API key:', error);
        }
    }

    bindEvents() {
        document.getElementById('save-key').addEventListener('click', () => this.saveApiKey());
        document.getElementById('scrape-data').addEventListener('click', () => this.scrapeData());
        document.getElementById('transfer-data').addEventListener('click', () => this.transferData());
    }

    async saveApiKey() {
        const apiKeyInput = document.getElementById('api-key');
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey || apiKey === '••••••••••••••••') {
            this.showStatus('Please enter a valid API key', 'error');
            return;
        }

        try {
            await chrome.storage.sync.set({ nexusApiKey: apiKey });
            this.apiKey = apiKey;
            apiKeyInput.value = '••••••••••••••••';
            document.getElementById('scrape-data').disabled = false;
            this.showStatus('API Key saved successfully', 'success');
        } catch (error) {
            this.showStatus('Error saving API key', 'error');
            console.error('Error saving API key:', error);
        }
    }

    async scrapeData() {
        if (!this.apiKey) {
            this.showStatus('Please save your API key first', 'error');
            return;
        }

        try {
            this.showStatus('Scraping data...', 'success');
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log('Current tab:', tab);
            
            if (!tab.url.includes('nexussales.io') && !tab.url.includes('intruity.com')) {
                this.showStatus('Please navigate to a supported website first', 'error');
                return;
            }

            console.log('Sending message to content script...');
            chrome.tabs.sendMessage(tab.id, { action: 'extractData' }, (response) => {
                console.log('Received response from content script:', response);
                if (chrome.runtime.lastError) {
                    console.error('Error sending message:', chrome.runtime.lastError);
                    this.showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                    return;
                }

                if (response && response.success) {
                    this.scrapedData = response.data;
                    this.displayScrapedData();
                    document.getElementById('transfer-data').disabled = false;
                    this.showStatus('Data scraped successfully', 'success');
                } else {
                    this.showStatus(response?.message || 'No contact data found on this page', 'error');
                }
            });
        } catch (error) {
            this.showStatus('Error scraping data', 'error');
            console.error('Scraping error:', error);
        }
    }

    extractContactData() {
        const data = {
            name: '',
            dob: '',
            email: '',
            phone: '',
            address: '',
            timezone: ''
        };

        const currentUrl = window.location.href;

        if (currentUrl.includes('nexussales.io')) {
            // Scraping logic for Nexus Sales
            const nameElements = document.querySelectorAll('[data-testid*="name"], .contact-name, .full-name, h1, h2');
            const emailElements = document.querySelectorAll('[type="email"], [data-testid*="email"], .email');
            const phoneElements = document.querySelectorAll('[type="tel"], [data-testid*="phone"], .phone');
            const addressElements = document.querySelectorAll('[data-testid*="address"], .address');

            for (let el of nameElements) {
                if (el.textContent && el.textContent.trim() && !data.name) {
                    data.name = el.textContent.trim();
                    break;
                }
            }

            for (let el of emailElements) {
                const email = el.value || el.textContent;
                if (email && email.includes('@') && !data.email) {
                    data.email = email.trim();
                    break;
                }
            }

            for (let el of phoneElements) {
                const phone = el.value || el.textContent;
                if (phone && (phone.match(/\d/g) || []).length >= 7 && !data.phone) {
                    data.phone = phone.trim();
                    break;
                }
            }

            for (let el of addressElements) {
                if (el.value || el.textContent) {
                    data.address = (el.value || el.textContent).trim();
                    break;
                }
            }

        } else if (currentUrl.includes('intruity.com')) {
            // Scraping logic for OneLink Intruity
            const inputs = document.querySelectorAll('input, select, textarea');
            const spans = document.querySelectorAll('span, div, td');

            inputs.forEach(input => {
                const value = input.value;
                const label = input.previousElementSibling?.textContent || input.placeholder || '';
                
                if (label.toLowerCase().includes('name') && value && !data.name) {
                    data.name = value;
                } else if (label.toLowerCase().includes('email') && value && value.includes('@')) {
                    data.email = value;
                } else if (label.toLowerCase().includes('phone') && value && (value.match(/\d/g) || []).length >= 7) {
                    data.phone = value;
                } else if (label.toLowerCase().includes('address') && value) {
                    data.address = value;
                } else if (label.toLowerCase().includes('birth') && value) {
                    data.dob = value;
                }
            });

            spans.forEach(span => {
                const text = span.textContent;
                if (text && text.includes('@') && !data.email) {
                    data.email = text.trim();
                } else if (text && (text.match(/\d/g) || []).length >= 7 && text.length < 20 && !data.phone) {
                    data.phone = text.trim();
                }
            });
        }

        // Auto-detect timezone
        data.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        return data;
    }

    displayScrapedData() {
        const preview = document.getElementById('contact-preview');
        const details = document.getElementById('contact-details');
        
        let html = '';
        for (const [key, value] of Object.entries(this.scrapedData)) {
            if (value) {
                html += `<div class="field"><strong>${this.formatFieldName(key)}:</strong> ${value}</div>`;
            }
        }
        
        details.innerHTML = html || '<div class="field">No data found</div>';
        preview.style.display = 'block';
    }

    formatFieldName(key) {
        const fieldNames = {
            name: 'Name',
            dob: 'Date of Birth',
            email: 'Email',
            phone: 'Phone',
            address: 'Address',
            timezone: 'Timezone'
        };
        return fieldNames[key] || key;
    }

    async transferData() {
        if (!this.scrapedData || !this.apiKey) {
            this.showStatus('No data to transfer or API key missing', 'error');
            return;
        }

        try {
            this.showStatus('Transferring data...', 'success');
            console.log('Starting transfer with data:', this.scrapedData);

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            chrome.runtime.sendMessage({
                action: 'transferContact',
                contactData: this.scrapedData,
                apiKey: this.apiKey
            }, (response) => {
                console.log('Transfer response:', response);
                
                if (chrome.runtime.lastError) {
                    console.error('Error during transfer:', chrome.runtime.lastError);
                    this.showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                    return;
                }

                if (response && response.success) {
                    this.showStatus('Contact transferred successfully!', 'success');
                    console.log('Transfer successful:', response);
                } else {
                    const errorMessage = response?.message || 'Unknown error during transfer';
                    this.showStatus(errorMessage, 'error');
                    console.error('Transfer failed:', errorMessage);
                }
            });
        } catch (error) {
            this.showStatus('Error during transfer', 'error');
            console.error('Transfer error:', error);
        }
    }

    showStatus(message, type) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';
        
        setTimeout(() => {
            status.style.display = 'none';
        }, 5000);
    }
}

// Initialize the tool when popup loads
document.addEventListener('DOMContentLoaded', () => {
    new ContactTransferTool();
});