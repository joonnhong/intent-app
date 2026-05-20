import { Tabs } from 'expo-router';
import React from 'react';

import { TabBar } from '@/components/intent/TabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index"   options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="session" options={{ title: 'Session' }} />
      <Tabs.Screen name="recent"  options={{ title: 'Recent' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
      <Tabs.Screen name="timer"   options={{ href: null }} />
    </Tabs>
  );
}
