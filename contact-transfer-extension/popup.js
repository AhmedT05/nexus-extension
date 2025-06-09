class ContactTransferTool {
    constructor() {
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Extract button click handler
        document.getElementById('extractBtn')?.addEventListener('click', () => {
            this.extractData();
        });

        // Create button click handler
        document.getElementById('createBtn')?.addEventListener('click', () => {
            this.createContact();
        });

        // Workflow select change handler
        document.getElementById('workflowSelect')?.addEventListener('change', (e) => {
            document.getElementById('createBtn').disabled = !e.target.value;
        });
    }

    async extractData() {
        try {
            this.showNotification('extractNotification', 'Extracting data...', 'info');
            
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                throw new Error('No active tab found');
            }

            // Send message to content script
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractData' });
            
            if (response && response.success) {
                this.showNotification('extractNotification', 'Data extracted successfully!', 'success');
                this.displayScrapedData(response.data);
            } else {
                throw new Error(response?.message || 'Failed to extract data');
            }
        } catch (error) {
            console.error('Error extracting data:', error);
            this.showNotification('extractNotification', error.message, 'error');
        }
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
    }

    showNotification(elementId, message, type = 'info') {
        const notification = document.getElementById(elementId);
        if (!notification) return;

        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';

        // Hide notification after 5 seconds
        setTimeout(() => {
            notification.style.display = 'none';
        }, 5000);
    }

    async createContact() {
        try {
            const workflowId = document.getElementById('workflowSelect').value;
            if (!workflowId) {
                throw new Error('Please select a workflow');
            }

            this.showNotification('createNotification', 'Creating contact...', 'info');

            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                throw new Error('No active tab found');
            }

            // Send message to content script
            const response = await chrome.tabs.sendMessage(tab.id, { 
                action: 'createContact',
                workflowId: workflowId
            });
            
            if (response && response.success) {
                this.showNotification('createNotification', 'Contact created successfully!', 'success');
            } else {
                throw new Error(response?.message || 'Failed to create contact');
            }
        } catch (error) {
            console.error('Error creating contact:', error);
            this.showNotification('createNotification', error.message, 'error');
        }
    }
}

// Initialize the tool when the popup loads
document.addEventListener('DOMContentLoaded', () => {
    new ContactTransferTool();
});