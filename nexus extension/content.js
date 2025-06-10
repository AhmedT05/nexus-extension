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
                chrome.runtime.sendMessage({
                        from: 'content',
                        action: 'extractData',
                        data: contactData
                    });
                    sendResponse({ success: true });
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
        } else if (message.action === 'getWorkflows') {
            // On OneLink, we don't need to get workflows
            if (window.location.href.includes('onelink.intruity.com')) {
                console.log('On OneLink website - no workflows to fetch');
                sendResponse([]);
            } else {
                // This will be handled by the background script for Nexus Sales
                sendResponse([]);
        }
    }
    
    return true; // Keep message channel open
});

function extractContactData() {
        const data = {
            firstName: '',
            lastName: '',
            dob: '',
            email: '',
            phone: '',
            address: '',
            city: '',
            state: '',
            zipcode: '',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    
        const currentUrl = window.location.href;
        console.log('Current URL:', currentUrl);

        if (currentUrl.includes('onelink.intruity.com')) {
            // Log all form fields first
            const allInputs = document.querySelectorAll('input, select, textarea');
            console.log('All form fields:', Array.from(allInputs).map(input => ({
                name: input.name,
                id: input.id,
                type: input.type,
                value: input.value,
                className: input.className,
                hidden: input.hidden,
                style: input.style.display,
                parentHTML: input.parentElement?.outerHTML
            })));

            // Scraping logic for OneLink Intruity
            const inputs = document.querySelectorAll('input, select, textarea');
            const spans = document.querySelectorAll('span, div, td');
            const labels = document.querySelectorAll('label');

            // First check all inputs and their labels
            inputs.forEach(input => {
                const value = input.value.trim();
                const label = input.previousElementSibling?.textContent?.trim() || input.placeholder?.trim() || '';
                const name = input.name?.trim() || '';
                const id = input.id?.trim() || '';
                
                console.log('Processing input:', {
                    value: value,
                    label: label,
                    name: name,
                    id: id,
                    type: input.type,
                    maxLength: input.maxLength,
                    className: input.className,
                    parentHTML: input.parentElement?.outerHTML
                });

                // Check for first name
                if ((label.toLowerCase().includes('first name') || name.toLowerCase().includes('firstname') || id.toLowerCase().includes('firstname')) && value) {
                    console.log('Found first name input:', value);
                    data.firstName = value.split(' ')[0]; // Only take the first part
                }
                // Check for last name
                else if ((label.toLowerCase().includes('last name') || name.toLowerCase().includes('lastname') || id.toLowerCase().includes('lastname')) && value) {
                    console.log('Found last name input:', value);
                    data.lastName = value;
                }
                // Check for full name if first/last not found
                else if ((label.toLowerCase().includes('name') || name.toLowerCase().includes('name') || id.toLowerCase().includes('name')) && value && !data.firstName && !data.lastName) {
                    console.log('Found full name input:', value);
                    // If the value contains a space, it's likely a full name
                    if (value.includes(' ')) {
                        const nameParts = value.split(' ');
                        data.firstName = nameParts[0];
                        data.lastName = nameParts.slice(1).join(' ');
                    } else {
                        data.firstName = value;
                    }
                }
                // Check for email
                else if ((label.toLowerCase().includes('email') || name.toLowerCase().includes('email') || id.toLowerCase().includes('email')) && value.includes('@')) {
                    console.log('Found email input:', value);
                    data.email = value;
        }
                // Check for phone
                else if ((label.toLowerCase().includes('phone') || name.toLowerCase().includes('phone') || id.toLowerCase().includes('phone')) && value) {
                    const phoneDigits = value.replace(/\D/g, '');
                    if (phoneDigits.length >= 10) {
                        console.log('Found phone input:', value);
                        data.phone = value;
                    }
                }
                // Check for DOB
                else if ((label.toLowerCase().includes('birth') || name.toLowerCase().includes('birth') || name.toLowerCase().includes('dob') || id.toLowerCase().includes('birth') || id.toLowerCase().includes('dob')) && value) {
                    console.log('Found DOB input:', value);
                    data.dob = value;
                }
                // Check for address
                else if ((label.toLowerCase().includes('address') || name.toLowerCase().includes('address') || id.toLowerCase().includes('address')) && value) {
                    console.log('Found address field:', {
                        value: value,
                        currentState: data.state
                    });
                    data.address = value;
                    const parsedAddress = parseAddress(value);
                    if (parsedAddress) {
                        console.log('Parsed address:', parsedAddress);
                        data.address = parsedAddress.street;
                        data.city = parsedAddress.city;
                        // Only set state if it's not already set
                        if (!data.state) {
                            data.state = parsedAddress.state;
                            console.log('State value set from address to:', data.state);
                        } else {
                            console.log('Keeping existing state value:', data.state);
                        }
                        data.zipcode = parsedAddress.zip;
                    }
                }
                // Check for city
                else if ((label.toLowerCase().includes('city') || name.toLowerCase().includes('city') || id.toLowerCase().includes('city')) && value) {
                    data.city = value;
                }
                // Check for state
                else if ((label.toLowerCase().includes('state') || name.toLowerCase().includes('state') || id.toLowerCase().includes('state')) && value) {
                    // Skip hidden inputs
                    if (input.type === 'hidden') {
                        console.log('Skipping hidden input:', {
                            name: name,
                            id: id,
                            value: value
                        });
                        return;
                    }

                    console.log('Found potential state field:', {
                        value: value,
                        label: label,
                        name: name,
                        id: id,
                        type: input.type,
                        maxLength: input.maxLength,
                        className: input.className,
                        parentHTML: input.parentElement?.outerHTML,
                        currentState: data.state
                    });
                    
                    // For OneLink state field (form-group structure)
                    if (input.id === 'State' && input.name === 'State' && input.type === 'text' && input.maxLength === 2) {
                        console.log('Found OneLink state field, using value:', value);
                        data.state = value;
                        console.log('State value set to:', data.state);
                    } else {
                        // For other cases, try to find the state text
                        const stateText = input.closest('div')?.querySelector('.state-text')?.textContent?.trim();
                        console.log('Found state text:', stateText);
                        data.state = stateText || value;
                        console.log('State value set to:', data.state);
                    }
                }
                // Check for zip
                else if ((label.toLowerCase().includes('zip') || name.toLowerCase().includes('zip') || id.toLowerCase().includes('zip') || label.toLowerCase().includes('postal') || name.toLowerCase().includes('postal') || id.toLowerCase().includes('postal')) && value) {
                    data.zipcode = value;
                }
            });

            // Check all spans and their associated labels
            spans.forEach(span => {
                const text = span.textContent.trim();
                const label = span.previousElementSibling?.textContent?.trim() || '';
                const id = span.id?.trim() || '';
                
                console.log('Checking span:', { text, label, id });

                // Check for email in spans
                if (text && text.includes('@') && (label.toLowerCase().includes('email') || id.toLowerCase().includes('email'))) {
                    console.log('Found email in span:', text);
                    data.email = text;
                }
                
                // Check for phone in spans
                if (text && (label.toLowerCase().includes('phone') || id.toLowerCase().includes('phone'))) {
                    const phoneDigits = text.replace(/\D/g, '');
                    if (phoneDigits.length >= 10) {
                        console.log('Found phone in span:', text);
                        data.phone = text;
                    }
    }
    
                // Check for DOB in spans
                if (text && (label.toLowerCase().includes('birth') || label.toLowerCase().includes('dob') || id.toLowerCase().includes('birth') || id.toLowerCase().includes('dob'))) {
                    const trimmedText = text.trim();
                    // Only use the value if it's a valid date format
                    if (trimmedText && trimmedText.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                        console.log('Found DOB in span:', trimmedText);
                        data.dob = trimmedText;
                    }
                }
            });
        }

        console.log('Final extracted data:', data);
        // Log all state-related fields
        console.log('State-related fields:', {
            state: data.state,
            address: data.address,
            city: data.city,
            zipcode: data.zipcode
        });
        return data;
    }

    function parseAddress(addressString) {
        if (!addressString) return null;

        // Common patterns for US addresses
        const patterns = [
            // Pattern: "123 Main St, City, State ZIP"
            /^(.+?),\s*(.+?),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/i,
            // Pattern: "123 Main St City, State ZIP"
            /^(.+?)\s+(.+?),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/i,
            // Pattern: "123 Main St, City State ZIP"
            /^(.+?),\s*(.+?)\s+([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/i
        ];

        for (const pattern of patterns) {
            const match = addressString.match(pattern);
            if (match) {
                return {
                    street: match[1].trim(),
                    city: match[2].trim(),
                    state: match[3].trim(),
                    zip: match[4].trim()
                };
            }
        }

        // If no pattern matches, try to split by commas
        const parts = addressString.split(',').map(part => part.trim());
        if (parts.length >= 3) {
            // Don't split state and zip, use the state value from the form
            return {
                street: parts[0],
                city: parts[1],
                state: '', // Let the state field handle this
                zip: parts[2] || ''
            };
        }

        return null;
}

function hasValidData(contactData) {
        const hasData = !!(contactData.email || contactData.phone);
        console.log('Data validation:', { hasData, contactData });
        return hasData;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
            padding: 15px 25px;
        border-radius: 5px;
        color: white;
        font-family: Arial, sans-serif;
        font-size: 14px;
            z-index: 999999;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transition: opacity 0.3s ease-in-out;
    `;
    
    // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                notification.style.backgroundColor = '#f44336';
                break;
            case 'warning':
                notification.style.backgroundColor = '#ff9800';
                break;
            default:
                notification.style.backgroundColor = '#2196F3';
        }

    notification.textContent = message;
    document.body.appendChild(notification);
    
        // Remove notification after 5 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
                document.body.removeChild(notification);
        }, 300);
    }, 5000);
}

function addExtensionIndicator() {
    const indicator = document.createElement('div');
    indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
            background-color: #4CAF50;
        color: white;
            padding: 10px 20px;
            border-radius: 5px;
        font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 999999;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    indicator.textContent = 'Contact Transfer Extension Active';
    document.body.appendChild(indicator);
}

    // Add extension indicator when the page loads
    addExtensionIndicator();
}