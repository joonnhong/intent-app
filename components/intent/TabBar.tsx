import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HardwareLed } from './HardwareLed';

type TabRouteName = 'index' | 'recent' | 'session' | 'friends' | 'account';

type TabAssetSet = {
  defaultImage: ImageSourcePropType;
  pushedImage: ImageSourcePropType;
};

const FRAME_HEIGHT = 58;
const BUTTON_ROW_HEIGHT = 130;
const BUTTON_SIDE_OVERLAP = -10;
const BUTTON_ROW_OFFSET_Y = 0.8;
const NAV_BAR_OFFSET_Y = 4;
const FRAME_OFFSET_Y = -2;
const FRAME_HORIZONTAL_OUTSET = 2;
const FRAME_OPACITY = 0.8;
const BUTTON_IMAGE_WIDTH = '96%';
const BUTTON_ASPECT_RATIO = 332 / 224;
const LED_RING_SIZE = 13;
const LED_INNER_SIZE = 12;
const LED_TOP = '13%';

const RECESSED_FRAME = require('../../assets/nav-bar/fixed-recessed.png');
const TAB_ASSETS: Record<TabRouteName, TabAssetSet> = {
  index: {
    defaultImage: require('../../assets/nav-bar/home-default.png'),
    pushedImage: require('../../assets/nav-bar/home-pushed.png'),
  },
  recent: {
    defaultImage: require('../../assets/nav-bar/recent-default.png'),
    pushedImage: require('../../assets/nav-bar/recent-pushed.png'),
  },
  session: {
    defaultImage: require('../../assets/nav-bar/session-default.png'),
    pushedImage: require('../../assets/nav-bar/session-pushed.png'),
  },
  friends: {
    defaultImage: require('../../assets/nav-bar/friends-default.png'),
    pushedImage: require('../../assets/nav-bar/friends-pushed.png'),
  },
  account: {
    defaultImage: require('../../assets/nav-bar/account-default.png'),
    pushedImage: require('../../assets/nav-bar/account-pushed.png'),
  },
};

function isTabRouteName(name: string): name is TabRouteName {
  return name in TAB_ASSETS;
}

function TabLed({ isOn, isPressed, isSession }: { isOn: boolean; isPressed: boolean; isSession: boolean }) {
  return (
    <View pointerEvents="none" style={[styles.ledMount, isPressed && styles.ledMountPressed]}>
      <View style={styles.ledInner}>
        <HardwareLed isOn={isOn} size="xs" tone="orange" />
      </View>
    </View>
  );
}

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [pressedRouteKey, setPressedRouteKey] = useState<string | null>(null);

  const visibleRoutes = state.routes.filter((route) => isTabRouteName(route.name));
  const safeBottom = Math.max(insets.bottom, 8);

  return (
    <View pointerEvents="box-none" style={[styles.root, { minHeight: FRAME_HEIGHT + safeBottom, paddingBottom: safeBottom }]}>
      <View pointerEvents="box-none" style={styles.hardwareFrame}>
        <View pointerEvents="none" style={styles.recessedFrame}>
          <Image
            source={RECESSED_FRAME}
            resizeMode="stretch"
            style={styles.recessedFrameImage}
          />
        </View>
        <View pointerEvents="box-none" style={styles.hardwareStrip}>
          {visibleRoutes.map((route, index) => {
            if (!isTabRouteName(route.name)) {
              return null;
            }

            const isFocused = state.routes[state.index].key === route.key;
            const isPressed = pressedRouteKey === route.key;
            const assets = TAB_ASSETS[route.name];
            const buttonImage = isPressed ? assets.pushedImage : assets.defaultImage;
            const label = descriptors[route.key].options.title ?? route.name;

            const onPress = () => {
              if (Platform.OS === 'ios') {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }

              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name as never);
              }
            };

            return (
              <View
                key={route.key}
                pointerEvents="box-none"
                style={[
                  styles.tabSlot,
                  index > 0 && styles.tabSlotOverlap,
                ]}>
                <Pressable
                  onPressIn={() => setPressedRouteKey(route.key)}
                  onPressOut={() => setPressedRouteKey((current) => current === route.key ? null : current)}
                  onPress={onPress}
                  hitSlop={{ top: 2, bottom: 6, left: 2, right: 2 }}
                  style={[
                    styles.tabButton,
                    isPressed && styles.tabButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isFocused }}
                  accessibilityLabel={typeof label === 'string' ? label : route.name}>
                  <View style={styles.buttonVisual}>
                    <Image
                      source={buttonImage}
                      resizeMode="contain"
                      style={styles.buttonImageAsset}
                    />
                    <TabLed isOn={isFocused} isPressed={isPressed} isSession={route.name === 'session'} />
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: 'transparent',
    paddingTop: 0,
    shadowColor: '#111312',
    shadowOpacity: 0.20,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
    zIndex: 100,
  },
  hardwareFrame: {
    height: FRAME_HEIGHT,
    justifyContent: 'center',
    marginHorizontal: FRAME_HORIZONTAL_OUTSET,
    paddingHorizontal: 0,
    position: 'relative',
    transform: [{ translateY: NAV_BAR_OFFSET_Y }],
    zIndex: 101,
  },
  recessedFrame: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ translateY: FRAME_OFFSET_Y }],
    opacity: FRAME_OPACITY,
  },
  recessedFrameImage: {
    width: '100%',
    height: '100%',
  },
  hardwareStrip: {
    height: BUTTON_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 1,
    transform: [{ translateY: BUTTON_ROW_OFFSET_Y }],
  },
  tabSlot: {
    flex: 1,
    height: BUTTON_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSlotOverlap: {
    marginLeft: BUTTON_SIDE_OVERLAP,
  },
  tabButton: {
    width: BUTTON_IMAGE_WIDTH,
    aspectRatio: BUTTON_ASPECT_RATIO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonPressed: {
    transform: [{ translateY: 1 }],
  },
  buttonVisual: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  buttonImageAsset: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  ledMount: {
    position: 'absolute',
    top: LED_TOP,
    width: LED_RING_SIZE,
    height: LED_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledMountPressed: {
    top: '13.4%',
  },
  ledInner: {
    position: 'absolute',
    width: LED_INNER_SIZE,
    height: LED_INNER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
