import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';

import { colors } from '../../constants/theme';

type ButtonAssemblyProps = {
  style?: StyleProp<ViewStyle>;
};

const TICK_COUNT = 104;

function TickRing() {
  return (
    <View pointerEvents="none" style={styles.tickRing}>
      {Array.from({ length: TICK_COUNT }, (_, index) => (
        <View
          key={index}
          style={[
            styles.tickRotor,
            {
              transform: [{ rotate: `${(360 / TICK_COUNT) * index}deg` }],
            },
          ]}>
          <View style={styles.tickGroove}>
            <View style={styles.tickInset} />
          </View>
        </View>
      ))}
    </View>
  );
}

function TriangleMarker() {
  return (
    <Svg pointerEvents="none" width={24} height={24} viewBox="0 0 24 24" style={styles.triangleMarker}>
      <Polygon
        points="12,3 22,21 2,21"
        fill="rgba(102,107,103,0.16)"
        stroke="rgba(17,19,18,0.14)"
        strokeWidth={1}
      />
      <Polygon points="12,7 18,19 6,19" fill="rgba(255,255,255,0.38)" />
    </Svg>
  );
}

function CenterLed() {
  return (
    <Svg pointerEvents="none" width={28} height={28} viewBox="0 0 28 28" style={styles.centerLed}>
      <Circle cx="14" cy="14" r="12" fill="rgba(45,24,24,0.35)" />
      <Circle cx="14" cy="14" r="9" fill="#371F1F" />
      <Circle cx="13" cy="13" r="6.5" fill="#563030" />
      <Circle cx="11.2" cy="10.8" r="2" fill="rgba(255,255,255,0.16)" />
    </Svg>
  );
}

function PauseGlyph() {
  return (
    <View pointerEvents="none" style={styles.pauseGlyph}>
      {[0, 1, 2, 3].map((index) => (
        <LinearGradient
          key={index}
          colors={['rgba(255,255,255,0.32)', 'rgba(154,157,153,0.18)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.pauseBar}
        />
      ))}
    </View>
  );
}

export function ButtonAssembly({ style }: ButtonAssemblyProps) {
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={['#DEDAD0', '#F6F3EC']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.recessed}>
        <LinearGradient
          colors={['#FFFCF6', '#DEDAD0']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.bevel}>
          <View style={styles.surface}>
            <LinearGradient
              colors={['#DEDAD0', '#FFFCF6']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.outerDial}>
              <View pointerEvents="none" style={styles.outerCavityShadow} />
              <View style={styles.tickBand}>
                <TickRing />
              </View>
              <View style={styles.innerDial}>
                <TriangleMarker />
                <CenterLed />
                <PauseGlyph />
              </View>
            </LinearGradient>
          </View>
        </LinearGradient>
      </LinearGradient>
    </View>
  );
}

export default ButtonAssembly;

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 390,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  recessed: {
    width: 328,
    height: 328,
    borderRadius: 164,
    padding: 6,
  },
  bevel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 158,
    padding: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  surface: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    borderRadius: 152,
    backgroundColor: colors.surface,
    padding: 8,
  },
  outerDial: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 144,
  },
  outerCavityShadow: {
    position: 'absolute',
    top: 12,
    right: 12,
    bottom: 12,
    left: 12,
    borderRadius: 132,
    backgroundColor: 'rgba(17,19,18,0.018)',
    shadowColor: '#111312',
    shadowOpacity: 0.36,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tickBand: {
    position: 'absolute',
    width: 246,
    height: 246,
    overflow: 'hidden',
    borderRadius: 123,
    backgroundColor: '#F0EEE9',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tickRing: {
    ...StyleSheet.absoluteFillObject,
  },
  tickRotor: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
  },
  tickGroove: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 5,
    height: 18,
    marginTop: 7,
    borderRadius: 5,
    backgroundColor: 'rgba(17,19,18,0.09)',
  },
  tickInset: {
    width: 2,
    height: 14,
    borderRadius: 2,
    backgroundColor: 'rgba(154,157,153,0.42)',
  },
  innerDial: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 174,
    height: 174,
    borderRadius: 87,
    backgroundColor: colors.surface,
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  triangleMarker: {
    position: 'absolute',
    top: 26,
  },
  centerLed: {
    position: 'absolute',
    top: 70,
  },
  pauseGlyph: {
    position: 'absolute',
    bottom: 42,
    flexDirection: 'row',
    gap: 12,
  },
  pauseBar: {
    width: 22,
    height: 56,
  },
});
