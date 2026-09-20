<script setup>
/** Two or three ways to order a grid, as quiet text; the current one is lit. */
defineProps({
  modelValue: { type: String, required: true },
  options: { type: Array, required: true },
  label: { type: String, required: true }
})
defineEmits(['update:modelValue'])
</script>

<template>
  <div class="flex items-center gap-3 text-[14px]">
    <span class="text-mist">{{ label }}</span>
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      @click="$emit('update:modelValue', option.value)"
      :aria-pressed="modelValue === option.value"
      :class="['rounded-full px-3 py-1 transition', modelValue === option.value ? 'bg-cream text-ink font-semibold' : 'text-mist hover:text-cream']"
    >{{ option.label }}</button>
  </div>
</template>
