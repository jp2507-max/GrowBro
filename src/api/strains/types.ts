export type Strain = {
  id: string;
  name: string;
  type: 'indica' | 'sativa' | 'hybrid' | 'unknown';
  thcContent?: number;
  cbdContent?: number;
  description?: string;
  effects?: string[];
  flavors?: string[];
  imageUrl?: string;
  genetics?: {
    parent1?: string;
    parent2?: string;
  };
};
