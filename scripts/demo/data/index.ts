import { CATEGORIES_1 } from "./categories-1";
import { CATEGORIES_2 } from "./categories-2";
import { CATEGORIES_3 } from "./categories-3";
import { CATEGORIES_4 } from "./categories-4";
import { CATEGORIES_5 } from "./categories-5";
import { CATEGORIES_6 } from "./categories-6";
import type { CategoryDef } from "./types";

/** Every store category with its two demo brands (order = src/features/stores/industries.ts). */
export const DEMO_CATEGORIES: readonly CategoryDef[] = [...CATEGORIES_1, ...CATEGORIES_2, ...CATEGORIES_3, ...CATEGORIES_4, ...CATEGORIES_5, ...CATEGORIES_6];
