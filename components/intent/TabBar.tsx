import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HardwareLed } from './HardwareLed';
import { IconSymbol } from '../ui/icon-symbol';
import { colors, typography } from '../../constants/theme';

const BAR_HEIGHT = 62;

type TabIconName = 'house.fill' | 'clock.fill' | 'list.bullet.rectangle.fill' | 'person.crop.circle.fill';

const ICON_MAP: Record<string, TabIconName> = {
  index:   'house.fill',
  session: 'clock.fill',
  recent:  'list.bullet.rectangle.fill',
  account: 'person.crop.circle.fill',
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const visibleRoutes = state.routes.filter((route) => route.name in ICON_MAP);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#C8C4BA', '#F6F3EC']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.outer}>
        {/* Contact shadow along the top lip */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(52,47,39,0.30)', 'rgba(52,47,39,0.10)', 'rgba(52,47,39,0.03)', 'rgba(52,47,39,0)']}
          locations={[0, 0.36, 0.68, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.contactGap}
        />
        {/* Cavity shadow */}
        <View pointerEvents="none" style={styles.cavityShadow} />
        {/* Inner ceramic field */}
        <View style={[styles.inner, { paddingBottom: insets.bottom }]}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(17,19,18,0.09)', 'rgba(17,19,18,0.02)', 'rgba(17,19,18,0)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.innerTopShade}
          />
          {/* Bottom glint */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.52)', 'rgba(255,255,255,0.52)', 'rgba(255,255,255,0)']}
            locations={[0, 0.22, 0.78, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.bottomGlint}
          />

          <View style={styles.tabRow}>
            {visibleRoutes.map((route, i) => {
              const isFocused = state.routes[state.index].key === route.key;
              const label = descriptors[route.key].options.title ?? route.name;
              const iconName = ICON_MAP[route.name] ?? 'house.fill';
              const tint = isFocused ? colors.sage : colors.muted;

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
                <View key={route.key} style={styles.tabItemOuter}>
                  {i > 0 && (
                    <View style={styles.divider}>
                      <View style={styles.divDark} />
                      <View style={styles.divLight} />
                    </View>
                  )}
                  <Pressable
                    onPress={onPress}
                    style={styles.tabItem}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isFocused }}
                    accessibilityLabel={typeof label === 'string' ? label : route.name}>
                    <HardwareLed isOn={isFocused} size="xs" tone="sage" />
                    <IconSymbol name={iconName} size={22} color={tint} />
                    <Text style={[styles.tabLabel, { color: tint }]} numberOfLines={1}>
                      {typeof label === 'string' ? label : route.name}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    shadowColor: '#111312',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  outer: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    paddingTop: 4,
    paddingHorizontal: 4,
    position: 'relative',
  },
  contactGap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 20,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    zIndex: 2,
  },
  cavityShadow: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 0,
    borderTopLeftRadius: 21,
    borderTopRightRadius: 21,
    backgroundColor: 'rgba(17,19,18,0.018)',
    shadowColor: '#111312',
    shadowOpacity: 0.20,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  inner: {
    backgroundColor: '#E4E0D8',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  innerTopShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 18,
    zIndex: 2,
  },
  bottomGlint: {
    position: 'absolute',
    bottom: 1,
    left: 0,
    right: 0,
    height: 1,
    zIndex: 2,
  },
  tabRow: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  tabItemOuter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  divider: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginVertical: 10,
  },
  divDark: {
    width: 1,
    backgroundColor: 'rgba(17,19,18,0.14)',
  },
  divLight: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.68)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 6,
    gap: 3,
  },
  tabLabel: {
    fontFamily: typography.chip.fontFamily,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.3,
  },
});
