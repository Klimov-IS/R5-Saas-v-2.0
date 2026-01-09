'use server';

import * as dbHelpers from '@/db/helpers';

/**
 * Core AI utility functions for interacting with Deepseek API
 * Migrated from Firebase to PostgreSQL
 */

/**
 * Log AI interaction to PostgreSQL ai_logs table
 */
async function logAiInteraction(logData: {
    store_id: string;
    owner_id: string;
    entity_type: string;
    entity_id: string;
    action: string;
    prompt?: string | null;
    model?: string | null;
}): Promise<string> {
    try {
        const aiLog = await dbHelpers.createAILog({
            store_id: logData.store_id,
            owner_id: logData.owner_id,
            entity_type: logData.entity_type,
            entity_id: logData.entity_id,
            action: logData.action,
            prompt: logData.prompt || null,
            response: null,
            model: logData.model || 'deepseek-chat',
            tokens_used: null,
            cost: null,
            error: null,
            metadata: null,
        });
        return aiLog.id;
    } catch (error) {
        console.error("FATAL: Failed to log AI interaction to PostgreSQL:", error);
        throw new Error("Failed to create initial AI log.");
    }
}

/**
 * Update AI log with response or error
 */
async function updateAiLog(logId: string, updateData: {
    response?: string | null;
    error?: string | null;
    tokens_used?: number | null;
    cost?: number | null;
    metadata?: any | null;
}): Promise<void> {
    try {
        await dbHelpers.updateAILog(logId, updateData);
    } catch (error) {
        console.error(`WARN: Failed to update AI log ${logId}:`, error);
    }
}

/**
 * Main function to run Deepseek chat completion
 *
 * @param systemPrompt - The system message
 * @param userContent - The user message
 * @param isJsonMode - Whether to request JSON response
 * @param operation - Operation name for logging (e.g., 'classify-chat-tag')
 * @param storeId - Store ID for logging
 * @param ownerId - Owner ID for logging
 * @param entityType - Entity type for logging (e.g., 'chat', 'review')
 * @param entityId - Entity ID for logging
 */
export async function runChatCompletion({
    systemPrompt,
    userContent,
    isJsonMode = false,
    operation,
    storeId,
    ownerId,
    entityType,
    entityId,
}: {
    systemPrompt: string;
    userContent: string;
    isJsonMode?: boolean;
    operation: string;
    storeId: string;
    ownerId: string;
    entityType: string;
    entityId: string;
}): Promise<string> {
    let logId = '';

    try {
        // Create initial log entry
        logId = await logAiInteraction({
            store_id: storeId,
            owner_id: ownerId,
            entity_type: entityType,
            entity_id: entityId,
            action: operation,
            prompt: `System: ${systemPrompt}\n\nUser: ${userContent}`,
            model: 'deepseek-chat',
        });
    } catch (error: any) {
        console.error("Critical error: Could not create initial AI log. Aborting operation.", error);
        throw new Error("Failed to initiate AI operation due to logging failure.");
    }

    try {
        // Get user settings from PostgreSQL
        const settings = await dbHelpers.getUserSettings();

        if (!settings) {
            throw new Error("Не найдены настройки AI. Пожалуйста, укажите API-ключ в настройках.");
        }

        const apiKey = settings.deepseek_api_key;

        if (!apiKey) {
            throw new Error("API-ключ Deepseek не найден. Пожалуйста, укажите его в настройках.");
        }

        const body: any = {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            temperature: 0.7,
            max_tokens: 2048,
        };

        if (isJsonMode) {
            body.response_format = { type: 'json_object' };
        }

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Ошибка API Deepseek: ${response.status} - ${errorBody}`);
        }

        const result = await response.json();
        const text = result.choices[0]?.message?.content;

        if (!text) {
            throw new Error("Deepseek API не вернул текст в ответе.");
        }

        // Extract token usage and calculate cost (optional)
        const tokensUsed = result.usage?.total_tokens || null;
        const cost = tokensUsed ? (tokensUsed * 0.00014 / 1000) : null; // Example pricing

        // Update log with success
        await updateAiLog(logId, {
            response: text,
            tokens_used: tokensUsed,
            cost: cost,
        });

        return text;

    } catch (error: any) {
        console.error(`Error in runChatCompletion for operation '${operation}':`, error);

        // Update log with error
        await updateAiLog(logId, {
            error: error.message,
        });

        throw error;
    }
}
