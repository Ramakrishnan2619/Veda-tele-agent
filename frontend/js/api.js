/**
 * @file frontend/js/api.js
 * @description MOD-15 — API Wrapper Service.
 *
 * Centralized fetch wrapper that handles:
 *   - Automatic ID Token injection in Authorization header.
 *   - Base URL configuration.
 *   - Global 401 handling for session expiry.
 */

import { getIdToken, logout } from "./auth.js";
import { API_BASE_URL, MOCK_MODE } from "./config.js";

// Mock Database state stored in session storage to persist changes
const MOCK_STORAGE_KEY = 'veda_mock_db';
const getMockDB = () => {
    let db = sessionStorage.getItem(MOCK_STORAGE_KEY);
    if (!db) {
        db = {
            profile: { business_name: 'Veda Demo Corp', industry: 'SaaS', core_value_prop: 'Veda Tele-Agent uses Google Gemini 1.5 Flash to automatically qualify outbound leads, handle complex customer objections, and capture call transcripts in real-time.' },
            campaigns: [
                { id: 'camp_1', name: 'Q2 Outbound Lead Qualification' },
                { id: 'camp_2', name: 'Product Upgrade Outreach' }
            ],
            analytics: {
                camp_1: {
                    total_calls: 142,
                    conversion_rate: 28,
                    qualified_leads: 40,
                    intent_breakdown: { INTERESTED: 40, CALLBACK: 22, NOT_INTERESTED: 80 },
                    status_breakdown: { completed: 130, failed: 12 }
                },
                camp_2: {
                    total_calls: 85,
                    conversion_rate: 35,
                    qualified_leads: 30,
                    intent_breakdown: { INTERESTED: 30, CALLBACK: 15, NOT_INTERESTED: 40 },
                    status_breakdown: { completed: 80, failed: 5 }
                }
            },
            leads: {
                camp_1: [
                    { id: 'lead_1', customer_name: 'Alice Johnson', phone_number: '+1 (555) 123-4567', call_status: 'completed', call_duration_sec: 78, extracted_data: { intent: 'INTERESTED' }, transcript: 'AI: Hello Alice, I\'m calling from Veda Demo to see if you had 2 minutes to chat about our new automation features?\nCustomer: Yes, actually I do. Tell me more.\nAI: Great! Our platform automates lead outreach with voice agents.\nCustomer: That sounds like exactly what we need. Can you send me details?\nAI: Absolutely, I will trigger an SMS with a signup link.' },
                    { id: 'lead_2', customer_name: 'Bob Smith', phone_number: '+1 (555) 987-6543', call_status: 'completed', call_duration_sec: 45, extracted_data: { intent: 'CALLBACK' }, transcript: 'AI: Hello Bob, calling from Veda Demo regarding your interest in our product.\nCustomer: Can you call me back tomorrow at 2 PM?\nAI: Sure thing, I will mark this down as a callback.' },
                    { id: 'lead_3', customer_name: 'Carol Danvers', phone_number: '+1 (555) 555-5555', call_status: 'failed', call_duration_sec: 12, extracted_data: { intent: 'NOT_INTERESTED' }, transcript: 'AI: Hello Carol...\nCustomer: Please remove me from your list.\nAI: No problem, updating status.' }
                ],
                camp_2: [
                    { id: 'lead_4', customer_name: 'David Miller', phone_number: '+1 (555) 666-7777', call_status: 'completed', call_duration_sec: 50, extracted_data: { intent: 'INTERESTED' }, transcript: 'AI: Hello David, I\'m reaching out about upgrading your Veda subscription.\nCustomer: Hey, yes I was thinking about it. Is there a discount?\nAI: We have a 15% discount for annual renewals.\nCustomer: Sign me up for that.' },
                    { id: 'lead_5', customer_name: 'Eve Adams', phone_number: '+1 (555) 888-9999', call_status: 'completed', call_duration_sec: 32, extracted_data: { intent: 'INTERESTED' }, transcript: 'AI: Hello Eve, calling to confirm your product upgrade.\nCustomer: Yes, it looks good. Let\'s proceed.' }
                ]
            },
            adminStats: {
                total_businesses: 12,
                total_campaigns: 24,
                total_calls_made: 1420
            },
            adminBusinesses: {
                data: [
                    { id: 'biz_1', business_name: 'Acme Solar Solutions', industry: 'Solar', campaign_count: 3 },
                    { id: 'biz_2', business_name: 'Veda Medical Group', industry: 'Healthcare', campaign_count: 2 },
                    { id: 'biz_3', business_name: 'Nexus Real Estate', industry: 'Real Estate', campaign_count: 5 }
                ]
            }
        };
        sessionStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
    } else {
        db = JSON.parse(db);
    }
    return db;
};

const saveMockDB = (db) => {
    sessionStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
};

