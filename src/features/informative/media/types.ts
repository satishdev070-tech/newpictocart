/** Shapes shared by the image picker (client) and its server actions. */

export type PickerPhoto = {
  /** Unsplash photo id; the only thing the browser sends back to import it. */
  id: string;
  /** Hotlinked images.unsplash.com thumbnail (400 px). */
  thumbUrl: string;
  /** Hotlinked images.unsplash.com image (1080 px). */
  regularUrl: string;
  alt: string;
  author: string;
  /** Photographer's Unsplash profile (with referral UTM), or the photo page. */
  authorUrl: string;
  /** The photo's page on unsplash.com (with referral UTM). */
  photoUrl: string;
  /** "Photo by Name on Unsplash". */
  credit: string;
};

export type PickerSearch = {
  /** False when the platform has no Unsplash key: the picker hides the Unsplash tab. */
  configured: boolean;
  results: PickerPhoto[];
  total: number;
  pages: number;
};

export type ImportedImage = { path: string; url: string; alt: string };
