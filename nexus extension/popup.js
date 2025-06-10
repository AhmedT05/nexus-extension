class ContactTransferTool {
    constructor() {
        this.init();
        this.contactData = null; // Add contact data storage
    }

    init() {
        // Initialize UI elements
        this.apiKeyInput = document.getElementById('api-key');
        this.saveKeyButton = document.getElementById('save-key');
        this.transferButton = document.getElementById('transfer-data');
        this.statusDiv = document.getElementById('status');
        this.contactPreview = document.getElementById('contact-preview');
        this.contactDetails = document.getElementById('contact-details');
        this.workflowSelect = document.getElementById('workflow');
        this.saveWorkflowCheckbox = document.getElementById('save-workflow');

        // Load saved API key and workflows
        this.loadApiKey();
        this.loadWorkflows();
        this.loadDefaultWorkflow();

        // Add event listeners
        this.saveKeyButton.addEventListener('click', () => this.saveApiKey());
        this.transferButton.addEventListener('click', () => this.transferContact());
        this.workflowSelect.addEventListener('change', () => this.handleWorkflowChange());

        // Listen for messages from content script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('Popup received message:', message);
            if (message.from === 'content' && message.action === 'extractData' && message.data) {
                console.log('Displaying scraped data:', message.data);
                this.contactData = message.data; // Store the contact data
                this.displayScrapedData(message.data);
                sendResponse({ received: true });
            } else if (message.from === 'background' && message.subject === 'loadWorkflows') {
                console.log('Received workflows:', message.workflows);
                this.loadWorkflowsList(message.workflows);
                sendResponse({ received: true });
            }
        });

        // Request data from content script
        this.requestContactData();
    }

    async loadApiKey() {
        try {
            const response = await chrome.runtime.sendMessage({ 
                from: 'popup',
                action: 'getApiKey'
            });
            
            if (response.apiKey) {
                this.apiKeyInput.value = response.apiKey;
                this.transferButton.disabled = false;
                // Load workflows after getting API key
                this.loadWorkflows();
            }
        } catch (error) {
            console.error('Error loading API key:', error);
        }
    }

    async loadWorkflows() {
        try {
            const response = await chrome.runtime.sendMessage({ 
                from: 'popup',
                action: 'getApiKey'
            });
            
            if (response.apiKey) {
                console.log('Loading workflows with API key');
                chrome.runtime.sendMessage({
                    from: 'popup',
                    action: 'makeApiCall',
                    subject2: 'getWorkflowsAndTags',
                    apiKey: response.apiKey
                });
            }
        } catch (error) {
            console.error('Error loading workflows:', error);
        }
    }

    loadWorkflowsList(workflows) {
        console.log('Loading workflows list:', workflows);
        if (!workflows || !workflows.length) {
            console.log('No workflows available');
            return;
        }

        // Clear existing options
        this.workflowSelect.innerHTML = '<option value="">Select a workflow</option>';
        
        // Add new options
        workflows.forEach(workflow => {
            console.log('Adding workflow:', workflow);
            const option = document.createElement('option');
            option.value = workflow.id;
            option.textContent = workflow.name;
            this.workflowSelect.appendChild(option);
        });

        // Load and set the default workflow after populating the select
        this.loadDefaultWorkflow();
    }

    async saveApiKey() {
        const apiKey = this.apiKeyInput.value.trim();
        if (!apiKey) {
            this.showStatus('Please enter an API key', 'error');
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({
                from: 'popup',
                action: 'saveApiKey',
                apiKey: apiKey
            });

            if (response.success) {
                this.showStatus('API key saved successfully', 'success');
                this.transferButton.disabled = false;
                // Load workflows after saving API key
                this.loadWorkflows();
            } else {
                this.showStatus('Failed to save API key', 'error');
            }
        } catch (error) {
            console.error('Error saving API key:', error);
            this.showStatus('Error saving API key', 'error');
        }
    }

    async loadDefaultWorkflow() {
        try {
            const response = await chrome.runtime.sendMessage({ 
                from: 'popup',
                action: 'getDefaultWorkflow'
            });
            
            if (response.defaultWorkflow) {
                console.log('Setting default workflow:', response.defaultWorkflow);
                this.workflowSelect.value = response.defaultWorkflow;
                // Also check the save checkbox to indicate it's the default
                this.saveWorkflowCheckbox.checked = true;
            }
        } catch (error) {
            console.error('Error loading default workflow:', error);
        }
    }

    async handleWorkflowChange() {
        if (this.saveWorkflowCheckbox.checked) {
            try {
                console.log('Attempting to save default workflow:', this.workflowSelect.value);
                const response = await chrome.runtime.sendMessage({
                    from: 'popup',
                    action: 'saveDefaultWorkflow',
                    workflowId: this.workflowSelect.value
                });
                console.log('Save default workflow response:', response);
                if (response && response.success) {
                    this.showStatus('Default workflow saved', 'success');
                } else {
                    this.showStatus('Failed to save default workflow', 'error');
                }
            } catch (error) {
                console.error('Error saving default workflow:', error);
                this.showStatus('Error saving default workflow', 'error');
            }
        }
    }

    async transferContact() {
        try {
            if (!this.contactData) {
                this.showStatus('No contact data available', 'error');
                return;
            }

            const workflowId = this.workflowSelect.value;
            
            // Save as default workflow if checkbox is checked
            if (this.saveWorkflowCheckbox.checked) {
                await chrome.runtime.sendMessage({
                    from: 'popup',
                    action: 'saveDefaultWorkflow',
                    workflowId: workflowId
                });
            }

            const response = await chrome.runtime.sendMessage({
                from: 'popup',
                action: 'transferContact',
                workflowId: workflowId,
                contactData: this.contactData
            });

            if (response.success) {
                this.showStatus(response.message, 'success');
            } else {
                this.showStatus(response.message, 'error');
            }
        } catch (error) {
            console.error('Error transferring contact:', error);
            this.showStatus('Error transferring contact', 'error');
        }
    }

    requestContactData() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            console.log('Requesting contact data from tab:', tabs[0].id);
            chrome.tabs.sendMessage(tabs[0].id, { action: 'extractData' }, (response) => {
                console.log('Received response from content script:', response);
                if (chrome.runtime.lastError) {
                    console.error('Error requesting contact data:', chrome.runtime.lastError);
                    this.showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                }
            });
        });
    }

    displayScrapedData(data) {
        const preview = document.getElementById('contact-preview');
        const details = document.getElementById('contact-details');
        if (!preview || !details) return;

        // Show the preview container
        preview.style.display = 'block';
        details.innerHTML = '';

        // Show name if available
        if (data.firstName || data.lastName) {
            const nameField = document.createElement('div');
            nameField.className = 'field';
            nameField.innerHTML = `<strong>Name:</strong> ${data.firstName || ''} ${data.lastName || ''}`;
            details.appendChild(nameField);
        }

        // Show DOB if available
        if (data.dob) {
            const dobField = document.createElement('div');
            dobField.className = 'field';
            dobField.innerHTML = `<strong>Date of Birth:</strong> ${data.dob}`;
            details.appendChild(dobField);
        }

        // Show email if available
        if (data.email) {
            const emailField = document.createElement('div');
            emailField.className = 'field';
            emailField.innerHTML = `<strong>Email:</strong> ${data.email}`;
            details.appendChild(emailField);
        }

        // Show phone if available
        if (data.phone) {
            const phoneField = document.createElement('div');
            phoneField.className = 'field';
            phoneField.innerHTML = `<strong>Phone:</strong> ${data.phone}`;
            details.appendChild(phoneField);
        }

        // Show address if available
        if (data.address || data.city || data.state || data.zipcode) {
            const addressField = document.createElement('div');
            addressField.className = 'field';
            const addressParts = [
                data.address,
                data.city,
                data.state,
                data.zipcode
            ].filter(Boolean);
            addressField.innerHTML = `<strong>Address:</strong> ${addressParts.join(', ')}`;
            details.appendChild(addressField);
        }

        // Show timezone if available
        if (data.timezone) {
            const timezoneField = document.createElement('div');
            timezoneField.className = 'field';
            timezoneField.innerHTML = `<strong>Timezone:</strong> ${data.timezone}`;
            details.appendChild(timezoneField);
        }
    }

    formatFieldName(key) {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
    }

    showStatus(message, type) {
        this.statusDiv.textContent = message;
        this.statusDiv.className = `status ${type}`;
        this.statusDiv.style.display = 'block';

        setTimeout(() => {
            this.statusDiv.style.display = 'none';
        }, 3000);
    }
}

// Initialize the tool when the popup loads
document.addEventListener('DOMContentLoaded', () => {
    new ContactTransferTool();
});