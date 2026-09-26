import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
function binaryHash(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}
export function imageIdentity(candidate) {
    if (candidate.provider.trim() && candidate.providerId.trim())
        return `provider:${candidate.provider}:${candidate.providerId}`;
    if (candidate.bytes && candidate.bytes.byteLength > 0)
        return `sha256:${binaryHash(candidate.bytes)}`;
    throw new Error('Image candidate needs provider ID or binary bytes for dedupe');
}
export function imageDataUriFromBytes(bytes, mimeType) {
    if (!mimeType.startsWith('image/'))
        throw new Error('Image MIME type is required');
    return 'data:' + mimeType + ';base64,' + Buffer.from(bytes).toString('base64');
}
export function imageBytesFromDataUri(dataUri) {
    const match = /^data:[^;]+;base64,(.+)$/s.exec(dataUri);
    if (!match?.[1])
        throw new Error('Expected a base64 data URI');
    return new Uint8Array(Buffer.from(match[1], 'base64'));
}
export function dedupeImages(candidates) {
    const seen = new Set();
    return candidates.filter((candidate) => {
        const identity = imageIdentity(candidate);
        if (seen.has(identity))
            return false;
        seen.add(identity);
        return true;
    });
}
