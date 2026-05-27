// Single source of truth for Arc purchase packs.
// Product IDs match what you register in App Store Connect.
// Adding/changing entries: register the ID in App Store Connect first,
// then deploy this Function before shipping the client.

export const ARC_PACKS: Record<string, number> = {
  "com.ariyamatatsuya.contributionarc.arc_pack_small": 100,
  "com.ariyamatatsuya.contributionarc.arc_pack_medium": 600,
  "com.ariyamatatsuya.contributionarc.arc_pack_large": 1500,
  "com.ariyamatatsuya.contributionarc.arc_pack_xlarge": 4000,
};

export function arcAmountFor(productId: string): number | null {
  return Object.prototype.hasOwnProperty.call(ARC_PACKS, productId)
    ? ARC_PACKS[productId]
    : null;
}
