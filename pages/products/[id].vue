<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useProductStore } from "~/stores/products";
import type { Product, ProductVariant } from "~/types/Product";
import type { Attribute } from "~/stores/attributes";
import { useTypesStore } from "~/stores/types";
import { useToast } from "~/composables/useToast";
import { useCartStore } from "~/stores/cart";
import type { CartItem } from "~/stores/cart";
import { useAuthStore } from "~/stores/auth";
import { useCommentsStore, type CommentWithMeta } from "~/stores/comments";
import SimilarProducts from "~/components/SimilarProducts.vue";
import { useGlobalLoading } from "~/composables/useGlobalLoading";

const cartStore = useCartStore();
const router = useRouter();
const authStore = useAuthStore();
const commentsStore = useCommentsStore();

const { trigger: showToast } = useToast();
const route = useRoute();
const productStore = useProductStore();
const typesStore = useTypesStore();

const { setGlobalLoading } = useGlobalLoading();
const firstLoadDone = ref(false);

// فعال‌سازی لودینگ بلافاصله در لحظه ستاپ (برای رفرش)
setGlobalLoading(true);

const loading = ref(true);
const errorMessage = ref<string | null>(null);
const isAdmin = computed(() => authStore.isAdmin);

const quantity = ref(1);
const productId = computed(() => Number(route.params.id));
const selectedImageIndex = ref(0);
const galleryOpen = ref(false);

// انتخاب‌های کاربر برای اتریبیوت‌های متغیر
const selectedOptions = ref<Record<string, string>>({});

// وضعیت CTA: بعد از افزودن کالا، دکمه به «مشاهده سبد خرید» تغییر می‌کند
const addedToCart = ref(false);

async function pingProductView(pId: number) {
  if (import.meta.server) return;

  try {
    const { $supabase } = useNuxtApp();
    const {
      data: { session },
    } = await $supabase.auth.getSession();

    const token = session?.access_token;

    // fire-and-forget (ولی await گذاشتم که اگر خواستی بعداً لاگ بگیری راحت باشه)
    await $fetch("/api/products/view", {
      method: "POST",
      body: { productId: pId },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch (e) {
    // عمداً silent: نباید UI رو خراب کنه
    console.warn("view ping failed:", e);
  }
}

// ---------- Fetch ----------
onMounted(() => fetchDetails());
watch(productId, () => fetchDetails());

const newCommentText = ref("");
const replyingTo = ref<CommentWithMeta | null>(null);
const loginDialog = ref(false);
const submittingComment = ref(false);

const productComments = computed<CommentWithMeta[]>(() => {
  return commentsStore.commentsByProduct[productId.value] || [];
});

const topLevelComments = computed(() => productComments.value.filter((c) => !c.parent_id));
const getReplies = (parentId: number) => productComments.value.filter((c) => c.parent_id === parentId);

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fa-IR-u-ca-persian", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const canDeleteComment = (comment: CommentWithMeta) => {
  return authStore.isAdmin || authStore.user?.id === comment.user_id;
};

const startReply = (comment: CommentWithMeta) => {
  replyingTo.value = comment;
  const el = document.getElementById("comments");
  if (el) {
    const offset = 130; // مقدار فاصله برای جبران ارتفاع هدر و دیده شدن کامل باکس
    const elementPosition = el.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.scrollY - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });
  }
};

async function fetchDetails() {
  setGlobalLoading(true);
  loading.value = true;
  errorMessage.value = null;
  selectedImageIndex.value = 0;
  selectedOptions.value = {};
  quantity.value = 1;
  addedToCart.value = false;

  if (typesStore.types.length === 0) {
    await typesStore.fetchTypes();
  }

  try {
    await productStore.fetchProductDetails(productId.value);
    const p = product.value;
    if (p && Array.isArray(p.variants) && p.variants.length > 0) {
      const existingForThisProduct = cartStore.items.find((i) => i.productId === p.id);
      if (existingForThisProduct) {
        const match = p.variants.find((v) => v.id === existingForThisProduct.variantId);
        if (match) {
          selectedOptions.value = { ...match.attributes };
          quantity.value = existingForThisProduct.quantity;
        }
      }
    }
    if (!productStore.currentProductDetails?.product) {
      errorMessage.value = "محصول مورد نظر یافت نشد.";
    } else {
      pingProductView(productId.value);
      // ---------- انتخاب هوشمند واریانت پیش‌فرض ----------
      const details = productStore.currentProductDetails;
      const variants = (details?.product?.variants ?? []) as ProductVariant[];
      const attrs = (details?.type_attributes ?? []) as Attribute[];

      if (variants.length > 0) {
        const best = pickDefaultVariant(attrs, variants);
        if (best) {
          // فقط گزینه‌های "متغیر" را داخل selectedOptions می‌ریزیم تا چک تعداد کل attributeها خراب نشود
          const { variableNames } = deriveFixedAndVariableNames(attrs, variants);

          const nextSelected: Record<string, string> = {};
          for (const [k, v] of Object.entries(best.attributes || {})) {
            if (variableNames.has(k)) nextSelected[k] = String(v);
          }
          selectedOptions.value = nextSelected;
        }
      }
      // ----------------------------------------------------

      await commentsStore.fetchCommentsForProduct(productId.value);
    }
  } catch (err) {
    errorMessage.value = "خطا در دریافت اطلاعات محصول.";
    console.error(err);
  } finally {
    loading.value = false;
    firstLoadDone.value = true;
    setGlobalLoading(false);
  }
}

// ---------- Computed ----------
const product = computed<Product | null>(() => productStore.currentProductDetails?.product || null);
const typeAttributes = computed<Attribute[]>(() => productStore.currentProductDetails?.type_attributes || []);
const variantOptions = computed<Record<number, string[]>>(() => productStore.currentProductDetails?.options || {}); // اگر جای دیگری استفاده داری، حفظ شده

