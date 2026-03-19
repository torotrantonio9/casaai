import { create } from "zustand";

export interface CompareListing {
  id: string;
  title: string;
  price: number;
  city: string;
  surface_sqm: number;
  rooms: number;
  bathrooms: number;
  floor: number | null;
  energy_class: string | null;
  has_parking: boolean;
  has_garden: boolean;
  has_terrace: boolean;
  has_elevator: boolean;
  has_cellar: boolean;
  photos: string[];
  type: string;
}

interface CompareStore {
  listings: CompareListing[];
  isOpen: boolean;
  addListing: (listing: CompareListing) => void;
  removeListing: (id: string) => void;
  clearAll: () => void;
  toggleDrawer: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

export const useCompareStore = create<CompareStore>((set) => ({
  listings: [],
  isOpen: false,

  addListing: (listing) =>
    set((state) => {
      if (state.listings.length >= 4) return state;
      if (state.listings.some((l) => l.id === listing.id)) return state;
      return { listings: [...state.listings, listing] };
    }),

  removeListing: (id) =>
    set((state) => ({
      listings: state.listings.filter((l) => l.id !== id),
    })),

  clearAll: () => set({ listings: [], isOpen: false }),

  toggleDrawer: () => set((state) => ({ isOpen: !state.isOpen })),
  openDrawer: () => set({ isOpen: true }),
  closeDrawer: () => set({ isOpen: false }),
}));
