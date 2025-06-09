// Background script for handling API calls and data transfer
console.log('Contact Transfer Extension background script loaded');

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.from === 'popup') {
        if (message.action === 'saveApiKey') {
            chrome.storage.local.set({ apiKey: message.apiKey }, () => {
                sendResponse({ success: true });
            });
            return true;
        }
        
        if (message.action === 'getApiKey') {
            chrome.storage.local.get(['apiKey'], (result) => {
                sendResponse({ apiKey: result.apiKey });
            });
            return true;
        }

        if (message.action === 'makeApiCall') {
            const apiKey = message.apiKey;
            if (message.subject2 === 'getWorkflowsAndTags') {
                // Fetch workflows
                const requestOptions = {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                };

                // Get all workflows
                fetch("https://rest.gohighlevel.com/v1/workflows/", requestOptions)
                .then(response => {
                    console.log('Workflow response status:', response.status);
                    return response.json();
                })
                .then(data => {
                    console.log('Workflows API response:', data);
                    let workflows = [];
                    if (data && data.workflows) {
                        workflows = data.workflows.map(workflow => ({
                            id: workflow.id,
                            name: workflow.name,
                            status: workflow.status || 'publish'
                        }));
                        console.log('Mapped workflows:', workflows);
                    }
                    // Send workflows back to popup
                    chrome.runtime.sendMessage({
                        from: 'background',
                        subject: 'loadWorkflows',
                        workflows: workflows
                    });
                })
                .catch(error => {
                    console.error('Error fetching workflows:', error);
                    // Try alternative endpoint if first one fails
                    return fetch("https://rest.gohighlevel.com/v1/pipelines/", requestOptions)
                        .then(response => response.json())
                        .then(data => {
                            console.log('Pipelines API response:', data);
                            let workflows = [];
                            if (data && data.pipelines) {
                                workflows = data.pipelines.map(pipeline => ({
                                    id: pipeline.id,
                                    name: pipeline.name,
                                    status: 'publish'
                                }));
                                console.log('Mapped pipelines:', workflows);
                            }
                            // Send workflows back to popup
                            chrome.runtime.sendMessage({
                                from: 'background',
                                subject: 'loadWorkflows',
                                workflows: workflows
                            });
                        });
                });
            }
            sendResponse({ success: true });
            return true;
        }

        if (message.action === 'transferContact') {
            chrome.storage.local.get(['apiKey', 'contactData'], (result) => {
                if (!result.apiKey) {
                    sendResponse({ success: false, message: 'API key not found' });
                    return;
                }

                const contactData = result.contactData || {};
                const apiKey = result.apiKey;

                // Validate required fields
                if (!contactData.email && !contactData.phone) {
                    sendResponse({ 
                        success: false, 
                        message: 'Error: Either email or phone number is required'
                    });
                    return;
                }

                // Create contact in GoHighLevel
                const requestOptions = {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        firstName: contactData.firstName || '',
                        lastName: contactData.lastName || '',
                        email: contactData.email || '',
                        phone: contactData.phone || '',
                        dateOfBirth: contactData.dob || '',
                        address1: contactData.address || '',
                        city: contactData.city || '',
                        state: contactData.state || '',
                        postalCode: contactData.zipcode || '',
                        country: 'US',
                        source: 'OneLink Intruity',
                        customField: {
                            dateOfBirth: contactData.dob || ''
                        }
                    })
                };

                fetch('https://rest.gohighlevel.com/v1/contacts/', requestOptions)
                .then(response => {
                    console.log('Contact creation response status:', response.status);
                    if (!response.ok) {
                        return response.text().then(text => {
                            throw new Error(`Contact creation failed: ${text}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Contact creation response:', data);
                    if (data && data.id) {
                        // If workflow is selected, add contact to workflow
                        if (message.workflowId) {
                            const current_datetime = String(new Date().toISOString()).slice(0, 19) + "+00:00";
                            const workflowOptions = {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${apiKey}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ eventStartTime: current_datetime })
                            };
                            return fetch(`https://rest.gohighlevel.com/v1/contacts/${data.id}/workflow/${message.workflowId}`, workflowOptions)
                                .then(() => data);
                        }
                        return data;
                    }
                    throw new Error('Failed to create contact: Invalid response format');
                })
                .then(data => {
                    sendResponse({ 
                        success: true, 
                        message: 'Contact transferred successfully',
                        contactId: data.id
                    });
                })
                .catch(error => {
                    console.error('Error transferring contact:', error);
                    sendResponse({ 
                        success: false, 
                        message: `Error: ${error.message}`
                    });
                });
            });
            return true;
        }
    }
});