const handleMockRequest = async (endpoint, options = {}) => {
    // Artificial latency to feel like a real network call
    await new Promise(resolve => setTimeout(resolve, 300));
    const db = getMockDB();

    // 1. Business Profile
    if (endpoint === '/api/business/profile') {
        if (options.method === 'POST' || options.method === 'PATCH' || options.method === 'PUT') {
            const body = JSON.parse(options.body);
            db.profile = { ...db.profile, ...body };
            saveMockDB(db);
            return db.profile;
        }
        return db.profile;
    }

    // 2. Campaigns List
    if (endpoint === '/api/campaigns') {
        return db.campaigns;
    }

    // 3. Campaign Analytics
    const analyticsMatch = endpoint.match(/^\/api\/campaigns\/([^\/]+)\/analytics$/);
    if (analyticsMatch) {
        const campId = analyticsMatch[1];
        return db.analytics[campId] || {
            total_calls: 0,
            conversion_rate: 0,
            qualified_leads: 0,
            intent_breakdown: {},
            status_breakdown: {}
        };
    }

    // 4. Campaign Leads
    const leadsMatch = endpoint.match(/^\/api\/campaigns\/([^\/]+)\/leads$/);
    if (leadsMatch) {
        const campId = leadsMatch[1];
        return db.leads[campId] || [];
    }

    // 5. Campaign CSV Upload
    const uploadMatch = endpoint.match(/^\/api\/campaigns\/([^\/]+)\/upload$/);
    if (uploadMatch) {
        const campId = uploadMatch[1];
        // Just mock some extra leads parsed from CSV
        const newLeads = [
            { id: `lead_${Date.now()}_1`, customer_name: 'Frank Castle', phone_number: '+1 (555) 300-4000', call_status: 'completed', call_duration_sec: 62, extracted_data: { intent: 'INTERESTED' }, transcript: 'AI: Hello Frank, calling from Veda...\nCustomer: I\'m interested.' },
            { id: `lead_${Date.now()}_2`, customer_name: 'Grace Hopper', phone_number: '+1 (555) 700-8000', call_status: 'completed', call_duration_sec: 55, extracted_data: { intent: 'CALLBACK' }, transcript: 'AI: Hello Grace...\nCustomer: Call me next week.' }
        ];
        if (!db.leads[campId]) db.leads[campId] = [];
        db.leads[campId].push(...newLeads);

        // Update Analytics
        if (!db.analytics[campId]) {
            db.analytics[campId] = { total_calls: 0, conversion_rate: 0, qualified_leads: 0, intent_breakdown: {}, status_breakdown: {} };
        }
        db.analytics[campId].total_calls += 2;
        db.analytics[campId].intent_breakdown.INTERESTED = (db.analytics[campId].intent_breakdown.INTERESTED || 0) + 1;
        db.analytics[campId].intent_breakdown.CALLBACK = (db.analytics[campId].intent_breakdown.CALLBACK || 0) + 1;
        db.analytics[campId].qualified_leads += 1;
        db.analytics[campId].conversion_rate = Math.round((db.analytics[campId].qualified_leads / db.analytics[campId].total_calls) * 100);

        saveMockDB(db);
        return { accepted: 2, rejected: 0 };
    }

    // 6. Lead Detail (Transcript)
    const leadDetailMatch = endpoint.match(/^\/api\/admin\/leads\/([^\/]+)$/);
    if (leadDetailMatch) {
        const leadId = leadDetailMatch[1];
        let foundLead = null;
        for (const campId in db.leads) {
            foundLead = db.leads[campId].find(l => l.id === leadId);
            if (foundLead) break;
        }
        return foundLead || { id: leadId, call_status: 'failed', call_duration_sec: 0, transcript: 'No mock transcript found for this lead.' };
    }

    // 7. Admin Stats
    if (endpoint === '/api/admin/stats') {
        return db.adminStats;
    }

    // 8. Admin Businesses
    if (endpoint.startsWith('/api/admin/businesses')) {
        return db.adminBusinesses;
    }

    return {};
};

/**
 * request — Internal core fetch wrapper.
 */
async function request(endpoint, options = {}) {
    if (MOCK_MODE) {
        return handleMockRequest(endpoint, options);
    }

    const token = await getIdToken();
    
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
    };

    // If body is FormData (for uploads), browser sets Content-Type boundary automatically
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const config = {
        ...options,
        headers
    };

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    try {
        const response = await fetch(url, config);
        
        // Handle 401 Unauthorized (Session expired or invalid)
        if (response.status === 401) {
            console.error("[API] Session expired (401). Signing out...");
            await logout();
            throw new Error('Session expired. Please log in again.');
        }

        // Return raw response for 404s so callers can handle onboarding (MOD-15 req)
        if (response.status === 404 || response.status === 403) {
            return response;
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'API Request failed' }));
            throw new Error(error.message || `Error ${response.status}`);
        }

        return response.json();
    } catch (err) {
        console.error(`[API] ${endpoint} failed:`, err.message);
        throw err;
    }
}

export const api = {
    get: (url) => request(url, { method: 'GET' }),
    post: (url, data) => request(url, { method: 'POST', body: JSON.stringify(data) }),
    put: (url, data) => request(url, { method: 'PUT', body: JSON.stringify(data) }),
    upload: (url, formData) => request(url, { method: 'POST', body: formData }),
    patch: (url, data) => request(url, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (url) => request(url, { method: 'DELETE' })
};

