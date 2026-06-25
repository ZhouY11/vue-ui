<script setup lang="ts">
import { isString } from '@vue-ui/shared';
import { computed } from 'vue';

const props = defineProps<{variant?: unknown}>()

const label = computed(() => isString(props.variant) ? props.variant : '')
</script>

<template>
    <div>Button {{ label }}</div>
</template>