const productType = computed(() => {
  if (!product.value) return null;
  return typesStore.types.find((t) => t.id === product.value!.type_id) || null;
});

const mainImageUrl = computed(() => {
  return product.value?.image_urls?.[selectedImageIndex.value] || "/images/placeholder.png";
});

const thumbnailImages = computed(() => {
  return product.value?.image_urls || [];
});

// همهٔ وریِنت‌ها به صورت امن
const allVariants = computed<ProductVariant[]>(() => product.value?.variants ?? []);

// یکتاهای هر اتریبیوت بر اساس همهٔ وریِنت‌های این محصول
const uniqueAttributeValues = computed(() => {
  const uniqueValues: Record<string, Set<string>> = {};
  if (!product.value || !product.value.variants) return uniqueValues;

  // نام همهٔ ویژگی‌ها از typeAttributes
  typeAttributes.value.forEach((attr) => {
    uniqueValues[attr.name] = new Set<string>();
  });

  // پر کردن ست‌ها از روی وریِنت‌ها
  product.value.variants.forEach((variant) => {
    Object.entries(variant.attributes).forEach(([key, value]) => {
      if (uniqueValues[key]) uniqueValues[key].add(value);
    });
  });

  return uniqueValues;
});

// دسته‌بندی ویژگی‌ها به ثابت/متغیر
const categorizedAttributes = computed(() => {
  const fixed: { name: string; value: string }[] = [];
  const variable: Attribute[] = [];

  typeAttributes.value.forEach((attr) => {
    const values = uniqueAttributeValues.value[attr.name];
    if (values && values.size === 1) {
      fixed.push({ name: attr.name, value: Array.from(values)[0] });
    } else if (values && values.size > 1) {
      variable.push(attr);
    }
  });
  return { fixed, variable };
});

// وریِنت انتخاب‌شده بر اساس selectedOptions + fixed attributes
const selectedVariant = computed<ProductVariant | null>(() => {
  if (!product.value || !product.value.variants) return null;

  // انتخاب‌ها + ثابت‌ها
  const combined: Record<string, string> = { ...selectedOptions.value };
  categorizedAttributes.value.fixed.forEach((attr) => {
    combined[attr.name] = attr.value;
  });

  // اگر هنوز همهٔ ویژگی‌ها انتخاب نشده
  if (Object.keys(combined).length !== typeAttributes.value.length) return null;

  // یافتن وریِنت دقیق
  return (
    product.value.variants.find((variant) => {
      const vKeys = Object.keys(variant.attributes).sort();
      const cKeys = Object.keys(combined).sort();
      if (vKeys.length !== cKeys.length) return false;
      return JSON.stringify(Object.fromEntries(vKeys.map((k) => [k, variant.attributes[k]]))) === JSON.stringify(Object.fromEntries(cKeys.map((k) => [k, combined[k]])));
    }) || null
  );
});

const existingCartItemForSelectedVariant = computed<CartItem | null>(() => {
  if (!selectedVariant.value) return null;
  return cartStore.items.find((i) => i.variantId === selectedVariant.value.id) || null;
});

// قیمت فعلی (null اگر هنوز وریِنت کامل نشده)
const currentPrice = computed<number | null>(() => {
  if (!selectedVariant.value) return null;
  return getEffectivePrice(selectedVariant.value);
});

const hasDiscountOnSelected = computed(() => (selectedVariant.value ? isValidDiscount(selectedVariant.value) : false));

const selectedOldPrice = computed<number | null>(() => {
  if (!selectedVariant.value) return null;
  const p = Number((selectedVariant.value as any).price);
  return Number.isFinite(p) ? p : null;
});

const selectedDiscountedPrice = computed<number | null>(() => {
  if (!selectedVariant.value) return null;
  if (!isValidDiscount(selectedVariant.value)) return null;
  const dp = Number((selectedVariant.value as any).discounted_price);
  return Number.isFinite(dp) ? dp : null;
});

const selectedDiscountPercent = computed<number>(() => {
  if (!selectedVariant.value) return 0;
  if (!isValidDiscount(selectedVariant.value)) return 0;
  return getDiscountPercent(selectedVariant.value);
});

const showDiscountFire = computed(() => selectedDiscountPercent.value >= 40);

const isInvalidCombination = computed(() => allVariableSelected.value && !selectedVariant.value && (allVariants.value?.length || 0) > 0);

// ---------- Helpers ----------
const formatNumber = (num: number | undefined | null) => (num != null ? num.toLocaleString("fa-IR") : "-");

// ---------------- Discount helpers ----------------
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const isValidDiscount = (v: any) => {
  const price = Number(v?.price);
  const dp = v?.discounted_price == null ? null : Number(v.discounted_price);
  const percent = v?.discount_percent == null ? null : Number(v.discount_percent);

  if (!Number.isFinite(price) || price <= 0) return false;
  if (dp == null || !Number.isFinite(dp) || dp <= 0) return false;
  if (dp >= price) return false;

  // percent optional but if exists should be sane
  if (percent != null) {
    if (!Number.isFinite(percent)) return false;
    if (percent <= 0 || percent > 100) return false;
  }
  return true;
};

const getDiscountPercent = (v: any) => {
  const price = Number(v?.price);
  const dp = v?.discounted_price == null ? null : Number(v.discounted_price);
  if (!Number.isFinite(price) || price <= 0 || dp == null || !Number.isFinite(dp)) return 0;
  const raw = Math.round(((price - dp) / price) * 100);
  return clamp(raw, 0, 100);
};

