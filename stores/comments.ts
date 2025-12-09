import { defineStore } from "pinia";
import axios from "axios";
import { useAuthStore } from "./auth";

export type CommentStatus = "pending" | "approved" | "rejected";

export interface CommentWithMeta {
  id: number;
  created_at: string;
  user_id: string;
  product_id: number;
  content: string;
  rating: number | null;
  parent_id: number | null;
  status: CommentStatus;
  user_full_name: string | null;
  like_count: number;
  dislike_count: number;
  my_vote: -1 | 0 | 1;
}

interface State {
  commentsByProduct: Record<number, CommentWithMeta[]>;
  loadingByProduct: Record<number, boolean>;
  adminComments: CommentWithMeta[];
  adminLoading: boolean;
}

export const useCommentsStore = defineStore("comments", {
  state: (): State => ({
    commentsByProduct: {},
    loadingByProduct: {},
    adminComments: [],
    adminLoading: false,
  }),

  actions: {
    // کامنت‌های تأیید شده یک محصول
    async fetchCommentsForProduct(productId: number) {
      const config = useRuntimeConfig();
      const authStore = useAuthStore();
      const { $supabase } = useNuxtApp();

      this.loadingByProduct[productId] = true;

      try {
        const {
          data: { session },
        } = await $supabase.auth.getSession();
        const token = session?.access_token || null;

        const url = `${config.public.supabaseUrl}/rest/v1/comments`;
        const params = new URLSearchParams({
          product_id: `eq.${productId}`,
          status: "eq.approved",
          select: "*,profiles(full_name),comment_votes(user_id,value)",
          order: "created_at.desc",
        });

        const { data } = await axios.get(`${url}?${params.toString()}`, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token || config.public.supabaseKey}`,
          },
        });

        const userId = authStore.user?.id || null;

        const mapped: CommentWithMeta[] = data.map((row: any) => {
          const votes = Array.isArray(row.comment_votes) ? row.comment_votes : [];
          const like_count = votes.filter((v) => v.value === 1).length;
          const dislike_count = votes.filter((v) => v.value === -1).length;
          const my_vote = userId && votes.find((v) => v.user_id === userId) ? (votes.find((v) => v.user_id === userId)!.value as -1 | 1) : 0;

          return {
            id: row.id,
            created_at: row.created_at,
            user_id: row.user_id,
            product_id: row.product_id,
            content: row.content,
            rating: row.rating ?? null,
            parent_id: row.parent_id ?? null,
            status: row.status as CommentStatus,
            user_full_name: row.profiles?.full_name ?? null,
            like_count,
            dislike_count,
            my_vote,
          };
        });

        this.commentsByProduct[productId] = mapped;
      } catch (error) {
        console.error("Error fetching comments:", error);
        this.commentsByProduct[productId] = [];
      } finally {
        this.loadingByProduct[productId] = false;
      }
    },

    // افزودن کامنت (pending)
    async addComment(productId: number, content: string, parentId: number | null = null, rating: number | null = null) {
      const config = useRuntimeConfig();
      const authStore = useAuthStore();
      const { $supabase } = useNuxtApp();

      if (!authStore.user) {
        throw new Error("برای ثبت نظر باید وارد حساب کاربری شوید.");
      }

      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("توکن نامعتبر است.");

      const url = `${config.public.supabaseUrl}/rest/v1/comments`;

      const payload = {
        product_id: productId,
        content,
        rating,
        parent_id: parentId,
        // user_id از RLS / default گرفته می‌شود اگر در پالیسی/دیفالت ست کرده باشی،
        // اگر نه می‌توانی اینجا نیز user_id: authStore.user.id را بفرستی.
      };

      await axios.post(url, payload, {
        headers: {
          apikey: config.public.supabaseKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
      });

      // عمداً لیست لوکال را آپدیت نمی‌کنیم چون pending است و نباید نمایش داده شود.
    },

    // لایک/دیس‌لایک
    async toggleVote(commentId: number, value: -1 | 0 | 1) {
      const config = useRuntimeConfig();
      const authStore = useAuthStore();
      const { $supabase } = useNuxtApp();

      if (!authStore.user) {
        throw new Error("برای لایک/دیس‌لایک باید وارد شوید.");
      }

      const userId = authStore.user.id;
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("توکن نامعتبر است.");

      const baseUrl = `${config.public.supabaseUrl}/rest/v1/comment_votes`;
      const where = `comment_id=eq.${commentId}&user_id=eq.${userId}`;

      // کمک: پیدا کردن کامنت در استیت لوکال
      const updateLocal = (updater: (c: CommentWithMeta) => void) => {
        for (const [pid, list] of Object.entries(this.commentsByProduct)) {
          const idx = list.findIndex((c) => c.id === commentId);
          if (idx !== -1) {
            updater(list[idx]);
            // reassign for reactivity
            this.commentsByProduct[Number(pid)][idx] = { ...list[idx] };
            break;
          }
        }
      };

      // اگر value === 0 یعنی حذف رأی
      if (value === 0) {
        await axios.delete(`${baseUrl}?${where}`, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
          },
        });

        updateLocal((c) => {
          if (c.my_vote === 1) c.like_count--;
          if (c.my_vote === -1) c.dislike_count--;
          c.my_vote = 0;
        });
        return;
      }

      // در غیر این صورت، اگر قبلاً رأی داده بودیم، patch؛ وگرنه post
      const existing = Object.values(this.commentsByProduct)
        .flat()
        .find((c) => c.id === commentId)?.my_vote;

      if (existing === 1 || existing === -1) {
        await axios.patch(
          `${baseUrl}?${where}`,
          { value },
          {
            headers: {
              apikey: config.public.supabaseKey,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
      } else {
        await axios.post(
          baseUrl,
          { comment_id: commentId, value },
          {
            headers: {
              apikey: config.public.supabaseKey,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
      }

      updateLocal((c) => {
        if (c.my_vote === 1) c.like_count--;
        if (c.my_vote === -1) c.dislike_count--;
        if (value === 1) c.like_count++;
        if (value === -1) c.dislike_count++;
        c.my_vote = value;
      });
    },

    // حذف کامنت (برای صاحب یا ادمین)
    async deleteComment(commentId: number) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();

      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("توکن نامعتبر است.");

      const url = `${config.public.supabaseUrl}/rest/v1/comments?id=eq.${commentId}`;

      await axios.delete(url, {
        headers: {
          apikey: config.public.supabaseKey,
          Authorization: `Bearer ${token}`,
        },
      });

      Object.keys(this.commentsByProduct).forEach((pid) => {
        this.commentsByProduct[Number(pid)] = this.commentsByProduct[Number(pid)].filter((c) => c.id !== commentId);
      });

      this.adminComments = this.adminComments.filter((c) => c.id !== commentId);
    },

    // --- بخش ادمین ---

    async fetchAllCommentsForAdmin() {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();

      this.adminLoading = true;
      try {
        const {
          data: { session },
        } = await $supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("توکن نامعتبر است.");

        const url = `${config.public.supabaseUrl}/rest/v1/comments`;
        const params = new URLSearchParams({
          select: "*,profiles(full_name),products(title),comment_votes(user_id,value)",
          order: "created_at.desc",
        });

        const { data } = await axios.get(`${url}?${params.toString()}`, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
          },
        });

        const mapped: CommentWithMeta[] = data.map((row: any) => {
          const votes = Array.isArray(row.comment_votes) ? row.comment_votes : [];
          const like_count = votes.filter((v) => v.value === 1).length;
          const dislike_count = votes.filter((v) => v.value === -1).length;

          return {
            id: row.id,
            created_at: row.created_at,
            user_id: row.user_id,
            product_id: row.product_id,
            content: row.content,
            rating: row.rating ?? null,
            parent_id: row.parent_id ?? null,
            status: row.status as CommentStatus,
            user_full_name: row.profiles?.full_name ?? null,
            like_count,
            dislike_count,
            my_vote: 0, // در صفحه ادمین نیازی نیست
          };
        });

        this.adminComments = mapped;
      } catch (error) {
        console.error("Error fetching admin comments:", error);
        this.adminComments = [];
      } finally {
        this.adminLoading = false;
      }
    },

    async approveComment(commentId: number) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("توکن نامعتبر است.");

      const url = `${config.public.supabaseUrl}/rest/v1/comments?id=eq.${commentId}`;

      const { data } = await axios.patch(
        url,
        { status: "approved" },
        {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
        }
      );

      const updated = data[0];

      this.adminComments = this.adminComments.map((c) => (c.id === commentId ? { ...c, status: "approved" } : c));

      const pid = updated.product_id as number;
      if (this.commentsByProduct[pid]) {
        this.commentsByProduct[pid].push({
          ...updated,
          user_full_name: this.adminComments.find((c) => c.id === commentId)?.user_full_name ?? null,
          like_count: 0,
          dislike_count: 0,
          my_vote: 0,
        });
      }
    },
  },
});
