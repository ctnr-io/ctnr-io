'use dom';

import { Slot } from 'expo-router'
import { AppLayout } from 'app/components/ctnr-io/app-layout.tsx'

export default function MainLayout() {
  return (
    <AppLayout>
      <Slot />
    </AppLayout>
  )
}
