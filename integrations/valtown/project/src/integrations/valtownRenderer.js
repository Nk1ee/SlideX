import { renderRequestSchema } from '../presentation/schema.js';
import { assertRenderable, validateAndNormalizePresentation } from '../presentation/validator.js';
import { renderPresentation } from '../renderer/pptx.js';
import { createImageResolver } from '../images/resolve.js';
import { createUnsplashProvider, createWikimediaProvider } from '../images/providers.js';
import { assertContentQuality } from '../qc/contentValidation.js';
import { createGeminiImageQualityEvaluator } from '../qc/geminiVisualEvaluator.js';
import { assertLayoutPlan } from '../qc/layoutValidation.js';
import { assertValidPptx } from '../qc/pptxValidation.js';
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const CONTRACT_VERSION = '2';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
export const IMPLEMENTED_LAYOUTS = new Set([
    'title',
    'hero',
    'image_text',
    'two_column',
    'three_cards',
    'comparison',
    'timeline',
    'statistics',
    'chart',
    'process',
    'definition',
    'quote',
    'conclusion',
    'sources',
]);
function jsonResponse(body, status) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'x-content-type-options': 'nosniff',
        },
    });
}
function errorResponse(code, message, status, issues) {
    return jsonResponse({
        ok: false,
        error: {
            code,
            message,
            ...(issues && issues.length > 0 ? { issues } : {}),
        },
    }, status);
}
function configuredValue(readEnvironment, name) {
    return readEnvironment(name)?.trim() ?? '';
}
function constantTimeEqual(left, right) {
    const leftBytes = new TextEncoder().encode(left);
    const rightBytes = new TextEncoder().encode(right);
    const length = Math.max(leftBytes.length, rightBytes.length);
    let difference = leftBytes.length ^ rightBytes.length;
    for (let index = 0; index < length; index += 1) {
        difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
    }
    return difference === 0;
}
function isAuthorized(request, expectedToken) {
    const authorization = request.headers.get('authorization') ?? '';
    const prefix = 'Bearer ';
    if (!authorization.startsWith(prefix))
        return false;
    return constantTimeEqual(authorization.slice(prefix.length), expectedToken);
}
function safeErrorMessage(error) {
    return error instanceof Error && error.message.trim() ? error.message : 'Unknown renderer error';
}
function needsRenderedImage(presentation) {
    return presentation.slides.some((slide) => slide.layout === 'image_text' && slide.visual.needed);
}
async function parseJsonBody(request) {
    const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.startsWith('application/json')) {
        return { ok: false, response: errorResponse('UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json', 415) };
    }
    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
        return { ok: false, response: errorResponse('PAYLOAD_TOO_LARGE', 'Request body exceeds 2 MiB', 413) };
    }
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
        return { ok: false, response: errorResponse('PAYLOAD_TOO_LARGE', 'Request body exceeds 2 MiB', 413) };
    }
    try {
        return { ok: true, value: JSON.parse(text) };
    }
    catch {
        return { ok: false, response: errorResponse('INVALID_JSON', 'Request body is not valid JSON', 400) };
    }
}
function healthResponse(readEnvironment) {
    const geminiKey = configuredValue(readEnvironment, 'GEMINI_API_KEY');
    const geminiModel = configuredValue(readEnvironment, 'GEMINI_QC_MODEL');
    return jsonResponse({
        ok: true,
        service: 'slidex-renderer',
        version: CONTRACT_VERSION,
        layouts: [...IMPLEMENTED_LAYOUTS],
        configuration: {
            renderTokenConfigured: Boolean(configuredValue(readEnvironment, 'SLIDEX_RENDER_TOKEN')),
            unsplashConfigured: Boolean(configuredValue(readEnvironment, 'UNSPLASH_ACCESS_KEY')),
            geminiImageQcConfigured: Boolean(geminiKey && geminiModel),
        },
    }, 200);
}
export function createValTownRendererHandler(options) {
    const fetchImpl = options.fetchImpl ?? fetch;
    return async (request) => {
        if (request.method === 'GET')
            return healthResponse(options.readEnvironment);
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    allow: 'GET, POST, OPTIONS',
                    'cache-control': 'no-store',
                },
            });
        }
        if (request.method !== 'POST') {
            return errorResponse('METHOD_NOT_ALLOWED', 'Use POST to render a presentation', 405);
        }
        const renderToken = configuredValue(options.readEnvironment, 'SLIDEX_RENDER_TOKEN');
        if (!renderToken)
            return errorResponse('SERVER_NOT_CONFIGURED', 'SLIDEX_RENDER_TOKEN is not configured', 503);
        if (!isAuthorized(request, renderToken))
            return errorResponse('UNAUTHORIZED', 'Valid bearer token required', 401);
        const parsedBody = await parseJsonBody(request);
        if (!parsedBody.ok)
            return parsedBody.response;
        const wireResult = renderRequestSchema.safeParse(parsedBody.value);
        if (!wireResult.success) {
            return errorResponse('CONTRACT_VALIDATION_FAILED', 'Request does not match the SlideX render contract', 422, wireResult.error.issues.map((issue) => ({
                path: issue.path.map(String).join('.'),
                message: issue.message,
            })));
        }
        let presentation;
        try {
            presentation = validateAndNormalizePresentation(wireResult.data.payload, wireResult.data.request);
            assertRenderable(presentation, IMPLEMENTED_LAYOUTS);
            assertContentQuality(presentation);
            assertLayoutPlan(presentation, IMPLEMENTED_LAYOUTS);
        }
        catch (error) {
            return errorResponse('QUALITY_GATE_REJECTED', safeErrorMessage(error), 422);
        }
        const unsplashAccessKey = configuredValue(options.readEnvironment, 'UNSPLASH_ACCESS_KEY');
        const geminiApiKey = configuredValue(options.readEnvironment, 'GEMINI_API_KEY');
        const geminiModel = configuredValue(options.readEnvironment, 'GEMINI_QC_MODEL');
        if (geminiApiKey && !geminiModel) {
            return errorResponse('SERVER_NOT_CONFIGURED', 'GEMINI_QC_MODEL is required when GEMINI_API_KEY is configured', 503);
        }
        const providers = [
            createUnsplashProvider({ accessKey: unsplashAccessKey, fetchImpl }),
            createWikimediaProvider({
                fetchImpl,
                userAgent: configuredValue(options.readEnvironment, 'SLIDEX_WIKIMEDIA_USER_AGENT') || 'SlideX/0.2 (educational presentation renderer)',
            }),
        ];
        const imageQualityEvaluator = geminiApiKey && geminiModel
            ? createGeminiImageQualityEvaluator({ apiKey: geminiApiKey, model: geminiModel, fetchImpl })
            : undefined;
        const imageResolver = createImageResolver({
            providers,
            fetchImpl,
            ...(unsplashAccessKey ? { unsplashAccessKey } : {}),
            ...(imageQualityEvaluator ? { imageQualityEvaluator } : {}),
            minWidth: 1000,
            minHeight: 600,
            maxAiCandidatesPerSlide: 3,
            onIssue: (issue) => console.warn(`[SlideX image] ${issue.provider}: ${issue.reason}`),
        });
        let binary;
        try {
            binary = await renderPresentation(presentation, { imageResolver });
        }
        catch (error) {
            return errorResponse('RENDER_REJECTED', safeErrorMessage(error), 422);
        }
        try {
            await assertValidPptx(binary, {
                expectedSlideCount: presentation.presentation.slideCount,
                imagesExpected: needsRenderedImage(presentation),
            });
        }
        catch (error) {
            console.error('[SlideX PPTX QC]', error);
            return errorResponse('POST_RENDER_QC_FAILED', 'Generated PPTX failed structural validation', 500);
        }
        return new Response(Uint8Array.from(binary), {
            status: 200,
            headers: {
                'content-type': PPTX_MIME,
                'content-disposition': 'attachment; filename="slidex-presentation.pptx"',
                'cache-control': 'no-store',
                'x-content-type-options': 'nosniff',
                'x-slidex-contract-version': CONTRACT_VERSION,
                'x-slidex-slide-count': String(presentation.presentation.slideCount),
            },
        });
    };
}
