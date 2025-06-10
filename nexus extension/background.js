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

        if (message.action === 'saveDefaultWorkflow') {
            console.log('Background script received saveDefaultWorkflow request:', message);
            chrome.storage.local.set({ defaultWorkflow: message.workflowId }, () => {
                console.log('Default workflow saved to storage:', message.workflowId);
                if (chrome.runtime.lastError) {
                    console.error('Error saving default workflow:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError });
                } else {
                    sendResponse({ success: true });
                }
            });
            return true;
        }

        if (message.action === 'getDefaultWorkflow') {
            console.log('Background script received getDefaultWorkflow request');
            chrome.storage.local.get(['defaultWorkflow'], (result) => {
                console.log('Retrieved default workflow from storage:', result.defaultWorkflow);
                sendResponse({ defaultWorkflow: result.defaultWorkflow });
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
            chrome.storage.local.get(['apiKey'], (result) => {
                if (!result.apiKey) {
                    sendResponse({ success: false, message: 'API key not found' });
                    return;
                }

                const contactData = message.contactData || {};
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
                const contactPayload = {
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
                        dateOfBirth: contactData.dob || '',
                        timezone: contactData.timezone || ''
                    }
                };

                // Remove empty fields
                Object.keys(contactPayload).forEach(key => {
                    if (contactPayload[key] === '' || contactPayload[key] === null || contactPayload[key] === undefined) {
                        delete contactPayload[key];
                    }
                });

                // Remove empty custom fields
                if (contactPayload.customField) {
                    Object.keys(contactPayload.customField).forEach(key => {
                        if (contactPayload.customField[key] === '' || contactPayload.customField[key] === null || contactPayload.customField[key] === undefined) {
                            delete contactPayload.customField[key];
                        }
                    });
                    // Remove customField if empty
                    if (Object.keys(contactPayload.customField).length === 0) {
                        delete contactPayload.customField;
                    }
                }

                const requestOptions = {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(contactPayload)
                };

                console.log('Sending contact data:', JSON.stringify(contactPayload, null, 2));

                fetch('https://rest.gohighlevel.com/v1/contacts/', requestOptions)
                .then(response => {
                    console.log('Contact creation response status:', response.status);
                    console.log('Contact creation response headers:', Object.fromEntries(response.headers.entries()));
                    
                    // Log the raw response first
                    return response.text().then(text => {
                        console.log('Raw API Response:', text);
                        console.log('Response type:', typeof text);
                        console.log('Response length:', text.length);
                        
                        if (!response.ok) {
                            console.error('API Error Response:', {
                                status: response.status,
                                statusText: response.statusText,
                                headers: Object.fromEntries(response.headers.entries()),
                                body: text
                            });
                            throw new Error(`Contact creation failed: ${text}`);
                        }
                        
                        try {
                            const parsedData = JSON.parse(text);
                            console.log('Parsed data structure:', {
                                hasId: !!parsedData?.contact?.id,
                                keys: Object.keys(parsedData),
                                type: typeof parsedData,
                                isArray: Array.isArray(parsedData),
                                fullData: parsedData
                            });
                            return parsedData;
                        } catch (e) {
                            console.error('Failed to parse API response:', e);
                            console.error('Raw text that failed to parse:', text);
                            throw new Error(`Invalid JSON response from API: ${text}`);
                        }
                    });
                })
                .then(data => {
                    console.log('Parsed contact creation response:', data);
                    console.log('Response data type:', typeof data);
                    console.log('Response data keys:', Object.keys(data));
                    
                    // Check if we have a valid contact ID in the nested contact object
                    if (!data?.contact?.id) {
                        console.error('Invalid API Response:', {
                            data,
                            type: typeof data,
                            keys: data ? Object.keys(data) : 'null',
                            stringified: JSON.stringify(data, null, 2)
                        });
                        throw new Error(`Failed to create contact: Invalid response format - ${JSON.stringify(data)}`);
                    }

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
                        
                        console.log('Adding contact to workflow:', {
                            contactId: data.contact.id,
                            workflowId: message.workflowId
                        });
                        
                        return fetch(`https://rest.gohighlevel.com/v1/contacts/${data.contact.id}/workflow/${message.workflowId}`, workflowOptions)
                            .then(response => {
                                console.log('Workflow response status:', response.status);
                                return response.text().then(text => {
                                    console.log('Workflow response:', text);
                                    if (!response.ok) {
                                        throw new Error(`Failed to add contact to workflow: ${text}`);
                                    }
                                    return data;
                                });
                            });
                    }
                    return data;
                })
                .then(data => {
                    console.log('Final success response:', data);
                    // Refresh all Nexus website tabs
                    chrome.tabs.query({}, function(tabs) {
                        tabs.forEach(tab => {
                            if (tab.url && tab.url.includes('nexussales.io')) {
                                chrome.tabs.reload(tab.id);
                            }
                        });
                    });
                    sendResponse({ 
                        success: true, 
                        message: 'Contact transferred successfully',
                        contactId: data.contact.id
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