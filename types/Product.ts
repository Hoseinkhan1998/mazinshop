// types/Product.ts
export interface Product {
  id: number;
  created_at: string;
  title: string;
  price: number;
  description: string;
  image_urls: string[];
  type_id: number;
}

export type NewProduct = Omit<Product, 'id' | 'created_at'>;