const getDiscountAmount = (v: any) => {
  const price = Number(v?.price);
  const dp = v?.discounted_price == null ? null : Number(v.discounted_price);
  if (!Number.isFinite(price) || price <= 0 || dp == null || !Number.isFinite(dp)) return 0;
  return Math.max(0, price - dp);
};

const getEffectivePrice = (v: any) => {
  const price = Number(v?.price);
  const dp = v?.discounted_price == null ? null : Number(v.discounted_price);
  if (isValidDiscount(v) && dp != null && Number.isFinite(dp)) return dp;
  return Number.isFinite(price) ? price : 0;
};

// derive fixed/variable attribute names (same logic as categorizedAttributes but inline for initial pick)
function deriveFixedAndVariableNames(attrs: Attribute[], variants: ProductVariant[]) {
  const map: Record<string, Set<string>> = {};
  for (const a of attrs) map[a.name] = new Set<string>();

  for (const v of variants) {
    for (const [k, val] of Object.entries(v.attributes || {})) {
      if (map[k]) map[k].add(String(val));
    }
  }

  const fixedNames = new Set<string>();
  const variableNames = new Set<string>();
  for (const a of attrs) {
    const s = map[a.name];
    if (!s || s.size === 0) continue;
    if (s.size === 1) fixedNames.add(a.name);
    else variableNames.add(a.name);
  }
  return { fixedNames, variableNames };
}

// pick default variant (prefer best valid discount; else cheapest in-stock)
function pickDefaultVariant(attrs: Attribute[], variants: ProductVariant[]) {
  const inStock = variants.filter((v: any) => Number(v?.stock_quantity ?? 0) > 0);
  const list = inStock.length ? inStock : variants;

  // 1) best discounted
  const discounted = list.filter((v: any) => isValidDiscount(v));
  if (discounted.length) {
    return discounted.sort((a: any, b: any) => {
      const pa = getDiscountPercent(a);
      const pb = getDiscountPercent(b);
      if (pb !== pa) return pb - pa;

      const da = getDiscountAmount(a);
      const db = getDiscountAmount(b);
      if (db !== da) return db - da;

      const sa = Number(a?.stock_quantity ?? 0);
      const sb = Number(b?.stock_quantity ?? 0);
      if (sb !== sa) return sb - sa;

      // tie-break: newer
      return Number(b?.id ?? 0) - Number(a?.id ?? 0);
    })[0];
  }

  // 2) otherwise cheapest effective price
  return list.slice().sort((a: any, b: any) => {
    const ea = getEffectivePrice(a);
    const eb = getEffectivePrice(b);
    if (ea !== eb) return ea - eb;

    const sa = Number(a?.stock_quantity ?? 0);
    const sb = Number(b?.stock_quantity ?? 0);
    if (sb !== sa) return sb - sa;

    return Number(b?.id ?? 0) - Number(a?.id ?? 0);
  })[0];
}
// --------------------------------------------------

const allVariableSelected = computed(() => categorizedAttributes.value.variable.every((attr) => !!selectedOptions.value[attr.name]));

const selectImage = (index: number) => {
  selectedImageIndex.value = index;
};

const handleOptionChange = () => {
  quantity.value = 1;
  addedToCart.value = false;
};

// ---------- Quantity ----------
const increment = () => {
  if (selectedVariant.value && quantity.value < selectedVariant.value.stock_quantity) {
    quantity.value++;
  } else if (selectedVariant.value) {
    showToast(`حداکثر موجودی این نسخه (${selectedVariant.value.stock_quantity} عدد) در انبار است.`, "error");
  } else {
    quantity.value++;
  }
  // هر تغییری در تعداد ⇒ CTA به حالت افزودن برگردد
  addedToCart.value = false;
};

const decrement = () => {
  if (quantity.value > 1) {
    quantity.value--;
    addedToCart.value = false;
  }
};

// هر تغییری در productId یا تصویر اصلی هم CTA را برمی‌گرداند (سخت‌گیرانه طبق درخواستت)
watch(
  [productId, selectedImageIndex, selectedOptions],
  () => {
    addedToCart.value = false;
  },
  { deep: true }
);

// همچنین اگر selectedOptions تغییر کند (برای هر دلیل دیگری)
watch(
  selectedOptions,
  () => {
    quantity.value = 1;
    addedToCart.value = false;
  },
  { deep: true }
);
watch(
  () => selectedVariant.value,
  (v) => {
    if (!v) return;
    const existing = cartStore.items.find((i) => i.variantId === v.id);
    quantity.value = existing ? existing.quantity : 1;
    addedToCart.value = false; // کاربر دوباره روی CTA تصمیم بگیرد
  }
);

// ---------- CTA behavior ----------
const handleAddToCart = async () => {
  if (!addedToCart.value) {
    if (product.value && selectedVariant.value) {
      try {
        await cartStore.addItem(product.value, selectedVariant.value, quantity.value); // ← await
        showToast("محصول به سبد خرید اضافه شد!", "success");
        addedToCart.value = true;
      } catch (error: any) {
        showToast(error?.message || "خطا در افزودن به سبد خرید", "error");
      }
    } else {
      showToast("لطفاً تمام گزینه‌های محصول را انتخاب کنید.", "error");
    }
  } else {
    router.push("/shoppingcard");
  }
};

// برای سادگی قالب
const primaryCtaLabel = computed(() => {
  if (addedToCart.value) return "مشاهده سبد خرید";
  if (selectedVariant.value && selectedVariant.value.stock_quantity === 0) return "موجود نیست";
  return "افزودن به سبد خرید";
});

const primaryCtaIcon = computed(() => (addedToCart.value ? "mdi-cart" : "mdi-cart-plus"));

