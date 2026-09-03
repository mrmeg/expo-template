/**
 * The dimension ladder.
 *
 * One shared loop for both platforms: encode at the largest long-edge cap, and
 * while the result misses the byte budget, drop to the next (smaller) cap and
 * encode again from the *source* — never from the previous rung's output, which
 * would compound artifacts. Attempts are bounded by the rung list, so this
 * terminates by construction; a quality-decay loop cannot make that promise.
 *
 * Losing rungs are released the moment they lose, so a batch never accumulates
 * one temp file (native) or object URL (web) per attempt.
 */
import { logMediaDebug as logDev } from "../logger.js";
import { formatFileSize, longEdgeOf } from "./utils.js";
/**
 * Rungs larger than the source are pointless (upscaling), and several rungs can
 * collapse onto the same cap once clamped to a small source. Clamp, dedupe,
 * and keep descending order so each attempt is strictly smaller than the last.
 */
export function resolveLadderRungs(rungs, sourceLongEdge) {
    const usable = rungs.filter((rung) => Number.isFinite(rung) && rung > 0);
    if (usable.length === 0)
        return sourceLongEdge > 0 ? [sourceLongEdge] : [];
    const clamped = usable
        .map((rung) => (sourceLongEdge > 0 ? Math.min(Math.round(rung), sourceLongEdge) : Math.round(rung)))
        .sort((a, b) => b - a);
    return [...new Set(clamped)];
}
export async function runDimensionLadder(options) {
    const { source, width, height, quality, byteBudget, format, encode, dispose } = options;
    const sourceLongEdge = longEdgeOf(width, height);
    const rungs = resolveLadderRungs(options.rungs, sourceLongEdge);
    if (rungs.length === 0) {
        throw new Error("Dimension ladder needs at least one usable rung");
    }
    let best = null;
    for (let index = 0; index < rungs.length; index += 1) {
        const rung = rungs[index];
        let encoded;
        try {
            encoded = await encode({
                source,
                width,
                height,
                longEdge: rung,
                quality,
                format,
            });
        }
        catch (error) {
            // A failed rung (a decode error, or a native stat that could not read the
            // written file) aborts the whole ladder, so the rung that was still in
            // hand has to go with it rather than outlive the request.
            if (best)
                dispose(best);
            throw error;
        }
        const attempt = {
            ...encoded,
            rung,
            attempts: index + 1,
            overBudget: byteBudget > 0 && encoded.size > byteBudget,
        };
        if (best)
            dispose(best);
        best = attempt;
        if (!attempt.overBudget) {
            logDev(`Ladder fit at ${rung}px: ${formatFileSize(attempt.size)} (attempt ${attempt.attempts})`);
            return attempt;
        }
        const isLastRung = index === rungs.length - 1;
        logDev(`Ladder ${rung}px produced ${formatFileSize(attempt.size)} > budget ${formatFileSize(byteBudget)}${isLastRung ? " — last rung, returning over budget" : ", stepping down"}`);
    }
    // Unreachable: the loop either returns a fitting attempt or leaves the last
    // (smallest) one in `best`.
    return best;
}
