// Background script for handling API calls and data transfer
console.log('Contact Transfer Extension background script loaded');

// Workflow cache to avoid repeated API calls
let workflowCache = {
    data: null,
    timestamp: 0,
    ttl: 5 * 60 * 1000 // 5 minutes
};

// Helper function to get API base URL based on version
function getApiBaseUrl(apiVersion = 'v1') {
    if (apiVersion === 'v2') {
        return 'https://services.leadconnectorhq.com';
    }
    return 'https://rest.gohighlevel.com/v1';
}

// Helper function to format Authorization header
function getAuthorizationHeader(apiKey, apiVersion = 'v1', useBearer = true) {
    const trimmedKey = (apiKey || '').trim();
    if (!trimmedKey) {
        console.error('API key is empty or undefined');
        throw new Error('API key is required');
    }
    
    if (apiVersion === 'v1') {
        // v1 always uses Bearer
        return `Bearer ${trimmedKey}`;
    }
    
    // v2: Try without Bearer first (as per documentation)
    // If that fails with Invalid JWT, we can retry with Bearer
    if (useBearer) {
        console.log('Using Private Integration token (v2) with Bearer prefix');
        return `Bearer ${trimmedKey}`;
    } else {
        console.log('Using Private Integration token (v2) without Bearer prefix (raw token)');
        return trimmedKey;
    }
}

