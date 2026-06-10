import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '../../constants/theme';

type HardwareLedSize = 'xs' | 'small' | 'medium' | 'large';
type HardwareLedTone = 'orange' | 'sage' | 'success';

type HardwareLedProps = {
  isOn?: boolean;
  size?: HardwareLedSize;
  tone?: HardwareLedTone;
  pulseOpacity?: Animated.Value;
};

const ledSizes = {
  xs: 12,
  small: 20,
  medium: 28,
  large: 44,
} as const;

export function HardwareLed({ isOn = true, size = 'small', tone = 'orange', pulseOpacity }: HardwareLedProps) {
  const ledSize = ledSizes[size];
  const toneColor = tone === 'success' ? colors.successGreen : tone === 'sage' ? colors.sageLight : colors.alertOrangeRed;
  const isSuccessTone = tone === 'success';
  const coronaStartOpacity = isSuccessTone ? '0.48' : '0.46';
  const coronaMidOpacity = isSuccessTone ? '0.22' : '0.18';
  const innerStartOpacity = isSuccessTone ? '0.82' : '0.82';
  const innerMidOpacity = isSuccessTone ? '0.58' : '0.54';
  const emitWhiteStartOpacity = isSuccessTone ? '0.34' : '0.32';
  const emitWhiteMidOpacity = isSuccessTone ? '0.13' : '0.10';
  const emitEdgeOpacity = isSuccessTone ? '0.84' : '0.94';

  return (
    <View pointerEvents="none" style={{ width: ledSize, height: ledSize }}>
      <Svg width={ledSize} height={ledSize} viewBox="0 0 44 44">
        <Defs>
          <RadialGradient id="sLedSocket" cx="42%" cy="38%" r="62%">
            <Stop offset="0%"   stopColor="#3A332E" stopOpacity="1" />
            <Stop offset="56%"  stopColor="#211D1A" stopOpacity="1" />
            <Stop offset="100%" stopColor="#111312" stopOpacity="1" />
          </RadialGradient>
          <RadialGradient id="sLedDormantGlass" cx="34%" cy="30%" r="66%">
            <Stop offset="0%"   stopColor="#4A4038" stopOpacity="1" />
            <Stop offset="42%"  stopColor="#211D1A" stopOpacity="1" />
            <Stop offset="100%" stopColor="#0F0D0C" stopOpacity="1" />
          </RadialGradient>
        </Defs>

        <Circle cx="22" cy="22" r="6.4" fill="rgba(17,19,18,0.76)" stroke="none" />
        <Circle cx="22" cy="22" r="5.6" fill="url(#sLedSocket)" stroke="none" opacity={isOn ? '0.28' : '1'} />
        <Circle cx="22" cy="22" r="4.5" fill="url(#sLedDormantGlass)" stroke="none" opacity={isOn ? '0.18' : '1'} />
        <Circle cx="21.0" cy="20.1" r="1.05" fill="#F6F3EC" stroke="none" opacity={isOn ? '0.24' : '0.24'} />
      </Svg>

      {isOn ? (
        <Animated.View style={[styles.emitLayer, pulseOpacity ? { opacity: pulseOpacity } : null]}>
          <Svg width={ledSize} height={ledSize} viewBox="0 0 44 44">
            <Defs>
              <RadialGradient id="sLedCoronaOn" cx="50%" cy="50%" r="50%">
                <Stop offset="0%"   stopColor={toneColor} stopOpacity={coronaStartOpacity} />
                <Stop offset="38%"  stopColor={toneColor} stopOpacity={coronaMidOpacity} />
                <Stop offset="100%" stopColor={toneColor} stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="sLedInnerGlowOn" cx="50%" cy="50%" r="50%">
                <Stop offset="0%"   stopColor={toneColor} stopOpacity={innerStartOpacity} />
                <Stop offset="55%"  stopColor={toneColor} stopOpacity={innerMidOpacity} />
                <Stop offset="100%" stopColor={toneColor} stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="sLedEmitOn" cx="48%" cy="46%" r="58%">
                <Stop offset="0%"   stopColor="#FFFFFF"  stopOpacity={emitWhiteStartOpacity} />
                <Stop offset="30%"  stopColor="#FFFFFF"  stopOpacity={emitWhiteMidOpacity} />
                <Stop offset="65%"  stopColor={toneColor} stopOpacity="1" />
                <Stop offset="100%" stopColor={toneColor} stopOpacity={emitEdgeOpacity} />
              </RadialGradient>
            </Defs>

            <Circle cx="22" cy="22" r={isSuccessTone ? '17' : '18'} fill="url(#sLedCoronaOn)" stroke="none" />
            <Circle cx="22" cy="22" r={isSuccessTone ? '9' : '9.8'} fill="url(#sLedInnerGlowOn)" stroke="none" />
            <Circle cx="22" cy="22" r="6.2" fill={toneColor} stroke="none" opacity={isSuccessTone ? '0.78' : '0.96'} />
            <Circle cx="22" cy="22" r="5.8" fill="url(#sLedEmitOn)" stroke="none" />
            <Circle cx="21.0" cy="20.2" r="1.1" fill="#FFFFFF" stroke="none" opacity={isSuccessTone ? '0.62' : '0.82'} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emitLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});