const isPrimaryCtaDisabled = computed(() => {
  if (addedToCart.value) return false;
  // وریِنت معتبر و موجودی > 0 لازم است
  if (isInvalidCombination.value) return true;
  return !selectedVariant.value || selectedVariant.value.stock_quantity === 0;
});

const submitComment = async () => {
  if (!authStore.isLoggedIn) {
    loginDialog.value = true;
    return;
  }
  if (!product.value) return;
  const text = newCommentText.value.trim();
  if (!text) return;

  submittingComment.value = true;
  try {
    await commentsStore.addComment(product.value.id, text, replyingTo.value?.id ?? null, null);
    showToast("از ثبت نظر شما متشکریم. پس از تایید ادمین نمایش داده می‌شود.", "success");
    newCommentText.value = "";
    replyingTo.value = null;
  } catch (error: any) {
    showToast(error?.message || "خطا در ثبت نظر", "error");
  } finally {
    submittingComment.value = false;
  }
};

const handleLoginRedirect = () => {
  loginDialog.value = false;
  router.push({
    path: "/login",
    query: { redirect: route.fullPath + "#comments" },
  });
};

const toggleLike = async (comment: CommentWithMeta) => {
  if (!authStore.isLoggedIn) {
    loginDialog.value = true;
    return;
  }
  const newValue: -1 | 0 | 1 = comment.my_vote === 1 ? 0 : 1;
  try {
    await commentsStore.toggleVote(comment.id, newValue);
  } catch (error: any) {
    showToast(error?.message || "خطا در ثبت لایک", "error");
  }
};

const toggleDislike = async (comment: CommentWithMeta) => {
  if (!authStore.isLoggedIn) {
    loginDialog.value = true;
    return;
  }
  const newValue: -1 | 0 | 1 = comment.my_vote === -1 ? 0 : -1;
  try {
    await commentsStore.toggleVote(comment.id, newValue);
  } catch (error: any) {
    showToast(error?.message || "خطا در ثبت دیسلایک", "error");
  }
};

const deleteComment = async (comment: CommentWithMeta) => {
  if (!canDeleteComment(comment)) return;
  if (!confirm("آیا از حذف این نظر مطمئن هستید؟")) return;

  try {
    await commentsStore.deleteComment(comment.id);
    showToast("نظر حذف شد.", "success");
  } catch (error: any) {
    showToast(error?.message || "خطا در حذف نظر", "error");
  }
};
</script>