// Helper function to get API headers
function getApiHeaders(apiKey, apiVersion = 'v1', useBearer = true) {
    const headers = {
        'Authorization': getAuthorizationHeader(apiKey, apiVersion, useBearer),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    
    // Private Integration API v2.0 requires Version header
    if (apiVersion === 'v2') {
        headers['Version'] = '2021-07-28';
    }
    
    return headers;
}

// Rate limiting helper
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            
            // Handle rate limiting (409 or 429)
            if (response.status === 409 || response.status === 429) {
                const retryAfter = response.headers.get('Retry-After') || Math.pow(2, attempt);
                const delay = parseInt(retryAfter) * 1000;
                
                if (attempt < maxRetries) {
                    console.warn(`Rate limited (${response.status}), retrying after ${delay}ms (attempt ${attempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                } else {
                    const errorText = await response.text();
                    throw new Error(`Rate limit exceeded: ${errorText}`);
                }
            }
            
            return response;
        } catch (error) {
            if (attempt === maxRetries) throw error;
            const delay = Math.pow(2, attempt) * 1000;
            console.warn(`Request failed, retrying after ${delay}ms (attempt ${attempt}/${maxRetries}):`, error.message);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.from === 'popup') {
        if (message.action === 'saveApiKey') {
            const storageData = { apiKey: message.apiKey };
            if (message.apiVersion) {
                storageData.apiVersion = message.apiVersion;
            }
            if (message.locationId) {
                storageData.locationId = message.locationId;
            }
            chrome.storage.local.set(storageData, () => {
                sendResponse({ success: true });
            });
            return true;
        }
        
        if (message.action === 'getApiKey') {
            chrome.storage.local.get(['apiKey', 'apiVersion', 'locationId'], (result) => {
                sendResponse({ 
                    apiKey: result.apiKey,
                    apiVersion: result.apiVersion || 'v1',
                    locationId: result.locationId || ''
                });
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
                // Get API version and locationId from storage
                chrome.storage.local.get(['apiVersion', 'locationId'], async (storageResult) => {
                    const apiVersion = storageResult.apiVersion || 'v1';
                    const locationId = storageResult.locationId || '';
                    const baseUrl = getApiBaseUrl(apiVersion);
                    
                    console.log(`Using API ${apiVersion} for workflows: ${baseUrl}`);
                    
                    // For v2, locationId is required
                    if (apiVersion === 'v2' && !locationId) {
                        console.error('LocationId is required for v2 workflow requests');
                        chrome.runtime.sendMessage({
                            from: 'background',
                            subject: 'loadWorkflows',
                            workflows: []
                        });
                        sendResponse({ success: true });
                        return;
                    }
                    
                    // Check cache first (only for v1)
                    if (apiVersion === 'v1') {
                        const now = Date.now();
                        if (workflowCache.data && (now - workflowCache.timestamp) < workflowCache.ttl) {
                            console.log('Using cached workflows');
                            chrome.runtime.sendMessage({
                                from: 'background',
                                subject: 'loadWorkflows',
                                workflows: workflowCache.data
                            });
                            sendResponse({ success: true });
                            return;
                        }
                    }
                    
                // Fetch workflows
                // For v2, add locationId as query parameter
                let workflowUrl = `${baseUrl}/workflows/`;
                if (apiVersion === 'v2') {
                    if (!locationId) {
                        console.error('LocationId is required for v2 but not found in storage');
                        chrome.runtime.sendMessage({
                            from: 'background',
                            subject: 'loadWorkflows',
                            workflows: []
                        });
                        sendResponse({ success: true });
                        return;
                    }
                    workflowUrl = `${baseUrl}/workflows/?locationId=${encodeURIComponent(locationId)}`;
                    console.log('Workflow URL with locationId:', workflowUrl);
                }
                
                const requestOptions = {
                    method: 'GET',
                    headers: getApiHeaders(apiKey, apiVersion)
                };

                    // Get all workflows with retry
                    fetchWithRetry(workflowUrl, requestOptions)
                .then(async response => {
                    console.log('Workflow response status:', response.status);
                    const responseText = await response.text();
                    console.log('Workflow response text:', responseText);
                    
                    if (!response.ok) {
                        console.error('Workflow fetch failed:', response.status, responseText);
                        
                        // Provide helpful error message for common issues
                        let errorMessage = '';
                        try {
                            const errorData = JSON.parse(responseText);
                            if (errorData.message) {
                                errorMessage = errorData.message;
                                if (errorData.message.includes('LocationId')) {
                                    errorMessage += ' Make sure Location ID is saved in the extension settings.';
                                }
                            }
                        } catch (e) {
                            // Use default
                        }
                        
                        if (errorMessage) {
                            console.error('Workflow error:', errorMessage);
                        }
                        
                        // Send empty workflows array on error
                        chrome.runtime.sendMessage({
                            from: 'background',
                            subject: 'loadWorkflows',
                            workflows: []
                        });
                        return;
                    }
                    
                    try {
                        const data = JSON.parse(responseText);
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
                        // Update cache (only for v1)
                        if (apiVersion === 'v1') {
                            workflowCache.data = workflows;
                            workflowCache.timestamp = Date.now();
                        }
                        // Send workflows back to popup
                        chrome.runtime.sendMessage({
                            from: 'background',
                            subject: 'loadWorkflows',
                            workflows: workflows
                        });
                    } catch (e) {
                        console.error('Error parsing workflow response:', e);
                        chrome.runtime.sendMessage({
                            from: 'background',
                            subject: 'loadWorkflows',
                            workflows: []
                        });
                    }
                })
                .catch(error => {
                    console.error('Error fetching workflows:', error);
                    // Try alternative endpoint if first one fails (only for v1)
                    if (apiVersion === 'v1') {
                        return fetchWithRetry(`${baseUrl}/pipelines/`, requestOptions)
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
                            // Update cache
                            workflowCache.data = workflows;
                            workflowCache.timestamp = Date.now();
                            // Send workflows back to popup
                            chrome.runtime.sendMessage({
                                from: 'background',
                                subject: 'loadWorkflows',
                                workflows: workflows
                            });
                        });
                    } else {
                        // For v2, just send empty array on error
                        chrome.runtime.sendMessage({
                            from: 'background',
                            subject: 'loadWorkflows',
                            workflows: []
                        });
                    }
                        });
                });
            }
            sendResponse({ success: true });
            return true;
        }

        if (message.action === 'transferContact') {
            chrome.storage.local.get(['apiKey', 'apiVersion', 'locationId'], async (result) => {
                if (!result.apiKey) {
                    sendResponse({ success: false, message: 'API key not found' });
                    return;
                }

                const contactData = message.contactData || {};
                const apiKey = result.apiKey;
                const apiVersion = result.apiVersion || 'v1';
                const locationId = result.locationId || '';
                const baseUrl = getApiBaseUrl(apiVersion);
                
                console.log(`Using API ${apiVersion} for contact transfer: ${baseUrl}`);

                // Validate required fields
                if (!contactData.email && !contactData.phone) {
                    sendResponse({ 
                        success: false, 
                        message: 'Error: Either email or phone number is required'
                    });
                    return;
                }

                // First, check if contact already exists
                const checkExistingContact = async () => {
                    try {
                        let searchResponse;
                        let searchData;
                        
                        if (apiVersion === 'v2') {
                            // v2 uses POST /contacts/search with filters
                            if (!locationId) {
                                console.warn('locationId required for v2 contact search');
                                return null;
                            }
                            
                            const searchBody = {
                                locationId: locationId,
                                query: {
                                    filters: []
                                }
                            };
                            
                            // Add email filter if available
                            if (contactData.email) {
                                searchBody.query.filters.push({
                                    field: 'email',
                                    operator: 'eq',
                                    value: contactData.email
                                });
                            }
                            
                            // Add phone filter if available
                            if (contactData.phone) {
                                const phoneDigits = contactData.phone.replace(/\D/g, '');
                                if (phoneDigits.length >= 10) {
                                    searchBody.query.filters.push({
                                        field: 'phone',
                                        operator: 'eq',
                                        value: phoneDigits
                                    });
                                }
                            }
                            
                            if (searchBody.query.filters.length === 0) {
                                console.warn('No search filters available for v2');
                                return null;
                            }
                            
                            const searchUrl = `${baseUrl}/contacts/search`;
                            const searchOptions = {
                                method: 'POST',
                                headers: getApiHeaders(apiKey, apiVersion),
                                body: JSON.stringify(searchBody)
                            };
                            
                            console.log('Searching for existing contact (v2) at URL:', searchUrl);
                            console.log('Search body:', JSON.stringify(searchBody, null, 2));
                            searchResponse = await fetchWithRetry(searchUrl, searchOptions);
                        } else {
                            // v1 uses GET /contacts/?email=...&phone=...
                    const searchParams = new URLSearchParams();
                    if (contactData.email) {
                        searchParams.append('email', contactData.email);
                    }
                    if (contactData.phone) {
                        searchParams.append('phone', contactData.phone);
                    }

                            const searchUrl = `${baseUrl}/contacts/?${searchParams.toString()}`;
                    const searchOptions = {
                        method: 'GET',
                                headers: getApiHeaders(apiKey, apiVersion)
                            };

                            console.log('Searching for existing contact (v1) at URL:', searchUrl);
                            searchResponse = await fetchWithRetry(searchUrl, searchOptions);
                        }
                        const searchText = await searchResponse.text();
                        try {
                            searchData = JSON.parse(searchText);
                        } catch (e) {
                            console.warn('Failed to parse contacts search JSON; raw text:', searchText);
                            searchData = null;
                        }
                        console.log('Contacts search raw response status:', searchResponse.status);
                        console.log('Contacts search parsed payload keys:', searchData ? Object.keys(searchData) : 'null');
                        
                        const normalizePhone = (p) => (p || '').replace(/\D/g, '').slice(-10);
                        const targetEmail = (contactData.email || '').trim().toLowerCase();
                        const targetPhone = normalizePhone(contactData.phone);

                        let matchedContact = null;
                        // v2 returns { contacts: [...] }, v1 returns array directly or { contacts: [...] }
                        let contacts = [];
                        if (apiVersion === 'v2') {
                            contacts = searchData?.contacts || [];
                        } else {
                            contacts = Array.isArray(searchData) ? searchData : (searchData?.contacts || []);
                        }
                        
                        if (contacts && contacts.length > 0) {
                            for (const c of contacts) {
                                const foundEmail = (c.email || '').trim().toLowerCase();
                                const foundPhone = normalizePhone(c.phone);

                                const emailMatches = targetEmail && foundEmail && foundEmail === targetEmail;
                                const phoneMatches = targetPhone && foundPhone && foundPhone === targetPhone;

                                // If both provided, require at least one exact match; if only one provided, require that one.
                                const isMatch = (targetEmail && targetPhone)
                                    ? (emailMatches || phoneMatches)
                                    : (targetEmail ? emailMatches : phoneMatches);

                                if (isMatch) {
                                    matchedContact = c;
                                    break;
                                }
                            }
                        }

                        if (matchedContact) {
                            console.log('Exact match found for existing contact:', {
                                id: matchedContact.id,
                                email: matchedContact.email,
                                phone: matchedContact.phone
                            });
                            
                            // Always attempt to add existing contact to workflow if one is selected
                            if (message.workflowId) {
                                const workflowResult = await addContactToWorkflow(matchedContact.id, message.workflowId, apiKey, baseUrl, apiVersion);
                                if (workflowResult.success) {
                                    return { 
                                        success: true, 
                                        message: 'Contact added to workflow successfully',
                                        contactId: matchedContact.id,
                                        isDuplicate: false
                                    };
                                } else {
                                    console.warn('Failed to add existing contact to workflow:', workflowResult.error);
                                    return { 
                                        success: false, 
                                        message: `Failed to add contact to workflow: ${workflowResult.error}`,
                                        contactId: matchedContact.id
                                    };
                                }
                            }
                            
                            return { 
                                success: true, 
                                message: 'Contact has already been transferred',
                                contactId: matchedContact.id,
                                isDuplicate: true
                            };
                        }
                        
                        // Contact doesn't exist, proceed with creation
                        return null;
                    } catch (error) {
                        console.error('Error checking for existing contact:', error);
                        // If search fails, proceed with creation
                        return null;
                    }
                };

                // Check for existing contact first
                checkExistingContact().then(existingResult => {
                    if (existingResult) {
                        sendResponse(existingResult);
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
                        // Ensure GHL stores the correct timezone (IANA name)
                        timezone: contactData.timezone || undefined,
                        source: 'OneLink Intruity'
                    };
                    
                    // v1 supports customField, v2 does not
                    if (apiVersion === 'v1' && contactData.dob) {
                        contactPayload.customField = {
                            dateOfBirth: contactData.dob
                        };
                    }
                    
                    // v2 requires locationId in the payload
                    if (apiVersion === 'v2' && locationId) {
                        contactPayload.locationId = locationId;
                    }

                    // Remove empty fields
                    Object.keys(contactPayload).forEach(key => {
                        if (contactPayload[key] === '' || contactPayload[key] === null || contactPayload[key] === undefined) {
                            delete contactPayload[key];
                        }
                    });

                    // Remove empty custom fields (only for v1)
                    if (apiVersion === 'v1' && contactPayload.customField) {
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

                    // For v2, try with Bearer first (API seems to require it despite documentation)
                    // If that fails, we could try without Bearer as fallback
                    const tryCreateContact = async (useBearer = true) => {
                        const requestOptions = {
                            method: 'POST',
                            headers: getApiHeaders(apiKey, apiVersion, useBearer),
                            body: JSON.stringify(contactPayload)
                        };

                        console.log(`Sending contact data (v2 useBearer=${useBearer}):`, JSON.stringify(contactPayload, null, 2));
                        console.log('Authorization header:', requestOptions.headers.Authorization.substring(0, 20) + '...');

                        const response = await fetchWithRetry(`${baseUrl}/contacts/`, requestOptions);
                        console.log('Contact creation response status:', response.status);
                        console.log('Contact creation response headers:', Object.fromEntries(response.headers.entries()));
                        
                        const text = await response.text();
                        console.log('Raw API Response:', text);
                        
                        if (!response.ok) {
                            // For v2, if we get Invalid JWT without Bearer, try with Bearer
                            if (apiVersion === 'v2' && !useBearer && response.status === 401) {
                                try {
                                    const errorData = JSON.parse(text);
                                    if (errorData.message && errorData.message.includes('Invalid JWT')) {
                                        console.log('Got Invalid JWT without Bearer, retrying with Bearer...');
                                        return tryCreateContact(true); // Retry with Bearer
                                    }
                                } catch (e) {
                                    // If we can't parse, check if text contains Invalid JWT
                                    if (text.includes('Invalid JWT')) {
                                        console.log('Got Invalid JWT without Bearer, retrying with Bearer...');
                                        return tryCreateContact(true); // Retry with Bearer
                                    }
                                }
                            }
                            
                            console.error('API Error Response:', {
                                status: response.status,
                                statusText: response.statusText,
                                headers: Object.fromEntries(response.headers.entries()),
                                body: text
                            });
                            
                            // Handle authentication errors
                            if (response.status === 401 || response.status === 403) {
                                let errorMsg = 'API key is invalid or unauthorized. Please check your API key.';
                                try {
                                    const errorData = JSON.parse(text);
                                    if (errorData.message) {
                                        errorMsg = errorData.message;
                                        
                                        // Provide helpful guidance for common errors
                                        if (errorData.message.includes('does not have access to this location')) {
                                            errorMsg += ' Make sure: 1) The Location ID matches your sub-account, 2) Your Private Integration token has the correct scopes/permissions, and 3) The token is for the sub-account (not just agency-level).';
                                        } else if (errorData.message.includes('Invalid JWT')) {
                                            errorMsg += ' Please verify your Private Integration token is correct and not expired.';
                                        }
                                    }
                                } catch (e) {
                                    // Use default message
                                }
                                throw new Error(errorMsg);
                            }
                            
                            throw new Error(`Contact creation failed: ${text}`);
                        }
                        
                        return { response, text };
                    };

                    tryCreateContact()
                .then(({ response, text }) => {
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
                })
                .then(async (data) => {
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

                    // Some GHL accounts only honor timezone on update; enforce it with a follow-up call
                    if (contactData.timezone) {
                        const contactId = data.contact.id;
                        const tz = contactData.timezone;
                        const aliasMap = {
                            'America/New_York': 'US/Eastern',
                            'America/Chicago': 'US/Central',
                            'America/Denver': 'US/Mountain',
                            'America/Los_Angeles': 'US/Pacific'
                        };
                        const candidates = [tz];
                        if (aliasMap[tz]) candidates.push(aliasMap[tz]);

                        const tryUpdate = async () => {
                            for (const value of candidates) {
                                // Try PUT with 'timezone' (most reliable, works for both v1 and v2)
                                try {
                                    console.log('Attempting PUT timezone with value:', value);
                                    const resp = await fetchWithRetry(`${baseUrl}/contacts/${contactId}`, {
                                        method: 'PUT',
                                        headers: getApiHeaders(apiKey, apiVersion),
                                        body: JSON.stringify({ timezone: value })
                                    }, 2);
                                    const text = await resp.text();
                                    console.log('PUT timezone response:', resp.status, text);
                                    if (resp.ok) {
                                        const updated = JSON.parse(text);
                                        if (updated?.contact?.timezone === value || updated?.contact?.timezone === tz) {
                                            return true;
                                        }
                                    }
                                } catch (e) {
                                    console.warn('PUT timezone failed:', e);
                                }
                            }
                            return false;
                        };

                        await tryUpdate();
                    }

                    // If workflow is selected, add contact to workflow
                    if (message.workflowId) {
                        // Add a minimal delay to ensure contact is fully processed in GHL
                        console.log('Waiting 500ms before workflow enrollment...');
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        const workflowResult = await addContactToWorkflow(data.contact.id, message.workflowId, apiKey, baseUrl, apiVersion);
                        if (workflowResult.success) {
                            return { 
                                ...data, 
                                workflowAdded: true,
                                workflowMessage: 'Contact created and added to workflow successfully'
                            };
                        } else {
                            console.warn('Failed to add new contact to workflow:', workflowResult.error);
                            return { 
                                ...data, 
                                workflowAdded: false,
                                workflowError: workflowResult.error
                            };
                        }
                    }
                    return data;
                })
                .then(data => {
                    console.log('Final success response:', data);
                    // Remove the refresh feature: do not reload tabs
                    let message = 'Contact transferred successfully';
                    if (data.workflowAdded) {
                        message = data.workflowMessage || 'Contact created and added to workflow successfully';
                    } else if (data.workflowError) {
                        message = `Contact created but failed to add to workflow: ${data.workflowError}`;
                    }
                    
                    sendResponse({ 
                        success: true, 
                        message: message,
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
            });
            return true;
        }
    }
});

// Helper function to add contact to workflow with retry logic
async function addContactToWorkflow(contactId, workflowId, apiKey, baseUrl, apiVersion, maxRetries = 2) {
    const current_datetime = String(new Date().toISOString()).slice(0, 19) + "+00:00";
    const workflowOptions = {
        method: 'POST',
        headers: getApiHeaders(apiKey, apiVersion),
        body: JSON.stringify({ eventStartTime: current_datetime })
    };
    
    console.log('Adding contact to workflow:', {
        contactId: contactId,
        workflowId: workflowId,
        baseUrl: baseUrl,
        apiVersion: apiVersion
    });
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Workflow enrollment attempt ${attempt}/${maxRetries}`);
            const response = await fetchWithRetry(`${baseUrl}/contacts/${contactId}/workflow/${workflowId}`, workflowOptions);
            const responseText = await response.text();
            
            console.log(`Workflow response (attempt ${attempt}):`, {
                status: response.status,
                statusText: response.statusText,
                body: responseText
            });
            
            if (response.ok) {
                console.log('Workflow enrollment successful');
                return { success: true };
            }
            
            // If it's a 4xx error (client error), don't retry
            if (response.status >= 400 && response.status < 500) {
                console.error('Workflow enrollment failed with client error:', response.status, responseText);
                return { success: false, error: `Client error: ${response.status} - ${responseText}` };
            }
            
            // For 5xx errors or network issues, retry after a delay
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 500; // Faster exponential backoff: 500ms, 1s
                console.log(`Workflow enrollment failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('Workflow enrollment failed after all retries');
                return { success: false, error: `Server error: ${response.status} - ${responseText}` };
            }
        } catch (error) {
            console.error(`Workflow enrollment attempt ${attempt} failed:`, error);
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 500;
                console.log(`Network error, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                return { success: false, error: `Network error: ${error.message}` };
            }
        }
    }
}