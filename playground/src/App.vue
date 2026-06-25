<script setup lang="ts">
import { ref } from 'vue';
import { Button } from '@vue-ui/ui';

const count = ref(0);

function handlePress() {
  count.value++;
}
</script>

<template>
  <main style="padding: 40px; display: grid; gap: 16px;">
    <h1>Modern Vue UI Playground</h1>

    <Button @press="handlePress">
      Solid Button {{ count }}
    </Button>

    <Button variant="outline">
      Outline Button
    </Button>

    <Button variant="ghost" size="lg">
      Ghost Large Button
    </Button>

    <Button loading>
      Loading Button
    </Button>

    <Button as="a" href="#" @press="handlePress">
      Link As Button
    </Button>
  </main>
</template>