<template>
  <div>
    <div v-if="!firstLoadDone" class="w-full h-[80vh] flex items-center justify-center">
      <AppLoader />
    </div>

    <div v-else-if="errorMessage" class="text-center py-10 text-red-500">
      <v-alert type="error" prominent>{{ errorMessage }}</v-alert>
    </div>
    <div v-else-if="product">
      <div class="grid grid-cols-12 px-4 lg:px-16 gap-y-12 lg:gap-x-12 py-8 relative">
        <!-- product image -->
        <div class="col-span-4">
          <div class="sticky top-28 transition-all duration-300">
            <div class="relative group overflow-hidden rounded-2xl shadow-lg border border-gray-100 bg-white">
              <v-carousel v-model="selectedImageIndex" hide-delimiters :show-arrows="thumbnailImages.length > 1 ? 'hover' : false" height="400" color="primary">
                <v-carousel-item v-for="(imgUrl, index) in thumbnailImages" :key="index" :src="imgUrl" cover class="cursor-zoom-in" @click="galleryOpen = true"></v-carousel-item>
              </v-carousel>
            </div>

            <div v-if="thumbnailImages.length > 1" class="mt-6 flex flex-wrap gap-3 justify-center">
              <div
                v-for="(imgUrl, index) in thumbnailImages"
                :key="index"
                class="relative w-20 h-20 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 border-2"
                :class="
                  selectedImageIndex === index
                    ? 'border-primary ring-2 ring-primary/20 scale-110 shadow-lg'
                    : 'border-transparent opacity-70 hover:opacity-100 hover:border-gray-300'
                "
                @click="selectImage(index)">
                <v-img :src="imgUrl" cover class="w-full h-full"></v-img>
              </div>
            </div>
          </div>
        </div>
        <!-- product details-->
        <div class="col-span-5 flex flex-col">
          <!-- name & type -->
          <div class="pb-4">
            <div class="flex items-center gap-3 mb-3">
              <span v-if="productType" class="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full"> دسته بندی: {{ productType.typename }} </span>
              <span class="bg-gray-100 text-gray-500 text-xs font-mono px-2 py-1 rounded"> شناسه: {{ product.product_code }} </span>
            </div>

            <h1 class="text-xl font-semibold text-gray-900 leading-tight mb-6 tracking-tight">
              {{ product.title }}
            </h1>
          </div>
          <!-- variable attributes -->
          <div v-if="categorizedAttributes.variable.length > 0" class="!space-y-6 mb-8">
            <div v-for="attribute in categorizedAttributes.variable" :key="attribute.id">
              <h3 class="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">{{ attribute.name }}</h3>
              <div class="flex flex-wrap gap-3 border-b-2 pb-2 border-gray-400 border-dashed">
                <button
                  v-for="val in Array.from(uniqueAttributeValues[attribute.name] || [])"
                  :key="val"
                  @click="
                    selectedOptions[attribute.name] = val;
                    handleOptionChange();
                  "
                  class="min-w-[3.5rem] px-4 py-1 text-sm !text-neutral-500 font-semibold border border-solid border-neutral-800 hover:scale-105 rounded-lg transition-all duration-200 flex items-center justify-center"
                  :class="selectedOptions[attribute.name] === val ? 'mybg !text-white shadow-sm' : 'border-gray-100 text-white hover:border-gray-300 hover:bg-gray-100'">
                  {{ val }}
                </button>
              </div>
            </div>
          </div>
          <!-- attributes -->
          <div v-if="categorizedAttributes.fixed.length > 0" class="mb-8">
            <h3 class="font-semibold text-black mb-3 uppercase tracking-wider">مشخصات</h3>
            <div class="flex flex-col gap-3">
              <div
                v-for="attribute in categorizedAttributes.fixed"
                :key="attribute.name"
                class="border-b-2 py-1 border-dashed border-gray-400 grid grid-cols-12 items-center justify-center">
                <p class="text-gray-500 mb-1 col-span-4">{{ attribute.name }}:</p>
                <p class="text-sm font-bold text-gray-800 col-span-8">{{ attribute.value }}</p>
              </div>
            </div>
          </div>
        </div>
        <!-- CTA -->
        <div class="col-span-3 sticky top-32 z-20 self-start">
          <div class="bg-gray-100 border border-gray-100 rounded-3xl !p-6 shadow-sm">
            <!-- Status Area (Fixed height to prevent layout shift) -->
            <div class="min-h-[28px] mb-4 flex flex-col justify-center">
              <div
                v-if="!addedToCart && selectedVariant && selectedVariant.stock_quantity < 10 && selectedVariant.stock_quantity > 0"
                class="text-[10px] font-bold text-orange-600 flex items-center gap-1 animate-pulse">
                <v-icon size="14" color="orange">mdi-fire</v-icon>
                فقط {{ formatNumber(selectedVariant.stock_quantity) }} عدد در انبار باقیست
              </div>
              <div v-if="existingCartItemForSelectedVariant && existingCartItemForSelectedVariant.quantity > 0" class="text-[10px] font-bold text-blue-600 flex items-center gap-1">
                <v-icon size="14" color="blue">mdi-cart-check</v-icon>
                {{ formatNumber(existingCartItemForSelectedVariant.quantity) }} عدد در سبد خرید شماست
              </div>
            </div>

            <!-- price Section -->
            <div class="flex items-end justify-between mb-6">
              <!-- <span class="text-gray-400 text-xs font-medium">قیمت نهایی</span> -->
              <div class="flex w-full justify-end items-baseline gap-1">
                <template v-if="currentPrice !== null">
                  <div class="flex flex-col items-end gap-1 w-full">
                    <!-- Badges -->
                    <div v-if="hasDiscountOnSelected" class="flex items-center gap-2">
                      <span class="px-2 py-1 rounded-full text-[10px] font-black bg-red-600 text-white"> ٪{{ formatNumber(selectedDiscountPercent) }} تخفیف </span>
                      <span v-if="showDiscountFire" class="px-2 py-1 rounded-full text-[10px] font-black bg-black text-white"> 🔥 ویژه </span>
                    </div>

                    <!-- Prices -->
                    <div class="flex items-baseline gap-2 justify-end w-full">
                      <span class="text-2xl font-black text-gray-900 tracking-tighter">{{ formatNumber(currentPrice) }}</span>
                      <span class="text-[10px] font-bold text-gray-500">تومان</span>
                    </div>

                    <div v-if="hasDiscountOnSelected && selectedOldPrice" class="text-[11px] font-bold text-gray-400 line-through">{{ formatNumber(selectedOldPrice) }} تومان</div>
                  </div>
                </template>

                <span v-else-if="isInvalidCombination" class="text-red-500 text-lg font-bold">ناموجود</span>
                <span v-else class="text-gray-200 text-xl tracking-widest">---</span>
              </div>
            </div>

            <!-- Action Row -->
            <div v-if="!isInvalidCombination" class="flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <!-- Minimal Quantity Selector -->
                <div class="flex items-center bg-gray-50 rounded-xl border border-gray-100 p-1">
                  <v-btn icon variant="text" size="32" @click="decrement" :disabled="quantity <= 1">
                    <v-icon size="18">mdi-minus</v-icon>
                  </v-btn>
                  <span class="w-8 text-center font-bold text-sm text-gray-700">{{ formatNumber(quantity) }}</span>
                  <v-btn
                    icon
                    variant="text"
                    size="32"
                    color="primary"
                    @click="increment"
                    :disabled="!selectedVariant || (selectedVariant && quantity >= selectedVariant.stock_quantity)">
                    <v-icon size="18">mdi-plus</v-icon>
                  </v-btn>
                </div>

                <!-- Main CTA Button -->
                <v-btn
                  color="primary"
                  height="44"
                  class="flex-1 !rounded-xl !text-xs !font-bold elevation-0 transition-all"
                  :class="{ '!bg-green-600 !text-white': addedToCart }"
                  :disabled="isPrimaryCtaDisabled"
                  @click="handleAddToCart">
                  <v-icon start size="18" class="me-1">{{ primaryCtaIcon }}</v-icon>
                  {{ primaryCtaLabel }}
                </v-btn>
              </div>
              <div class="mt-4 !p-4 border border-dashed border-gray-200 rounded-xl flex items-center gap-3">
                <v-icon size="20" color="grey-lighten-1">mdi-shield-check-outline</v-icon>
                <span class="text-[11px] text-gray-500">ضمانت اصالت و سلامت فیزیکی کالا</span>
              </div>
            </div>

            <p v-if="!addedToCart && selectedVariant && selectedVariant.stock_quantity === 0" class="text-red-500 font-bold text-center mt-4 bg-red-50 py-2 rounded-xl text-[10px]">
              موجودی این کالا به اتمام رسیده است
            </p>
          </div>
        </div>
      </div>
      <!-- similar products -->
      <SimilarProducts v-if="product" :product="product" />

      <!-- description & comments -->
      <div class="grid grid-cols-12 gap-x-10 relative">
        <div class="col-span-9 flex flex-col">
          <!-- description -->
          <div class="mt-4">
            <h2 class="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <v-icon color="primary">mdi-text-box-outline</v-icon>
              توضیحات محصول
            </h2>
            <div class="prose prose-sm md:prose-base max-w-none text-gray-600 leading-loose text-justify bg-white rounded-2xl">
              {{ product.description || "توضیحاتی برای این محصول ارائه نشده است." }}
            </div>
          </div>
          <section id="comments" class="mt-8 px-4 lg:px-16 pb-12">
            <div class="rounded-2xl p-6 space-y-6">
              <!-- هدر -->
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <v-icon color="primary">mdi-message-text-outline</v-icon>
                  <h2 class="text-xl font-bold text-gray-900">نظرات کاربران</h2>
                </div>
                <span v-if="productComments.length" class="text-xs text-gray-500"> {{ formatNumber(productComments.length) }} نظر ثبت‌شده </span>
              </div>

              <!-- فرم ثبت نظر -->
              <div class="rounded-xl p-4 bg-gray-50/60">
                <div v-if="authStore.isLoggedIn" class="space-y-3">
                  <div v-if="replyingTo" class="flex items-center justify-between text-xs bg-blue-50 text-blue-800 px-3 py-2 rounded-lg mb-2">
                    <span>
                      در حال پاسخ به نظر
                      {{ replyingTo.user_full_name || "کاربر" }}
                    </span>
                    <button class="text-[11px] underline" @click="replyingTo = null">لغو پاسخ</button>
                  </div>

                  <v-textarea
                    v-model="newCommentText"
                    variant="outlined"
                    rows="3"
                    auto-grow
                    class="mt-4"
                    rounded="lg"
                    bg-color="white"
                    label="نظر یا پرسش خود را بنویسید..."
                    :counter="500"
                    maxlength="500" />

                  <div class="flex justify-between items-center gap-2">
                    <span class="text-[11px] text-gray-500"> نظر شما بعد از بررسی توسط ادمین نمایش داده خواهد شد. </span>
                    <v-btn
                      color="primary"
                      size="small"
                      class="!rounded-lg"
                      :disabled="!newCommentText.trim() || submittingComment"
                      :loading="submittingComment"
                      @click="submitComment">
                      ثبت نظر
                    </v-btn>
                  </div>
                </div>

                <div v-else class="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p class="text-sm text-gray-600">برای ثبت نظر یا پرسش، ابتدا وارد حساب کاربری خود شوید.</p>
                  <v-btn color="primary" size="small" class="!rounded-lg" @click="loginDialog = true"> ورود / ثبت‌نام </v-btn>
                </div>
              </div>

              <!-- لیست نظرات -->
              <div v-if="productComments.length === 0" class="text-center text-gray-500 text-sm py-6">
                <p>هنوز نظری برای این محصول ثبت نشده است.</p>
                <p class="mt-1 text-xs">اولین نفری باشید که تجربه‌تان را به اشتراک می‌گذارید 🌟</p>
              </div>

              <div v-else class="divide-y divide-gray-100">
                <!-- کامنت‌های والد -->
                <div v-for="comment in topLevelComments" :key="comment.id" class="py-5">
                  <div class="rounded-2xl bg-white px-4 sm:px-5 py-4 shadow-sm border border-gray-100">
                    <!-- هدر -->
                    <div class="flex items-center justify-between gap-2 mb-2">
                      <div class="flex items-center gap-2">
                        <div class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                          <v-icon size="26" color="primary">mdi-account</v-icon>
                        </div>

                        <div class="flex flex-col">
                          <span class="text-sm font-semibold text-gray-800">
                            {{ comment.user_full_name || "کاربر MazinShop" }}
                            <span v-if="authStore.user && authStore.user.id === comment.user_id" class="text-[11px] text-blue-500 ms-1"> (شما) </span>
                          </span>
                        </div>
                      </div>

                      <div class="flex items-center gap-2 text-[11px] text-gray-500">
                        <span class="text-gray-400 !text-sm">
                          {{ formatDate(comment.created_at) }}
                        </span>
                        <v-btn v-if="canDeleteComment(comment)" icon variant="text" size="x-small" color="red" @click="deleteComment(comment)">
                          <v-icon size="18">mdi-delete</v-icon>
                          <v-tooltip class="!text-xs" activator="parent" location="bottom"><p class="text-xs">حذف نظر</p></v-tooltip>
                        </v-btn>
                      </div>
                    </div>

                    <!-- متن -->
                    <p class="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                      {{ comment.content }}
                    </p>

                    <!-- اکشن‌ها -->
                    <div class="mt-3 flex items-center gap-3 text-xs">
                      <button class="flex items-center gap-1 text-gray-500 hover:text-primary-600" @click="toggleLike(comment)">
                        <v-icon size="18" :color="comment.my_vote === 1 ? 'primary' : undefined">
                          {{ comment.my_vote === 1 ? "mdi-thumb-up" : "mdi-thumb-up-outline" }}
                        </v-icon>
                        <span>{{ formatNumber(comment.like_count) }}</span>
                      </button>

                      <button class="flex items-center gap-1 text-gray-500 hover:text-red-500" @click="toggleDislike(comment)">
                        <v-icon size="18" :color="comment.my_vote === -1 ? 'red' : undefined">
                          {{ comment.my_vote === -1 ? "mdi-thumb-down" : "mdi-thumb-down-outline" }}
                        </v-icon>
                        <span>{{ formatNumber(comment.dislike_count) }}</span>
                      </button>

                      <button class="flex items-center gap-1 text-gray-500 hover:text-primary" @click="startReply(comment)">
                        <v-icon size="18">mdi-reply</v-icon>
                        <span>پاسخ</span>
                      </button>
                    </div>

                    <!-- ریپلای‌ها -->
                    <div v-if="getReplies(comment.id).length" class="mt-4 ms-4 ps-4 border-s-2 border-gray-100 space-y-3">
                      <div v-for="reply in getReplies(comment.id)" :key="reply.id" class="rounded-xl bg-gray-50 px-4 py-3 border border-gray-100">
                        <div class="flex items-center justify-between gap-2 mb-1">
                          <div class="flex items-center gap-2">
                            <div class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                              <v-icon size="26" :color="isAdmin ? 'yellow-darken-3' : 'primary'">{{ isAdmin ? "mdi-crown" : "mdi-account" }}</v-icon>
                            </div>

                            <span class="text-xs font-semibold text-gray-800">
                              {{ isAdmin ? "پاسخ ادمین" : reply.user_full_name || "کاربر MazinShop" }}
                            </span>
                          </div>
                          <div class="flex items-center gap-2">
                            <span class="text-gray-400 !text-sm">
                              {{ formatDate(reply.created_at) }}
                            </span>
                            <v-btn v-if="canDeleteComment(reply)" icon variant="text" size="x-small" color="red" @click="deleteComment(reply)">
                              <v-icon size="18">mdi-delete</v-icon>
                              <v-tooltip class="!text-xs" activator="parent" location="bottom"><p class="text-xs">حذف نظر</p></v-tooltip>
                            </v-btn>
                          </div>
                        </div>
                        <p class="text-xs text-gray-800 whitespace-pre-line">
                          {{ reply.content }}
                        </p>
                        <!-- اکشن‌های ریپلای: فقط لایک/دیس‌لایک -->
                        <div class="mt-2 flex items-center gap-3 text-xs">
                          <button class="flex items-center gap-1 text-gray-500 hover:text-primary-600" @click="toggleLike(reply)">
                            <v-icon size="18" :color="reply.my_vote === 1 ? 'primary' : undefined">
                              {{ reply.my_vote === 1 ? "mdi-thumb-up" : "mdi-thumb-up-outline" }}
                            </v-icon>
                            <span>{{ formatNumber(reply.like_count) }}</span>
                          </button>

                          <button class="flex items-center gap-1 text-gray-500 hover:text-red-500" @click="toggleDislike(reply)">
                            <v-icon size="18" :color="reply.my_vote === -1 ? 'red' : undefined">
                              {{ reply.my_vote === -1 ? "mdi-thumb-down" : "mdi-thumb-down-outline" }}
                            </v-icon>
                            <span>{{ formatNumber(reply.dislike_count) }}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- دیالوگ لاگین -->
            <v-dialog v-model="loginDialog" max-width="420">
              <v-card>
                <v-card-title class="text-base font-bold">ورود به حساب کاربری</v-card-title>
                <v-card-text class="text-sm text-gray-600"> برای ثبت نظر و استفاده از امکانات کامل، لطفاً ابتدا وارد حساب کاربری خود شوید. </v-card-text>
                <v-card-actions class="justify-end gap-2">
                  <v-btn variant="text" size="small" @click="loginDialog = false">بستن</v-btn>
                  <v-btn color="primary" size="small" @click="handleLoginRedirect"> رفتن به صفحه ورود </v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </section>
        </div>
        <!-- CTA -->
        <div class="col-span-3 mt-10 sticky top-32 z-20 self-start">
          <div class="bg-gray-100 border border-gray-100 rounded-3xl !p-6 shadow-sm">
            <h1 class="text-xl font-semibold text-gray-900 leading-tight mb-6 tracking-tight">
              {{ product.title }}
            </h1>
            <!-- price Section -->
            <div class="flex items-end justify-between mb-6">
              <!-- <span class="text-gray-400 text-xs font-medium">قیمت نهایی</span> -->
              <div class="flex w-full justify-end items-baseline gap-1">
                <template v-if="currentPrice !== null">
                  <div class="flex flex-col items-end gap-1 w-full">
                    <!-- Badges -->
                    <div v-if="hasDiscountOnSelected" class="flex items-center gap-2">
                      <span class="px-2 py-1 rounded-full text-[10px] font-black bg-red-600 text-white"> ٪{{ formatNumber(selectedDiscountPercent) }} تخفیف </span>
                      <span v-if="showDiscountFire" class="px-2 py-1 rounded-full text-[10px] font-black bg-black text-white"> 🔥 ویژه </span>
                    </div>

                    <!-- Prices -->
                    <div class="flex items-baseline gap-2 justify-end w-full">
                      <span class="text-2xl font-black text-gray-900 tracking-tighter">{{ formatNumber(currentPrice) }}</span>
                      <span class="text-[10px] font-bold text-gray-500">تومان</span>
                    </div>

                    <div v-if="hasDiscountOnSelected && selectedOldPrice" class="text-[11px] font-bold text-gray-400 line-through">{{ formatNumber(selectedOldPrice) }} تومان</div>
                  </div>
                </template>

                <span v-else-if="isInvalidCombination" class="text-red-500 text-lg font-bold">ناموجود</span>
                <span v-else class="text-gray-200 text-xl tracking-widest">---</span>
              </div>
            </div>

            <!-- Action Row -->
            <div v-if="!isInvalidCombination" class="flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <!-- Minimal Quantity Selector -->
                <div class="flex items-center bg-gray-50 rounded-xl border border-gray-100 p-1">
                  <v-btn icon variant="text" size="32" @click="decrement" :disabled="quantity <= 1">
                    <v-icon size="18">mdi-minus</v-icon>
                  </v-btn>
                  <span class="w-8 text-center font-bold text-sm text-gray-700">{{ formatNumber(quantity) }}</span>
                  <v-btn
                    icon
                    variant="text"
                    size="32"
                    color="primary"
                    @click="increment"
                    :disabled="!selectedVariant || (selectedVariant && quantity >= selectedVariant.stock_quantity)">
                    <v-icon size="18">mdi-plus</v-icon>
                  </v-btn>
                </div>

                <!-- Main CTA Button -->
                <v-btn
                  color="primary"
                  height="44"
                  class="flex-1 !rounded-xl !text-xs !font-bold elevation-0 transition-all"
                  :class="{ '!bg-green-600 !text-white': addedToCart }"
                  :disabled="isPrimaryCtaDisabled"
                  @click="handleAddToCart">
                  <v-icon start size="18" class="me-1">{{ primaryCtaIcon }}</v-icon>
                  {{ primaryCtaLabel }}
                </v-btn>
              </div>
              <!-- Status Area (Fixed height to prevent layout shift) -->
              <div class="min-h-[28px] mb-4 flex flex-col justify-center">
                <div
                  v-if="!addedToCart && selectedVariant && selectedVariant.stock_quantity < 10 && selectedVariant.stock_quantity > 0"
                  class="text-[10px] font-bold text-orange-600 flex items-center gap-1 animate-pulse">
                  <v-icon size="14" color="orange">mdi-fire</v-icon>
                  فقط {{ formatNumber(selectedVariant.stock_quantity) }} عدد در انبار باقیست
                </div>
                <div
                  v-if="existingCartItemForSelectedVariant && existingCartItemForSelectedVariant.quantity > 0"
                  class="text-[10px] font-bold text-blue-600 flex items-center gap-1">
                  <v-icon size="14" color="blue">mdi-cart-check</v-icon>
                  {{ formatNumber(existingCartItemForSelectedVariant.quantity) }} عدد در سبد خرید شماست
                </div>
              </div>
              <div class="!p-4 border border-dashed border-gray-200 rounded-xl flex items-center gap-3">
                <v-icon size="20" color="grey-lighten-1">mdi-shield-check-outline</v-icon>
                <span class="text-[11px] text-gray-500">ضمانت اصالت و سلامت فیزیکی کالا</span>
              </div>
            </div>

            <p v-if="!addedToCart && selectedVariant && selectedVariant.stock_quantity === 0" class="text-red-500 font-bold text-center mt-4 bg-red-50 py-2 rounded-xl text-[10px]">
              موجودی این کالا به اتمام رسیده است
            </p>
          </div>
        </div>
      </div>

      <!-- Trust Badges -->
      <div class="mt-12 border-t border-gray-100 pt-10 pb-6 px-4 lg:px-16">
        <div class="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div class="flex flex-col items-center text-center gap-3 group">
            <v-icon size="40" color="grey-darken-1" class="group-hover:text-primary transition-colors">mdi-shield-star-outline</v-icon>
            <span class="text-xs font-bold text-gray-700">ضمانت سالم بودن کالا</span>
          </div>
          <div class="flex flex-col items-center text-center gap-3 group">
            <v-icon size="40" color="grey-darken-1" class="group-hover:text-primary transition-colors">mdi-tag-heart-outline</v-icon>
            <span class="text-xs font-bold text-gray-700">تضمین بهترین قیمت</span>
          </div>
          <div class="flex flex-col items-center text-center gap-3 group">
            <v-icon size="40" color="grey-darken-1" class="group-hover:text-primary transition-colors">mdi-truck-fast-outline</v-icon>
            <span class="text-xs font-bold text-gray-700">ارسال سریع و اکسپرس</span>
          </div>

          <div class="flex flex-col items-center text-center gap-3 group">
            <v-icon size="40" color="grey-darken-1" class="group-hover:text-primary transition-colors">mdi-history</v-icon>
            <span class="text-xs font-bold text-gray-700">۷ روز ضمانت بازگشت</span>
          </div>
          <div class="flex flex-col items-center text-center gap-3 group">
            <v-icon size="40" color="grey-darken-1" class="group-hover:text-primary transition-colors">mdi-credit-card-outline</v-icon>
            <span class="text-xs font-bold text-gray-700">امکان پرداخت در محل</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Fullscreen Gallery -->
    <v-dialog v-model="galleryOpen" fullscreen transition="dialog-bottom-transition" class="z-[9999]">
      <v-card class="!bg-black/80 h-full relative !rounded-none flex !px-5 flex-col">
        <v-btn icon variant="text" class="absolute top-4 left-4 z-50 text-white !bg-black/100 hover:bg-black/40" @click="galleryOpen = false">
          <v-icon size="32">mdi-close</v-icon>
        </v-btn>

        <div class="flex-1 flex items-center justify-center overflow-hidden">
          <v-carousel v-model="selectedImageIndex" hide-delimiters :show-arrows="thumbnailImages.length > 1 ? 'hover' : false" height="100%" class="h-full w-full">
            <v-carousel-item v-for="(imgUrl, index) in thumbnailImages" :key="index" :src="imgUrl" contain></v-carousel-item>
          </v-carousel>
        </div>

        <div v-if="thumbnailImages.length > 1" class="h-24 flex items-center justify-center gap-3 pb-6 px-4 overflow-x-auto">
          <div
            v-for="(imgUrl, index) in thumbnailImages"
            :key="index"
            class="w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all shrink-0"
            :class="selectedImageIndex === index ? 'border-primary opacity-100 scale-110' : 'border-gray-600 opacity-60 hover:opacity-100'"
            @click="selectedImageIndex = index">
            <v-img :src="imgUrl" cover class="w-full h-full"></v-img>
          </div>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>
