import type { StockBoard } from '../engine/cutplan';
import { inch } from '../engine/units';

/**
 * The Wood Vault's surfaced (S4S) stock, hand-entered. Nothing is fetched from their site.
 *
 * `source` says where each line comes from:
 *   reference      - the project's Wood Vault reference document (pages checked 12 September 2026)
 *   product-page   - read from the product page in November 2026; not in the reference document
 *
 * Dimensions are in inches here because that is how the supplier lists them.
 */
export interface ProductLine {
  species: string;
  line: 'standard' | 'thick' | 'blank';
  thicknesses: number[];
  widths: number[];
  lengths: number[];
  source: 'reference' | 'product-page';
}

export const WOOD_VAULT = {
  name: 'The Wood Vault',
  url: 'https://woodvault.com',
  /** Boards are often 1/4 in. under the listed length, for packing. */
  lengthUnderListed: 0.25,
  /** Longest length that ships as standard. */
  maxShippingLength: 47,
} as const;

const LENGTHS = [24, 36, 47];
const THIN = [0.5, 0.75];

const standard = (species: string, widths: number[], source: ProductLine['source'] = 'reference'): ProductLine => ({
  species, line: 'standard', thicknesses: THIN, widths, lengths: LENGTHS, source,
});
const thick = (species: string, thickness = 1.625, source: ProductLine['source'] = 'reference'): ProductLine => ({
  species, line: 'thick', thicknesses: [thickness], widths: [5.25], lengths: LENGTHS, source,
});
/** Cutting board blanks: narrow strips, surfaced and ready to glue. */
const blank = (species: string): ProductLine => ({
  species, line: 'blank', thicknesses: [1.625], widths: [0.75, 1, 1.25], lengths: [24], source: 'product-page',
});

export const WOOD_VAULT_LINES: ProductLine[] = [
  standard('knotty-white-pine', [11.25]),
  standard('poplar', [5.25, 7.25, 9.25]),
  standard('cherry', [5.25, 7.25, 9.25]),
  standard('black-walnut', [3.5, 5.25, 7.25]),
  standard('elm', [5.75]),
  standard('white-ash', [4.75]),
  standard('roasted-ash', [4.75]),
  standard('roasted-maple', [4.75]),
  standard('basswood', [4.75]),
  standard('canarywood', [4.75]),
  standard('butternut', [3.75]),
  // The reference document inferred 4-3/4 in. for these three from a mix pack and asked for
  // them to be verified. Their own product pages list the same widths as cherry and poplar.
  standard('hard-maple', [5.25, 7.25, 9.25], 'product-page'),
  standard('red-oak', [5.25, 7.25, 9.25], 'product-page'),
  standard('white-oak', [5.25, 7.25, 9.25], 'product-page'),

  thick('cherry'),
  thick('black-walnut'),
  thick('hickory'),
  thick('roasted-ash'),
  thick('poplar', 1.5),
  // Thick hard maple is 1-1/2 in., not 1-5/8 in. like most other species.
  thick('hard-maple', 1.5, 'product-page'),

  blank('cherry'),
  blank('limba'),
  blank('hard-maple'),
  blank('padauk'),
  blank('purpleheart'),
  blank('sapele'),
  blank('black-walnut'),
];

export interface CatalogBoard extends Omit<StockBoard, 'quantity'> {
  line: ProductLine['line'];
  /** The length the supplier lists, in mm. `length` is what you can count on receiving. */
  listedLength: number;
}

/** Every board size in the catalog, in millimetres, ready for the cut planner. */
export function woodVaultBoards(lines: ProductLine[] = WOOD_VAULT_LINES): CatalogBoard[] {
  const fraction = (value: number): string => String(value).replace('.', '_');
  return lines.flatMap((entry) =>
    entry.thicknesses.flatMap((thickness) =>
      entry.widths.flatMap((width) =>
        entry.lengths.map((length) => ({
          id: `wood-vault/${entry.species}/${entry.line}/${fraction(thickness)}x${fraction(width)}x${length}`,
          species: entry.species,
          line: entry.line,
          thickness: inch(thickness),
          width: inch(width),
          length: inch(length - WOOD_VAULT.lengthUnderListed),
          listedLength: inch(length),
        })),
      ),
    ),
  );
}
