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

const cartStore = useCartStore();
const router = useRouter();
const authStore = useAuthStore();
const commentsStore = useCommentsStore();

const { trigger: showToast } = useToast();
const route = useRoute();
const productStore = useProductStore();
const typesStore = useTypesStore();

const loading = ref(true);
const errorMessage = ref<string | null>(null);

const quantity = ref(1);
const productId = computed(() => Number(route.params.id));
const selectedImageIndex = ref(0);

// انتخاب‌های کاربر برای اتریبیوت‌های متغیر
const selectedOptions = ref<Record<string, string>>({});

// وضعیت CTA: بعد از افزودن کالا، دکمه به «مشاهده سبد خرید» تغییر می‌کند
const addedToCart = ref(false);

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
    return d.toLocaleString("fa-IR", {
      dateStyle: "short",
      timeStyle: "short",
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
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

async function fetchDetails() {
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
      // پیش‌انتخاب اولین وریِنت (در صورت وجود)
      const firstVariant = productStore.currentProductDetails.product.variants?.[0];
      if (firstVariant) {
        selectedOptions.value = { ...firstVariant.attributes };
      }
      await commentsStore.fetchCommentsForProduct(productId.value);
    }
  } catch (err) {
    errorMessage.value = "خطا در دریافت اطلاعات محصول.";
    console.error(err);
  } finally {
    loading.value = false;
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
const currentPrice = computed<number | null>(() => selectedVariant.value?.price ?? null);

const isInvalidCombination = computed(() => allVariableSelected.value && !selectedVariant.value && (allVariants.value?.length || 0) > 0);

// ---------- Helpers ----------
const formatNumber = (num: number | undefined | null) => (num != null ? num.toLocaleString("fa-IR") : "-");

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
    <div v-if="loading" class="text-center py-10">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
      <p>در حال بارگذاری اطلاعات محصول...</p>
    </div>

    <div v-else-if="errorMessage" class="text-center py-10 text-red-500">
      <v-alert type="error" prominent>{{ errorMessage }}</v-alert>
    </div>
    <div v-else-if="product">
      <div class="grid grid-cols-12 px-4 lg:px-16 gap-y-12 lg:gap-x-16 py-8">
        <div class="col-span-12 md:col-span-5 lg:col-span-5">
          <div class="sticky top-28 transition-all duration-300">
            <div class="relative group overflow-hidden rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 border border-gray-100 bg-white">
              <v-img :src="mainImageUrl" aspect-ratio="1" cover class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"></v-img>

              <div v-if="selectedVariant && selectedVariant.stock_quantity === 0" class="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-sm z-10">
                <span class="text-red-600 font-extrabold text-2xl border-4 border-red-600 px-6 py-2 rounded-lg -rotate-12 opacity-80">ناموجود</span>
              </div>
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

        <div class="col-span-12 md:col-span-6 lg:col-span-6 flex flex-col">
          <div class="pb-4">
            <div class="flex items-center gap-3 mb-3">
              <span v-if="productType" class="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full"> دسته بندی: {{ productType.typename }} </span>
              <span class="bg-gray-100 text-gray-500 text-xs font-mono px-2 py-1 rounded"> شناسه محصول: {{ product.product_code }} </span>
            </div>

            <h1 class="text-2xl lg:text-3xl font-semibold text-gray-900 leading-tight mb-4 tracking-tight">
              {{ product.title }}
            </h1>
          </div>

          <div v-if="categorizedAttributes.fixed.length > 0" class="mb-8">
            <h3 class="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">مشخصات فنی</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div v-for="attribute in categorizedAttributes.fixed" :key="attribute.name" class="bg-gray-50 border border-gray-100 rounded-lg !p-1 flex flex-col">
                <span class="text-xs text-gray-500 mb-1">{{ attribute.name }}</span>
                <span class="text-sm font-bold text-gray-800 !ps-2">{{ attribute.value }}</span>
              </div>
            </div>
          </div>

          <div class="bg-white lg:bg-gray-50/50 rounded-2xl lg:p-6 mb-8">
            <div v-if="categorizedAttributes.variable.length > 0" class="!space-y-5 mb-8">
              <div v-for="attribute in categorizedAttributes.variable" :key="attribute.id">
                <!-- <label class="text-sm font-bold text-gray-800 mb-2 block"> انتخاب {{ attribute.name }} </label> -->
                <v-select
                  v-model="selectedOptions[attribute.name]"
                  :items="Array.from(uniqueAttributeValues[attribute.name] || [])"
                  variant="outlined"
                  density="comfortable"
                  bg-color="white"
                  :label="attribute.name"
                  color="primary"
                  rounded="lg"
                  hide-details
                  placeholder="انتخاب کنید..."
                  @update:modelValue="handleOptionChange"></v-select>
              </div>
            </div>

            <div class="flex items-center justify-between w-full gap-2 mb-6 border-t border-dashed border-gray-300 pt-6">
              <div class="flex flex-col items-start gap-2">
                <div
                  v-if="!addedToCart && selectedVariant && selectedVariant.stock_quantity < 10 && selectedVariant.stock_quantity > 0"
                  class="bg-orange-100 text-orange-700 text-xs px-3 py-1 rounded-full font-bold animate-pulse">
                  فقط {{ formatNumber(selectedVariant.stock_quantity) }} عدد باقیست
                </div>

                <div
                  v-if="existingCartItemForSelectedVariant && existingCartItemForSelectedVariant.quantity > 0"
                  class="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-bold">
                  {{ formatNumber(existingCartItemForSelectedVariant.quantity) }} عدد از این محصول در سبد خرید شماست
                </div>
              </div>
              <div class="">
                <p class="text-4xl font-black text-gray-900 tracking-tight">
                  <span v-if="currentPrice !== null"> {{ formatNumber(currentPrice) }} <span class="text-lg font-medium text-gray-500">تومان</span> </span>
                  <span v-else-if="isInvalidCombination" class="text-red-500 text-2xl">ناموجود</span>
                  <span v-else class="text-gray-400 text-xl">---</span>
                </p>
              </div>
            </div>

            <div v-if="!isInvalidCombination" class="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              <div class="flex items-center justify-between bg-white border border-gray-300 rounded-xl px-2 h-14 w-full sm:w-40 shrink-0">
                <v-btn icon variant="text" size="small" color="grey" @click="decrement" :disabled="quantity <= 1">
                  <v-icon>mdi-minus</v-icon>
                </v-btn>
                <span class="text-lg font-bold text-gray-800 select-none w-8 text-center">{{ formatNumber(quantity) }}</span>
                <v-btn
                  icon
                  variant="text"
                  size="small"
                  color="primary"
                  @click="increment"
                  :disabled="!selectedVariant || (selectedVariant && quantity >= selectedVariant.stock_quantity)">
                  <v-icon>mdi-plus</v-icon>
                </v-btn>
              </div>

              <v-btn
                color="primary"
                size="x-large"
                class="flex-grow !h-14 !rounded-xl !text-lg !font-bold !shadow-lg hover:!shadow-xl transition-all"
                :class="{ '!bg-green-600 !text-white': addedToCart }"
                elevation="4"
                :disabled="isPrimaryCtaDisabled"
                :prepend-icon="primaryCtaIcon"
                @click="handleAddToCart">
                {{ primaryCtaLabel }}
              </v-btn>
            </div>

            <p v-if="!addedToCart && selectedVariant && selectedVariant.stock_quantity === 0" class="text-red-600 font-medium text-center mt-4 bg-red-50 p-2 rounded-lg">
              متاسفانه موجودی این محصول به اتمام رسیده است.
            </p>
          </div>

          <div class="mt-4">
            <h2 class="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <v-icon color="primary">mdi-text-box-outline</v-icon>
              توضیحات محصول
            </h2>
            <div class="prose prose-sm md:prose-base max-w-none text-gray-600 leading-loose text-justify bg-white rounded-2xl">
              {{ product.description || "توضیحاتی برای این محصول ارائه نشده است." }}
            </div>
          </div>
        </div>
      </div>

      <section id="comments" class="mt-8 px-4 lg:px-16 pb-12">
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
          <!-- هدر -->
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <v-icon color="primary">mdi-message-text-outline</v-icon>
              <h2 class="text-xl font-bold text-gray-900">نظرات کاربران</h2>
            </div>
            <span v-if="productComments.length" class="text-xs text-gray-500"> {{ formatNumber(productComments.length) }} نظر ثبت‌شده </span>
          </div>

          <!-- فرم ثبت نظر -->
          <div class="border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50/60">
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
                rounded="lg"
                bg-color="white"
                label="نظر یا پرسش خود را بنویسید..."
                :counter="500"
                maxlength="500" />

              <div class="flex justify-between items-center gap-2">
                <span class="text-[11px] text-gray-500"> نظر شما بعد از بررسی توسط ادمین نمایش داده خواهد شد. </span>
                <v-btn color="primary" size="small" class="!rounded-lg" :disabled="!newCommentText.trim() || submittingComment" :loading="submittingComment" @click="submitComment">
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

          <div v-else class="space-y-4">
            <!-- کامنت‌های والد -->
            <div v-for="comment in topLevelComments" :key="comment.id" class="border border-gray-100 rounded-xl p-4 bg-gray-50">
              <!-- هدر -->
              <div class="flex items-center justify-between gap-2 mb-2">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {{ (comment.user_full_name || "کاربر").slice(0, 2) }}
                  </div>
                  <div class="flex flex-col">
                    <span class="text-sm font-semibold text-gray-800">
                      {{ comment.user_full_name || "کاربر MazinShop" }}
                      <span v-if="authStore.user && authStore.user.id === comment.user_id" class="text-[11px] text-blue-500 ms-1"> (شما) </span>
                    </span>
                    <span class="text-[11px] text-gray-400">
                      {{ formatDate(comment.created_at) }}
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-1 text-[11px] text-gray-500">
                  <v-btn v-if="canDeleteComment(comment)" icon variant="text" size="x-small" color="red" @click="deleteComment(comment)">
                    <v-icon size="16">mdi-delete-outline</v-icon>
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
              <div v-if="getReplies(comment.id).length" class="mt-3 ps-4 border-s border-gray-200 space-y-3">
                <div v-for="reply in getReplies(comment.id)" :key="reply.id" class="bg-white rounded-lg p-3 border border-gray-100">
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-semibold text-gray-800">
                        {{ reply.user_full_name || "کاربر MazinShop" }}
                      </span>
                      <span class="text-[11px] text-gray-400">
                        {{ formatDate(reply.created_at) }}
                      </span>
                    </div>
                    <v-btn v-if="canDeleteComment(reply)" icon variant="text" size="x-small" color="red" @click="deleteComment(reply)">
                      <v-icon size="16">mdi-delete-outline</v-icon>
                    </v-btn>
                  </div>
                  <p class="text-xs text-gray-800 whitespace-pre-line">
                    {{ reply.content }}
                  </p>
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
  </div>
</template>
