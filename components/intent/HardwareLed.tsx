import { View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '../../constants/theme';

type HardwareLedSize = 'small' | 'medium';
type HardwareLedTone = 'orange' | 'sage';

type HardwareLedProps = {
  isOn?: boolean;
  size?: HardwareLedSize;
  tone?: HardwareLedTone;
};

const ledSizes = {
  small: 15,
  medium: 17,
} as const;

export function HardwareLed({ isOn = true, size = 'small', tone = 'orange' }: HardwareLedProps) {
  const ledSize = ledSizes[size];
  const toneColor = isOn ? (tone === 'sage' ? colors.sage : colors.orange) : '#9A9D99';
  const coreOpacity = isOn ? '1' : '0.26';
  const glowOpacity = isOn ? '1' : '0.18';
  const highlightOpacity = isOn ? '0.86' : '0.44';

  return (
    <View pointerEvents="none" style={{ width: ledSize, height: ledSize }}>
      <Svg width={ledSize} height={ledSize} viewBox="0 0 44 44">
        <Defs>
          <RadialGradient id="smallLedSurfaceTint" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={toneColor} stopOpacity={isOn ? '0.12' : '0.09'} />
            <Stop offset="48%" stopColor={toneColor} stopOpacity={isOn ? '0.045' : '0.035'} />
            <Stop offset="100%" stopColor={toneColor} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="smallLedOuterGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={toneColor} stopOpacity={isOn ? '0.32' : '0.08'} />
            <Stop offset="34%" stopColor={toneColor} stopOpacity={isOn ? '0.12' : '0.035'} />
            <Stop offset="100%" stopColor={toneColor} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="smallLedMidGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={toneColor} stopOpacity={isOn ? '0.34' : '0.09'} />
            <Stop offset="58%" stopColor={toneColor} stopOpacity={isOn ? '0.13' : '0.04'} />
            <Stop offset="100%" stopColor={toneColor} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="smallLedInnerGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={toneColor} stopOpacity={isOn ? '0.42' : '0.12'} />
            <Stop offset="70%" stopColor={toneColor} stopOpacity={isOn ? '0.2' : '0.055'} />
            <Stop offset="100%" stopColor={toneColor} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="smallLedCore" cx="36%" cy="34%" r="68%">
            <Stop offset="0%" stopColor="#F0EEE9" stopOpacity={isOn ? '0.95' : '0.48'} />
            <Stop offset="24%" stopColor={toneColor} stopOpacity={coreOpacity} />
            <Stop offset="100%" stopColor={toneColor} stopOpacity={isOn ? '0.96' : '0.2'} />
          </RadialGradient>
        </Defs>

        <Circle cx="22" cy="22" r="20" fill="url(#smallLedSurfaceTint)" />
        <Circle cx="22" cy="22" r="21" fill="url(#smallLedOuterGlow)" opacity={glowOpacity} />
        <Circle cx="22" cy="22" r="14" fill="url(#smallLedMidGlow)" opacity={glowOpacity} />
        <Circle cx="22" cy="22" r="8" fill="url(#smallLedInnerGlow)" />
        <Circle cx="22" cy="22" r="3" fill="url(#smallLedCore)" />
        <Circle cx="20.9" cy="20.7" r="0.75" fill="#F0EEE9" opacity={highlightOpacity} />
      </Svg>
    </View>
  );
}
