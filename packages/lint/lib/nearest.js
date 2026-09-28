/**
 * Brackets a value with the tokens around it, so a message can say which two
 * names the reader is choosing between instead of only the closest one.
 */

/**
 * The nearest token, then the nearest one on the other side of the value, so
 * the message brackets what was written and the reader can pick a direction.
 * When the value sits past either end of the scale, the second-nearest token on
 * the same side stands in.
 *
 * @param {number} value measured on its magnitude; the caller re-applies the sign
 * @param {import("./source").TokenGroup} group
 * @returns {{name: string, value: number}[]}
 */
function nearestTokens(value, group) {
  const target = Math.abs(value);
  const ranked = group.values
    .map((candidate) => ({
      name: group.nameByValue.get(candidate) || "",
      value: candidate,
      distance: Math.abs(candidate - target),
    }))
    .sort((a, b) => a.distance - b.distance || a.value - b.value);

  const nearest = ranked[0];
  if (!nearest) return [];
  const opposite = ranked.find((entry) =>
    nearest.value < target ? entry.value > target : entry.value < target,
  );
  const second = opposite || ranked[1];
  const picked = second ? [nearest, second] : [nearest];
  return picked.map((entry) => ({ name: entry.name, value: entry.value }));
}

module.exports = { nearestTokens };
