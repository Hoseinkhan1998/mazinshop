export interface ProductVariant {
  id: number;
  product_id: number;
  price: number;
  stock_quantity: number;
  attributes: Record<string, string>;
  discount_percent?: number;
  discounted_price?: number | null;
  pin_to_home_discount?: boolean;
  pinned_to_home_discount_at?: string | null;
}

export interface Product {
  id: number;
  created_at: string;
  title: string;
  description: string;
  type_id: number;
  image_urls: string[];
  product_variants: ProductVariant[];
  product_code: string;
}

export type NewProduct = Omit<Product, "id" | "created_at" | "product_variants" | "product_code">;
export type NewVariant = Omit<ProductVariant, "id" | "product_id">;
