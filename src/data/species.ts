/**
 * Species the designer knows about.
 *
 * `suitability` is for end grain boards that touch food:
 *   good    - hard and closed-grained
 *   caution - usable, with a drawback worth knowing
 *   avoid   - too soft, or pores large enough to hold moisture and food
 *
 * The ratings follow common woodworking guidance, not laboratory testing.
 * Colours are approximate, for drawing previews.
 */
export type Suitability = 'good' | 'caution' | 'avoid';

export interface Species {
  id: string;
  name: string;
  color: string;
  suitability: Suitability;
  /** Shown to the user when the rating is not `good`, or when there is something to know. */
  note?: string;
}

export const SPECIES: Species[] = [
  { id: 'hard-maple', name: 'Hard maple', color: '#E8D4B0', suitability: 'good' },
  { id: 'black-walnut', name: 'Black walnut', color: '#5C4033', suitability: 'good' },
  { id: 'cherry', name: 'Cherry', color: '#A8623C', suitability: 'good', note: 'Darkens with light over the first year.' },
  { id: 'roasted-maple', name: 'Roasted maple', color: '#8B5A2B', suitability: 'good', note: 'Roasting makes it more brittle; take light cuts.' },
  { id: 'white-oak', name: 'White oak', color: '#C2A878', suitability: 'good', note: 'Its pores are naturally plugged, unlike red oak.' },
  { id: 'canarywood', name: 'Canarywood', color: '#C98A3C', suitability: 'good' },
  { id: 'sapele', name: 'Sapele', color: '#8A4B32', suitability: 'good' },
  { id: 'purpleheart', name: 'Purpleheart', color: '#6B3A6E', suitability: 'good', note: 'Very hard on blades. The dust is an irritant; wear a mask.' },
  { id: 'padauk', name: 'Padauk', color: '#B5442A', suitability: 'good', note: 'The orange dust stains lighter woods; sand carefully. Wear a mask.' },
  { id: 'hickory', name: 'Hickory', color: '#C9A77C', suitability: 'caution', note: 'Hard enough, but its pores are larger than maple or walnut.' },
  { id: 'elm', name: 'Elm', color: '#B08A5E', suitability: 'caution', note: 'Open pores hold moisture and food.' },
  { id: 'limba', name: 'Limba', color: '#C9B07A', suitability: 'caution', note: 'Softer than most board woods, so it will show knife marks sooner.' },
  { id: 'red-oak', name: 'Red oak', color: '#C08A5C', suitability: 'avoid', note: 'Large open pores soak up moisture and food.' },
  { id: 'white-ash', name: 'White ash', color: '#DCC7A0', suitability: 'avoid', note: 'Large open pores soak up moisture and food.' },
  { id: 'roasted-ash', name: 'Roasted ash', color: '#7A5230', suitability: 'avoid', note: 'Large open pores soak up moisture and food.' },
  { id: 'poplar', name: 'Poplar', color: '#CFC79A', suitability: 'avoid', note: 'Too soft for a cutting surface.' },
  { id: 'basswood', name: 'Basswood', color: '#E6D8B8', suitability: 'avoid', note: 'Too soft for a cutting surface.' },
  { id: 'butternut', name: 'Butternut', color: '#B9966B', suitability: 'avoid', note: 'Too soft for a cutting surface.' },
  { id: 'knotty-white-pine', name: 'Knotty white pine', color: '#E9D5A1', suitability: 'avoid', note: 'A softwood: too soft, and resinous.' },
];

export const speciesById = (id: string): Species | undefined =>
  SPECIES.find((species) => species.id === id);

export interface SpeciesWarning {
  level: 'caution' | 'avoid';
  species: string;
  message: string;
}

/** Warnings for any species in a design that is not a good choice for a cutting board. */
export function speciesWarnings(ids: Iterable<string>): SpeciesWarning[] {
  const warnings: SpeciesWarning[] = [];
  for (const id of new Set(ids)) {
    const species = speciesById(id);
    if (species && species.suitability !== 'good') {
      warnings.push({
        level: species.suitability,
        species: id,
        message: `${species.name}: ${species.note ?? 'not recommended for cutting boards.'}`,
      });
    }
  }
  return warnings;
}
