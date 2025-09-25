export interface ProductVariant {
  id: number;
  product_id: number;
  price: number;
  stock_quantity: number;
  attributes: Record<string, string>;
}

export interface Product {
  id: number;
  created_at: string;
  title: string;
  description: string;
  type_id: number;
  image_urls: string[];
  product_variants: ProductVariant[];
}

export type NewProduct = Omit<Product, "id" | "created_at" | "product_variants">;
export type NewVariant = Omit<ProductVariant, "id" | "product_id">;
