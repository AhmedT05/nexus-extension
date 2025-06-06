// Content script for extracting contact data from OneLink/Intruity
console.log('Contact Transfer Extension content script loaded');

// Prevent multiple script injections
if (window.contactTransferExtensionLoaded) {
    console.log('Contact Transfer Extension already loaded');
} else {
    window.contactTransferExtensionLoaded = true;

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Content script received message:', message);
        
        if (message.action === 'extractData') {
            try {
                console.log('Starting data extraction...');
                const contactData = extractContactData();
                console.log('Extracted contact data:', contactData);
                
                if (contactData && hasValidData(contactData)) {
                    showNotification('Contact data extracted successfully!', 'success');
                    sendResponse({ success: true, data: contactData });
                } else {
                    const message = 'No contact data found on this page. Make sure you\'re on a contact details page.';
                    console.log(message);
                    showNotification(message, 'warning');
                    sendResponse({ 
                        success: false, 
                        message: message
                    });
                }
            } catch (error) {
                console.error('Error extracting contact data:', error);
                const errorMessage = `Error extracting data: ${error.message}`;
                showNotification(errorMessage, 'error');
                sendResponse({ 
                    success: false, 
                    message: errorMessage
                });
            }
        }
        
        return true; // Keep message channel open
    });

    function extractContactData() {
        console.log('Starting contact data extraction...');
        console.log('Current URL:', window.location.href);
        
        const data = {
            name: '',
            dob: '',
            email: '',
            phone: '',
            address: '',
            timezone: ''
        };

        // Log all form elements for debugging
        const allInputs = document.querySelectorAll('input, select, textarea');
        console.log('All form elements found:', allInputs.length);
        allInputs.forEach(input => {
            console.log('Form element:', {
                type: input.type,
                name: input.name,
                id: input.id,
                value: input.value,
                placeholder: input.placeholder
            });
        });

        // Try to find data in form inputs
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            const value = input.value;
            const name = input.name?.toLowerCase() || '';
            const id = input.id?.toLowerCase() || '';
            const placeholder = input.placeholder?.toLowerCase() || '';
            
            console.log('Checking input:', { name, id, placeholder, value });
            
            if (value) {
                if ((name.includes('name') || id.includes('name') || placeholder.includes('name')) && !data.name) {
                    data.name = value.trim();
                    console.log('Found name:', data.name);
                } else if ((name.includes('email') || id.includes('email') || placeholder.includes('email')) && !data.email) {
                    data.email = value.trim();
                    console.log('Found email:', data.email);
                } else if ((name.includes('phone') || id.includes('phone') || placeholder.includes('phone')) && !data.phone) {
                    data.phone = value.trim();
                    console.log('Found phone:', data.phone);
                } else if ((name.includes('address') || id.includes('address') || placeholder.includes('address')) && !data.address) {
                    data.address = value.trim();
                    console.log('Found address:', data.address);
                } else if ((name.includes('birth') || id.includes('birth') || placeholder.includes('birth') || 
                          name.includes('dob') || id.includes('dob') || placeholder.includes('dob')) && !data.dob) {
                    data.dob = value.trim();
                    console.log('Found DOB:', data.dob);
                }
            }
        });

        // Try to find data in labels
        const labels = document.querySelectorAll('label');
        console.log('Found labels:', labels.length);
        labels.forEach(label => {
            const text = label.textContent.toLowerCase();
            console.log('Checking label:', text);
            
            // Try to find the associated input
            const input = label.nextElementSibling;
            if (input && input.value) {
                console.log('Found input for label:', input.value);
                if (text.includes('name') && !data.name) {
                    data.name = input.value.trim();
                } else if (text.includes('email') && !data.email) {
                    data.email = input.value.trim();
                } else if (text.includes('phone') && !data.phone) {
                    data.phone = input.value.trim();
                } else if (text.includes('address') && !data.address) {
                    data.address = input.value.trim();
                } else if ((text.includes('birth') || text.includes('dob')) && !data.dob) {
                    data.dob = input.value.trim();
                }
            }
        });

        // Try to find data in table cells
        const cells = document.querySelectorAll('td');
        console.log('Found table cells:', cells.length);
        cells.forEach(cell => {
            const text = cell.textContent.toLowerCase();
            console.log('Checking cell:', text);
            
            if (text.includes('name:') && !data.name) {
                data.name = cell.textContent.split(':')[1]?.trim();
            } else if (text.includes('email:') && !data.email) {
                data.email = cell.textContent.split(':')[1]?.trim();
            } else if (text.includes('phone:') && !data.phone) {
                data.phone = cell.textContent.split(':')[1]?.trim();
            } else if (text.includes('address:') && !data.address) {
                data.address = cell.textContent.split(':')[1]?.trim();
            } else if ((text.includes('birth:') || text.includes('dob:')) && !data.dob) {
                data.dob = cell.textContent.split(':')[1]?.trim();
            }
        });

        // Auto-detect timezone
        data.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        console.log('Final extracted data:', data);

        return data;
    }

    function hasValidData(contactData) {
        const hasData = !!(contactData.name || contactData.email || contactData.phone);
        console.log('Data validation:', { hasData, contactData });
        return hasData;
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 300px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: opacity 0.3s ease;
            background-color: ${type === 'success' ? '#4CAF50' : 
                             type === 'error' ? '#f44336' : 
                             type === 'warning' ? '#ff9800' : 
                             '#2196F3'};
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    // Add visual indicator
    function addExtensionIndicator() {
        if (document.getElementById('contact-transfer-indicator')) return;
        
        const indicator = document.createElement('div');
        indicator.id = 'contact-transfer-indicator';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            background: #4CAF50;
            color: white;
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 12px;
            font-family: Arial, sans-serif;
            opacity: 0.7;
        `;
        indicator.textContent = 'Contact Transfer Extension Active';
        document.body.appendChild(indicator);
        
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 1000);
        }, 3000);
    }

    // Add indicator when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addExtensionIndicator);
    } else {
        addExtensionIndicator();
    }
}