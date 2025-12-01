<template>
  <div class="h-screen flex flex-col text-left gap-5 bg-neutral-100 w-6/12 !p-20 text-black font-semibold" dir="ltr">
    <!-- underline → line below the text -->
    <div class="flex items-center gap-10">
      <p class="underline decoration-4 decoration-red-600 decoration-wavy">This is underlined.</p>
      <!-- overline → line above the text -->
      <p class="overline decoration-4 decoration-blue-600 decoration-dotted">This has an overline.</p>
      <!-- line-through → line across the text -->
      <p class="line-through decoration-4 decoration-green-600">This is crossed out.</p>
    </div>
  </div>
</template>

<script>
export default {};
</script>

<style></style>
