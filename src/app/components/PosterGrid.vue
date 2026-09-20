<script setup>
import PosterTile from './PosterTile.vue'
defineProps({ movies: { type: Array, required: true } })
defineEmits(['select'])
</script>

<template>
  <div class="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
    <PosterTile v-for="movie in movies" :key="movie.tmdbId" :movie="movie" @select="$emit('select', $event)" />
  </div>
</template>
