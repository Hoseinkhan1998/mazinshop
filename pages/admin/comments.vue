<script setup lang="ts">
import { onMounted, computed } from "vue";
import { useCommentsStore } from "~/stores/comments";
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  middleware: ["authenticated", "admin-auth"],
});

const commentsStore = useCommentsStore();
const authStore = useAuthStore();

onMounted(() => {
  commentsStore.fetchAllCommentsForAdmin();
});

const rows = computed(() => commentsStore.adminComments);

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

const statusColor = (status: string) => {
  if (status === "approved") return "green";
  if (status === "pending") return "orange";
  if (status === "rejected") return "red";
  return "grey";
};

const approve = async (id: number) => {
  await commentsStore.approveComment(id);
};

const remove = async (id: number) => {
  if (!confirm("از حذف این نظر مطمئن هستید؟")) return;
  await commentsStore.deleteComment(id);
};
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">مدیریت نظرات کاربران</h1>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div v-if="commentsStore.adminLoading" class="text-center py-8 text-gray-500 text-sm">در حال بارگذاری نظرات...</div>

      <div v-else-if="rows.length === 0" class="text-center py-8 text-gray-500 text-sm">نظری برای مدیریت وجود ندارد.</div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b bg-gray-50 text-xs text-gray-500">
              <th class="px-3 py-2 text-right">کاربر</th>
              <th class="px-3 py-2 text-right">محصول</th>
              <th class="px-3 py-2 text-right">متن نظر</th>
              <th class="px-3 py-2 text-right">تاریخ</th>
              <th class="px-3 py-2 text-right">وضعیت</th>
              <th class="px-3 py-2 text-right">اقدامات</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in rows" :key="c.id" class="border-b last:border-b-0">
              <td class="px-3 py-2 whitespace-nowrap">
                {{ c.user_full_name || "کاربر" }}
              </td>
              <td class="px-3 py-2 whitespace-nowrap">#{{ c.product_id }}</td>
              <td class="px-3 py-2 max-w-md">
                <div class="line-clamp-3">{{ c.content }}</div>
              </td>
              <td class="px-3 py-2 whitespace-nowrap">
                {{ formatDate(c.created_at) }}
              </td>
              <td class="px-3 py-2 whitespace-nowrap">
                <span
                  class="px-2 py-1 rounded-full text-[11px] font-semibold"
                  :class="{
                    'bg-green-100 text-green-700': c.status === 'approved',
                    'bg-orange-100 text-orange-700': c.status === 'pending',
                    'bg-red-100 text-red-700': c.status === 'rejected',
                  }">
                  {{ c.status === "approved" ? "تایید شده" : c.status === "pending" ? "در انتظار" : "رد شده" }}
                </span>
              </td>
              <td class="px-3 py-2 whitespace-nowrap">
                <div class="flex items-center gap-2">
                  <v-btn v-if="c.status !== 'approved'" size="x-small" color="green" variant="tonal" @click="approve(c.id)"> تایید </v-btn>
                  <v-btn size="x-small" color="red" variant="text" @click="remove(c.id)"> حذف </v-btn>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
